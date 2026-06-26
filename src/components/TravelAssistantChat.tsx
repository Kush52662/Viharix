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
  Star,
  Globe,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2
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
import {
  PrimaryButton,
  SecondaryButton,
  PillButton,
  IconCircleButton,
  DestructiveButton,
  SegmentButton,
} from "./Button";

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
  isInline?: boolean;
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

const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
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
              <div className="flex items-center gap-0.5 flex-shrink-0 bg-[#f7f7f7] border border-[#ebebeb] px-1.5 py-0.5 rounded text-[9px] font-bold text-[#222222]">
                <Star size={9} fill="#222222" color="#222222" />
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
          <PrimaryButton
            onClick={(e) => {
              e.stopPropagation();
              handleAdd();
            }}
            disabled={isAdded || isAdding}
            size="sm"
            className={`!text-[10px] !px-2.5 !py-1 !font-bold ${
              isAdded
                ? "!bg-emerald-50 !text-emerald-600 !border !border-emerald-200 shadow-none hover:!bg-emerald-50"
                : ""
            }`}
          >
            {isAdding ? (
              <CircularProgress size={10} thickness={6} color="inherit" />
            ) : isAdded ? (
              <span className="flex items-center gap-1">
                <Check size={10} strokeWidth={3} />
                <span>Added</span>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Plus size={10} strokeWidth={3} />
                <span>Add</span>
              </span>
            )}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export default function TravelAssistantChat({ isOpen, onClose, destination, tripName, onAddActivity, onPreviewActivity, isInline = false }: TravelAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hi! Let's plan your perfect trip to **${destination || tripName}**.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [intelligenceMode, setIntelligenceMode] = useState<"standard" | "thinking" | "search">("standard");
  const [activeRoleId, setActiveRoleId] = useState("guide");
  const [isLoading, setIsLoading] = useState(false);
  const [openThinkingIdx, setOpenThinkingIdx] = useState<Record<number, boolean>>({});

  // Real-time voice feature state
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "connecting" | "active" | "error">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [liveSubtitle, setLiveSubtitle] = useState("");
  const [voiceError, setVoiceError] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const liveSubtitleAccumulatorRef = useRef<string>("");
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    return () => {
      // Clean up voice session on unmount
      cleanupVoice();
    };
  }, []);

  const cleanupVoice = () => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }
    if (processorNodeRef.current) {
      try {
        processorNodeRef.current.disconnect();
      } catch (e) {}
      processorNodeRef.current = null;
    }
    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {}
      micStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      try {
        inputAudioCtxRef.current.close();
      } catch (e) {}
      inputAudioCtxRef.current = null;
    }
    activeSourcesRef.current.forEach(src => {
      try {
        src.stop();
      } catch (e) {}
    });
    activeSourcesRef.current.clear();
    if (outputAudioCtxRef.current) {
      try {
        outputAudioCtxRef.current.close();
      } catch (e) {}
      outputAudioCtxRef.current = null;
    }
    nextStartTimeRef.current = 0;
  };

  const stopVoiceSession = () => {
    cleanupVoice();
    setIsVoiceActive(false);
    setVoiceStatus("idle");
  };

  const playAudioChunk = (audioContext: AudioContext, base64Data: string) => {
    try {
      const binary = window.atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }
      
      const buffer = audioContext.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);
      
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      
      const currentTime = audioContext.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime + 0.05;
      }
      
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;

      activeSourcesRef.current.add(source);
      source.onended = () => {
        activeSourcesRef.current.delete(source);
      };
    } catch (err) {
      console.error("[Voice] Playback error:", err);
    }
  };

  const startVoiceSession = async () => {
    setVoiceError("");
    setVoiceStatus("connecting");
    setLiveSubtitle("Connecting to voice assistant...");
    liveSubtitleAccumulatorRef.current = "";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      
      const qParams = new URLSearchParams();
      if (destination) qParams.set("destination", destination);
      if (tripName) qParams.set("tripName", tripName);
      if (activeRole) qParams.set("roleInstruction", activeRole.instruction);
      qParams.set("mode", intelligenceMode);

      const ws = new WebSocket(`${protocol}//${host}/api/live?${qParams.toString()}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setVoiceStatus("active");
        setLiveSubtitle("I'm listening! Speak whenever you are ready.");

        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorNodeRef.current = processor;

        source.connect(processor);
        processor.connect(inputCtx.destination);

        processor.onaudioprocess = (e) => {
          if (isMutedRef.current) return;
          if (ws.readyState !== WebSocket.OPEN) return;

          const channelData = e.inputBuffer.getChannelData(0);
          const pcmBuffer = floatTo16BitPCM(channelData);
          const base64 = arrayBufferToBase64(pcmBuffer);
          
          ws.send(JSON.stringify({ audio: base64 }));
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.error) {
            setVoiceError(msg.error);
            setVoiceStatus("error");
            cleanupVoice();
            return;
          }

          if (msg.audio) {
            playAudioChunk(outputCtx, msg.audio);
          }

          if (msg.text) {
            liveSubtitleAccumulatorRef.current += msg.text;
            setLiveSubtitle(liveSubtitleAccumulatorRef.current);
          }

          if (msg.toolCall) {
            const { name, id, args } = msg.toolCall;
            if (name === "suggest_places" && args?.places) {
              console.log("[Voice] Received suggested places from tool call:", args.places);
              // Append the places json block to the accumulator so it renders as elegant cards
              liveSubtitleAccumulatorRef.current += `\n\n\`\`\`places-json\n${JSON.stringify(args.places)}\n\`\`\``;
            }
            // Send back a toolResponse confirmation to keep session clean
            try {
              ws.send(JSON.stringify({
                toolResponse: {
                  name,
                  id,
                  output: { success: true }
                }
              }));
            } catch (err) {}
          }

          if (msg.interrupted) {
            activeSourcesRef.current.forEach(src => {
              try {
                src.stop();
              } catch (err) {}
            });
            activeSourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            liveSubtitleAccumulatorRef.current = "";
            setLiveSubtitle("Listening...");
          }

          if (msg.turnComplete) {
            const finalReply = liveSubtitleAccumulatorRef.current.trim();
            if (finalReply) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: finalReply,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ]);
            }
            liveSubtitleAccumulatorRef.current = "";
          }

        } catch (err) {
          console.error("[Voice] Error parsing socket message:", err);
        }
      };

      ws.onerror = () => {
        setVoiceError("Connection lost or server unavailable.");
        setVoiceStatus("error");
        cleanupVoice();
      };

      ws.onclose = () => {
        if (voiceStatus !== "error") {
          setVoiceStatus("idle");
        }
      };

    } catch (err: any) {
      console.error("[Voice] Error starting voice session:", err);
      let friendlyError = err.message || "Could not access microphone.";
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError" ||
        String(err).includes("Permission denied") ||
        String(err).includes("NotAllowedError")
      ) {
        friendlyError = "Microphone access denied. Try opening the app in a new tab using the URL bar, or click the lock icon next to your browser URL to enable microphone permissions.";
      }
      setVoiceError(friendlyError);
      setVoiceStatus("error");
      cleanupVoice();
    }
  };

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
      const tripContext = `You are helping plan a trip named "${tripName}" located in/to "${destination}".
CRITICAL: If the user is just saying hello, hi, hey, or greeting you, DO NOT suggest any random recommendations or list places. Instead, respond with a short, friendly greeting under 10 words (e.g. "Hi there! How can I help you plan your trip?").
Only provide highly specific local recommendations if the user explicitly asks for them or if they are highly relevant to their questions. Keep your conversational responses clean, brief, and under 15 words.`;
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

  if (!isOpen && !isInline) return null;

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <Box
        id={isInline ? "travel-assistant-inline" : "travel-assistant-drawer"}
        className={isInline 
          ? "w-full h-full bg-white flex flex-col sm:border sm:border-[#ebebeb] sm:rounded-3xl overflow-hidden sm:shadow-sm"
          : "fixed inset-y-0 right-0 w-full md:w-[420px] bg-white flex flex-col border-l border-[#ebebeb] animate-slide-in"
        }
        sx={isInline ? {
          zIndex: 1,
          position: "relative"
        } : { 
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
        {!isInline && (
          <Box className="px-6 py-5 border-b border-[#ebebeb] flex items-center justify-between bg-white">
            <Box className="flex items-center gap-2">
              <Sparkles className="text-[#ff385c]" size={16} />
              <Box>
                <Typography className="text-[15px] font-bold text-[#222222] tracking-tight leading-tight">
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
        )}

      {/* Scrollable Conversation Threads */}
      <Box 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 bg-white"
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
      <Box className="p-4 border-t border-[#ebebeb] bg-white">
        {/* Mini Integrated Voice Session Controller */}
        {isVoiceActive && (
          <Box className="mb-3 px-3.5 py-2.5 rounded-2xl bg-[#0f172a] text-white flex items-center justify-between shadow-lg border border-slate-800 animate-fade-in">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* Pulsing Dot */}
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 ${voiceStatus === "active" ? "" : "paused"}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${voiceStatus === "error" ? "bg-amber-500" : "bg-rose-500"}`} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider leading-none">
                  {voiceStatus === "connecting" && "Connecting voice..."}
                  {voiceStatus === "active" && (isMuted ? "Voice Muted" : "Voice Live")}
                  {voiceStatus === "error" && "Voice Error"}
                  {voiceStatus === "idle" && "Voice Ended"}
                </p>
                <p className="text-xs text-slate-200 truncate mt-0.5 pr-2 font-medium">
                  {voiceError ? voiceError : (liveSubtitle || "I'm listening! Speak whenever you are ready.")}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Mute Toggle Button */}
              <IconCircleButton
                type="button"
                onClick={() => setIsMuted(prev => !prev)}
                size="sm"
                className={`!p-1.5 transition-colors cursor-pointer ${
                  isMuted 
                    ? "!bg-rose-500/20 !text-rose-400 hover:!bg-rose-500/30" 
                    : "!bg-slate-800 !text-slate-300 hover:!bg-slate-700 hover:!text-white border-none"
                }`}
                title={isMuted ? "Unmute microphone" : "Mute microphone"}
              >
                {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
              </IconCircleButton>
              {/* End Call Button */}
              <IconCircleButton
                type="button"
                onClick={stopVoiceSession}
                size="sm"
                className="!p-1.5 !bg-rose-600 hover:!bg-rose-700 !text-white border-none"
                title="End Voice Session"
              >
                <X size={13} />
              </IconCircleButton>
            </div>
          </Box>
        )}

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
            placeholder={isVoiceActive ? "Voice active... or type here..." : "Ask Travel Assistant..."}
            disabled={isLoading}
            autoComplete="off"
            className="flex-1 bg-transparent px-3 text-[14px] text-[#222222] placeholder-[#929292] focus:outline-none disabled:opacity-50"
          />
          <IconCircleButton
            id="chat-voice-btn"
            type="button"
            onClick={() => {
              if (isVoiceActive) {
                stopVoiceSession();
              } else {
                setIsVoiceActive(true);
                startVoiceSession();
              }
            }}
            disabled={isLoading}
            size="sm"
            className={`!p-2.5 mr-0.5 ${
              isVoiceActive 
                ? "!bg-rose-500 !text-white animate-pulse border-none" 
                : "!bg-[#f0f0f0] hover:!bg-[#e4e4e4] !text-[#222222] hover:!text-[#ff385c]"
            }`}
            title={isVoiceActive ? "Stop voice session" : "Start voice session"}
          >
            {isVoiceActive ? <MicOff size={14} /> : <Mic size={14} />}
          </IconCircleButton>
          <IconCircleButton
            id="chat-send-btn"
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            size="sm"
            className="!p-2.5 !bg-[#ff385c] hover:!bg-[#e00b41] !text-white disabled:!bg-[#f2f2f2] disabled:!text-[#929292] border-none"
          >
            <Send size={14} />
          </IconCircleButton>
        </form>
      </Box>
    </Box>
  </APIProvider>
  );
}
