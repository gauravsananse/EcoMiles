import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation,
  Compass,
  MapPin,
  Locate,
  LocateFixed,
  AlertTriangle,
  Radio,
  Footprints,
  Bike,
  Bus,
  Train,
  Car,
  Zap,
  CheckCircle2,
  ShieldAlert,
  ArrowUp,
  ArrowUpRight,
  ArrowUpLeft,
  CornerUpRight,
  CornerUpLeft,
  RotateCw,
  Flag,
  Loader2
} from 'lucide-react';

const MODE_COLORS = {
  WALKING: '#10b981', // Emerald
  CYCLING: '#f59e0b', // Amber
  BUS: '#3b82f6',     // Blue
  METRO: '#8b5cf6',   // Purple
  CAR: '#64748b',     // Slate
  SCOOTER: '#f97316', // Orange
  STATIONARY: '#64748b',
  UNKNOWN: '#94a3b8',
};

const MODE_ICONS = {
  WALKING: Footprints,
  CYCLING: Bike,
  BUS: Bus,
  METRO: Train,
  CAR: Car,
  SCOOTER: Zap,
  STATIONARY: MapPin,
};

// Calculate geographic compass heading string (e.g. 74° ENE)
function formatHeadingCompass(deg) {
  if (deg === null || deg === undefined || isNaN(deg)) return '0° N';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((deg % 360) / 22.5)) % 16;
  return `${Math.round(deg)}° ${directions[index]}`;
}

