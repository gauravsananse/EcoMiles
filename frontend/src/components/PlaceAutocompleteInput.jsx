import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Loader2, X, LocateFixed, AlertCircle,
  School, Coffee, Building2, Navigation, Home, Landmark,
  TreePine, ShoppingBag, Hospital, Train, Plane
} from 'lucide-react';
import { api } from '../services/api';

// ─── Icon mapping for place categories ───────────────────────────────────────
const CATEGORY_ICONS = {
  university:    School,
  college:       School,
  school:        School,
  cafe:          Coffee,
  restaurant:    Coffee,
  food:          Coffee,
  hotel:         Building2,
  hospital:      Hospital,
  clinic:        Hospital,
  station:       Train,
  railway:       Train,
  airport:       Plane,
  park:          TreePine,
  garden:        TreePine,
  shop:          ShoppingBag,
  mall:          ShoppingBag,
  office:        Building2,
  commercial:    Building2,
  industrial:    Building2,
  residential:   Home,
  locality:      MapPin,
  neighbourhood: MapPin,
  suburb:        MapPin,
  village:       MapPin,
  hamlet:        MapPin,
  city:          MapPin,
  town:          MapPin,
};

function getPlaceIcon(category, name = '') {
  if (!category && !name) return MapPin;
  const cat = (category || '').toLowerCase();
  const n = (name || '').toLowerCase();

  for (const [key, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (cat.includes(key) || n.includes(key)) return Icon;
  }
  return MapPin;
}

// ─── Direct geocoder (bypasses backend, calls OSM APIs from browser) ──────────
async function directGeocoderSearch(query) {
  const results = [];
  const seenCoords = new Set();

  const buildAddr = (parts) => parts.filter(Boolean).join(', ');

  const [photonData, nomData] = await Promise.allSettled([
    fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=15`,
      { signal: AbortSignal.timeout(4000) }
    ).then((r) => r.json()),
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&extratags=1&namedetails=1&limit=12`,
      {
        headers: { 'User-Agent': 'GreenCredits-SmartMobility/1.0' },
        signal: AbortSignal.timeout(4000),
      }
    ).then((r) => r.json()),
  ]);

  // Photon
  if (photonData.status === 'fulfilled' && photonData.value?.features) {
    for (const f of photonData.value.features) {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates || [0, 0];
      const coordKey = `${Number(coords[1]).toFixed(4)}|${Number(coords[0]).toFixed(4)}`;
      if (seenCoords.has(coordKey)) continue;
      seenCoords.add(coordKey);

      const name = p.name || p.street || p.housenumber || query;
      const addrStr = buildAddr([
        p.housenumber && p.street ? `${p.housenumber} ${p.street}` : (p.street || p.housenumber),
        p.suburb || p.district,
        p.city || p.town || p.village,
        p.county,
        p.state,
        p.postcode,
        p.country,
      ]);

      results.push({
        placeId: `osm_${p.osm_id || Math.random().toString(36).slice(2, 9)}`,
        name,
        formattedAddress: addrStr ? `${name}, ${addrStr}` : name,
        secondaryText: addrStr,
        latitude: coords[1],
        longitude: coords[0],
        types: [p.osm_value || p.osm_key || 'place'],
        category: p.osm_value || p.osm_key,
      });
    }
  }

  // Nominatim
  if (nomData.status === 'fulfilled' && Array.isArray(nomData.value)) {
    for (const item of nomData.value) {
      const lat2 = parseFloat(item.lat);
      const lng2 = parseFloat(item.lon);
      const coordKey = `${lat2.toFixed(4)}|${lng2.toFixed(4)}`;
      if (seenCoords.has(coordKey)) continue;
      seenCoords.add(coordKey);

      const addr = item.address || {};
      const name =
        (item.namedetails && item.namedetails.name) ||
        item.name ||
        item.display_name.split(',')[0].trim();

      const secondaryText = buildAddr([
        addr.house_number && addr.road
          ? `${addr.house_number} ${addr.road}`
          : addr.road || addr.pedestrian || addr.path,
        addr.neighbourhood || addr.suburb || addr.residential,
        addr.city || addr.town || addr.village || addr.hamlet,
        addr.county || addr.state_district,
        addr.state,
        addr.postcode,
        addr.country,
      ]);

      results.push({
        placeId: `nom_${item.place_id}`,
        name,
        formattedAddress: secondaryText ? `${name}, ${secondaryText}` : item.display_name,
        secondaryText,
        latitude: lat2,
        longitude: lng2,
        types: [item.type || item.class || 'place'],
        category: item.type || item.class,
      });
    }
  }

  return results;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PlaceAutocompleteInput({
  label,
  placeholder = 'Search any location, street, landmark, college...',
  value,
  onChange,
  onSelectPlace,
  showCurrentLocationOption = false,
  autoFocus = false,
  icon: InputIcon = MapPin,
  transitModeBias = null, // 'METRO' | 'BUS' | null
}) {
  const [query, setQuery] = useState(value?.name || (typeof value === 'string' ? value : ''));
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const sessionTokenRef = useRef(`session_${Date.now()}`);
  const debounceTimerRef = useRef(null);
  const abortRef = useRef(null);

  // Sync when value prop changes externally
  useEffect(() => {
    if (value && typeof value === 'object') {
      setQuery(value.name || value.formattedAddress || '');
    } else if (typeof value === 'string') {
      setQuery(value);
    }
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Search engine ──────────────────────────────────────────────────────────
  const runSearch = async (text) => {
    if (abortRef.current) abortRef.current.abort();

    const trimmed = text.trim();
    if (!trimmed) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // Try backend first (it may have Google Maps key)
      let backendResults = [];
      try {
        const res = await api.autocompletePlaces(trimmed, sessionTokenRef.current);
        if (res && res.success && Array.isArray(res.predictions) && res.predictions.length > 0) {
          backendResults = res.predictions;
        }
      } catch (_) {
        // Backend unreachable — fall through to direct search
      }

      // Priority transit query based on transitModeBias
      let priorityTransitResults = [];
      if (transitModeBias === 'METRO') {
        try {
          const mRes = await api.getMetroStations('Pune', trimmed);
          if (mRes && mRes.success && Array.isArray(mRes.stations)) {
            priorityTransitResults = mRes.stations.map((s) => ({
              placeId: `metro_${s.stationId}`,
              name: s.name,
              formattedAddress: `${s.name}, ${s.localName ? s.localName + ', ' : ''}${s.line}, ${s.city}`,
              secondaryText: `🚇 ${s.line} • ${s.isUnderground ? 'Underground' : 'Elevated'} • ${s.city}`,
              latitude: s.latitude,
              longitude: s.longitude,
              types: ['metro_station', 'transit_station'],
              category: 'station',
              isMetroPriority: true,
            }));
          }
        } catch (_) {}
      }

      // Merge: priority transit first, backend next, then direct results
      let merged = [...priorityTransitResults, ...backendResults];
      const seenCoords = new Set(
        merged
          .filter((r) => r.latitude && r.longitude)
          .map((r) => `${Number(r.latitude).toFixed(4)}|${Number(r.longitude).toFixed(4)}`)
      );

      for (const d of directResults) {
        if (!d.latitude || !d.longitude) continue;
        const coordKey = `${Number(d.latitude).toFixed(4)}|${Number(d.longitude).toFixed(4)}`;
        if (!seenCoords.has(coordKey)) {
          seenCoords.add(coordKey);
          merged.push(d);
        }
      }

      setSuggestions(merged.slice(0, 6)); // 3-6 top relevant suggestions for compact mobile UX
      setIsOpen(true);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[Search error]:', err.message);
        setSuggestions([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Input change handler ───────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const text = e.target.value;
    setQuery(text);
    setLocationError('');
    setSelectedIndex(-1);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!text.trim()) {
      setSuggestions([]);
      setIsOpen(showCurrentLocationOption); // keep open to show "Use my location"
      if (onChange) onChange('');
      return;
    }

    setIsOpen(true);
    setIsLoading(true);

    // Short debounce: 220ms for snappy feel
    debounceTimerRef.current = setTimeout(() => runSearch(text), 220);
  };

  // ── Select suggestion ──────────────────────────────────────────────────────
  const handleSelectSuggestion = async (suggestion) => {
    setIsOpen(false);
    setSelectedIndex(-1);

    // If we already have coords, use them directly
    if (suggestion.latitude && suggestion.longitude) {
      const placeObj = {
        placeId: suggestion.placeId,
        name: suggestion.name,
        formattedAddress: suggestion.formattedAddress,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
      };
      setQuery(placeObj.name);
      if (onSelectPlace) onSelectPlace(placeObj);
      return;
    }

    // Otherwise resolve via backend details
    setIsLoading(true);
    try {
      const res = await api.getPlaceDetails(suggestion.placeId, sessionTokenRef.current, suggestion.name);
      if (res.success && res.data) {
        setQuery(res.data.name || res.data.formattedAddress);
        if (onSelectPlace) onSelectPlace(res.data);
      }
    } catch (err) {
      console.error('Failed to get place details:', err);
      setLocationError('Unable to resolve coordinates. Please try a different result.');
    } finally {
      setIsLoading(false);
      sessionTokenRef.current = `session_${Date.now()}`;
    }
  };

  // ── GPS current location ───────────────────────────────────────────────────
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setLocationError('');
    setIsOpen(false);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        try {
          const res = await api.reverseGeocode(lat, lng);
          const loc = (res.success && res.location) ? res.location : {
            placeId: `curr_${Date.now()}`,
            name: 'Current Location',
            formattedAddress: `GPS Fix: ${lat.toFixed(5)}, ${lng.toFixed(5)} (±${Math.round(accuracy)}m)`,
            latitude: lat,
            longitude: lng,
          };
          setQuery(loc.name);
          if (onSelectPlace) onSelectPlace({ ...loc, latitude: lat, longitude: lng, accuracy });
        } catch {
          const fallback = {
            placeId: `curr_${Date.now()}`,
            name: 'Current Location',
            formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            latitude: lat,
            longitude: lng,
            accuracy,
          };
          setQuery(fallback.name);
          if (onSelectPlace) onSelectPlace(fallback);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) setLocationError('Location permission denied. Please type the address manually.');
        else if (err.code === 2) setLocationError('GPS position unavailable. Try again or type manually.');
        else setLocationError('Location request timed out. Please try again.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  // ── Keyboard navigation ────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    const total = (showCurrentLocationOption ? 1 : 0) + suggestions.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setSelectedIndex((p) => (p + 1 < total ? p + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((p) => (p - 1 >= 0 ? p - 1 : total - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showCurrentLocationOption && selectedIndex === 0) {
        handleUseCurrentLocation();
      } else {
        const si = showCurrentLocationOption ? selectedIndex - 1 : selectedIndex;
        if (suggestions[si]) handleSelectSuggestion(suggestions[si]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    setLocationError('');
    if (onChange) onChange('');
    if (onSelectPlace) onSelectPlace(null);
    inputRef.current?.focus();
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          color: 'var(--slate-500)',
          marginBottom: '0.35rem',
          letterSpacing: '0.05em',
        }}>
          {label}
        </label>
      )}

      {/* Input field */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#ffffff',
        border: `1.5px solid ${isOpen ? 'var(--primary-500)' : 'var(--slate-300)'}`,
        borderRadius: '12px',
        boxShadow: isOpen ? '0 0 0 3px rgba(16,185,129,0.10)' : 'var(--shadow-sm)',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}>
        <div style={{ padding: '0 0.75rem', display: 'flex', alignItems: 'center' }}>
          <InputIcon size={18} style={{ color: isOpen ? 'var(--primary-600)' : 'var(--slate-400)' }} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (!isOpen) {
              setIsOpen(true);
              if (query.trim()) runSearch(query);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: '0.92rem',
            padding: '0.72rem 0',
            color: 'var(--slate-900)',
            fontWeight: 500,
            background: 'transparent',
            minWidth: 0,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', paddingRight: '0.65rem', gap: '0.2rem' }}>
          {(isLoading || isLocating) ? (
            <Loader2 size={16} style={{ color: 'var(--primary-600)', animation: 'spin 0.8s linear infinite' }} />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'var(--slate-100)',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--slate-500)',
                padding: '3px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '22px',
                height: '22px',
              }}
              title="Clear"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Error notice */}
      {locationError && (
        <div style={{
          marginTop: '0.4rem',
          fontSize: '0.76rem',
          color: '#b91c1c',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '0.4rem 0.7rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '5px',
        }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{locationError}</span>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          background: '#ffffff',
          border: '1.5px solid var(--slate-200)',
          borderRadius: '14px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.14)',
          zIndex: 9999,
          maxHeight: '380px',
          overflowY: 'auto',
        }}>

          {/* "Use my current location" row */}
          {showCurrentLocationOption && (
            <div
              onClick={handleUseCurrentLocation}
              onMouseEnter={() => setSelectedIndex(0)}
              style={{
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: 'pointer',
                borderBottom: '1px solid var(--slate-100)',
                background: selectedIndex === 0 ? '#f0fdf4' : '#ffffff',
                borderRadius: '12px 12px 0 0',
                transition: 'background 0.12s',
              }}
            >
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%',
                background: '#ecfdf5', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
              }}>
                <LocateFixed size={17} style={{ color: '#059669' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#059669' }}>
                  📍 Use my current location
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginTop: '1px' }}>
                  Detect via GPS
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && suggestions.length === 0 && (
            <div style={{
              padding: '1.25rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: 'var(--slate-500)',
              fontSize: '0.84rem',
            }}>
              <Loader2 size={16} style={{ color: 'var(--primary-600)', animation: 'spin 0.8s linear infinite' }} />
              <span>Searching every location database...</span>
            </div>
          )}

          {/* Suggestion rows */}
          {suggestions.map((s, idx) => {
            const itemIdx = showCurrentLocationOption ? idx + 1 : idx;
            const isSelected = selectedIndex === itemIdx;
            const PlaceIcon = getPlaceIcon(s.category, s.name);

            return (
              <div
                key={s.placeId || idx}
                onClick={() => handleSelectSuggestion(s)}
                onMouseEnter={() => setSelectedIndex(itemIdx)}
                style={{
                  padding: '0.65rem 1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  background: isSelected ? '#f8fafc' : '#ffffff',
                  borderBottom: idx < suggestions.length - 1 ? '1px solid var(--slate-100)' : 'none',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: isSelected ? 'var(--primary-50)' : 'var(--slate-100)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px',
                }}>
                  <PlaceIcon size={15} style={{ color: isSelected ? 'var(--primary-600)' : 'var(--slate-500)' }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Place name */}
                  <div style={{
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: 'var(--slate-900)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {s.name}
                  </div>

                  {/* Full address line */}
                  {s.formattedAddress && s.formattedAddress !== s.name && (
                    <div style={{
                      fontSize: '0.74rem',
                      color: 'var(--slate-500)',
                      marginTop: '1px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {s.formattedAddress}
                    </div>
                  )}

                  {/* Category pill */}
                  {s.category && (
                    <span style={{
                      display: 'inline-block',
                      marginTop: '3px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--primary-700)',
                      background: 'var(--primary-50)',
                      border: '1px solid var(--primary-200)',
                      borderRadius: '4px',
                      padding: '1px 6px',
                    }}>
                      {s.category}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty state (only after search completes, not while loading) */}
          {!isLoading && suggestions.length === 0 && query.trim() && (
            <div style={{
              padding: '1.25rem 1rem',
              textAlign: 'center',
              color: 'var(--slate-400)',
              fontSize: '0.84rem',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>🔍</div>
              <div style={{ fontWeight: 700, color: 'var(--slate-600)', marginBottom: '0.2rem' }}>
                No results for "{query}"
              </div>
              <div style={{ fontSize: '0.76rem' }}>
                Try a different spelling, or add city name (e.g. "ISBM Nande Pune")
              </div>
            </div>
          )}

          {/* Footer */}
          {(suggestions.length > 0 || isLoading) && (
            <div style={{
              padding: '0.35rem 1rem',
              background: 'var(--slate-50)',
              borderTop: '1px solid var(--slate-100)',
              fontSize: '0.65rem',
              color: 'var(--slate-400)',
              textAlign: 'right',
              fontWeight: 600,
              borderRadius: '0 0 12px 12px',
            }}>
              OpenStreetMap · Photon · Nominatim · Real Geospatial Data
            </div>
          )}
        </div>
      )}
    </div>
  );
}
