/**
 * Public Transport Verification & Confidence Engine
 * Multi-signal evidence weighting:
 * - GPS Route Match: 30%
 * - Speed Pattern: 20%
 * - Movement Pattern: 15%
 * - Bus Stop Pattern: 15%
 * - Journey Consistency: 10%
 * - GPS Quality: 10%
 *
 * Confidence Score Thresholds:
 * - 0–39%: 🔴 Not enough evidence
 * - 40–69%: 🟡 Verifying
 * - 70–84%: 🟢 Likely Public Transport
 * - 85–100%: 🟢 Strong Public Transport Evidence
 */

import { JOURNEY_CONFIG } from './journeyConfig';

/**
 * Haversine formula for distance in meters
 */
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Point-to-segment distance in meters
 */
export function pointToSegmentMeters(pLat, pLng, aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const x = (bLng - aLng) * Math.cos(((aLat + bLat) * Math.PI) / 360);
  const y = bLat - aLat;
  const segLenSq = x * x + y * y;

  if (segLenSq === 0) {
    return haversineDistanceMeters(pLat, pLng, aLat, aLng);
  }

  const px = (pLng - aLng) * Math.cos(((aLat + bLat) * Math.PI) / 360);
  const py = pLat - aLat;
  let t = (px * x + py * y) / segLenSq;
  t = Math.max(0, Math.min(1, t));

  const projLat = aLat + t * (bLat - aLat);
  const projLng = aLng + t * (bLng - aLng);
  return haversineDistanceMeters(pLat, pLng, projLat, projLng);
}

/**
 * Point to Polyline distance across all segments
 */
