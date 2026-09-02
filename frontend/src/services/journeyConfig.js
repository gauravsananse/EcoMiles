/**
 * Centralized Journey Verification & Anti-Fraud Frontend Configuration
 * No hard-coded magic numbers.
 */

export const JOURNEY_CONFIG = {
  // Classification & Confidence Thresholds
  WALKING_CONFIDENCE_THRESHOLD: 0.75,
  VEHICLE_CONFIDENCE_THRESHOLD: 0.80,
  PUBLIC_TRANSPORT_CONFIDENCE_THRESHOLD: 0.80,
  CYCLING_CONFIDENCE_THRESHOLD: 0.75,

  // Speed Boundaries (in km/h)
  MAX_WALKING_SPEED_KMH: 7.5,
  MIN_CYCLING_SPEED_KMH: 7.0,
  MAX_CYCLING_SPEED_KMH: 32.0,
  MIN_VEHICLE_SPEED_KMH: 10.0,
  MAX_REASONABLE_SPEED_KMH: 160.0,

  // EV Bluetooth Configuration
  EV_BLE_SERVICE_UUID: '0000ffe0-0000-1000-8000-00805f9b34fb', // Standard 16-bit UUID / custom
  EV_BLE_CHARACTERISTIC_UUID: '0000ffe1-0000-1000-8000-00805f9b34fb',
  EV_VERIFICATION_INTERVAL_MS: 30000, // 30 seconds
  EV_VERIFICATION_GRACE_PERIOD_MS: 45000, // 45 seconds disconnect grace period

  // Public Transport Verification Radii (in meters)
  ROUTE_MATCH_RADIUS_METERS: 120,
  STOP_PROXIMITY_RADIUS_METERS: 150,

  // Step Counting Configuration
  CONSECUTIVE_STEPS_REQUIRED_FOR_WALKING: 4,
  STEP_DETECTION_THRESHOLD: 1.2,

  // Ingestion & Sync Intervals (in ms)
  SLIDING_WINDOW_INTERVAL_MS: 5000,
  SYNC_POLL_INTERVAL_MS: 2000,
  OFFLINE_QUEUE_MAX_SIZE: 500,
};

export default JOURNEY_CONFIG;
