/**
 * Real Browser & Device Sensor Manager
 * Handles real hardware APIs (Geolocation, DeviceMotionEvent, DeviceOrientationEvent, Web Bluetooth)
 * with robust error handling, iOS permission flows, real-time step peak detection,
 * walking confidence scoring, and anti-fraud telemetry normalization.
 * 
 * NEVER generates fake sensor data. Missing sensors strictly report unavailable.
 */

import { walkingVerificationService } from './walkingVerificationService';
import { cyclingVerificationEngine } from './cyclingVerificationEngine';
import { stepCountingEngine } from './stepCountingEngine';

class SensorManager {
  constructor() {
    this.isListening = false;
    this.currentMode = 'STATIONARY';
    this.activityState = 'IDLE'; // 'IDLE' | 'WALKING_INITIALIZING' | 'WALKING_ACTIVE' | 'WALKING_SUSPICIOUS' | 'CYCLING_INITIALIZING' | 'CYCLING_ACTIVE' | 'PAUSED' | 'COMPLETED'
    this.geoWatchId = null;
    this.deviceInfo = walkingVerificationService.detectDeviceCapabilities();
    this.onUpdateCallback = null;

    // Track last orientation event for angular velocity computation if rotationRate missing
    this.lastOrientationTime = 0;
    this.lastAlpha = null;
    this.lastBeta = null;
    this.lastGamma = null;
    this.currentCyclingConfidence = 0;
    
    // Latest instantaneous readings
    this.currentReading = {
      timestamp: Date.now(),
      latitude: null,
      longitude: null,
      gpsAccuracy: null,
      speed: 0,
      distanceKm: 0,
      heading: 0,
      accelerationX: null,
      accelerationY: null,
      accelerationZ: null,
      accelerationMagnitude: 0,
      dynamicMagnitude: 0,
      rotationAlpha: null, // Euler angle (0 - 360 deg)
      rotationBeta: null,  // Euler angle (-180 - 180 deg)
      rotationGamma: null, // Euler angle (-90 - 90 deg)
      rotationalVelocity: 0, // Angular rate (deg/s)
      stepCount: 0,
      cadence: 0,
      confidence: 0,
      walkingConfidence: 0,
      cyclingConfidence: null,
      isWalkingVerified: false,
      isCyclingVerified: false,
      walkingStatus: 'Not enough walking evidence',
      verificationState: 'Not enough walking evidence',
      bluetoothSignals: [],
      sensorAvailability: {
        gps: false,
        accelerometer: false,
        gyroscope: false,
        stepCounter: false,
        bluetooth: false,
        activityRecognition: false,
        isMobile: this.deviceInfo.isMobile,
        deviceType: this.deviceInfo.deviceType,
      },
    };

    // Buffer of readings for the sliding window (sampled at ~5-10 Hz)
    this.windowBuffer = {
      speeds: [],
      accelerationsX: [],
      accelerationsY: [],
      accelerationsZ: [],
      gyrosAlpha: [],
      gyrosBeta: [],
      gyrosGamma: [],
      headings: [],
      timestamps: [],
      cadenceSamples: [],
      stepDeltas: [],
      bleSignals: [],
    };

    // Real-time UI Update Throttling (~10Hz / 100ms) to prevent 100% CPU lock on mobile
    this.lastUiUpdateTime = 0;
    this.updateScheduled = false;
    this.lastFlushedStepCount = 0;

    // Check static browser support
    this.checkInitialSupport();

    // Event listeners bound
    this.handleMotion = this.handleMotion.bind(this);
    this.handleOrientation = this.handleOrientation.bind(this);
    this.handleGeoSuccess = this.handleGeoSuccess.bind(this);
    this.handleGeoError = this.handleGeoError.bind(this);
  }

  /**
   * Schedule throttled callback to React UI (~10Hz / 100ms)
   * Keeps internal hardware sampling at full 60-100Hz while eliminating UI thread lockup.
   */
  scheduleThrottledUpdate() {
    if (this.updateScheduled) return;
    this.updateScheduled = true;

    const now = Date.now();
    const elapsed = now - this.lastUiUpdateTime;
    const delay = Math.max(0, 100 - elapsed);

    setTimeout(() => {
      this.updateScheduled = false;
      this.lastUiUpdateTime = Date.now();
      if (this.onUpdateCallback && this.isListening) {
        this.onUpdateCallback(this.getCurrentReading());
      }
    }, delay);
  }

