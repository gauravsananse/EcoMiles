/**
 * Walking Verification & Device Intelligence Service
 * Modular engine for:
 * 1. Intelligent Device & Hardware Capability Probing (Mobile vs Desktop/Laptop)
 * 2. Real-Time Hardware Accelerometer Peak Step Detection
 * 3. Multi-Sensor Walking Confidence Score Calculation
 * 4. Anti-Fraud Kinematic Rules & Handover Logic
 * 5. Plug-and-play Native Android API Bridge Extensibility
 */

export class WalkingVerificationService {
  constructor() {
    this.stepCount = 0;
    this.lastStepTimestamp = 0;
    this.accelBuffer = [];
    this.minStepIntervalMs = 280; // Max ~214 steps/min (human sprint threshold)
    this.maxStepIntervalMs = 1200; // Min ~50 steps/min
    this.stepThreshold = 1.65; // Dynamic acceleration peak magnitude in m/s² above gravity
    this.lastPeak = 0;
    this.isPeakLooking = true;

    // Real-time walking metrics
    this.currentGpsSpeed = 0;
    this.totalDistanceKm = 0;
    this.lastLocation = null;
    this.walkingConfidence = 0;
    this.isWalkingVerified = false;
    this.evidence = [];
  }

  /**
   * Probe device capabilities without making assumptions
   */
  detectDeviceCapabilities() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        isMobile: false,
        deviceType: 'UNKNOWN',
        os: 'UNKNOWN',
        hasGps: false,
        hasAccelerometer: false,
        hasGyroscope: false,
        hasStepCounter: false,
        isSupportedForWalkingVerification: false,
        summary: 'Environment unsupported',
      };
    }

    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(ua);
    const isMobileUserAgentData = Boolean(navigator.userAgentData?.mobile);
    const hasTouch = (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || ('ontouchstart' in window);
    
    // Distinguish iPad / Tablets vs Mobile Phone vs Laptop/Desktop
    const isTablet = /(iPad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk)/i.test(ua);
    const isMobile = (isMobileUA || isMobileUserAgentData || (hasTouch && window.innerWidth <= 820)) && !isTablet;
    const isLaptopOrDesktop = !isMobile && !isTablet;

    let deviceType = 'DESKTOP';
    if (isMobile) deviceType = 'MOBILE';
    else if (isTablet) deviceType = 'TABLET';
    else if (/Macintosh|Windows NT|Linux/i.test(ua)) deviceType = 'LAPTOP';

    let os = 'Unknown OS';
    if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Macintosh/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    // Sensor availability probes
    const hasGps = 'geolocation' in navigator;
    const hasAccelerometer = 'DeviceMotionEvent' in window || typeof window.DeviceMotionEvent !== 'undefined';
    const hasGyroscope = 'DeviceOrientationEvent' in window || typeof window.DeviceOrientationEvent !== 'undefined';
    
    // Check if browser has native StepCounter API (or custom native Android wrapper)
    const hasNativeStepCounter = 'StepCounter' in window || 'WebKitStepCounter' in window || Boolean(window.AndroidStepCounter);

    // Walking verification strictly requires mobile hardware sensors
    const isSupportedForWalkingVerification = isMobile && hasGps;

    return {
      isMobile,
      deviceType,
      os,
      hasGps,
      hasAccelerometer,
      hasGyroscope,
      hasStepCounter: hasNativeStepCounter || (isMobile && hasAccelerometer),
      isSupportedForWalkingVerification,
      requiresMotionPermission: os === 'iOS' && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function',
      details: {
        touchPoints: navigator.maxTouchPoints || 0,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        userAgent: ua,
      },
    };
  }

  /**
   * Reset trip counters
   */
  resetJourney() {
    this.stepCount = 0;
    this.lastStepTimestamp = 0;
    this.accelBuffer = [];
    this.lastPeak = 0;
    this.isPeakLooking = true;
    this.currentGpsSpeed = 0;
    this.totalDistanceKm = 0;
    this.lastLocation = null;
    this.walkingConfidence = 0;
    this.isWalkingVerified = false;
    this.evidence = [];
  }

  /**
   * Real step detection algorithm using physical 3-axis accelerometer data
   */
  processAccelerometerReading(accel, timestamp = Date.now()) {
    if (!accel) return { stepCount: this.stepCount, stepDetected: false, cadence: 0 };

    const x = accel.x || 0;
    const y = accel.y || 0;
    const z = accel.z !== null && accel.z !== undefined ? accel.z : 9.81;

    // Dynamic linear acceleration magnitude excluding earth gravity
    const magnitude = Math.sqrt(x * x + y * y + Math.pow(z - 9.81, 2));

    this.accelBuffer.push({ magnitude, timestamp });
    if (this.accelBuffer.length > 25) {
      this.accelBuffer.shift();
    }

    let stepDetected = false;

    // Peak detection with hysteresis and temporal human gait constraints
    if (magnitude > this.stepThreshold && this.isPeakLooking) {
      const timeSinceLastStep = timestamp - this.lastStepTimestamp;
      if (timeSinceLastStep >= this.minStepIntervalMs && timeSinceLastStep <= this.maxStepIntervalMs) {
        this.stepCount++;
        this.lastStepTimestamp = timestamp;
        this.isPeakLooking = false;
        stepDetected = true;
      } else if (this.lastStepTimestamp === 0) {
        this.stepCount++;
        this.lastStepTimestamp = timestamp;
        this.isPeakLooking = false;
        stepDetected = true;
      }
    } else if (magnitude < 0.8 && !this.isPeakLooking) {
      // Valley reset for next peak
      this.isPeakLooking = true;
    }

    // Compute live cadence (steps per minute over recent window)
    const cadence = this.calculateInstantCadence(timestamp);

    return {
      stepCount: this.stepCount,
      stepDetected,
      cadence,
      magnitude,
    };
  }

  calculateInstantCadence(now = Date.now()) {
    if (this.lastStepTimestamp === 0 || now - this.lastStepTimestamp > 3000) {
      return 0;
    }
    const recentInterval = now - this.lastStepTimestamp;
    if (recentInterval > 0) {
      const spm = Math.round(60000 / Math.max(recentInterval, 300));
      return Math.min(180, Math.max(60, spm));
    }
    return 0;
  }

  /**
   * Compute multi-signal Walking Confidence Score (0% - 100%)
   */
  calculateWalkingConfidence({
    deviceInfo,
    gpsSpeedKmh = 0,
    distanceKm = 0,
    stepCount = 0,
    hasStepCounter = false,
    accelData = null,
    gyroData = null,
    elapsedSeconds = 0,
  }) {
    // 1. Desktop/Laptop check - never verify walking without mobile device
    if (!deviceInfo.isMobile) {
      return {
        confidenceScore: 0,
        isVerified: false,
        statusLabel: 'Desktop - No Walking Verification',
        reason: 'Walking verification requires mobile device sensors (accelerometer, gyroscope, step counter).',
        signals: {
          gps: 'GPS only (Unverified for walking)',
          accelerometer: 'Not available on desktop/laptop',
          gyroscope: 'Not available on desktop/laptop',
          stepCounter: 'Not available on desktop/laptop',
        },
      };
    }

    let score = 0;
    const evidenceList = [];
    const signals = {
      gps: 'Inactive',
      accelerometer: 'Not available',
      gyroscope: 'Not available',
      stepCounter: hasStepCounter ? 'Active' : 'Not available on this device',
    };

    // 2. GPS Speed Evaluation
    const speed = Math.max(0, gpsSpeedKmh || 0);
    if (speed >= 1.5 && speed <= 6.5) {
      // Optimal walking speed band
      if (speed >= 3.2 && speed <= 5.4) {
        score += 35; // Perfect human pedestrian gait speed
        evidenceList.push(`GPS speed (${speed.toFixed(1)} km/h) matches natural human walking pace`);
      } else {
        score += 25;
        evidenceList.push(`GPS speed (${speed.toFixed(1)} km/h) within human walking range`);
      }
      signals.gps = `${speed.toFixed(1)} km/h`;
    } else if (speed > 0.5 && speed < 1.5) {
      score += 15; // Slow stroll / pedestrian pause
      signals.gps = `${speed.toFixed(1)} km/h (Slow stroll)`;
    } else if (speed > 7.5) {
      // Over walking speed limit (cycling/vehicle)
      score -= 30;
      signals.gps = `${speed.toFixed(1)} km/h (Exceeds walking limit)`;
      evidenceList.push(`GPS speed ${speed.toFixed(1)} km/h is too fast for walking (Cycling/Motor vehicle profile)`);
    } else {
      signals.gps = '0.0 km/h';
    }

    // 3. Accelerometer Walking Pattern
    if (accelData && (accelData.x !== undefined || accelData.magnitude !== undefined)) {
      const mag = accelData.magnitude || Math.sqrt(Math.pow(accelData.x || 0, 2) + Math.pow(accelData.y || 0, 2) + Math.pow((accelData.z || 9.81) - 9.81, 2));
      if (mag >= 0.8 && mag <= 4.2) {
        score += 30;
        signals.accelerometer = 'Walking pattern detected ✓';
        evidenceList.push('Accelerometer: Rhythmic pedestrian impact & step oscillation detected ✓');
      } else if (mag > 0.3) {
        score += 15;
        signals.accelerometer = 'Low motion detected';
      } else {
        signals.accelerometer = 'Stationary / Negligible motion';
      }
    } else {
      signals.accelerometer = 'Not available on this device';
    }

    // 4. Gyroscope Rotational Stride Oscillation
    if (gyroData && (gyroData.alpha !== undefined || gyroData.gamma !== undefined)) {
      const rot = Math.abs(gyroData.alpha || 0) + Math.abs(gyroData.beta || 0) + Math.abs(gyroData.gamma || 0);
      if (rot > 2.0 && rot < 120.0) {
        score += 20;
        signals.gyroscope = 'Motion detected ✓';
        evidenceList.push('Gyroscope: Natural torso/leg rotational motion detected ✓');
      } else if (rot > 0.5) {
        score += 10;
        signals.gyroscope = 'Active';
      } else {
        signals.gyroscope = 'Stationary';
      }
    } else {
      signals.gyroscope = 'Not available on this device';
    }

    // 5. Step Counter Verification
    if (stepCount > 0) {
      score += 15;
      signals.stepCounter = `${stepCount.toLocaleString()} steps`;
      evidenceList.push(`Step Counter: ${stepCount.toLocaleString()} verified steps`);

      // Check cadence coherence
      if (elapsedSeconds > 10) {
        const avgCadence = (stepCount / (elapsedSeconds / 60));
        if (avgCadence >= 70 && avgCadence <= 150) {
          score += 10;
          evidenceList.push(`Cadence: ${Math.round(avgCadence)} steps/min matches active walking`);
        }
      }
    } else if (hasStepCounter) {
      signals.stepCounter = '0 steps (Awaiting motion)';
    }

    // Normalized Confidence Score (0 - 100%)
    const finalScore = Math.min(99, Math.max(5, score));
    const isVerified = finalScore >= 70 && speed <= 7.2;

    return {
      confidenceScore: finalScore,
      isVerified,
      statusLabel: isVerified ? 'Walking Verified ✓' : (finalScore >= 50 ? 'Partial Verification' : 'Low Walking Confidence'),
      evidence: evidenceList,
      signals,
    };
  }

  /**
   * Anti-Fraud Inspection Rules
   */
  evaluateAntiFraud({
    deviceInfo,
    gpsSpeedKmh = 0,
    distanceKm = 0,
    stepCount = 0,
    elapsedSeconds = 0,
    accelMagnitude = 0,
    hasLocationJumps = false,
  }) {
    const triggers = [];
    let isSuspicious = false;

    // Rule 1: Desktop claiming walking
    if (!deviceInfo.isMobile) {
      isSuspicious = true;
      triggers.push('Desktop/Laptop access cannot be verified for walking GreenCredits.');
    }

    // Rule 2: Very high GPS speed but very few steps (driving/cycling/transit claiming walking)
    if (gpsSpeedKmh > 9.0 && stepCount < 30 && elapsedSeconds > 15) {
      isSuspicious = true;
      triggers.push(`High GPS speed (${gpsSpeedKmh.toFixed(1)} km/h) with insufficient steps (${stepCount}). Likely vehicle or bicycle.`);
    }

    // Rule 3: Large distance with no walking movement pattern
    if (distanceKm > 0.3 && accelMagnitude < 0.2 && elapsedSeconds > 20) {
      isSuspicious = true;
      triggers.push('Distance traversed without physical accelerometer walking oscillation.');
    }

    // Rule 4: Thousands of steps while GPS distance is almost zero (shaking phone stationary)
    if (stepCount > 300 && distanceKm < 0.03 && elapsedSeconds > 30) {
      isSuspicious = true;
      triggers.push(`High step count (${stepCount}) with near-zero GPS displacement (${(distanceKm * 1000).toFixed(0)}m). Stationary shaking detected.`);
    }

    // Rule 5: Impossible speed/step combinations (e.g. >25 km/h with high steps)
    if (gpsSpeedKmh > 25.0 && stepCount > 100) {
      isSuspicious = true;
      triggers.push('Impossible kinematic combination: High vehicle speed with step cadence.');
    }

    // Rule 6: Sudden unrealistic location jumps / teleportation
    if (hasLocationJumps) {
      isSuspicious = true;
      triggers.push('Unrealistic GPS jump/teleportation detected between trajectory waypoints.');
    }

    return {
      isSuspicious,
      validationOutcome: isSuspicious ? 'UNVERIFIED JOURNEY' : 'VALID WALKING JOURNEY',
      badgeLabel: isSuspicious ? '⚠️ Journey Requires Verification' : 'VALID WALKING JOURNEY',
      triggers,
    };
  }
}

export const walkingVerificationService = new WalkingVerificationService();
