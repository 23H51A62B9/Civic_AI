import React, { useState, useEffect, useCallback } from "react";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, CircleF, HeatmapLayer } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "100%"
};

// Bangalore default center
const DEFAULT_CENTER = {
  lat: 12.9716,
  lng: 77.5946
};

// Curated warm cream styling for Google Maps to fit the CivicAI theme perfectly
const MAP_STYLES = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#fdfbf7" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#62503d" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#fdfbf7" }]
  },
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [{ "color": "#ebdcc8" }]
  },
  {
    "featureType": "landscape.natural",
    "elementType": "geometry",
    "stylers": [{ "color": "#f7f3ec" }]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{ "color": "#f2eae0" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#8c765c" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{ "color": "#e2ebd5" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#ebdcc8" }]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [{ "color": "#ebdcc8" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#dfc8ab" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#cbd9ea" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#62503d" }]
  }
];

const MARKER_COLORS = {
  "Pothole/Road Damage": "#ef4444",
  "Broken Streetlight/Electricity": "#eab308",
  "Garbage/Sanitation": "#22c55e",
  "Water Leakage/Sewage": "#3b82f6",
  "Public Facility Damage": "#a855f7",
  "Other": "#6b7280"
};

const getCategoryColor = (cat) => {
  if (cat.includes("Pothole") || cat.includes("Road")) return "#ef4444";
  if (cat.includes("Streetlight") || cat.includes("Electricity")) return "#eab308";
  if (cat.includes("Water") || cat.includes("Sewage")) return "#3b82f6";
  if (cat.includes("Garbage") || cat.includes("Sanitation")) return "#22c55e";
  return "#6b7280";
};

const getSeverityColor = (severity) => {
  if (severity >= 4) return "#ef4444";
  if (severity >= 3) return "#f59e0b";
  return "#10b981";
};