export default function MobilityMap({
  currentLocation,
  selectedRoute = null,
  remainingRouteCoordinates = null,
  currentStep = null,
  isOffRoute = false,
  isRerouting = false,
  segments = [],
  currentMode = 'STATIONARY',
  transitBeacons = [],
  isTracking = false,
  elapsedSeconds = 0,
  totalDistanceKm = 0,
  remainingDistanceKm = 0,
  currentSpeed = 0,
  gpsStatus = 'ACTIVE',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const originMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const plannedPolylineRef = useRef(null);
  const remainingPolylineRef = useRef(null);
  const activePathCasingRef = useRef(null);
  const activePathPolylineRef = useRef(null);
  const segmentPolylinesRef = useRef([]);
  const beaconMarkersRef = useRef([]);

  // Navigation Tracking State Refs
  const isFollowingRef = useRef(true);
  const [isFollowing, setIsFollowing] = useState(true);
  const hasInitializedInitialZoomRef = useRef(false);
  const acceptedPathCoordsRef = useRef([]);
  const lastAcceptedCoordRef = useRef(null);
  const markerAnimationFrameRef = useRef(null);
  const previousTrackingStateRef = useRef(false);
  const currentHeadingRef = useRef(0);
  const [liveHeading, setLiveHeading] = useState(0);

  // Active theme color
  const activeModeKey = (selectedRoute?.mode || currentMode || 'WALKING').toUpperCase();
  const activeColor = MODE_COLORS[activeModeKey] || '#10b981';

  // ---------------------------------------------------------------------------
  // 1. Initialize Map Instance (Executed ONCE)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const hasInitialLocation = Number.isFinite(currentLocation?.lat) && Number.isFinite(currentLocation?.lng);
      const hasRouteOrigin = Number.isFinite(selectedRoute?.origin?.latitude) && Number.isFinite(selectedRoute?.origin?.longitude);

      const centerLat = hasInitialLocation ? currentLocation.lat : (hasRouteOrigin ? selectedRoute.origin.latitude : 18.5204);
      const centerLng = hasInitialLocation ? currentLocation.lng : (hasRouteOrigin ? selectedRoute.origin.longitude : 73.8567);

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: hasInitialLocation || hasRouteOrigin ? 14 : 12,
        zoomControl: false,
        attributionControl: false,
      });

      // Clean OpenStreetMap raster tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      }).addTo(map);

      // Clean zoom controls at bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Detect user manual pan / drag to detach follow mode
      map.on('dragstart', () => {
        isFollowingRef.current = false;
        setIsFollowing(false);
      });

      map.on('zoomstart', (e) => {
        if (e.originalEvent) {
          isFollowingRef.current = false;
          setIsFollowing(false);
        }
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (markerAnimationFrameRef.current) {
        cancelAnimationFrame(markerAnimationFrameRef.current);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 2. Render Planned Route Overview (Pre-journey & Live planned line)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // A. Render Origin (A) Marker
    if (selectedRoute?.origin?.latitude && selectedRoute?.origin?.longitude) {
      const origLat = selectedRoute.origin.latitude;
      const origLng = selectedRoute.origin.longitude;

      const originIconHtml = `
        <div style="
          background: #059669;
          color: #ffffff;
          font-weight: 800;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 9999px;
          border: 2px solid #ffffff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.3);
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <span>🚩 A: ${selectedRoute.origin.name || 'Origin'}</span>
        </div>
      `;

      const originIcon = L.divIcon({
        className: 'origin-map-marker',
        html: originIconHtml,
        iconSize: [80, 24],
        iconAnchor: [40, 12],
      });

      if (originMarkerRef.current) {
        originMarkerRef.current.setLatLng([origLat, origLng]);
        originMarkerRef.current.setIcon(originIcon);
      } else {
        originMarkerRef.current = L.marker([origLat, origLng], { icon: originIcon, zIndexOffset: 900 }).addTo(map);
      }
    } else if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }

    // B. Render Destination (B) Marker
    if (selectedRoute?.destination?.latitude && selectedRoute?.destination?.longitude) {
      const destLat = selectedRoute.destination.latitude;
      const destLng = selectedRoute.destination.longitude;

      const destIconHtml = `
        <div style="
          background: #dc2626;
          color: #ffffff;
          font-weight: 800;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 9999px;
          border: 2px solid #ffffff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.3);
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <span>🏁 B: ${selectedRoute.destination.name || 'Destination'}</span>
        </div>
      `;

      const destIcon = L.divIcon({
        className: 'dest-map-marker',
        html: destIconHtml,
        iconSize: [80, 24],
        iconAnchor: [40, 12],
      });

      if (destMarkerRef.current) {
        destMarkerRef.current.setLatLng([destLat, destLng]);
        destMarkerRef.current.setIcon(destIcon);
      } else {
        destMarkerRef.current = L.marker([destLat, destLng], { icon: destIcon, zIndexOffset: 900 }).addTo(map);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }

    // C. Draw Planned Route Polyline
    const routeCoords = remainingRouteCoordinates || selectedRoute?.coordinates;
    if (routeCoords && routeCoords.length > 1) {
      const latLngs = routeCoords.map((pt) => [pt[0], pt[1]]);

      if (plannedPolylineRef.current) {
        plannedPolylineRef.current.setLatLngs(latLngs);
        plannedPolylineRef.current.setStyle({
          color: isTracking ? '#64748b' : activeColor,
          dashArray: isTracking ? '6, 8' : undefined,
          opacity: isTracking ? 0.7 : 0.95,
        });
      } else {
        plannedPolylineRef.current = L.polyline(latLngs, {
          color: isTracking ? '#64748b' : activeColor,
          weight: 6,
          opacity: isTracking ? 0.7 : 0.95,
          dashArray: isTracking ? '6, 8' : undefined,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map);
      }

      // Auto-fit route inside viewport on pre-journey overview or route change
      if (!isTracking && latLngs.length > 0) {
        try {
          const bounds = L.latLngBounds(latLngs);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        } catch (e) {
          // ignore bounds fitting error
        }
      }
    } else if (plannedPolylineRef.current) {
      plannedPolylineRef.current.remove();
      plannedPolylineRef.current = null;
    }
  }, [selectedRoute, remainingRouteCoordinates, isTracking, activeColor]);

  // ---------------------------------------------------------------------------
  // 3. Reset Live Paths when a new journey starts
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const hasStartedNewJourney = isTracking && !previousTrackingStateRef.current;
    previousTrackingStateRef.current = isTracking;

    if (hasStartedNewJourney) {
      hasInitializedInitialZoomRef.current = false;
      acceptedPathCoordsRef.current = [];
      lastAcceptedCoordRef.current = null;

      if (activePathPolylineRef.current) {
        activePathPolylineRef.current.remove();
        activePathPolylineRef.current = null;
      }
      if (activePathCasingRef.current) {
        activePathCasingRef.current.remove();
        activePathCasingRef.current = null;
      }
      isFollowingRef.current = true;
      setIsFollowing(true);
    }
  }, [isTracking]);

  // ---------------------------------------------------------------------------
  // 4. Create or Update Google-Maps-Style Navigation Location Marker
  // ---------------------------------------------------------------------------
  const updateNavigationMarker = useCallback((lat, lng, headingDeg, color, isMoving) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const navIconHtml = `
      <div class="gmaps-nav-marker-wrapper" style="position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;">
        <!-- Radar Pulse Aura (Active when tracking) -->
        ${isTracking ? `<div style="
          position: absolute;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: ${color}35;
          animation: gmapsPulse 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>` : ''}

        <!-- Directional Heading Cone / Arrow -->
        <div style="
          position: absolute;
          width: 46px;
          height: 46px;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          transform: rotate(${headingDeg}deg);
          transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
        ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="margin-top: -3px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35));">
            <path d="M12 2L19 19L12 15L5 19L12 2Z" fill="${color}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
          </svg>
        </div>

        <!-- Central GPS Core Dot -->
        <div style="
          position: relative;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          border: 3.5px solid ${color};
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        ">
          <div style="width: 6px; height: 6px; border-radius: 50%; background: ${color};"></div>
        </div>
      </div>
    `;

    const navIcon = L.divIcon({
      className: 'gmaps-nav-user-marker',
      html: navIconHtml,
      iconSize: [46, 46],
      iconAnchor: [23, 23],
    });

    if (userMarkerRef.current) {
      const from = userMarkerRef.current.getLatLng();
      const to = L.latLng(lat, lng);
      const startedAt = performance.now();
      const durationMs = 300;

      if (markerAnimationFrameRef.current) cancelAnimationFrame(markerAnimationFrameRef.current);
      const animate = (now) => {
        const progress = Math.min(1, (now - startedAt) / durationMs);
        const eased = 1 - ((1 - progress) ** 3);
        userMarkerRef.current?.setLatLng([
          from.lat + ((to.lat - from.lat) * eased),
          from.lng + ((to.lng - from.lng) * eased),
        ]);
        if (progress < 1) markerAnimationFrameRef.current = requestAnimationFrame(animate);
      };
      markerAnimationFrameRef.current = requestAnimationFrame(animate);
      userMarkerRef.current.setIcon(navIcon);
    } else {
      userMarkerRef.current = L.marker([lat, lng], {
        icon: navIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    }
  }, [isTracking]);

  // ---------------------------------------------------------------------------
  // 5. Real-time GPS Position Ingestion & Navigation Tracking
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current || !Number.isFinite(currentLocation?.lat) || !Number.isFinite(currentLocation?.lng)) return;
    const map = mapInstanceRef.current;

    const lat = currentLocation.lat;
    const lng = currentLocation.lng;
    const accuracy = Number(currentLocation.accuracy);
    const isMoving = (currentLocation.speed || 0) > 0.5;

    // A. Heading Computation
    let targetHeading = currentHeadingRef.current;
    if (currentLocation.heading !== undefined && currentLocation.heading !== null && !isNaN(currentLocation.heading) && currentLocation.heading > 0) {
      targetHeading = currentLocation.heading;
    } else if (lastAcceptedCoordRef.current) {
      const prevLat = lastAcceptedCoordRef.current.lat;
      const prevLng = lastAcceptedCoordRef.current.lng;
      const dLat = (lat - prevLat) * Math.PI / 180;
      const dLng = (lng - prevLng) * Math.PI / 180;
      const distMeters = 6371000 * Math.sqrt(dLat * dLat + Math.cos(lat * Math.PI / 180) * Math.cos(prevLat * Math.PI / 180) * dLng * dLng);

      if (distMeters >= 1.5) {
        const y = Math.sin(dLng) * Math.cos(lat * Math.PI / 180);
        const x = Math.cos(prevLat * Math.PI / 180) * Math.sin(lat * Math.PI / 180) -
                  Math.sin(prevLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.cos(dLng);
        const b = Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
        targetHeading = b;
      }
    }
    currentHeadingRef.current = targetHeading;
    setLiveHeading(targetHeading);

    // B. Append to Traveled GPS Path Polyline (Completed portion)
    if (isTracking) {
      const last = lastAcceptedCoordRef.current;
      const isNewPoint = !last || (Math.abs(last.lat - lat) > 0.00002 || Math.abs(last.lng - lng) > 0.00002);

      if (isNewPoint) {
        lastAcceptedCoordRef.current = { lat, lng, timestamp: Date.now() };
        acceptedPathCoordsRef.current.push([lat, lng]);

        // Casing Polyline (Dark base for maximum street visibility)
        if (activePathCasingRef.current) {
          activePathCasingRef.current.setLatLngs(acceptedPathCoordsRef.current);
        } else if (acceptedPathCoordsRef.current.length > 1) {
          activePathCasingRef.current = L.polyline(acceptedPathCoordsRef.current, {
            color: '#0f172a',
            weight: 8,
            opacity: 0.35,
            lineJoin: 'round',
            lineCap: 'round',
          }).addTo(map);
        }

        // Inner Active Traveled Polyline (Vibrant active mode color)
        if (activePathPolylineRef.current) {
          activePathPolylineRef.current.setLatLngs(acceptedPathCoordsRef.current);
          activePathPolylineRef.current.setStyle({ color: activeColor });
        } else if (acceptedPathCoordsRef.current.length > 1) {
          activePathPolylineRef.current = L.polyline(acceptedPathCoordsRef.current, {
            color: activeColor,
            weight: 5,
            opacity: 0.95,
            lineJoin: 'round',
            lineCap: 'round',
          }).addTo(map);
        }
      }
    }

    // C. Update User Marker
    updateNavigationMarker(lat, lng, targetHeading, activeColor, isMoving);

    // D. Dynamic GPS Accuracy Circle
    if (Number.isFinite(accuracy) && accuracy > 0 && accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng([lat, lng]);
      accuracyCircleRef.current.setRadius(accuracy);
      accuracyCircleRef.current.setStyle({ color: activeColor, fillColor: activeColor });
    } else if (Number.isFinite(accuracy) && accuracy > 0) {
      accuracyCircleRef.current = L.circle([lat, lng], {
        radius: accuracy,
        color: activeColor,
        fillColor: activeColor,
        fillOpacity: 0.14,
        weight: 1.5,
        dashArray: '3, 4',
      }).addTo(map);
    }

    // E. Navigation Zoom & Follow Mode
    if (isTracking && !hasInitializedInitialZoomRef.current) {
      hasInitializedInitialZoomRef.current = true;
      map.setView([lat, lng], 17, { animate: true });
    } else if (isTracking && isFollowingRef.current) {
      map.panTo([lat, lng], { animate: true, duration: 0.75 });
    }
  }, [currentLocation, currentMode, isTracking, activeColor, updateNavigationMarker]);

  // ---------------------------------------------------------------------------
  // 6. Render Completed Multi-Segment Colors
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    segmentPolylinesRef.current.forEach((poly) => poly.remove());
    segmentPolylinesRef.current = [];

    segments.forEach((seg, idx) => {
      if (seg.waypoints && seg.waypoints.length > 1) {
        const latLngs = seg.waypoints.map((wp) => [wp.lat, wp.lng]);
        const color = MODE_COLORS[seg.mode] || '#10b981';

        const polyline = L.polyline(latLngs, {
          color: color,
          weight: 6,
          opacity: 0.9,
          lineJoin: 'round',
        }).addTo(map);

        polyline.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px;">
            <strong>Segment ${idx + 1}: ${seg.mode}</strong><br/>
            Distance: ${seg.distanceKm} km<br/>
            Duration: ${seg.durationMinutes} mins
          </div>
        `);

        segmentPolylinesRef.current.push(polyline);
      }
    });
  }, [segments]);

  // ---------------------------------------------------------------------------
  // 7. Recenter Follow Mode Action
  // ---------------------------------------------------------------------------
  const handleRecenter = () => {
    if (mapInstanceRef.current && Number.isFinite(currentLocation?.lat) && Number.isFinite(currentLocation?.lng)) {
      isFollowingRef.current = true;
      setIsFollowing(true);
      mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 17, { animate: true });
    } else if (mapInstanceRef.current && selectedRoute?.coordinates?.length > 0) {
      try {
        const bounds = L.latLngBounds(selectedRoute.coordinates);
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
      } catch (e) {}
    }
  };

  const ModeIcon = MODE_ICONS[currentMode] || Footprints;
  const formattedDuration = `${Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:${(elapsedSeconds % 60).toString().padStart(2, '0')}`;
  const hasGpsFix = Number.isFinite(currentLocation?.lat) && Number.isFinite(currentLocation?.lng);

  const getManeuverIcon = (maneuver) => {
    switch (maneuver) {
      case 'turn-right':
      case 'right':
        return <CornerUpRight size={22} className="text-emerald-400" />;
      case 'turn-left':
      case 'left':
        return <CornerUpLeft size={22} className="text-emerald-400" />;
      case 'slight-right':
        return <ArrowUpRight size={22} className="text-emerald-400" />;
      case 'slight-left':
        return <ArrowUpLeft size={22} className="text-emerald-400" />;
      case 'roundabout':
        return <RotateCw size={22} className="text-emerald-400" />;
      case 'arrive':
        return <Flag size={22} className="text-emerald-400" />;
      default:
        return <ArrowUp size={22} className="text-emerald-400" />;
    }
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '460px',
      borderRadius: '20px',
      overflow: 'hidden',
      border: '1.5px solid var(--slate-200)',
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
      background: '#f8fafc',
    }}>
      {/* Underlying Leaflet Map Container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

      {/* ===================================================================== */}
      {/* OVERLAY 1: TURN-BY-TURN / OFF-ROUTE FLOATING HEADER BANNER           */}
      {/* ===================================================================== */}
      {isTracking && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '70px',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          {isOffRoute ? (
            <div style={{
              background: '#991b1b',
              color: '#ffffff',
              borderRadius: '14px',
              padding: '10px 14px',
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              {isRerouting ? (
                <Loader2 size={20} className="animate-spin text-amber-300" />
              ) : (
                <AlertTriangle size={20} className="text-amber-300" />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>
                  {isRerouting ? 'Recalculating route...' : '⚠ You are off route'}
                </div>
                <div style={{ fontSize: '0.74rem', opacity: 0.9 }}>
                  {isRerouting ? 'Fetching new route from your current GPS position' : 'Recalculating optimal path to destination'}
                </div>
              </div>
            </div>
          ) : currentStep ? (
            <div style={{
              background: 'rgba(15, 23, 42, 0.94)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '14px',
              padding: '8px 14px',
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {getManeuverIcon(currentStep.maneuver)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {currentStep.instruction || 'Continue on route'}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600 }}>
                  {currentStep.distanceMeters > 0 ? (
                    currentStep.distanceMeters >= 1000
                      ? `${(currentStep.distanceMeters / 1000).toFixed(1)} km`
                      : `${currentStep.distanceMeters} m`
                  ) : 'In progress'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              border: `1.5px solid ${activeColor}`,
              borderRadius: '12px',
              padding: '6px 12px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: 'fit-content',
            }}>
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: activeColor,
                boxShadow: `0 0 8px ${activeColor}`,
              }} className="animate-pulse-subtle" />
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                {activeModeKey} Navigation Active
              </span>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* OVERLAY 2: PRE-JOURNEY ROUTE BADGE                                    */}
      {/* ===================================================================== */}
      {!isTracking && selectedRoute && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 10,
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(10px)',
          border: `1.5px solid ${activeColor}`,
          borderRadius: '12px',
          padding: '6px 12px',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: activeColor,
          }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--slate-900)' }}>
              {selectedRoute.mode} Route Overview
            </span>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--slate-500)' }}>
              {selectedRoute.distanceText || `${selectedRoute.distanceKm} km`} &bull; {selectedRoute.durationText || `${selectedRoute.durationMinutes} min`}
            </span>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* OVERLAY 3: GOOGLE-MAPS-STYLE RECENTER FAB                             */}
      {/* ===================================================================== */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 10,
      }}>
        <button
          type="button"
          onClick={handleRecenter}
          style={{
            background: isFollowing ? activeColor : '#ffffff',
            color: isFollowing ? '#ffffff' : 'var(--slate-700)',
            border: isFollowing ? `1.5px solid ${activeColor}` : '1.5px solid var(--slate-200)',
            borderRadius: '12px',
            padding: '8px 12px',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.78rem',
            fontWeight: 800,
            transition: 'all 0.2s ease',
          }}
          title={isFollowing ? 'Follow Mode Active' : 'Recenter map'}
        >
          {isFollowing ? (
            <>
              <LocateFixed size={16} />
              <span>Following</span>
            </>
          ) : (
            <>
              <Locate size={16} className="text-emerald-600" />
              <span>Recenter</span>
            </>
          )}
        </button>
      </div>

      {/* ===================================================================== */}
      {/* OVERLAY 4: LIVE TELEMETRY NAVIGATION HUD                              */}
      {/* ===================================================================== */}
      {isTracking && (
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          right: '12px',
          zIndex: 10,
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '14px',
          padding: '8px 14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#ffffff',
          animation: 'fadeIn 0.25s ease-out',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          {/* Speed */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
              Speed
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
              {currentSpeed.toFixed(1)} <small style={{ fontSize: '0.62rem' }}>km/h</small>
            </span>
          </div>

          <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.15)' }} />

          {/* Travelled */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
              Travelled
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
              {totalDistanceKm.toFixed(2)} <small style={{ fontSize: '0.62rem' }}>km</small>
            </span>
          </div>

          <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.15)' }} />

          {/* Remaining */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
              Remaining
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
              {remainingDistanceKm > 0 ? remainingDistanceKm.toFixed(2) : '0.00'} <small style={{ fontSize: '0.62rem' }}>km</small>
            </span>
          </div>

          <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.15)' }} />

          {/* Duration */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
              Duration
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
              {formattedDuration}
            </span>
          </div>

          <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.15)' }} />

          {/* Heading */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>
              Heading
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Compass size={12} color="#f59e0b" />
              <span>{formatHeadingCompass(liveHeading)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
