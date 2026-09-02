const https = require('https');
const http = require('http');

/**
 * Helper to make HTTP/HTTPS JSON requests with fetch or native https
 */
async function fetchJson(url, options = {}) {
  if (typeof fetch !== 'undefined') {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} from ${url}: ${errText}`);
    }
    return await res.json();
  }

  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve(JSON.parse(data));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

/**
 * Polyline encoder / decoder utility
 */
function decodePolyline(encoded) {
  if (!encoded) return [];
  const poly = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push([lat / 1e5, lng / 1e5]);
  }
  return poly;
}

function encodePolyline(coords) {
  if (!coords || coords.length === 0) return '';
  let output = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const point of coords) {
    const lat = Math.round(point[0] * 1e5);
    const lng = Math.round(point[1] * 1e5);
    let dLat = lat - prevLat;
    let dLng = lng - prevLng;
    prevLat = lat;
    prevLng = lng;

    const encodeNumber = (num) => {
      let val = num < 0 ? ~(num << 1) : (num << 1);
      let s = '';
      while (val >= 0x20) {
        s += String.fromCharCode((0x20 | (val & 0x1f)) + 63);
        val >>= 5;
      }
      s += String.fromCharCode(val + 63);
      return s;
    };

    output += encodeNumber(dLat);
    output += encodeNumber(dLng);
  }
  return output;
}

/**
 * Calculate Great Circle distance between two lat/lng coordinates (in meters)
 */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class RouteService {
  constructor() {
    this.googleApiKey = process.env.GOOGLE_ROUTES_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';
  }

  getApiKey() {
    return process.env.GOOGLE_ROUTES_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      this.googleApiKey;
  }

  /**
   * 1. Multi-Engine Places Autocomplete (Google Places + Photon + Nominatim)
   */
  async autocompletePlaces({ input, sessionToken = '', lat = null, lng = null }) {
    if (!input || !input.trim()) return [];
    const query = input.trim();
    const apiKey = this.getApiKey();

    // 1. Try Google Places Autocomplete API if real API key configured
    if (apiKey && !apiKey.includes('YOUR_') && apiKey.length > 10) {
      try {
        let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}`;
        if (sessionToken) url += `&sessiontoken=${encodeURIComponent(sessionToken)}`;
        if (lat && lng) url += `&location=${lat},${lng}&radius=50000`;

        const data = await fetchJson(url);
        if (data.status === 'OK' && Array.isArray(data.predictions) && data.predictions.length > 0) {
          return data.predictions.map((p) => ({
            placeId: p.place_id,
            name: p.structured_formatting?.main_text || p.description.split(',')[0],
            formattedAddress: p.description,
            secondaryText: p.structured_formatting?.secondary_text || '',
            types: p.types || [],
          }));
        }
      } catch (err) {
        console.warn('[Google Places Autocomplete Error, falling back]:', err.message);
      }
    }

    // 2. High-Accuracy Parallel Search: Photon + Nominatim simultaneously
    const results = [];
    // Use coordinate-rounded key to deduplicate across engines
    const seenCoords = new Set();

    let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=15`;
    if (lat && lng) photonUrl += `&lat=${lat}&lon=${lng}`;

    // Use extratags=1 and namedetails=1 for richer Nominatim output
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&extratags=1&namedetails=1&limit=12`;

    const [photonSettled, nomSettled] = await Promise.allSettled([
      fetchJson(photonUrl),
      fetchJson(nomUrl, { headers: { 'User-Agent': 'GreenCredits-SmartMobility/1.0' } }),
    ]);

    // Helper: build rich formatted address from parts
    const buildAddress = (parts) => parts.filter(Boolean).join(', ');

    // Parse Photon results
    if (photonSettled.status === 'fulfilled' && photonSettled.value?.features) {
      for (const f of photonSettled.value.features) {
        const props = f.properties || {};
        const coords = f.geometry?.coordinates || [0, 0];
        const coordKey = `${Number(coords[1]).toFixed(4)}|${Number(coords[0]).toFixed(4)}`;
        if (seenCoords.has(coordKey)) continue;
        seenCoords.add(coordKey);

        const name = props.name || props.street || props.housenumber || query;

        // Rich address: housenumber+street, suburb/district, city, county, state, postcode, country
        const addressParts = buildAddress([
          props.housenumber && props.street ? `${props.housenumber} ${props.street}` : (props.street || props.housenumber),
          props.suburb || props.district,
          props.city || props.town || props.village,
          props.county,
          props.state,
          props.postcode,
          props.country,
        ]);

        results.push({
          placeId: `osm_${props.osm_id || Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
          name,
          formattedAddress: addressParts ? `${name}, ${addressParts}` : name,
          secondaryText: addressParts,
          latitude: coords[1],
          longitude: coords[0],
          types: [props.osm_value || props.osm_key || 'place'],
          category: props.osm_value || props.osm_key,
        });
      }
    }

    // Parse Nominatim results — fills in any gaps Photon missed
    if (nomSettled.status === 'fulfilled' && Array.isArray(nomSettled.value)) {
      for (const item of nomSettled.value) {
        const lat2 = parseFloat(item.lat);
        const lng2 = parseFloat(item.lon);
        const coordKey = `${lat2.toFixed(4)}|${lng2.toFixed(4)}`;
        if (seenCoords.has(coordKey)) continue;
        seenCoords.add(coordKey);

        const addr = item.address || {};
        // Prefer the real name from namedetails if available
        const name = (item.namedetails && item.namedetails.name) || item.name || item.display_name.split(',')[0].trim();

        // Build readable secondary text from address components
        const secondaryText = [
          addr.house_number && addr.road ? `${addr.house_number} ${addr.road}` : (addr.road || addr.pedestrian || addr.path),
          addr.neighbourhood || addr.suburb || addr.residential,
          addr.city || addr.town || addr.village || addr.hamlet,
          addr.county || addr.state_district,
          addr.state,
          addr.postcode,
          addr.country,
        ].filter(Boolean).join(', ');

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

    return results.slice(0, 12);
  }

  /**
   * 2. Google Place Details (exact latitude/longitude from placeId)
   */
  async getPlaceDetails({ placeId, sessionToken = '', fallbackName = '' }) {
    if (!placeId) throw new Error('placeId is required');

    const apiKey = this.getApiKey();

    if (apiKey && !apiKey.includes('YOUR_') && !placeId.startsWith('osm_') && !placeId.startsWith('nom_')) {
      try {
        let url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=place_id,name,formatted_address,geometry,types&key=${apiKey}`;
        if (sessionToken) url += `&sessiontoken=${encodeURIComponent(sessionToken)}`;

        const data = await fetchJson(url);
        if (data.status === 'OK' && data.result) {
          const res = data.result;
          return {
            placeId: res.place_id,
            name: res.name || fallbackName,
            formattedAddress: res.formatted_address || fallbackName,
            latitude: res.geometry?.location?.lat,
            longitude: res.geometry?.location?.lng,
          };
        }
      } catch (err) {
        console.warn('[Google Place Details Error, falling back]:', err.message);
      }
    }

    // If placeId is a nominatim/osm id, or google details failed, geocode the name
    if (fallbackName) {
      const geo = await this.geocodeAddress(fallbackName);
      if (geo) return geo;
    }

    throw new Error('Unable to resolve location coordinates');
  }

  /**
   * 3. Reverse Geocode (convert current GPS lat/lng into a clean formatted address)
   */
  async reverseGeocode({ lat, lng }) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      throw new Error('Valid lat and lng required');
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    const apiKey = this.getApiKey();

    if (apiKey && !apiKey.includes('YOUR_')) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
        const data = await fetchJson(url);
        if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
          const first = data.results[0];
          return {
            placeId: first.place_id,
            name: first.formatted_address.split(',')[0],
            formattedAddress: first.formatted_address,
            latitude,
            longitude,
          };
        }
      } catch (err) {
        console.warn('[Google Reverse Geocode Error, falling back to OSM]:', err.message);
      }
    }

    // High-accuracy fallback using OpenStreetMap Nominatim reverse geocoder
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;
      const res = await fetchJson(nomUrl, {
        headers: { 'User-Agent': 'GreenCredits-SmartMobility/1.0' },
      });
      if (res && res.display_name) {
        const name = res.address?.road || res.address?.suburb || res.display_name.split(',')[0];
        return {
          placeId: `nom_${res.place_id || Date.now()}`,
          name: name || 'Current Location',
          formattedAddress: res.display_name,
          latitude,
          longitude,
        };
      }
    } catch (err) {
      console.warn('[Nominatim reverse geocode error]:', err.message);
    }

    return {
      placeId: `gps_${latitude.toFixed(4)}_${longitude.toFixed(4)}`,
      name: `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      formattedAddress: `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`,
      latitude,
      longitude,
    };
  }

  /**
   * Geocode a text address to coordinates
   */
  async geocodeAddress(address) {
    if (!address) return null;
    const apiKey = this.getApiKey();

    if (apiKey && !apiKey.includes('YOUR_')) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
        const data = await fetchJson(url);
        if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
          const first = data.results[0];
          return {
            placeId: first.place_id,
            name: first.formatted_address.split(',')[0],
            formattedAddress: first.formatted_address,
            latitude: first.geometry.location.lat,
            longitude: first.geometry.location.lng,
          };
        }
      } catch (err) {
        console.warn('[Google Geocode error]:', err.message);
      }
    }

    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
      const res = await fetchJson(nomUrl, {
        headers: { 'User-Agent': 'GreenCredits-SmartMobility/1.0' },
      });
      if (Array.isArray(res) && res.length > 0) {
        const first = res[0];
        return {
          placeId: `nom_${first.place_id}`,
          name: first.display_name.split(',')[0],
          formattedAddress: first.display_name,
          latitude: parseFloat(first.lat),
          longitude: parseFloat(first.lon),
        };
      }
    } catch (err) {
      console.warn('[Nominatim geocode error]:', err.message);
    }

    return null;
  }

  /**
   * 4. Compute Real Routes for Walking, Cycling, and Driving
   */
  async computeAllRoutes({ origin, destination }) {
    let orig = origin;
    let dest = destination;

    // If string is provided instead of object with coordinates, geocode them
    if (typeof orig === 'string') {
      const geoOrig = await this.geocodeAddress(orig);
      if (!geoOrig) throw new Error(`Could not resolve starting location: "${orig}"`);
      orig = geoOrig;
    }
    if (typeof dest === 'string') {
      const geoDest = await this.geocodeAddress(dest);
      if (!geoDest) throw new Error(`Could not resolve destination: "${dest}"`);
      dest = geoDest;
    }

    if (!orig.latitude || !orig.longitude || !dest.latitude || !dest.longitude) {
      throw new Error('Both origin and destination must have valid latitude and longitude');
    }

    // Concurrently compute real routes for WALKING, CYCLING, and DRIVING
    const [walkingRoute, cyclingRoute, drivingRoute] = await Promise.all([
      this.computeSingleRoute({ origin: orig, destination: dest, mode: 'WALKING' }),
      this.computeSingleRoute({ origin: orig, destination: dest, mode: 'CYCLING' }),
      this.computeSingleRoute({ origin: orig, destination: dest, mode: 'CAR' }),
    ]);

    return {
      origin: {
        name: orig.name || 'Starting Point',
        formattedAddress: orig.formattedAddress || orig.name || '',
        latitude: orig.latitude,
        longitude: orig.longitude,
      },
      destination: {
        name: dest.name || 'Destination Point',
        formattedAddress: dest.formattedAddress || dest.name || '',
        latitude: dest.latitude,
        longitude: dest.longitude,
      },
      routes: [walkingRoute, cyclingRoute, drivingRoute],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Compute a single route for a given mode ('WALKING' | 'CYCLING' | 'CAR')
   */
  async computeSingleRoute({ origin, destination, mode = 'WALKING' }) {
    const apiKey = this.getApiKey();
    const googleModeMap = {
      WALKING: 'walking',
      CYCLING: 'bicycling',
      CAR: 'driving',
    };
    const googleMode = googleModeMap[mode] || 'walking';

    // 1. Try Google Directions API if key configured
    if (apiKey && !apiKey.includes('YOUR_')) {
      try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=${googleMode}&key=${apiKey}`;
        const data = await fetchJson(url);

        if (data.status === 'OK' && Array.isArray(data.routes) && data.routes.length > 0) {
          const route = data.routes[0];
          const leg = route.legs[0];

          const distanceMeters = leg.distance.value;
          const durationSeconds = leg.duration.value;
          const distanceKm = Number((distanceMeters / 1000).toFixed(2));
          const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
          const encodedPolyline = route.overview_polyline?.points || '';
          const coordinates = decodePolyline(encodedPolyline);

          const steps = (leg.steps || []).map((step, idx) => ({
            stepIndex: idx,
            instruction: step.html_instructions ? step.html_instructions.replace(/<[^>]*>?/gm, ' ') : step.maneuver || 'Continue straight',
            distanceMeters: step.distance?.value || 0,
            distanceKm: Number(((step.distance?.value || 0) / 1000).toFixed(2)),
            durationSeconds: step.duration?.value || 0,
            durationMin: Math.max(1, Math.round((step.duration?.value || 0) / 60)),
            maneuver: step.maneuver || 'straight',
            startLocation: { lat: step.start_location?.lat, lng: step.start_location?.lng },
            endLocation: { lat: step.end_location?.lat, lng: step.end_location?.lng },
            mode,
          }));

          return this.formatRouteObject({
            mode,
            origin,
            destination,
            distanceMeters,
            durationSeconds,
            distanceKm,
            durationMinutes,
            encodedPolyline,
            coordinates,
            steps,
            summary: route.summary || `${leg.start_address} to ${leg.end_address}`,
            warnings: route.warnings || [],
          });
        }
      } catch (err) {
        console.warn(`[Google Directions ${mode} error, falling back to OSRM]:`, err.message);
      }
    }

    // 2. High-Accuracy Fallback to Open Source Routing Machine (OSRM)
    const osrmProfileMap = {
      WALKING: 'foot',
      CYCLING: 'bicycle',
      CAR: 'driving',
    };
    const osrmProfile = osrmProfileMap[mode] || 'foot';

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline&steps=true`;
      const res = await fetchJson(osrmUrl);

      if (res.code === 'Ok' && Array.isArray(res.routes) && res.routes.length > 0) {
        const route = res.routes[0];
        const distanceMeters = Math.round(route.distance);
        const durationSeconds = Math.round(route.duration);
        const distanceKm = Number((distanceMeters / 1000).toFixed(2));
        const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
        const encodedPolyline = route.geometry;
        const coordinates = decodePolyline(encodedPolyline);

        const steps = [];
        (route.legs || []).forEach((leg) => {
          (leg.steps || []).forEach((step, idx) => {
            let instruction = '';
            const maneuverType = step.maneuver?.type || 'continue';
            const modifier = step.maneuver?.modifier ? ` ${step.maneuver.modifier}` : '';
            const streetName = step.name ? ` onto ${step.name}` : '';

            if (maneuverType === 'depart') {
              instruction = `Head ${step.maneuver?.modifier || 'forward'}${streetName}`;
            } else if (maneuverType === 'arrive') {
              instruction = `Arrive at destination: ${destination.name || 'Destination'}`;
            } else if (maneuverType === 'turn') {
              instruction = `Turn${modifier}${streetName}`;
            } else if (maneuverType === 'roundabout') {
              instruction = `Take exit ${step.maneuver?.exit || 1} at the roundabout${streetName}`;
            } else {
              instruction = `Continue${modifier}${streetName || ' straight'}`;
            }

            steps.push({
              stepIndex: idx,
              instruction: instruction.trim(),
              distanceMeters: Math.round(step.distance),
              distanceKm: Number((step.distance / 1000).toFixed(2)),
              durationSeconds: Math.round(step.duration),
              durationMin: Math.max(1, Math.round(step.duration / 60)),
              maneuver: step.maneuver?.type || 'straight',
              modifier: step.maneuver?.modifier || '',
              startLocation: step.maneuver?.location ? { lat: step.maneuver.location[1], lng: step.maneuver.location[0] } : null,
              mode,
            });
          });
        });

        return this.formatRouteObject({
          mode,
          origin,
          destination,
          distanceMeters,
          durationSeconds,
          distanceKm,
          durationMinutes,
          encodedPolyline,
          coordinates,
          steps,
          summary: `${origin.name || 'Origin'} → ${destination.name || 'Destination'}`,
          warnings: [],
        });
      }
    } catch (err) {
      console.warn(`[OSRM ${mode} error, using geometric geodesic interpolation]:`, err.message);
    }

    // 3. Resilient Geodesic Interpolation (ensures reliable return even in offline environments)
    const directDistanceMeters = Math.round(getDistanceMeters(origin.latitude, origin.longitude, destination.latitude, destination.longitude));
    // Road winding factor: ~1.25x for walk/cycle, ~1.35x for car
    const roadFactor = mode === 'CAR' ? 1.35 : 1.25;
    const distanceMeters = Math.round(directDistanceMeters * roadFactor);
    const distanceKm = Number((distanceMeters / 1000).toFixed(2));

    // Approximate speed: Walk 4.8 km/h, Cycle 16 km/h, Car 25 km/h
    const speedKmh = mode === 'WALKING' ? 4.8 : (mode === 'CYCLING' ? 16.0 : 25.0);
    const durationMinutes = Math.max(1, Math.round((distanceKm / speedKmh) * 60));
    const durationSeconds = durationMinutes * 60;

    // Generate intermediate waypoint line
    const numPoints = Math.max(5, Math.min(30, Math.round(distanceKm * 4)));
    const coordinates = [];
    for (let i = 0; i <= numPoints; i++) {
      const ratio = i / numPoints;
      const lat = origin.latitude + (destination.latitude - origin.latitude) * ratio;
      const lng = origin.longitude + (destination.longitude - origin.longitude) * ratio;
      coordinates.push([lat, lng]);
    }
    const encodedPolyline = encodePolyline(coordinates);

    const steps = [
      {
        stepIndex: 0,
        instruction: `Head towards ${destination.name || 'destination'} on active corridor`,
        distanceMeters: Math.round(distanceMeters * 0.4),
        distanceKm: Number((distanceKm * 0.4).toFixed(2)),
        durationSeconds: Math.round(durationSeconds * 0.4),
        durationMin: Math.max(1, Math.round(durationMinutes * 0.4)),
        maneuver: 'depart',
        mode,
      },
      {
        stepIndex: 1,
        instruction: `Continue on main route to ${destination.name || 'destination'}`,
        distanceMeters: Math.round(distanceMeters * 0.6),
        distanceKm: Number((distanceKm * 0.6).toFixed(2)),
        durationSeconds: Math.round(durationSeconds * 0.6),
        durationMin: Math.max(1, Math.round(durationMinutes * 0.6)),
        maneuver: 'arrive',
        mode,
      },
    ];

    return this.formatRouteObject({
      mode,
      origin,
      destination,
      distanceMeters,
      durationSeconds,
      distanceKm,
      durationMinutes,
      encodedPolyline,
      coordinates,
      steps,
      summary: `${origin.name || 'Origin'} to ${destination.name || 'Destination'}`,
      warnings: [],
    });
  }

  /**
   * Helper to format standardized Route Response Data Model
   */
  formatRouteObject({
    mode,
    origin,
    destination,
    distanceMeters,
    durationSeconds,
    distanceKm,
    durationMinutes,
    encodedPolyline,
    coordinates,
    steps,
    summary,
    warnings = [],
  }) {
    const carBaselineCo2PerKm = 0.192; // 192g CO2 per km for average ICE car

    let fitnessPoints = 0;
    let greenCredits = 0;
    let co2AvoidedKg = 0;
    let co2EmittedKg = 0;
    let caloriesBurned = 0;
    let title = '';
    let tag = '';
    let healthHighlight = '';
    let isRecommended = false;

    if (mode === 'WALKING') {
      title = 'Recommended Active Walking Route';
      tag = 'Best Cardio & Active Health';
      isRecommended = true;
      caloriesBurned = Math.round(distanceKm * 65);
      fitnessPoints = Math.round(distanceKm * 15 + durationMinutes * 0.5);
      greenCredits = Math.round(distanceKm * 10);
      co2AvoidedKg = Number((distanceKm * carBaselineCo2PerKm).toFixed(2));
      healthHighlight = `${distanceKm} km walking burns ~${caloriesBurned} kcal and prevents ${co2AvoidedKg} kg of greenhouse emissions.`;
    } else if (mode === 'CYCLING') {
      title = 'Recommended Cycling Route';
      tag = 'Maximum Speed & Fitness';
      isRecommended = false;
      caloriesBurned = Math.round(distanceKm * 42);
      fitnessPoints = Math.round(distanceKm * 10 + durationMinutes * 0.8);
      greenCredits = Math.round(distanceKm * 12);
      co2AvoidedKg = Number((distanceKm * carBaselineCo2PerKm).toFixed(2));
      healthHighlight = `Active cycling burns ~${caloriesBurned} kcal, builds lower-body endurance, and saves ${co2AvoidedKg} kg CO₂.`;
    } else {
      // CAR / DRIVING
      title = 'Conventional Private Car Route';
      tag = 'High Carbon Footprint';
      isRecommended = false;
      caloriesBurned = 0;
      fitnessPoints = 0;
      greenCredits = 0;
      co2AvoidedKg = 0;
      co2EmittedKg = Number((distanceKm * carBaselineCo2PerKm).toFixed(2));
      healthHighlight = `Contributes ${co2EmittedKg} kg CO₂ and urban congestion with zero active fitness benefits.`;
    }

    return {
      id: `${mode.toLowerCase()}-route-${Date.now()}`,
      mode: mode.toUpperCase(), // 'WALKING' | 'CYCLING' | 'CAR'
      title,
      tag,
      isRecommended,
      origin: {
        latitude: origin.latitude,
        longitude: origin.longitude,
        name: origin.name || 'Starting Point',
        address: origin.formattedAddress || origin.name || '',
      },
      destination: {
        latitude: destination.latitude,
        longitude: destination.longitude,
        name: destination.name || 'Destination Point',
        address: destination.formattedAddress || destination.name || '',
      },
      distanceMeters,
      durationSeconds,
      distanceKm,
      durationMinutes,
      distanceText: distanceKm >= 1 ? `${distanceKm} km` : `${distanceMeters} m`,
      durationText: durationMinutes >= 60
        ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
        : `${durationMinutes} min`,
      encodedPolyline,
      coordinates, // [[lat, lng], ...]
      steps: steps.map((s, idx) => ({
        stepIndex: idx,
        mode,
        instruction: s.instruction,
        distanceKm: s.distanceKm || Number(((s.distanceMeters || 0) / 1000).toFixed(2)),
        durationMin: s.durationMin || Math.max(1, Math.round((s.durationSeconds || 0) / 60)),
        distanceMeters: s.distanceMeters || 0,
        durationSeconds: s.durationSeconds || 0,
        maneuver: s.maneuver || 'straight',
        startLocation: s.startLocation || null,
        endLocation: s.endLocation || null,
      })),
      warnings,
      summary,
      estimatedCalories: caloriesBurned,
      fitnessPoints,
      greenCredits,
      estimatedCO2Avoided: co2AvoidedKg,
      co2AvoidedKg,
      co2EmittedKg,
      healthHighlight,
      routeQuality: 'OPTIMAL',
    };
  }

  /**
   * 5. Real-Time Off-Route Rerouting (From current GPS position to destination)
   */
  async reroute({ currentLocation, destination, mode = 'WALKING' }) {
    if (!currentLocation?.lat || !currentLocation?.lng) {
      throw new Error('Current GPS location coordinates required for rerouting');
    }
    if (!destination?.latitude || !destination?.longitude) {
      throw new Error('Destination coordinates required for rerouting');
    }

    const origin = {
      latitude: currentLocation.lat,
      longitude: currentLocation.lng,
      name: 'Current Position',
      formattedAddress: 'Current Live GPS Position',
    };

    const newRoute = await this.computeSingleRoute({
      origin,
      destination,
      mode,
    });

    return {
      success: true,
      message: 'New route recalculated successfully',
      route: newRoute,
    };
  }
}

module.exports = new RouteService();
