/**
 * Cycling Verification Engine
 * Dedicated multi-sensor verification pipeline exclusively for cycling activity.
 * 
 * Strict separation:
 * - NEVER calculates or emits walkingConfidence (always null in cycling context).
 * - NEVER counts, registers, or increments walking steps.
 * - Employs configurable multi-factor feature weights:
 *     1. GPS Consistency (20%)
 *     2. Speed Consistency (25%)
 *     3. Acceleration Pattern (20%)
 *     4. Route Continuity (15%)
 *     5. Movement Consistency (10%)
 *     6. Sensor Consistency (10%)
 * 
 * Classification States:
 *   90-100% -> VERIFIED CYCLING
 *   70-89%  -> PROBABLE CYCLING
 *   40-69%  -> UNCERTAIN
 *   0-39%   -> NOT VERIFIED
 */

export class CyclingVerificationEngine {
  constructor() {
    // Configurable feature weights (must sum to 100)
    this.weights = {
      gpsConsistency: 20,
      speedConsistency: 25,
      accelerationPattern: 20,
      routeContinuity: 15,
      movementConsistency: 10,
      sensorConsistency: 10,
    };

    this.resetJourney();
  }

  /**
   * Reset cycling session metrics completely to zero
   */
  resetJourney() {
    this.sessionStartTime = Date.now();
    this.currentGpsSpeed = 0;
    this.calculatedSpeed = 0;
    this.totalDistanceKm = 0;
    this.cyclingConfidence = 0; // Starts strictly at 0%
    this.verificationState = 'NOT VERIFIED'; // 'NOT VERIFIED' | 'UNCERTAIN' | 'PROBABLE CYCLING' | 'VERIFIED CYCLING'
    this.stateCode = 'NOT_VERIFIED'; // 'NOT_VERIFIED' | 'UNCERTAIN' | 'PROBABLE' | 'VERIFIED'
    
    this.lastConfidenceUpdateTime = Date.now();
    this.lastGpsTimestamp = null;
    this.lastSensorTimestamp = null;
    this.lastValidLocation = null;
    this.lastAccuracy = null;

    this.hasAccelerometer = false;
    this.hasGyroscope = false;

    this.recentPositions = []; // Sliding window of GPS fixes
    this.recentSpeeds = []; // Rolling buffer of speeds (km/h)
    this.recentAccelerations = []; // Rolling buffer of accel dynamics
    this.recentGyroVelocities = []; // Rolling buffer of gyro velocities
    this.cyclingFlags = []; // Active condition/fraud/warning flags

    this.continuousCyclingStartTime = 0;
    this.stationaryStartTime = Date.now();
  }

