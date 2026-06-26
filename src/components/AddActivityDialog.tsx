import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  FormControl,
  InputLabel,
  Select,
  Typography,
} from "@mui/material";
import { getCategoryImage } from "../lib/images";
import { Activity } from "../types";
import { auth } from "../lib/firebase";
import RichTextEditor from "./RichTextEditor";
import { PrimaryButton, PillButton } from "./Button";

interface AddActivityDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (activityData: Partial<Activity>) => void;
  tripCustomCategories?: string[];
}

const STANDARD_CATEGORIES = ["Food", "Sightseeing", "Transit", "Shopping", "Event", "Work", "Rest"];

export default function AddActivityDialog({ 
  open, 
  onClose, 
  onAdd,
  tripCustomCategories = [] 
}: AddActivityDialogProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Sightseeing");
  const [customCategory, setCustomCategory] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState("");
  const [startTime, setStartTime] = useState("");
  const [imageURL, setImageURL] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Determine final category string
    const finalCategory = category === "__NEW_CUSTOM__" && customCategory.trim() 
      ? customCategory.trim() 
      : category;

    const creatorName = auth.currentUser?.displayName || "Collaborator";
    const creatorPhotoURL = auth.currentUser?.photoURL || undefined;

    const finalImageURL = imageURL.trim() || getCategoryImage(finalCategory, title);

    onAdd({
      title: title.trim(),
      category: finalCategory,
      imageURL: finalImageURL,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      estimatedDuration: duration.trim() || undefined,
      startTime: startTime.trim() || undefined,
      source: "Manual",
      createdBy: creatorName,
      createdByUserId: auth.currentUser?.uid,
      createdByPhotoURL: creatorPhotoURL,
    });

    // Reset Form
    setTitle("");
    setCategory("Sightseeing");
    setCustomCategory("");
    setLocation("");
    setNotes("");
    setDuration("");
    setStartTime("");
    setImageURL("");
    onClose();
  };

  // Combine standard and any existing custom categories
  const dropdownCategories = [
    ...STANDARD_CATEGORIES,
    ...tripCustomCategories.filter(cat => !STANDARD_CATEGORIES.includes(cat))
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      id="add-activity-dialog"
      slotProps={{
        paper: {
          sx: {
            borderRadius: "20px",
            p: 0.5,
            boxShadow: "0 12px 32px rgba(0,0,0,0.12)"
          }
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: "0.95rem", color: "#FF385C", pb: 0.5, px: 2 }}>
        Add Activity Idea
      </DialogTitle>
      
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, px: 2, py: 0.5 }}>
          <TextField
            id="activity-title"
            label="Activity Title"
            variant="outlined"
            fullWidth
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Visit Louvre, Dinner at Chez Janou"
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                fontSize: "0.85rem"
              }
            }}
          />

          <FormControl fullWidth>
            <InputLabel id="category-select-label" sx={{ fontSize: "0.85rem" }}>Category</InputLabel>
            <Select
              id="activity-category-select"
              labelId="category-select-label"
              value={category}
              label="Category"
              onChange={(e) => setCategory(e.target.value)}
              sx={{
                borderRadius: "10px",
                fontSize: "0.85rem"
              }}
            >
              {dropdownCategories.map((choice) => (
                <MenuItem id={`cat-choice-${choice}`} key={choice} value={choice}>
                  {choice}
                </MenuItem>
              ))}
              <MenuItem id="cat-choice-new-custom" value="__NEW_CUSTOM__" sx={{ fontStyle: "italic", fontWeight: "bold" }}>
                + Define Custom Category...
              </MenuItem>
            </Select>
          </FormControl>

          {category === "__NEW_CUSTOM__" && (
            <TextField
              id="custom-category-input"
              label="Custom Category Name"
              variant="outlined"
              fullWidth
              required
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="e.g. Hiking, Wine Tasting, Beach"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  fontSize: "0.85rem"
                }
              }}
            />
          )}

          <TextField
            id="activity-location"
            label="Location (Optional)"
            variant="outlined"
            fullWidth
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Louvre Museum, Paris"
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                fontSize: "0.85rem"
              }
            }}
          />

          <Box sx={{ display: "flex", gap: 1.5 }}>
            <TextField
              id="activity-duration"
              label="Estimated Duration (Optional)"
              variant="outlined"
              fullWidth
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 2 hours"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  fontSize: "0.85rem"
                }
              }}
            />

            <TextField
              id="activity-start-time"
              label="Start Time (Optional)"
              type="time"
              variant="outlined"
              fullWidth
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              placeholder="e.g. 10:00"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  fontSize: "0.85rem"
                }
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ mb: 0.5, color: "text.secondary", fontSize: "0.75rem", fontWeight: 600 }}>
              Notes & Description (Rich Text)
            </Typography>
            <RichTextEditor
              id="activity-notes"
              value={notes}
              onChange={setNotes}
              placeholder="Add formatting, lists, notes, or tips..."
            />
          </Box>

          <TextField
            id="activity-image-url"
            label="Custom Photo URL (Optional)"
            variant="outlined"
            fullWidth
            value={imageURL}
            onChange={(e) => setImageURL(e.target.value)}
            placeholder="Leave blank to auto-select a beautiful cover picture"
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                fontSize: "0.85rem"
              }
            }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 2, pt: 0.5 }}>
          <PillButton
            id="cancel-add-btn"
            onClick={onClose}
            size="sm"
          >
            Cancel
          </PillButton>
          <PrimaryButton
            id="submit-add-btn"
            type="submit"
            size="sm"
          >
            Save Idea
          </PrimaryButton>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
