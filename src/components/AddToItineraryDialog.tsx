import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Typography,
} from "@mui/material";
import { Activity } from "../types";

interface AddToItineraryDialogProps {
  open: boolean;
  onClose: () => void;
  activity: Activity | null;
  days: string[];
  onConfirm: (day: string, startTime: string, endTime?: string) => void;
}

export default function AddToItineraryDialog({
  open,
  onClose,
  activity,
  days,
  onConfirm,
}: AddToItineraryDialogProps) {
  const [day, setDay] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    if (days.length > 0) {
      setDay(days[0]);
    }
  }, [days, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!day || !startTime) return;
    onConfirm(day, startTime, endTime || undefined);
    onClose();
  };

  if (!activity) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" id="add-to-itinerary-dialog">
      <DialogTitle sx={{ fontWeight: "bold", color: "primary.main" }}>
        Schedule in Itinerary
      </DialogTitle>
      
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Schedule <strong>{activity.title}</strong> in the master trip calendar.
          </Typography>

          <FormControl fullWidth required>
            <InputLabel id="itinerary-day-select-label">Select Day</InputLabel>
            <Select
              id="itinerary-day-select"
              labelId="itinerary-day-select-label"
              value={day}
              label="Select Day"
              onChange={(e) => setDay(e.target.value)}
            >
              {days.map((d) => (
                <MenuItem id={`day-choice-${d}`} key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              id="itinerary-start-time"
              label="Start Time"
              type="time"
              required
              fullWidth
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            
            <TextField
              id="itinerary-end-time"
              label="End Time (Optional)"
              type="time"
              fullWidth
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button id="cancel-schedule-btn" onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button id="submit-schedule-btn" type="submit" variant="contained" color="primary">
            Confirm & Schedule
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