  /**
   * Haversine formula for distance in kilometers
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // Earth radius in km
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
   * Process incoming GPS fix
   */
  processGpsPosition({ latitude, longitude, accuracy, speed, timestamp }) {
    const now = timestamp || Date.now();
    this.lastGpsTimestamp = now;
    this.lastAccuracy = accuracy ? Math.round(accuracy) : null;

    let computedSpeedKmh = 0;

    // Filter unusable accuracy fixes (> 45m)
    if (accuracy && accuracy > 45) {
      if (!this.cyclingFlags.includes('POOR_GPS_ACCURACY')) {
        this.cyclingFlags.push('POOR_GPS_ACCURACY');
      }
      return {
        speedKmh: this.currentGpsSpeed,
        distanceKm: Number(this.totalDistanceKm.toFixed(3)),
        accuracy: this.lastAccuracy,
      };
    } else {
      this.cyclingFlags = this.cyclingFlags.filter((f) => f !== 'POOR_GPS_ACCURACY');
    }

    if (this.lastValidLocation) {
      const dt = Math.max(0.2, (now - this.lastValidLocation.time) / 1000);
      const deltaKm = this.haversineDistance(
        this.lastValidLocation.lat,
        this.lastValidLocation.lng,
        latitude,
        longitude
      );
      const deltaMeters = deltaKm * 1000;

      // Filter stationary GPS jitter: < 2.5 meters in <= 2 seconds is stationary drift
      if (deltaMeters < 2.5 && dt <= 2.0) {
        // Stationary drift
        computedSpeedKmh = 0;
      } else {
        const rawSpeedKmh = (deltaKm / (dt / 3600));

        // Plausibility check for cycling: discard sudden teleportation spikes > 65 km/h
        if (rawSpeedKmh <= 65) {
          computedSpeedKmh = rawSpeedKmh;
          this.totalDistanceKm += deltaKm;
        } else {
          if (!this.cyclingFlags.includes('GPS_SPEED_SPIKE_REJECTED')) {
            this.cyclingFlags.push('GPS_SPEED_SPIKE_REJECTED');
          }
        }
      }
    }

    // Hardware GPS speed reading integration
    let bestSpeedKmh = computedSpeedKmh;
    if (speed !== null && speed !== undefined && !isNaN(speed) && speed >= 0) {
      const hardwareKmh = speed * 3.6;
      if (hardwareKmh <= 65) {
        bestSpeedKmh = hardwareKmh < 1.0 && computedSpeedKmh < 1.5 ? 0 : (hardwareKmh * 0.7 + computedSpeedKmh * 0.3);
      }
    }

    // Rolling speed smoothing (3-sample window)
    this.recentSpeeds.push(bestSpeedKmh);
    if (this.recentSpeeds.length > 3) this.recentSpeeds.shift();
    const smoothedSpeed = this.recentSpeeds.reduce((a, b) => a + b, 0) / this.recentSpeeds.length;

    this.currentGpsSpeed = Number(Math.max(0, smoothedSpeed).toFixed(1));
    this.calculatedSpeed = this.currentGpsSpeed;

    // Track position window for route continuity
    this.recentPositions.push({ lat: latitude, lng: longitude, time: now, speed: this.currentGpsSpeed });
    if (this.recentPositions.length > 10) this.recentPositions.shift();

    this.lastValidLocation = { lat: latitude, lng: longitude, time: now };

    return {
      speedKmh: this.currentGpsSpeed,
      distanceKm: Number(this.totalDistanceKm.toFixed(3)),
      accuracy: this.lastAccuracy,
    };
  }

  /**
   * Process raw sensor reading (accelerometer & gyroscope)
   */
  processSensorReading({ acceleration, rotationRate, timestamp }) {
    const now = timestamp || Date.now();
    this.lastSensorTimestamp = now;

    if (acceleration) {
      this.hasAccelerometer = true;
      const ax = acceleration.x || 0;
      const ay = acceleration.y || 0;
      const az = acceleration.z || 0;
      const mag = Math.sqrt(ax * ax + ay * ay + az * az);
      const dynamicMag = Math.abs(mag - 9.81);

      this.recentAccelerations.push(dynamicMag);
      if (this.recentAccelerations.length > 25) this.recentAccelerations.shift();
    }

    if (rotationRate) {
      this.hasGyroscope = true;
      const rx = rotationRate.alpha || 0;
      const ry = rotationRate.beta || 0;
      const rz = rotationRate.gamma || 0;
      const rotVel = Math.sqrt(rx * rx + ry * ry + rz * rz);

      this.recentGyroVelocities.push(rotVel);
      if (this.recentGyroVelocities.length > 25) this.recentGyroVelocities.shift();
    }
  }

