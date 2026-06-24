import React, { useState, useEffect } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Tooltip,
} from "@mui/material";
import { 
  X, 
  MapPin, 
  Clock, 
  Info, 
  Calendar, 
  Sparkles, 
  User, 
  Trash2, 
  Edit, 
  Save, 
  Clock3 
} from "lucide-react";
import { Activity, ItineraryPlacement } from "../types";
import { CATEGORY_COLORS } from "../lib/images";
import RichTextEditor from "./RichTextEditor";

interface ActivityDetailSheetProps {
  activity: Activity | null;
  placement: ItineraryPlacement | null;
  open: boolean;
  onClose: () => void;
  onAddToItinerary: (activity: Activity) => void;
  onRemoveFromItinerary: (placement: ItineraryPlacement) => void;
  onArchiveActivity: (activity: Activity) => void;
  isReadOnly: boolean;
  tripCustomCategories?: string[];
  onUpdateActivity?: (activityId: string, updatedFields: Partial<Activity>) => Promise<void>;
  onUpdatePlacement?: (placementId: string, updatedFields: Partial<ItineraryPlacement>) => Promise<void>;
}

const STANDARD_CATEGORIES = ["Food", "Sightseeing", "Transit", "Shopping", "Event", "Work", "Rest"];

export default function ActivityDetailSheet({
  activity,
  placement,
  open,
  onClose,
  onAddToItinerary,
  onRemoveFromItinerary,
  onArchiveActivity,
  isReadOnly,
  tripCustomCategories = [],
  onUpdateActivity,
  onUpdatePlacement,
}: ActivityDetailSheetProps) {
  if (!activity) return null;

  const [isEditing, setIsEditing] = useState(false);
  
  // Editing state variables
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCustomCategory, setEditCustomCategory] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync state with selected activity
  useEffect(() => {
    if (activity) {
      setEditTitle(activity.title || "");
      
      const isCustomChoice = !STANDARD_CATEGORIES.includes(activity.category);
      if (isCustomChoice) {
        setEditCategory("__EXISTING_CUSTOM__");
        setEditCustomCategory(activity.category);
      } else {
        setEditCategory(activity.category || "Sightseeing");
        setEditCustomCategory("");
      }
      
      setEditLocation(activity.location || "");
      setEditDuration(activity.estimatedDuration || "");
      setEditStartTime(activity.startTime || "");
      setEditNotes(activity.notes || "");
      setIsEditing(false);
    }
  }, [activity, open]);

  const colors = CATEGORY_COLORS[activity.category] || CATEGORY_COLORS.Custom;

  // Combine standard categories and existing trip custom categories
  const dropdownCategories = [
    ...STANDARD_CATEGORIES,
    ...tripCustomCategories.filter(cat => !STANDARD_CATEGORIES.includes(cat))
  ];

  const handleSave = async () => {
    if (!activity || !onUpdateActivity) return;
    if (!editTitle.trim()) return;

    setSaving(true);
    try {
      let finalCategory = editCategory;
      if (editCategory === "__NEW_CUSTOM__") {
        finalCategory = editCustomCategory.trim();
      } else if (editCategory === "__EXISTING_CUSTOM__") {
        finalCategory = editCustomCategory.trim();
      }

      const updatedFields: Partial<Activity> = {
        title: editTitle.trim(),
        category: finalCategory,
        location: editLocation.trim() || undefined,
        estimatedDuration: editDuration.trim() || undefined,
        startTime: editStartTime.trim() || undefined,
        notes: editNotes.trim() || undefined,
      };

      // 1. Update activity in Firestore
      await onUpdateActivity(activity.id, updatedFields);

      // 2. If it is scheduled, and we modified the start time, update the placement as well!
      if (placement && onUpdatePlacement && editStartTime.trim() !== (activity.startTime || "")) {
        await onUpdatePlacement(placement.id, {
          startTime: editStartTime.trim()
        });
      }

      setIsEditing(false);
    } catch (error) {
      console.error("Error saving activity edits:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          id: "activity-detail-sheet",
          sx: {
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "90vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxWidth: 600,
            mx: "auto",
          },
        },
      }}
    >
      {/* Visual Header Banner */}
      <Box sx={{ position: "relative", height: 180, flexShrink: 0 }}>
        <img
          src={activity.imageURL}
          alt={activity.title}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.src = `https://picsum.photos/seed/${activity.id || 'activity'}/600/400`;
          }}
        />
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.7) 100%)",
          }}
        />

        {/* Close button */}
        <IconButton
          id="detail-close-btn"
          onClick={onClose}
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            bgcolor: "rgba(0,0,0,0.5)",
            color: "#FFFFFF",
            "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
          }}
        >
          <X size={20} />
        </IconButton>

        {/* Floating Category Badge */}
        {!isEditing && (
          <Chip
            label={activity.category}
            size="small"
            sx={{
              position: "absolute",
              bottom: 16,
              left: 16,
              bgcolor: colors.primary,
              color: "#FFFFFF",
              fontWeight: "bold",
              fontSize: "0.75rem",
            }}
          />
        )}
      </Box>

      {/* Main Content Body */}
      <Box sx={{ p: 3, overflowY: "auto", flexGrow: 1, display: "flex", flexDirection: "column", gap: 2.5 }}>
        
        {isEditing ? (
          /* --- EDITING MODE FORM --- */
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: "bold", color: "primary.main" }}>
              Edit Activity Details
            </Typography>

            <TextField
              label="Activity Title"
              variant="outlined"
              fullWidth
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              disabled={saving}
            />

            <FormControl fullWidth>
              <InputLabel id="edit-category-label">Category</InputLabel>
              <Select
                labelId="edit-category-label"
                value={editCategory}
                label="Category"
                onChange={(e) => setEditCategory(e.target.value)}
                disabled={saving}
              >
                {dropdownCategories.map((choice) => (
                  <MenuItem key={choice} value={choice}>
                    {choice}
                  </MenuItem>
                ))}
                {editCategory === "__EXISTING_CUSTOM__" && (
                  <MenuItem value="__EXISTING_CUSTOM__">
                    {editCustomCategory} (Current Custom)
                  </MenuItem>
                )}
                <MenuItem value="__NEW_CUSTOM__" sx={{ fontStyle: "italic", fontWeight: "bold" }}>
                  + Define Custom Category...
                </MenuItem>
              </Select>
            </FormControl>

            {editCategory === "__NEW_CUSTOM__" && (
              <TextField
                label="New Custom Category Name"
                variant="outlined"
                fullWidth
                required
                value={editCustomCategory}
                onChange={(e) => setEditCustomCategory(e.target.value)}
                placeholder="e.g. Hiking, Wellness"
                disabled={saving}
              />
            )}

            <TextField
              label="Location (Optional)"
              variant="outlined"
              fullWidth
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              placeholder="e.g. Louvre Museum, Paris"
              disabled={saving}
            />

            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Estimated Duration"
                variant="outlined"
                fullWidth
                value={editDuration}
                onChange={(e) => setEditDuration(e.target.value)}
                placeholder="e.g. 2 hours"
                disabled={saving}
              />

              <TextField
                label="Start Time"
                type="time"
                variant="outlined"
                fullWidth
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                disabled={saving}
              />
            </Box>

            <Box>
              <Typography variant="body2" sx={{ mb: 1, color: "text.secondary", fontWeight: "medium" }}>
                Notes & Tips (Rich Text)
              </Typography>
              <RichTextEditor
                value={editNotes}
                onChange={setEditNotes}
                placeholder="Add rich text description or tips here..."
              />
            </Box>

            <Box sx={{ display: "flex", gap: 1.5, mt: 1 }}>
              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                onClick={() => setIsEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleSave}
                disabled={saving}
                startIcon={<Save size={16} />}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </Box>
          </Box>
        ) : (
          /* --- VIEWING MODE --- */
          <>
            {/* Title & Edit Button Header */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography id="detail-title" variant="h5" color="text.primary" sx={{ fontWeight: "bold", wordBreak: "break-word" }}>
                  {activity.title}
                </Typography>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 1, flexWrap: "wrap" }}>
                  {/* Creator and profile section */}
                  <Chip
                    id="detail-source-badge"
                    avatar={
                      activity.createdByPhotoURL ? (
                        <Avatar src={activity.createdByPhotoURL} />
                      ) : (
                        <Avatar sx={{ bgcolor: "primary.main", color: "#FFFFFF" }}>
                          {activity.createdBy ? activity.createdBy[0].toUpperCase() : "U"}
                        </Avatar>
                      )
                    }
                    label={activity.source === "AI Search" ? "AI Recommendation" : `By ${activity.createdBy || "Collaborator"}`}
                    size="small"
                    variant="outlined"
                    sx={{ borderColor: "rgba(15, 118, 110, 0.3)", bgcolor: "rgba(15, 118, 110, 0.03)" }}
                  />
                  {activity.estimatedDuration && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
                      <Clock size={14} />
                      <Typography variant="caption">{activity.estimatedDuration}</Typography>
                    </Box>
                  )}
                  {activity.startTime && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
                      <Clock3 size={14} style={{ color: "#6A6A6A" }} />
                      <Typography variant="caption">Starts: {activity.startTime}</Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              {!isReadOnly && onUpdateActivity && (
                <IconButton
                  id="detail-edit-toggle-btn"
                  onClick={() => setIsEditing(true)}
                  color="primary"
                  sx={{ bgcolor: "rgba(255,56,92,0.06)", "&:hover": { bgcolor: "rgba(255,56,92,0.12)" } }}
                  title="Edit Activity Details"
                >
                  <Edit size={18} />
                </IconButton>
              )}
            </Box>

            <Divider />

            {/* Details Fields: Location, Start Time, and Scheduled Status */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {activity.location && (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                  <MapPin size={18} style={{ color: "#FF385C" }} className="mt-0.5" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">LOCATION</Typography>
                    <Typography id="detail-location" variant="body2" color="text.primary" sx={{ fontWeight: "medium" }}>
                      {activity.location}
                    </Typography>
                  </Box>
                </Box>
              )}

              {placement ? (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, bgcolor: "#F7F7F7", border: "1px solid #EBEBEB", p: 1.5, borderRadius: 2 }}>
                  <Calendar size={18} style={{ color: "#FF385C" }} className="mt-0.5" />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: "bold" }}>SCHEDULED IN MASTER PLAN</Typography>
                    <Typography id="detail-schedule" variant="body2" color="text.primary" sx={{ fontWeight: "bold" }}>
                      {placement.day} at {placement.startTime}
                    </Typography>
                    {placement.endTime && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        Ends around {placement.endTime}
                      </Typography>
                    )}
                    {placement.addedBy && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Scheduled by:</Typography>
                        {placement.addedByPhotoURL ? (
                          <Avatar src={placement.addedByPhotoURL} sx={{ width: 16, height: 16 }} />
                        ) : null}
                        <Typography variant="caption" color="text.primary" sx={{ fontWeight: "medium" }}>
                          {placement.addedBy}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, p: 1.5, border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
                  <Info size={18} className="text-gray-400 mt-0.5" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">STATUS</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: "medium" }}>
                      Currently in your idea pool. Tap below to schedule.
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>

            {/* Notes / Description (Rich Text Safe Render) */}
            {activity.notes && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: "bold" }}>NOTES & TIPS</Typography>
                <Box 
                  id="detail-notes" 
                  className="rich-text-content"
                  sx={{ 
                    bgcolor: "rgba(255, 56, 92, 0.03)", 
                    p: 2, 
                    borderRadius: 3, 
                    borderLeft: "4px solid #FF385C",
                    "& ul": { listStyleType: "disc", pl: 2, my: 0.5 },
                    "& ol": { listStyleType: "decimal", pl: 2, my: 0.5 },
                    "& p": { my: 0.5 },
                  }}
                  dangerouslySetInnerHTML={{ __html: activity.notes }}
                />
              </Box>
            )}

            {/* Spacer */}
            <Box sx={{ flexGrow: 1 }} />

            {/* Action Controls */}
            {!isReadOnly ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 1 }}>
                {placement ? (
                  <Button
                    id="detail-unschedule-btn"
                    variant="outlined"
                    color="error"
                    fullWidth
                    onClick={() => {
                      onRemoveFromItinerary(placement);
                      onClose();
                    }}
                    sx={{ py: 1.2 }}
                  >
                    Remove from Itinerary
                  </Button>
                ) : (
                  <Button
                    id="detail-schedule-btn"
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={() => {
                      onAddToItinerary(activity);
                    }}
                    sx={{ py: 1.2 }}
                  >
                    Add to Itinerary Plan
                  </Button>
                )}

                <Button
                  id="detail-archive-btn"
                  variant="text"
                  color="error"
                  size="small"
                  startIcon={<Trash2 size={16} />}
                  onClick={() => {
                    onArchiveActivity(activity);
                    onClose();
                  }}
                  sx={{ alignSelf: "center", mt: 0.5 }}
                >
                  Archive & Remove Idea
                </Button>
              </Box>
            ) : (
              <Box sx={{ textAlign: "center", bgcolor: "rgba(0,0,0,0.03)", py: 1.5, px: 2, borderRadius: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: "medium" }}>
                  You are in View-Only Guest mode. Sign In to edit or organize this itinerary.
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
}
