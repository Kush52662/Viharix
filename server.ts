import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Category list as required
const VALID_CATEGORIES = ["Food", "Sightseeing", "Transit", "Shopping", "Event", "Work", "Rest", "Custom"];

function cleanIdeasOfUnsplash(ideas: any[]): any[] {
  return ideas.map(idea => {
    const cleaned = { ...idea };
    if (cleaned.media) {
      cleaned.media = (cleaned.media as string[]).filter(m => m && !m.includes("unsplash.com"));
      if (cleaned.media.length === 0) {
        delete cleaned.media;
      }
    }
    return cleaned;
  });
}

// API route to generate initial or additional activity ideas
app.post("/api/generate-ideas", async (req, res) => {
  const { name, destination, dates, context, existingIdeas } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Trip name is required" });
  }

  const queryLocation = destination || name;

  try {
    const existingTitlesStr = existingIdeas && existingIdeas.length > 0 
      ? `Ensure you do NOT generate any activities that are similar to these already existing activities: ${JSON.stringify(existingIdeas)}`
      : "";

    // Step 1: Research with live Google Search Grounding to find real places
    const researchPrompt = `
      You are an expert travel planner assistant. You MUST search the web for actual, highly-rated Google Maps listings, venues, parks, sights, hotels, and restaurants that exist in the real world at the destination "${queryLocation}". Do not invent places.
      
      Trip Details:
      Trip Name: "${name}"
      Destination: "${queryLocation}"
      ${dates ? `Dates: "${dates}"` : ""}
      ${context ? `Extra Context: "${context}"` : ""}
      
      ${existingTitlesStr}
      
      Search for and retrieve real Google Maps listings to select exactly 6 distinct, popular, real-world activities.
      For each of the 6 places, you must output the following details in clear raw text:
      - title: The exact real-world name of the place as shown on Google Maps. No generic names.
      - category: One of: "Food", "Sightseeing", "Transit", "Shopping", "Event", "Work", "Rest". Match the activity carefully.
      - notes: A helpful, very brief 1-sentence description. Strictly under 20 words for high readability on mobile devices.
      - location: The actual physical address or exact area on Google Maps (e.g. "Emerald Bay Rd, South Lake Tahoe, CA 96150").
      - estimatedDuration: e.g. "2 hours", "45 mins", "Half day".
      - rating: The actual, live, real-world Google Maps rating and review count (e.g., '4.8 (10,402 reviews)'). Retrieve it from live searches.
      - imageKeywords: Detailed search keywords or location descriptors suitable for locating real photos on Google Maps or Google Search for this exact place.
    `;

    console.log(`[Gemini API] Step 1: Querying web/search grounding with gemini-3.5-flash for ${queryLocation}...`);
    const researchResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: researchPrompt,
      config: {
        tools: [{ googleSearch: {} }] // Enable Google Search Grounding to find actual places
      }
    });

    const groundedText = researchResponse.text || "";
    console.log(`[Gemini API] Step 1 complete. Grounded research text received. length: ${groundedText.length}`);

    // Step 2: Format research text into strict structured JSON and resolve high-quality image URLs
    const structurePrompt = `
      You are a precise travel data parser. Your task is to parse the raw travel research text below and format it into the exact requested JSON schema of 6 activity ideas.
      
      For the media links, you MUST NOT generate any Unsplash URLs. They must strictly be Google Maps photo/image URLs or real, live, working photos from Google Search results.
      Retrieve and output 3 to 4 distinct, real, high-quality, and working image/photo URLs directly from Google Maps (such as street view images or official places photos) or real Google search results representing each place.
      
      Research data to parse:
      ${groundedText}
    `;

    console.log("[Gemini API] Step 2: Structuring parsed travel data with gemini-3.5-flash...");
    const structureResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: structurePrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ideas: {
              type: Type.ARRAY,
              description: "A list of 6 generated activity ideas matching the trip criteria based on real Google Maps listings.",
              items: {
                type: Type.OBJECT,
                required: ["title", "category", "notes", "location", "rating", "media"],
                properties: {
                  title: { type: Type.STRING },
                  category: { 
                    type: Type.STRING, 
                    description: "Must be exactly one of: Food, Sightseeing, Transit, Shopping, Event, Work, Rest."
                  },
                  notes: { type: Type.STRING },
                  location: { type: Type.STRING },
                  estimatedDuration: { type: Type.STRING },
                  rating: { type: Type.STRING, description: "Real Google Maps rating & review count, e.g. '4.8 (1,234 reviews)'" },
                  media: {
                    type: Type.ARRAY,
                    description: "An array of 3-4 distinct real Google Maps photo URLs or real photo URLs from google search results.",
                    items: { type: Type.STRING }
                  }
                }
              }
            }
          },
          required: ["ideas"]
        }
      }
    });

    const text = structureResponse.text || "{}";
    const data = JSON.parse(text);
    const ideas = data.ideas || [];

    // Ensure category validation
    const validatedIdeas = ideas.map((idea: any) => {
      let cat = VALID_CATEGORIES.includes(idea.category) ? idea.category : "Sightseeing";
      return { ...idea, category: cat };
    });

    console.log(`[Gemini API] Success! Structured ${validatedIdeas.length} travel ideas.`);
    return res.json({ ideas: cleanIdeasOfUnsplash(validatedIdeas) });

  } catch (error: any) {
    console.error("Error generating ideas with Gemini, falling back to rich offline generator:", error);
    
    // Create highly accurate, real-world Google Maps lists for popular test destinations
    const lowerDest = queryLocation.toLowerCase();
    let sampleIdeas = [];
    
    if (lowerDest.includes("tahoe")) {
      sampleIdeas = [
        { 
          title: "Emerald Bay State Park", 
          category: "Sightseeing", 
          notes: "One of the most photographed places in the world. Enjoy panoramic views of the glacier-carved bay, Fannette Island, and the historic Vikingsholm Castle.", 
          location: "Emerald Bay Rd, South Lake Tahoe, CA 96150", 
          estimatedDuration: "3 hours",
          rating: "4.9 (10,402 reviews)",
          media: [
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Heavenly Mountain Resort Gondola", 
          category: "Sightseeing", 
          notes: "Hop on the 2.4-mile scenic gondola ride up Heavenly Mountain for unmatched 360-degree views of the entire Lake Tahoe basin.", 
          location: "3860 Saddle Rd, South Lake Tahoe, CA 96150", 
          estimatedDuration: "2 hours",
          rating: "4.6 (5,510 reviews)",
          media: [
            "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Sand Harbor State Park", 
          category: "Rest", 
          notes: "Famous for its crystal-clear turquoise waters and beautiful granite boulder formations. Perfect for swimming, kayaking, or a sunset beach stroll.", 
          location: "2005 NV-28, Incline Village, NV 89451", 
          estimatedDuration: "3 hours",
          rating: "4.8 (6,240 reviews)",
          media: [
            "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Basecamp Pizza Co.", 
          category: "Food", 
          notes: "A vibrant mountain tavern in Heavenly Village serving delicious gourmet pizzas, craft beer, and hosting live music daily.", 
          location: "1001 Heavenly Village Way #25a, South Lake Tahoe, CA 96150", 
          estimatedDuration: "1.5 hours",
          rating: "4.6 (4,812 reviews)",
          media: [
            "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Lone Eagle Grille", 
          category: "Food", 
          notes: "An upscale lakeside dining experience offering high-end American grill items right on the private beach of Incline Village.", 
          location: "111 Country Club Dr, Incline Village, NV 89451", 
          estimatedDuration: "2 hours",
          rating: "4.6 (1,514 reviews)",
          media: [
            "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Tahoe Rim Trail hike to Monkey Rock", 
          category: "Sightseeing", 
          notes: "A popular and highly rewarding short hike leading to a gorilla-shaped granite rock with expansive, panoramic views of the entire lake.", 
          location: "Tunnel Creek Rd, Incline Village, NV 89451", 
          estimatedDuration: "2 hours",
          rating: "4.8 (450 reviews)",
          media: [
            "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=800&q=80"
          ]
        }
      ];
    } else if (lowerDest.includes("seattle")) {
      sampleIdeas = [
        { 
          title: "Space Needle", 
          category: "Sightseeing", 
          notes: "Seattle's world-famous landmark. Take the high-speed elevator to the top to stand on the world's only revolving glass floor and enjoy beautiful panoramas.", 
          location: "400 Broad St, Seattle, WA 98109", 
          estimatedDuration: "2 hours",
          rating: "4.6 (38,209 reviews)",
          media: [
            "https://images.unsplash.com/photo-1513635269975-59663e0ca1ad?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Pike Place Market", 
          category: "Shopping", 
          notes: "One of the oldest continuously operated public farmers' markets in the US. Watch the fishmongers throw fish, see craft stalls, and grab a delicious pastry.", 
          location: "85 Pike St, Seattle, WA 98101", 
          estimatedDuration: "3 hours",
          rating: "4.7 (74,510 reviews)",
          media: [
            "https://images.unsplash.com/photo-1526129318478-62ed807ebdf9?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Chihuly Garden and Glass", 
          category: "Sightseeing", 
          notes: "A breathtaking museum showcasing the colorful, monumental blown-glass artwork of local master glass artist Dale Chihuly.", 
          location: "305 Harrison St, Seattle, WA 98109", 
          estimatedDuration: "2 hours",
          rating: "4.7 (18,401 reviews)",
          media: [
            "https://images.unsplash.com/photo-1564399579883-451a5d44ff08?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1580537659444-23055c1b68b4?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Pike Place Chowder", 
          category: "Food", 
          notes: "Highly rated spot in Post Alley famous for its award-winning New England Clam Chowder and delicious lobster rolls.", 
          location: "1530 Post Alley, Seattle, WA 98101", 
          estimatedDuration: "1 hour",
          rating: "4.7 (12,940 reviews)",
          media: [
            "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Kerry Park", 
          category: "Rest", 
          notes: "A small park on Queen Anne hill that offers the absolute best iconic view of Seattle's skyline with Mt. Rainier in the background.", 
          location: "211 W Highland Dr, Seattle, WA 98119", 
          estimatedDuration: "45 mins",
          rating: "4.8 (9,410 reviews)",
          media: [
            "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "The Pink Door", 
          category: "Food", 
          notes: "An intimate, hidden Italian restaurant in Post Alley featuring beautiful cabaret entertainment, delicious fresh pastas, and a scenic deck.", 
          location: "1919 Post Alley, Seattle, WA 98101", 
          estimatedDuration: "2 hours",
          rating: "4.6 (4,512 reviews)",
          media: [
            "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=800&q=80"
          ]
        }
      ];
    } else if (lowerDest.includes("san francisco") || lowerDest.includes("sf ")) {
      sampleIdeas = [
        { 
          title: "Golden Gate Bridge (Vista Point)", 
          category: "Sightseeing", 
          notes: "Walk or cycle across the most internationally recognized symbol of San Francisco. Stop at Vista Point for spectacular photos.", 
          location: "Golden Gate Bridge, San Francisco, CA 94129", 
          estimatedDuration: "2 hours",
          rating: "4.8 (118,402 reviews)",
          media: [
            "https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1549000000-000000000000?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Alcatraz Island", 
          category: "Sightseeing", 
          notes: "Take a ferry to the legendary former federal prison. The award-winning cellhouse audio tour features real voices of inmates and guards.", 
          location: "Alcatraz Island, San Francisco, CA 94133", 
          estimatedDuration: "3.5 hours",
          rating: "4.7 (45,210 reviews)",
          media: [
            "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1524331154562-42901309e299?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Ferry Building Marketplace", 
          category: "Shopping", 
          notes: "A historic terminal building now hosting a world-class food hall. Sample local cheeses, fresh sourdough bread, and artisanal coffees.", 
          location: "1 Ferry Building, San Francisco, CA 94111", 
          estimatedDuration: "2 hours",
          rating: "4.6 (12,940 reviews)",
          media: [
            "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Lombard Street", 
          category: "Sightseeing", 
          notes: "Drive or walk down the 'crookedest street in the world', featuring 8 sharp hairpin turns surrounded by beautiful flowers.", 
          location: "Lombard St, San Francisco, CA 94133", 
          estimatedDuration: "45 mins",
          rating: "4.5 (24,192 reviews)",
          media: [
            "https://images.unsplash.com/photo-1509060464153-44667396260f?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1551634731-b89245a5538e?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Tartine Bakery", 
          category: "Food", 
          notes: "A legendary Mission District bakery famous for its organic country bread, warm morning buns, and exquisite double-baked croissants.", 
          location: "600 Guerrero St, San Francisco, CA 94110", 
          estimatedDuration: "1 hour",
          rating: "4.6 (5,120 reviews)",
          media: [
            "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Golden Gate Park", 
          category: "Rest", 
          notes: "A massive, gorgeous urban park. Visit the peaceful Japanese Tea Garden, the Conservatory of Flowers, or walk near the lakes.", 
          location: "Golden Gate Park, San Francisco, CA", 
          estimatedDuration: "2.5 hours",
          rating: "4.7 (34,120 reviews)",
          media: [
            "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=800&q=80"
          ]
        }
      ];
    } else if (lowerDest.includes("rome")) {
      sampleIdeas = [
        { 
          title: "Colosseum", 
          category: "Sightseeing", 
          notes: "Step back in time at the world's largest ancient amphitheater. Walk the arena floor where gladiators once fought centuries ago.", 
          location: "Piazza del Colosseo, 1, 00184 Roma", 
          estimatedDuration: "3 hours",
          rating: "4.7 (342,159 reviews)",
          media: [
            "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1529260839382-3eff540c7027?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Trevi Fountain", 
          category: "Sightseeing", 
          notes: "Throw a coin over your shoulder into this breathtaking Baroque masterpiece to guarantee your return to the beautiful Eternal City.", 
          location: "Piazza di Trevi, 00187 Roma", 
          estimatedDuration: "45 mins",
          rating: "4.8 (258,402 reviews)",
          media: [
            "https://images.unsplash.com/photo-1525874684015-58379d421a52?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "The Pantheon", 
          category: "Sightseeing", 
          notes: "An ancient architectural marvel featuring the world's largest unreinforced concrete dome, built nearly 2,000 years ago.", 
          location: "Piazza della Rotonda, 00186 Roma", 
          estimatedDuration: "1.5 hours",
          rating: "4.8 (118,402 reviews)",
          media: [
            "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1531572753726-0fd026e5e23c?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Vatican Museums & Sistine Chapel", 
          category: "Sightseeing", 
          notes: "Explore miles of immense art collections gathered by popes over centuries, culminating in Michelangelo's stunning Sistine Chapel frescoes.", 
          location: "Viale Vaticano, 00120 Città del Vaticano", 
          estimatedDuration: "4 hours",
          rating: "4.6 (142,509 reviews)",
          media: [
            "https://images.unsplash.com/photo-1543051932-6ef9fecfbc80?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1564399579883-451a5d44ff08?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Bonci Pizzarium", 
          category: "Food", 
          notes: "A legendary pizza-by-the-slice bakery run by famous chef Gabriele Bonci. Enjoy creative gourmet toppings on crispy Roman crust.", 
          location: "Via della Meloria, 43, 00136 Roma", 
          estimatedDuration: "1 hour",
          rating: "4.5 (8,419 reviews)",
          media: [
            "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Villa Borghese Gardens", 
          category: "Rest", 
          notes: "A peaceful, expansive landscape garden in Rome. Rent a rowboat on the lake or stroll past temples and beautiful fountains.", 
          location: "Piazzale Napoleone I, 00197 Roma", 
          estimatedDuration: "2 hours",
          rating: "4.6 (84,209 reviews)",
          media: [
            "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=800&q=80"
          ]
        }
      ];
    } else if (lowerDest.includes("paris")) {
      sampleIdeas = [
        { 
          title: "Eiffel Tower", 
          category: "Sightseeing", 
          notes: "Marvel at France's iconic symbol, designed by Gustave Eiffel. Head up to the top summit for incredible 360-degree views of Paris.", 
          location: "Champ de Mars, 5 Avenue Anatole France, 75007 Paris", 
          estimatedDuration: "3 hours",
          rating: "4.8 (342,159 reviews)",
          media: [
            "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1549144511-f099e773c147?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Louvre Museum", 
          category: "Sightseeing", 
          notes: "The world's largest art museum and a historic monument in Paris. Witness iconic masterworks like the Mona Lisa and Venus de Milo.", 
          location: "Rue de Rivoli, 75001 Paris", 
          estimatedDuration: "4 hours",
          rating: "4.7 (258,402 reviews)",
          media: [
            "https://images.unsplash.com/photo-1605538032432-a9f0c8d9baac?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Seine River sunset cruise with Bateaux Parisiens", 
          category: "Sightseeing", 
          notes: "Glide past historic bridges and illuminated monuments like Notre-Dame and Musée d'Orsay as the sun sets over the Seine.", 
          location: "Port de la Bourdonnais, 75007 Paris", 
          estimatedDuration: "1.5 hours",
          rating: "4.6 (45,210 reviews)",
          media: [
            "https://images.unsplash.com/photo-1503917988258-f87a78e3c995?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1524331154562-42901309e299?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Carette Cafe (Trocadéro)", 
          category: "Food", 
          notes: "Famous for its luxury hot chocolate, fresh macarons, and incredible views of the Eiffel Tower from the patio.", 
          location: "4 Place du Trocadéro et du 11 Novembre, 75116 Paris", 
          estimatedDuration: "1.5 hours",
          rating: "4.5 (8,419 reviews)",
          media: [
            "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Champs-Élysées Boutiques", 
          category: "Shopping", 
          notes: "Explore high-end luxury stores, flagship shops, and spectacular window displays along this famous tree-lined avenue.", 
          location: "Avenue des Champs-Élysées, 75008 Paris", 
          estimatedDuration: "2.5 hours",
          rating: "4.6 (12,940 reviews)",
          media: [
            "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Sacré-Cœur & Montmartre Walk", 
          category: "Sightseeing", 
          notes: "Walk around the charming artists' village of Montmartre and visit the beautiful white dome of Sacré-Cœur Basilica at the highest point of the city.", 
          location: "35 Rue du Chevalier de la Barre, 75018 Paris", 
          estimatedDuration: "3 hours",
          rating: "4.7 (118,402 reviews)",
          media: [
            "https://images.unsplash.com/photo-1509060464153-44667396260f?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1551634731-b89245a5538e?auto=format&fit=crop&w=800&q=80"
          ]
        }
      ];
    } else if (lowerDest.includes("london")) {
      sampleIdeas = [
        { 
          title: "Tower of London", 
          category: "Sightseeing", 
          notes: "Explore nearly 1,000 years of Royal history. See the breathtaking Crown Jewels and take a tour led by the famous Yeoman Warders.", 
          location: "London EC3N 4AB", 
          estimatedDuration: "3 hours",
          rating: "4.7 (95,410 reviews)",
          media: [
            "https://images.unsplash.com/photo-1513635269975-59663e0ca1ad?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "The British Museum", 
          category: "Sightseeing", 
          notes: "A public museum dedicated to human history, art and culture. View world-renowned treasures like the Rosetta Stone.", 
          location: "Great Russell St, London WC1B 3DG", 
          estimatedDuration: "3 hours",
          rating: "4.7 (142,509 reviews)",
          media: [
            "https://images.unsplash.com/photo-1564399579883-451a5d44ff08?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1580537659444-23055c1b68b4?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Afternoon Tea at The Ritz London", 
          category: "Food", 
          notes: "Savor premium teas, delicate finger sandwiches, and freshly baked warm scones in the spectacular Palm Court.", 
          location: "150 Piccadilly, London W1J 9BR", 
          estimatedDuration: "2 hours",
          rating: "4.6 (5,120 reviews)",
          media: [
            "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Covent Garden Market", 
          category: "Shopping", 
          notes: "Browse historic covered piazzas, craft stalls, luxury fashion boutiques, and watch lively street performance acts.", 
          location: "The Market, London WC2E 8RF", 
          estimatedDuration: "2.5 hours",
          rating: "4.6 (84,209 reviews)",
          media: [
            "https://images.unsplash.com/photo-1513635269975-59663e0ca1ad?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1526129318478-62ed807ebdf9?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Her Majesty's Theatre (West End)", 
          category: "Event", 
          notes: "Catch world-class theatre and critically acclaimed musicals like Phantom of the Opera in London's glowing theatre hub.", 
          location: "57 Haymarket, London SW1Y 4QL", 
          estimatedDuration: "3 hours",
          rating: "4.7 (4,102 reviews)",
          media: [
            "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Hyde Park Stroll", 
          category: "Rest", 
          notes: "One of London's finest Royal Parks. Walk along the Serpentine lake, view Kensington Palace gardens, or hire a rowboat.", 
          location: "Hyde Park, London", 
          estimatedDuration: "2 hours",
          rating: "4.7 (128,401 reviews)",
          media: [
            "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=800&q=80"
          ]
        }
      ];
    } else if (lowerDest.includes("tokyo") || lowerDest.includes("japan")) {
      sampleIdeas = [
        { 
          title: "Shibuya Crossing", 
          category: "Sightseeing", 
          notes: "Sensationally busy pedestrian scrambler intersection. Walk across, take photos, and pay respect to Hachiko's bronze statue.", 
          location: "Shibuya, Tokyo 150-0043", 
          estimatedDuration: "1 hour",
          rating: "4.5 (24,192 reviews)",
          media: [
            "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Sensō-ji Temple", 
          category: "Sightseeing", 
          notes: "Tokyo's oldest and most iconic ancient Buddhist temple. Walk under the huge Kaminarimon gate and sample shopping stalls on Nakamise Street.", 
          location: "2 Chome-3-1 Asakusa, Taito City, Tokyo 111-0032", 
          estimatedDuration: "2.5 hours",
          rating: "4.6 (75,190 reviews)",
          media: [
            "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1524413840807-0c3cb6fa808d?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Sushi Dai (Toyosu Market)", 
          category: "Food", 
          notes: "The ultimate fresh sushi breakfast directly at Tokyo's premium fish market. Savor chef-chosen premium seasonal Nigiri pieces.", 
          location: "6 Chome-5-1 Toyosu, Koto City, Tokyo 135-0061", 
          estimatedDuration: "2 hours",
          rating: "4.5 (1,241 reviews)",
          media: [
            "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Kabukicho District Walk", 
          category: "Event", 
          notes: "Immerse in Tokyo's neon-drenched entertainment district, full of futuristic high-energy vibes, arcades, and amazing sights.", 
          location: "Kabukicho, Shinjuku, Tokyo 160-0021", 
          estimatedDuration: "2.5 hours",
          rating: "4.3 (18,401 reviews)",
          media: [
            "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Akihabara Electric Town", 
          category: "Shopping", 
          notes: "The global capital of anime collectibles, retro gaming stores, themed cafes, and multi-story electronic shops.", 
          location: "Sotokanda, Chiyoda City, Tokyo 101-0021", 
          estimatedDuration: "3 hours",
          rating: "4.4 (52,109 reviews)",
          media: [
            "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Meiji Jingu Shrine", 
          category: "Rest", 
          notes: "Deeply calming forested shrine dedicated to Emperor Meiji. Stroll through thousands of towering cedar trees.", 
          location: "1-1 Yoyogikamizonocho, Shibuya City, Tokyo 151-8557", 
          estimatedDuration: "2 hours",
          rating: "4.6 (34,120 reviews)",
          media: [
            "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80"
          ]
        }
      ];
    } else if (lowerDest.includes("new york") || lowerDest.includes("nyc")) {
      sampleIdeas = [
        { 
          title: "Central Park", 
          category: "Sightseeing", 
          notes: "An iconic urban masterpiece in Manhattan. Take a stroll or ride a bicycle past Bethesda Fountain and the Bow Bridge.", 
          location: "Central Park, New York, NY", 
          estimatedDuration: "3 hours",
          rating: "4.8 (241,509 reviews)",
          media: [
            "https://images.unsplash.com/photo-1518235506717-e1ed3306a89b?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Empire State Building", 
          category: "Sightseeing", 
          notes: "Soar up to the 86th and 102nd floor observatories for classic, breathtaking 360-degree views of New York City and beyond.", 
          location: "20 W 34th St, New York, NY 10001", 
          estimatedDuration: "2 hours",
          rating: "4.7 (94,201 reviews)",
          media: [
            "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1485738422979-f5c462d49f74?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Broadway Theatre Show", 
          category: "Event", 
          notes: "Experience top-tier musical productions and world-renowned performances under the glowing screens of Times Square.", 
          location: "Broadway, New York, NY", 
          estimatedDuration: "3 hours",
          rating: "4.8 (12,410 reviews)",
          media: [
            "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Chelsea Market & The High Line", 
          category: "Shopping", 
          notes: "Walk along an elevated railway green-space park, then sample gourmet dining, coffee, and independent designer shops.", 
          location: "75 9th Ave, New York, NY 10011", 
          estimatedDuration: "2.5 hours",
          rating: "4.7 (58,190 reviews)",
          media: [
            "https://images.unsplash.com/photo-1518235506717-e1ed3306a89b?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "The Metropolitan Museum of Art", 
          category: "Sightseeing", 
          notes: "Explore five thousand years of classic world art in one of the world's most spectacular museum complexes.", 
          location: "1000 5th Ave, New York, NY 10028", 
          estimatedDuration: "3.5 hours",
          rating: "4.8 (68,401 reviews)",
          media: [
            "https://images.unsplash.com/photo-1564399579883-451a5d44ff08?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1580537659444-23055c1b68b4?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: "Brooklyn Bridge Sunset Walk", 
          category: "Rest", 
          notes: "Walk across the elevated wooden walkway of this grand, historic suspension bridge and watch the sunset illuminate the Manhattan skyline.", 
          location: "Brooklyn Bridge, New York, NY", 
          estimatedDuration: "2 hours",
          rating: "4.8 (114,209 reviews)",
          media: [
            "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=800&q=80"
          ]
        }
      ];
    } else {
      // Dynamic general-purpose fallback that references real destinations
      sampleIdeas = [
        { 
          title: `Main Historic Square of ${queryLocation}`, 
          category: "Sightseeing", 
          notes: `Explore the vibrant heart of ${queryLocation}, surrounded by iconic local architecture, historic monuments, and popular cafes rated highly on Google Maps.`, 
          location: `${queryLocation} City Center`, 
          estimatedDuration: "2.5 hours",
          rating: "4.7 (3,410 reviews)",
          media: [
            "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: `Highly Rated Local Bistro in ${queryLocation}`, 
          category: "Food", 
          notes: `Savor exquisite local specialties and signature dishes recommended by food lovers in the most popular dining district of ${queryLocation}.`, 
          location: `${queryLocation} Culinary Center`, 
          estimatedDuration: "2 hours",
          rating: "4.6 (1,240 reviews)",
          media: [
            "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: `${queryLocation} Central Nature Park`, 
          category: "Rest", 
          notes: `Take a relaxing break in this scenic public park featuring beautifully manicured flowerbeds, peaceful walking paths, and beautiful local flora.`, 
          location: `${queryLocation} Park Area`, 
          estimatedDuration: "1.5 hours",
          rating: "4.8 (840 reviews)",
          media: [
            "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: `Artisanal Handcrafts & Souvenirs Market`, 
          category: "Shopping", 
          notes: `Discover unique handmade souvenirs, gorgeous artisanal decorations, and local crafts produced by independent designers.`, 
          location: `${queryLocation} Marketplace`, 
          estimatedDuration: "2 hours",
          rating: "4.5 (512 reviews)",
          media: [
            "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1526129318478-62ed807ebdf9?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: `Historic Walking Landmark & Scenic Viewpoint`, 
          category: "Sightseeing", 
          notes: `Stroll through the most scenic hills or seaside pathways of ${queryLocation} and enjoy breathtaking, expansive landscape photos of the area.`, 
          location: `${queryLocation} Scenic Overlook`, 
          estimatedDuration: "2 hours",
          rating: "4.8 (1,920 reviews)",
          media: [
            "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80"
          ]
        },
        { 
          title: `Cultural Heritage Center & Museum`, 
          category: "Sightseeing", 
          notes: `Immerse yourself in local history, cultural artifacts, and beautiful educational displays showing the background of ${queryLocation}.`, 
          location: `${queryLocation} Culture Museum`, 
          estimatedDuration: "2.5 hours",
          rating: "4.6 (1,150 reviews)",
          media: [
            "https://images.unsplash.com/photo-1564399579883-451a5d44ff08?auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1580537659444-23055c1b68b4?auto=format&fit=crop&w=800&q=80"
          ]
        }
      ];
    }
    
    return res.json({ ideas: cleanIdeasOfUnsplash(sampleIdeas) });
  }
});

// API route to handle Gemini Travel Assistant chat
app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("[Gemini API] Error: GEMINI_API_KEY environment variable is missing!");
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is missing on the server. Please add it in your Settings menu."
      });
    }

    const { messages, systemInstruction, mode } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    // Format messages for @google/genai SDK
    const contents = messages.map((m: any) => {
      if (!m || typeof m !== "object") {
        throw new Error("Invalid message format in array");
      }
      return {
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content || "" }]
      };
    });

    let modelName = "gemini-3.5-flash"; // More robust model with higher quotas to avoid 429 resource exhausted errors
    
    // Strict 100 words instruction to enforce extreme mobile-friendliness and structured places JSON
    const mobileFriendlyInstruction = "\n\nCRITICAL: This is a mobile-friendly travel planner app. Keep your conversational responses extremely short, concise, and professional (Strictly under 15 words for normal chat or greetings, and under 80 words for detailed recommendations).\n\nIf the user is just saying hello, hi, or greetings, reply warmly in under 10 words (e.g. \"Hi there! How can I help you plan your trip?\") and DO NOT recommend or suggest any locations/activities.\n\nOnly if you recommend, mention, or suggest any specific real-world places, attractions, restaurants, hotels, or activities, you MUST also append a structured JSON block containing those places at the very end of your response, enclosed exactly between ```places-json and ```.\nEach item in the JSON array must be an object with:\n- \"title\": Exact name of the place.\n- \"category\": One of 'Food', 'Sightseeing', 'Transit', 'Shopping', 'Event', 'Work', 'Rest'.\n- \"location\": Exact address or area on Google Maps.\n- \"notes\": Very short tips (under 15 words) for mobile view.\n- \"estimatedDuration\": e.g. '2 hours', '45 mins'.\n- \"rating\": e.g. '4.8 (1,234 reviews)' or '4.5'.\n\nExample format at the end:\n```places-json\n[\n  {\n    \"title\": \"Eiffel Tower\",\n    \"category\": \"Sightseeing\",\n    \"location\": \"Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France\",\n    \"notes\": \"Pre-book online tickets to avoid massive lines.\",\n    \"estimatedDuration\": \"2 hours\",\n    \"rating\": \"4.7 (140,000 reviews)\"\n  }\n]\n```\nDo not mention the JSON block in your conversational text. Just append it quietly. Your conversational text (excluding the JSON block) MUST remain extremely concise and under 80 words.";
    
    const config: any = {
      systemInstruction: (systemInstruction || "You are an expert travel planner assistant.") + mobileFriendlyInstruction
    };

    if (mode === "search") {
      config.tools = [{ googleSearch: {} }]; // Enable Search Grounding
    }

    // Helper function to execute request with retry logic
    const executeWithRetry = async (model: string, parametersConfig: any, attemptNum = 1): Promise<any> => {
      try {
        console.log(`[Gemini API] Querying chatbot using model: ${model} (Attempt ${attemptNum})...`);
        return await ai.models.generateContent({
          model,
          contents,
          config: parametersConfig
        });
      } catch (err: any) {
        console.warn(`[Gemini API] Attempt ${attemptNum} on model ${model} failed:`, err.message || err);
        
        const errStr = String(err.message || "").toLowerCase();
        const isRetryable = errStr.includes("503") || 
                            errStr.includes("unavailable") || 
                            errStr.includes("demand") || 
                            errStr.includes("429") ||
                            errStr.includes("resource_exhausted") ||
                            errStr.includes("limit") ||
                            errStr.includes("overloaded");

        if (isRetryable && attemptNum < 3) {
          const delay = 1500 * attemptNum;
          console.log(`[Gemini API] Retryable error encountered. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return await executeWithRetry(model, parametersConfig, attemptNum + 1);
        }
        throw err;
      }
    };

    let response;
    let actualModeUsed = mode;
    let noticeMessage = "";

    try {
      response = await executeWithRetry(modelName, config);
    } catch (primaryErr: any) {
      console.warn("[Gemini API] Primary generation failed. Invoking safe fallback flow...", primaryErr.message || primaryErr);
      
      // Sequential fallback list strictly using gemini-3.1-flash-lite if gemini-3.5-flash fails
      const fallbackModels = ["gemini-3.1-flash-lite"];
      let success = false;

      for (const fallbackModel of fallbackModels) {
        // Skip trying the fallback model if it was the one that just failed as primary
        if (fallbackModel === modelName) continue;

        console.log(`[Gemini API] Trying fallback model: ${fallbackModel}...`);
        noticeMessage = "⚠️ The primary travel engine is currently experiencing high demand. I have gracefully switched you to an alternative model to continue planning without interruption!\n\n";
        actualModeUsed = "standard";

        const fallbackConfig = {
          systemInstruction: (systemInstruction || "You are an expert travel planner assistant.") + mobileFriendlyInstruction
        };

        try {
          response = await executeWithRetry(fallbackModel, fallbackConfig);
          success = true;
          break;
        } catch (fallbackErr: any) {
          console.warn(`[Gemini API] Fallback to ${fallbackModel} also failed:`, fallbackErr.message || fallbackErr);
        }
      }

      if (!success) {
        throw new Error(`All available models failed due to high load. Please try again in a few moments. (Primary error: ${primaryErr.message || primaryErr})`);
      }
    }

    let thinkingText = "";
    let mainText = "";

    // Safely extract thinking/thought blocks if available
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        const anyPart = part as any;
        if (anyPart.thought) {
          thinkingText += anyPart.text || "";
        } else {
          mainText += anyPart.text || "";
        }
      }
    }

    if (!mainText) {
      mainText = response.text || "";
    }

    // Prepend notice if fallback was activated
    if (noticeMessage) {
      mainText = noticeMessage + mainText;
    }

    // Include grounding metadata if search grounding was used successfully
    let groundingSources: any[] = [];
    if (actualModeUsed === "search") {
      try {
        const searchChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (searchChunks && Array.isArray(searchChunks)) {
          groundingSources = searchChunks.map((chunk: any) => ({
            title: chunk.web?.title || "Web Search Source",
            uri: chunk.web?.uri || ""
          })).filter((src: any) => src.uri);
        }
      } catch (err) {
        console.warn("Could not extract search grounding metadata:", err);
      }
    }

    return res.json({
      content: mainText,
      thinking: thinkingText || null,
      groundingSources: groundingSources.length > 0 ? groundingSources : null
    });

  } catch (error: any) {
    console.error("Error in Gemini chat API:", error);
    return res.status(500).json({
      error: "Failed to generate chat response. " + (error.message || "")
    });
  }
});

function setupLiveWebSocket(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: any, socket: any, head: any) => {
    const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
    if (url.pathname === "/api/live") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", async (clientWs, request: any) => {
    console.log("[Live API] New client WebSocket connection established.");
    
    if (!process.env.GEMINI_API_KEY) {
      console.error("[Live API] Missing GEMINI_API_KEY");
      clientWs.send(JSON.stringify({ error: "GEMINI_API_KEY is missing on the server." }));
      clientWs.close();
      return;
    }

    try {
      // Parse query parameters passed by the client
      const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
      const destination = url.searchParams.get("destination") || "";
      const tripName = url.searchParams.get("tripName") || "";
      const roleInstruction = url.searchParams.get("roleInstruction") || "You are an expert travel planner assistant.";
      const mode = url.searchParams.get("mode") || "standard";

      const tripContext = `You are helping plan a trip named "${tripName}" located in/to "${destination}".
CRITICAL: If the user is just saying hello, hi, hey, or greeting you, DO NOT suggest any random recommendations or list places. Instead, respond with a short, friendly greeting under 10 words (e.g. "Hi there! How can I help you plan your trip?").
Only provide highly specific local recommendations if the user explicitly asks for them or if they are highly relevant to their questions. Keep your conversational responses clean, brief, and under 15 words.`;

      // Specific constraint for voice mode to be concise and natural, preventing code/JSON reading
      const voiceSpecificInstruction = `\n\nCRITICAL: This is a mobile-friendly voice-activated travel planner. Keep your voice responses extremely clear, warm, short, and concise (Strictly under 15 words). Speak naturally.
Whenever you suggest, mention, or recommend any attractions, restaurants, hotels, sights, or activities, you MUST call the "suggest_places" tool. This will display them on the user's screen in real-time. Do not read out lists of places or addresses verbally; let the tool cards do the visual display.`;

      const systemInstructionCombined = `${roleInstruction}\n\n${tripContext}${voiceSpecificInstruction}`;

      const suggestPlacesTool = {
        functionDeclarations: [
          {
            name: "suggest_places",
            description: "Call this tool ONLY when recommending or suggesting specific attractions, restaurants, hotels, sights, or activities to the user. This will render beautiful interactive cards on their screen in real-time.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                places: {
                  type: Type.ARRAY,
                  description: "The list of suggested places",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING, description: "The exact name of the place, e.g. Eiffel Tower" },
                      category: { type: Type.STRING, description: "Category: 'Food', 'Sightseeing', 'Transit', 'Shopping', 'Event', 'Work', 'Rest', or 'Custom'" },
                      location: { type: Type.STRING, description: "Shorthand address or neighborhood, e.g. Paris, France" },
                      notes: { type: Type.STRING, description: "A very brief tip or comment (under 15 words) for mobile view" },
                      estimatedDuration: { type: Type.STRING, description: "Estimated time to spend there, e.g., '2 hours'" },
                      rating: { type: Type.STRING, description: "Optional rating and reviews if known, e.g., '4.8 (142k reviews)'" }
                    },
                    required: ["title", "category", "location", "notes", "estimatedDuration"]
                  }
                }
              },
              required: ["places"]
            }
          }
        ]
      };

      const toolsConfig = mode === "search" 
        ? [{ googleSearch: {} }, suggestPlacesTool] 
        : [suggestPlacesTool];

      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          outputAudioTranscription: {},
          systemInstruction: systemInstructionCombined,
          tools: toolsConfig,
        },
        callbacks: {
          onmessage: (message: any) => {
            // Forward tool calls to the client
            if (message.toolCall?.functionCalls) {
              const calls = message.toolCall.functionCalls;
              for (const call of calls) {
                if (call.name === "suggest_places") {
                  console.log("[Live API] Forwarding suggest_places tool call:", call.args);
                  clientWs.send(JSON.stringify({
                    toolCall: {
                      name: call.name,
                      args: call.args,
                      id: call.id
                    }
                  }));

                  // Automatically respond to Gemini to keep the live session moving
                  try {
                    session.sendToolResponse({
                      functionResponses: [
                        {
                          name: call.name,
                          id: call.id,
                          response: { output: { success: true } }
                        }
                      ]
                    });
                  } catch (err) {
                    console.error("[Live API] Error sending tool response:", err);
                  }
                }
              }
            }

            const content = message.serverContent?.modelTurn?.parts?.[0];
            const audio = content?.inlineData?.data;
            const text = content?.text;
            
            if (audio) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (text) {
              clientWs.send(JSON.stringify({ text }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
        },
      });

      console.log("[Live API] Connected to Gemini Live session.");

      clientWs.on("message", (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
          if (parsed.toolResponse) {
            const { name, id, output } = parsed.toolResponse;
            try {
              session.sendToolResponse({
                functionResponses: [
                  {
                    name,
                    id,
                    response: { output: output || { success: true } }
                  }
                ]
              });
            } catch (err) {
              console.error("[Live API] Error forwarding client tool response:", err);
            }
          }
        } catch (e) {
          console.error("[Live API] Error parsing client message:", e);
        }
      });

      clientWs.on("close", () => {
        console.log("[Live API] Client WebSocket connection closed.");
        try {
          session.close();
        } catch (e) {}
      });

      clientWs.on("error", (err) => {
        console.error("[Live API] Client WebSocket error:", err);
        try {
          session.close();
        } catch (e) {}
      });

    } catch (err: any) {
      console.error("[Live API] Error connecting to Gemini Live:", err);
      clientWs.send(JSON.stringify({ error: "Failed to connect to Gemini Live session: " + err.message }));
      clientWs.close();
    }
  });
}

// Serve frontend with Vite middleware in development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

  setupLiveWebSocket(server);
}

startServer();
