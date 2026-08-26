/**
 * Anti-Fraud Detection Engine
 * Evaluates kinematic plausibility, sensor consistency, attack vectors,
 * and outputs an independent 0–100 Fraud Risk Score with detailed fraud triggers.
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

    // 1. SCOOTER VS CYCLING ATTACK VECTOR
    // User claims cycling or travels at 12–25 km/h, but uses petrol/electric scooter
    if (speedKmh >= 10.0 && speedKmh <= 28.0) {
      if (cadence === 0 && accelJerk < 1.8 && accelRms < 0.6) {
        // High confidence scooter profile
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

    // 2. CAR PRETENDING TO BE BUS
    // Driving a private vehicle along a bus route to farm transit credits
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

    // 3. IMPOSSIBLE ACCELERATION & KINEMATIC VIOLATIONS
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

    // 4. IMPOSSIBLE SPEED / TELEPORTATION
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

    // 5. LOCATION TELEPORTATION CHECK (against previous waypoint)
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
          const timeDeltaSec = (Date.now() - new Date(lastPt.timestamp).getTime()) / 1000;
          if (timeDeltaSec > 0 && timeDeltaSec < 10) {
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

    // 6. SENSOR INCONSISTENCY (High GPS speed, but zero motion sensor movement)
    if (speedKmh > 30.0 && sensorWindow.accelerationsX && sensorWindow.accelerationsX.length > 0) {
      if (accelRms < 0.05 && accelJerk < 0.1) {
        fraudScore += 50;
        fraudEvents.push({
          fraudType: 'SENSOR_INCONSISTENCY',
          severity: 'MEDIUM',
          fraudScore: 50,
          evidence: {
            claimedMode: classification.predictedMode,
            detectedMode: 'UNKNOWN',
            gpsSpeedKmh: speedKmh,
            cadence,
            accelJerk,
            details: 'Device GPS reports high speed transit, but accelerometer reports zero motion.',
          },
        });
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
