import React, { useEffect, useState, useRef, useMemo } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary, InfoWindow } from "@vis.gl/react-google-maps";
import { Box, Paper, Typography, Button, Card, CardMedia, Chip, Avatar } from "@mui/material";
import { MapPin, Clock, Compass, HelpCircle, Sparkles } from "lucide-react";
import { Trip, Activity, ItineraryPlacement } from "../types";
import { CATEGORY_COLORS } from "../lib/images";

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  "";

const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY";

interface ActivitiesMapProps {
  trip: Trip;
  activities: Activity[];
  activityPlacementsMap: Record<string, ItineraryPlacement>;
  onUpdateActivityCoordinates?: (activityId: string, lat: number, lng: number) => Promise<void>;
  onSelectActivity?: (activity: Activity) => void;
  onToggleSchedule?: (activity: Activity) => void;
  isReadOnly?: boolean;
}

// Internal Map Content Controller for Activities (must be inside APIProvider)
function ActivitiesMapContent({
  trip,
  activities,
  activityPlacementsMap,
  onUpdateActivityCoordinates,
  onSelectActivity,
  onToggleSchedule,
  isReadOnly,
}: {
  trip: Trip;
  activities: Activity[];
  activityPlacementsMap: Record<string, ItineraryPlacement>;
  onUpdateActivityCoordinates?: (activityId: string, lat: number, lng: number) => Promise<void>;
  onSelectActivity?: (activity: Activity) => void;
  onToggleSchedule?: (activity: Activity) => void;
  isReadOnly?: boolean;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const coreLib = useMapsLibrary("core");

  const [activeInfoWindow, setActiveInfoWindow] = useState<string | null>(null);
  const [localCoords, setLocalCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const [geocodingInProgress, setGeocodingInProgress] = useState<Record<string, boolean>>({});

  // Geocode any activities that don't have coordinates
  useEffect(() => {
    if (!mapsLib || !coreLib) return;

    const geocoder = new google.maps.Geocoder();

    activities.forEach((activity) => {
      if (!activity.location) return;

      const hasCoords = activity.latitude !== undefined && activity.longitude !== undefined;
      const hasLocalCoords = localCoords[activity.id];

      if (!hasCoords && !hasLocalCoords && !geocodingInProgress[activity.id]) {
        setGeocodingInProgress((prev) => ({ ...prev, [activity.id]: true }));

        geocoder.geocode({ address: activity.location }, (results, status) => {
          setGeocodingInProgress((prev) => ({ ...prev, [activity.id]: false }));

          if (status === "OK" && results?.[0]?.geometry?.location) {
            const loc = results[0].geometry.location;
            const lat = loc.lat();
            const lng = loc.lng();

            // Store in local state so it renders immediately
            setLocalCoords((prev) => ({ ...prev, [activity.id]: { lat, lng } }));

            // Save back to Firestore
            if (onUpdateActivityCoordinates) {
              onUpdateActivityCoordinates(activity.id, lat, lng).catch((err) => {
                console.error("Failed to save geocoded coordinates:", err);
              });
            }
          }
        });
      }
    });
  }, [mapsLib, coreLib, activities, onUpdateActivityCoordinates, localCoords, geocodingInProgress]);

  // Geocode trip destination to center map if no activities
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!mapsLib || !trip.destination || activities.length > 0) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: trip.destination }, (results, status) => {
      if (status === "OK" && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        setDestinationCoords({ lat: loc.lat(), lng: loc.lng() });
      }
    });
  }, [mapsLib, trip.destination, activities.length]);

  // Map coordinates resolver for the filtered activities
  const markers = useMemo(() => {
    return activities
      .map((activity) => {
        let lat = activity.latitude;
        let lng = activity.longitude;

        if (lat === undefined || lng === undefined) {
          const local = localCoords[activity.id];
          if (local) {
            lat = local.lat;
            lng = local.lng;
          }
        }

        if (lat !== undefined && lng !== undefined) {
          return {
            activityId: activity.id,
            activity,
            position: { lat, lng },
          };
        }
        return null;
      })
      .filter((m): m is { activityId: string; activity: Activity; position: { lat: number; lng: number } } => !!m);
  }, [activities, localCoords]);

  // Auto-fit bounds when markers change
  useEffect(() => {
    if (typeof google === "undefined" || !google.maps) return;
    if (!map || markers.length === 0) {
      if (map && destinationCoords) {
        map.setCenter(destinationCoords);
        map.setZoom(12);
      }
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    markers.forEach((m) => bounds.extend(m.position));
    map.fitBounds(bounds);

    // Guard zoom level if single marker
    if (markers.length === 1) {
      const listener = google.maps.event.addListener(map, "bounds_changed", () => {
        if (map.getZoom()! > 14) map.setZoom(14);
        google.maps.event.removeListener(listener);
      });
    }
  }, [map, markers, destinationCoords]);

  return (
    <>
      {markers.map((m) => {
        const colors = CATEGORY_COLORS[m.activity.category] || CATEGORY_COLORS.Custom;
        const isSelected = activeInfoWindow === m.activityId;
        const scheduled = Boolean(activityPlacementsMap[m.activityId]);

        return (
          <React.Fragment key={m.activityId}>
            <AdvancedMarker
              position={m.position}
              onClick={() => setActiveInfoWindow(isSelected ? null : m.activityId)}
            >
              <Box
                sx={{
                  transform: isSelected ? "scale(1.18)" : "scale(1)",
                  transition: "transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                <Pin
                  background={scheduled ? "#222222" : colors.primary}
                  borderColor="#FFFFFF"
                  glyphColor="#FFFFFF"
                  scale={isSelected ? 1.25 : 1}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
                    <span style={{ fontSize: "10px", fontWeight: "900", color: "#FFFFFF" }}>
                      {scheduled ? "✓" : m.activity.title[0].toUpperCase()}
                    </span>
                  </Box>
                </Pin>
              </Box>
            </AdvancedMarker>

            {isSelected && (
              <InfoWindow
                position={m.position}
                onCloseClick={() => setActiveInfoWindow(null)}
              >
                <Box sx={{ p: 0.5, maxWidth: 220, overflow: "hidden" }}>
                  {m.activity.imageURL && (
                    <CardMedia
                      component="img"
                      sx={{ width: "100%", height: 95, borderRadius: "8px", objectFit: "cover", mb: 1 }}
                      image={m.activity.imageURL}
                      alt={m.activity.title}
                      {...({
                        referrerPolicy: "no-referrer",
                        onError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                          e.currentTarget.src = `https://picsum.photos/seed/${m.activity.id}/300/200`;
                        }
                      } as any)}
                    />
                  )}
                  <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mb: 0.5 }}>
                    <Chip
                      label={m.activity.category}
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: "0.55rem",
                        bgcolor: colors.bg,
                        color: colors.text,
                        fontWeight: "bold",
                        p: 0,
                      }}
                    />
                    {m.activity.source === "AI Search" && (
                      <Chip
                        icon={<Sparkles size={8} style={{ color: "#8B5CF6" }} />}
                        label="AI"
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: "0.55rem",
                          bgcolor: "#F3E8FF",
                          color: "#6D28D9",
                          fontWeight: "bold",
                        }}
                      />
                    )}
                  </Box>
                  <Typography
                    sx={{
                      fontWeight: "800",
                      fontSize: "0.82rem",
                      color: "#1E293B",
                      lineHeight: 1.2,
                      mb: 0.5,
                      cursor: "pointer",
                      "&:hover": { color: "#FF385C" },
                    }}
                    onClick={() => {
                      if (onSelectActivity) onSelectActivity(m.activity);
                    }}
                  >
                    {m.activity.title}
                  </Typography>
                  {m.activity.location && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.2,
                        fontSize: "0.68rem",
                        mb: 1,
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <MapPin size={10} />
                      {m.activity.location}
                    </Typography>
                  )}

                  <Box sx={{ display: "flex", gap: 0.5, mt: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      fullWidth
                      sx={{
                        py: 0.4,
                        fontSize: "0.65rem",
                        fontWeight: "bold",
                        borderColor: "#DDDDDD",
                        color: "#222222",
                        borderRadius: "6px",
                        textTransform: "none",
                        "&:hover": { bgcolor: "#F7F7F7", borderColor: "#CCCCCC" },
                      }}
                      onClick={() => {
                        if (onSelectActivity) onSelectActivity(m.activity);
                      }}
                    >
                      Details
                    </Button>

                    {!isReadOnly && onToggleSchedule && (
                      <Button
                        variant="contained"
                        size="small"
                        fullWidth
                        sx={{
                          py: 0.4,
                          fontSize: "0.65rem",
                          fontWeight: "bold",
                          bgcolor: scheduled ? "#222222" : "#FF385C",
                          borderRadius: "6px",
                          textTransform: "none",
                          "&:hover": { bgcolor: scheduled ? "#000000" : "#E00B41" },
                        }}
                        onClick={() => {
                          onToggleSchedule(m.activity);
                        }}
                      >
                        {scheduled ? "Scheduled" : "+ Schedule"}
                      </Button>
                    )}
                  </Box>
                </Box>
              </InfoWindow>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

// Main ActivitiesMap Component
export default function ActivitiesMap({
  trip,
  activities,
  activityPlacementsMap,
  onUpdateActivityCoordinates,
  onSelectActivity,
  onToggleSchedule,
  isReadOnly = false,
}: ActivitiesMapProps) {
  // If no valid key, render splash instructions
  if (!hasValidKey) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 4,
          height: "100%",
          minHeight: 380,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: "1px dashed #E2E8F0",
          borderRadius: "24px",
          bgcolor: "#F8FAFC",
          textAlign: "center",
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: "16px",
            bgcolor: "rgba(255, 56, 92, 0.1)",
            color: "#FF385C",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2.5,
          }}
        >
          <Compass size={28} className="animate-pulse" />
        </Box>
        
        <Typography variant="h6" sx={{ fontWeight: 800, color: "#1E293B", mb: 1 }}>
          Unlock Travel Ideas on Map
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mb: 3, fontSize: "0.85rem", lineHeight: 1.5 }}>
          Connect Google Maps Platform to plot travel stopovers, see transit lines, and explore routing on an interactive canvas.
        </Typography>

        <Card
          variant="outlined"
          sx={{
            textAlign: "left",
            p: 2.5,
            width: "100%",
            maxWidth: 420,
            borderRadius: "16px",
            bgcolor: "#FFFFFF",
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
            mb: 3,
          }}
        >
          <Typography sx={{ fontSize: "0.75rem", fontWeight: "bold", textTransform: "uppercase", color: "#FF385C", letterSpacing: "0.05em", mb: 1.5 }}>
            Key Setup Instructions
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.2, fontSize: "0.8rem", color: "#475569" }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <span style={{ fontWeight: "800", color: "#1E293B" }}>1.</span>
              <span>
                Get a Google Maps API Key:{" "}
                <a
                  href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#FF385C", fontWeight: "bold", textDecoration: "underline" }}
                >
                  Create credentials
                </a>
              </span>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <span style={{ fontWeight: "800", color: "#1E293B" }}>2.</span>
              <span>
                Open **Settings** (⚙️ gear icon, top-right corner of AI Studio)
              </span>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <span style={{ fontWeight: "800", color: "#1E293B" }}>3.</span>
              <span>
                Add secret with name <code>GOOGLE_MAPS_PLATFORM_KEY</code>
              </span>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <span style={{ fontWeight: "800", color: "#1E293B" }}>4.</span>
              <span>
                Paste your API Key value, save, and the map wakes up instantly!
              </span>
            </Box>
          </Box>
        </Card>

        <Typography variant="caption" color="text.secondary">
          No page refresh or redeployment is required after adding.
        </Typography>
      </Paper>
    );
  }

  const activitiesWithLocations = activities.filter((act) => !!act.location);

  return (
    <Box sx={{ width: "100%", height: "100%", position: "relative", minHeight: 380, borderRadius: "24px", overflow: "hidden", border: "1px solid #EBEBEB", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={{ lat: 37.7749, lng: -122.4194 }}
          defaultZoom={11}
          mapId="DEMO_MAP_ID"
          gestureHandling="cooperative"
          disableDefaultUI={false}
          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
          style={{ width: "100%", height: "100%" }}
        >
          <ActivitiesMapContent
            trip={trip}
            activities={activitiesWithLocations}
            activityPlacementsMap={activityPlacementsMap}
            onUpdateActivityCoordinates={onUpdateActivityCoordinates}
            onSelectActivity={onSelectActivity}
            onToggleSchedule={onToggleSchedule}
            isReadOnly={isReadOnly}
          />
        </Map>
      </APIProvider>

      {/* Floating map info pill */}
      <Paper
        elevation={2}
        sx={{
          position: "absolute",
          top: 16,
          left: 16,
          py: 0.8,
          px: 1.5,
          borderRadius: "20px",
          bgcolor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(8px)",
          border: "1px solid #E2E8F0",
          display: "flex",
          alignItems: "center",
          gap: 1,
          zIndex: 1,
        }}
      >
        <Compass size={14} className="text-[#FF385C] animate-spin-slow" />
        <Typography sx={{ fontSize: "0.72rem", fontWeight: "bold", color: "#1E293B" }}>
          Ideas Map: {activitiesWithLocations.length} locations found
        </Typography>
      </Paper>
    </Box>
  );
}