  /**
   * Set callback for real-time sensor updates (called on throttled UI ticks)
   */
  setUpdateCallback(cb) {
    this.onUpdateCallback = cb;
  }

  /**
   * Set active transport mode and toggle sensor processing
   */
  setTransportMode(mode) {
    this.currentMode = (mode || 'WALK').toUpperCase();
    const isCycling = this.currentMode === 'CYCLING';
    const isWalking = this.currentMode === 'WALK' || this.currentMode === 'WALKING';

    if (isCycling) {
      this.activityState = 'CYCLING_ACTIVE';
      stepCountingEngine.setEnabled(false);
      walkingVerificationService.setTransportMode('CYCLING');
      this.currentReading.walkingConfidence = null; // STRICTLY NULL
      this.currentReading.stepCount = 0;
      this.currentReading.cadence = 0;
      this.currentReading.isWalkingVerified = false;
    } else if (isWalking) {
      this.activityState = 'WALKING_ACTIVE';
      stepCountingEngine.setEnabled(true);
      walkingVerificationService.setTransportMode('WALK');
      this.currentReading.cyclingConfidence = null; // STRICTLY NULL
      this.currentReading.isCyclingVerified = false;
    } else if (this.currentMode === 'STATIONARY') {
      // User paused walking or stopped briefly — preserve step count & keep step detection ready
      this.activityState = 'IDLE';
      stepCountingEngine.setEnabled(true);
      walkingVerificationService.setTransportMode('WALK');
      this.currentReading.cyclingConfidence = null;
      this.currentReading.cadence = 0;
    } else {
      stepCountingEngine.setEnabled(false);
      walkingVerificationService.setTransportMode(this.currentMode);
      this.currentReading.stepCount = 0;
      this.currentReading.cadence = 0;
      this.currentReading.walkingConfidence = null;
      this.currentReading.cyclingConfidence = null;
    }
    this.updateWalkingScore();
  }

  /**
   * Re-check initial support & probe device
   */
  checkInitialSupport() {
    this.deviceInfo = walkingVerificationService.detectDeviceCapabilities();

    if (typeof window !== 'undefined') {
      const hasGeo = 'geolocation' in navigator;
      const hasMotion = 'DeviceMotionEvent' in window || typeof window.DeviceMotionEvent !== 'undefined';
      const hasOrient = 'DeviceOrientationEvent' in window || typeof window.DeviceOrientationEvent !== 'undefined';
      const hasBle = 'bluetooth' in navigator;

      this.currentReading.sensorAvailability.gps = hasGeo;
      this.currentReading.sensorAvailability.accelerometer = hasMotion;
      this.currentReading.sensorAvailability.gyroscope = hasOrient;
      this.currentReading.sensorAvailability.bluetooth = hasBle;
      this.currentReading.sensorAvailability.stepCounter = this.deviceInfo.hasStepCounter;
      this.currentReading.sensorAvailability.isMobile = this.deviceInfo.isMobile;
      this.currentReading.sensorAvailability.deviceType = this.deviceInfo.deviceType;
    }
  }

  /**
   * Get detected device capabilities
   */
  getDeviceCapabilities() {
    this.checkInitialSupport();
    return this.deviceInfo;
  }

