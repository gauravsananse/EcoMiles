/**
 * Centralized Journey Verification & Anti-Fraud Configuration
 * No magic numbers scattered across the codebase.
 */

module.exports = {
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
  MAX_REASONABLE_SPEED_KMH: 160.0, // Anomaly trigger

  // Acceleration & Sensor Boundaries
  MAX_REASONABLE_ACCELERATION_MS2: 14.0, // GPS acceleration anomaly trigger
  STEP_DETECTION_MIN_ACCEL_RMS: 0.35,
  MIN_WALKING_CADENCE_SPM: 40,
  MAX_WALKING_CADENCE_SPM: 220,

  // EV Bluetooth Configuration
  EV_BLE_SERVICE_UUID: '0000ffe0-0000-1000-8000-00805f9b34fb', // Standard Green Credit BLE GATT service
  EV_BLE_CHARACTERISTIC_UUID: '0000ffe1-0000-1000-8000-00805f9b34fb', // Identity characteristic
  EV_VERIFICATION_INTERVAL_MS: 30000, // Check every 30 seconds
  EV_VERIFICATION_GRACE_PERIOD_MS: 45000, // 45 seconds disconnect grace period before failing

  // Public Transport Verification
  ROUTE_MATCH_RADIUS_METERS: 120, // Proximity to polyline geometry
  STOP_PROXIMITY_RADIUS_METERS: 150, // Proximity to transit stop
  BUS_MIN_DWELL_SECONDS: 8, // Minimum dwell time at bus stop to confirm stop event
  BUS_MAX_CONSECUTIVE_SPEED_KMH: 85, // City buses rarely exceed 85 km/h in urban corridors

  // GPS Quality & Kinematics
  GPS_ACCURACY_THRESHOLD_METERS: 40, // Ignore or downweight readings worse than 40m
  GPS_TELEPORTATION_MAX_SPEED_KMH: 200, // Teleportation trigger speed between consecutive fixes
  GPS_TELEPORTATION_MIN_DISTANCE_M: 400,

  // Reward Multipliers (per verified km)
  REWARD_RATES: {
    WALKING: { greenCreditsPerKm: 10, fitnessPointsPerKm: 15, co2PerKm: 0.192 },
    CYCLING: { greenCreditsPerKm: 12, fitnessPointsPerKm: 10, co2PerKm: 0.192 },
    EV: { greenCreditsPerKm: 5, fitnessPointsPerKm: 0, co2PerKm: 0.120 },
    BUS: { greenCreditsPerKm: 6, fitnessPointsPerKm: 0, co2PerKm: 0.142 },
    METRO: { greenCreditsPerKm: 8, fitnessPointsPerKm: 0, co2PerKm: 0.172 },
    PETROL: { greenCreditsPerKm: 0, fitnessPointsPerKm: 0, co2PerKm: 0.0 },
    DIESEL: { greenCreditsPerKm: 0, fitnessPointsPerKm: 0, co2PerKm: 0.0 },
    CNG: { greenCreditsPerKm: 0, fitnessPointsPerKm: 0, co2PerKm: 0.0 },
    OTHER: { greenCreditsPerKm: 0, fitnessPointsPerKm: 0, co2PerKm: 0.0 },
  },
};
