import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  IconButton,
} from "@mui/material";
import { X, Compass } from "lucide-react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../lib/firebase";
import { tokens } from "../lib/theme";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Ensure we always prompt for account selection
      provider.setCustomParameters({
        prompt: "select_account"
      });
      await signInWithPopup(auth, provider);
      onClose();
    } catch (err: any) {
      console.error("Google Sign-In Error: ", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-In popup was closed before completing. Please try again.");
      } else if (err.code === "auth/cancelled-popup-request") {
        setError("The authentication popup request was cancelled. Please try again.");
      } else {
        setError(err.message || "An unexpected error occurred during Google Sign-In.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="xs" 
      id="auth-modal"
      sx={{
        "& .MuiDialog-paper": {
          borderRadius: `${tokens.radius.dialog}px`,
          p: 1.5,
          boxShadow: tokens.shadow.overlay,
          bgcolor: "#FAF7F0" // Matches our base warm sand theme
        }
      }}
    >
      <IconButton
        id="auth-close-btn"
        onClick={onClose}
        disabled={loading}
        sx={{
          position: "absolute",
          top: 16,
          right: 16,
          color: "text.secondary",
          bgcolor: "rgba(0, 0, 0, 0.03)",
          "&:hover": {
            bgcolor: "rgba(0, 0, 0, 0.08)",
          }
        }}
      >
        <X size={18} />
      </IconButton>

      <DialogContent sx={{ px: { xs: 3, sm: 4 }, py: 5, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Animated Brand Header */}
        <Box sx={{ display: "inline-flex", p: 2, borderRadius: "50%", bgcolor: "#F7F7F7", color: "#FF385C", mb: 3, border: "1px solid #EBEBEB" }}>
          <Compass size={36} style={{ color: "#FF385C" }} className="animate-spin" />
        </Box>
        
        <Typography variant="h5" align="center" sx={{ color: "#222222", fontWeight: 700, letterSpacing: "-0.02em", mb: 1 }}>
          Join the Adventure
        </Typography>
        
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4, px: 2, lineHeight: 1.6, fontWeight: 500 }}>
          Sign in with Google to synchronize schedules, map live itineraries, and collaborate on trip planning with friends.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3.5, width: "100%", borderRadius: "12px" }}>
            {error}
          </Alert>
        )}

        {/* Branded Google Login Button */}
        <Button
          id="google-signin-btn"
          variant="contained"
          fullWidth
          onClick={handleGoogleSignIn}
          disabled={loading}
          sx={{
            py: 1.8,
            borderRadius: "16px",
            bgcolor: "#FFFFFF",
            color: "#1F2937",
            textTransform: "none",
            fontSize: "0.95rem",
            fontWeight: 700,
            display: "flex",
            gap: 1.5,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.05)",
            border: "1px solid rgba(0, 0, 0, 0.08)",
            transition: "all 0.25s ease-in-out",
            "&:hover": {
              bgcolor: "#F9FAFB",
              boxShadow: "0 8px 16px rgba(0, 0, 0, 0.08)",
              transform: "translateY(-1px)"
            },
            "&:active": {
              bgcolor: "#F3F4F6",
              transform: "translateY(0)"
            }
          }}
        >
          {loading ? (
            <CircularProgress size={20} sx={{ color: "primary.main" }} />
          ) : (
            <>
              {/* SVG Google 'G' Logo */}
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </Button>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 3, fontWeight: 500 }}>
          Secure authentication powered by Firebase Auth
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
