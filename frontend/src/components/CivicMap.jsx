import React, { useState, useEffect, useCallback } from "react";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, CircleF, HeatmapLayer } from "@react-google-maps/api";
import { MapContainer, TileLayer, Marker as LeafletMarker, Popup as LeafletPopup, Circle as LeafletCircle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

// Helpers for Leaflet implementation
function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], map.getZoom());
    }
  }, [center, map]);
  return null;
}

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      if (onLocationSelect) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
}

const createLeafletIcon = (category, severity) => {
  let color = "#6b7280";
  if (category.includes("Pothole") || category.includes("Road")) color = "#ef4444";
  else if (category.includes("Streetlight") || category.includes("Electricity")) color = "#eab308";
  else if (category.includes("Water") || category.includes("Sewage")) color = "#3b82f6";
  else if (category.includes("Garbage") || category.includes("Sanitation")) color = "#22c55e";
  else if (category.includes("Facility")) color = "#a855f7";
  else if (category === "Predictive") color = "#f97316";

  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center w-8 h-8 animate-fade-in">
        <div class="absolute w-6 h-6 rounded-full opacity-35 animate-ping" style="background-color: ${color}"></div>
        <div class="w-4 h-4 rounded-full border-2 border-white shadow-md" style="background-color: ${color}"></div>
      </div>
    `,
    className: "custom-leaflet-icon-wrapper",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -10]
  });
};

const createSelectedPinIcon = () => {
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        <div class="absolute w-6 h-6 rounded-full opacity-35 animate-ping bg-rose-600"></div>
        <span class="text-xl">📍</span>
      </div>
    `,
    className: "selected-pin-icon-wrapper",
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
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
    libraries: ['visualization']
  });

  const [map, setMap] = useState(null);
  const [mapCenter, setMapCenter] = useState(center);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [mapEngine, setMapEngine] = useState("google");
  const [isGoogleAuthFailed, setIsGoogleAuthFailed] = useState(false);

  // Catch Google Maps load/auth failures and switch to Leaflet automatically
  useEffect(() => {
    const handleAuthFailure = () => {
      console.warn("Google Maps API auth failure. Falling back to OpenStreetMap.");
      setIsGoogleAuthFailed(true);
      setMapEngine("leaflet");
    };
    window.gm_authFailure = handleAuthFailure;
    return () => {
      if (window.gm_authFailure === handleAuthFailure) {
        window.gm_authFailure = null;
      }
    };
  }, []);

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

  if (!isLoaded && mapEngine === "google" && !isGoogleAuthFailed) {
    return (
      <div className="w-full h-[500px] rounded-2xl bg-gray-50 dark:bg-gray-850 flex items-center justify-center border border-gray-150 dark:border-gray-800 shadow-inner">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin"></span>
          <span className="text-xs font-bold text-gray-400">Loading Google Maps...</span>
          <button
            onClick={() => setMapEngine("leaflet")}
            className="mt-2 px-3 py-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-white rounded-lg text-xs font-bold border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer transition-all"
          >
            Use OpenStreetMap instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[500px] rounded-2xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-800">
      
      {/* Map Engine Toggle Button (Floating in top right for instant toggle) */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-2">
        <button
          onClick={() => setMapEngine(mapEngine === "google" ? "leaflet" : "google")}
          className="px-3 py-1.5 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md hover:bg-white dark:hover:bg-gray-900 text-gray-800 dark:text-zinc-100 rounded-xl text-xs font-black shadow-md border border-gray-200 dark:border-gray-800 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] select-none"
        >
          🗺️ {mapEngine === "google" ? "Switch to OpenStreetMap" : "Switch to Google Maps"}
        </button>
        {isGoogleAuthFailed && (
          <span className="text-[9px] bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-2 py-1 rounded-lg font-bold border border-amber-200 dark:border-amber-900/40 shadow-sm animate-pulse">
            ⚠️ Google Maps Key Inactive (OSM Fallback)
          </span>
        )}
      </div>

      {mapEngine === "google" && !isGoogleAuthFailed ? (
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
      ) : (
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={13}
          style={containerStyle}
          zoomControl={false}
        >
          <MapRecenter center={mapCenter} />
          <MapClickHandler onLocationSelect={onLocationSelect} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="cream-map-tiles"
          />

          {/* Selected reporting location pin */}
          {selectedLocation && (
            <LeafletMarker
              position={[selectedLocation.lat, selectedLocation.lng]}
              icon={createSelectedPinIcon()}
            />
          )}

          {/* Render issue heatmap or pins */}
          {isHeatmapMode && issues.map((issue) => {
            const lat = parseFloat(issue.latitude || (issue.location && issue.location.lat));
            const lng = parseFloat(issue.longitude || (issue.location && issue.location.lng));
            if (isNaN(lat) || isNaN(lng)) return null;

            const color = getCategoryColor(issue.category);
            return (
              <LeafletCircle
                key={`heatmap-circle-${issue.id}`}
                center={[lat, lng]}
                radius={150}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.15 * (issue.severity || 1),
                  strokeColor: color,
                  strokeOpacity: 0.3,
                  weight: 1
                }}
              />
            );
          })}

          {!isHeatmapMode && issues.map((issue) => {
            const lat = parseFloat(issue.latitude || (issue.location && issue.location.lat));
            const lng = parseFloat(issue.longitude || (issue.location && issue.location.lng));
            if (isNaN(lat) || isNaN(lng)) return null;

            // 2. Predictive Mode Circle Overlays
            if (isPredictiveMode) {
              if (issue.severity < 4 || issue.status === "Resolved") return null;
              const warningColor = "#f97316";

              return (
                <React.Fragment key={`predictive-${issue.id}`}>
                  <LeafletCircle
                    center={[lat, lng]}
                    radius={250}
                    pathOptions={{
                      fillColor: warningColor,
                      fillOpacity: 0.08,
                      strokeColor: warningColor,
                      strokeOpacity: 0.5,
                      weight: 2
                    }}
                  />
                  <LeafletMarker
                    position={[lat, lng]}
                    icon={createLeafletIcon("Predictive", issue.severity)}
                    eventHandlers={{
                      click: () => setSelectedIssue(issue)
                    }}
                  />
                </React.Fragment>
              );
            }

            // 3. Default Pins Mode Markers
            return (
              <LeafletMarker
                key={`pin-${issue.id}`}
                position={[lat, lng]}
                icon={createLeafletIcon(issue.category, issue.severity)}
                eventHandlers={{
                  click: () => setSelectedIssue(issue)
                }}
              />
            );
          })}

          {/* Selected Issue Popup (Rich InfoWindow Layout) */}
          {selectedIssue && (
            <LeafletPopup
              position={[parseFloat(selectedIssue.latitude), parseFloat(selectedIssue.longitude)]}
              onClose={() => setSelectedIssue(null)}
            >
              <div className="p-1 min-w-[220px] max-w-[250px] font-sans text-gray-800 dark:text-zinc-100">
                <div className="flex flex-col gap-2">
                  {selectedIssue.imageUrl && (
                    selectedIssue.isVideo || selectedIssue.imageUrl.toLowerCase().includes(".mp4") || selectedIssue.imageUrl.toLowerCase().includes(".mov") || selectedIssue.imageUrl.toLowerCase().includes(".webm") ? (
                      <video src={selectedIssue.imageUrl} className="w-full h-[100px] object-cover rounded-lg shadow-sm" controls muted playsinline></video>
                    ) : (
                      <img src={selectedIssue.imageUrl} className="w-full h-[100px] object-cover rounded-lg shadow-sm" alt="Issue" />
                    )
                  )}

                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm text-gray-950 dark:text-white leading-snug">{selectedIssue.title}</h4>
                    
                    <div className="flex gap-1 flex-wrap pt-0.5">
                      <span className="text-[8px] px-1.5 py-0.5 rounded font-black text-white uppercase tracking-wider bg-indigo-650">
                        {selectedIssue.category.split("/")[0]}
                      </span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                        selectedIssue.severity >= 4 ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
                        selectedIssue.severity >= 3 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" :
                        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      }`}>
                        Sev: {selectedIssue.severity}
                      </span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-slate-600 text-white`}>
                        {selectedIssue.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug line-clamp-2 mt-1">{selectedIssue.description}</p>
                    
                    {selectedIssue.locationName && (
                      <p className="text-[9px] text-indigo-650 dark:text-indigo-400 font-bold leading-tight mt-1">📍 {selectedIssue.locationName}</p>
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
                          console.error("Popup upvote failed:", err);
                        }
                      }
                    }}
                    className="w-full text-center py-1.5 bg-indigo-600 hover:bg-indigo-755 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all shadow cursor-pointer active:scale-[0.97]"
                  >
                    👍 Upvote ({selectedIssue.upvotes || 0})
                  </button>
                </div>
              </div>
            </LeafletPopup>
          )}
        </MapContainer>
      )}
    </div>
  );
}
