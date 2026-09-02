/**
 * Public Transport Route & Verification Service
 * Geospatial matching (Haversine & Point-to-Polyline distance),
 * Stop sequence consistency, and multi-signal confidence calculation.
 */

const PublicTransportRoute = require('../models/PublicTransportRoute');
const config = require('../config/journeyConfig');

class PublicTransportRouteService {
  constructor() {
    this.hasSeeded = false;
  }

  /**
   * Calculate Haversine distance in meters between two lat/lng coordinates
   */
  haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radius of the Earth in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate minimum distance from a point to a line segment in meters
   */
  pointToSegmentMeters(pLat, pLng, aLat, aLng, bLat, bLng) {
    const R = 6371000;
    const x = (bLng - aLng) * Math.cos(((aLat + bLat) * Math.PI) / 360);
    const y = bLat - aLat;
    const segLenSq = x * x + y * y;

    if (segLenSq === 0) {
      return this.haversineMeters(pLat, pLng, aLat, aLng);
    }

    const px = (pLng - aLng) * Math.cos(((aLat + bLat) * Math.PI) / 360);
    const py = pLat - aLat;
    let t = (px * x + py * y) / segLenSq;
    t = Math.max(0, Math.min(1, t));

    const projLat = aLat + t * (bLat - aLat);
    const projLng = aLng + t * (bLng - aLng);
    return this.haversineMeters(pLat, pLng, projLat, projLng);
  }

  /**
   * Calculate distance from point to a polyline route (minimum distance across all segments)
   */
  pointToRouteDistanceMeters(lat, lng, geometry) {
    if (!geometry || geometry.length === 0) return Infinity;
    if (geometry.length === 1) {
      return this.haversineMeters(lat, lng, geometry[0][0], geometry[0][1]);
    }

    let minDistance = Infinity;
    for (let i = 0; i < geometry.length - 1; i++) {
      const a = geometry[i];
      const b = geometry[i + 1];
      const dist = this.pointToSegmentMeters(lat, lng, a[0], a[1], b[0], b[1]);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }
    return minDistance;
  }

  /**
   * Find nearest stop on a route
   */
  findNearestStop(lat, lng, stops = []) {
    if (!stops || stops.length === 0) return null;
    let nearest = null;
    let minDist = Infinity;

    for (const stop of stops) {
      const dist = this.haversineMeters(lat, lng, stop.latitude, stop.longitude);
      if (dist < minDist) {
        minDist = dist;
        nearest = { ...stop.toObject ? stop.toObject() : stop, distanceMeters: Math.round(dist) };
      }
    }
    return nearest;
  }

