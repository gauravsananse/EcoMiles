import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Compass, Layers } from 'lucide-react';

const MODE_COLORS = {
  WALKING: '#10b981', // Emerald
  CYCLING: '#f59e0b', // Amber
  BUS: '#3b82f6',     // Blue
  METRO: '#8b5cf6',   // Purple
  CAR: '#64748b',     // Slate
  SCOOTER: '#f97316', // Orange
  STATIONARY: '#94a3b8',
  UNKNOWN: '#cbd5e1',
};

export default function MobilityMap({
  currentLocation,
  segments = [],
  currentMode = 'STATIONARY',
  transitBeacons = [],
  isTracking = false,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const userMarkerRef = useRef(null);
  const routePolylinesRef = useRef([]);
  const beaconMarkersRef = useRef([]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = currentLocation?.lat || 28.6139;
      const initialLng = currentLocation?.lng || 77.2090;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 15,
        zoomControl: false,
      });

      // Add clean OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update User Location Marker & Pulse
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const lat = currentLocation?.lat || 28.6139;
    const lng = currentLocation?.lng || 77.2090;
    const color = MODE_COLORS[currentMode] || '#10b981';

    const customIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div style="
          position: relative;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: ${color};
          border: 3px solid #ffffff;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
        ">
          ${isTracking ? `<div style="
            position: absolute;
            top: -6px;
            left: -6px;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: ${color};
            opacity: 0.4;
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>` : ''}
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([lat, lng]);
      userMarkerRef.current.setIcon(customIcon);
    } else {
      userMarkerRef.current = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    }

    if (isTracking && currentLocation?.lat) {
      map.panTo([lat, lng], { animate: true, duration: 0.5 });
    }
  }, [currentLocation, currentMode, isTracking]);

  // Render Segment Polylines with distinctive Mode colors
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear old polylines
    routePolylinesRef.current.forEach((poly) => poly.remove());
    routePolylinesRef.current = [];

    segments.forEach((seg, idx) => {
      if (seg.waypoints && seg.waypoints.length > 1) {
        const latLngs = seg.waypoints.map((wp) => [wp.lat, wp.lng]);
        const color = MODE_COLORS[seg.mode] || '#10b981';

        const polyline = L.polyline(latLngs, {
          color: color,
          weight: 5,
          opacity: 0.85,
          lineJoin: 'round',
        }).addTo(map);

        polyline.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px;">
            <strong>Segment ${idx + 1}: ${seg.mode}</strong><br/>
            Distance: ${seg.distanceKm} km<br/>
            Duration: ${seg.durationMinutes} mins<br/>
            Confidence: ${Math.round((seg.confidence || 0.9) * 100)}%
          </div>
        `);

        routePolylinesRef.current.push(polyline);
      }
    });
  }, [segments]);

  // Render Transit Beacon Markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    beaconMarkersRef.current.forEach((m) => m.remove());
    beaconMarkersRef.current = [];

    transitBeacons.forEach((b) => {
      if (b.location && b.location.lat && b.location.lng) {
        const iconHtml = b.transportType === 'BUS' ? '🚌' : (b.transportType === 'METRO' ? '🚇' : '⚡');
        const bIcon = L.divIcon({
          className: 'transit-beacon-icon',
          html: `<div style="
            background: #ffffff;
            border: 2px solid #059669;
            border-radius: 8px;
            padding: 2px 5px;
            font-size: 13px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          ">${iconHtml}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const marker = L.marker([b.location.lat, b.location.lng], { icon: bIcon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px;">
            <strong>${b.stationName || b.beaconId}</strong><br/>
            Type: ${b.transportType}<br/>
            Operator: ${b.operator}
          </div>
        `);
        beaconMarkersRef.current.push(marker);
      }
    });
  }, [transitBeacons]);

  const handleCenterMap = () => {
    if (mapInstanceRef.current && currentLocation?.lat) {
      mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 16, { animate: true });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '360px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--slate-200)' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

      {/* Recenter floating button */}
      <button
        type="button"
        onClick={handleCenterMap}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 10,
          background: '#ffffff',
          border: '1px solid var(--slate-200)',
          borderRadius: '10px',
          padding: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--slate-700)',
        }}
        title="Center on Live Location"
      >
        <Navigation size={14} className="text-emerald-600" />
        <span>Center</span>
      </button>

      {/* Legend Pill */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        zIndex: 10,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(6px)',
        border: '1px solid var(--slate-200)',
        borderRadius: '10px',
        padding: '6px 10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.72rem',
        fontWeight: 600,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} /> Walk
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} /> Cycle
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} /> Bus
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6' }} /> Metro
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748b' }} /> Car
        </div>
      </div>
    </div>
  );
}