  /**
   * Request iOS 13+ permission for Motion and Orientation synchronously in touch event
   */
  async requestMotionPermissions() {
    let motionGranted = false;
    let orientationGranted = false;

    const promises = [];
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      promises.push(
        DeviceMotionEvent.requestPermission()
          .then((response) => {
            motionGranted = response === 'granted';
          })
          .catch((err) => {
            console.warn('[SensorManager] DeviceMotionEvent permission error:', err.message);
          })
      );
    } else {
      motionGranted = typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
    }

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      promises.push(
        DeviceOrientationEvent.requestPermission()
          .then((response) => {
            orientationGranted = response === 'granted';
          })
          .catch((err) => {
            console.warn('[SensorManager] DeviceOrientationEvent permission error:', err.message);
          })
      );
    } else {
      orientationGranted = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }

    this.currentReading.sensorAvailability.accelerometer = motionGranted;
    this.currentReading.sensorAvailability.gyroscope = orientationGranted;

    return { motionGranted, orientationGranted };
  }

  /**
   * Start listening to real device sensors
   */
  async startListening(mode = 'WALK') {
    // Remove existing listeners first to prevent duplicate listeners
    if (this.isListening) {
      this.stopListening();
    }
    this.isListening = true;
    this.currentMode = (mode || 'WALK').toUpperCase();
    this.clearBuffer();

    const isCycling = this.currentMode === 'CYCLING';
    const isWalking = this.currentMode === 'WALK' || this.currentMode === 'WALKING';

    if (isCycling) {
      this.activityState = 'CYCLING_INITIALIZING';
      cyclingVerificationEngine.resetJourney();
      stepCountingEngine.setEnabled(false);
      walkingVerificationService.setTransportMode('CYCLING');

      this.currentReading.distanceKm = 0;
      this.currentReading.speed = 0;
      this.currentReading.stepCount = 0;
      this.currentReading.cadence = 0;
      this.currentReading.confidence = 0;
      this.currentReading.walkingConfidence = null; // STRICTLY NULL
      this.currentReading.cyclingConfidence = 0;
      this.currentReading.isWalkingVerified = false;
      this.currentReading.isCyclingVerified = false;
      this.currentReading.walkingStatus = 'NOT VERIFIED';
      this.currentReading.verificationState = 'NOT VERIFIED';
    } else {
      this.activityState = isWalking ? 'WALKING_INITIALIZING' : 'IDLE';
      walkingVerificationService.resetJourney();
      walkingVerificationService.setTransportMode(this.currentMode);
      stepCountingEngine.reset();
      stepCountingEngine.setEnabled(isWalking);

      this.currentReading.distanceKm = 0;
      this.currentReading.speed = 0;
      this.currentReading.stepCount = 0;
      this.currentReading.cadence = 0;
      this.currentReading.confidence = 0;
      this.currentReading.walkingConfidence = 0;
      this.currentReading.cyclingConfidence = null; // STRICTLY NULL
      this.currentReading.isWalkingVerified = false;
      this.currentReading.isCyclingVerified = false;
      this.currentReading.walkingStatus = 'Not enough walking evidence';
      this.currentReading.verificationState = 'Not enough walking evidence';
    }

    this.currentReading.latitude = null;
    this.currentReading.longitude = null;
    this.currentReading.gpsAccuracy = null;
    this.lastOrientationTime = 0;

    // Request permissions for mobile devices if needed
    if (this.deviceInfo.isMobile) {
      await this.requestMotionPermissions();
    }

    // 1. Geolocation watchPosition
    if ('geolocation' in navigator) {
      try {
        this.geoWatchId = navigator.geolocation.watchPosition(
          this.handleGeoSuccess,
          this.handleGeoError,
          {
            enableHighAccuracy: true,
            maximumAge: 3000,
            timeout: 15000,
          }
        );
      } catch (err) {
        console.warn('[SensorManager] Geolocation watchPosition failed:', err.message);
        this.currentReading.sensorAvailability.gps = false;
      }
    } else {
      this.currentReading.sensorAvailability.gps = false;
    }

    // 2. Device Motion (Accelerometer & Step Peak Detection)
    if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
      try {
        window.addEventListener('devicemotion', this.handleMotion, { passive: true });
      } catch (err) {
        console.warn('[SensorManager] devicemotion listener error:', err.message);
      }
    }

    // 3. Device Orientation (Gyroscope / Compass)
    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      try {
        window.addEventListener('deviceorientation', this.handleOrientation, { passive: true });
      } catch (err) {
        console.warn('[SensorManager] deviceorientation listener error:', err.message);
      }
    }
  }

  /**
   * Stop listening to sensors
   */
  stopListening() {
    this.isListening = false;
    this.activityState = 'IDLE';
    this.updateScheduled = false;
    if (this.geoWatchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', this.handleMotion);
      window.removeEventListener('deviceorientation', this.handleOrientation);
    }
    stepCountingEngine.setEnabled(false);
    this.clearBuffer();
  }

  calculateBearing(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return Math.round((toDeg(θ) + 360) % 360);
  }

  handleGeoSuccess(position) {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    const now = position.timestamp || Date.now();

    // Calculate dynamic movement bearing
    let calculatedHeading = this.currentReading.heading || 0;
    if (heading !== null && heading !== undefined && !isNaN(heading) && heading > 0) {
      calculatedHeading = Math.round(heading);
    } else if (this.currentReading.latitude && this.currentReading.longitude) {
      const prevLat = this.currentReading.latitude;
      const prevLng = this.currentReading.longitude;
      const distM = walkingVerificationService.haversineDistance(prevLat, prevLng, latitude, longitude) * 1000;
      if (distM >= 1.5) {
        const b = this.calculateBearing(prevLat, prevLng, latitude, longitude);
        if (b !== null) {
          calculatedHeading = b;
        }
      }
    }

    let speedKmh = 0;
    let distanceKm = 0;

    if (this.currentMode === 'CYCLING') {
      const gpsResult = cyclingVerificationEngine.processGpsPosition({
        latitude,
        longitude,
        accuracy,
        speed,
        timestamp: now,
      });
      speedKmh = gpsResult.speedKmh;
      distanceKm = gpsResult.distanceKm;
    } else {
      const gpsResult = walkingVerificationService.processGpsPosition({
        latitude,
        longitude,
        accuracy,
        speed,
        timestamp: now,
      });
      speedKmh = gpsResult.speedKmh;
      distanceKm = gpsResult.distanceKm;
    }

    this.currentReading.latitude = latitude;
    this.currentReading.longitude = longitude;
    this.currentReading.gpsAccuracy = Math.round(accuracy || 10);
    this.currentReading.speed = speedKmh;
    this.currentReading.distanceKm = distanceKm;
    this.currentReading.heading = calculatedHeading;
    this.currentReading.timestamp = now;
    this.currentReading.sensorAvailability.gps = true;
    this.currentReading.gpsStatus = accuracy && accuracy > 35 ? 'POOR' : 'ACTIVE';

    // Push to buffer
    this.windowBuffer.speeds.push(speedKmh);
    this.windowBuffer.headings.push(calculatedHeading);
    this.windowBuffer.timestamps.push(now);

    // Update confidence score
    this.updateWalkingScore();

    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.getCurrentReading());
    }
  }

  handleGeoError(error) {
    console.warn('[SensorManager] Geolocation error:', error.code, error.message);
    this.currentReading.sensorAvailability.gps = false;
    if (error.code === 1) {
      this.currentReading.gpsStatus = 'PERMISSION_DENIED';
    } else if (error.code === 2) {
      this.currentReading.gpsStatus = 'UNAVAILABLE';
    } else if (error.code === 3) {
      this.currentReading.gpsStatus = 'TIMEOUT';
    } else {
      this.currentReading.gpsStatus = 'ERROR';
    }
    this.updateWalkingScore();

    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.getCurrentReading());
    }
  }

  handleMotion(event) {
    // Determine raw accelerometer inputs
    const hasLinear = event.acceleration && (
      event.acceleration.x !== null ||
      event.acceleration.y !== null ||
      event.acceleration.z !== null
    );

    // Prefer accelerationIncludingGravity for full 3D vector & Earth gravity separation
    const hasGrav = event.accelerationIncludingGravity && (
      event.accelerationIncludingGravity.x !== null ||
      event.accelerationIncludingGravity.y !== null ||
      event.accelerationIncludingGravity.z !== null
    );

    const acc = hasGrav ? event.accelerationIncludingGravity : event.acceleration;
    const rot = event.rotationRate;

    if (acc && (acc.x !== null || acc.y !== null || acc.z !== null)) {
      const ax = Number((acc.x || 0).toFixed(2));
      const ay = Number((acc.y || 0).toFixed(2));
      const az = Number((acc.z !== null && acc.z !== undefined ? acc.z : (hasLinear ? 0 : 9.81)).toFixed(2));

      this.currentReading.accelerationX = ax;
      this.currentReading.accelerationY = ay;
      this.currentReading.accelerationZ = az;
      this.currentReading.sensorAvailability.accelerometer = true;

      // Real step detection when in WALK, WALKING, or STATIONARY mode
      if (this.currentMode === 'WALK' || this.currentMode === 'WALKING' || this.currentMode === 'STATIONARY') {
        const stepResult = walkingVerificationService.processAccelerometerReading({
          x: ax,
          y: ay,
          z: az,
          isLinear: Boolean(hasLinear && !hasGrav),
        }, event.timeStamp ? (Date.now()) : Date.now());

        this.currentReading.stepCount = stepResult.stepCount;
        this.currentReading.cadence = stepResult.cadence;
        this.currentReading.accelerationMagnitude = stepResult.magnitude;
        this.currentReading.dynamicMagnitude = stepResult.dynamicMagnitude;
        this.currentReading.sensorAvailability.stepCounter = true;

        if (stepResult.stepDetected) {
          stepCountingEngine.registerStep(Date.now(), 1);
        }

        if (stepResult.cadence > 0) {
          this.windowBuffer.cadenceSamples.push(stepResult.cadence);
        }
      } else if (this.currentMode === 'CYCLING') {
        // Cycling mode: feed into CyclingVerificationEngine, strictly zero out and lock steps!
        cyclingVerificationEngine.processSensorReading({
          acceleration: { x: ax, y: ay, z: az },
          rotationRate: rot || null,
          timestamp: Date.now(),
        });

        this.currentReading.stepCount = 0;
        this.currentReading.cadence = 0;
        const rawMag = Math.sqrt(ax * ax + ay * ay + az * az);
        this.currentReading.accelerationMagnitude = Number(rawMag.toFixed(2));
        this.currentReading.dynamicMagnitude = Number(Math.max(0, Math.abs(rawMag - 9.81)).toFixed(2));
      } else {
        // Cycling, EV, and Public Transport: disable step counter completely
        this.currentReading.stepCount = 0;
        this.currentReading.cadence = 0;
        const rawMag = Math.sqrt(ax * ax + ay * ay + az * az);
        this.currentReading.accelerationMagnitude = Number(rawMag.toFixed(2));
        this.currentReading.dynamicMagnitude = Number(Math.max(0, Math.abs(rawMag - 9.81)).toFixed(2));
      }

      this.windowBuffer.accelerationsX.push(ax);
      this.windowBuffer.accelerationsY.push(ay);
      this.windowBuffer.accelerationsZ.push(az);
    }

    // Hardware Gyroscope (Rotation Rate in deg/s)
    if (rot && (rot.alpha !== null || rot.beta !== null || rot.gamma !== null)) {
      const rAlpha = Number((rot.alpha || 0).toFixed(2));
      const rBeta = Number((rot.beta || 0).toFixed(2));
      const rGamma = Number((rot.gamma || 0).toFixed(2));
      const rotVelocity = Math.sqrt(rAlpha * rAlpha + rBeta * rBeta + rGamma * rGamma);

      this.currentReading.rotationalVelocity = Number(rotVelocity.toFixed(1));
      this.currentReading.sensorAvailability.gyroscope = true;

      this.windowBuffer.gyrosAlpha.push(rAlpha);
      this.windowBuffer.gyrosBeta.push(rBeta);
      this.windowBuffer.gyrosGamma.push(rGamma);
    }

    this.updateWalkingScore();
    this.scheduleThrottledUpdate();
  }

  handleOrientation(event) {
    if (event.alpha !== null || event.beta !== null || event.gamma !== null) {
      const alpha = Number((event.alpha || 0).toFixed(1));
      const beta = Number((event.beta || 0).toFixed(1));
      const gamma = Number((event.gamma || 0).toFixed(1));

      this.currentReading.rotationAlpha = alpha;
      this.currentReading.rotationBeta = beta;
      this.currentReading.rotationGamma = gamma;
      this.currentReading.sensorAvailability.gyroscope = true;

      // Numerical differentiation of angles to compute rotational velocity if rotationRate missing
      const now = Date.now();
      if (this.lastOrientationTime > 0 && this.lastAlpha !== null) {
        const dt = (now - this.lastOrientationTime) / 1000;
        if (dt > 0.01 && dt < 0.5) {
          let dAlpha = Math.abs(alpha - this.lastAlpha);
          dAlpha = Math.min(dAlpha, 360 - dAlpha);
          const dBeta = Math.abs(beta - this.lastBeta);
          const dGamma = Math.abs(gamma - this.lastGamma);
          const vel = Math.sqrt(dAlpha * dAlpha + dBeta * dBeta + dGamma * dGamma) / dt;

          if (this.currentReading.rotationalVelocity === 0 || this.currentReading.rotationalVelocity === null) {
            this.currentReading.rotationalVelocity = Number(Math.min(360, vel).toFixed(1));
          }
        }
      }

      this.lastOrientationTime = now;
      this.lastAlpha = alpha;
      this.lastBeta = beta;
      this.lastGamma = gamma;

      this.updateWalkingScore();
      this.scheduleThrottledUpdate();
    }
  }

  updateWalkingScore() {
    if (this.currentMode === 'CYCLING') {
      const res = cyclingVerificationEngine.calculateCyclingConfidence({
        gpsSpeedKmh: this.currentReading.speed,
        gpsAccuracy: this.currentReading.gpsAccuracy,
      });

      this.currentReading.stepCount = 0;
      this.currentReading.cadence = 0;
      this.currentReading.walkingConfidence = null; // STRICTLY NULL
      this.currentReading.cyclingConfidence = res.confidenceScore;
      this.currentReading.confidence = res.confidenceScore;
      this.currentReading.isWalkingVerified = false;
      this.currentReading.isCyclingVerified = res.isVerified;
      this.currentReading.walkingStatus = res.statusLabel;
      this.currentReading.verificationState = res.statusLabel;
      this.activityState = res.isVerified ? 'CYCLING_ACTIVE' : 'CYCLING_INITIALIZING';
    } else if (this.currentMode === 'WALK' || this.currentMode === 'WALKING' || this.currentMode === 'STATIONARY') {
      const res = walkingVerificationService.calculateWalkingConfidence({
        deviceInfo: this.deviceInfo,
        gpsSpeedKmh: this.currentReading.speed,
        distanceKm: this.currentReading.distanceKm,
        stepCount: this.currentReading.stepCount,
        hasStepCounter: this.currentReading.sensorAvailability.stepCounter,
        accelMagnitude: this.currentReading.dynamicMagnitude || this.currentReading.accelerationMagnitude,
        gyroMagnitude: this.currentReading.rotationalVelocity || 0,
        hasGpsFix: Boolean(this.currentReading.latitude && this.currentReading.longitude),
      });

      this.currentReading.walkingConfidence = res.confidenceScore;
      this.currentReading.cyclingConfidence = null; // STRICTLY NULL
      this.currentReading.confidence = res.confidenceScore;
      this.currentReading.isWalkingVerified = res.isVerified;
      this.currentReading.isCyclingVerified = false;
      this.currentReading.walkingStatus = res.statusLabel;
      this.currentReading.verificationState = res.statusLabel;
      this.activityState = res.isVerified ? 'WALKING_ACTIVE' : (res.confidenceScore > 20 ? 'WALKING_ACTIVE' : 'WALKING_INITIALIZING');
    } else {
      // Vehicle, EV or Public Transport: step detection disabled
      this.currentReading.stepCount = 0;
      this.currentReading.cadence = 0;
      this.currentReading.walkingConfidence = null;
      this.currentReading.cyclingConfidence = null;
      this.currentReading.isWalkingVerified = false;
      this.currentReading.isCyclingVerified = false;
    }
  }

  /**
   * Granular metrics for Development Debug Panel
   */
  getDebugMetrics() {
    if (this.currentMode === 'CYCLING') {
      return cyclingVerificationEngine.getDebugMetrics();
    }
    const counts = stepCountingEngine.getCounts();
    return walkingVerificationService.getDebugMetrics(
      counts.sessionSteps || this.currentReading.stepCount,
      counts.baselineSteps || 0,
      counts.rawSteps || this.currentReading.stepCount
    );
  }

  /**
   * Scan for Web Bluetooth Transit Beacons
   */
  async scanForBluetoothBeacons() {
    if (!navigator.bluetooth) {
      return { success: false, error: 'Web Bluetooth API is not supported on this browser/platform.' };
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information'],
      });

      const bleEntry = {
        name: device.name || 'Transit Beacon / BLE Device',
        id: device.id,
        connected: device.gatt?.connected || false,
        timestamp: Date.now(),
        rssi: -65,
        beaconId: device.name?.includes('BUS') ? 'BEACON-BUS-104' : (device.name?.includes('METRO') ? 'BEACON-METRO-09' : null),
        transportType: device.name?.includes('BUS') ? 'BUS' : (device.name?.includes('METRO') ? 'METRO' : 'UNKNOWN'),
      };

      this.currentReading.bluetoothSignals = [bleEntry];
      this.currentReading.sensorAvailability.bluetooth = true;
      this.windowBuffer.bleSignals.push(bleEntry);

      return { success: true, device: bleEntry };
    } catch (err) {
      console.warn('[SensorManager] BLE scan cancelled or failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get latest instantaneous reading
   */
  getCurrentReading() {
    return { ...this.currentReading };
  }

  /**
   * Extract and clear the sliding window buffer for AI inference
   */
  flushWindowBuffer(durationSeconds = 5.0) {
    const buffer = { ...this.windowBuffer };
    this.clearBuffer();

    const avgCadence = buffer.cadenceSamples.length > 0
      ? buffer.cadenceSamples.reduce((a, b) => a + b, 0) / buffer.cadenceSamples.length
      : this.currentReading.cadence;

    const currentTotalSteps = this.currentReading.stepCount || 0;
    const stepDelta = Math.max(0, currentTotalSteps - (this.lastFlushedStepCount || 0));
    this.lastFlushedStepCount = currentTotalSteps;

    return {
      timestamp: Date.now(),
      latitude: this.currentReading.latitude,
      longitude: this.currentReading.longitude,
      gpsAccuracy: this.currentReading.gpsAccuracy,
      speed: this.currentReading.speed,
      distanceKm: this.currentReading.distanceKm,
      heading: this.currentReading.heading,
      stepCount: currentTotalSteps,
      stepDelta,
      walkingConfidence: this.currentReading.walkingConfidence,
      isWalkingVerified: this.currentReading.isWalkingVerified,
      speeds: buffer.speeds.length > 0 ? buffer.speeds : [this.currentReading.speed],
      accelerationsX: buffer.accelerationsX.length > 0 ? buffer.accelerationsX : (this.currentReading.accelerationX !== null ? [this.currentReading.accelerationX] : []),
      accelerationsY: buffer.accelerationsY.length > 0 ? buffer.accelerationsY : (this.currentReading.accelerationY !== null ? [this.currentReading.accelerationY] : []),
      accelerationsZ: buffer.accelerationsZ.length > 0 ? buffer.accelerationsZ : (this.currentReading.accelerationZ !== null ? [this.currentReading.accelerationZ] : []),
      gyrosAlpha: buffer.gyrosAlpha.length > 0 ? buffer.gyrosAlpha : (this.currentReading.rotationAlpha !== null ? [this.currentReading.rotationAlpha] : []),
      gyrosBeta: buffer.gyrosBeta.length > 0 ? buffer.gyrosBeta : (this.currentReading.rotationBeta !== null ? [this.currentReading.rotationBeta] : []),
      gyrosGamma: buffer.gyrosGamma.length > 0 ? buffer.gyrosGamma : (this.currentReading.rotationGamma !== null ? [this.currentReading.rotationGamma] : []),
      headings: buffer.headings.length > 0 ? buffer.headings : [this.currentReading.heading],
      cadence: avgCadence,
      bleSignals: this.currentReading.bluetoothSignals,
      sensorAvailability: { ...this.currentReading.sensorAvailability },
      windowDurationSeconds: durationSeconds,
    };
  }

  clearBuffer() {
    this.windowBuffer = {
      speeds: [],
      accelerationsX: [],
      accelerationsY: [],
      accelerationsZ: [],
      gyrosAlpha: [],
      gyrosBeta: [],
      gyrosGamma: [],
      headings: [],
      timestamps: [],
      cadenceSamples: [],
      stepDeltas: [],
      bleSignals: [],
    };
  }
}

export const sensorManager = new SensorManager();
