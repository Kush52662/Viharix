import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Avatar,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  Paper,
  Divider,
} from "@mui/material";
import { Camera, LogOut, Compass, LogIn, User, Award, Check } from "lucide-react";
import { updateProfile, User as FirebaseUser } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";

interface ProfileTabProps {
  currentUser: FirebaseUser | null;
  activeTripId?: string;
  onProfileUpdated: (displayName: string, photoURL?: string) => void;
  onShowAuth: () => void;
  onSignOut: () => void;
}

export default function ProfileTab({
  currentUser,
  activeTripId,
  onProfileUpdated,
  onShowAuth,
  onSignOut,
}: ProfileTabProps) {
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
  }, [currentUser]);

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

      // 3. If there is an active trip, update collaborator info
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
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setError(err.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) {
    return (
      <Box sx={{ py: { xs: 4, md: 8 }, px: 2, display: "flex", justifyContent: "center", alignItems: "center", width: "100%" }}>
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            maxWidth: 400,
            p: { xs: 3, sm: 4 },
            borderRadius: "20px",
            border: "1px solid #E3E4E6",
            textAlign: "center",
            boxShadow: "rgba(0, 0, 0, 0.02) 0px 4px 12px",
          }}
        >
          <Box sx={{ width: 64, height: 64, borderRadius: "50%", bgcolor: "#FFF8F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#FF385C", mx: "auto", mb: 2 }}>
            <User size={32} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, fontFamily: "var(--font-sans)", color: "#111215" }}>
            My Travel Profile
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            Sign in to customize your traveler details, track your active itineraries, and collaborate on trips in real time.
          </Typography>
          <Button
            id="profile-tab-signin-btn"
            variant="contained"
            onClick={onShowAuth}
            startIcon={<LogIn size={18} />}
            sx={{
              width: "100%",
              py: 1.5,
              borderRadius: "30px",
              bgcolor: "#FF385C",
              fontWeight: 700,
              textTransform: "none",
              boxShadow: "none",
              "&:hover": {
                bgcolor: "#E00B41",
                boxShadow: "none",
              },
            }}
          >
            Sign In / Register
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ py: { xs: 4, md: 6 }, px: 2, display: "flex", justifyContent: "center", alignItems: "center", width: "100%" }}>
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 480,
          p: { xs: 3, sm: 4 },
          borderRadius: "20px",
          border: "1px solid #E3E4E6",
          boxShadow: "rgba(0, 0, 0, 0.02) 0px 4px 12px",
          bgcolor: "#FFFFFF",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: "var(--font-sans)", color: "#111215" }}>
            My Profile
          </Typography>
          <Button
            id="profile-tab-signout-btn"
            variant="text"
            color="error"
            onClick={onSignOut}
            startIcon={<LogOut size={16} />}
            sx={{ fontWeight: 700, textTransform: "none" }}
          >
            Sign Out
          </Button>
        </Box>

        <Box component="form" onSubmit={handleSave} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Avatar Upload Container */}
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ position: "relative" }}>
              <Avatar
                src={photoURL || undefined}
                {...({ referrerPolicy: "no-referrer" } as any)}
                sx={{
                  width: 96,
                  height: 96,
                  fontSize: "2rem",
                  bgcolor: "#FF385C",
                  color: "#FFFFFF",
                  border: "3px solid #FFF8F9",
                  boxShadow: "rgba(0, 0, 0, 0.08) 0px 4px 12px"
                }}
              >
                {displayName ? displayName[0].toUpperCase() : "U"}
              </Avatar>
              
              <label htmlFor="tab-avatar-file-input">
                <input
                  id="tab-avatar-file-input"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <IconButton
                  component="span"
                  id="tab-upload-avatar-btn"
                  sx={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    bgcolor: "#FF385C",
                    color: "#FFFFFF",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    "&:hover": { bgcolor: "#E00B41" },
                    p: 0.8,
                    border: "2px solid #FFFFFF"
                  }}
                >
                  <Camera size={14} />
                </IconButton>
              </label>
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>
              Tap photo icon to upload picture
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ borderRadius: "12px" }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ borderRadius: "12px" }}>Profile updated successfully!</Alert>}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              id="tab-profile-display-name"
              label="Display Name"
              variant="outlined"
              fullWidth
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={saving}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                }
              }}
            />

            <TextField
              id="tab-profile-email"
              label="Email Address"
              variant="outlined"
              fullWidth
              disabled
              value={currentUser.email || ""}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  bgcolor: "#F7F7F7",
                }
              }}
            />
          </Box>

          <Divider sx={{ my: 0.5 }} />

          {/* Account Badging / Travel Status */}
          <Box sx={{ bgcolor: "#F7F8FA", p: 2, borderRadius: "12px", display: "flex", gap: 1.5, alignItems: "center" }}>
            <Award size={20} style={{ color: "#FF385C" }} />
            <Box>
              <Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#111215" }}>
                Viharix Planner Member
              </Typography>
              <Typography sx={{ fontSize: "11px", color: "text.secondary" }}>
                Verified account — active collaborative status enabled.
              </Typography>
            </Box>
          </Box>

          <Button
            id="tab-profile-save-btn"
            type="submit"
            variant="contained"
            disabled={saving}
            sx={{
              py: 1.5,
              borderRadius: "30px",
              bgcolor: "#FF385C",
              color: "#FFFFFF",
              fontWeight: 700,
              textTransform: "none",
              boxShadow: "none",
              "&:hover": {
                bgcolor: "#E00B41",
                boxShadow: "none",
              },
            }}
          >
            {saving ? <CircularProgress size={20} color="inherit" /> : "Save Profile Details"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
