import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Avatar,
  Tooltip,
  Divider,
  IconButton,
  Alert
} from "@mui/material";
import { X, Calendar, MapPin, Sparkles, Users, Edit2, Eye } from "lucide-react";
import { Trip, Collaborator } from "../types";

interface EditTripDialogProps {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  collaborators: Collaborator[];
  onSave: (updatedFields: Partial<Trip>) => Promise<void>;
  isReadOnly: boolean;
}

export const EditTripDialog: React.FC<EditTripDialogProps> = ({
  open,
  onClose,
  trip,
  collaborators,
  onSave,
  isReadOnly
}) => {
  const [name, setName] = useState(trip.name || "");
  const [destination, setDestination] = useState(trip.destination || "");
  const [startDate, setStartDate] = useState(trip.startDate || "");
  const [endDate, setEndDate] = useState(trip.endDate || "");
  const [context, setContext] = useState(trip.context || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state with trip prop when dialog opens or trip changes
  useEffect(() => {
    if (open && trip) {
      setName(trip.name || "");
      setDestination(trip.destination || "");
      setStartDate(trip.startDate || "");
      setEndDate(trip.endDate || "");
      setContext(trip.context || "");
      setError(null);
    }
  }, [open, trip]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Trip name cannot be empty");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        destination: destination.trim(),
        startDate,
        endDate,
        context: context.trim()
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update trip details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            borderRadius: "20px",
            p: 0.75,
            boxShadow: "0 12px 32px rgba(0,0,0,0.12)"
          }
        }
      }}
    >
      {/* Title / Header */}
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 0.5, px: 2 }}>
        <Typography sx={{ fontSize: "0.95rem", fontWeight: 700, fontFamily: "var(--font-sans)", color: "#111215" }}>
          Edit Trip Details
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: "text.secondary" }}>
          <X size={16} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2, py: 0.5 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1.5, borderRadius: "10px", py: 0, px: 1.5, fontSize: "0.8rem" }}>
            {error}
          </Alert>
        )}

        {/* --- EDIT FORM --- */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 0.5 }}>
          <TextField
            label="Trip Name"
            variant="outlined"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Summer in Tokyo"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                fontSize: "0.85rem"
              }
            }}
          />

          <TextField
            label="Destination"
            variant="outlined"
            fullWidth
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Kyoto, Japan"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                fontSize: "0.85rem"
              }
            }}
          />

          <Box sx={{ display: "flex", gap: 1.5, flexDirection: { xs: "column", sm: "row" } }}>
            <TextField
              label="Start Date"
              type="date"
              variant="outlined"
              fullWidth
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  fontSize: "0.85rem"
                }
              }}
            />
            <TextField
              label="End Date"
              type="date"
              variant="outlined"
              fullWidth
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  fontSize: "0.85rem"
                }
              }}
            />
          </Box>

          <TextField
            label="Trip Vibe / AI Guidelines"
            variant="outlined"
            fullWidth
            multiline
            rows={2}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g. Food tours, relaxed mornings, hiking excursions..."
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                fontSize: "0.85rem"
              }
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 1, pt: 0.5 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.82rem",
            borderRadius: "10px",
            px: 2,
            color: "text.secondary"
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading}
          sx={{
            textTransform: "none",
            fontWeight: 700,
            fontSize: "0.82rem",
            borderRadius: "10px",
            px: 2.5,
            bgcolor: "#FF385C",
            color: "#FFFFFF",
            "&:hover": { bgcolor: "#E00B41" }
          }}
        >
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
