/**
 * Anti-Fraud Detection Engine
 * Evaluates kinematic plausibility, sensor consistency, attack vectors,
 * walking fraud patterns, and outputs an independent 0–100 Fraud Risk Score with detailed fraud triggers.
 */

const FraudEvent = require('../models/FraudEvent');

class FraudDetectionService {
  /**
   * Analyze incoming sensor window and recent trajectory for fraud
   */
  async evaluateWindow(sensorWindow, classification, journey = null) {
    let fraudScore = 0;
    const fraudEvents = [];
    const feats = classification.extractedFeatures || {};

    const speedKmh = feats.gpsSpeedAvg || sensorWindow.speed || 0;
    const maxSpeedKmh = feats.gpsSpeedMax || speedKmh;
    const cadence = feats.cadence || 0;
    const accelJerk = feats.accelJerkMean || 0;
    const accelRms = feats.accelRms || 0;
    const stepCount = sensorWindow.stepCount || 0;
    const sensorAvailability = sensorWindow.sensorAvailability || (journey ? journey.sensorAvailability : {}) || {};

    // 1. DESKTOP / LAPTOP WALKING CLAIM CHECK (Requirement 4 & 5)
    // Desktop GPS alone cannot be awarded walking credits without mobile motion sensors
    if (sensorAvailability.isMobile === false || sensorAvailability.deviceType === 'DESKTOP' || sensorAvailability.deviceType === 'LAPTOP') {
      if (classification.predictedMode === 'WALKING' || classification.predictedMode === 'CYCLING') {
        fraudScore += 70;
        fraudEvents.push({
          fraudType: 'DESKTOP_UNVERIFIED_WALKING_CLAIM',
          severity: 'HIGH',
          fraudScore: 70,
          evidence: {
            claimedMode: classification.predictedMode,
            detectedMode: 'UNVERIFIED_DESKTOP',
            gpsSpeedKmh: speedKmh,
            cadence: 0,
            accelJerk: 0,
            details: 'Walking verification requires mobile sensors (accelerometer/gyroscope/step counter). Laptop interaction cannot verify walking.',
          },
        });
      }
    }

    // 2. VERY HIGH GPS SPEED WITH FEW/NO STEPS (Vehicle claiming walking) (Requirement 8)
    if (speedKmh > 8.5 && stepCount < 25 && (!journey || journey.totalDurationMinutes > 0.2)) {
      if (classification.predictedMode === 'WALKING') {
        fraudScore += 65;
        fraudEvents.push({
          fraudType: 'HIGH_SPEED_ZERO_STEPS_MISMATCH',
          severity: 'HIGH',
          fraudScore: 65,
          evidence: {
            claimedMode: 'WALKING',
            detectedMode: speedKmh > 35 ? 'CAR' : (speedKmh > 15 ? 'SCOOTER' : 'CYCLING'),
            gpsSpeedKmh: speedKmh,
            stepCount,
            details: `GPS speed (${speedKmh.toFixed(1)} km/h) is too fast for walking with only ${stepCount} recorded steps.`,
          },
        });
      }
    }

    // 3. STATIONARY PHONE SHAKING (High steps with zero GPS displacement) (Requirement 8)
    if (stepCount > 250 && journey && journey.totalDistanceKm < 0.02 && journey.totalDurationMinutes > 0.5) {
      fraudScore += 60;
      fraudEvents.push({
        fraudType: 'STATIONARY_PHONE_SHAKING',
        severity: 'HIGH',
        fraudScore: 60,
        evidence: {
          claimedMode: 'WALKING',
          detectedMode: 'STATIONARY',
          stepCount,
          totalDistanceKm: journey.totalDistanceKm,
          details: `Detected ${stepCount} steps while total GPS displacement is ${(journey.totalDistanceKm * 1000).toFixed(0)}m (stationary shaking fraud).`,
        },
      });
    }

    // 4. LARGE DISTANCE WITH NO WALKING MOVEMENT PATTERN (Requirement 8)
    if (journey && journey.totalDistanceKm > 0.25 && sensorWindow.accelerationsX && sensorWindow.accelerationsX.length > 0) {
      if (accelRms < 0.15 && accelJerk < 0.2 && classification.predictedMode === 'WALKING') {
        fraudScore += 55;
        fraudEvents.push({
          fraudType: 'ZERO_WALKING_ACCEL_PATTERN',
          severity: 'MEDIUM',
          fraudScore: 55,
          evidence: {
            claimedMode: 'WALKING',
            detectedMode: 'PASSIVE_TRANSIT',
            totalDistanceKm: journey.totalDistanceKm,
            accelRms,
            details: 'Distance accumulated without physical pedestrian walking acceleration signatures.',
          },
        });
      }
    }

    // 5. SCOOTER VS CYCLING ATTACK VECTOR
    if (speedKmh >= 10.0 && speedKmh <= 28.0) {
      if (cadence === 0 && accelJerk < 1.8 && accelRms < 0.6) {
        if (classification.predictedMode === 'CYCLING') {
          fraudScore += 65;
          fraudEvents.push({
            fraudType: 'SCOOTER_PRETENDING_CYCLING',
            severity: 'HIGH',
            fraudScore: 65,
            evidence: {
              claimedMode: 'CYCLING',
              detectedMode: 'SCOOTER',
              gpsSpeedKmh: speedKmh,
              cadence: 0,
              accelJerk,
              details: 'GPS velocity matches cycling, but human cadence is zero and acceleration lacks human pedal jerk.',
            },
          });
        }
      }
    }

    // 6. CAR PRETENDING TO BE BUS
    if (classification.predictedMode === 'CAR' && feats.transitCorridorOverlap > 0.6) {
      if (feats.stopFrequency < 0.1 && feats.dwellTimeRatio < 0.1 && feats.bleBeaconProximity === 0) {
        fraudScore += 45;
        fraudEvents.push({
          fraudType: 'CAR_PRETENDING_BUS',
          severity: 'MEDIUM',
          fraudScore: 45,
          evidence: {
            claimedMode: 'BUS',
            detectedMode: 'CAR',
            gpsSpeedKmh: speedKmh,
            cadence: 0,
            accelJerk,
            details: 'Vehicle traveling along bus corridor without passenger dwell stops or transit beacon signatures.',
          },
        });
      }
    }

    // 7. IMPOSSIBLE ACCELERATION & KINEMATIC VIOLATIONS
    if (feats.gpsAccelRms > 8.0 || (sensorWindow.accelerationX && Math.abs(sensorWindow.accelerationX) > 15.0)) {
      fraudScore += 75;
      fraudEvents.push({
        fraudType: 'IMPOSSIBLE_ACCELERATION',
        severity: 'HIGH',
        fraudScore: 75,
        evidence: {
          claimedMode: classification.predictedMode,
          detectedMode: 'UNKNOWN',
          gpsSpeedKmh: speedKmh,
          cadence,
          accelJerk,
          details: 'Acceleration exceeds physical limits (> 15 m/s²), indicating location spoofing or sensor injection.',
        },
      });
    }

    // 8. IMPOSSIBLE SPEED / TELEPORTATION
    if (maxSpeedKmh > 140.0) {
      fraudScore += 85;
      fraudEvents.push({
        fraudType: 'GPS_SPOOFING_IMPOSSIBLE_SPEED',
        severity: 'CRITICAL',
        fraudScore: 85,
        evidence: {
          claimedMode: classification.predictedMode,
          detectedMode: 'UNKNOWN',
          gpsSpeedKmh: maxSpeedKmh,
          cadence,
          accelJerk,
          details: `Velocity ${maxSpeedKmh} km/h is impossible for urban surface mobility.`,
        },
      });
    }

    // 9. LOCATION TELEPORTATION CHECK (against previous waypoint)
    if (journey && journey.segments && journey.segments.length > 0) {
      const lastSegment = journey.segments[journey.segments.length - 1];
      if (lastSegment.waypoints && lastSegment.waypoints.length > 0) {
        const lastPt = lastSegment.waypoints[lastSegment.waypoints.length - 1];
        if (sensorWindow.latitude && sensorWindow.longitude && lastPt.lat && lastPt.lng) {
          const distMeters = this.haversineDistance(
            lastPt.lat,
            lastPt.lng,
            sensorWindow.latitude,
            sensorWindow.longitude
          );
          const timeDeltaSec = Math.max(0.5, (Date.now() - new Date(lastPt.timestamp).getTime()) / 1000);
          if (distMeters > 150 && timeDeltaSec < 10) {
            const calculatedSpeedKmh = (distMeters / timeDeltaSec) * 3.6;
            if (calculatedSpeedKmh > 200.0) {
              fraudScore += 90;
              fraudEvents.push({
                fraudType: 'LOCATION_TELEPORTATION',
                severity: 'CRITICAL',
                fraudScore: 90,
                evidence: {
                  claimedMode: classification.predictedMode,
                  detectedMode: 'UNKNOWN',
                  gpsSpeedKmh: calculatedSpeedKmh,
                  cadence,
                  accelJerk,
                  details: `Location teleported ${Math.round(distMeters)} meters in ${timeDeltaSec.toFixed(1)} seconds.`,
                },
              });
            }
          }
        }
      }
    }

    // Determine risk level category
    const finalScore = Math.min(100, Math.max(0, fraudScore));
    let riskLevel = 'LOW';
    if (finalScore >= 76) riskLevel = 'CRITICAL';
    else if (finalScore >= 51) riskLevel = 'HIGH';
    else if (finalScore >= 21) riskLevel = 'MEDIUM';

    // Persist fraud events if severe
    if (fraudEvents.length > 0 && journey && journey._id) {
      for (const ev of fraudEvents) {
        try {
          await FraudEvent.create({
            journeyId: journey._id,
            userId: journey.userId,
            fraudType: ev.fraudType,
            severity: ev.severity,
            fraudScore: ev.fraudScore,
            evidence: ev.evidence,
            actionTaken: finalScore > 50 ? 'REWARD_HELD' : 'FLAGGED_FOR_AUDIT',
          });
        } catch (err) {
          console.error('[FraudService] Failed to log FraudEvent:', err.message);
        }
      }
    }

    return {
      fraudScore: finalScore,
      riskLevel,
      fraudEvents,
      isFlagged: finalScore > 40,
    };
  }

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

module.exports = new FraudDetectionService();
