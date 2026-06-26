import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Tooltip,
  Dialog,
  IconButton,
  Divider,
  Chip,
} from "@mui/material";
import { 
  Plus, 
  Compass, 
  Users, 
  Sparkles, 
  MapPin, 
  Calendar, 
  User, 
  Minus, 
  Check, 
  Search,
  X,
  ArrowLeft
} from "lucide-react";
import { collection, doc, setDoc, getDocs, query, where, getDoc } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { Trip, Activity } from "../types";
import { getCategoryImage, getCleanImage } from "../lib/images";
import { gsap } from "gsap";
import { User as FirebaseUser } from "firebase/auth";

interface TripCreatorProps {
  onTripLoaded: (trip: Trip, isNewTrip?: boolean) => void;
  onShowAuth: () => void;
  currentUser: FirebaseUser | null;
}

const POPULAR_DESTINATIONS = [
  "Lake Tahoe, United States of America",
  "Paris, France",
  "Tokyo, Japan",
  "London, United Kingdom",
  "New York City, United States of America",
  "Rome, Italy",
  "Bali, Indonesia",
  "Sydney, Australia"
];

export default function TripCreator({ onTripLoaded, onShowAuth, currentUser }: TripCreatorProps) {
  // Inputs state - direct fields for destination and dates
  const [destination, setDestination] = useState("Lake Tahoe, United States of America");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + (7 - d.getDay() || 7)); // Next Sunday
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + (7 - d.getDay() || 7) + 1); // Next Monday
    return d.toISOString().split("T")[0];
  });

  const [travelerCount, setTravelerCount] = useState(6);
  const [customVibe, setCustomVibe] = useState("");
  const [bundleSave, setBundleSave] = useState(true);

  // Dedicated Overlay Control for Mobile-First optimized UI
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isTravelerModalOpen, setIsTravelerModalOpen] = useState(false);

  // Search input state inside Location Modal
  const [searchQuery, setSearchQuery] = useState("");

  // States for live global search
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced live global search via free, keyless OpenStreetMap Nominatim API
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Only search if query is at least 2 characters long
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const delayDebounceFn = setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=5`, {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "TravelPlannerApplet/1.0"
        }
      })
        .then((res) => {
          if (!res.ok) throw new Error("Network response was not ok");
          return res.json();
        })
        .then((data: any[]) => {
          const results = data.map((item) => {
            const addr = item.address;
            const city = addr.city || addr.town || addr.village || addr.municipality || addr.city_district || addr.county || item.name;
            const country = addr.country;
            const state = addr.state;
            
            if (city && country) {
              if (state && state !== city) {
                return `${city}, ${state}, ${country}`;
              }
              return `${city}, ${country}`;
            }
            return item.display_name;
          });
          
          // Filter duplicates
          const uniqueResults = Array.from(new Set(results)).slice(0, 5);
          setSearchResults(uniqueResults);
        })
        .catch((err) => {
          console.error("Nominatim search error:", err);
          // Fallback to local filtering of POPULAR_DESTINATIONS if API fails or rate limits
          const localFallback = POPULAR_DESTINATIONS.filter(dest => 
            dest.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setSearchResults(localFallback);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 400); // 400ms debounce to balance speed and rate limits

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Load/Error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Join group states
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Navigation tab state ("my-trips" vs "add-new")
  const [activeTab, setActiveTab] = useState<"my-trips" | "add-new">("my-trips");

  const [loadedTrips, setLoadedTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  const getDestinationImage = (destination?: string): string => {
    return getCleanImage(undefined, destination || "Travel");
  };

  // Sync trips from both localStorage history and Firestore (if logged in)
  useEffect(() => {
    let active = true;
    const fetchAllTrips = async () => {
      setLoadingTrips(true);
      const tempTripsMap: Record<string, Trip> = {};

      // 1. Fetch from localStorage first to guarantee instant offline fallback
      const recent: Array<{ id: string; name: string; shareCode: string }> = JSON.parse(
        localStorage.getItem("recent_trips") || "[]"
      );

      for (const t of recent) {
        try {
          const tripsCol = collection(db, "trips");
          const q = query(tripsCol, where("shareCode", "==", t.shareCode.toUpperCase()));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const tripData = snap.docs[0].data() as Trip;
            tempTripsMap[tripData.id] = tripData;
          } else {
            tempTripsMap[t.id] = {
              id: t.id,
              name: t.name,
              shareCode: t.shareCode,
            } as any;
          }
        } catch (e) {
          tempTripsMap[t.id] = {
            id: t.id,
            name: t.name,
            shareCode: t.shareCode,
          } as any;
        }
      }

      // 2. Query Firestore if signed in
      if (currentUser) {
        try {
          const q = query(collection(db, "trips"), where("ownerId", "==", currentUser.uid));
          const snap = await getDocs(q);
          snap.forEach((doc) => {
            const tripData = doc.data() as Trip;
            tempTripsMap[tripData.id] = tripData;
          });
        } catch (e) {
          console.error("Error fetching user owned trips:", e);
        }
      }

      if (active) {
        // Sort trips dynamically by creation or name
        const sorted = Object.values(tempTripsMap).sort((a, b) => {
          const timeA = a.updatedAt ? (typeof a.updatedAt.toMillis === "function" ? a.updatedAt.toMillis() : new Date(a.updatedAt).getTime()) : 0;
          const timeB = b.updatedAt ? (typeof b.updatedAt.toMillis === "function" ? b.updatedAt.toMillis() : new Date(b.updatedAt).getTime()) : 0;
          if (timeA && timeB) return timeB - timeA;
          return a.name.localeCompare(b.name);
        });
        setLoadedTrips(sorted);
        setLoadingTrips(false);
      }
    };

    fetchAllTrips();
    return () => {
      active = false;
    };
  }, [currentUser]);

  // GSAP animation refs
  const logoIconRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

  // Auto focus ref for location input inside modal
  const locationInputRef = useRef<HTMLInputElement>(null);

  // Format date range nicely: "Sun, Jun 28 - Mon, Jun 29"
  const formatDateRange = (startStr: string, endStr: string) => {
    if (!startStr) return "Select dates";
    const options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };
    const d1 = new Date(startStr + "T12:00:00");
    const d1Formatted = d1.toLocaleDateString("en-US", options);
    if (!endStr) return d1Formatted;
    const d2 = new Date(endStr + "T12:00:00");
    const d2Formatted = d2.toLocaleDateString("en-US", options);
    return `${d1Formatted} — ${d2Formatted}`;
  };

  const generateShareCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // GSAP animations for beautiful, professional entrance
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (logoIconRef.current) {
      tl.fromTo(logoIconRef.current, 
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.6 }
      );
    }
    if (formCardRef.current) {
      tl.fromTo(formCardRef.current, 
        { y: 20, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.6 }, 
        "-=0.3"
      );
    }
  }, []);

  // Autofocus the search bar when destination selection opens
  useEffect(() => {
    if (isLocationModalOpen) {
      setSearchQuery(destination);
      setTimeout(() => {
        if (locationInputRef.current) {
          locationInputRef.current.focus();
        }
      }, 150);
    }
  }, [isLocationModalOpen]);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) {
      setError("Please select or type a destination");
      return;
    }

    setLoading(true);
    setError(null);

    const tripName = `Trip to ${destination.split(",")[0]}`;

    try {
      const shareCode = generateShareCode();
      const tripId = Math.random().toString(36).substring(2, 15);

      const currentUserId = currentUser?.uid || "anonymous_owner";
      const currentUserName = currentUser?.displayName || "Trip Creator";

      const newTrip: Trip = {
        id: tripId,
        name: tripName,
        destination: destination,
        startDate: startDate,
        endDate: endDate,
        context: `${travelerCount} travelers.`,
        shareCode: shareCode,
        ownerId: currentUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, "trips", tripId), newTrip);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `trips/${tripId}`);
      }

      const collabCol = collection(db, "trips", tripId, "collaborators");
      try {
        await setDoc(doc(collabCol, currentUserId), {
          tripId,
          userId: currentUserId,
          displayName: currentUserName,
          email: currentUser?.email || "anonymous@traveler.com",
          role: "owner",
          joinedAt: new Date().toISOString(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `trips/${tripId}/collaborators/${currentUserId}`);
      }

      const recent = JSON.parse(localStorage.getItem("recent_trips") || "[]");
      if (!recent.some((t: any) => t.id === tripId)) {
        recent.push({ id: tripId, name: tripName, shareCode });
        localStorage.setItem("recent_trips", JSON.stringify(recent.slice(-5)));
      }

      onTripLoaded(newTrip, true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create trip. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setJoinError("Please enter a valid trip code");
      return;
    }

    setJoinLoading(true);
    setJoinError(null);

    try {
      const tripsCol = collection(db, "trips");
      const q = query(tripsCol, where("shareCode", "==", joinCode.trim().toUpperCase()));
      
      let snap;
      try {
        snap = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, "trips");
      }

      if (snap.empty) {
        setJoinError("Trip code not found. Please double-check.");
        setJoinLoading(false);
        return;
      }

      const tripDoc = snap.docs[0];
      const tripData = tripDoc.data() as Trip;

      if (currentUser) {
        const collabCol = collection(db, "trips", tripData.id, "collaborators");
        try {
          await setDoc(doc(collabCol, currentUser.uid), {
            tripId: tripData.id,
            userId: currentUser.uid,
            displayName: currentUser.displayName || "Collaborator",
            email: currentUser.email || "",
            role: "editor",
            joinedAt: new Date().toISOString(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `trips/${tripData.id}/collaborators/${currentUser.uid}`);
        }
      }

      const recent = JSON.parse(localStorage.getItem("recent_trips") || "[]");
      if (!recent.some((t: any) => t.id === tripData.id)) {
        recent.push({ id: tripData.id, name: tripData.name, shareCode: tripData.shareCode });
        localStorage.setItem("recent_trips", JSON.stringify(recent.slice(-5)));
      }

      onTripLoaded(tripData);
    } catch (err: any) {
      console.error(err);
      setJoinError(err.message || "Could not join trip.");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleRecentClick = (recent: { id: string; name: string; shareCode: string }) => {
    setJoinCode(recent.shareCode);
    setJoinError(null);
    setJoinLoading(true);
    
    getDocs(query(collection(db, "trips"), where("shareCode", "==", recent.shareCode.toUpperCase())))
      .then((snap) => {
        if (!snap.empty) {
          onTripLoaded(snap.docs[0].data() as Trip);
        } else {
          setJoinError("Cached trip no longer exists.");
        }
      })
      .catch((err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, "trips");
        } catch (wrappedErr: any) {
          setJoinError(wrappedErr.message);
        }
      })
      .finally(() => setJoinLoading(false));
  };

  const recentTrips: Array<{ id: string; name: string; shareCode: string }> = JSON.parse(
    localStorage.getItem("recent_trips") || "[]"
  );

  const filteredDestinations = searchQuery
    ? (searchResults.length > 0 || isSearching ? searchResults : POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(searchQuery.toLowerCase())))
    : POPULAR_DESTINATIONS;

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        width: "100%",
        minHeight: "calc(100vh - 64px)", 
        display: "flex", 
        flexDirection: "column", 
        bgcolor: "#F4F5F6", // Clean neutral off-white background
        pt: { xs: 2, sm: 4 },
        pb: 6,
        px: { xs: 2, sm: 3 },
      }}
    >
      <Box sx={{ width: "100%", maxWidth: activeTab === "my-trips" ? 960 : 520, mx: "auto", transition: "max-width 0.3s ease", mt: { xs: 1, sm: 2 } }}>
        
        {activeTab === "add-new" && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <IconButton 
              id="back-to-my-trips-btn"
              onClick={() => setActiveTab("my-trips")} 
              sx={{ 
                color: "#111215", 
                bgcolor: "#FFFFFF", 
                boxShadow: "0 2px 6px rgba(0,0,0,0.05)", 
                border: "1px solid #E3E4E6",
                "&:hover": { bgcolor: "#F4F5F6" } 
              }}
            >
              <ArrowLeft size={18} />
            </IconButton>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#111215", fontFamily: "var(--font-sans)" }}>
              Back to My Itineraries
            </Typography>
          </Box>
        )}

        {/* Core Card: Trip Configuration Board */}
        <Card 
          ref={formCardRef}
          sx={{ 
            borderRadius: "16px",
            border: "1px solid #EBEBEB",
            bgcolor: "#FFFFFF",
            boxShadow: "rgba(0, 0, 0, 0.03) 0px 4px 12px",
            overflow: "visible",
            mb: 3,
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            {activeTab === "my-trips" ? (
              /* --- MY TRIPS VIEW (HOME) --- */
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: "#111215", fontFamily: "var(--font-sans)" }}>
                    My Itineraries
                  </Typography>
                  <Chip
                    label={`${loadedTrips.length} ${loadedTrips.length === 1 ? "Trip" : "Trips"}`}
                    size="small"
                    sx={{ bgcolor: "rgba(255, 56, 92, 0.08)", color: "#FF385C", fontWeight: "bold" }}
                  />
                </Box>

                {loadingTrips ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                    <CircularProgress color="primary" size={32} />
                  </Box>
                ) : loadedTrips.length === 0 ? (
                  /* Elegant empty state */
                  <Box sx={{ py: 6, px: 2, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: "#FFF8F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#FF385C" }}>
                      <Compass size={32} />
                    </Box>
                    <Typography sx={{ fontWeight: 700, color: "#111215" }}>
                      No trips planned yet
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 320 }}>
                      Create a custom itinerary or enter a collaborator code to begin your joint adventure.
                    </Typography>
                  </Box>
                ) : (
                  /* Airbnb Photo-First Grid */
                  <Box 
                    sx={{ 
                      display: "grid", 
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, 
                      gap: 3 
                    }}
                  >
                    {loadedTrips.map((t) => {
                      const coverImg = getDestinationImage(t.destination);
                      const displayDates = t.startDate && t.endDate ? formatDateRange(t.startDate, t.endDate) : "Flexible dates";
                      return (
                        <Box
                          id={`my-trip-card-${t.id}`}
                          key={t.id}
                          onClick={() => onTripLoaded(t)}
                          sx={{
                            cursor: "pointer",
                            borderRadius: "14px",
                            overflow: "hidden",
                            bgcolor: "#FFFFFF",
                            border: "1px solid #E3E4E6",
                            transition: "all 0.2s ease-in-out",
                            "&:hover": {
                              transform: "translateY(-2px)",
                              boxShadow: "rgba(0, 0, 0, 0.02) 0 0 0 1px, rgba(0, 0, 0, 0.04) 0 2px 6px 0, rgba(0, 0, 0, 0.1) 0 4px 8px 0",
                              borderColor: "#FF385C",
                            },
                          }}
                        >
                          {/* Photo display */}
                          <Box sx={{ width: "100%", height: 160, overflow: "hidden", position: "relative" }}>
                            <Box
                              component="img"
                              src={coverImg}
                              alt={t.name}
                              sx={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                transition: "transform 0.3s ease",
                                "&:hover": {
                                  transform: "scale(1.05)",
                                },
                              }}
                              referrerPolicy="no-referrer"
                              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                e.currentTarget.src = `https://picsum.photos/seed/${t.id || 'travel'}/800/600`;
                              }}
                            />
                            {/* Role Badge */}
                            {currentUser && t.ownerId === currentUser.uid && (
                              <Box
                                sx={{
                                  position: "absolute",
                                  top: 12,
                                  left: 12,
                                  bgcolor: "#FF385C",
                                  color: "#FFFFFF",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  px: 1.2,
                                  py: 0.5,
                                  borderRadius: "9999px",
                                  boxShadow: "rgba(0,0,0,0.1) 0 2px 4px",
                                }}
                              >
                                Host
                              </Box>
                            )}
                            {/* Share code */}
                            <Box
                              sx={{
                                position: "absolute",
                                bottom: 12,
                                left: 12,
                                bgcolor: "rgba(255, 255, 255, 0.9)",
                                color: "#222222",
                                fontSize: "10px",
                                fontWeight: 800,
                                px: 1,
                                py: 0.4,
                                borderRadius: "6px",
                                border: "1px solid rgba(0,0,0,0.06)",
                              }}
                            >
                              Code: {t.shareCode}
                            </Box>
                          </Box>

                          {/* Info */}
                          <Box sx={{ p: 2 }}>
                            <Typography
                              sx={{
                                fontSize: "16px",
                                fontWeight: 700,
                                color: "#111215",
                                mb: 0.5,
                                textOverflow: "ellipsis",
                                overflow: "hidden",
                                whiteSpace: "nowrap"
                              }}
                            >
                              {t.name}
                            </Typography>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                              <Typography
                                sx={{
                                  fontSize: "13px",
                                  color: "#6A6A6A",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                }}
                              >
                                <MapPin size={12} style={{ color: "#FF385C" }} />
                                <span>{t.destination || "Flexible Location"}</span>
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: "13px",
                                  color: "#6A6A6A",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                }}
                              >
                                <Calendar size={12} style={{ color: "#FF385C" }} />
                                <span>{displayDates}</span>
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                )}

                <Divider sx={{ my: 1 }} />

                {/* Add/Join button at bottom */}
                <Button
                  id="add-join-new-trip-btn"
                  variant="contained"
                  onClick={() => setActiveTab("add-new")}
                  sx={{
                    py: 1.2,
                    borderRadius: "8px",
                    bgcolor: "#FF385C",
                    color: "#FFFFFF",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    textTransform: "none",
                    boxShadow: "none",
                    "&:hover": {
                      bgcolor: "#E00B41",
                      boxShadow: "none",
                    },
                  }}
                >
                  Add/Join a new trip
                </Button>
              </Box>
            ) : (
              /* --- COMBINED ADD NEW / JOIN TRIP VIEW --- */
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                
                {/* 1. Create a New Trip Form Block */}
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, color: "#222222", fontFamily: "var(--font-sans)" }}>
                      Create a New Trip
                    </Typography>
                  </Box>

                  <Box component="form" onSubmit={handleCreateTrip} sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
                    {/* 1. Destination Field */}
                    <Box 
                      onClick={() => setIsLocationModalOpen(true)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: "12px",
                        border: "1px solid #EBEBEB",
                        bgcolor: "#FFFFFF",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        "&:hover": {
                          borderColor: "#FF385C",
                          bgcolor: "rgba(255, 56, 92, 0.02)",
                        }
                      }}
                    >
                      <Box sx={{ p: 0.75, borderRadius: "8px", bgcolor: "rgba(255, 56, 92, 0.08)", color: "#FF385C", display: "flex", shrink: 0 }}>
                        <MapPin size={16} />
                      </Box>
                      <Box sx={{ flexGrow: 1, textAlign: "left" }}>
                        <Typography sx={{ color: "text.secondary", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Where to?
                        </Typography>
                        <Typography sx={{ color: "#111215", fontSize: "0.82rem", fontWeight: 700, mt: 0.1 }}>
                          {destination || "Search cities, parks, or regions"}
                        </Typography>
                      </Box>
                    </Box>

                    {/* 2. Unified Dates Field */}
                    <Box 
                      onClick={() => setIsDateModalOpen(true)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: "12px",
                        border: "1px solid #EBEBEB",
                        bgcolor: "#FFFFFF",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        "&:hover": {
                          borderColor: "#FF385C",
                          bgcolor: "rgba(255, 56, 92, 0.02)",
                        }
                      }}
                    >
                      <Box sx={{ p: 0.75, borderRadius: "8px", bgcolor: "rgba(255, 56, 92, 0.08)", color: "#FF385C", display: "flex", shrink: 0 }}>
                        <Calendar size={16} />
                      </Box>
                      <Box sx={{ flexGrow: 1, textAlign: "left" }}>
                        <Typography sx={{ color: "text.secondary", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Dates
                        </Typography>
                        <Typography sx={{ color: "#111215", fontSize: "0.82rem", fontWeight: 700, mt: 0.1 }}>
                          {formatDateRange(startDate, endDate)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* 3. Travelers Field */}
                    <Box 
                      onClick={() => setIsTravelerModalOpen(true)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: "12px",
                        border: "1px solid #EBEBEB",
                        bgcolor: "#FFFFFF",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        "&:hover": {
                          borderColor: "#FF385C",
                          bgcolor: "rgba(255, 56, 92, 0.02)",
                        }
                      }}
                    >
                      <Box sx={{ p: 0.75, borderRadius: "8px", bgcolor: "rgba(255, 56, 92, 0.08)", color: "#FF385C", display: "flex", shrink: 0 }}>
                        <User size={16} />
                      </Box>
                      <Box sx={{ flexGrow: 1, textAlign: "left" }}>
                        <Typography sx={{ color: "text.secondary", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Travelers
                        </Typography>
                        <Typography sx={{ color: "#111215", fontSize: "0.82rem", fontWeight: 700, mt: 0.1 }}>
                          {travelerCount} {travelerCount === 1 ? "traveler" : "travelers"}
                        </Typography>
                      </Box>
                    </Box>

                    {error && (
                      <Alert severity="error" sx={{ borderRadius: "12px" }}>
                        {error}
                      </Alert>
                    )}

                    {!currentUser && (
                      <Alert severity="info" id="auth-warning-alert" sx={{ borderRadius: "12px" }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                          Guest Preview
                        </Typography>
                        You can generate and view this itinerary, but you must log in to invite friends and sync schedules.
                      </Alert>
                    )}

                    {/* 5. Pill Search Button */}
                    <Button
                      id="create-trip-submit-btn"
                      variant="contained"
                      type="submit"
                      disabled={loading}
                      sx={{ 
                        mt: 1,
                        py: 1.2, 
                        borderRadius: "8px", 
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        bgcolor: "#FF385C",
                        color: "#FFFFFF",
                        textTransform: "none",
                        display: "flex", 
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1,
                        boxShadow: "none",
                        transition: "all 0.15s ease-in-out",
                        "&:hover": {
                          bgcolor: "#E00B41",
                          boxShadow: "none",
                        }
                      }}
                    >
                      {loading ? (
                        <>
                          <CircularProgress size={18} sx={{ color: "#FFFFFF" }} />
                          <span>Creating custom itinerary...</span>
                        </>
                      ) : (
                        <>
                          <span>Search & Map Trip</span>
                          <Search size={16} />
                        </>
                      )}
                    </Button>
                  </Box>
                </Box>

                <Divider sx={{ my: 1, borderStyle: "dashed" }} />

                {/* 2. Join an Existing Trip Block */}
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 2 }}>
                    <Box sx={{ p: 1, borderRadius: "10px", bgcolor: "rgba(255, 56, 92, 0.08)", color: "#FF385C", display: "flex", alignItems: "center" }}>
                      <Users size={18} />
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#111215", fontFamily: "var(--font-sans)" }}>
                      Join with Code
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" sx={{ color: "text.secondary", mb: 2, lineHeight: 1.5 }}>
                    Type the unique 6-character trip code below to join your friends, view schedules, and collaborate in real-time.
                  </Typography>

                  <Box component="form" onSubmit={handleJoinTrip} sx={{ display: "flex", gap: 1.5, flexDirection: { xs: "column", sm: "row" } }}>
                    <input
                      id="join-code-input"
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="e.g. TRP49X"
                      disabled={joinLoading}
                      style={{
                        flexGrow: 1,
                        padding: "10px 14px",
                        backgroundColor: "#F8F9FA",
                        color: "#111215",
                        border: "1px solid #EBEBEB",
                        borderRadius: "8px",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        outline: "none",
                        fontFamily: "var(--font-sans)",
                        textTransform: "uppercase"
                      }}
                    />
                    <Button
                      id="join-code-btn"
                      variant="contained"
                      type="submit"
                      disabled={joinLoading}
                      sx={{ 
                        borderRadius: "8px",
                        py: 1.2,
                        px: 2.5,
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        bgcolor: "#FF385C",
                        color: "#FFFFFF",
                        textTransform: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "none",
                        transition: "all 0.15s ease-in-out",
                        "&:hover": {
                          bgcolor: "#E00B41",
                          boxShadow: "none",
                        }
                      }}
                    >
                      {joinLoading ? (
                        <CircularProgress size={18} sx={{ color: "#FFFFFF" }} />
                      ) : (
                        "Join Itinerary"
                      )}
                    </Button>
                  </Box>
                  
                  {joinError && (
                    <Alert severity="error" sx={{ borderRadius: "12px", mt: 2 }}>
                      {joinError}
                    </Alert>
                  )}
                </Box>

              </Box>
            )}
          </CardContent>
        </Card>


      </Box>

      {/* =========================================================================
          1. DESTINATION MODAL: MOBILE-FIRST FULL-SCREEN SEARCH PANEL
          ========================================================================= */}
      <Dialog
        fullScreen
        open={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        sx={{
          "& .MuiDialog-paper": {
            bgcolor: "#FFFFFF",
          }
        }}
      >
        {/* Modal Header */}
        <Box sx={{ display: "flex", alignItems: "center", p: 2, borderBottom: "1px solid #E3E4E6" }}>
          <IconButton onClick={() => setIsLocationModalOpen(false)} sx={{ color: "#111215" }}>
            <ArrowLeft size={22} />
          </IconButton>
          <Typography variant="subtitle1" sx={{ ml: 2, fontWeight: 800, color: "#111215" }}>
            Select destination
          </Typography>
        </Box>

        {/* Modal Search Input Box */}
        <Box sx={{ p: 2 }}>
          <Box 
            sx={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 1.5, 
              p: "12px 16px", 
              border: "2px solid #FF385C", // Airbnb focused state
              borderRadius: "14px" 
            }}
          >
            <Search size={20} className="text-[#FF385C]" />
            <input
              ref={locationInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Where to?"
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "#111215",
                backgroundColor: "transparent"
              }}
            />
            {searchQuery && (
              <X 
                size={18} 
                className="text-gray-400 cursor-pointer hover:text-black" 
                onClick={() => setSearchQuery("")} 
              />
            )}
          </Box>
        </Box>

        {/* Modal Search Content Results */}
        <Box sx={{ flex: 1, overflowY: "auto", px: 2, pb: 4 }}>
          <Typography sx={{ px: 1, pb: 1, color: "text.secondary", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {searchQuery ? "Search Results" : "Popular Destinations"}
          </Typography>
          
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 1 }}>
            {isSearching && (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 2, gap: 1.5, mb: 1 }}>
                <CircularProgress size={18} sx={{ color: "#FF385C" }} />
                <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.85rem" }}>
                  Searching the world...
                </Typography>
              </Box>
            )}

            {filteredDestinations.map((dest) => (
              <Box
                key={dest}
                onClick={() => {
                  setDestination(dest);
                  setIsLocationModalOpen(false);
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  p: 2,
                  borderRadius: "12px",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                  "&:hover": {
                    bgcolor: "#F4F5F6"
                  }
                }}
              >
                <Box sx={{ p: 1, borderRadius: "10px", bgcolor: "#F4F5F6", color: "text.secondary" }}>
                  <MapPin size={18} className="stroke-[2.5]" />
                </Box>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 700, color: "#111215" }}>
                    {dest.split(",")[0]}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>
                    {dest.split(",").slice(1).join(",").trim()}
                  </Typography>
                </Box>
              </Box>
            ))}

            {filteredDestinations.length === 0 && searchQuery && (
              <Box 
                onClick={() => {
                  setDestination(searchQuery);
                  setIsLocationModalOpen(false);
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  p: 2,
                  borderRadius: "12px",
                  cursor: "pointer",
                  bgcolor: "rgba(255, 56, 92, 0.04)",
                  border: "1px dashed rgba(255, 56, 92, 0.2)",
                  mt: 1
                }}
              >
                <Box sx={{ p: 1, borderRadius: "10px", bgcolor: "#FF385C", color: "#FFFFFF" }}>
                  <Plus size={18} />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "#FF385C" }}>
                  Use "{searchQuery}" as custom destination
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Dialog>


      {/* =========================================================================
          2. DATES MODAL: MOBILE-FIRST COMPACT DATES SELECTOR SHEET
          ========================================================================= */}
      <Dialog
        fullWidth
        maxWidth="xs"
        open={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        sx={{
          "& .MuiDialog-paper": {
            borderRadius: "20px",
            p: { xs: 1, sm: 1.5 },
            bgcolor: "#FFFFFF",
            overflowX: "hidden",
            width: "calc(100% - 32px)",
            margin: { xs: 2, sm: "auto" }
          }
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#111215" }}>
            Select dates
          </Typography>
          <IconButton onClick={() => setIsDateModalOpen(false)} sx={{ color: "#111215" }}>
            <X size={20} />
          </IconButton>
        </Box>
        <Divider />

        <Box sx={{ p: { xs: 2, sm: 2.5 }, display: "flex", flexDirection: "column", gap: 3 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <Box>
              <Typography sx={{ color: "text.secondary", fontSize: "0.72rem", fontWeight: 800, mb: 1, textTransform: "uppercase" }}>
                DEPARTING
              </Typography>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#F4F5F6",
                  color: "#111215",
                  border: "1px solid #D1D5DB",
                  borderRadius: "10px",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </Box>
            <Box>
              <Typography sx={{ color: "text.secondary", fontSize: "0.72rem", fontWeight: 800, mb: 1, textTransform: "uppercase" }}>
                RETURNING
              </Typography>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#F4F5F6",
                  color: "#111215",
                  border: "1px solid #D1D5DB",
                  borderRadius: "10px",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </Box>
          </Box>

          <Button
            fullWidth
            variant="contained"
            onClick={() => setIsDateModalOpen(false)}
            sx={{ 
              borderRadius: "8px", 
              py: 1.2, 
              fontSize: "0.875rem", 
              fontWeight: 600, 
              textTransform: "none",
              bgcolor: "#FF385C",
              boxShadow: "none",
              "&:hover": {
                bgcolor: "#E00B41",
                boxShadow: "none",
              }
            }}
          >
            Confirm Dates
          </Button>
        </Box>
      </Dialog>


      {/* =========================================================================
          3. TRAVELERS MODAL: MOBILE-FIRST GUEST COUNTER SHEET
          ========================================================================= */}
      <Dialog
        fullWidth
        maxWidth="xs"
        open={isTravelerModalOpen}
        onClose={() => setIsTravelerModalOpen(false)}
        sx={{
          "& .MuiDialog-paper": {
            borderRadius: "20px",
            p: 1.5,
            bgcolor: "#FFFFFF"
          }
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#111215" }}>
            Select Travelers
          </Typography>
          <IconButton onClick={() => setIsTravelerModalOpen(false)} sx={{ color: "#111215" }}>
            <X size={20} />
          </IconButton>
        </Box>
        <Divider />

        <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography sx={{ color: "#111215", fontSize: "1rem", fontWeight: 800 }}>
                Travelers
              </Typography>
              <Typography sx={{ color: "text.secondary", fontSize: "0.78rem", mt: 0.2 }}>
                Number of people on this itinerary
              </Typography>
            </Box>
            
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <IconButton
                onClick={() => setTravelerCount(Math.max(1, travelerCount - 1))}
                disabled={travelerCount <= 1}
                sx={{
                  width: 40,
                  height: 40,
                  border: "1.5px solid #D1D5DB",
                  color: "#111215",
                  "&:disabled": { color: "#C4C4C4", borderColor: "#E3E4E6" }
                }}
              >
                <Minus size={16} />
              </IconButton>
              <Typography sx={{ color: "#111215", fontSize: "1.15rem", fontWeight: 850, minWidth: 24, textAlign: "center" }}>
                {travelerCount}
              </Typography>
              <IconButton
                onClick={() => setTravelerCount(travelerCount + 1)}
                sx={{
                  width: 40,
                  height: 40,
                  border: "1.5px solid #D1D5DB",
                  color: "#111215",
                }}
              >
                <Plus size={16} />
              </IconButton>
            </Box>
          </Box>

          <Button
            fullWidth
            variant="contained"
            onClick={() => setIsTravelerModalOpen(false)}
            sx={{ 
              borderRadius: "8px", 
              py: 1.2, 
              fontSize: "0.875rem", 
              fontWeight: 600, 
              textTransform: "none",
              bgcolor: "#FF385C",
              boxShadow: "none",
              "&:hover": {
                bgcolor: "#E00B41",
                boxShadow: "none",
              }
            }}
          >
            Apply Travelers
          </Button>
        </Box>
      </Dialog>

    </Box>
  );
}
