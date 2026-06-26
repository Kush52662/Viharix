import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  Send, 
  X, 
  Brain, 
  Search, 
  Compass, 
  ChevronRight, 
  Check, 
  User, 
  MapPin, 
  UtensilsCrossed, 
  Zap, 
  DollarSign, 
  Crown, 
  Clock,
  ExternalLink,
  ChevronDown,
  Plus,
  Star
} from "lucide-react";
import { 
  Box, 
  Typography, 
  IconButton, 
  CircularProgress, 
  TextField, 
  Menu,
  MenuItem
} from "@mui/material";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Activity } from "../types";
import { getCategoryImage, CATEGORY_COLORS } from "../lib/images";

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  "";

const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY";

interface Message {
  role: "user" | "assistant";
  content: string;
  thinking?: string | null;
  groundingSources?: { title: string; uri: string }[] | null;
  timestamp: string;
}

interface TravelAssistantChatProps {
  isOpen: boolean;
  onClose: () => void;
  destination: string;
  tripName: string;
  onAddActivity?: (activityData: Partial<Activity>) => Promise<any>;
  onPreviewActivity?: (activityData: Partial<Activity>) => void;
}

const CHAT_ROLES = [
  {
    id: "guide",
    title: "Expert Guide",
    icon: <Compass size={14} className="text-[#3B82F6]" />,
    instruction: "You are a world-class, professional travel guide. You have deep knowledge of history, cultural significance, local tips, landmarks, and structural details. Keep your tone exciting, friendly, and highly informative."
  },
  {
    id: "backpacker",
    title: "Backpacker",
    icon: <DollarSign size={14} className="text-[#10B981]" />,
    instruction: "You are an experienced, budget-conscious backpacker. You specialize in identifying secret free attractions, cheap public transport tricks, incredible street food, local discount hours, and smart money-saving hacks. Keep your tone casual, savvy, and adventurous."
  },
  {
    id: "luxury",
    title: "Luxury Concierge",
    icon: <Crown size={14} className="text-[#F59E0B]" />,
    instruction: "You are an elite, premium 5-star luxury hotel concierge. You specialize in high-end fine dining, exclusive private excursions, boutique shopping, VIP services, and absolute comfort. Keep your tone extremely refined, polite, and top-tier."
  },
  {
    id: "adrenaline",
    title: "Adrenaline",
    icon: <Zap size={14} className="text-[#EF4444]" />,
    instruction: "You are an outdoor adventure athlete and wilderness explorer. You specialize in scenic hikes, extreme water sports, hidden lookouts, cycling paths, national parks, and thrill-seeking local experiences. Keep your tone high-energy, bold, and enthusiastic."
  },
  {
    id: "foodie",
    title: "Foodie",
    icon: <UtensilsCrossed size={14} className="text-[#8B5CF6]" />,
    instruction: "You are an obsessive culinary critic and local foodie. You specialize in seeking out the absolute best regional dishes, hidden neighborhood eateries, local markets, trendy cafes, and traditional dining spots. Keep your tone mouthwatering, delicious, and deeply passionate about gastronomy."
  }
];



const formatResponseText = (text: string) => {
  if (!text) return "";
  
  const lines = text.split("\n");
  
  return lines.map((line, idx) => {
    let formattedLine = line;
    const isBullet = line.trim().startsWith("- ") || line.trim().startsWith("* ");
    if (isBullet) {
      formattedLine = line.trim().substring(2);
    }
    
    const parts = [];
    let currentIdx = 0;
    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;
    
    while ((match = boldRegex.exec(formattedLine)) !== null) {
      if (match.index > currentIdx) {
        parts.push(formattedLine.substring(currentIdx, match.index));
      }
      parts.push(
        <strong key={match.index} className="font-semibold text-[#222222]">
          {match[1]}
        </strong>
      );
      currentIdx = boldRegex.lastIndex;
    }
    
    if (currentIdx < formattedLine.length) {
      parts.push(formattedLine.substring(currentIdx));
    }

    if (isBullet) {
      return (
        <li key={idx} className="ml-5 list-disc pl-0.5 mb-1 text-[#222222] leading-relaxed text-sm">
          {parts.length > 0 ? parts : formattedLine}
        </li>
      );
    }

    return (
      <p key={idx} className="mb-2 text-[#222222] leading-relaxed text-sm min-h-[0.5rem]">
        {parts.length > 0 ? parts : formattedLine}
      </p>
    );
  });
};