export default function CivicMap({
  issues = [],
  onLocationSelect = null,
  selectedLocation = null,
  center = DEFAULT_CENTER,
  isHeatmapMode = false,
  isPredictiveMode = false,
  onUpvote = null,
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY;

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: ['visualization', 'marker']
  });

  const [map, setMap] = useState(null);
  const [mapCenter, setMapCenter] = useState(center);
  const [selectedIssue, setSelectedIssue] = useState(null);

  // Recenter map when selectedLocation changes
  useEffect(() => {
    if (selectedLocation) {
      setMapCenter(selectedLocation);
      if (map) {
        map.panTo(selectedLocation);
      }
    }
  }, [selectedLocation, map]);

  // Center on user geolocation on mount
  useEffect(() => {
    if (!selectedLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setMapCenter(userCoords);
          if (map) {
            map.panTo(userCoords);
          }
        },
        (err) => {
          console.warn("Geolocation access denied:", err);
        }
      );
    }
  }, [map, selectedLocation]);

  const onLoad = useCallback(function callback(mapInstance) {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  const handleMapClick = (e) => {
    if (onLocationSelect) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      onLocationSelect(lat, lng);
    }
  };

  if (!isLoaded) {
    return (
      <div className="w-full h-[500px] rounded-2xl bg-gray-50 dark:bg-gray-850 flex items-center justify-center border border-gray-150 dark:border-gray-800 shadow-inner">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin"></span>
          <span className="text-xs font-bold text-gray-400">Loading Google Maps...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[500px] rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={13}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        options={{
          styles: MAP_STYLES,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {/* Selected reporting location pin */}
        {selectedLocation && (
          <MarkerF
            position={selectedLocation}
            title="Report Location Pinpointed"
            icon="https://maps.google.com/mapfiles/ms/icons/red-pushpin.png"
          />
        )}

        {/* Render issue heatmap or pins */}
        {isHeatmapMode && typeof google !== "undefined" && google.maps && (
          <HeatmapLayer
            data={issues.map((i) => {
              const lat = parseFloat(i.latitude || (i.location && i.location.lat));
              const lng = parseFloat(i.longitude || (i.location && i.location.lng));
              if (isNaN(lat) || isNaN(lng)) return null;
              return {
                location: new google.maps.LatLng(lat, lng),
                weight: i.severity || 1
              };
            }).filter(Boolean)}
          />
        )}

        {!isHeatmapMode && issues.map((issue) => {
          const lat = parseFloat(issue.latitude || (issue.location && issue.location.lat));
          const lng = parseFloat(issue.longitude || (issue.location && issue.location.lng));
          if (isNaN(lat) || isNaN(lng)) return null;

          const color = getCategoryColor(issue.category);

          // 2. Predictive Mode Circle Overlays
          if (isPredictiveMode) {
            if (issue.severity < 4 || issue.status === "Resolved") return null;
            const warningColor = "#f97316"; // orange warning color for prediction

            return (
              <React.Fragment key={`predictive-${issue.id}`}>
                <CircleF
                  center={{ lat, lng }}
                  radius={250}
                  options={{
                    fillColor: warningColor,
                    fillOpacity: 0.08,
                    strokeColor: warningColor,
                    strokeOpacity: 0.5,
                    strokeWeight: 2,
                  }}
                />
                {/* Visual Marker inside Predictive Zone */}
                <MarkerF
                  position={{ lat, lng }}
                  onClick={() => setSelectedIssue(issue)}
                  icon="https://maps.google.com/mapfiles/ms/icons/orange-dot.png"
                />
              </React.Fragment>
            );
          }

          // 3. Default Pins Mode Markers
          let iconUrl = "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";
          if (issue.category.includes("Pothole") || issue.category.includes("Road")) {
            iconUrl = "https://maps.google.com/mapfiles/ms/icons/red-dot.png";
          } else if (issue.category.includes("Streetlight") || issue.category.includes("Electricity")) {
            iconUrl = "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
          } else if (issue.category.includes("Water") || issue.category.includes("Sewage")) {
            iconUrl = "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";
          } else if (issue.category.includes("Garbage") || issue.category.includes("Sanitation")) {
            iconUrl = "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
          } else if (issue.category.includes("Facility")) {
            iconUrl = "https://maps.google.com/mapfiles/ms/icons/purple-dot.png";
          }

          return (
            <MarkerF
              key={`pin-${issue.id}`}
              position={{ lat, lng }}
              onClick={() => setSelectedIssue(issue)}
              icon={iconUrl}
            />
          );
        })}

        {/* Selected Issue InfoWindow (Rich Popup Layout) */}
        {selectedIssue && (
          <InfoWindowF
            position={{
              lat: parseFloat(selectedIssue.latitude),
              lng: parseFloat(selectedIssue.longitude)
            }}
            onCloseClick={() => setSelectedIssue(null)}
          >
            <div className="p-1 min-w-[220px] max-w-[250px] font-sans text-gray-800">
              <div className="flex flex-col gap-2">
                {selectedIssue.imageUrl && (
                  selectedIssue.isVideo || selectedIssue.imageUrl.toLowerCase().includes(".mp4") || selectedIssue.imageUrl.toLowerCase().includes(".mov") || selectedIssue.imageUrl.toLowerCase().includes(".webm") ? (
                    <video src={selectedIssue.imageUrl} className="w-full h-[100px] object-cover rounded-lg shadow-sm" controls muted playsinline></video>
                  ) : (
                    <img src={selectedIssue.imageUrl} className="w-full h-[100px] object-cover rounded-lg shadow-sm" alt="Issue" />
                  )
                )}

                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-gray-950 leading-snug">{selectedIssue.title}</h4>
                  
                  <div className="flex gap-1 flex-wrap pt-0.5">
                    <span className="text-[8px] px-1.5 py-0.5 rounded font-black text-white uppercase tracking-wider bg-indigo-650">
                      {selectedIssue.category.split("/")[0]}
                    </span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                      selectedIssue.severity >= 4 ? "bg-red-100 text-red-800" :
                      selectedIssue.severity >= 3 ? "bg-amber-100 text-amber-800" :
                      "bg-green-100 text-green-800"
                    }`}>
                      Sev: {selectedIssue.severity}
                    </span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-slate-600 text-white`}>
                      {selectedIssue.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-600 leading-snug line-clamp-2 mt-1">{selectedIssue.description}</p>
                  
                  {selectedIssue.locationName && (
                    <p className="text-[9px] text-indigo-650 font-bold leading-tight mt-1">📍 {selectedIssue.locationName}</p>
                  )}
                </div>

                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (onUpvote) {
                      try {
                        await onUpvote(selectedIssue.id);
                        setSelectedIssue(prev => prev ? { ...prev, upvotes: (prev.upvotes || 0) + 1 } : null);
                      } catch (err) {
                        console.error("InfoWindow upvote failed:", err);
                      }
                    }
                  }}
                  className="w-full text-center py-1.5 bg-indigo-600 hover:bg-indigo-755 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all shadow cursor-pointer active:scale-[0.97]"
                >
                  👍 Upvote ({selectedIssue.upvotes || 0})
                </button>
              </div>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  );
}
