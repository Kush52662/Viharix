import React, { useEffect, useState, useRef, useMemo } from "react";
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary, InfoWindow } from "@vis.gl/react-google-maps";
import { Box, Paper, Typography, Button, Card, CardMedia, Chip, IconButton } from "@mui/material";
import { MapPin, Clock, Compass, HelpCircle, X, ExternalLink, RefreshCw } from "lucide-react";
import { Trip, Activity, ItineraryPlacement } from "../types";
import { CATEGORY_COLORS } from "../lib/images";

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  "";

const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY";

interface ItineraryMapProps {
  trip: Trip;
  placements: ItineraryPlacement[];
  activities: Activity[];
  selectedDay: string;
  onUpdateActivityCoordinates?: (activityId: string, lat: number, lng: number) => Promise<void>;
  onSelectActivity?: (activity: Activity) => void;
  isReadOnly?: boolean;
}

// Internal Map Content Controller (must be inside APIProvider)
function MapContent({
  trip,
  dayPlacements,
  activities,
  onUpdateActivityCoordinates,
  onSelectActivity,
}: {
  trip: Trip;
  dayPlacements: ItineraryPlacement[];
  activities: Activity[];
  onUpdateActivityCoordinates?: (activityId: string, lat: number, lng: number) => Promise<void>;
  onSelectActivity?: (activity: Activity) => void;
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");
  const coreLib = useMapsLibrary("core");
  const routesLib = useMapsLibrary("routes");

  const [activeInfoWindow, setActiveInfoWindow] = useState<string | null>(null);
  const [localCoords, setLocalCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const [geocodingInProgress, setGeocodingInProgress] = useState<Record<string, boolean>>({});
  const [routePolyline, setRoutePolyline] = useState<google.maps.Polyline | null>(null);

  // 1. Get ordered activities for this day
  const orderedPlacementsWithActs = useMemo(() => {
    return dayPlacements
      .map((p) => {
        const act = activities.find((a) => a.id === p.activityId);
        return { placement: p, activity: act };
      })
      .filter((item): item is { placement: ItineraryPlacement; activity: Activity } => !!item.activity);
  }, [dayPlacements, activities]);

  // 2. Geocode locations that don't have coordinates
  useEffect(() => {
    if (!mapsLib || !coreLib) return;

    const geocoder = new google.maps.Geocoder();

    orderedPlacementsWithActs.forEach(({ activity }) => {
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

            // Persist back to Firestore so all co-travelers get it instantly
            if (onUpdateActivityCoordinates) {
              onUpdateActivityCoordinates(activity.id, lat, lng).catch((err) => {
                console.error("Failed to save geocoded coordinates:", err);
              });
            }
          }
        });
      }
    });
  }, [mapsLib, coreLib, orderedPlacementsWithActs, onUpdateActivityCoordinates, localCoords, geocodingInProgress]);

  // 3. Geocode trip destination to center map if no activities
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!mapsLib || !trip.destination || orderedPlacementsWithActs.length > 0) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: trip.destination }, (results, status) => {
      if (status === "OK" && results?.[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        setDestinationCoords({ lat: loc.lat(), lng: loc.lng() });
      }
    });
  }, [mapsLib, trip.destination, orderedPlacementsWithActs.length]);

  // 4. Map coordinates resolver for the ordered activities
  const markers = useMemo(() => {
    return orderedPlacementsWithActs
      .map(({ placement, activity }) => {
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
            placementId: placement.id,
            activityId: activity.id,
            activity,
            position: { lat, lng },
            startTime: placement.startTime,
          };
        }
        return null;
      })
      .filter((m): m is { placementId: string; activityId: string; activity: Activity; position: { lat: number; lng: number }; startTime: string } => !!m);
  }, [orderedPlacementsWithActs, localCoords]);

  // 5. Auto-fit bounds when markers change
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

    // If only 1 marker, don't zoom in to the maximum level
    if (markers.length === 1) {
      const listener = google.maps.event.addListener(map, "bounds_changed", () => {
        if (map.getZoom()! > 15) map.setZoom(15);
        google.maps.event.removeListener(listener);
      });
    }
  }, [map, markers, destinationCoords]);

  // 6. Draw route connections between sequential markers
  useEffect(() => {
    if (typeof google === "undefined" || !google.maps) return;
    if (!map) return;

    // Clear previous polyline
    if (routePolyline) {
      routePolyline.setMap(null);
    }

    if (markers.length < 2) {
      setRoutePolyline(null);
      return;
    }

    const pathCoordinates = markers.map((m) => m.position);

    // Draw a custom styled geodesic dashed line to connect points nicely
    const polyline = new google.maps.Polyline({
      path: pathCoordinates,
      geodesic: true,
      strokeColor: "#FF385C",
      strokeOpacity: 0.8,
      strokeWeight: 4,
      icons: [
        {
          icon: {
            path: "M 0,-1 0,1",
            strokeOpacity: 1,
            scale: 2,
          },
          offset: "0",
          repeat: "10px",
        },
      ],
    });

    polyline.setMap(map);
    setRoutePolyline(polyline);

    return () => {
      polyline.setMap(null);
    };
  }, [map, markers]);

  return (
    <>
      {markers.map((m, idx) => {
        const colors = CATEGORY_COLORS[m.activity.category] || CATEGORY_COLORS.Custom;
        const isSelected = activeInfoWindow === m.placementId;

        return (
          <React.Fragment key={m.placementId}>
            <AdvancedMarker
              position={m.position}
              onClick={() => setActiveInfoWindow(isSelected ? null : m.placementId)}
            >
              <Box
                sx={{
                  transform: isSelected ? "scale(1.15)" : "scale(1)",
                  transition: "transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                <Pin
                  background={colors.primary}
                  borderColor="#FFFFFF"
                  glyphColor="#FFFFFF"
                  scale={isSelected ? 1.2 : 1}
                >
                  <span style={{ fontSize: "11px", fontWeight: "900", color: "#FFFFFF", fontFamily: "sans-serif" }}>
                    {idx + 1}
                  </span>
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
                      sx={{ width: "100%", height: 90, borderRadius: "8px", objectFit: "cover", mb: 1 }}
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
                    <Typography sx={{ fontSize: "0.65rem", fontWeight: "700", color: "#64748B" }}>
                      ⏰ {m.startTime}
                    </Typography>
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
                  <Button
                    variant="contained"
                    size="small"
                    fullWidth
                    sx={{
                      py: 0.4,
                      fontSize: "0.65rem",
                      fontWeight: "bold",
                      bgcolor: "#FF385C",
                      borderRadius: "6px",
                      textTransform: "none",
                      "&:hover": { bgcolor: "#E00B41" },
                    }}
                    onClick={() => {
                      if (onSelectActivity) onSelectActivity(m.activity);
                    }}
                  >
                    View Details
                  </Button>
                </Box>
              </InfoWindow>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

// Main ItineraryMap Component
export default function ItineraryMap({
  trip,
  placements,
  activities,
  selectedDay,
  onUpdateActivityCoordinates,
  onSelectActivity,
  isReadOnly = false,
}: ItineraryMapProps) {
  // Filter placements for current selected day
  const dayPlacements = useMemo(() => {
    return placements
      .filter((p) => p.day === selectedDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.sortOrder - b.sortOrder);
  }, [placements, selectedDay]);

  // If no valid key, render the splash instructions
  if (!hasValidKey) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 4,
          height: "100%",
          minHeight: 400,
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
          Unlock Interactive Travel Maps
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

  return (
    <Box sx={{ width: "100%", height: "100%", position: "relative", minHeight: 350, borderRadius: "24px", overflow: "hidden", border: "1px solid #EBEBEB", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
      <APIProvider apiKey={API_KEY} version="weekly">
        <Map
          defaultCenter={{ lat: 37.7749, lng: -122.4194 }}
          defaultZoom={12}
          mapId="DEMO_MAP_ID"
          gestureHandling="cooperative"
          disableDefaultUI={false}
          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
          style={{ width: "100%", height: "100%" }}
        >
          <MapContent
            trip={trip}
            dayPlacements={dayPlacements}
            activities={activities}
            onUpdateActivityCoordinates={onUpdateActivityCoordinates}
            onSelectActivity={onSelectActivity}
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
          {selectedDay} Map: {dayPlacements.length} stops
        </Typography>
      </Paper>
    </Box>
  );
}