const parsePlacesFromContent = (content: string) => {
  if (!content) return { cleanContent: "", places: [] as any[] };
  
  const pattern = /```places-json\s*([\s\S]*?)\s*```/;
  const match = content.match(pattern);
  
  if (match) {
    const jsonStr = match[1].trim();
    const cleanContent = content.replace(pattern, "").trim();
    try {
      const places = JSON.parse(jsonStr);
      if (Array.isArray(places)) {
        return { cleanContent, places };
      }
    } catch (e) {
      console.warn("Failed to parse places JSON from response:", e);
    }
  }
  
  return { cleanContent: content, places: [] as any[] };
};

interface ActivityRecommendationCardProps {
  place: {
    title: string;
    category: string;
    location: string;
    notes: string;
    estimatedDuration: string;
    rating: string;
  };
  onAddActivity?: (activityData: Partial<Activity>) => Promise<any>;
  onPreviewActivity?: (activityData: Partial<Activity>) => void;
}

function ActivityRecommendationCard({ place, onAddActivity, onPreviewActivity }: ActivityRecommendationCardProps) {
  const [isAdded, setIsAdded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Dynamic live Google Maps Platform grounding state
  const placesLib = useMapsLibrary("places");
  const [gmpData, setGmpData] = useState<{
    rating: string;
    photoUrl: string | null;
    location: string;
  } | null>(null);
  const [loadingGmp, setLoadingGmp] = useState(false);

  useEffect(() => {
    if (!placesLib || !place.title) return;

    setLoadingGmp(true);
    try {
      const service = new google.maps.places.PlacesService(document.createElement("div"));
      const query = `${place.title} ${place.location || ""}`;

      service.textSearch({ query }, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
          const match = results[0];
          
          // Live rating and review count from Google Maps
          const ratingVal = match.rating;
          const reviewCount = match.user_ratings_total;
          const ratingStr = ratingVal 
            ? `${ratingVal} (${reviewCount ? reviewCount.toLocaleString() : "0"} reviews)`
            : place.rating;

          // Live Google Maps photo URL
          const photos = match.photos;
          const photoUrl = photos && photos[0] ? photos[0].getUrl({ maxWidth: 400 }) : null;

          // Live Google Maps formatted address
          const formattedAddress = match.formatted_address || place.location;

          setGmpData({
            rating: ratingStr,
            photoUrl: photoUrl,
            location: formattedAddress
          });
        }
        setLoadingGmp(false);
      });
    } catch (err) {
      console.error("Error fetching live Google Maps place details:", err);
      setLoadingGmp(false);
    }
  }, [placesLib, place.title, place.location]);

  const defaultImageUrl = getCategoryImage(place.category, place.title);
  const finalImageUrl = gmpData?.photoUrl || defaultImageUrl;
  const finalRating = gmpData?.rating || place.rating;
  const finalLocation = gmpData?.location || place.location;

  const colors = CATEGORY_COLORS[place.category] || CATEGORY_COLORS.Custom;

  const handleAdd = async () => {
    if (!onAddActivity || isAdding || isAdded) return;
    setIsAdding(true);
    try {
      await onAddActivity({
        title: place.title,
        category: place.category,
        imageURL: finalImageUrl,
        location: finalLocation,
        notes: place.notes,
        estimatedDuration: place.estimatedDuration,
        rating: finalRating,
        source: "AI Search",
        sourceDetail: "Grounded with Google Maps"
      });
      setIsAdded(true);
    } catch (err) {
      console.error("Failed to add activity:", err);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div 
      onClick={() => {
        if (onPreviewActivity) {
          onPreviewActivity({
            id: `preview-${Math.random().toString(36).substring(2, 9)}`,
            tripId: "",
            title: place.title,
            category: place.category,
            imageURL: finalImageUrl,
            location: finalLocation,
            notes: place.notes,
            estimatedDuration: place.estimatedDuration,
            rating: finalRating,
            source: "AI Search",
            sourceDetail: "Grounded with Google Maps",
            createdBy: "AI Travel Assistant",
            createdAt: new Date().toISOString(),
            status: "active"
          });
        }
      }}
      className="flex bg-white border border-[#ebebeb] hover:border-[#ff385c]/40 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.99] select-none"
    >
      {/* Thumbnail */}
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 bg-gray-50 flex items-center justify-center">
        {loadingGmp && !gmpData ? (
          <CircularProgress size={16} thickness={5} sx={{ color: "#ff385c" }} />
        ) : (
          <img
            src={finalImageUrl}
            alt={place.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = `https://picsum.photos/seed/${place.title || 'activity'}/150/150`;
            }}
          />
        )}
        <div className="absolute top-1.5 left-1.5">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${colors.bg} ${colors.text}`}>
            {place.category}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 p-2.5 flex flex-col justify-between min-w-0">
        <div>
          <div className="flex items-start justify-between gap-1">
            <h4 className="text-[12px] font-bold text-[#222222] truncate leading-snug pr-1">
              {place.title}
            </h4>
            {finalRating && (
              <div className="flex items-center gap-0.5 flex-shrink-0 bg-amber-50 px-1 py-0.5 rounded text-[9px] font-bold text-amber-700">
                <Star size={8} fill="#FFB238" color="#FFB238" />
                <span>{String(finalRating).split(" ")[0]}</span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-[#6a6a6a] mt-0.5 line-clamp-2 leading-relaxed">
            {place.notes}
          </p>
        </div>

        {/* Footer Meta */}
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <div className="flex flex-col gap-0.5 text-[9px] text-[#6a6a6a] truncate max-w-[60%] font-medium">
            {finalLocation && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.title + " " + finalLocation)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 truncate text-sky-600 hover:text-sky-700 hover:underline transition-colors"
                title={`Open ${place.title} in Google Maps`}
              >
                <MapPin size={9} className="flex-shrink-0 text-sky-500" />
                <span className="truncate">{finalLocation}</span>
                <ExternalLink size={8} className="flex-shrink-0" />
              </a>
            )}
            {place.estimatedDuration && (
              <span className="flex items-center gap-1 truncate">
                <Clock size={9} className="flex-shrink-0 text-gray-400" />
                <span>{place.estimatedDuration}</span>
              </span>
            )}
          </div>

          {/* Add to Trip Action */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAdd();
            }}
            disabled={isAdded || isAdding}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              isAdded
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : "bg-[#ff385c] hover:bg-[#e00b41] text-white active:scale-95 shadow-xs"
            }`}
          >
            {isAdding ? (
              <CircularProgress size={10} thickness={6} color="inherit" />
            ) : isAdded ? (
              <>
                <Check size={10} strokeWidth={3} />
                <span>Added</span>
              </>
            ) : (
              <>
                <Plus size={10} strokeWidth={3} />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TravelAssistantChat({ isOpen, onClose, destination, tripName, onAddActivity, onPreviewActivity }: TravelAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hi there! I am your Travel Assistant. Ready to help you plan your perfect trip to **${destination || tripName}**! 🌟 Ask me for local tips, secret paths, or culinary highlights.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [intelligenceMode, setIntelligenceMode] = useState<"standard" | "thinking" | "search">("standard");
  const [activeRoleId, setActiveRoleId] = useState("guide");
  const [isLoading, setIsLoading] = useState(false);
  const [openThinkingIdx, setOpenThinkingIdx] = useState<Record<number, boolean>>({});

  // Dropdown anchors for low-profile selector pills
  const [modeAnchorEl, setModeAnchorEl] = useState<null | HTMLElement>(null);
  const [roleAnchorEl, setRoleAnchorEl] = useState<null | HTMLElement>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const activeRole = CHAT_ROLES.find(r => r.id === activeRoleId) || CHAT_ROLES[0];

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = {
      role: "user",
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      const roleInstruction = activeRole.instruction;
      const tripContext = `You are helping plan a trip named "${tripName}" located in/to "${destination}". Always give highly specific local recommendations for this destination. Keep your recommendations beautifully formatted, concise, and professional.`;
      const systemInstructionCombined = `${roleInstruction}\n\n${tripContext}`;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          systemInstruction: systemInstructionCombined,
          mode: intelligenceMode
        })
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.content,
          thinking: data.thinking,
          groundingSources: data.groundingSources,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      const newMsgIdx = messages.length + 1;
      if (data.thinking) {
        setOpenThinkingIdx(prev => ({ ...prev, [newMsgIdx]: true }));
      }

    } catch (error) {
      console.error("Error communicating with Gemini assistant:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Oops! I ran into an issue connecting. Let's try again in a moment.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <Box
      id="travel-assistant-drawer"
      className="fixed inset-y-0 right-0 w-full md:w-[420px] bg-white flex flex-col border-l border-[#ebebeb] animate-slide-in"
      sx={{ 
        zIndex: 9999, // Ensure it is fully on top of all sheets/bottom-nav bars
        boxShadow: "rgba(0, 0, 0, 0.05) -4px 0px 24px 0px",
        animation: "slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "@keyframes slideIn": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" }
        }
      }}
    >
      {/* Header Panel */}
      <Box className="px-6 py-5 border-b border-[#ebebeb] flex items-center justify-between">
        <Box className="flex items-center gap-2">
          <Sparkles className="text-[#ff385c]" size={18} />
          <Box>
            <Typography className="text-[16px] font-semibold text-[#222222] tracking-tight leading-tight">
              Travel Assistant
            </Typography>
          </Box>
        </Box>
        
        <button 
          id="close-assistant-btn"
          onClick={onClose} 
          className="p-1.5 hover:bg-[#f7f7f7] text-[#222222] rounded-full border border-[#dddddd] transition-all"
        >
          <X size={15} />
        </button>
      </Box>



      {/* Scrollable Conversation Threads */}
      <Box 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-white"
        sx={{
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" }
        }}
      >
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          const { cleanContent, places } = parsePlacesFromContent(msg.content);
          return (
            <div key={idx} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
              {/* Message Block */}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                isUser 
                  ? "bg-[#ff385c] text-white rounded-tr-none" 
                  : "bg-[#f7f7f7] text-[#222222] rounded-tl-none border border-[#ebebeb]"
              }`}>
                {/* Deep Think Collapse reasoning inside the bubble */}
                {!isUser && msg.thinking && (
                  <Box className="mb-2.5 pb-2 border-b border-[#ebebeb] bg-purple-50/50 p-2 rounded-lg">
                    <button 
                      onClick={() => setOpenThinkingIdx(prev => ({ ...prev, [idx]: !prev[idx] }))}
                      className="flex items-center gap-1 text-[11px] font-semibold text-purple-700 cursor-pointer"
                    >
                      <Brain size={11} />
                      <span>{openThinkingIdx[idx] ? "Hide analysis" : "Show analysis"}</span>
                    </button>
                    {openThinkingIdx[idx] && (
                      <div className="mt-1 text-[10px] text-purple-800 font-mono leading-relaxed max-h-32 overflow-y-auto">
                        {msg.thinking}
                      </div>
                    )}
                  </Box>
                )}

                {/* Content */}
                <div className="text-[14px]">
                  {isUser ? (
                    <p className="leading-relaxed font-medium">{msg.content}</p>
                  ) : (
                    formatResponseText(cleanContent)
                  )}
                </div>

                {/* Search Grounding Web Sources */}
                {!isUser && msg.groundingSources && msg.groundingSources.length > 0 && (
                  <Box className="mt-2.5 pt-2 border-t border-[#ebebeb]">
                    <span className="text-[10px] font-semibold text-[#6a6a6a] uppercase tracking-wide block mb-1">
                      Web Sources:
                    </span>
                    <div className="flex flex-col gap-1">
                      {msg.groundingSources.map((source, sIdx) => (
                        <a
                          key={sIdx}
                          href={source.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#6a6a6a] hover:text-[#ff385c] transition-colors"
                        >
                          <ExternalLink size={10} className="flex-shrink-0" />
                          <span className="truncate max-w-[200px]">{source.title}</span>
                        </a>
                      ))}
                    </div>
                  </Box>
                )}
              </div>

              {/* Recommended Places Cards */}
              {!isUser && places.length > 0 && (
                <div className="mt-2.5 space-y-2 w-[85%]">
                  <div className="flex items-center gap-1.5 px-1 py-0.5">
                    <Sparkles size={11} className="text-[#ff385c] animate-pulse" />
                    <span className="text-[10px] font-extrabold text-[#717171] uppercase tracking-wider">
                      Suggested Places ({places.length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-2.5 w-full animate-fade-in">
                    {places.map((place: any, pIdx: number) => (
                      <ActivityRecommendationCard
                        key={pIdx}
                        place={place}
                        onAddActivity={onAddActivity}
                        onPreviewActivity={onPreviewActivity}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamp */}
              <div className="mt-1 px-1 text-[10px] text-[#6a6a6a]">
                <span>{msg.timestamp}</span>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="max-w-[85%] bg-[#f7f7f7] border border-[#ebebeb] rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
              <CircularProgress size={12} thickness={5} sx={{ color: "#ff385c" }} />
              <Typography className="text-xs text-[#6a6a6a]">
                {intelligenceMode === "thinking" 
                  ? "Thinking..." 
                  : intelligenceMode === "search"
                  ? "Searching Google..."
                  : "Drafting response..."}
              </Typography>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </Box>



      {/* Message Input (Sleek pill input representation with search orb style button) */}
      <Box className="p-5 border-t border-[#ebebeb] bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputValue);
          }}
          className="flex items-center gap-2 bg-[#f7f7f7] hover:bg-white rounded-full p-1.5 border border-[#dddddd] focus-within:border-[#222222] focus-within:bg-white transition-all"
        >
          <input
            id="chat-input-field"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask Travel Assistant..."
            disabled={isLoading}
            autoComplete="off"
            className="flex-1 bg-transparent px-3 text-[14px] text-[#222222] placeholder-[#929292] focus:outline-none disabled:opacity-50"
          />
          <button
            id="chat-send-btn"
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="flex-shrink-0 p-2.5 rounded-full bg-[#ff385c] hover:bg-[#e00b41] text-white disabled:bg-[#f2f2f2] disabled:text-[#929292] transition-all"
          >
            <Send size={14} />
          </button>
        </form>
      </Box>
    </Box>
  </APIProvider>
  );
}
