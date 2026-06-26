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
  Map,
  Compass,
  Clock,
  Clock3,
  Heart,
  Settings,
  Users,
  Share2,
  Star,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Firebase
import { onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  arrayUnion,
  arrayRemove,
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
import ItineraryMap from "./components/ItineraryMap";
import ActivitiesMap from "./components/ActivitiesMap";
import TravelAssistantChat from "./components/TravelAssistantChat";
import {
  PrimaryButton,
  SecondaryButton,
  PillButton,
  IconCircleButton,
  DestructiveButton,
  SegmentButton,
} from "./components/Button";

// Theme and helpers
import theme from "./lib/theme";
import { Trip, Activity, ItineraryPlacement, Collaborator } from "./types";
import { CATEGORY_COLORS, getCategoryImage } from "./lib/images";

export default function App() {
  // Navigation & Screen States
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Local Wishlist / Favorites Persistence (Guest + Sync fallback)
  const [localLikedIds, setLocalLikedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("liked_activities");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync local wishlist with localStorage
  useEffect(() => {
    try {
      localStorage.setItem("liked_activities", JSON.stringify(localLikedIds));
    } catch (e) {
      console.warn("Could not save liked activities to localStorage:", e);
    }
  }, [localLikedIds]);

  // Firestore Collections State
  const [activities, setActivities] = useState<Activity[]>([]);
  const [placements, setPlacements] = useState<ItineraryPlacement[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  // Local/UI configuration states
  const [currentTab, setCurrentTab] = useState<"ai" | "itinerary" | "activities" | "profile" | "my-trips">("my-trips");
  const [selectedDay, setSelectedDay] = useState<string>("Day 1");
  const [viewMode, setViewMode] = useState<"gallery" | "list" | "map">("gallery");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");

  // Google Maps and layout toggle states
  const [rightPanelTab, setRightPanelTab] = useState<"ideas" | "map">("map");
  const [mobileItineraryMode, setMobileItineraryMode] = useState<"list" | "map">("list");
  const [assistantOpen, setAssistantOpen] = useState(false);

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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Retrieve profile details with a fallback to providerData (especially for Google OAuth)
        const photo = user.photoURL || user.providerData?.[0]?.photoURL || "";
        const nameVal = user.displayName || user.providerData?.[0]?.displayName || "Traveler";
        
        // If the Firebase auth user object itself lacks a photoURL but the provider has it, update the profile
        if (!user.photoURL && photo) {
          try {
            await updateProfile(user, { photoURL: photo });
          } catch (e) {
            console.warn("Failed to update profile photoURL during auto-sync:", e);
          }
        }

        setCurrentUser({
          ...user,
          displayName: nameVal,
          photoURL: photo,
        });

        // Automatically ensure user profile exists in Firestore 'users' collection with their Google account details
        const userRef = doc(db, "users", user.uid);
        try {
          await setDoc(userRef, {
            displayName: nameVal,
            photoURL: photo,
            email: user.email || user.providerData?.[0]?.email || "",
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (error) {
          console.error("Error auto-saving user profile on auth state change:", error);
        }
      } else {
        setCurrentUser(null);
      }
    });
    return unsubscribe;
  }, []);

  // --- Auto-scroll Selected Day Tab Into View ---
  useEffect(() => {
    if (!selectedDay) return;

    // Use a small timeout to ensure the DOM layout and rendering are completed
    const timer = setTimeout(() => {
      // 1. Desktop Tab
      const desktopEl = document.getElementById(`day-tab-desktop-${selectedDay}`);
      if (desktopEl) {
        desktopEl.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }

      // 2. Mobile Tab
      const mobileEl = document.getElementById(`day-tab-mobile-${selectedDay}`);
      if (mobileEl) {
        mobileEl.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedDay]);

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

  const getTimePeriod = (timeStr: string) => {
    if (!timeStr) return { label: "Flexible", icon: "✨", color: "#64748B" };
    const parts = timeStr.split(":");
    const hour = parseInt(parts[0], 10);
    if (isNaN(hour)) return { label: "Flexible", icon: "✨", color: "#64748B" };
    if (hour < 12) return { label: "Morning", icon: "🌅", color: "#0F766E" };
    if (hour < 17) return { label: "Afternoon", icon: "☀️", color: "#F59E0B" };
    if (hour < 21) return { label: "Evening", icon: "🌆", color: "#9333EA" };
    return { label: "Night", icon: "🌙", color: "#1E1B4B" };
  };

  const getDayLabelAndDate = (dayIndex: number) => {
    if (!trip?.startDate) return { label: `Day ${dayIndex + 1}`, dateStr: "" };
    const parts = trip.startDate.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return { label: `Day ${dayIndex + 1}`, dateStr: "" };
    const dateObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + dayIndex));
    const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const monthDay = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    return { label: `Day ${dayIndex + 1}`, dateStr: `${weekday}, ${monthDay}` };
  };

  const getActivitiesCountForDay = (dayName: string) => {
    return placements.filter((p) => p.day === dayName).length;
  };

  // Set default selected day if current choice is not in list
  useEffect(() => {
    if (daysList.length > 0 && !daysList.includes(selectedDay)) {
      setSelectedDay(daysList[0]);
    }
  }, [daysList]);

  // Synchronize active navigation tab when a trip is loaded or unloaded
  useEffect(() => {
    if (trip) {
      setCurrentTab((prev) => (prev === "my-trips" || prev === "profile" ? "ai" : prev));
    } else {
      setCurrentTab((prev) => (prev === "itinerary" || prev === "activities" || prev === "ai" ? "my-trips" : prev));
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

  const handleDeleteTrip = async () => {
    if (!trip) return;
    try {
      await deleteDoc(doc(db, "trips", trip.id));
      const recent = JSON.parse(localStorage.getItem("recent_trips") || "[]");
      const updatedRecent = recent.filter((t: any) => t.id !== trip.id);
      localStorage.setItem("recent_trips", JSON.stringify(updatedRecent));
      setTrip(null);
      setCurrentTab("itinerary");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `trips/${trip.id}`);
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
      imageURL: data.imageURL || "",
      location: data.location || "",
      notes: data.notes || "",
      estimatedDuration: data.estimatedDuration || "",
      startTime: data.startTime || "",
      source: data.source || "Manual",
      sourceDetail: data.sourceDetail || "",
      rating: data.rating || "",
      createdBy: currentUser?.displayName || "Collaborator",
      createdByUserId: currentUser?.uid,
      createdByPhotoURL: currentUser?.photoURL || undefined,
      createdAt: new Date().toISOString(),
      status: "active",
    };

    try {
      await setDoc(doc(db, "trips", trip.id, "activities", actId), newAct);
      return newAct;
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

  const handleUpdateActivityCoordinates = async (activityId: string, lat: number, lng: number) => {
    await handleUpdateActivity(activityId, { latitude: lat, longitude: lng });
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

  const handleToggleLikeActivity = async (activity: Activity) => {
    if (!trip) return;

    // Toggle local state for instant responsive UI feedback
    const isCurrentlyLikedLocally = localLikedIds.includes(activity.id);
    if (isCurrentlyLikedLocally) {
      setLocalLikedIds((prev) => prev.filter((id) => id !== activity.id));
    } else {
      setLocalLikedIds((prev) => [...prev, activity.id]);
    }

    // Synchronize to Firestore for authenticated users
    if (currentUser) {
      try {
        const isCurrentlyLikedInDoc = activity.likes?.includes(currentUser.uid);
        const actRef = doc(db, "trips", trip.id, "activities", activity.id);
        await updateDoc(actRef, {
          likes: isCurrentlyLikedInDoc
            ? arrayRemove(currentUser.uid)
            : arrayUnion(currentUser.uid)
        });
      } catch (error) {
        console.error("Error syncing favorite/like state to Firestore:", error);
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
        const freshCatImage = getCategoryImage(idea.category, idea.title);
        const finalImage = (idea.media && idea.media.length > 0) ? idea.media[0] : freshCatImage;

        const newActivity: Activity = {
          id: activityId,
          tripId: trip.id,
          title: idea.title,
          category: idea.category,
          imageURL: finalImage,
          location: idea.location || "",
          notes: idea.notes || "",
          estimatedDuration: idea.estimatedDuration || "",
          source: "AI Search",
          sourceDetail: "Fetched via 'Get More Ideas'",
          createdBy: "Travel Assistant",
          createdAt: new Date().toISOString(),
          status: "active",
          rating: idea.rating || "",
          media: idea.media || [freshCatImage],
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
        const finalImage = (idea.media && idea.media.length > 0) ? idea.media[0] : freshCatImage;

        const newActivity: Activity = {
          id: activityId,
          tripId: trip.id,
          title: idea.title,
          category: idea.category,
          imageURL: finalImage,
          location: idea.location || trip.destination,
          notes: idea.notes || "",
          estimatedDuration: idea.estimatedDuration || "",
          source: "AI Search",
          sourceDetail: "Generated from interests: " + selectedSparks.join(", "),
          createdBy: "Travel Assistant",
          createdAt: new Date().toISOString(),
          status: "active",
          rating: idea.rating || "",
          media: idea.media || [freshCatImage],
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
      <Box sx={{ 
        minHeight: "100vh", 
        height: currentTab === "ai" ? "100vh" : "auto",
        bgcolor: "background.default", 
        pb: { xs: currentTab === "ai" ? 0 : 12, sm: 14 }, 
        display: "flex", 
        flexDirection: "column", 
        overflow: currentTab === "ai" ? "hidden" : "visible",
        overflowX: "hidden" 
      }}>
        
        {/* Sticky Header */}
        <Box sx={{ bgcolor: "#FFFFFF", borderBottom: "1px solid rgba(0,0,0,0.06)", position: "sticky", top: 0, zIndex: 1100 }}>
          <Box sx={{ px: { xs: 2, md: 3 }, py: 1.5, maxWidth: 1200, mx: "auto" }}>
            
            {/* Top row: Navigation & Actions */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
              {/* Back button & Breadcrumb Trip Name */}
              <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 0.8, sm: 1.5 }, minWidth: 0, flexShrink: 1 }}>
                <PillButton
                  id="header-back-btn"
                  size="sm"
                  startIcon={<ArrowLeft size={16} />}
                  onClick={() => {
                    window.location.hash = "";
                    setTrip(null);
                    setCurrentTab("itinerary");
                  }}
                >
                  Home
                </PillButton>
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


            </Box>
          </Box>
        </Box>

        {/* --- MAIN LAYOUT WINDOW --- */}
        <Box sx={{ flexGrow: 1, p: { xs: currentTab === "ai" ? 0 : 2, md: 3 }, maxWidth: 1200, mx: "auto", width: "100%" }}>
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
              onDeleteTrip={handleDeleteTrip}
              activities={activities}
              placements={placements}
            />
          ) : currentTab === "ai" ? (
            <Box sx={{ 
              maxWidth: 800, 
              mx: "auto", 
              width: "100%",
              height: { xs: "calc(100vh - 136px)", sm: "690px" },
              display: "flex",
              flexDirection: "column"
            }}>
              {/* Page Title - Desktop version */}
              <Box sx={{ display: { xs: "none", sm: "flex" }, justifyContent: "space-between", alignItems: "center", mb: 2, px: 0.5 }}>
                <Typography variant="h6" sx={{ color: "#222222", fontWeight: 700 }}>
                  AI Travel Assistant
                </Typography>
              </Box>

              {/* Page Title - Mobile version */}
              <Box sx={{ display: { xs: "flex", sm: "none" }, justifyContent: "space-between", alignItems: "center", mb: 1, px: 2, pt: 1.5 }}>
                <Typography variant="subtitle1" color="primary" sx={{ fontWeight: "bold" }}>
                  AI Travel Assistant
                </Typography>
              </Box>

              <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                <TravelAssistantChat
                  isOpen={true}
                  onClose={() => {}}
                  destination={trip.destination || trip.name}
                  tripName={trip.name}
                  onAddActivity={handleAddManualActivity}
                  onPreviewActivity={(act) => {
                    setSelectedActivity(act as Activity);
                    setDetailSheetOpen(true);
                  }}
                  isInline={true}
                />
              </Box>
            </Box>
          ) : (
            <>
              {/* 1. Desktop Side-by-Side View */}
              <Box sx={{ display: { xs: "none", md: "flex" }, gap: 4 }}>
            {/* Desktop Left: Itinerary Panel */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h6" sx={{ color: "#222222", fontWeight: 700 }}>Trip Itinerary</Typography>
                
                {/* Multiplayer Presence Avatars Stack */}
                {collaborators.length > 0 && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 1, fontWeight: 500 }}>
                      Active now:
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: -1, overflow: "visible" }}>
                      {collaborators.map((c) => (
                        <Tooltip key={c.userId} title={c.displayName || "Collaborator"}>
                          <Avatar
                            src={c.photoURL || undefined}
                            {...({ referrerPolicy: "no-referrer" } as any)}
                            sx={{
                              width: 28,
                              height: 28,
                              border: "2px solid #FFFFFF",
                              marginLeft: "-8px",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
                              bgcolor: "primary.main",
                              fontSize: "11px",
                              fontWeight: "bold"
                            }}
                          >
                            {c.displayName ? c.displayName[0].toUpperCase() : "U"}
                          </Avatar>
                        </Tooltip>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Horizontal Day Navigation */}
              <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 1, mb: 2, "&::-webkit-scrollbar": { display: "none" } }}>
                {daysList.map((d, idx) => {
                  const isSelected = selectedDay === d;
                  return (
                    <SegmentButton
                      id={`day-tab-desktop-${d}`}
                      key={d}
                      onClick={() => setSelectedDay(d)}
                      active={isSelected}
                      size="sm"
                      className="min-w-[80px]"
                    >
                      {d}
                    </SegmentButton>
                  );
                })}
              </Box>

              {/* Short Day Description right below tabs */}
              <Box sx={{ mb: 3, pl: 0.5 }}>
                <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: "1.05rem", color: "#222222", lineHeight: 1.2 }}>
                  {getDayLabelAndDate(daysList.indexOf(selectedDay)).dateStr || "Flexible Schedule"}
                </Typography>
                {currentDayPlacements.length > 0 ? (
                  <Typography variant="caption" sx={{ color: "#717171", fontWeight: 500 }}>
                    {currentDayPlacements.length} {currentDayPlacements.length === 1 ? "activity" : "activities"} scheduled
                  </Typography>
                ) : (
                  <Typography variant="caption" sx={{ color: "#717171", fontWeight: 500 }}>
                    No activities scheduled for this day
                  </Typography>
                )}
              </Box>

              {/* Timeline list */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                {currentDayPlacements.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: "center", border: "1px dashed rgba(0,0,0,0.12)", bgcolor: "transparent" }}>
                    <Typography variant="body2" color="text.secondary">
                      No activities scheduled yet.
                    </Typography>
                    {!isReadOnly && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        Add activities from your Idea Pool!
                      </Typography>
                    )}
                  </Paper>
                ) : (
                  currentDayPlacements.map((p, index) => {
                    const act = activities.find((a) => a.id === p.activityId);
                    if (!act) return null;
                    const colors = CATEGORY_COLORS[act.category] || CATEGORY_COLORS.Custom;
                    const nextPlacement = currentDayPlacements[index + 1];
                    const nextAct = nextPlacement ? activities.find((a) => a.id === nextPlacement.activityId) : null;
                    const currentPeriod = getTimePeriod(p.startTime);
                    const showPeriodHeader = index === 0 || getTimePeriod(p.startTime).label !== getTimePeriod(currentDayPlacements[index - 1].startTime).label;

                    return (
                      <Box key={p.id}>
                        {/* Period Header */}
                        {showPeriodHeader && (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: index > 0 ? 4 : 1, mb: 2 }}>
                            <Typography sx={{ fontSize: "1.2rem" }}>{currentPeriod.icon}</Typography>
                            <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: "0.8rem", color: currentPeriod.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {currentPeriod.label}
                            </Typography>
                            <Box sx={{ flexGrow: 1, height: "1px", bgcolor: "#E2E8F0", ml: 1 }} />
                          </Box>
                        )}

                        <Box sx={{ display: "flex", position: "relative", gap: 3 }}>
                          {/* Left Rail */}
                          <Box sx={{ width: 40, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", flexShrink: 0 }}>
                            {index > 0 && (
                              <Box sx={{ width: "2px", bgcolor: "#E2E8F0", flexGrow: 1, position: "absolute", top: 0, bottom: "50%", left: "50%", transform: "translateX(-50%)" }} />
                            )}
                            {index < currentDayPlacements.length - 1 && (
                              <Box sx={{ width: "2px", bgcolor: "#E2E8F0", flexGrow: 1, position: "absolute", top: "50%", bottom: 0, left: "50%", transform: "translateX(-50%)" }} />
                            )}
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                bgcolor: colors.bg,
                                border: "2px solid",
                                borderColor: colors.primary,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                zIndex: 2,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                                transition: "all 0.2s ease",
                              }}
                            >
                              <Typography sx={{ fontSize: "12px", fontWeight: "bold", color: colors.text }}>
                                {index + 1}
                              </Typography>
                            </Box>
                            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", mt: 1 }}>
                              {p.startTime}
                            </Typography>
                          </Box>

                          {/* Card Content */}
                          <Card
                            id={`itinerary-card-${p.id}`}
                            sx={{
                              flexGrow: 1,
                              display: "flex",
                              borderRadius: "16px",
                              border: "1px solid #EBEBEB",
                              boxShadow: "0 2px 12px rgba(0,0,0,0.02)",
                              transition: "all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
                              "&:hover": {
                                transform: "translateY(-2px)",
                                boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                                borderColor: colors.primary,
                              }
                            }}
                          >
                            <CardMedia
                              component="img"
                              sx={{ width: 120, height: "auto", minHeight: 120, objectFit: "cover", display: { xs: "none", sm: "block" } }}
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
                                  <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mb: 0.5 }}>
                                    <Chip label={act.category} size="small" sx={{ bgcolor: colors.bg, color: colors.text, fontWeight: "bold", fontSize: "0.65rem", height: 18 }} />
                                    {p.endTime && (
                                      <Chip label={`Until ${p.endTime}`} size="small" variant="outlined" sx={{ fontSize: "0.65rem", height: 18 }} />
                                    )}
                                  </Box>
                                  <Typography
                                    variant="subtitle1"
                                    onClick={() => {
                                      setSelectedActivity(act);
                                      setDetailSheetOpen(true);
                                    }}
                                    sx={{ fontWeight: "bold", cursor: "pointer", color: "#1E293B", "&:hover": { color: "primary.main", textDecoration: "underline" } }}
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

                              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 1 }}>
                                {act.location && (
                                  <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.8rem" }}>
                                    <MapPin size={13} style={{ color: "#64748B" }} />
                                    <span>{act.location}</span>
                                  </Typography>
                                )}
                                {act.estimatedDuration && (
                                  <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.8rem" }}>
                                    <Clock size={13} style={{ color: "#64748B" }} />
                                    <span>{act.estimatedDuration}</span>
                                  </Typography>
                                )}
                              </Box>

                              {act.notes && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{
                                    mt: 1,
                                    fontSize: "0.78rem",
                                    fontStyle: "italic",
                                    bgcolor: "#F8FAFC",
                                    p: 1,
                                    borderRadius: "8px",
                                    borderLeft: `3px solid ${colors.primary}`,
                                  }}
                                >
                                  {act.notes.replace(/<[^>]*>/g, "")}
                                </Typography>
                              )}

                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 1.5 }}>
                                {p.addedByPhotoURL ? (
                                  <Avatar src={p.addedByPhotoURL} {...({ referrerPolicy: "no-referrer" } as any)} sx={{ width: 18, height: 18 }} />
                                ) : (
                                  <Avatar sx={{ width: 18, height: 18, bgcolor: "primary.main", fontSize: "0.6rem", fontWeight: "bold" }}>
                                    {p.addedBy ? p.addedBy[0].toUpperCase() : "C"}
                                  </Avatar>
                                )}
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
                                  Added by {p.addedBy || "Collaborator"}
                                </Typography>
                              </Box>
                            </Box>
                          </Card>
                        </Box>

                        {/* Transition Step Indicator */}
                        {nextAct && act.location && nextAct.location && (
                          <Box sx={{ display: "flex", gap: 3, ml: 2.5, my: 1.5 }}>
                            <Box sx={{ width: 12, display: "flex", justifyContent: "center", position: "relative" }}>
                              <Box sx={{ width: "2px", borderLeft: "2px dashed #CBD5E1", height: "100%" }} />
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5, px: 1.5, bgcolor: "#F8FAFC", borderRadius: "20px", border: "1px solid #E2E8F0" }}>
                              <Compass size={13} className="text-slate-500 stroke-[2.5]" />
                              <Typography sx={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 700 }}>
                                Transit step: Move to {nextAct.title}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    );
                  })
                )}
              </Box>
            </Box>

            {/* Desktop Right: Activities/Ideas Pool or Route Map Panel */}
            <Box
              sx={{
                width: rightPanelTab === "map" && activities.length > 0 ? 580 : 450,
                flexShrink: 0,
                transition: "width 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
                display: "flex",
                flexDirection: "column"
              }}
            >
              {activities.length === 0 ? (
                <SparksSelector
                  trip={trip}
                  isGenerating={aiGenerating}
                  onBuild={handleBuildSparksItinerary}
                />
              ) : (
                <>
                  {/* Segment Tab Header */}
                  <Box sx={{ display: "flex", gap: 1, mb: 3, borderBottom: "1px solid #EBEBEB", pb: 0.5, flexShrink: 0 }}>
                    <Button
                      id="tab-ideas-pool"
                      onClick={() => setRightPanelTab("ideas")}
                      sx={{
                        color: rightPanelTab === "ideas" ? "#FF385C" : "#717171",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        borderBottom: rightPanelTab === "ideas" ? "2px solid #FF385C" : "none",
                        borderRadius: 0,
                        pb: 1,
                        px: 1.5,
                        textTransform: "none",
                        "&:hover": { bgcolor: "transparent", color: "#FF385C" },
                      }}
                    >
                      💡 Idea Pool ({activities.length})
                    </Button>
                    <Button
                      id="tab-route-map"
                      onClick={() => setRightPanelTab("map")}
                      sx={{
                        color: rightPanelTab === "map" ? "#FF385C" : "#717171",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        borderBottom: rightPanelTab === "map" ? "2px solid #FF385C" : "none",
                        borderRadius: 0,
                        pb: 1,
                        px: 1.5,
                        textTransform: "none",
                        "&:hover": { bgcolor: "transparent", color: "#FF385C" },
                      }}
                    >
                      🗺️ Route Map
                    </Button>
                  </Box>

                  {rightPanelTab === "map" ? (
                    <Box sx={{ flex: 1, minHeight: 480, display: "flex", flexDirection: "column" }}>
                      <ItineraryMap
                        trip={trip!}
                        placements={placements}
                        activities={activities}
                        selectedDay={selectedDay}
                        onUpdateActivityCoordinates={handleUpdateActivityCoordinates}
                        onSelectActivity={(act) => {
                          setSelectedActivity(act);
                          setDetailSheetOpen(true);
                        }}
                        isReadOnly={isReadOnly}
                      />
                    </Box>
                  ) : (
                    <>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <Typography variant="h6" color="primary" sx={{ fontWeight: "bold" }}>Activities Idea Pool</Typography>
                {!isReadOnly && (
                  <SecondaryButton
                    id="add-activity-btn-desktop"
                    size="sm"
                    startIcon={<Plus size={16} />}
                    onClick={() => setAddActivityOpen(true)}
                  >
                    Add Idea
                  </SecondaryButton>
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
                      <MenuItem value="AI">Recommended</MenuItem>
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
                    <IconButton
                      id="view-map-btn-desktop"
                      size="small"
                      color={viewMode === "map" ? "primary" : "default"}
                      onClick={() => setViewMode("map")}
                    >
                      <Map size={18} />
                    </IconButton>
                  </Box>

                  {/* AI trigger */}
                  {!isReadOnly && (
                    <PillButton
                      id="get-ideas-btn-desktop"
                      size="sm"
                      startIcon={<Sparkles size={14} />}
                      onClick={handleGetMoreIdeas}
                      disabled={aiGenerating}
                    >
                      {aiGenerating ? "Searching..." : "Get More AI Ideas"}
                    </PillButton>
                  )}
                </Box>

                {aiError && (
                  <Alert severity="error" sx={{ py: 0.5 }}>
                    {aiError}
                  </Alert>
                )}
              </Box>

              {/* Ideas Pool Render */}
              {viewMode === "map" ? (
                <Box sx={{ height: "calc(100vh - 420px)", width: "100%", borderRadius: "24px", overflow: "hidden" }}>
                  <ActivitiesMap
                    trip={trip!}
                    activities={filteredActivities}
                    activityPlacementsMap={activityPlacementsMap}
                    onUpdateActivityCoordinates={handleUpdateActivityCoordinates}
                    onSelectActivity={(act) => {
                      setSelectedActivity(act);
                      setDetailSheetOpen(true);
                    }}
                    onToggleSchedule={(act) => {
                      setSelectedActivity(act);
                      setAddToItineraryOpen(true);
                    }}
                    isReadOnly={isReadOnly}
                  />
                </Box>
              ) : (
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
                                {act.source === "AI Search" ? "Recommended" : "Collaborator"}
                              </Typography>
                            </Box>

                            {/* Heart Wishlist icon at top-right */}
                            <IconButton
                              id={`activity-heart-btn-${act.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLikeActivity(act);
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
                                fill={(localLikedIds.includes(act.id) || (currentUser && act.likes?.includes(currentUser.uid))) ? "#FF385C" : "none"}
                                color={(localLikedIds.includes(act.id) || (currentUser && act.likes?.includes(currentUser.uid))) ? "#FF385C" : "#222222"}
                                style={{ transition: "all 0.2s ease-in-out" }}
                              />
                            </IconButton>
                          </Box>

                          {/* Content Meta Block */}
                          <Box sx={{ mt: 1.2 }}>
                            {/* Title (Full width for clean layout) */}
                            <Typography
                              onClick={() => {
                                setSelectedActivity(act);
                                setDetailSheetOpen(true);
                              }}
                              sx={{
                                fontSize: "15px",
                                fontWeight: 700,
                                color: "#222222",
                                cursor: "pointer",
                                lineHeight: 1.3,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontFamily: "var(--font-sans)",
                                "&:hover": { color: "#FF385C" },
                              }}
                            >
                              {act.title}
                            </Typography>

                            {/* Rating + Category Row */}
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
                              {act.rating && (
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                                  <Star size={13} fill="#222222" color="#222222" />
                                  <Typography sx={{ fontSize: "12px", fontWeight: "bold", color: "#222222" }}>
                                    {act.rating}
                                  </Typography>
                                </Box>
                              )}
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

                            {/* Location and Duration on a single elegant row */}
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 1, overflow: "hidden" }}>
                              {act.location && (
                                <Typography
                                  sx={{
                                    fontSize: "12.5px",
                                    color: "#6A6A6A",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    fontFamily: "var(--font-sans)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <MapPin size={12} style={{ color: "#6A6A6A", flexShrink: 0 }} />
                                  <span>{act.location}</span>
                                </Typography>
                              )}
                              {act.estimatedDuration && (
                                <Typography
                                  sx={{
                                    fontSize: "12.5px",
                                    color: "#6A6A6A",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    fontFamily: "var(--font-sans)",
                                    flexShrink: 0,
                                  }}
                                >
                                  <Clock size={12} style={{ color: "#6A6A6A" }} />
                                  <span>{act.estimatedDuration}</span>
                                </Typography>
                              )}
                            </Box>

                            {/* Action Button (Notes and creator attribution moved to detail view) */}
                            {!isReadOnly && (
                              <Box sx={{ mt: 1.5 }}>
                                {scheduled ? (
                                  <PillButton
                                    id={`add-to-itinerary-btn-desktop-${act.id}`}
                                    size="sm"
                                    onClick={() => {
                                      setSelectedActivity(act);
                                      setAddToItineraryOpen(true);
                                    }}
                                    className="w-full justify-center !rounded-full border border-neutral-200 bg-[#f7f7f7] text-[#222222] hover:bg-[#ebebeb]"
                                  >
                                    Scheduled
                                  </PillButton>
                                ) : (
                                  <PrimaryButton
                                    id={`add-to-itinerary-btn-desktop-${act.id}`}
                                    size="sm"
                                    onClick={() => {
                                      setSelectedActivity(act);
                                      setAddToItineraryOpen(true);
                                    }}
                                    className="w-full justify-center"
                                  >
                                    + Add to Trip
                                  </PrimaryButton>
                                )}
                              </Box>
                            )}
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
                              <Chip label={act.source === "AI Search" ? "Recommended" : "Idea"} size="small" sx={{ height: 16, fontSize: "0.6rem" }} />
                              
                              {act.rating && (
                                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, ml: 0.5, fontSize: "0.7rem", fontWeight: "bold", color: "#222222" }}>
                                  <Star size={10} fill="#222222" color="#222222" />
                                  <span>{act.rating}</span>
                                </Box>
                              )}

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
              )}
                    </>
                  )}
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
                  <Box sx={{ display: "flex", border: "1px solid #E2E8F0", borderRadius: "20px", p: 0.3, bgcolor: "#F8FAFC" }}>
                    <Button
                      id="mobile-view-list-btn"
                      size="small"
                      onClick={() => setMobileItineraryMode("list")}
                      sx={{
                        fontSize: "0.65rem",
                        fontWeight: "bold",
                        py: 0.3,
                        px: 1.2,
                        minWidth: 50,
                        borderRadius: "15px",
                        textTransform: "none",
                        bgcolor: mobileItineraryMode === "list" ? "#FF385C" : "transparent",
                        color: mobileItineraryMode === "list" ? "#FFFFFF" : "#475569",
                        "&:hover": { bgcolor: mobileItineraryMode === "list" ? "#E00B41" : "transparent" },
                      }}
                    >
                      List
                    </Button>
                    <Button
                      id="mobile-view-map-btn"
                      size="small"
                      onClick={() => setMobileItineraryMode("map")}
                      sx={{
                        fontSize: "0.65rem",
                        fontWeight: "bold",
                        py: 0.3,
                        px: 1.2,
                        minWidth: 50,
                        borderRadius: "15px",
                        textTransform: "none",
                        bgcolor: mobileItineraryMode === "map" ? "#FF385C" : "transparent",
                        color: mobileItineraryMode === "map" ? "#FFFFFF" : "#475569",
                        "&:hover": { bgcolor: mobileItineraryMode === "map" ? "#E00B41" : "transparent" },
                      }}
                    >
                      Map
                    </Button>
                  </Box>
                </Box>
                
                {/* Mobile Day Selector Bar */}
                <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 1, mb: 1.5, "&::-webkit-scrollbar": { display: "none" } }}>
                  {daysList.map((d, idx) => {
                    const isSelected = selectedDay === d;
                    return (
                      <SegmentButton
                        id={`day-tab-mobile-${d}`}
                        key={d}
                        onClick={() => setSelectedDay(d)}
                        active={isSelected}
                        size="sm"
                        className="min-w-[80px]"
                      >
                        {d}
                      </SegmentButton>
                    );
                  })}
                </Box>

                {/* Mobile Short Day Description right below tabs */}
                <Box sx={{ mb: 2, px: 0.5 }}>
                  <Typography sx={{ fontFamily: "var(--font-sans)", fontWeight: 800, fontSize: "0.95rem", color: "#222222", lineHeight: 1.2 }}>
                    {getDayLabelAndDate(daysList.indexOf(selectedDay)).dateStr || "Flexible Schedule"}
                  </Typography>
                  {currentDayPlacements.length > 0 ? (
                    <Typography variant="caption" sx={{ color: "#717171", fontWeight: 500 }}>
                      {currentDayPlacements.length} {currentDayPlacements.length === 1 ? "activity" : "activities"} scheduled
                    </Typography>
                  ) : (
                    <Typography variant="caption" sx={{ color: "#717171", fontWeight: 500 }}>
                      No activities scheduled
                    </Typography>
                  )}
                </Box>

                {/* Mobile Map View or Timeline List */}
                {mobileItineraryMode === "map" ? (
                  <Box sx={{ height: "450px", width: "100%", mb: 3 }}>
                    <ItineraryMap
                      trip={trip!}
                      placements={placements}
                      activities={activities}
                      selectedDay={selectedDay}
                      onUpdateActivityCoordinates={handleUpdateActivityCoordinates}
                      onSelectActivity={(act) => {
                        setSelectedActivity(act);
                        setDetailSheetOpen(true);
                      }}
                      isReadOnly={isReadOnly}
                    />
                  </Box>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {currentDayPlacements.length === 0 ? (
                    <Paper sx={{ p: 4, textAlign: "center", border: "1px dashed rgba(0,0,0,0.12)", bgcolor: "transparent" }}>
                      <Typography variant="body2" color="text.secondary">
                        No activities scheduled yet.
                      </Typography>
                      {!isReadOnly && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                          Add ideas from the Activities tab below!
                        </Typography>
                      )}
                    </Paper>
                  ) : (
                    currentDayPlacements.map((p, index) => {
                      const act = activities.find((a) => a.id === p.activityId);
                      if (!act) return null;
                      const colors = CATEGORY_COLORS[act.category] || CATEGORY_COLORS.Custom;
                      const nextPlacement = currentDayPlacements[index + 1];
                      const nextAct = nextPlacement ? activities.find((a) => a.id === nextPlacement.activityId) : null;
                      const currentPeriod = getTimePeriod(p.startTime);
                      const showPeriodHeader = index === 0 || getTimePeriod(p.startTime).label !== getTimePeriod(currentDayPlacements[index - 1].startTime).label;

                      return (
                        <Box key={p.id}>
                          {/* Period Header */}
                          {showPeriodHeader && (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: index > 0 ? 3 : 0.5, mb: 1.5 }}>
                              <Typography sx={{ fontSize: "1rem" }}>{currentPeriod.icon}</Typography>
                              <Typography sx={{ fontWeight: 800, fontSize: "0.7rem", color: currentPeriod.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                {currentPeriod.label}
                              </Typography>
                              <Box sx={{ flexGrow: 1, height: "1px", bgcolor: "#E2E8F0" }} />
                            </Box>
                          )}

                          <Box sx={{ display: "flex", position: "relative", gap: 1.5 }}>
                            {/* Mobile Left Rail */}
                            <Box sx={{ width: 24, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", flexShrink: 0 }}>
                              {index > 0 && (
                                <Box sx={{ width: "2px", bgcolor: "#E2E8F0", flexGrow: 1, position: "absolute", top: 0, bottom: "50%", left: "50%", transform: "translateX(-50%)" }} />
                              )}
                              {index < currentDayPlacements.length - 1 && (
                                <Box sx={{ width: "2px", bgcolor: "#E2E8F0", flexGrow: 1, position: "absolute", top: "50%", bottom: 0, left: "50%", transform: "translateX(-50%)" }} />
                              )}
                              <Box
                                sx={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: "50%",
                                  bgcolor: colors.bg,
                                  border: "2px solid",
                                  borderColor: colors.primary,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  zIndex: 2,
                                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                                }}
                              >
                                <Typography sx={{ fontSize: "9px", fontWeight: "bold", color: colors.text }}>
                                  {index + 1}
                                </Typography>
                              </Box>
                              <Typography sx={{ fontSize: "0.6rem", fontWeight: 700, color: "#475569", mt: 0.5 }}>
                                {p.startTime}
                              </Typography>
                            </Box>

                            {/* Card Content */}
                            <Card
                              id={`itinerary-card-mobile-${p.id}`}
                              sx={{
                                flexGrow: 1,
                                display: "flex",
                                position: "relative",
                                borderRadius: "12px",
                                border: "1px solid #EBEBEB",
                                boxShadow: "0 1px 6px rgba(0,0,0,0.01)"
                              }}
                            >
                              <CardMedia
                                component="img"
                                sx={{ width: 75, objectFit: "cover" }}
                                image={act.imageURL}
                                alt={act.title}
                                {...({ 
                                  referrerPolicy: "no-referrer",
                                  onError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                    e.currentTarget.src = `https://picsum.photos/seed/${act.id || 'activity'}/300/200`;
                                  }
                                } as any)}
                              />

                              <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, p: 1.2, minWidth: 0 }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 0.5 }}>
                                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                    <Typography
                                      variant="subtitle2"
                                      noWrap
                                      onClick={() => {
                                        setSelectedActivity(act);
                                        setDetailSheetOpen(true);
                                      }}
                                      sx={{ fontWeight: "bold", color: "#1E293B" }}
                                    >
                                      {act.title}
                                    </Typography>
                                    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mb: 0.5, mt: 0.2 }}>
                                      <Chip label={act.category} size="small" sx={{ height: 16, fontSize: "0.55rem", bgcolor: colors.bg, color: colors.text, fontWeight: "bold" }} />
                                      {p.endTime && (
                                        <Typography sx={{ fontSize: "0.6rem", color: "text.secondary" }}>
                                          to {p.endTime}
                                        </Typography>
                                      )}
                                    </Box>
                                    
                                    {act.location && (
                                      <Typography sx={{ fontSize: "0.65rem", display: "flex", alignItems: "center", gap: 0.2, color: "text.secondary", mb: 0.5 }}>
                                        <MapPin size={10} />
                                        <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{act.location}</span>
                                      </Typography>
                                    )}

                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                                      {p.addedByPhotoURL ? (
                                        <Avatar src={p.addedByPhotoURL} {...({ referrerPolicy: "no-referrer" } as any)} sx={{ width: 14, height: 14 }} />
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
                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.2, alignItems: "center" }}>
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
                                      <IconButton
                                        id={`unschedule-mobile-btn-${p.id}`}
                                        size="small"
                                        color="error"
                                        onClick={() => handleUnscheduleActivity(p)}
                                        sx={{ p: 0.2 }}
                                      >
                                        <Trash2 size={14} />
                                      </IconButton>
                                    </Box>
                                  )}
                                </Box>
                              </Box>
                            </Card>
                          </Box>

                          {/* Transit Step for Mobile */}
                          {nextAct && act.location && nextAct.location && (
                            <Box sx={{ display: "flex", gap: 1.5, ml: 1.5, my: 1 }}>
                              <Box sx={{ width: 8, display: "flex", justifyContent: "center", position: "relative" }}>
                                <Box sx={{ width: "2px", borderLeft: "2px dashed #CBD5E1", height: "100%" }} />
                              </Box>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, py: 0.3, px: 1, bgcolor: "#F8FAFC", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                                <Compass size={11} className="text-slate-500" />
                                <Typography sx={{ fontSize: "0.6rem", color: "#64748B", fontWeight: 700 }}>
                                  Transit: Next stop {nextAct.title}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                        </Box>
                      );
                    })
                  )}
                </Box>
                )}
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
                    <SecondaryButton
                      id="add-activity-btn-mobile"
                      size="sm"
                      startIcon={<Plus size={14} />}
                      onClick={() => setAddActivityOpen(true)}
                    >
                      Add Idea
                    </SecondaryButton>
                  )}
                </Box>

                {/* Filters Row */}
                <Box sx={{ display: "flex", gap: 1, mb: 2, overflowX: "auto", pt: 1.5, pb: 1, px: 0.5 }}>
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
                      <MenuItem value="AI">Recommended</MenuItem>
                      <MenuItem value="Manual">Collaborator Added</MenuItem>
                    </Select>
                  </FormControl>

                  <Box sx={{ display: "flex", gap: 0.5, border: "1px solid #E2E8F0", borderRadius: "12px", p: 0.5, bgcolor: "#F8FAFC" }}>
                    <IconButton
                      id="view-gallery-btn-mobile"
                      size="small"
                      onClick={() => setViewMode("gallery")}
                      sx={{
                        borderRadius: "8px",
                        bgcolor: viewMode === "gallery" ? "#FFFFFF" : "transparent",
                        boxShadow: viewMode === "gallery" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        color: viewMode === "gallery" ? "#FF385C" : "#64748B",
                        p: 0.8,
                      }}
                    >
                      <LayoutGrid size={16} />
                    </IconButton>
                    <IconButton
                      id="view-list-btn-mobile"
                      size="small"
                      onClick={() => setViewMode("list")}
                      sx={{
                        borderRadius: "8px",
                        bgcolor: viewMode === "list" ? "#FFFFFF" : "transparent",
                        boxShadow: viewMode === "list" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        color: viewMode === "list" ? "#FF385C" : "#64748B",
                        p: 0.8,
                      }}
                    >
                      <LayoutList size={16} />
                    </IconButton>
                    <IconButton
                      id="view-map-btn-mobile"
                      size="small"
                      onClick={() => setViewMode("map")}
                      sx={{
                        borderRadius: "8px",
                        bgcolor: viewMode === "map" ? "#FFFFFF" : "transparent",
                        boxShadow: viewMode === "map" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        color: viewMode === "map" ? "#FF385C" : "#64748B",
                        p: 0.8,
                      }}
                    >
                      <Map size={16} />
                    </IconButton>
                  </Box>
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
                  <PillButton
                    id="get-ideas-btn-mobile"
                    size="sm"
                    className="w-full mb-[10px]"
                    startIcon={<Sparkles size={14} />}
                    onClick={handleGetMoreIdeas}
                    disabled={aiGenerating}
                  >
                    {aiGenerating ? "AI is fetching options..." : "Get More AI Recommendations"}
                  </PillButton>
                )}

                {aiError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {aiError}
                  </Alert>
                )}

                {/* Ideas list render */}
                {viewMode === "map" ? (
                  <Box sx={{ height: "420px", width: "100%", mb: 3 }}>
                    <ActivitiesMap
                      trip={trip!}
                      activities={filteredActivities}
                      activityPlacementsMap={activityPlacementsMap}
                      onUpdateActivityCoordinates={handleUpdateActivityCoordinates}
                      onSelectActivity={(act) => {
                        setSelectedActivity(act);
                        setDetailSheetOpen(true);
                      }}
                      onToggleSchedule={(act) => {
                        setSelectedActivity(act);
                        setAddToItineraryOpen(true);
                      }}
                      isReadOnly={isReadOnly}
                    />
                  </Box>
                ) : (
                  <Box sx={{ 
                    display: viewMode === "gallery" ? "grid" : "flex", 
                    gridTemplateColumns: viewMode === "gallery" ? "repeat(2, minmax(0, 1fr))" : undefined,
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
                                  {act.source === "AI Search" ? "Recommended" : "Collaborator"}
                                </Typography>
                              </Box>

                              {/* Heart Wishlist icon at top-right */}
                              <IconButton
                                id={`mobile-activity-heart-btn-${act.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleLikeActivity(act);
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
                                  fill={(localLikedIds.includes(act.id) || (currentUser && act.likes?.includes(currentUser.uid))) ? "#FF385C" : "none"}
                                  color={(localLikedIds.includes(act.id) || (currentUser && act.likes?.includes(currentUser.uid))) ? "#FF385C" : "#222222"}
                                />
                              </IconButton>
                            </Box>

                            {/* Content Meta Block */}
                            <Box sx={{ mt: 1 }}>
                              {/* Title (Full width for clean layout) */}
                              <Typography
                                onClick={() => {
                                  setSelectedActivity(act);
                                  setDetailSheetOpen(true);
                                }}
                                sx={{
                                  fontSize: "13px",
                                  fontWeight: 700,
                                  color: "#222222",
                                  cursor: "pointer",
                                  lineHeight: 1.3,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  fontFamily: "var(--font-sans)",
                                  "&:hover": { color: "#FF385C" },
                                }}
                              >
                                {act.title}
                              </Typography>

                              {/* Rating + Category Row */}
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 0.5, flexWrap: "wrap" }}>
                                {act.rating && (
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                                    <Star size={11} fill="#222222" color="#222222" />
                                    <Typography sx={{ fontSize: "11px", fontWeight: "bold", color: "#222222" }}>
                                      {act.rating}
                                    </Typography>
                                  </Box>
                                )}
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

                              {/* Location and Duration on a single row */}
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.8, overflow: "hidden" }}>
                                {act.location && (
                                  <Typography
                                    sx={{
                                      fontSize: "11px",
                                      color: "#6A6A6A",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 0.4,
                                      fontFamily: "var(--font-sans)",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    <MapPin size={10} style={{ color: "#6A6A6A", flexShrink: 0 }} />
                                    <span>{act.location}</span>
                                  </Typography>
                                )}
                                {act.estimatedDuration && (
                                  <Typography
                                    sx={{
                                      fontSize: "11px",
                                      color: "#6A6A6A",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 0.4,
                                      fontFamily: "var(--font-sans)",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Clock size={10} style={{ color: "#6A6A6A" }} />
                                    <span>{act.estimatedDuration}</span>
                                  </Typography>
                                )}
                              </Box>

                              {/* Action Button (Notes and creator attribution moved to detail view) */}
                              {!isReadOnly && (
                                <Box sx={{ mt: 1.2 }}>
                                  {scheduled ? (
                                    <PillButton
                                      id={`add-to-itinerary-btn-mobile-${act.id}`}
                                      size="sm"
                                      onClick={() => {
                                        setSelectedActivity(act);
                                        setAddToItineraryOpen(true);
                                      }}
                                      className="w-full justify-center !rounded-full border border-neutral-200 bg-[#f7f7f7] text-[#222222] hover:bg-[#ebebeb] py-1 text-xs"
                                    >
                                      Scheduled
                                    </PillButton>
                                  ) : (
                                    <PrimaryButton
                                      id={`add-to-itinerary-btn-mobile-${act.id}`}
                                      size="sm"
                                      onClick={() => {
                                        setSelectedActivity(act);
                                        setAddToItineraryOpen(true);
                                      }}
                                      className="w-full justify-center py-1.5 text-xs"
                                    >
                                      + Add to Trip
                                    </PrimaryButton>
                                  )}
                                </Box>
                              )}
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
                                
                                {act.rating && (
                                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.3, ml: 0.5, fontSize: "0.65rem", fontWeight: "bold", color: "#222222" }}>
                                    <Star size={9} fill="#222222" color="#222222" />
                                    <span>{act.rating}</span>
                                  </Box>
                                )}{" "}

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
                )}
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
              id="nav-ai-btn"
              label="Ai"
              value="ai"
              icon={<Sparkles size={20} />}
            />
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
          onAddToItinerary={async (act) => {
            setDetailSheetOpen(false);
            if (act.id && act.id.startsWith("preview-")) {
              const savedAct = await handleAddManualActivity({
                title: act.title,
                category: act.category,
                imageURL: act.imageURL,
                location: act.location,
                notes: act.notes,
                estimatedDuration: act.estimatedDuration,
                rating: act.rating,
                source: "AI Search",
                sourceDetail: "Grounded with Google Maps"
              });
              if (savedAct) {
                setSelectedActivity(savedAct);
              } else {
                setSelectedActivity(act);
              }
            } else {
              setSelectedActivity(act);
            }
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
