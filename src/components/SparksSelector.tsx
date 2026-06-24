import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Paper,
} from "@mui/material";
import { Sparkles, MessageSquare } from "lucide-react";
import { Trip } from "../types";

interface SparksSelectorProps {
  trip: Trip;
  isGenerating: boolean;
  onBuild: (selectedSparks: string[], anythingElse: string) => void;
}

const SPARK_OPTIONS = [
  "City sightseeing",
  "Cuisine and dining",
  "Outdoor activities",
  "Cultural and historical",
  "Relaxation and wellness",
  "Shopping and markets",
  "Outdoor adventures and sports",
  "Wildlife and nature",
  "Nightlife and entertainment",
  "Cultural events and festivals",
  "Wellness and spa retreats",
  "Art and architecture"
];

export default function SparksSelector({
  trip,
  isGenerating,
  onBuild,
}: SparksSelectorProps) {
  const [selectedSparks, setSelectedSparks] = useState<string[]>([]);
  const [anythingElse, setAnythingElse] = useState("");

  const handleToggleSpark = (spark: string) => {
    setSelectedSparks((prev) =>
      prev.includes(spark)
        ? prev.filter((s) => s !== spark)
        : [...prev, spark]
    );
  };

  const handleBuild = () => {
    onBuild(selectedSparks, anythingElse);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, sm: 4 },
        borderRadius: "24px",
        border: "1px solid #EBEBEB",
        bgcolor: "#FFFFFF",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 3,
        boxShadow: "0 8px 32px rgba(0,0,0,0.03)",
      }}
    >
      {/* Title */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Typography
          sx={{
            fontFamily: "var(--font-sans)",
            fontWeight: 800,
            fontSize: { xs: "1.25rem", sm: "1.45rem" },
            color: "#222222",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          What sparks your interest?
        </Typography>
        <Typography
          sx={{
            fontSize: "0.82rem",
            color: "#6A6A6A",
            fontWeight: 500,
          }}
        >
          Choose multiple interests or vibes to customize your trip to {trip.destination?.split(",")[0] || "destination"}.
        </Typography>
      </Box>

      {/* Sparks Multi-select Chips */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1.25,
        }}
      >
        {SPARK_OPTIONS.map((spark) => {
          const isSelected = selectedSparks.includes(spark);
          return (
            <Box
              key={spark}
              onClick={() => handleToggleSpark(spark)}
              sx={{
                px: 2.2,
                py: 1.1,
                borderRadius: "30px",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                userSelect: "none",
                transition: "all 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)",
                fontFamily: "var(--font-sans)",
                bgcolor: isSelected ? "#FF385C" : "#FFFFFF",
                color: isSelected ? "#FFFFFF" : "#222222",
                border: "1px solid",
                borderColor: isSelected ? "#FF385C" : "#DDDDDD",
                boxShadow: isSelected ? "0 4px 12px rgba(255, 56, 92, 0.2)" : "none",
                transform: isSelected ? "scale(1.02)" : "scale(1)",
                "&:hover": {
                  borderColor: isSelected ? "#FF385C" : "#222222",
                  bgcolor: isSelected ? "#FF385C" : "#F7F7F7",
                },
                "&:active": {
                  transform: "scale(0.98)",
                },
              }}
            >
              {spark}
            </Box>
          );
        })}
      </Box>

      {/* "Anything Else?" Text Area */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography
          sx={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: "0.85rem",
            color: "#222222",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Anything else?
        </Typography>
        <Box sx={{ position: "relative" }}>
          <textarea
            value={anythingElse}
            onChange={(e) => setAnythingElse(e.target.value.substring(0, 250))}
            placeholder="Accessibility, Gym, Other"
            style={{
              width: "100%",
              minHeight: "100px",
              padding: "16px",
              backgroundColor: "#FFFFFF",
              color: "#222222",
              border: "1px solid #DDDDDD",
              borderRadius: "14px",
              fontSize: "0.88rem",
              fontWeight: 500,
              outline: "none",
              fontFamily: "var(--font-sans)",
              resize: "vertical",
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#FF385C")}
            onBlur={(e) => (e.target.style.borderColor = "#DDDDDD")}
          />
          <Typography
            sx={{
              position: "absolute",
              bottom: 12,
              right: 12,
              fontSize: "0.72rem",
              fontWeight: 600,
              color: "#6A6A6A",
              fontFamily: "var(--font-mono)",
            }}
          >
            {anythingElse.length}/250
          </Typography>
        </Box>
      </Box>

      {/* Build Itinerary Primary Button */}
      <Button
        variant="contained"
        fullWidth
        disabled={isGenerating}
        onClick={handleBuild}
        startIcon={isGenerating ? <CircularProgress size={16} color="inherit" /> : <Sparkles size={16} />}
        sx={{
          py: 1.5,
          borderRadius: "14px",
          bgcolor: "#FF385C",
          color: "#FFFFFF",
          fontSize: "0.92rem",
          fontWeight: 700,
          textTransform: "none",
          boxShadow: "none",
          transition: "all 0.15s ease",
          "&:hover": {
            bgcolor: "#E00B41",
            boxShadow: "none",
          },
          "&.Mui-disabled": {
            bgcolor: "rgba(255, 56, 92, 0.4)",
            color: "#FFFFFF",
          },
        }}
      >
        {isGenerating ? "Building your tailored options..." : "Build itinerary"}
      </Button>
    </Paper>
  );
}
