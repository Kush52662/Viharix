import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Avatar,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Camera, X } from "lucide-react";
import { updateProfile, User as FirebaseUser } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
  currentUser: FirebaseUser | null;
  activeTripId?: string;
  onProfileUpdated: (displayName: string, photoURL?: string) => void;
}

export default function ProfileDialog({
  open,
  onClose,
  currentUser,
  activeTripId,
  onProfileUpdated,
}: ProfileDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || "");
      setPhotoURL(currentUser.photoURL || "");
      setError(null);
      setSuccess(false);
    }
  }, [currentUser, open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhotoURL(reader.result);
        setError(null);
      }
    };
    reader.onerror = () => {
      setError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!displayName.trim()) {
      setError("Display Name cannot be empty.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // 1. Update Firebase Auth Profile
      await updateProfile(currentUser, {
        displayName: displayName.trim(),
        photoURL: photoURL || "",
      });

      // 2. Save/Update Profile in central 'users' collection in Firestore
      const userRef = doc(db, "users", currentUser.uid);
      try {
        await setDoc(userRef, {
          displayName: displayName.trim(),
          photoURL: photoURL || "",
          email: currentUser.email || "",
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
      }

      // 3. If there is an active trip, update their collaborator information
      if (activeTripId) {
        const collabRef = doc(db, "trips", activeTripId, "collaborators", currentUser.uid);
        try {
          await setDoc(collabRef, {
            displayName: displayName.trim(),
            photoURL: photoURL || "",
            email: currentUser.email || "",
          }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `trips/${activeTripId}/collaborators/${currentUser.uid}`);
        }
      }

      // 4. Trigger state updates in parent
      onProfileUpdated(displayName.trim(), photoURL || undefined);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setError(err.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" id="profile-dialog">
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "bold", color: "primary.main" }}>
        Edit My Profile
        <IconButton onClick={onClose} size="small" id="close-profile-dialog">
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <Box component="form" onSubmit={handleSave}>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 1, pb: 2, alignItems: "center" }}>
          
          {/* Avatar Upload Container */}
          <Box sx={{ position: "relative" }}>
            <Avatar
              src={photoURL || undefined}
              sx={{
                width: 96,
                height: 96,
                fontSize: "2rem",
                bgcolor: "primary.main",
                border: "3px solid",
                borderColor: "primary.light",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
              }}
            >
              {displayName ? displayName[0].toUpperCase() : "U"}
            </Avatar>
            
            <label htmlFor="avatar-file-input">
              <input
                id="avatar-file-input"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <IconButton
                component="span"
                id="upload-avatar-btn"
                sx={{
                  position: "absolute",
                  bottom: -4,
                  right: -4,
                  bgcolor: "secondary.main",
                  color: "#FFFFFF",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  "&:hover": { bgcolor: "secondary.dark" },
                  p: 1
                }}
              >
                <Camera size={16} />
              </IconButton>
            </label>
          </Box>

          <Typography variant="caption" color="text.secondary" align="center">
            Click the camera icon to upload an optional profile picture
          </Typography>

          {error && <Alert severity="error" sx={{ width: "100%" }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ width: "100%" }}>Profile saved successfully!</Alert>}

          <TextField
            id="profile-display-name"
            label="Display Name"
            variant="outlined"
            fullWidth
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={saving}
          />
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button id="cancel-profile-btn" onClick={onClose} color="inherit" disabled={saving}>
            Cancel
          </Button>
          <Button
            id="submit-profile-btn"
            type="submit"
            variant="contained"
            color="primary"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