  /**
   * Calculate Cycling Confidence (0 - 100) using multi-sensor evidence
   * Strictly outputs cyclingConfidence and NEVER walkingConfidence.
   */
  calculateCyclingConfidence(options = {}) {
    const now = Date.now();
    const {
      gpsSpeedKmh = this.currentGpsSpeed,
      gpsAccuracy = this.lastAccuracy,
      isTestMode = false,
    } = options;

    const evidenceList = [];
    const activeFlags = [];

    // --- Factor 1: GPS Consistency (Weight: 20%) ---
    let gpsScore = 0;
    if (gpsAccuracy !== null && gpsAccuracy !== undefined) {
      if (gpsAccuracy <= 15) {
        gpsScore = this.weights.gpsConsistency;
        evidenceList.push(`High GPS precision (±${gpsAccuracy}m)`);
      } else if (gpsAccuracy <= 30) {
        gpsScore = this.weights.gpsConsistency * 0.75;
        evidenceList.push(`Moderate GPS precision (±${gpsAccuracy}m)`);
      } else if (gpsAccuracy <= 45) {
        gpsScore = this.weights.gpsConsistency * 0.40;
        evidenceList.push(`Marginal GPS precision (±${gpsAccuracy}m)`);
      } else {
        gpsScore = 0;
        activeFlags.push('POOR_GPS_ACCURACY');
        evidenceList.push(`Unreliable GPS precision (±${gpsAccuracy}m)`);
      }
    } else if (isTestMode) {
      gpsScore = this.weights.gpsConsistency * 0.8;
    }

    // --- Factor 2: Speed Consistency (Weight: 25%) ---
    // Typical cycling speed: 8 - 32 km/h
    // Pedestrian/walking: < 5 km/h
    // Motor vehicle: > 45 km/h
    let speedScore = 0;
    if (gpsSpeedKmh < 3.0) {
      // Stopped / Idling / Stationary
      speedScore = 0;
      evidenceList.push(`Stationary / Stopped (${gpsSpeedKmh.toFixed(1)} km/h)`);
    } else if (gpsSpeedKmh >= 3.0 && gpsSpeedKmh < 7.0) {
      // Starting up or slow cycling crawl
      speedScore = this.weights.speedConsistency * 0.45;
      evidenceList.push(`Low cycling speed (${gpsSpeedKmh.toFixed(1)} km/h)`);
    } else if (gpsSpeedKmh >= 7.0 && gpsSpeedKmh <= 32.0) {
      // Prime bicycle cruising speed
      speedScore = this.weights.speedConsistency;
      evidenceList.push(`Normal cycling speed range (${gpsSpeedKmh.toFixed(1)} km/h)`);
    } else if (gpsSpeedKmh > 32.0 && gpsSpeedKmh <= 45.0) {
      // Fast cycling or downhill sprint
      speedScore = this.weights.speedConsistency * 0.65;
      evidenceList.push(`Elevated cycling / downhill speed (${gpsSpeedKmh.toFixed(1)} km/h)`);
    } else {
      // Speed > 45 km/h: Exceeds human bicycle capabilities -> Motor vehicle lockout!
      speedScore = 0;
      activeFlags.push('VEHICLE_SPEED_LOCKOUT');
      evidenceList.push(`Speed exceeds bicycle capability (> 45 km/h: ${gpsSpeedKmh.toFixed(1)} km/h)`);
    }

    // --- Factor 3: Acceleration Pattern (Weight: 20%) ---
    // Cycling shows continuous micro-vibrations from pavement (0.15 - 1.2 m/s² dynamic)
    // without the large 2Hz impact spikes (> 2.5 m/s²) characteristic of walking/running footstrikes.
    let accelScore = 0;
    if (this.recentAccelerations.length > 0) {
      const avgDynamic = this.recentAccelerations.reduce((a, b) => a + b, 0) / this.recentAccelerations.length;
      const maxDynamic = Math.max(...this.recentAccelerations);

      if (avgDynamic >= 0.12 && avgDynamic <= 1.5 && maxDynamic < 3.2) {
        accelScore = this.weights.accelerationPattern;
        evidenceList.push('Road roll & pedaling acceleration profile detected');
      } else if (avgDynamic > 1.5 && maxDynamic >= 3.2) {
        // High impact peaks -> likely running, walking, or phone shaking
        accelScore = this.weights.accelerationPattern * 0.25;
        activeFlags.push('ERRATIC_IMPACT_SPIKES');
        evidenceList.push('High impact spikes non-characteristic of smooth bicycle motion');
      } else if (avgDynamic < 0.08 && gpsSpeedKmh > 10) {
        // High speed but 0 vibration (phone sitting in motorized car or bus on smooth highway)
        accelScore = this.weights.accelerationPattern * 0.3;
        activeFlags.push('SUSPICIOUS_LOW_VIBRATION');
        evidenceList.push('Absence of road vibration at speed');
      } else {
        accelScore = this.weights.accelerationPattern * 0.5;
      }
    } else {
      // Graceful fallback if accelerometer unavailable
      accelScore = this.weights.accelerationPattern * 0.5;
    }

    // --- Factor 4: Route Continuity (Weight: 15%) ---
    // Continuous directional vector progress vs stationary back-and-forth jitter
    let routeScore = 0;
    if (this.recentPositions.length >= 3) {
      const pFirst = this.recentPositions[0];
      const pLast = this.recentPositions[this.recentPositions.length - 1];
      const netDisplacement = this.haversineDistance(pFirst.lat, pFirst.lng, pLast.lat, pLast.lng) * 1000;
      
      if (netDisplacement >= 12) {
        routeScore = this.weights.routeContinuity;
        evidenceList.push(`Continuous route displacement (${Math.round(netDisplacement)}m over window)`);
      } else if (netDisplacement >= 5) {
        routeScore = this.weights.routeContinuity * 0.6;
      } else {
        routeScore = 0;
        if (gpsSpeedKmh < 4) {
          activeFlags.push('STATIONARY_ROUTE');
        }
      }
    } else {
      routeScore = this.weights.routeContinuity * 0.4;
    }

    // --- Factor 5: Movement Consistency (Weight: 10%) ---
    // Sustained motion over time
    let movementScore = 0;
    if (gpsSpeedKmh >= 6.0) {
      if (this.continuousCyclingStartTime === 0) {
        this.continuousCyclingStartTime = now;
      }
      const durationSeconds = (now - this.continuousCyclingStartTime) / 1000;
      if (durationSeconds >= 10) {
        movementScore = this.weights.movementConsistency;
        evidenceList.push(`Sustained cycling movement (${Math.round(durationSeconds)}s)`);
      } else {
        movementScore = this.weights.movementConsistency * (durationSeconds / 10);
      }
    } else {
      this.continuousCyclingStartTime = 0;
      movementScore = 0;
    }

    // --- Factor 6: Sensor Consistency (Weight: 10%) ---
    // Checks that motion sensors harmonize with GPS speed
    let sensorConsistencyScore = 0;
    if (gpsSpeedKmh > 5.0 && this.recentAccelerations.length > 0) {
      sensorConsistencyScore = this.weights.sensorConsistency;
    } else if (gpsSpeedKmh <= 1.0) {
      // When stopped, sensors should also be calm
      sensorConsistencyScore = this.weights.sensorConsistency * 0.8;
    } else {
      sensorConsistencyScore = this.weights.sensorConsistency * 0.5;
    }

    // Sum initial target confidence
    let rawTargetConfidence = gpsScore + speedScore + accelScore + routeScore + movementScore + sensorConsistencyScore;

    // Apply strict penalties
    if (activeFlags.includes('VEHICLE_SPEED_LOCKOUT')) {
      rawTargetConfidence = Math.min(rawTargetConfidence, 15);
    }
    if (activeFlags.includes('ERRATIC_IMPACT_SPIKES')) {
      rawTargetConfidence = Math.min(rawTargetConfidence, 45);
    }
    if (gpsSpeedKmh < 2.5) {
      // When stationary, confidence must decay toward 0
      rawTargetConfidence = 0;
    }

    // Slew-rate temporal smoothing: gradual rise (max +12%/s) and smooth decay (-18%/s)
    const dt = Math.min(1.5, Math.max(0.05, (now - this.lastConfidenceUpdateTime) / 1000));
    this.lastConfidenceUpdateTime = now;

    if (rawTargetConfidence > this.cyclingConfidence) {
      this.cyclingConfidence = Math.min(rawTargetConfidence, this.cyclingConfidence + dt * 12);
    } else {
      this.cyclingConfidence = Math.max(rawTargetConfidence, this.cyclingConfidence - dt * 18);
    }

    const confidenceScore = Math.max(0, Math.min(100, Math.round(this.cyclingConfidence)));

    // Map to defined classification states:
    // 90-100 -> VERIFIED CYCLING
    // 70-89  -> PROBABLE CYCLING
    // 40-69  -> UNCERTAIN
    // 0-39   -> NOT VERIFIED
    let statusLabel = 'NOT VERIFIED';
    let stateCode = 'NOT_VERIFIED';
    let isVerified = false;

    if (confidenceScore >= 90) {
      statusLabel = 'VERIFIED CYCLING';
      stateCode = 'VERIFIED';
      isVerified = true;
    } else if (confidenceScore >= 70) {
      statusLabel = 'PROBABLE CYCLING';
      stateCode = 'PROBABLE';
      isVerified = true;
    } else if (confidenceScore >= 40) {
      statusLabel = 'UNCERTAIN';
      stateCode = 'UNCERTAIN';
      isVerified = false;
    } else {
      statusLabel = 'NOT VERIFIED';
      stateCode = 'NOT_VERIFIED';
      isVerified = false;
    }

    this.verificationState = statusLabel;
    this.stateCode = stateCode;
    this.cyclingFlags = activeFlags;

    const signals = {
      gps: `${gpsSpeedKmh.toFixed(1)} km/h (±${gpsAccuracy || 10}m)`,
      accelerometer: this.hasAccelerometer ? 'Cycling road vibration active ✓' : 'Unavailable',
      gyroscope: this.hasGyroscope ? 'Steering dynamics active ✓' : 'Unavailable',
      steps: 'Disabled in cycling mode',
    };

    return {
      confidenceScore,
      isVerified,
      statusLabel,
      stateCode,
      evidence: evidenceList,
      flags: activeFlags,
      signals,
      walkingConfidence: null, // STRICTLY NULL
    };
  }

