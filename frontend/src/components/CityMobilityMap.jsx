import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Layers,
  MapPin,
  Flame,
  Bus,
  Footprints,
  Bike,
  Zap,
  Info,
  Compass,
  AlertCircle
} from 'lucide-react';

// Coordinates center for areas
const AREA_CENTERS = {
  ALL: [18.5204, 73.8567, 12],
  'Entire City': [18.5204, 73.8567, 12],
  Hinjewadi: [18.5913, 73.7389, 14],
  Shivajinagar: [18.5314, 73.8446, 14],
  Kothrud: [18.5074, 73.8077, 14],
  'Pune Station': [18.5284, 73.8744, 14],
  Swargate: [18.5018, 73.8586, 14],
  'Viman Nagar': [18.5679, 73.9143, 14],
  Baner: [18.5590, 73.7868, 14],
  PCMC: [18.6279, 73.8131, 13],
};

export default function CityMobilityMap({
  heatmapData = [],
  corridors = [],
  selectedArea = 'ALL',
  selectedMode = 'ALL',
  transitDemand = null,
  transportGaps = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);

  const [activeLayer, setActiveLayer] = useState('density'); // 'density' | 'corridors' | 'gaps'
  const [selectedCell, setSelectedCell] = useState(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [18.5204, 73.8567],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });

      // Standard OpenStreetMap tiles (consistent with existing app)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map center on area change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const target = AREA_CENTERS[selectedArea] || AREA_CENTERS.ALL;
    mapInstanceRef.current.flyTo([target[0], target[1]], target[2], { duration: 1.2 });
  }, [selectedArea]);

  // Render dynamic layers based on activeLayer state
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    // 1. DENSITY HEATMAP LAYER
    if (activeLayer === 'density') {
      heatmapData.forEach((cell) => {
        // Radius scales with weight
        const radius = Math.min(380, Math.max(160, cell.weight * 35));
        const color = cell.densityLevel === 'HIGH' ? '#ef4444' : (cell.densityLevel === 'MEDIUM' ? '#f59e0b' : '#10b981');

        const circle = L.circle([cell.lat, cell.lng], {
          color: color,
          fillColor: color,
          fillOpacity: 0.45,
          weight: 2,
          radius: radius,
        });

        const popupContent = `
          <div style="font-family: system-ui, sans-serif; padding: 4px 6px; min-width: 170px;">
            <div style="font-weight: 800; font-size: 0.92rem; color: #0f172a; margin-bottom: 3px;">
              ${cell.zoneName}
            </div>
            <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 6px;">
              Area: <strong>${cell.area}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 3px;">
              <span>Density:</span>
              <strong style="color: ${color};">${cell.densityLevel}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 3px;">
              <span>Verified Journeys:</span>
              <strong>${cell.journeyCount}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 3px;">
              <span>Dominant Mode:</span>
              <strong>${cell.dominantMode}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
              <span>Avg Distance:</span>
              <strong>${cell.avgDistanceKm} km</strong>
            </div>
          </div>
        `;

        circle.bindPopup(popupContent);
        circle.on('click', () => {
          setSelectedCell(cell);
        });

        circle.addTo(layerGroup);
      });
    }

    // 2. CORRIDORS LAYER
    if (activeLayer === 'corridors') {
      corridors.forEach((corr, idx) => {
        if (!corr.coordinates || corr.coordinates.length < 2) return;

        const isTop = idx < 3;
        const color = corr.dominantMode === 'WALKING' ? '#10b981' : (corr.dominantMode === 'CYCLING' ? '#f59e0b' : (corr.dominantMode === 'EV' ? '#059669' : '#3b82f6'));

        const polyline = L.polyline(corr.coordinates, {
          color: color,
          weight: isTop ? 6 : 4,
          opacity: 0.85,
          dashArray: isTop ? null : '6, 8',
        });

        const popupContent = `
          <div style="font-family: system-ui, sans-serif; padding: 4px; min-width: 180px;">
            <div style="font-weight: 800; font-size: 0.88rem; color: #0f172a;">${corr.name}</div>
            <div style="font-size: 0.75rem; margin-top: 4px; color: #475569;">
              <div><strong>Journeys:</strong> ${corr.journeyCount}</div>
              <div><strong>Mode:</strong> ${corr.dominantMode}</div>
              <div><strong>Peak:</strong> ${corr.peakTime}</div>
              <div><strong>Avg Distance:</strong> ${corr.avgDistanceKm} km</div>
            </div>
          </div>
        `;

        polyline.bindPopup(popupContent);
        polyline.addTo(layerGroup);

        // Origin and Destination markers
        L.circleMarker(corr.coordinates[0], { radius: 6, color: '#ffffff', fillColor: color, fillOpacity: 1, weight: 2 }).addTo(layerGroup);
        L.circleMarker(corr.coordinates[1], { radius: 6, color: '#ffffff', fillColor: color, fillOpacity: 1, weight: 2 }).addTo(layerGroup);
      });
    }

    // 3. TRANSPORT GAPS & FIRST-MILE LAYER
    if (activeLayer === 'gaps') {
      // High demand + low transit gaps
      transportGaps?.gapOpportunities?.forEach((gap) => {
        if (!gap.coordinates) return;
        const marker = L.circleMarker(gap.coordinates, {
          radius: 12,
          color: '#ef4444',
          fillColor: '#fee2e2',
          fillOpacity: 0.85,
          weight: 3,
        });

        marker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 220px;">
            <div style="font-weight: 800; font-size: 0.88rem; color: #b91c1c;">⚠️ ${gap.connectivityStatus}</div>
            <div style="font-size: 0.78rem; font-weight: 700; margin: 4px 0 2px;">${gap.zoneName}</div>
            <div style="font-size: 0.72rem; color: #475569; line-height: 1.4;">${gap.recommendation}</div>
          </div>
        `);
        marker.addTo(layerGroup);
      });

      // First-Mile / Last-Mile opportunities
      transportGaps?.firstLastMileOpportunities?.forEach((fl) => {
        if (!fl.coordinates) return;
        const marker = L.circleMarker(fl.coordinates, {
          radius: 10,
          color: '#3b82f6',
          fillColor: '#dbeafe',
          fillOpacity: 0.85,
          weight: 2,
        });

        marker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 220px;">
            <div style="font-weight: 800; font-size: 0.88rem; color: #1d4ed8;">🚶 ${fl.opportunityTitle}</div>
            <div style="font-size: 0.75rem; color: #475569; margin: 4px 0;">${fl.insight}</div>
            <div style="font-size: 0.72rem; color: #059669;"><strong>Action:</strong> ${fl.recommendation}</div>
          </div>
        `);
        marker.addTo(layerGroup);
      });
    }
  }, [activeLayer, heatmapData, corridors, transportGaps]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '480px', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--slate-200)', boxShadow: 'var(--shadow-sm)' }}>
      {/* Interactive Map Canvas */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

      {/* Layer Switcher Controls (Top Right Floating) */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(8px)',
        padding: '6px',
        borderRadius: '12px',
        border: '1px solid var(--slate-200)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        display: 'flex',
        gap: '4px',
      }}>
        <button
          onClick={() => setActiveLayer('density')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeLayer === 'density' ? '#10b981' : 'transparent',
            color: activeLayer === 'density' ? '#ffffff' : 'var(--slate-700)',
            transition: 'all 0.15s ease',
          }}
        >
          <Flame size={14} />
          <span>Mobility Heatmap</span>
        </button>

        <button
          onClick={() => setActiveLayer('corridors')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeLayer === 'corridors' ? '#3b82f6' : 'transparent',
            color: activeLayer === 'corridors' ? '#ffffff' : 'var(--slate-700)',
            transition: 'all 0.15s ease',
          }}
        >
          <Layers size={14} />
          <span>Corridors ({corridors.length})</span>
        </button>

        <button
          onClick={() => setActiveLayer('gaps')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeLayer === 'gaps' ? '#ef4444' : 'transparent',
            color: activeLayer === 'gaps' ? '#ffffff' : 'var(--slate-700)',
            transition: 'all 0.15s ease',
          }}
        >
          <AlertCircle size={14} />
          <span>Transport Gaps</span>
        </button>
      </div>

      {/* Map Legend Overlay (Bottom Left Floating) */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(8px)',
        padding: '8px 12px',
        borderRadius: '12px',
        border: '1px solid var(--slate-200)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        fontSize: '0.73rem',
        color: 'var(--slate-700)',
        maxWidth: '280px',
      }}>
        <div style={{ fontWeight: 800, marginBottom: '5px', color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Compass size={13} className="text-emerald-600" />
          <span>Mobility Density Levels</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span>Low</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            <span>Medium</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            <span>High</span>
          </div>
        </div>
        <div style={{ fontSize: '0.67rem', color: 'var(--slate-400)', marginTop: '4px' }}>
          Aggregated to ~500m anonymous zones. Personal coordinates are not exposed.
        </div>
      </div>

      {/* Selected Zone Popover Detail (Top Left) */}
      {selectedCell && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 1000,
          background: '#ffffff',
          padding: '10px 14px',
          borderRadius: '12px',
          border: '1px solid var(--slate-200)',
          boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
          maxWidth: '240px',
          fontSize: '0.78rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontWeight: 800, color: 'var(--slate-900)' }}>{selectedCell.zoneName}</div>
            <button
              onClick={() => setSelectedCell(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--slate-400)', lineHeight: 1 }}
            >
              &times;
            </button>
          </div>
          <div style={{ marginTop: '4px', color: 'var(--slate-600)' }}>
            <div>Density: <strong style={{ color: selectedCell.color }}>{selectedCell.densityLevel}</strong></div>
            <div>Journeys: <strong>{selectedCell.journeyCount}</strong></div>
            <div>Dominant Mode: <strong>{selectedCell.dominantMode}</strong></div>
            <div>Avg Distance: <strong>{selectedCell.avgDistanceKm} km</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}
