/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import {
  Box,
  Typography,
  Button,
  IconButton,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Avatar,
  Tooltip,
  Alert,
  CircularProgress,
  Dialog,
  Divider,
  AppBar,
  Toolbar,
} from "@mui/material";
import {
  Calendar,
  MapPin,
  Sparkles,
  User,
  Plus,
  Search,
  Copy,
  Check,
  LogOut,
  LogIn,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Trash2,
  LayoutGrid,
  LayoutList,
  Compass,
  Clock,
  Clock3,
  Heart,
  Settings,
  Users,
  Share2,
} from "lucide-react";

// Firebase
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  getDocs,
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";

// Custom components
import AuthModal from "./components/AuthModal";
import TripCreator from "./components/TripCreator";
import ActivityDetailSheet from "./components/ActivityDetailSheet";
import AddActivityDialog from "./components/AddActivityDialog";
import AddToItineraryDialog from "./components/AddToItineraryDialog";
import ProfileDialog from "./components/ProfileDialog";
import ProfileTab from "./components/ProfileTab";
import ManageTripTab from "./components/ManageTripTab";
import { EditTripDialog } from "./components/EditTripDialog";
import ShareTripDialog from "./components/ShareTripDialog";
import SparksSelector from "./components/SparksSelector";

// Theme and helpers
import theme from "./lib/theme";
import { Trip, Activity, ItineraryPlacement, Collaborator } from "./types";
import { CATEGORY_COLORS, getCategoryImage } from "./lib/images";