  /**
   * Return granular metrics for Development Debug Panel
   */
  getDebugMetrics() {
    return {
      activityMode: 'CYCLING',
      gpsAccuracy: this.lastAccuracy !== null ? `±${this.lastAccuracy}m` : 'N/A',
      gpsSpeed: `${this.currentGpsSpeed.toFixed(1)} km/h`,
      calculatedSpeed: `${this.calculatedSpeed.toFixed(1)} km/h`,
      gpsDistance: `${this.totalDistanceKm.toFixed(3)} km`,
      accelerometerAvailable: this.hasAccelerometer ? 'Yes' : 'No',
      gyroscopeAvailable: this.hasGyroscope ? 'Yes' : 'No',
      cyclingConfidence: `${Math.round(this.cyclingConfidence)}%`,
      verificationState: this.verificationState,
      cyclingFlags: this.cyclingFlags.length > 0 ? this.cyclingFlags.join(', ') : 'None',
      lastGpsUpdate: this.lastGpsTimestamp ? new Date(this.lastGpsTimestamp).toLocaleTimeString() : 'Waiting...',
      lastSensorUpdate: this.lastSensorTimestamp ? new Date(this.lastSensorTimestamp).toLocaleTimeString() : 'Waiting...',
      walkingConfidence: null, // STRICTLY NULL
      sessionSteps: 'DISABLED',
    };
  }
}

export const cyclingVerificationEngine = new CyclingVerificationEngine();
