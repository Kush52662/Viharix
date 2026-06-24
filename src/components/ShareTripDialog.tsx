import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Button,
  Paper,
  Divider,
} from "@mui/material";
import { X, Copy, Check, MessageSquare, Compass, Link as LinkIcon, Sparkles, MapPin, Calendar, Users } from "lucide-react";
import { Trip, Collaborator } from "../types";

interface ShareTripDialogProps {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  collaborators: Collaborator[];
}

export default function ShareTripDialog({
  open,
  onClose,
  trip,
  collaborators,
}: ShareTripDialogProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const tripLink = `${window.location.origin}/#trip=${trip.id}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(trip.shareCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(tripLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // WhatsApp Share pre-filled message
  const shareMessage = `Hey! 🌴 Check out our trip itinerary for *${trip.name}* ${
    trip.destination ? `to *${trip.destination}*` : ""
  } on *Viharix*! ✈️\n\nJoin as a planner or view the itinerary here:\n🔗 ${tripLink}\n\nInvite Code: *${trip.shareCode}*\n\nLet's plan this together! 🥳`;

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;

  // Format trip dates elegantly
  const dateStr = trip.startDate
    ? `${trip.startDate}${trip.endDate ? ` - ${trip.endDate}` : " (Flexible)"}`
    : "Flexible Dates";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "20px",
            p: { xs: 1, sm: 2 },
            overflowY: "auto",
          },
        },
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ m: 0, p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box sx={{ p: 0.75, borderRadius: "8px", bgcolor: "rgba(255, 56, 92, 0.08)", color: "#FF385C", display: "flex" }}>
            <Sparkles size={18} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.05rem", fontWeight: 800, color: "#222222", fontFamily: "var(--font-sans)" }}>
              Share & Invite Planners
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#6A6A6A", fontWeight: 500 }}>
              Let co-planners edit and schedule this trip in real-time
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: "#6A6A6A", "&:hover": { bgcolor: "#f7f7f7" } }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ borderTop: "1px solid #EBEBEB", borderBottom: "1px solid #EBEBEB", p: 2.5 }}>
        {/* Row 1: Invite Code & Trip Link */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 3 }}>
          {/* Share Code Section */}
          <Box>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#6A6A6A", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.75 }}>
              Co-Planner Share Code
            </Typography>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: "12px",
                border: "1px solid #EBEBEB",
                bgcolor: "#F8F9FA",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 1.5,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: "1.15rem", fontWeight: 800, color: "#FF385C", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
                  {trip.shareCode}
                </Typography>
                <Typography sx={{ fontSize: "0.7rem", color: "#6A6A6A", fontWeight: 500 }}>
                  Enter this code on the landing page to join
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={handleCopyCode}
                startIcon={copiedCode ? <Check size={14} /> : <Copy size={14} />}
                sx={{
                  borderRadius: "8px",
                  borderColor: copiedCode ? "#222222" : "#DDDDDD",
                  color: "#222222",
                  fontWeight: 600,
                  textTransform: "none",
                  fontSize: "0.78rem",
                  px: 1.5,
                  "&:hover": {
                    borderColor: "#222222",
                    bgcolor: "#F7F7F7",
                  },
                }}
              >
                {copiedCode ? "Copied" : "Copy Code"}
              </Button>
            </Paper>
          </Box>

          {/* Share Link Section */}
          <Box>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#6A6A6A", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.75 }}>
              Direct Access Link
            </Typography>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: "12px",
                border: "1px solid #EBEBEB",
                bgcolor: "#F8F9FA",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 1.5,
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: "0.82rem", color: "#222222", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tripLink}
                </Typography>
                <Typography sx={{ fontSize: "0.7rem", color: "#6A6A6A", fontWeight: 500 }}>
                  Directly view or join this trip online
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={handleCopyLink}
                startIcon={copiedLink ? <Check size={14} /> : <LinkIcon size={14} />}
                sx={{
                  borderRadius: "8px",
                  borderColor: copiedLink ? "#222222" : "#DDDDDD",
                  color: "#222222",
                  fontWeight: 600,
                  textTransform: "none",
                  fontSize: "0.78rem",
                  px: 1.5,
                  flexShrink: 0,
                  "&:hover": {
                    borderColor: "#222222",
                    bgcolor: "#F7F7F7",
                  },
                }}
              >
                {copiedLink ? "Copied" : "Copy Link"}
              </Button>
            </Paper>
          </Box>
        </Box>

        {/* WhatsApp Instant share button */}
        <Box sx={{ mb: 4 }}>
          <Button
            component="a"
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            fullWidth
            variant="contained"
            startIcon={<MessageSquare size={18} />}
            sx={{
              bgcolor: "#25D366",
              color: "#FFFFFF",
              fontWeight: 700,
              borderRadius: "10px",
              py: 1.2,
              textTransform: "none",
              boxShadow: "none",
              fontSize: "0.88rem",
              transition: "all 0.15s ease",
              "&:hover": {
                bgcolor: "#128C7E",
                boxShadow: "none",
              },
            }}
          >
            Share via WhatsApp
          </Button>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Social Share Preview Page mockup */}
        <Box>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 800, color: "#6A6A6A", textTransform: "uppercase", letterSpacing: "0.05em", mb: 1.5 }}>
            Social Invite Preview (What friends see)
          </Typography>

          <Paper
            elevation={0}
            sx={{
              borderRadius: "16px",
              border: "1px solid #EBEBEB",
              overflow: "hidden",
              bgcolor: "#FFFFFF",
              boxShadow: "0 6px 16px rgba(0,0,0,0.05)",
            }}
          >
            {/* Header Visual */}
            <Box
              sx={{
                height: 140,
                position: "relative",
                background: "linear-gradient(135deg, #FF385C 0%, #FF8F6B 100%)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                p: 2.5,
              }}
            >
              {/* Branding watermark */}
              <Box
                sx={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: "20px",
                  bgcolor: "rgba(255,255,255,0.25)",
                  backdropFilter: "blur(4px)",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                <Compass size={12} style={{ color: "#FFFFFF" }} />
                <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.02em" }}>
                  VIHARIX
                </Typography>
              </Box>

              <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#FFFFFF", lineHeight: 1.25, mb: 0.5, textShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                {trip.name}
              </Typography>
            </Box>

            {/* Preview Card Details */}
            <Box sx={{ p: 2.5 }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mb: 2 }}>
                {/* Destination if any */}
                {trip.destination && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#222222" }}>
                    <MapPin size={15} className="text-[#FF385C]" />
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: 600 }}>
                      {trip.destination}
                    </Typography>
                  </Box>
                )}

                {/* Date */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#6A6A6A" }}>
                  <Calendar size={15} />
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 500 }}>
                    {dateStr}
                  </Typography>
                </Box>

                {/* Collaborators counter */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#6A6A6A" }}>
                  <Users size={15} />
                  <Typography sx={{ fontSize: "0.78rem", fontWeight: 500 }}>
                    {collaborators.length} active {collaborators.length === 1 ? "planner" : "planners"} on this trip
                  </Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  py: 1,
                  px: 1.5,
                  borderRadius: "10px",
                  bgcolor: "#F7F7F7",
                  border: "1px dashed #DDDDDD",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#222222" }}>
                  Join code ready
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 800, color: "#FF385C" }}>
                  {trip.shareCode}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
