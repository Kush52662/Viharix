export interface Trip {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  destination?: string;
  context?: string;
  shareCode: string;
  ownerId: string;
  customCategories?: string[];
  createdAt: any;
  updatedAt: any;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
}

export interface Collaborator {
  tripId: string;
  userId: string;
  displayName: string;
  email: string;
  role: "owner" | "editor";
  joinedAt: any;
  photoURL?: string;
}

export interface Activity {
  id: string;
  tripId: string;
  title: string;
  category: string;
  imageURL?: string;
  location?: string;
  notes?: string;
  estimatedDuration?: string;
  startTime?: string;
  source: "AI Search" | "Manual" | "Added by collaborator";
  rating?: string;
  media?: string[];
  sourceDetail?: string; // e.g. "Suggested by AI for Dinner", "Added by John"
  createdBy: string; // user display name or ID
  createdByUserId?: string;
  createdByPhotoURL?: string;
  createdAt: any;
  status: "active" | "archived";
  latitude?: number;
  longitude?: number;
  likes?: string[];
}

export interface ItineraryPlacement {
  id: string;
  tripId: string;
  activityId: string;
  day: string; // e.g., "Day 1", "Day 2" or specific date string "2026-06-23"
  startTime: string; // e.g., "09:00", "14:30"
  endTime?: string;
  sortOrder: number;
  addedBy: string; // user display name or ID
  addedByUserId?: string;
  addedByPhotoURL?: string;
  addedAt: any;
}
