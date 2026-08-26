/**
 * Real Browser Sensor Manager
 * Handles real browser APIs (Geolocation, DeviceMotionEvent, DeviceOrientationEvent, Web Bluetooth)
 * with robust error handling, iOS permission flows, and normalized sensor windows.
 */

class SensorManager {
  constructor() {
    this.isListening = false;
    this.geoWatchId = null;
    
    // Latest instantaneous readings
    this.currentReading = {
      timestamp: Date.now(),
      latitude: null,
      longitude: null,
      gpsAccuracy: null,
      speed: 0,
      heading: 0,
      accelerationX: 0,
      accelerationY: 0,
      accelerationZ: 9.81,
      rotationAlpha: 0,
      rotationBeta: 0,
      rotationGamma: 0,
      cadence: 0,
      activityRecognition: 'unavailable',
      bluetoothSignals: [],
      sensorAvailability: {
        gps: false,
        accelerometer: false,
        gyroscope: false,
        bluetooth: false,
        activityRecognition: false,
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
      bleSignals: [],
    };

    // Check static browser support
    this.checkInitialSupport();

    // Event listeners bound
    this.handleMotion = this.handleMotion.bind(this);
    this.handleOrientation = this.handleOrientation.bind(this);
    this.handleGeoSuccess = this.handleGeoSuccess.bind(this);
    this.handleGeoError = this.handleGeoError.bind(this);
  }

  checkInitialSupport() {
    if (typeof window !== 'undefined') {
      this.currentReading.sensorAvailability.gps = 'geolocation' in navigator;
      this.currentReading.sensorAvailability.accelerometer = 'DeviceMotionEvent' in window;
      this.currentReading.sensorAvailability.gyroscope = 'DeviceOrientationEvent' in window;
      this.currentReading.sensorAvailability.bluetooth = 'bluetooth' in navigator;
    }
  }

  /**
   * Request iOS 13+ permission for Motion and Orientation
   */
  async requestMotionPermissions() {
    let motionGranted = false;
    let orientationGranted = false;

    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        motionGranted = response === 'granted';
      } catch (err) {
        console.warn('[SensorManager] DeviceMotionEvent permission error:', err.message);
      }
    } else {
      motionGranted = 'DeviceMotionEvent' in window;
    }

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        orientationGranted = response === 'granted';
      } catch (err) {
        console.warn('[SensorManager] DeviceOrientationEvent permission error:', err.message);
      }
    } else {
      orientationGranted = 'DeviceOrientationEvent' in window;
    }

    this.currentReading.sensorAvailability.accelerometer = motionGranted;
    this.currentReading.sensorAvailability.gyroscope = orientationGranted;

    return { motionGranted, orientationGranted };
  }

  /**
   * Start listening to real device sensors
   */
  async startListening() {
    if (this.isListening) return;
    this.isListening = true;
    this.clearBuffer();

    // Request permissions for mobile devices
    await this.requestMotionPermissions();

    // 1. Geolocation watchPosition
    if ('geolocation' in navigator) {
      try {
        this.geoWatchId = navigator.geolocation.watchPosition(
          this.handleGeoSuccess,
          this.handleGeoError,
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000,
          }
        );
        this.currentReading.sensorAvailability.gps = true;
      } catch (err) {
        console.warn('[SensorManager] Geolocation watchPosition failed:', err.message);
        this.currentReading.sensorAvailability.gps = false;
      }
    }

    // 2. Device Motion
    if (window.DeviceMotionEvent) {
      try {
        window.addEventListener('devicemotion', this.handleMotion, false);
      } catch (err) {
        console.warn('[SensorManager] devicemotion listener error:', err.message);
      }
    }

    // 3. Device Orientation
    if (window.DeviceOrientationEvent) {
      try {
        window.addEventListener('deviceorientation', this.handleOrientation, false);
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
    if (this.geoWatchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', this.handleMotion, false);
      window.removeEventListener('deviceorientation', this.handleOrientation, false);
    }
    this.clearBuffer();
  }

  handleGeoSuccess(position) {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    const speedKmh = speed !== null && speed >= 0 ? speed * 3.6 : 0;

    this.currentReading.latitude = latitude;
    this.currentReading.longitude = longitude;
    this.currentReading.gpsAccuracy = accuracy;
    this.currentReading.speed = Number(speedKmh.toFixed(1));
    this.currentReading.heading = heading || 0;
    this.currentReading.timestamp = position.timestamp || Date.now();
    this.currentReading.sensorAvailability.gps = true;

    // Push to buffer
    this.windowBuffer.speeds.push(speedKmh);
    this.windowBuffer.headings.push(heading || 0);
    this.windowBuffer.timestamps.push(Date.now());
  }

  handleGeoError(error) {
    console.warn('[SensorManager] Geolocation error code:', error.code, error.message);
    if (error.code === 1) {
      // Permission denied
      this.currentReading.sensorAvailability.gps = false;
    }
  }

  handleMotion(event) {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    const rot = event.rotationRate;

    if (acc) {
      this.currentReading.accelerationX = Number((acc.x || 0).toFixed(2));
      this.currentReading.accelerationY = Number((acc.y || 0).toFixed(2));
      this.currentReading.accelerationZ = Number((acc.z !== null ? acc.z : 9.81).toFixed(2));
      this.currentReading.sensorAvailability.accelerometer = true;

      this.windowBuffer.accelerationsX.push(this.currentReading.accelerationX);
      this.windowBuffer.accelerationsY.push(this.currentReading.accelerationY);
      this.windowBuffer.accelerationsZ.push(this.currentReading.accelerationZ);

      // Estimate dynamic cadence from vertical acceleration peak count
      const mag = Math.sqrt(
        Math.pow(this.currentReading.accelerationX, 2) +
        Math.pow(this.currentReading.accelerationY, 2) +
        Math.pow(this.currentReading.accelerationZ - 9.81, 2)
      );
      if (mag > 1.8) {
        this.currentReading.cadence = Math.min(130, Math.max(90, Math.round(110 + (mag - 2) * 15)));
        this.windowBuffer.cadenceSamples.push(this.currentReading.cadence);
      }
    }

    if (rot) {
      this.currentReading.rotationAlpha = Number((rot.alpha || 0).toFixed(2));
      this.currentReading.rotationBeta = Number((rot.beta || 0).toFixed(2));
      this.currentReading.rotationGamma = Number((rot.gamma || 0).toFixed(2));
      this.currentReading.sensorAvailability.gyroscope = true;

      this.windowBuffer.gyrosAlpha.push(this.currentReading.rotationAlpha);
      this.windowBuffer.gyrosBeta.push(this.currentReading.rotationBeta);
      this.windowBuffer.gyrosGamma.push(this.currentReading.rotationGamma);
    }
  }

  handleOrientation(event) {
    if (event.alpha !== null) {
      this.currentReading.rotationAlpha = Number((event.alpha || 0).toFixed(1));
      this.currentReading.rotationBeta = Number((event.beta || 0).toFixed(1));
      this.currentReading.rotationGamma = Number((event.gamma || 0).toFixed(1));
      this.currentReading.sensorAvailability.gyroscope = true;
    }
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
        rssi: -65, // typical proximate RSSI
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

    return {
      timestamp: Date.now(),
      latitude: this.currentReading.latitude,
      longitude: this.currentReading.longitude,
      gpsAccuracy: this.currentReading.gpsAccuracy,
      speed: this.currentReading.speed,
      heading: this.currentReading.heading,
      speeds: buffer.speeds.length > 0 ? buffer.speeds : [this.currentReading.speed],
      accelerationsX: buffer.accelerationsX.length > 0 ? buffer.accelerationsX : [this.currentReading.accelerationX],
      accelerationsY: buffer.accelerationsY.length > 0 ? buffer.accelerationsY : [this.currentReading.accelerationY],
      accelerationsZ: buffer.accelerationsZ.length > 0 ? buffer.accelerationsZ : [this.currentReading.accelerationZ],
      gyrosAlpha: buffer.gyrosAlpha.length > 0 ? buffer.gyrosAlpha : [this.currentReading.rotationAlpha],
      gyrosBeta: buffer.gyrosBeta.length > 0 ? buffer.gyrosBeta : [this.currentReading.rotationBeta],
      gyrosGamma: buffer.gyrosGamma.length > 0 ? buffer.gyrosGamma : [this.currentReading.rotationGamma],
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
      bleSignals: [],
    };
  }
}

export const sensorManager = new SensorManager();
