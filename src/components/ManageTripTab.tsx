import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Avatar,
  Paper,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import { 
  Users, 
  Check, 
  Shield, 
  UserCheck, 
  Share2, 
  Compass, 
  Settings, 
  Calendar, 
  MapPin,
  Sparkles,
  Trash2,
  Activity as ActivityIcon
} from "lucide-react";
import { Collaborator, Trip, Activity, ItineraryPlacement } from "../types";
import { DestructiveButton, PillButton } from "./Button";
import { User as FirebaseUser } from "firebase/auth";
import { motion } from "motion/react";

interface ManageTripTabProps {
  trip: Trip;
  collaborators: Collaborator[];
  currentUser: FirebaseUser | null;
  onCopyCode: () => void;
  copied: boolean;
  onEditTrip: () => void;
  onDeleteTrip?: () => void;
  activities?: Activity[];
  placements?: ItineraryPlacement[];
}

export default function ManageTripTab({
  trip,
  collaborators,
  currentUser,
  onCopyCode,
  copied,
  onEditTrip,
  onDeleteTrip,
  activities = [],
  placements = []
}: ManageTripTabProps) {
  const isOwner = currentUser && trip.ownerId === currentUser.uid;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Calculate trip duration (Total Days)
  const totalDays = useMemo(() => {
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

  // 2. Total scheduled activities (placements)
  const totalScheduled = useMemo(() => {
    return placements ? placements.length : 0;
  }, [placements]);

  // 3. Activity density per day
  const density = useMemo(() => {
    return totalDays > 0 ? totalScheduled / totalDays : 0;
  }, [totalScheduled, totalDays]);

  // 4. Progress percent (e.g. 100% means we have planned 2 activities per day)
  const progressPercent = useMemo(() => {
    if (totalDays <= 0) return 0;
    // Let's assume 2 planned activities per day represents 100% progress
    const ratio = totalScheduled / (totalDays * 2); 
    return Math.min(100, Math.round(ratio * 100));
  }, [totalScheduled, totalDays]);

  // 5. Dynamic Pace Evaluation
  const paceInfo = useMemo(() => {
    if (totalScheduled === 0) {
      return {
        label: "Blank Slate",
        color: "#64748B",
        bgColor: "rgba(100, 116, 139, 0.08)",
        borderColor: "rgba(100, 116, 139, 0.2)",
        description: "No activities scheduled yet! Go to the Itinerary page to begin adding ideas to your trip timeline."
      };
    }
    if (density < 1) {
      return {
        label: "Relaxed Pace",
        color: "#0284C7",
        bgColor: "rgba(2, 132, 199, 0.08)",
        borderColor: "rgba(2, 132, 199, 0.2)",
        description: "A leisurely pace with plenty of free time. Great for an easygoing, restful vacation!"
      };
    }
    if (density <= 3) {
      return {
        label: "Perfect Balance",
        color: "#16A34A",
        bgColor: "rgba(22, 163, 74, 0.08)",
        borderColor: "rgba(22, 163, 74, 0.2)",
        description: "Perfect blend of structured exploration and relaxing downtime. Highly recommended!"
      };
    }
    return {
      label: "Action-Packed",
      color: "#9333EA",
      bgColor: "rgba(147, 51, 234, 0.08)",
      borderColor: "rgba(147, 51, 234, 0.2)",
      description: "A dense schedule full of sights and sounds! Get ready for a high-energy adventure."
    };
  }, [totalScheduled, density]);

  // 6. Category Breakdown of Scheduled Activities
  const categoryStats = useMemo(() => {
    if (!activities || !placements) return [];
    const counts: Record<string, number> = {};
    placements.forEach((p) => {
      const act = activities.find((a) => a.id === p.activityId);
      if (act && act.category) {
        counts[act.category] = (counts[act.category] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [activities, placements]);

  const handleDeleteConfirm = async () => {
    if (onDeleteTrip) {
      setIsDeleting(true);
      try {
        await onDeleteTrip();
      } catch (err) {
        console.error("Failed to delete trip:", err);
      } finally {
        setIsDeleting(false);
        setDeleteDialogOpen(false);
      }
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", py: { xs: 1.5, sm: 3 }, px: { xs: 1, sm: 2 } }}>
      
      {/* Consistent Page Title */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, px: 0.5 }}>
        <Typography variant="subtitle1" color="primary" sx={{ fontWeight: "bold" }}>
          Manage Trip
        </Typography>
      </Box>



      {/* 1. Clean Trip Profile Dashboard Header */}
      <Paper
        id="manage-trip-profile-card"
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: "16px",
          bgcolor: "#FFFFFF",
          border: "1px solid #EBEBEB",
          mb: 3,
          boxShadow: "rgba(0, 0, 0, 0.03) 0px 4px 12px"
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, color: "#222222", fontFamily: "var(--font-sans)" }}>
            Trip Overview
          </Typography>
          <Button
            id="manage-trip-edit-btn"
            variant="outlined"
            size="small"
            onClick={onEditTrip}
            startIcon={<Settings size={14} />}
            sx={{
              borderRadius: "20px",
              borderColor: "#dddddd",
              color: "#222222",
              fontWeight: 700,
              fontSize: "0.78rem",
              textTransform: "none",
              py: 0.6,
              px: 1.8,
              "&:hover": {
                borderColor: "#222222",
                bgcolor: "#f7f7f7"
              }
            }}
          >
            Edit Details
          </Button>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
          {/* Trip Name Banner */}
          <Box sx={{ p: 1.5, bgcolor: "#F8F9FA", borderRadius: "12px", border: "1px solid #E9ECEF" }}>
            <Typography sx={{ color: "text.secondary", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", mb: 0.25 }}>
              Current Trip Name
            </Typography>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, color: "#111215", fontFamily: "var(--font-sans)" }}>
              {trip.name}
            </Typography>
          </Box>

          {/* Destination Panel */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 0.5 }}>
            <Box sx={{ p: 0.75, borderRadius: "8px", bgcolor: "rgba(255, 56, 92, 0.08)", color: "#FF385C", display: "flex" }}>
              <MapPin size={16} />
            </Box>
            <Box>
              <Typography sx={{ color: "text.secondary", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Destination
              </Typography>
              <Typography sx={{ color: "#111215", fontSize: "0.82rem", fontWeight: 600, mt: 0.1 }}>
                {trip.destination || "Flexible Destination"}
              </Typography>
            </Box>
          </Box>

          {/* Dates Panel */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 0.5 }}>
            <Box sx={{ p: 0.75, borderRadius: "8px", bgcolor: "rgba(255, 56, 92, 0.08)", color: "#FF385C", display: "flex" }}>
              <Calendar size={16} />
            </Box>
            <Box>
              <Typography sx={{ color: "text.secondary", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Planned Dates
              </Typography>
              <Typography sx={{ color: "#111215", fontSize: "0.82rem", fontWeight: 600, mt: 0.1 }}>
                {trip.startDate ? `${trip.startDate} - ${trip.endDate || "Flexible"}` : "Flexible dates"}
              </Typography>
            </Box>
          </Box>

          {/* Trip Vibe Panel */}
          {trip.context && (
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, px: 0.5 }}>
              <Box sx={{ p: 0.75, borderRadius: "8px", bgcolor: "rgba(255, 56, 92, 0.08)", color: "#FF385C", display: "flex", mt: 0.25 }}>
                <Sparkles size={16} />
              </Box>
              <Box>
                <Typography sx={{ color: "text.secondary", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Trip Style & Preferences
                </Typography>
                <Typography sx={{ color: "#111215", fontSize: "0.82rem", fontWeight: 500, mt: 0.2, lineHeight: 1.4 }}>
                  {trip.context}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Paper>

      {/* 2. Collaboration Header card */}
      <Paper
        id="members-header-card"
        elevation={0}
        sx={{
          p: 2,
          borderRadius: "16px",
          bgcolor: "#F7F7F7",
          border: "1px solid #EBEBEB",
          mb: 2.5,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          gap: 1.5
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: "10px",
              bgcolor: "rgba(255, 56, 92, 0.08)",
              color: "#FF385C",
              display: "flex",
              alignItems: "center"
            }}
          >
            <Users size={18} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: "#222222", fontFamily: "var(--font-sans)" }}>
              Trip Collaboration
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#6A6A6A", fontWeight: 500 }}>
              {collaborators.length} {collaborators.length === 1 ? "planner active" : "planners active"}
            </Typography>
          </Box>
        </Box>

        <Button
          id="members-share-code-btn"
          variant="contained"
          onClick={onCopyCode}
          startIcon={copied ? <Check size={14} /> : <Share2 size={14} />}
          sx={{
            borderRadius: "16px",
            py: 0.6,
            px: 2,
            bgcolor: "#FF385C",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: "0.78rem",
            textTransform: "none",
            boxShadow: "none",
            "&:hover": {
              bgcolor: "#E00B41",
              boxShadow: "none"
            }
          }}
        >
          {copied ? "Copied Code!" : `Invite Planners`}
        </Button>
      </Paper>

      {/* 3. Main Members List Card */}
      <Paper
        id="members-list-card"
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: "16px",
          border: "1px solid #EBEBEB",
          bgcolor: "#FFFFFF"
        }}
      >
        <Typography
          id="members-list-title"
          sx={{
            fontSize: "0.95rem",
            fontWeight: 800,
            color: "#222222",
            fontFamily: "var(--font-sans)",
            mb: 2,
            letterSpacing: "-0.01em"
          }}
        >
          Active Planners List
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {collaborators.map((c) => {
            const isMe = currentUser && c.userId === currentUser.uid;
            const displayName = c.displayName || (isMe ? "You" : "Traveler");
            const roleLabel = c.role === "owner" ? "Host" : "Planner";

            return (
              <Box
                key={c.userId}
                id={`member-row-${c.userId}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "transform 0.15s ease",
                  gap: 1.5,
                  pb: 1.5,
                  borderBottom: "1px solid #F1F5F9",
                  "&:last-child": {
                    borderBottom: "none",
                    pb: 0
                  }
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, flex: 1 }}>
                  <Avatar
                    id={`member-avatar-${c.userId}`}
                    src={c.photoURL}
                    {...({ referrerPolicy: "no-referrer" } as any)}
                    sx={{
                      width: 40,
                      height: 40,
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      bgcolor: c.role === "owner" ? "#FF385C" : "#008489",
                      color: "#FFFFFF",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
                    }}
                  >
                    {c.displayName ? c.displayName[0].toUpperCase() : "T"}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.25 }}>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          color: "#222222",
                          fontSize: "0.95rem",
                          lineHeight: 1.2,
                          fontFamily: "var(--font-sans)"
                        }}
                      >
                        {displayName}
                      </Typography>
                      {isMe && (
                        <Box
                          sx={{
                            px: 0.6,
                            py: 0.1,
                            borderRadius: "4px",
                            bgcolor: "rgba(0,0,0,0.05)",
                            color: "#6A6A6A",
                            fontSize: "0.6rem",
                            fontWeight: 800,
                            textTransform: "uppercase"
                          }}
                        >
                          You
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, sm: { alignItems: "center" }, gap: { xs: 0.25, sm: 1 }, color: "#717171" }}>
                      <Box
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.35,
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: c.role === "owner" ? "#FF385C" : "#008489"
                        }}
                      >
                        {c.role === "owner" ? (
                          <Shield size={11} />
                        ) : (
                          <UserCheck size={11} />
                        )}
                        <span>{roleLabel}</span>
                      </Box>
                      <Typography sx={{ fontSize: "0.75rem", color: "#8E8E8E", display: { xs: "none", sm: "block" } }}>•</Typography>
                      <Typography sx={{ fontSize: "0.75rem", color: "#6A6A6A", wordBreak: "break-all" }}>
                        {c.email}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Paper>

      {/* 4. Danger Zone - Exposed Only to Trip Owner/Creator */}
      {isOwner && (
        <Paper
          id="danger-zone-card"
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: "16px",
            bgcolor: "#FFF8F9",
            border: "1px solid #FFE3E3",
            mt: 3,
            mb: 1
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Box sx={{ color: "#FF385C", display: "flex" }}>
              <Trash2 size={18} />
            </Box>
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 800, color: "#D32F2F", fontFamily: "var(--font-sans)" }}>
              Danger Zone
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: "#6A6A6A", mb: 2, fontSize: "0.82rem" }}>
            Once you delete this trip, there is no going back. This will permanently delete the itinerary, all planned activities, and revoke access for all active planners.
          </Typography>
          <Button
            id="delete-trip-btn"
            variant="contained"
            color="error"
            onClick={() => setDeleteDialogOpen(true)}
            startIcon={<Trash2 size={15} />}
            sx={{
              borderRadius: "12px",
              py: 1,
              px: 3,
              bgcolor: "#D32F2F",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: "0.8rem",
              textTransform: "none",
              boxShadow: "none",
              "&:hover": {
                bgcolor: "#B71C1C",
                boxShadow: "none"
              }
            }}
          >
            Delete This Trip
          </Button>
        </Paper>
      )}

      {/* Deletion Confirmation Dialog */}
      <Dialog
        id="delete-trip-dialog"
        open={deleteDialogOpen}
        onClose={() => !isDeleting && setDeleteDialogOpen(false)}
        aria-labelledby="delete-trip-dialog-title"
        aria-describedby="delete-trip-dialog-description"
        slotProps={{
          paper: {
            sx: {
              borderRadius: "20px",
              p: 1,
              maxWidth: "440px"
            }
          }
        }}
      >
        <DialogTitle id="delete-trip-dialog-title" sx={{ fontWeight: 800, fontSize: "1.1rem" }}>
          Delete Trip?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-trip-dialog-description" sx={{ color: "#222222", fontSize: "0.88rem", lineHeight: 1.5 }}>
            Are you sure you want to delete <strong>{trip.name}</strong>? This action is permanent and cannot be undone. All activities and active collaboration invites will be lost.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <PillButton 
            onClick={() => setDeleteDialogOpen(false)} 
            disabled={isDeleting}
            size="sm"
          >
            Cancel
          </PillButton>
          <DestructiveButton 
            onClick={handleDeleteConfirm} 
            disabled={isDeleting}
            size="sm"
          >
            {isDeleting ? "Deleting..." : "Delete Permanently"}
          </DestructiveButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