export default function App() {
  // Navigation & Screen States
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Firestore Collections State
  const [activities, setActivities] = useState<Activity[]>([]);
  const [placements, setPlacements] = useState<ItineraryPlacement[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  // Local/UI configuration states
  const [currentTab, setCurrentTab] = useState<"itinerary" | "activities" | "profile" | "my-trips">("my-trips");
  const [selectedDay, setSelectedDay] = useState<string>("Day 1");
  const [viewMode, setViewMode] = useState<"gallery" | "list">("gallery");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");

  // Bottom Sheets / Dialogs Control
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [addToItineraryOpen, setAddToItineraryOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editTripDialogOpen, setEditTripDialogOpen] = useState(false);
  const [shareTripDialogOpen, setShareTripDialogOpen] = useState(false);

  // Target object state for scheduling and detail views
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // General Notification / Feedback
  const [copied, setCopied] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // --- 1. Monitor Authentication State ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // --- 2. Check and Load Trip from URL Hash or Cache ---
  useEffect(() => {
    let unsubTrip: (() => void) | null = null;
    const checkHash = async () => {
      if (unsubTrip) {
        unsubTrip();
        unsubTrip = null;
      }
      const hash = window.location.hash;
      if (hash.startsWith("#trip=")) {
        const tripId = hash.replace("#trip=", "");
        if (tripId) {
          setLoadingTrip(true);
          try {
            // Subscribe to trip document real-time changes
            unsubTrip = onSnapshot(doc(db, "trips", tripId), (docSnap) => {
              if (docSnap.exists()) {
                setTrip({ id: docSnap.id, ...docSnap.data() } as Trip);
              } else {
                window.location.hash = "";
                setTrip(null);
              }
              setLoadingTrip(false);
            }, (error) => {
              setLoadingTrip(false);
              handleFirestoreError(error, OperationType.GET, `trips/${tripId}`);
            });
          } catch (err) {
            console.error("Error fetching hash trip:", err);
            setLoadingTrip(false);
          }
        }
      }
    };

    checkHash();
    // Watch for hash change events
    window.addEventListener("hashchange", checkHash);
    return () => {
      window.removeEventListener("hashchange", checkHash);
      if (unsubTrip) {
        unsubTrip();
      }
    };
  }, []);

  // --- 3. Subscribe to Firestore Collections Once Trip is Loaded ---
  useEffect(() => {
    if (!trip) {
      setActivities([]);
      setPlacements([]);
      setCollaborators([]);
      return;
    }

    // A. Sub to Activities subcollection
    const unsubActivities = onSnapshot(
      collection(db, "trips", trip.id, "activities"),
      (snap) => {
        const loaded: Activity[] = [];
        snap.forEach((docSnap) => {
          const act = docSnap.data() as Activity;
          if (act.status !== "archived") {
            loaded.push({ ...act, id: docSnap.id });
          }
        });
        setActivities(loaded);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `trips/${trip.id}/activities`);
      }
    );

    // B. Sub to ItineraryPlacements subcollection
    const unsubPlacements = onSnapshot(
      collection(db, "trips", trip.id, "itineraryPlacements"),
      (snap) => {
        const loaded: ItineraryPlacement[] = [];
        snap.forEach((docSnap) => {
          loaded.push({ ...docSnap.data(), id: docSnap.id } as ItineraryPlacement);
        });
        setPlacements(loaded);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `trips/${trip.id}/itineraryPlacements`);
      }
    );

    // C. Sub to Collaborators subcollection
    const unsubCollabs = onSnapshot(
      collection(db, "trips", trip.id, "collaborators"),
      (snap) => {
        const loaded: Collaborator[] = [];
        snap.forEach((docSnap) => {
          loaded.push(docSnap.data() as Collaborator);
        });
        setCollaborators(loaded);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `trips/${trip.id}/collaborators`);
      }
    );

    // Register active user as a collaborator in trip once logged in
    if (currentUser) {
      const collabDoc = doc(db, "trips", trip.id, "collaborators", currentUser.uid);
      setDoc(collabDoc, {
        tripId: trip.id,
        userId: currentUser.uid,
        displayName: currentUser.displayName || "Collaborator",
        email: currentUser.email || "",
        role: trip.ownerId === currentUser.uid ? "owner" : "editor",
        joinedAt: new Date().toISOString(),
        photoURL: currentUser.photoURL || "",
      }, { merge: true }).catch((error) => {
        handleFirestoreError(error, OperationType.WRITE, `trips/${trip.id}/collaborators/${currentUser.uid}`);
      });
    }

    return () => {
      unsubActivities();
      unsubPlacements();
      unsubCollabs();
    };
  }, [trip, currentUser]);

  // --- 4. Define Day List Dynamically ---
  const calculatedDaysCount = useMemo(() => {
    if (!trip?.startDate) return 3; // default if no start date set
    const startParts = trip.startDate.split("-").map(Number);
    if (startParts.length !== 3 || startParts.some(isNaN)) return 3;
    const startUTC = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);

    if (!trip.endDate) return 1;
    const endParts = trip.endDate.split("-").map(Number);
    if (endParts.length !== 3 || endParts.some(isNaN)) return 1;
    const endUTC = Date.UTC(endParts[0], endParts[1] - 1, endParts[2]);

    const diffTime = endUTC - startUTC;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  }, [trip?.startDate, trip?.endDate]);

  const daysList = useMemo(() => {
    return Array.from({ length: calculatedDaysCount }, (_, i) => `Day ${i + 1}`);
  }, [calculatedDaysCount]);

  // Set default selected day if current choice is not in list
  useEffect(() => {
    if (daysList.length > 0 && !daysList.includes(selectedDay)) {
      setSelectedDay(daysList[0]);
    }
  }, [daysList]);

  // Synchronize active navigation tab when a trip is loaded or unloaded
  useEffect(() => {
    if (trip) {
      setCurrentTab((prev) => (prev === "my-trips" || prev === "profile" ? "itinerary" : prev));
    } else {
      setCurrentTab((prev) => (prev === "itinerary" || prev === "activities" ? "my-trips" : prev));
    }
  }, [trip]);

  // --- 5. Handlers ---
  const handleTripLoaded = (loadedTrip: Trip, isNewTrip?: boolean) => {
    window.location.hash = `trip=${loadedTrip.id}`;
    setTrip(loadedTrip);
    if (isNewTrip) {
      setCurrentTab("activities");
    }
  };

  const handleCopyCode = () => {
    if (!trip) return;
    navigator.clipboard.writeText(trip.shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    if (!trip) return;
    const link = `${window.location.origin}/#trip=${trip.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleUpdateTripDetails = async (updatedFields: Partial<Trip>) => {
    if (!trip) return;
    const tripDoc = doc(db, "trips", trip.id);
    try {
      await updateDoc(tripDoc, {
        ...updatedFields,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trips/${trip.id}`);
      throw error;
    }
  };

  const STANDARD_CATEGORIES = ["Food", "Sightseeing", "Transit", "Shopping", "Event", "Work", "Rest"];

  const handleAddManualActivity = async (data: Partial<Activity>) => {
    if (!trip) return;
    const actId = Math.random().toString(36).substring(2, 15);

    // Save custom category to Trip if needed
    if (data.category && !STANDARD_CATEGORIES.includes(data.category)) {
      const currentCustomCats = trip.customCategories || [];
      if (!currentCustomCats.includes(data.category)) {
        const tripDoc = doc(db, "trips", trip.id);
        try {
          await updateDoc(tripDoc, {
            customCategories: [...currentCustomCats, data.category]
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `trips/${trip.id}`);
        }
      }
    }

    const newAct: Activity = {
      id: actId,
      tripId: trip.id,
      title: data.title!,
      category: data.category!,
      imageURL: data.imageURL!,
      location: data.location || "",
      notes: data.notes || "",
      estimatedDuration: data.estimatedDuration || "",
      startTime: data.startTime || "",
      source: "Manual",
      createdBy: currentUser?.displayName || "Collaborator",
      createdByUserId: currentUser?.uid,
      createdByPhotoURL: currentUser?.photoURL || undefined,
      createdAt: new Date().toISOString(),
      status: "active",
    };

    try {
      await setDoc(doc(db, "trips", trip.id, "activities", actId), newAct);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `trips/${trip.id}/activities/${actId}`);
    }
  };

  const handleUpdateActivity = async (activityId: string, updatedFields: Partial<Activity>) => {
    if (!trip) return;

    // Save custom category to Trip if needed
    if (updatedFields.category && !STANDARD_CATEGORIES.includes(updatedFields.category)) {
      const currentCustomCats = trip.customCategories || [];
      if (!currentCustomCats.includes(updatedFields.category)) {
        const tripDoc = doc(db, "trips", trip.id);
        try {
          await updateDoc(tripDoc, {
            customCategories: [...currentCustomCats, updatedFields.category]
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `trips/${trip.id}`);
        }
      }
    }

    const actDoc = doc(db, "trips", trip.id, "activities", activityId);
    try {
      await updateDoc(actDoc, updatedFields);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trips/${trip.id}/activities/${activityId}`);
    }
  };

  const handleUpdatePlacement = async (placementId: string, updatedFields: Partial<ItineraryPlacement>) => {
    if (!trip) return;
    const placementDoc = doc(db, "trips", trip.id, "itineraryPlacements", placementId);
    try {
      await updateDoc(placementDoc, updatedFields);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trips/${trip.id}/itineraryPlacements/${placementId}`);
    }
  };

  const handleScheduleActivity = async (day: string, startTime: string, endTime?: string) => {
    if (!trip || !selectedActivity) return;

    const placementId = Math.random().toString(36).substring(2, 15);
    
    // Find highest sortOrder for this day to place at bottom
    const dayPlacements = placements.filter((p) => p.day === day);
    const maxSortOrder = dayPlacements.reduce((max, p) => p.sortOrder > max ? p.sortOrder : max, 0);

    const newPlacement: ItineraryPlacement = {
      id: placementId,
      tripId: trip.id,
      activityId: selectedActivity.id,
      day: day,
      startTime: startTime,
      endTime: endTime || "",
      sortOrder: maxSortOrder + 1,
      addedBy: currentUser?.displayName || "Collaborator",
      addedByUserId: currentUser?.uid,
      addedByPhotoURL: currentUser?.photoURL || undefined,
      addedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, "trips", trip.id, "itineraryPlacements", placementId), newPlacement);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `trips/${trip.id}/itineraryPlacements/${placementId}`);
    }
    setAddToItineraryOpen(false);
    setSelectedActivity(null);
  };

  const handleUnscheduleActivity = async (placement: ItineraryPlacement) => {
    if (!trip) return;
    try {
      await deleteDoc(doc(db, "trips", trip.id, "itineraryPlacements", placement.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `trips/${trip.id}/itineraryPlacements/${placement.id}`);
    }
  };

  const handleArchiveActivity = async (activity: Activity) => {
    if (!trip) return;
    // Archive activity idea
    try {
      await updateDoc(doc(db, "trips", trip.id, "activities", activity.id), {
        status: "archived",
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trips/${trip.id}/activities/${activity.id}`);
    }

    // Clean up placements associated with this activity
    const relatedPlacements = placements.filter((p) => p.activityId === activity.id);
    for (const p of relatedPlacements) {
      try {
        await deleteDoc(doc(db, "trips", trip.id, "itineraryPlacements", p.id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `trips/${trip.id}/itineraryPlacements/${p.id}`);
      }
    }
  };

  const handleAddDay = async () => {
    if (!trip) return;
    const maxDayNum = daysList.reduce((max, dayStr) => {
      const num = parseInt(dayStr.replace(/\D/g, "")) || 0;
      return num > max ? num : max;
    }, 0);
    const newDayName = `Day ${maxDayNum + 1}`;
    setSelectedDay(newDayName);
  };

  const handleGetMoreIdeas = async () => {
    if (!trip) return;
    setAiGenerating(true);
    setAiError(null);

    try {
      // Collect existing titles to avoid generating duplicates
      const currentTitles = activities.map((a) => a.title);

      const response = await fetch("/api/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trip.name,
          destination: trip.destination,
          dates: `${trip.startDate || ""} - ${trip.endDate || ""}`,
          context: trip.context,
          existingIdeas: currentTitles,
        }),
      });

      if (!response.ok) {
        throw new Error("AI Search responded with an error");
      }

      const result = await response.json();
      const newIdeas = result.ideas || [];

      if (newIdeas.length === 0) {
        setAiError("AI generated duplicate or no new ideas. Please try again with details.");
        setAiGenerating(false);
        return;
      }

      for (const idea of newIdeas) {
        const activityId = Math.random().toString(36).substring(2, 15);
        const imageUrl = `https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80`; // custom
        const freshCatImage = getCategoryImage(idea.category, idea.title);

        const newActivity: Activity = {
          id: activityId,
          tripId: trip.id,
          title: idea.title,
          category: idea.category,
          imageURL: freshCatImage,
          location: idea.location || "",
          notes: idea.notes || "",
          estimatedDuration: idea.estimatedDuration || "",
          source: "AI Search",
          sourceDetail: "Fetched via 'Get More Ideas'",
          createdBy: "AI Search Engine",
          createdAt: new Date().toISOString(),
          status: "active",
        };

        try {
          await setDoc(doc(db, "trips", trip.id, "activities", activityId), newActivity);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `trips/${trip.id}/activities/${activityId}`);
        }
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Could not fetch new recommendations.");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleBuildSparksItinerary = async (selectedSparks: string[], anythingElse: string) => {
    if (!trip) return;
    setAiGenerating(true);
    setAiError(null);

    const context = `Sparks: ${selectedSparks.join(", ")}.${anythingElse ? ` Additional context: ${anythingElse}` : ""}`;

    try {
      // 1. Update trip context in Firestore and local state
      const tripDoc = doc(db, "trips", trip.id);
      await updateDoc(tripDoc, { context });
      setTrip((prev) => prev ? { ...prev, context } : null);

      // 2. Call generate-ideas API with the newly chosen context
      const response = await fetch("/api/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trip.name,
          destination: trip.destination,
          dates: `${trip.startDate || ""} - ${trip.endDate || ""}`,
          context: context,
        }),
      });

      if (!response.ok) {
        throw new Error("AI Search responded with an error");
      }

      const result = await response.json();
      const newIdeas = result.ideas || [];

      if (newIdeas.length === 0) {
        setAiError("AI generated duplicate or no new ideas. Please try again with details.");
        setAiGenerating(false);
        return;
      }

      for (const idea of newIdeas) {
        const activityId = Math.random().toString(36).substring(2, 15);
        const freshCatImage = getCategoryImage(idea.category, idea.title);

        const newActivity: Activity = {
          id: activityId,
          tripId: trip.id,
          title: idea.title,
          category: idea.category,
          imageURL: freshCatImage,
          location: idea.location || trip.destination,
          notes: idea.notes || "",
          estimatedDuration: idea.estimatedDuration || "",
          source: "AI Search",
          sourceDetail: "Generated from interests: " + selectedSparks.join(", "),
          createdBy: "AI Search Engine",
          createdAt: new Date().toISOString(),
          status: "active",
        };

        try {
          await setDoc(doc(db, "trips", trip.id, "activities", activityId), newActivity);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `trips/${trip.id}/activities/${activityId}`);
        }
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Could not build itinerary suggestions.");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleMoveOrder = async (placement: ItineraryPlacement, direction: "up" | "down") => {
    if (!trip) return;
    const dayPlacements = placements
      .filter((p) => p.day === placement.day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.sortOrder - b.sortOrder);

    const index = dayPlacements.findIndex((p) => p.id === placement.id);
    if (index === -1) return;

    if (direction === "up" && index > 0) {
      // Swap startTimes or sortOrders
      const prev = dayPlacements[index - 1];
      const tempTime = prev.startTime;
      try {
        await updateDoc(doc(db, "trips", trip.id, "itineraryPlacements", placement.id), {
          startTime: tempTime,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `trips/${trip.id}/itineraryPlacements/${placement.id}`);
      }
      try {
        await updateDoc(doc(db, "trips", trip.id, "itineraryPlacements", prev.id), {
          startTime: placement.startTime,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `trips/${trip.id}/itineraryPlacements/${prev.id}`);
      }
    } else if (direction === "down" && index < dayPlacements.length - 1) {
      const next = dayPlacements[index + 1];
      const tempTime = next.startTime;
      try {
        await updateDoc(doc(db, "trips", trip.id, "itineraryPlacements", placement.id), {
          startTime: tempTime,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `trips/${trip.id}/itineraryPlacements/${placement.id}`);
      }
      try {
        await updateDoc(doc(db, "trips", trip.id, "itineraryPlacements", next.id), {
          startTime: placement.startTime,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `trips/${trip.id}/itineraryPlacements/${next.id}`);
      }
    }
  };

  // --- 6. Computed Selectors ---
  const currentDayPlacements = useMemo(() => {
    return placements
      .filter((p) => p.day === selectedDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.sortOrder - b.sortOrder);
  }, [placements, selectedDay]);

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      const matchSearch = act.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (act.location || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = categoryFilter === "All" || act.category === categoryFilter;
      const matchSource = sourceFilter === "All" || 
        (sourceFilter === "AI" && act.source === "AI Search") ||
        (sourceFilter === "Manual" && act.source === "Manual");

      return matchSearch && matchCategory && matchSource;
    });
  }, [activities, searchQuery, categoryFilter, sourceFilter]);

  // Activity to Placement mapping for details lookups
  const activityPlacementsMap = useMemo(() => {
    const map: Record<string, ItineraryPlacement> = {};
    placements.forEach((p) => {
      map[p.activityId] = p;
    });
    return map;
  }, [placements]);

  if (loadingTrip) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
          <CircularProgress color="primary" />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Loading your travel itinerary...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  // Render Trip Creator if no trip loaded
  if (!trip) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: "100vh", bgcolor: "background.default", pb: { xs: 12, sm: 14 } }}>
          {/* Main Landing Top bar */}
          <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: "1px solid rgba(0,0,0,0.06)", bgcolor: "#FFFFFF" }}>
            <Toolbar sx={{ justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Compass className="text-[#FF385C]" size={24} />
                <Typography variant="h6" color="primary" sx={{ fontWeight: "bold" }}>Viharix</Typography>
              </Box>
            </Toolbar>
          </AppBar>

          {currentTab === "profile" ? (
            <ProfileTab
              currentUser={currentUser}
              onProfileUpdated={(displayName, photoURL) => {
                if (currentUser) {
                  setCurrentUser({
                    ...currentUser,
                    displayName,
                    photoURL
                  });
                }
              }}
              onShowAuth={() => setAuthModalOpen(true)}
              onSignOut={handleSignOut}
            />
          ) : (
            <TripCreator onTripLoaded={handleTripLoaded} onShowAuth={() => setAuthModalOpen(true)} currentUser={currentUser} />
          )}

          {/* Floating Pill Bottom Navigation Bar */}
          <Paper
            sx={{
              position: "fixed",
              bottom: { xs: 16, sm: 24 },
              left: "50%",
              transform: "translateX(-50%)",
              width: "calc(100% - 32px)",
              maxWidth: 480,
              borderRadius: "28px",
              overflow: "hidden",
              boxShadow: "rgba(0, 0, 0, 0.08) 0px 8px 24px, rgba(0, 0, 0, 0.04) 0px 4px 8px",
              border: "1px solid rgba(0, 0, 0, 0.06)",
              zIndex: 1100,
              bgcolor: "#FFFFFF"
            }}
            elevation={0}
          >
            <BottomNavigation
              value={currentTab === "profile" ? "profile" : "my-trips"}
              onChange={(_event, newValue) => {
                setCurrentTab(newValue as any);
              }}
              showLabels
            >
              <BottomNavigationAction
                id="nav-my-trips-btn"
                label="My Trips"
                value="my-trips"
                icon={<Compass size={20} />}
              />
              <BottomNavigationAction
                id="nav-profile-btn"
                label="Profile"
                value="profile"
                icon={<User size={20} />}
              />
            </BottomNavigation>
          </Paper>
          
          <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
        </Box>
      </ThemeProvider>
    );
  }

  // Workspace layout (Split for desktop, tabbed for mobile)
  const isReadOnly = !currentUser;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", pb: { xs: 12, sm: 14 }, display: "flex", flexDirection: "column", overflowX: "hidden" }}>
        
        {/* Sticky Header */}
        <Box sx={{ bgcolor: "#FFFFFF", borderBottom: "1px solid rgba(0,0,0,0.06)", position: "sticky", top: 0, zIndex: 1100 }}>
          <Box sx={{ px: { xs: 2, md: 3 }, py: 1.5, maxWidth: 1200, mx: "auto" }}>
            
            {/* Top row: Navigation & Actions */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
              {/* Back button & Breadcrumb Trip Name */}
              <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.8, sm: 1.5 }, minWidth: 0, flexShrink: 1 }}>
                <Button
                  id="header-back-btn"
                  size="small"
                  color="inherit"
                  startIcon={<ArrowLeft size={16} />}
                  onClick={() => {
                    window.location.hash = "";
                    setTrip(null);
                  }}
                  sx={{ 
                    p: "6px 12px", 
                    borderRadius: "20px", 
                    bgcolor: "#f7f7f7", 
                    color: "#222222",
                    fontSize: "0.85rem", 
                    fontWeight: 600,
                    flexShrink: 0,
                    "&:hover": { bgcolor: "#ebebeb" }
                  }}
                >
                  Home
                </Button>
                <Typography sx={{ fontSize: "0.82rem", color: "#6A6A6A", fontWeight: 500, flexShrink: 0 }}>
                  /
                </Typography>
                <Typography sx={{ 
                  fontSize: "0.85rem", 
                  color: "#222222", 
                  fontWeight: 700, 
                  fontFamily: "var(--font-sans)",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  maxWidth: { xs: "120px", sm: "240px", md: "400px" }
                }}>
                  {trip.name}
                </Typography>
              </Box>

              {/* Toolbar Actions */}
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                {/* Share action */}
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  <Button
                    id="share-code-btn"
                    variant="outlined"
                    size="small"
                    onClick={() => setShareTripDialogOpen(true)}
                    sx={{ 
                      display: { xs: "none", sm: "inline-flex" },
                      borderRadius: "20px",
                      borderColor: "#dddddd",
                      color: "#222222",
                      fontWeight: 600,
                      "&:hover": { borderColor: "#222222", bgcolor: "#f7f7f7" }
                    }}
                    endIcon={<Users size={14} />}
                  >
                    Code: {trip.shareCode}
                  </Button>
                  <Button
                    id="share-link-btn"
                    variant="contained"
                    size="small"
                    onClick={() => setShareTripDialogOpen(true)}
                    sx={{ 
                      borderRadius: "20px",
                      bgcolor: "#FF385C",
                      color: "#FFFFFF",
                      fontWeight: 600,
                      "&:hover": { bgcolor: "#E00B41" }
                    }}
                    endIcon={<Share2 size={14} />}
                  >
                    Share
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* --- MAIN LAYOUT WINDOW --- */}
        <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto", width: "100%" }}>
          {isReadOnly && (
            <Alert severity="info" id="view-only-alert" sx={{ mb: 2.5 }}>
              You are currently viewing this trip as a Guest. <strong>Sign In</strong> using the button in the header to schedule, reorder activities, or add manual ideas!
            </Alert>
          )}

          {currentTab === "profile" ? (
            <ManageTripTab
              trip={trip}
              collaborators={collaborators}
              currentUser={currentUser}
              onCopyCode={() => setShareTripDialogOpen(true)}
              copied={copied}
              onEditTrip={() => setEditTripDialogOpen(true)}
            />
          ) : (
            <>
              {/* 1. Desktop Side-by-Side View */}
              <Box sx={{ display: { xs: "none", md: "flex" }, gap: 4 }}>
            {/* Desktop Left: Itinerary Panel */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h6" sx={{ color: "#222222", fontWeight: 700 }}>Trip Itinerary</Typography>
              </Box>

              {/* Horizontal Day Navigation */}
              <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 1.5, mb: 3 }}>
                {daysList.map((d) => (
                  <Button
                    id={`day-tab-desktop-${d}`}
                    key={d}
                    variant={selectedDay === d ? "contained" : "outlined"}
                    color={selectedDay === d ? "primary" : "inherit"}
                    onClick={() => setSelectedDay(d)}
                    sx={{
                      minWidth: 100,
                      borderRadius: 3,
                      flexShrink: 0,
                      borderColor: selectedDay === d ? "primary.main" : "rgba(0,0,0,0.12)",
                    }}
                  >
                    {d}
                  </Button>
                ))}
              </Box>

              {/* Timeline list */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {currentDayPlacements.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: "center", border: "1px dashed rgba(0,0,0,0.12)", bgcolor: "transparent" }}>
                    <Typography variant="body2" color="text.secondary">
                      No activities scheduled for this day yet.
                    </Typography>
                    {!isReadOnly && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        Drag/Schedule an activity from the Idea Pool on the right!
                      </Typography>
                    )}
                  </Paper>
                ) : (
                  currentDayPlacements.map((p, index) => {
                    const act = activities.find((a) => a.id === p.activityId);
                    if (!act) return null;
                    const colors = CATEGORY_COLORS[act.category] || CATEGORY_COLORS.Custom;

                    return (
                      <Card
                        id={`itinerary-card-${p.id}`}
                        key={p.id}
                        sx={{
                          display: "flex",
                          position: "relative",
                          "&:hover": { borderColor: "primary.main" },
                        }}
                      >
                        {/* Start time Left column */}
                        <Box sx={{ width: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", bgcolor: "#F7F7F7", borderRight: "1px solid #EBEBEB", px: 1 }}>
                          <Typography variant="subtitle1" sx={{ color: "#FF385C", fontWeight: 700 }}>{p.startTime}</Typography>
                          {p.endTime && <Typography variant="caption" color="text.secondary">{p.endTime}</Typography>}
                        </Box>

                        <CardMedia
                          component="img"
                          sx={{ width: 100, display: { xs: "none", sm: "block" } }}
                          image={act.imageURL}
                          alt={act.title}
                          {...({ 
                            referrerPolicy: "no-referrer",
                            onError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                              e.currentTarget.src = `https://picsum.photos/seed/${act.id || 'activity'}/300/200`;
                            }
                          } as any)}
                        />

                        <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, p: 2 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                            <Box>
                              <Chip label={act.category} size="small" sx={{ bgcolor: colors.bg, color: colors.text, fontWeight: "bold", mb: 0.5, fontSize: "0.7rem" }} />
                              <Typography
                                variant="subtitle1"
                                onClick={() => {
                                  setSelectedActivity(act);
                                  setDetailSheetOpen(true);
                                }}
                                sx={{ fontWeight: "bold", cursor: "pointer", "&:hover": { color: "primary.main", textDecoration: "underline" } }}
                              >
                                {act.title}
                              </Typography>
                            </Box>

                            {/* Reordering Controls */}
                            {!isReadOnly && (
                              <Box sx={{ display: "flex", gap: 0.5 }}>
                                <IconButton
                                  id={`move-up-btn-${p.id}`}
                                  size="small"
                                  onClick={() => handleMoveOrder(p, "up")}
                                  disabled={index === 0}
                                >
                                  <ArrowUp size={16} />
                                </IconButton>
                                <IconButton
                                  id={`move-down-btn-${p.id}`}
                                  size="small"
                                  onClick={() => handleMoveOrder(p, "down")}
                                  disabled={index === currentDayPlacements.length - 1}
                                >
                                  <ArrowDown size={16} />
                                </IconButton>
                                <IconButton
                                  id={`unschedule-btn-${p.id}`}
                                  size="small"
                                  color="error"
                                  onClick={() => handleUnscheduleActivity(p)}
                                >
                                  <Trash2 size={16} />
                                </IconButton>
                              </Box>
                            )}
                          </Box>

                          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 0.5 }}>
                            {act.location && (
                              <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <MapPin size={12} style={{ color: "#6A6A6A" }} />
                                <span>{act.location}</span>
                              </Typography>
                            )}
                            {act.estimatedDuration && (
                              <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <Clock size={12} style={{ color: "#6A6A6A" }} />
                                <span>{act.estimatedDuration}</span>
                              </Typography>
                            )}
                            {act.startTime && (
                              <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <Clock3 size={12} style={{ color: "#6A6A6A" }} />
                                <span>Starts: {act.startTime}</span>
                              </Typography>
                            )}
                          </Box>

                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 1.5 }}>
                            {p.addedByPhotoURL ? (
                              <Avatar src={p.addedByPhotoURL} sx={{ width: 18, height: 18 }} />
                            ) : (
                              <Avatar sx={{ width: 18, height: 18, bgcolor: "primary.main", fontSize: "0.6rem", fontWeight: "bold" }}>
                                {p.addedBy ? p.addedBy[0].toUpperCase() : "C"}
                              </Avatar>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              Scheduled by {p.addedBy || "Collaborator"}
                            </Typography>
                          </Box>
                        </Box>
                      </Card>
                    );
                  })
                )}
              </Box>
            </Box>

            {/* Desktop Right: Activities/Ideas Pool Panel */}
            <Box sx={{ width: 450, flexShrink: 0 }}>
              {activities.length === 0 ? (
                <SparksSelector
                  trip={trip}
                  isGenerating={aiGenerating}
                  onBuild={handleBuildSparksItinerary}
                />
              ) : (
                <>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Typography variant="h6" color="primary" sx={{ fontWeight: "bold" }}>Activities Idea Pool</Typography>
                {!isReadOnly && (
                  <Button
                    id="add-activity-btn-desktop"
                    variant="contained"
                    size="small"
                    startIcon={<Plus size={16} />}
                    onClick={() => setAddActivityOpen(true)}
                    sx={{
                      bgcolor: "#008489",
                      color: "#FFFFFF",
                      fontWeight: 600,
                      borderRadius: "8px",
                      textTransform: "none",
                      px: 2,
                      py: 0.8,
                      boxShadow: "none",
                      "&:hover": {
                        bgcolor: "#006F73",
                        boxShadow: "none"
                      }
                    }}
                  >
                    Add Idea
                  </Button>
                )}
              </Box>

              {/* Filters & Search UI */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
                <TextField
                  id="search-input-desktop"
                  size="small"
                  placeholder="Search activity ideas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: <Search size={16} className="text-gray-400 mr-2" />,
                    },
                  }}
                  fullWidth
                />

                <Box sx={{ display: "flex", gap: 1 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id="category-filter-label-desktop">Category</InputLabel>
                    <Select
                      id="category-filter-select-desktop"
                      labelId="category-filter-label-desktop"
                      value={categoryFilter}
                      label="Category"
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <MenuItem value="All">All Categories</MenuItem>
                      <MenuItem value="Food">Food</MenuItem>
                      <MenuItem value="Sightseeing">Sightseeing</MenuItem>
                      <MenuItem value="Transit">Transit</MenuItem>
                      <MenuItem value="Shopping">Shopping</MenuItem>
                      <MenuItem value="Event">Event</MenuItem>
                      <MenuItem value="Work">Work</MenuItem>
                      <MenuItem value="Rest">Rest</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth>
                    <InputLabel id="source-filter-label-desktop">Source</InputLabel>
                    <Select
                      id="source-filter-select-desktop"
                      labelId="source-filter-label-desktop"
                      value={sourceFilter}
                      label="Source"
                      onChange={(e) => setSourceFilter(e.target.value)}
                    >
                      <MenuItem value="All">All Sources</MenuItem>
                      <MenuItem value="AI">AI Sourced</MenuItem>
                      <MenuItem value="Manual">Collaborator Added</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                {/* View Mode Toggle */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <IconButton
                      id="view-gallery-btn-desktop"
                      size="small"
                      color={viewMode === "gallery" ? "primary" : "default"}
                      onClick={() => setViewMode("gallery")}
                    >
                      <LayoutGrid size={18} />
                    </IconButton>
                    <IconButton
                      id="view-list-btn-desktop"
                      size="small"
                      color={viewMode === "list" ? "primary" : "default"}
                      onClick={() => setViewMode("list")}
                    >
                      <LayoutList size={18} />
                    </IconButton>
                  </Box>

                  {/* AI trigger */}
                  {!isReadOnly && (
                    <Button
                      id="get-ideas-btn-desktop"
                      variant="text"
                      color="primary"
                      size="small"
                      onClick={handleGetMoreIdeas}
                      disabled={aiGenerating}
                      startIcon={<Sparkles size={14} />}
                    >
                      {aiGenerating ? "Searching..." : "Get More AI Ideas"}
                    </Button>
                  )}
                </Box>

                {aiError && (
                  <Alert severity="error" sx={{ py: 0.5 }}>
                    {aiError}
                  </Alert>
                )}
              </Box>

              {/* Ideas Pool Render */}
              <Box sx={{ 
                display: viewMode === "gallery" ? "grid" : "flex", 
                gridTemplateColumns: viewMode === "gallery" ? "repeat(2, minmax(0, 1fr))" : undefined,
                flexDirection: viewMode === "gallery" ? undefined : "column",
                gap: 2, 
                maxHeight: "calc(100vh - 420px)", 
                overflowY: "auto", 
                pr: 0.5 
              }}>
                {filteredActivities.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                    No activity ideas found matching the filters.
                  </Typography>
                ) : (
                  filteredActivities.map((act) => {
                    const scheduled = activityPlacementsMap[act.id];
                    const colors = CATEGORY_COLORS[act.category] || CATEGORY_COLORS.Custom;

                    if (viewMode === "gallery") {
                      return (
                        <Box
                          id={`activity-gallery-card-${act.id}`}
                          key={act.id}
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            position: "relative",
                            width: "100%",
                            minWidth: 0,
                            mb: 0,
                          }}
                        >
                          <Box
                            sx={{
                              position: "relative",
                              width: "100%",
                              aspectRatio: "1/1",
                              borderRadius: "14px",
                              overflow: "hidden",
                              cursor: "pointer",
                              bgcolor: "#F7F7F7",
                              boxShadow: "rgba(0,0,0,0.02) 0px 0px 0px 1px inset",
                            }}
                            onClick={() => {
                              setSelectedActivity(act);
                              setDetailSheetOpen(true);
                            }}
                          >
                            <CardMedia
                              component="img"
                              image={act.imageURL}
                              alt={act.title}
                              sx={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                transition: "transform 0.3s ease-in-out",
                                "&:hover": { transform: "scale(1.05)" },
                              }}
                              {...({ 
                                referrerPolicy: "no-referrer",
                                onError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                  e.currentTarget.src = `https://picsum.photos/seed/${act.id || 'activity'}/300/200`;
                                }
                              } as any)}
                            />
                            {/* Floating top-left badge resembling Airbnb "Guest favorite" */}
                            <Box
                              sx={{
                                position: "absolute",
                                top: 12,
                                left: 12,
                                bgcolor: "#FFFFFF",
                                px: 1.5,
                                py: 0.6,
                                borderRadius: "9999px",
                                boxShadow: "rgba(0,0,0,0.1) 0px 4px 10px",
                                pointerEvents: "none",
                              }}
                            >
                              <Typography
                                sx={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  color: "#222222",
                                  lineHeight: 1,
                                  fontFamily: "var(--font-sans)",
                                }}
                              >
                                {act.source === "AI Search" ? "AI Search" : "Collaborator"}
                              </Typography>
                            </Box>

                            {/* Heart Wishlist icon at top-right */}
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedActivity(act);
                                setAddToItineraryOpen(true);
                              }}
                              sx={{
                                position: "absolute",
                                top: 12,
                                right: 12,
                                bgcolor: "rgba(255, 255, 255, 0.9)",
                                "&:hover": { bgcolor: "#FFFFFF", transform: "scale(1.05)" },
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                boxShadow: "rgba(0,0,0,0.08) 0px 2px 4px",
                                transition: "all 0.2s ease-in-out",
                              }}
                            >
                              <Heart
                                size={16}
                                fill={scheduled ? "#FF385C" : "none"}
                                color={scheduled ? "#FF385C" : "#222222"}
                                style={{ transition: "all 0.2s ease-in-out" }}
                              />
                            </IconButton>
                          </Box>

                          {/* Content Meta Block */}
                          <Box sx={{ mt: 1.2 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                              <Typography
                                onClick={() => {
                                  setSelectedActivity(act);
                                  setDetailSheetOpen(true);
                                }}
                                sx={{
                                  fontSize: "15px",
                                  fontWeight: 600,
                                  color: "#222222",
                                  cursor: "pointer",
                                  lineHeight: 1.3,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  maxWidth: "75%",
                                  fontFamily: "var(--font-sans)",
                                  "&:hover": { color: "#FF385C" },
                                }}
                              >
                                {act.title}
                              </Typography>
                              <Chip
                                label={act.category}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: "10px",
                                  fontWeight: "bold",
                                  bgcolor: colors.bg,
                                  color: colors.text,
                                  borderRadius: "4px",
                                }}
                              />
                            </Box>

                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2, mt: 0.5 }}>
                              {act.location && (
                                <Typography
                                  sx={{
                                    fontSize: "13px",
                                    color: "#6A6A6A",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    fontFamily: "var(--font-sans)",
                                  }}
                                >
                                  <MapPin size={12} style={{ color: "#6A6A6A" }} />
                                  <span>{act.location}</span>
                                </Typography>
                              )}
                              {(act.estimatedDuration || act.startTime) && (
                                <Typography
                                  sx={{
                                    fontSize: "13px",
                                    color: "#6A6A6A",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    fontFamily: "var(--font-sans)",
                                  }}
                                >
                                  <Clock size={12} style={{ color: "#6A6A6A" }} />
                                  <span>
                                    {act.estimatedDuration || "Flexible duration"}
                                    {act.startTime ? ` · starts at ${act.startTime}` : ""}
                                  </span>
                                </Typography>
                              )}
                            </Box>

                            {act.notes && (
                              <Typography
                                sx={{
                                  fontSize: "12px",
                                  color: "#6A6A6A",
                                  fontStyle: "italic",
                                  mt: 0.8,
                                  WebkitLineClamp: 2,
                                  display: "-webkit-box",
                                  overflow: "hidden",
                                  WebkitBoxOrient: "vertical",
                                  fontFamily: "var(--font-sans)",
                                  lineHeight: 1.4,
                                }}
                              >
                                "{act.notes.replace(/<[^>]*>/g, "")}"
                              </Typography>
                            )}

                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1.5 }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                                {act.createdByPhotoURL ? (
                                  <Avatar src={act.createdByPhotoURL} sx={{ width: 18, height: 18 }} />
                                ) : (
                                  <Avatar
                                    sx={{
                                      width: 18,
                                      height: 18,
                                      bgcolor: "#92174D",
                                      color: "#FFFFFF",
                                      fontSize: "9px",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    {act.createdBy ? act.createdBy[0].toUpperCase() : "C"}
                                  </Avatar>
                                )}
                                <Typography sx={{ fontSize: "12px", color: "#6A6A6A", fontFamily: "var(--font-sans)" }}>
                                  {act.createdBy || "Collaborator"}
                                </Typography>
                              </Box>

                              {!isReadOnly && (
                                <Button
                                  id={`add-to-itinerary-btn-desktop-${act.id}`}
                                  size="small"
                                  onClick={() => {
                                    setSelectedActivity(act);
                                    setAddToItineraryOpen(true);
                                  }}
                                  sx={{
                                    borderRadius: "20px",
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                    textTransform: "none",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    px: 2,
                                    py: 0.5,
                                    bgcolor: scheduled ? "#FFFFFF" : "#FF385C",
                                    color: scheduled ? "#222222" : "#FFFFFF",
                                    border: scheduled ? "1px solid #DDDDDD" : "none",
                                    boxShadow: "none",
                                    "&:hover": {
                                      bgcolor: scheduled ? "#F7F7F7" : "#E00B41",
                                      boxShadow: "none",
                                    },
                                    transition: "all 0.15s ease-in-out",
                                  }}
                                >
                                  {scheduled ? "Scheduled" : "+ Schedule"}
                                </Button>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      );
                    } else {
                      // List View
                      return (
                        <Paper
                          id={`activity-list-item-${act.id}`}
                          key={act.id}
                          sx={{
                            p: 1.5,
                            border: "1px solid rgba(0,0,0,0.06)",
                            borderRadius: 3,
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                          }}
                        >
                          <Avatar
                            src={act.imageURL}
                            variant="rounded"
                            sx={{ width: 50, height: 50 }}
                            {...({ referrerPolicy: "no-referrer" } as any)}
                          />
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography
                              variant="subtitle2"
                              noWrap
                              onClick={() => {
                                setSelectedActivity(act);
                                setDetailSheetOpen(true);
                              }}
                              sx={{ fontWeight: "bold", cursor: "pointer", "&:hover": { color: "primary.main", textDecoration: "underline" } }}
                            >
                              {act.title}
                            </Typography>
                             <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                              <Chip label={act.category} size="small" sx={{ height: 16, fontSize: "0.6rem", bgcolor: colors.bg, color: colors.text, fontWeight: "bold" }} />
                              <Chip label={act.source === "AI Search" ? "AI" : "Manual"} size="small" sx={{ height: 16, fontSize: "0.6rem" }} />
                              
                              {act.location && (
                                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, ml: 0.5, color: "text.secondary", fontSize: "0.7rem" }}>
                                  <MapPin size={10} style={{ color: "#6A6A6A" }} />
                                  <span>{act.location}</span>
                                </Box>
                              )}
                              {act.estimatedDuration && (
                                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, ml: 0.5, color: "text.secondary", fontSize: "0.7rem" }}>
                                  <Clock size={10} style={{ color: "#6A6A6A" }} />
                                  <span>{act.estimatedDuration}</span>
                                </Box>
                              )}
                              {act.startTime && (
                                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, ml: 0.5, color: "text.secondary", fontSize: "0.7rem" }}>
                                  <Clock3 size={10} style={{ color: "#6A6A6A" }} />
                                  <span>{act.startTime}</span>
                                </Box>
                              )}
                            </Box>
                          </Box>

                          {!isReadOnly && (
                            <Button
                              id={`add-to-itinerary-list-btn-desktop-${act.id}`}
                              size="small"
                              variant={scheduled ? "outlined" : "contained"}
                              color={scheduled ? "inherit" : "primary"}
                              onClick={() => {
                                setSelectedActivity(act);
                                setAddToItineraryOpen(true);
                              }}
                              sx={{ py: 0.5, px: 1, minWidth: 0, fontSize: "0.75rem" }}
                            >
                              {scheduled ? "Scheduled" : "+ Add"}
                            </Button>
                          )}
                        </Paper>
                      );
                    }
                  })
                )}
              </Box>
                </>
              )}
            </Box>
          </Box>

          {/* 2. Mobile Layout - Tabbed View */}
          <Box sx={{ display: { xs: "block", md: "none" } }}>
            {currentTab === "itinerary" ? (
              // --- Mobile Itinerary Tab ---
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                  <Typography variant="subtitle1" color="primary" sx={{ fontWeight: "bold" }}>Trip Itinerary</Typography>
                </Box>
                {/* Mobile Day Selector Bar */}
                <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 1.5, mb: 2 }}>
                  {daysList.map((d) => (
                    <Chip
                      id={`day-tab-mobile-${d}`}
                      key={d}
                      label={d}
                      clickable
                      color={selectedDay === d ? "primary" : "default"}
                      onClick={() => setSelectedDay(d)}
                      sx={{
                        px: 1,
                        fontSize: "0.85rem",
                        fontWeight: "bold",
                        bgcolor: selectedDay === d ? "primary.main" : "background.paper",
                        border: "1px solid rgba(0,0,0,0.06)",
                      }}
                    />
                  ))}
                  {/* Plus button removed: days are strictly based on trip date settings */}
                </Box>

                {/* Timeline */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {currentDayPlacements.length === 0 ? (
                    <Paper sx={{ p: 4, textAlign: "center", border: "1px dashed rgba(0,0,0,0.12)", bgcolor: "transparent" }}>
                      <Typography variant="body2" color="text.secondary">
                        No activities scheduled for this day yet.
                      </Typography>
                      {!isReadOnly && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                          Switch to the Activities tab below to add travel ideas to your master schedule!
                        </Typography>
                      )}
                    </Paper>
                  ) : (
                    currentDayPlacements.map((p, index) => {
                      const act = activities.find((a) => a.id === p.activityId);
                      if (!act) return null;
                      const colors = CATEGORY_COLORS[act.category] || CATEGORY_COLORS.Custom;

                      return (
                        <Card
                          id={`itinerary-card-mobile-${p.id}`}
                          key={p.id}
                          sx={{ display: "flex", position: "relative" }}
                        >
                          {/* Time */}
                          <Box sx={{ width: 70, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", bgcolor: "rgba(15, 118, 110, 0.02)", borderRight: "1px solid rgba(0,0,0,0.04)" }}>
                            <Typography variant="subtitle2" color="primary" sx={{ fontWeight: "bold" }}>{p.startTime}</Typography>
                          </Box>

                          <CardMedia
                            component="img"
                            sx={{ width: 80 }}
                            image={act.imageURL}
                            alt={act.title}
                            {...({ 
                              referrerPolicy: "no-referrer",
                              onError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                e.currentTarget.src = `https://picsum.photos/seed/${act.id || 'activity'}/300/200`;
                              }
                            } as any)}
                          />

                          <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, p: 1.5, minWidth: 0 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 0.5 }}>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography
                                  variant="subtitle2"
                                  noWrap
                                  onClick={() => {
                                    setSelectedActivity(act);
                                    setDetailSheetOpen(true);
                                  }}
                                  sx={{ fontWeight: "bold" }}
                                >
                                  {act.title}
                                </Typography>
                                <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mb: 0.5 }}>
                                  <Chip label={act.category} size="small" sx={{ height: 16, fontSize: "0.55rem", bgcolor: colors.bg, color: colors.text, fontWeight: "bold" }} />
                                  {act.estimatedDuration && (
                                    <Typography sx={{ fontSize: "0.6rem", display: "flex", alignItems: "center", gap: 0.2, color: "text.secondary" }}>
                                      <Clock size={10} />
                                      {act.estimatedDuration}
                                    </Typography>
                                  )}
                                </Box>
                                
                                {act.location && (
                                  <Typography sx={{ fontSize: "0.65rem", display: "flex", alignItems: "center", gap: 0.2, color: "text.secondary", mb: 0.5 }}>
                                    <MapPin size={10} />
                                    <span>{act.location}</span>
                                  </Typography>
                                )}

                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                                  {p.addedByPhotoURL ? (
                                    <Avatar src={p.addedByPhotoURL} sx={{ width: 14, height: 14 }} />
                                  ) : (
                                    <Avatar sx={{ width: 14, height: 14, bgcolor: "primary.main", fontSize: "0.5rem" }}>
                                      {p.addedBy ? p.addedBy[0].toUpperCase() : "C"}
                                    </Avatar>
                                  )}
                                  <Typography variant="caption" sx={{ fontSize: "0.6rem" }} color="text.secondary">
                                    By {p.addedBy || "Collaborator"}
                                  </Typography>
                                </Box>
                              </Box>

                              {!isReadOnly && (
                                <Box sx={{ display: "flex", gap: 0.5 }}>
                                  <IconButton
                                    id={`move-up-mobile-btn-${p.id}`}
                                    size="small"
                                    onClick={() => handleMoveOrder(p, "up")}
                                    disabled={index === 0}
                                    sx={{ p: 0.2 }}
                                  >
                                    <ArrowUp size={14} />
                                  </IconButton>
                                  <IconButton
                                    id={`move-down-mobile-btn-${p.id}`}
                                    size="small"
                                    onClick={() => handleMoveOrder(p, "down")}
                                    disabled={index === currentDayPlacements.length - 1}
                                    sx={{ p: 0.2 }}
                                  >
                                    <ArrowDown size={14} />
                                  </IconButton>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </Card>
                      );
                    })
                  )}
                </Box>
              </Box>
            ) : (
              // --- Mobile Activities Tab ---
              <Box>
                {activities.length === 0 ? (
                  <SparksSelector
                    trip={trip}
                    isGenerating={aiGenerating}
                    onBuild={handleBuildSparksItinerary}
                  />
                ) : (
                  <>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                      <Typography variant="subtitle1" color="primary" sx={{ fontWeight: "bold" }}>Travel Ideas Pool</Typography>
                  
                  {!isReadOnly && (
                    <Button
                      id="add-activity-btn-mobile"
                      variant="contained"
                      size="small"
                      startIcon={<Plus size={14} />}
                      onClick={() => setAddActivityOpen(true)}
                      sx={{
                        bgcolor: "#008489",
                        color: "#FFFFFF",
                        fontWeight: 600,
                        borderRadius: "8px",
                        textTransform: "none",
                        px: 1.5,
                        py: 0.6,
                        boxShadow: "none",
                        "&:hover": {
                          bgcolor: "#006F73",
                          boxShadow: "none"
                        }
                      }}
                    >
                      Add Idea
                    </Button>
                  )}
                </Box>

                {/* Filters Row */}
                <Box sx={{ display: "flex", gap: 1, mb: 2, overflowX: "auto", pb: 1 }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel id="category-filter-label-mobile">Category</InputLabel>
                    <Select
                      id="category-filter-select-mobile"
                      labelId="category-filter-label-mobile"
                      value={categoryFilter}
                      label="Category"
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <MenuItem value="All">All Categories</MenuItem>
                      <MenuItem value="Food">Food</MenuItem>
                      <MenuItem value="Sightseeing">Sightseeing</MenuItem>
                      <MenuItem value="Transit">Transit</MenuItem>
                      <MenuItem value="Shopping">Shopping</MenuItem>
                      <MenuItem value="Event">Event</MenuItem>
                      <MenuItem value="Work">Work</MenuItem>
                      <MenuItem value="Rest">Rest</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel id="source-filter-label-mobile">Source</InputLabel>
                    <Select
                      id="source-filter-select-mobile"
                      labelId="source-filter-label-mobile"
                      value={sourceFilter}
                      label="Source"
                      onChange={(e) => setSourceFilter(e.target.value)}
                    >
                      <MenuItem value="All">All Sources</MenuItem>
                      <MenuItem value="AI">AI Recommended</MenuItem>
                      <MenuItem value="Manual">Collaborator Added</MenuItem>
                    </Select>
                  </FormControl>

                  <IconButton
                    id="view-toggle-btn-mobile"
                    onClick={() => setViewMode(viewMode === "gallery" ? "list" : "gallery")}
                    sx={{ border: "1px solid rgba(0,0,0,0.1)", borderRadius: 2 }}
                  >
                    {viewMode === "gallery" ? <LayoutList size={18} /> : <LayoutGrid size={18} />}
                  </IconButton>
                </Box>

                <TextField
                  id="search-input-mobile"
                  size="small"
                  placeholder="Search activity ideas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: <Search size={16} className="text-gray-400 mr-2" />,
                    },
                  }}
                  fullWidth
                  sx={{ mb: 2 }}
                />

                {/* Get More AI button */}
                {!isReadOnly && (
                  <Button
                    id="get-ideas-btn-mobile"
                    variant="outlined"
                    color="primary"
                    fullWidth
                    onClick={handleGetMoreIdeas}
                    disabled={aiGenerating}
                    sx={{ mb: 2.5 }}
                    startIcon={<Sparkles size={14} />}
                  >
                    {aiGenerating ? "AI is fetching options..." : "Get More AI Recommendations"}
                  </Button>
                )}

                {aiError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {aiError}
                  </Alert>
                )}

                {/* Ideas list render */}
                <Box sx={{ 
                  display: viewMode === "gallery" ? "grid" : "flex", 
                  gridTemplateColumns: viewMode === "gallery" ? { xs: "repeat(1, minmax(0, 1fr))", sm: "repeat(2, minmax(0, 1fr))" } : undefined,
                  flexDirection: viewMode === "gallery" ? undefined : "column",
                  gap: 1.5,
                  width: "100%"
                }}>
                  {filteredActivities.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                      No activity ideas found matching the filters.
                    </Typography>
                  ) : (
                    filteredActivities.map((act) => {
                      const scheduled = activityPlacementsMap[act.id];
                      const colors = CATEGORY_COLORS[act.category] || CATEGORY_COLORS.Custom;

                      if (viewMode === "gallery") {
                        return (
                          <Box
                            id={`activity-gallery-card-mobile-${act.id}`}
                            key={act.id}
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              position: "relative",
                              width: "100%",
                              minWidth: 0,
                              mb: 0,
                            }}
                          >
                            <Box
                              sx={{
                                position: "relative",
                                width: "100%",
                                aspectRatio: "1/1",
                                borderRadius: "14px",
                                overflow: "hidden",
                                cursor: "pointer",
                                bgcolor: "#F7F7F7",
                                boxShadow: "rgba(0,0,0,0.02) 0px 0px 0px 1px inset",
                              }}
                              onClick={() => {
                                setSelectedActivity(act);
                                setDetailSheetOpen(true);
                              }}
                            >
                              <CardMedia
                                component="img"
                                image={act.imageURL}
                                alt={act.title}
                                sx={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                                {...({ 
                                  referrerPolicy: "no-referrer",
                                  onError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                    e.currentTarget.src = `https://picsum.photos/seed/${act.id || 'activity'}/300/200`;
                                  }
                                } as any)}
                              />
                              {/* Floating top-left badge resembling Airbnb "Guest favorite" */}
                              <Box
                                sx={{
                                  position: "absolute",
                                  top: 10,
                                  left: 10,
                                  bgcolor: "#FFFFFF",
                                  px: 1.2,
                                  py: 0.5,
                                  borderRadius: "9999px",
                                  boxShadow: "rgba(0,0,0,0.1) 0px 4px 8px",
                                  pointerEvents: "none",
                                }}
                              >
                                <Typography
                                  sx={{
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    color: "#222222",
                                    lineHeight: 1,
                                    fontFamily: "var(--font-sans)",
                                  }}
                                >
                                  {act.source === "AI Search" ? "AI Search" : "Collaborator"}
                                </Typography>
                              </Box>

                              {/* Heart Wishlist icon at top-right */}
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedActivity(act);
                                  setAddToItineraryOpen(true);
                                }}
                                sx={{
                                  position: "absolute",
                                  top: 10,
                                  right: 10,
                                  bgcolor: "rgba(255, 255, 255, 0.9)",
                                  width: 30,
                                  height: 30,
                                  borderRadius: "50%",
                                  boxShadow: "rgba(0,0,0,0.08) 0px 2px 4px",
                                }}
                              >
                                <Heart
                                  size={14}
                                  fill={scheduled ? "#FF385C" : "none"}
                                  color={scheduled ? "#FF385C" : "#222222"}
                                />
                              </IconButton>
                            </Box>

                            {/* Content Meta Block */}
                            <Box sx={{ mt: 1 }}>
                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                                <Typography
                                  onClick={() => {
                                    setSelectedActivity(act);
                                    setDetailSheetOpen(true);
                                  }}
                                  sx={{
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    color: "#222222",
                                    cursor: "pointer",
                                    lineHeight: 1.3,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: "75%",
                                    fontFamily: "var(--font-sans)",
                                    "&:hover": { color: "#FF385C" },
                                  }}
                                >
                                  {act.title}
                                </Typography>
                                <Chip
                                  label={act.category}
                                  size="small"
                                  sx={{
                                    height: 16,
                                    fontSize: "9px",
                                    fontWeight: "bold",
                                    bgcolor: colors.bg,
                                    color: colors.text,
                                    borderRadius: "4px",
                                  }}
                                />
                              </Box>

                              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.1, mt: 0.4 }}>
                                {act.location && (
                                  <Typography
                                    sx={{
                                      fontSize: "12px",
                                      color: "#6A6A6A",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 0.4,
                                      fontFamily: "var(--font-sans)",
                                    }}
                                  >
                                    <MapPin size={10} style={{ color: "#6A6A6A" }} />
                                    <span>{act.location}</span>
                                  </Typography>
                                )}
                                {(act.estimatedDuration || act.startTime) && (
                                  <Typography
                                    sx={{
                                      fontSize: "12px",
                                      color: "#6A6A6A",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 0.4,
                                      fontFamily: "var(--font-sans)",
                                    }}
                                  >
                                    <Clock size={10} style={{ color: "#6A6A6A" }} />
                                    <span>
                                      {act.estimatedDuration || "Flexible duration"}
                                      {act.startTime ? ` · ${act.startTime}` : ""}
                                    </span>
                                  </Typography>
                                )}
                              </Box>

                              {act.notes && (
                                <Typography
                                  sx={{
                                    fontSize: "11px",
                                    color: "#6A6A6A",
                                    fontStyle: "italic",
                                    mt: 0.6,
                                    WebkitLineClamp: 2,
                                    display: "-webkit-box",
                                    overflow: "hidden",
                                    WebkitBoxOrient: "vertical",
                                    fontFamily: "var(--font-sans)",
                                    lineHeight: 1.35,
                                  }}
                                >
                                  "{act.notes.replace(/<[^>]*>/g, "")}"
                                </Typography>
                              )}

                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1.2 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                  {act.createdByPhotoURL ? (
                                    <Avatar src={act.createdByPhotoURL} sx={{ width: 16, height: 16 }} />
                                  ) : (
                                    <Avatar
                                      sx={{
                                        width: 16,
                                        height: 16,
                                        bgcolor: "#92174D",
                                        color: "#FFFFFF",
                                        fontSize: "8px",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {act.createdBy ? act.createdBy[0].toUpperCase() : "C"}
                                    </Avatar>
                                  )}
                                  <Typography sx={{ fontSize: "11px", color: "#6A6A6A", fontFamily: "var(--font-sans)" }}>
                                    {act.createdBy || "Collaborator"}
                                  </Typography>
                                </Box>

                                {!isReadOnly && (
                                  <Button
                                    id={`add-to-itinerary-btn-mobile-${act.id}`}
                                    size="small"
                                    onClick={() => {
                                      setSelectedActivity(act);
                                      setAddToItineraryOpen(true);
                                    }}
                                    sx={{
                                      borderRadius: "20px",
                                      textTransform: "none",
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      px: 1.8,
                                      py: 0.4,
                                      bgcolor: scheduled ? "#FFFFFF" : "#FF385C",
                                      color: scheduled ? "#222222" : "#FFFFFF",
                                      border: scheduled ? "1px solid #DDDDDD" : "none",
                                      boxShadow: "none",
                                      whiteSpace: "nowrap",
                                      flexShrink: 0,
                                      "&:hover": {
                                        bgcolor: scheduled ? "#F7F7F7" : "#E00B41",
                                        boxShadow: "none",
                                      },
                                    }}
                                  >
                                    {scheduled ? "Scheduled" : "+ Schedule"}
                                  </Button>
                                )}
                              </Box>
                            </Box>
                          </Box>
                        );
                      } else {
                        // List View Mobile
                        return (
                          <Paper
                            id={`activity-list-item-mobile-${act.id}`}
                            key={act.id}
                            sx={{
                              p: 1.2,
                              border: "1px solid rgba(0,0,0,0.06)",
                              borderRadius: 3,
                              display: "flex",
                              alignItems: "center",
                              gap: 1.2,
                            }}
                          >
                            <Avatar
                              src={act.imageURL}
                              variant="rounded"
                              sx={{ width: 44, height: 44 }}
                              {...({ referrerPolicy: "no-referrer" } as any)}
                            />
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography
                                variant="subtitle2"
                                noWrap
                                onClick={() => {
                                  setSelectedActivity(act);
                                  setDetailSheetOpen(true);
                                }}
                                sx={{ fontWeight: "bold" }}
                              >
                                {act.title}
                              </Typography>
                              <Box sx={{ display: "flex", gap: 0.5, mt: 0.2, flexWrap: "wrap", alignItems: "center" }}>
                                <Chip label={act.category} size="small" sx={{ height: 14, fontSize: "0.55rem", bgcolor: colors.bg, color: colors.text }} />
                                {act.location && (
                                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.2, ml: 0.5, color: "text.secondary", fontSize: "0.65rem" }}>
                                    <MapPin size={8} />
                                    <span>{act.location}</span>
                                  </Box>
                                )}
                                {act.estimatedDuration && (
                                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.2, ml: 0.5, color: "text.secondary", fontSize: "0.65rem" }}>
                                    <Clock size={8} />
                                    <span>{act.estimatedDuration}</span>
                                  </Box>
                                )}
                              </Box>
                            </Box>

                            {!isReadOnly && (
                              <Button
                                id={`add-to-itinerary-list-btn-mobile-${act.id}`}
                                size="small"
                                variant={scheduled ? "outlined" : "contained"}
                                color={scheduled ? "inherit" : "primary"}
                                onClick={() => {
                                  setSelectedActivity(act);
                                  setAddToItineraryOpen(true);
                                }}
                                sx={{ py: 0.4, px: 0.8, minWidth: 0, fontSize: "0.7rem" }}
                              >
                                {scheduled ? "Scheduled" : "+"}
                              </Button>
                            )}
                          </Paper>
                        );
                      }
                    })
                  )}
                </Box>
                  </>
                )}
              </Box>
            )}
          </Box>
            </>
          )}
        </Box>

        {/* --- FLOATING PILL BOTTOM NAVIGATION BAR --- */}
        <Paper
          sx={{
            position: "fixed",
            bottom: { xs: 16, sm: 24 },
            left: "50%",
            transform: "translateX(-50%)",
            width: "calc(100% - 32px)",
            maxWidth: 480,
            borderRadius: "28px",
            overflow: "hidden",
            boxShadow: "rgba(0, 0, 0, 0.08) 0px 8px 24px, rgba(0, 0, 0, 0.04) 0px 4px 8px",
            border: "1px solid rgba(0, 0, 0, 0.06)",
            zIndex: 1100,
            bgcolor: "#FFFFFF"
          }}
          elevation={0}
        >
          <BottomNavigation
            value={currentTab}
            onChange={(_event, newValue) => {
              setCurrentTab(newValue as any);
            }}
            showLabels
          >
            <BottomNavigationAction
              id="nav-itinerary-btn"
              label="Itinerary"
              value="itinerary"
              icon={<Calendar size={20} />}
            />
            <BottomNavigationAction
              id="nav-activities-btn"
              label="Activities"
              value="activities"
              icon={<Compass size={20} />}
              sx={{ display: { xs: "inline-flex", md: "none" } }}
            />
            <BottomNavigationAction
              id="nav-profile-btn"
              label="Manage Trip"
              value="profile"
              icon={<Settings size={20} />}
            />
          </BottomNavigation>
        </Paper>

        {/* --- DIALOGS AND BOTTOM SHEETS --- */}
        <AuthModal
          open={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
        />

        <AddActivityDialog
          open={addActivityOpen}
          onClose={() => setAddActivityOpen(false)}
          onAdd={handleAddManualActivity}
          tripCustomCategories={trip?.customCategories || []}
        />

        <AddToItineraryDialog
          open={addToItineraryOpen}
          onClose={() => setAddToItineraryOpen(false)}
          activity={selectedActivity}
          days={daysList}
          onConfirm={handleScheduleActivity}
        />

        <ActivityDetailSheet
          activity={selectedActivity}
          placement={selectedActivity ? activityPlacementsMap[selectedActivity.id] : null}
          open={detailSheetOpen}
          onClose={() => {
            setDetailSheetOpen(false);
            setSelectedActivity(null);
          }}
          onAddToItinerary={(act) => {
            setDetailSheetOpen(false);
            setSelectedActivity(act);
            setAddToItineraryOpen(true);
          }}
          onRemoveFromItinerary={handleUnscheduleActivity}
          onArchiveActivity={handleArchiveActivity}
          isReadOnly={isReadOnly}
          tripCustomCategories={trip?.customCategories || []}
          onUpdateActivity={handleUpdateActivity}
          onUpdatePlacement={handleUpdatePlacement}
        />

        <ProfileDialog
          open={profileDialogOpen}
          onClose={() => setProfileDialogOpen(false)}
          currentUser={currentUser}
          activeTripId={trip?.id}
          onProfileUpdated={(displayName, photoURL) => {
            if (currentUser) {
              setCurrentUser({
                ...currentUser,
                displayName,
                photoURL
              });
            }
          }}
        />

        {trip && (
          <EditTripDialog
            open={editTripDialogOpen}
            onClose={() => setEditTripDialogOpen(false)}
            trip={trip}
            collaborators={collaborators}
            onSave={handleUpdateTripDetails}
            isReadOnly={isReadOnly}
          />
        )}

        {trip && (
          <ShareTripDialog
            open={shareTripDialogOpen}
            onClose={() => setShareTripDialogOpen(false)}
            trip={trip}
            collaborators={collaborators}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}