  /**
   * Seed realistic sample transit routes for prototype
   */
  async ensureSampleRoutesSeeded() {
    if (this.hasSeeded) return;
    try {
      const count = await PublicTransportRoute.countDocuments();
      if (count === 0) {
        await PublicTransportRoute.create([
          {
            routeId: '103',
            mode: 'BUS',
            name: 'Route 103 — Pune Station ⇄ Hinjewadi Phase 3',
            shortName: '103 (BRT Express)',
            operator: 'PMPML City Transport',
            direction: 'Hinjewadi IT Park',
            geometry: [
              [18.5284, 73.8744], // Pune Station
              [18.5312, 73.8567], // Shivajinagar
              [18.5415, 73.8340], // University Circle
              [18.5601, 73.8055], // Aundh
              [18.5812, 73.7645], // Wakad Flyover
              [18.5915, 73.7380], // Hinjewadi Shivaji Chowk
              [18.5985, 73.7120], // Hinjewadi Phase 3
            ],
            stops: [
              { stopId: 'STN-PUNE-01', name: 'Pune Station Terminal', latitude: 18.5284, longitude: 73.8744, sequence: 1 },
              { stopId: 'STN-SHIV-02', name: 'Shivajinagar Bus Stand', latitude: 18.5312, longitude: 73.8567, sequence: 2 },
              { stopId: 'STN-UNIV-03', name: 'Savitribai Phule University Gate', latitude: 18.5415, longitude: 73.8340, sequence: 3 },
              { stopId: 'STN-AUNDH-04', name: 'Aundh Gaon', latitude: 18.5601, longitude: 73.8055, sequence: 4 },
              { stopId: 'STN-WAKAD-05', name: 'Wakad Bridge', latitude: 18.5812, longitude: 73.7645, sequence: 5 },
              { stopId: 'STN-HINJ-06', name: 'Hinjewadi Phase 1 Circle', latitude: 18.5915, longitude: 73.7380, sequence: 6 },
              { stopId: 'STN-HINJ-07', name: 'Megapolis Phase 3', latitude: 18.5985, longitude: 73.7120, sequence: 7 },
            ],
            isSampleData: true,
          },
          {
            routeId: '104',
            mode: 'BUS',
            name: 'Route 104 — Shivajinagar ⇄ Aundh / Baner',
            shortName: '104 (City Link)',
            operator: 'PMPML City Transport',
            direction: 'Baner Balewadi',
            geometry: [
              [18.5312, 73.8567],
              [18.5415, 73.8340],
              [18.5580, 73.8120],
              [18.5620, 73.7890],
            ],
            stops: [
              { stopId: 'STN-SHIV-02', name: 'Shivajinagar Bus Stand', latitude: 18.5312, longitude: 73.8567, sequence: 1 },
              { stopId: 'STN-UNIV-03', name: 'University Gate', latitude: 18.5415, longitude: 73.8340, sequence: 2 },
              { stopId: 'STN-BAN-01', name: 'Baner Road Crossing', latitude: 18.5580, longitude: 73.8120, sequence: 3 },
              { stopId: 'STN-BALE-02', name: 'Balewadi Stadium', latitude: 18.5620, longitude: 73.7890, sequence: 4 },
            ],
            isSampleData: true,
          },
          {
            routeId: 'METRO-LINE-1',
            mode: 'METRO',
            name: 'Purple Line — PCMC ⇄ Swargate Metro',
            shortName: 'Metro Line 1',
            operator: 'Maha Metro Rail Corporation',
            direction: 'Swargate',
            geometry: [
              [18.6280, 73.8150],
              [18.5920, 73.8230],
              [18.5500, 73.8450],
              [18.5310, 73.8550],
              [18.5020, 73.8590],
            ],
            stops: [
              { stopId: 'METRO-PCMC', name: 'PCMC Metro Station', latitude: 18.6280, longitude: 73.8150, sequence: 1 },
              { stopId: 'METRO-BOP', name: 'Bopodi Metro Station', latitude: 18.5920, longitude: 73.8230, sequence: 2 },
              { stopId: 'METRO-SHIV', name: 'Shivajinagar Metro Hub', latitude: 18.5310, longitude: 73.8550, sequence: 3 },
              { stopId: 'METRO-SWAR', name: 'Swargate Terminal', latitude: 18.5020, longitude: 73.8590, sequence: 4 },
            ],
            isSampleData: true,
          },
        ]);
        console.log('[PublicTransportRouteService] Seeded realistic prototype transit routes.');
      }
      this.hasSeeded = true;
    } catch (err) {
      console.warn('[PublicTransportRouteService] Seed check skipped:', err.message);
    }
  }

  /**
   * Find candidate public transport routes within radius of user's coordinate
   */
  async findNearbyCandidateRoutes(latitude, longitude, radiusMeters = 1500) {
    await this.ensureSampleRoutesSeeded();

    const routes = await PublicTransportRoute.find({ isActive: true });
    const candidates = [];

    for (const route of routes) {
      const distToRoute = this.pointToRouteDistanceMeters(latitude, longitude, route.geometry);
      const nearestStop = this.findNearestStop(latitude, longitude, route.stops);

      // Proximity score: 1.0 if within 50m, scaling down to 0 if at radiusMeters
      const routeProximityScore = Math.max(0, 1 - distToRoute / radiusMeters);
      const stopProximityScore = nearestStop ? Math.max(0, 1 - nearestStop.distanceMeters / (radiusMeters * 0.8)) : 0;

      // Estimate initial route match percentage for candidate list
      const estimatedMatchPct = Math.round(
        Math.min(98, Math.max(20, (routeProximityScore * 0.6 + stopProximityScore * 0.4) * 100))
      );

      if (distToRoute <= radiusMeters || (nearestStop && nearestStop.distanceMeters <= radiusMeters)) {
        candidates.push({
          routeId: route.routeId,
          mode: route.mode,
          name: route.name,
          shortName: route.shortName || route.name,
          operator: route.operator,
          direction: route.direction,
          distanceMeters: Math.round(distToRoute),
          nearestStop,
          matchPercentage: estimatedMatchPct,
          geometry: route.geometry,
        });
      }
    }

    // Sort by highest match percentage first
    candidates.sort((a, b) => b.matchPercentage - a.matchPercentage);
    return candidates;
  }

