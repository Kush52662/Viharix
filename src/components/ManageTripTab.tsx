import React from "react";
import {
  Box,
  Typography,
  Avatar,
  Paper,
  Divider,
  Button,
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
  Sparkles
} from "lucide-react";
import { Collaborator, Trip } from "../types";
import { User as FirebaseUser } from "firebase/auth";

interface ManageTripTabProps {
  trip: Trip;
  collaborators: Collaborator[];
  currentUser: FirebaseUser | null;
  onCopyCode: () => void;
  copied: boolean;
  onEditTrip: () => void;
}

export default function ManageTripTab({
  trip,
  collaborators,
  currentUser,
  onCopyCode,
  copied,
  onEditTrip
}: ManageTripTabProps) {
  const isOwner = currentUser && trip.ownerId === currentUser.uid;

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", py: { xs: 1.5, sm: 3 }, px: { xs: 1, sm: 2 } }}>
      
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
                  Trip Vibe & AI Context
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
            const displayName = isMe ? "You" : c.displayName || "Traveler";
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
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Avatar
                    id={`member-avatar-${c.userId}`}
                    src={c.photoURL}
                    sx={{
                      width: 36,
                      height: 36,
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      bgcolor: c.role === "owner" ? "#FF385C" : "#008489",
                      color: "#FFFFFF",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
                    }}
                  >
                    {c.displayName ? c.displayName[0].toUpperCase() : "T"}
                  </Avatar>
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography
                        sx={{
                          fontWeight: isMe ? 700 : 600,
                          color: "#222222",
                          fontSize: "0.85rem"
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
                    <Typography
                      sx={{
                        color: "#6A6A6A",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        mt: 0.05,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.35
                      }}
                    >
                      {c.role === "owner" ? (
                        <Shield size={11} className="text-[#FF385C]" />
                      ) : (
                        <UserCheck size={11} className="text-[#008489]" />
                      )}
                      <span>{roleLabel}</span>
                    </Typography>
                  </Box>
                </Box>

                {/* Additional metadata info (email / role badge) */}
                <Box sx={{ textAlign: "right" }}>
                  <Typography sx={{ color: "#9A9A9A", fontSize: "0.72rem" }}>
                    {c.email}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}