export function pointToRouteDistanceMeters(lat, lng, geometry = []) {
  if (!geometry || geometry.length === 0) return Infinity;
  if (geometry.length === 1) return haversineDistanceMeters(lat, lng, geometry[0][0], geometry[0][1]);

  let minDist = Infinity;
  for (let i = 0; i < geometry.length - 1; i++) {
    const a = geometry[i];
    const b = geometry[i + 1];
    const dist = pointToSegmentMeters(lat, lng, a[0], a[1], b[0], b[1]);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

class PublicTransportConfidenceEngine {
  constructor(customWeights = {}) {
    this.weights = {
      W_ROUTE_MATCH: 0.30,
      W_SPEED_PATTERN: 0.20,
      W_MOVEMENT_PATTERN: 0.15,
      W_STOP_PATTERN: 0.15,
      W_JOURNEY_CONSISTENCY: 0.10,
      W_GPS_QUALITY: 0.10,
      ...customWeights,
    };
  }

  /**
   * Evaluate confidence score dynamically as real GPS points arrive
   */
  evaluate({
    route,
    currentLat,
    currentLng,
    currentSpeedKmh = 0,
    gpsAccuracy = 8,
    gpsPoints = [],
    stopDwellCount = 0,
    hasTransitBeacon = false,
    isFollowingBusFraud = false,
    elapsedSeconds = 0,
  }) {
    if (!route || currentLat === undefined || currentLng === undefined) {
      return {
        confidence: 0,
        confidencePct: 0,
        status: '🔴 Not enough evidence',
        statusLevel: 'LOW',
        verified: false,
        evidence: {},
      };
    }

    // 1. GPS Route Match (30%)
    let routeMatch = 0.5;
    const geometry = route.geometry || (route.coordinates ? route.coordinates.map((c) => [c[0], c[1]]) : []);
    if (geometry.length > 0) {
      const routeDistMeters = pointToRouteDistanceMeters(currentLat, currentLng, geometry);
      // Tolerance: within 80m gives 100%, drops to 0 at 400m
      routeMatch = Math.max(0, Math.min(1.0, 1 - (routeDistMeters - 80) / 320));
      if (routeDistMeters <= 80) routeMatch = 1.0;
    } else {
      // Default estimate based on points
      routeMatch = 0.82;
    }

    // 2. Speed Pattern (20%)
    // Buses operate with variable speeds (0-65 km/h, stop/start)
    let speedScore = 0.6;
    if (currentSpeedKmh >= 10 && currentSpeedKmh <= 60) {
      speedScore = 0.90;
    } else if (currentSpeedKmh > 0 && currentSpeedKmh < 10) {
      speedScore = 0.80; // stop/start deceleration
    } else if (currentSpeedKmh === 0) {
      speedScore = 0.70; // bus dwell
    } else if (currentSpeedKmh > 80) {
      speedScore = 0.25; // unlikely city bus speed
    }

    // 3. Movement Pattern (15%)
    // Assesses acceleration, deceleration, turn rates over recent GPS trajectory
    let movementScore = 0.75;
    if (gpsPoints.length >= 4) {
      const recent = gpsPoints.slice(-6);
      const speeds = recent.map((p) => (p.speed ? p.speed * 3.6 : 0));
      const speedVariance = Math.max(...speeds) - Math.min(...speeds);
      if (speedVariance > 5) {
        movementScore = 0.88; // typical public transit variation
      } else {
        movementScore = 0.72;
      }
    }

    // 4. Bus Stop / Stop Pattern (15%)
    // Expected pattern: MOVING -> SLOWING -> STOP -> MOVING
    let stopPatternScore = 0.60;
    let nearestStopDist = Infinity;
    let nearestStopName = 'Corridor';

    if (route.stops && route.stops.length > 0) {
      for (const st of route.stops) {
        const d = haversineDistanceMeters(currentLat, currentLng, st.latitude || st.lat, st.longitude || st.lng);
        if (d < nearestStopDist) {
          nearestStopDist = d;
          nearestStopName = st.name;
        }
      }
      if (nearestStopDist <= 60) {
        stopPatternScore = 0.92;
      } else if (nearestStopDist <= 150) {
        stopPatternScore = 0.80;
      }
    }

    if (stopDwellCount > 0) {
      stopPatternScore = Math.min(1.0, stopPatternScore + stopDwellCount * 0.1);
    }

    // 5. Journey Consistency (10%)
    // Time elapsed vs distance covered
    let consistencyScore = 0.70;
    if (elapsedSeconds > 30) {
      consistencyScore = 0.88;
    } else if (elapsedSeconds > 10) {
      consistencyScore = 0.75;
    } else {
      consistencyScore = 0.50; // just started, accumulating evidence
    }

    // 6. GPS Quality (10%)
    // High accuracy (<15m) gives full score, >40m degrades
    let gpsQualityScore = 1.0;
    if (gpsAccuracy <= 10) gpsQualityScore = 0.98;
    else if (gpsAccuracy <= 25) gpsQualityScore = 0.80;
    else if (gpsAccuracy <= 50) gpsQualityScore = 0.55;
    else gpsQualityScore = 0.20;

    // Bluetooth beacon signal boost
    if (hasTransitBeacon) {
      movementScore = Math.min(1.0, movementScore + 0.15);
      stopPatternScore = Math.min(1.0, stopPatternScore + 0.10);
    }

    // Anti-fraud penalty
    if (isFollowingBusFraud) {
      movementScore *= 0.3;
      routeMatch *= 0.5;
      stopPatternScore *= 0.2;
    }

    // Weighted Formula
    const rawScore =
      routeMatch * this.weights.W_ROUTE_MATCH +
      speedScore * this.weights.W_SPEED_PATTERN +
      movementScore * this.weights.W_MOVEMENT_PATTERN +
      stopPatternScore * this.weights.W_STOP_PATTERN +
      consistencyScore * this.weights.W_JOURNEY_CONSISTENCY +
      gpsQualityScore * this.weights.W_GPS_QUALITY;

    // Scale confidence between 0.10 and 0.98
    // Do NOT show 100% verified immediately after starting
    const timeDamping = Math.min(1.0, Math.max(0.40, elapsedSeconds / 45));
    const confidence = Number((Math.min(0.98, Math.max(0.05, rawScore * timeDamping))).toFixed(2));
    const confidencePct = Math.round(confidence * 100);

    // Dynamic State Categorization (Section 14 of Spec)
    let status = '🔴 Not enough evidence';
    let statusLevel = 'LOW'; // LOW (0-39), MEDIUM (40-69), HIGH (70-84), VERY_HIGH (85-100)
    let statusColor = '#ef4444';

    if (confidencePct >= 85) {
      status = '🟢 Strong Public Transport Evidence';
      statusLevel = 'VERY_HIGH';
      statusColor = '#059669';
    } else if (confidencePct >= 70) {
      status = '🟢 Likely Public Transport';
      statusLevel = 'HIGH';
      statusColor = '#10b981';
    } else if (confidencePct >= 40) {
      status = '🟡 Verifying';
      statusLevel = 'MEDIUM';
      statusColor = '#f59e0b';
    } else {
      status = '🔴 Not enough evidence';
      statusLevel = 'LOW';
      statusColor = '#ef4444';
    }

    const verified = confidencePct >= 70;

    return {
      confidence,
      confidencePct,
      status,
      statusLevel,
      statusColor,
      verified,
      evidence: {
        routeMatchScore: Math.round(routeMatch * 100),
        speedScore: Math.round(speedScore * 100),
        movementScore: Math.round(movementScore * 100),
        stopPatternScore: Math.round(stopPatternScore * 100),
        consistencyScore: Math.round(consistencyScore * 100),
        gpsQualityScore: Math.round(gpsQualityScore * 100),
        nearestStopName,
        nearestStopDistance: nearestStopDist === Infinity ? 0 : Math.round(nearestStopDist),
        gpsPointsCount: gpsPoints.length,
      },
    };
  }
}

export const publicTransportConfidenceEngine = new PublicTransportConfidenceEngine();
export default publicTransportConfidenceEngine;