  /**
   * Calculate Multi-Signal Public Transport Confidence Score
   * Formula weights:
   * - Route / trajectory match: 30%
   * - Trajectory consistency: 25%
   * - Stop sequence consistency: 20%
   * - Speed compatibility: 10%
   * - Motion compatibility: 10%
   * - Proximity: 5%
   */
  calculateConfidenceScore({
    route,
    currentLat,
    currentLng,
    currentSpeedKmh,
    currentHeading,
    recentWaypoints = [],
    stopDwellCount = 0,
    isFollowingBusOnly = false, // Anti-fraud indicator
  }) {
    if (!route) {
      return { confidence: 0, verified: false, evidence: {} };
    }

    // 1. Point to Polyline Distance
    const routeDistMeters = this.pointToRouteDistanceMeters(currentLat, currentLng, route.geometry);
    const nearestStop = this.findNearestStop(currentLat, currentLng, route.stops);

    // Route proximity subscore (0.0 to 1.0)
    let routeMatch = Math.max(0, 1 - routeDistMeters / (config.ROUTE_MATCH_RADIUS_METERS * 2));
    let proximity = Math.max(0, 1 - (nearestStop?.distanceMeters || 1000) / (config.STOP_PROXIMITY_RADIUS_METERS * 2));

    // 2. Trajectory Match & Consistency
    let trajectoryMatch = routeMatch;
    if (recentWaypoints.length >= 3) {
      // Check multiple recent waypoints against polyline
      const validDistances = recentWaypoints.slice(-5).map((wp) =>
        this.pointToRouteDistanceMeters(wp.lat, wp.lng, route.geometry)
      );
      const avgDist = validDistances.reduce((a, b) => a + b, 0) / validDistances.length;
      trajectoryMatch = Math.max(0, 1 - avgDist / 150);
    }

    // 3. Stop Sequence & Dwell Consistency
    let stopConsistency = 0.5;
    if (stopDwellCount > 0) {
      stopConsistency = Math.min(1.0, 0.6 + stopDwellCount * 0.15);
    } else if (currentSpeedKmh < 5 && nearestStop && nearestStop.distanceMeters < 80) {
      stopConsistency = 0.85; // Currently dwelling at a verified transit stop
    }

    // 4. Speed Compatibility (Bus: 10–65 km/h, Metro: 25–95 km/h)
    let speedCompatibility = 0.5;
    if (route.mode === 'BUS') {
      if (currentSpeedKmh >= 10 && currentSpeedKmh <= 65) speedCompatibility = 0.92;
      else if (currentSpeedKmh > 0 && currentSpeedKmh < 10) speedCompatibility = 0.75; // Stop/start
      else if (currentSpeedKmh > 85) speedCompatibility = 0.2; // Unrealistic for urban bus
    } else if (route.mode === 'METRO') {
      if (currentSpeedKmh >= 30 && currentSpeedKmh <= 95) speedCompatibility = 0.95;
      else if (currentSpeedKmh > 0 && currentSpeedKmh < 30) speedCompatibility = 0.70;
    }

    // 5. Motion Compatibility
    let motionCompatibility = 0.85;
    if (isFollowingBusOnly) {
      // Car following bus scenario: lack of stop dwell matching, erratic speed changes
      motionCompatibility = 0.25;
      trajectoryMatch *= 0.6;
      stopConsistency *= 0.3;
    }

    // Weighted Score
    const W_ROUTE = 0.30;
    const W_TRAJECTORY = 0.25;
    const W_STOP = 0.20;
    const W_SPEED = 0.10;
    const W_MOTION = 0.10;
    const W_PROXIMITY = 0.05;

    const rawConfidence =
      routeMatch * W_ROUTE +
      trajectoryMatch * W_TRAJECTORY +
      stopConsistency * W_STOP +
      speedCompatibility * W_SPEED +
      motionCompatibility * W_MOTION +
      proximity * W_PROXIMITY;

    const confidence = Number(Math.min(0.98, Math.max(0.05, rawConfidence)).toFixed(2));
    const verified = confidence >= config.PUBLIC_TRANSPORT_CONFIDENCE_THRESHOLD;

    return {
      mode: route.mode,
      routeId: route.routeId,
      routeName: route.name,
      confidence,
      verified,
      evidence: {
        routeMatch: Number(routeMatch.toFixed(2)),
        trajectoryMatch: Number(trajectoryMatch.toFixed(2)),
        stopConsistency: Number(stopConsistency.toFixed(2)),
        speedCompatibility: Number(speedCompatibility.toFixed(2)),
        motionCompatibility: Number(motionCompatibility.toFixed(2)),
        proximity: Number(proximity.toFixed(2)),
        nearestStopName: nearestStop?.name || 'Transit Corridor',
        nearestStopDistance: nearestStop?.distanceMeters || 0,
      },
    };
  }
}

module.exports = new PublicTransportRouteService();
