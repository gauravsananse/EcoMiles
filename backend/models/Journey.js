const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
  segmentIndex: {
    type: Number,
    required: true,
  },
  mode: {
    type: String,
    enum: ['WALK', 'WALKING', 'CYCLING', 'EV', 'PUBLIC_TRANSPORT', 'BUS', 'METRO', 'PETROL', 'DIESEL', 'CNG', 'CAR', 'SCOOTER', 'STATIONARY', 'UNKNOWN'],
    required: true,
  },
  selectedMode: {
    type: String,
    enum: ['WALK', 'WALKING', 'CYCLING', 'EV', 'PUBLIC_TRANSPORT', 'BUS', 'METRO', 'PETROL', 'DIESEL', 'CNG', 'CAR', 'SCOOTER', 'STATIONARY', 'UNKNOWN'],
    default: 'WALK',
  },
  status: {
    type: String,
    enum: ['NOT_STARTED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'VERIFIED', 'VERIFICATION_WARNING', 'VERIFICATION_FAILED'],
    default: 'ACTIVE',
  },
  selectedRouteId: {
    type: String,
    default: null,
  },
  selectedRouteName: {
    type: String,
    default: null,
  },
  selectedVehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    default: null,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
  },
  origin: {
    name: { type: String, default: 'Segment Start' },
    address: { type: String, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  destination: {
    name: { type: String, default: 'Segment End' },
    address: { type: String, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  startLocation: {
    latitude: Number,
    longitude: Number,
    address: String,
  },
  endLocation: {
    latitude: Number,
    longitude: Number,
    address: String,
  },
  distanceKm: {
    type: Number,
    default: 0,
  },
  durationMinutes: {
    type: Number,
    default: 0,
  },
  avgSpeedKmh: {
    type: Number,
    default: 0,
  },
  maxSpeedKmh: {
    type: Number,
    default: 0,
  },
  confidence: {
    type: Number,
    default: 0.9,
  },
  fraudScore: {
    type: Number,
    default: 0,
  },
  verificationStatus: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'FLAGGED', 'REJECTED', 'WARNING', 'FAILED'],
    default: 'PENDING',
  },
  rewardStatus: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'RELEASED', 'HELD', 'REJECTED'],
    default: 'PENDING',
  },
  greenCreditEligible: {
    type: Boolean,
    default: true,
  },
  fitnessEligible: {
    type: Boolean,
    default: true,
  },
  verifiedSteps: {
    type: Number,
    default: 0,
  },
  rawSteps: {
    type: Number,
    default: 0,
  },
  earnedGreenCredits: {
    type: Number,
    default: 0,
  },
  earnedFitnessPoints: {
    type: Number,
    default: 0,
  },
  earnedCombinedPoints: {
    type: Number,
    default: 0,
  },
  co2SavedKg: {
    type: Number,
    default: 0,
  },
  evidence: [String],
  sensorEvidence: [String],
  waypoints: [
    {
      lat: Number,
      lng: Number,
      speedKmh: Number,
      accuracy: Number,
      timestamp: Date,
    },
  ],
});

const journeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  anonymousSessionId: {
    type: String,
    index: true,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'DISCARDED'],
    default: 'ACTIVE',
    index: true,
  },
  // Planned travel mode chosen during Smart Route planning
  plannedMode: {
    type: String,
    enum: ['WALK', 'WALKING', 'CYCLING', 'EV', 'PUBLIC_TRANSPORT', 'BUS', 'METRO', 'CAR', 'SCOOTER', 'STATIONARY', 'UNKNOWN'],
    default: 'WALK',
  },
  // Origin and destination location metadata
  origin: {
    name: { type: String, default: 'Starting Point' },
    address: { type: String, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  destination: {
    name: { type: String, default: 'Destination Point' },
    address: { type: String, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  // Planned route geometry and step navigation
  plannedRoute: {
    polyline: { type: String, default: '' },
    distanceKm: { type: Number, default: 0 },
    durationMinutes: { type: Number, default: 0 },
    steps: [mongoose.Schema.Types.Mixed],
  },
  // Deviation and reroute tracking events
  routeDeviationEvents: [
    {
      timestamp: { type: Date, default: Date.now },
      deviationDistanceMeters: Number,
      rerouted: { type: Boolean, default: false },
    },
  ],
  // Centralized Journey State Machine
  journeyState: {
    type: String,
    enum: [
      'READY',
      'STARTING',
      'WALKING',
      'CYCLING',
      'VEHICLE_DETECTED',
      'EV_VERIFICATION_REQUIRED',
      'EV_VERIFIED',
      'PUBLIC_TRANSPORT_CANDIDATE',
      'PUBLIC_TRANSPORT_ROUTE_SELECTION',
      'PUBLIC_TRANSPORT_VERIFYING',
      'PUBLIC_TRANSPORT_VERIFIED',
      'VERIFICATION_WARNING',
      'VERIFICATION_FAILED',
      'SEGMENT_COMPLETED',
      'PAUSED',
      'COMPLETED',
    ],
    default: 'READY',
    index: true,
  },
  // Real-time AI classification mode & confidence
  currentMode: {
    type: String,
    enum: ['WALK', 'WALKING', 'CYCLING', 'BUS', 'METRO', 'EV', 'PUBLIC_TRANSPORT', 'PETROL', 'DIESEL', 'CNG', 'CAR', 'SCOOTER', 'STATIONARY', 'UNKNOWN'],
    default: 'STATIONARY',
  },
  verifiedMode: {
    type: String,
    enum: ['WALK', 'WALKING', 'CYCLING', 'BUS', 'METRO', 'EV', 'PUBLIC_TRANSPORT', 'PETROL', 'DIESEL', 'CNG', 'CAR', 'SCOOTER', 'STATIONARY', 'UNKNOWN'],
    default: 'STATIONARY',
  },
  verifiedVehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    default: null,
  },
  verifiedTransitRouteId: {
    type: String,
    default: null,
  },
  verifiedWalkingSteps: {
    type: Number,
    default: 0,
  },
  rawSteps: {
    type: Number,
    default: 0,
  },
  currentConfidence: {
    type: Number,
    default: 0.9,
  },
  overallFraudScore: {
    type: Number,
    default: 0,
  },
  isReplayData: {
    type: Boolean,
    default: false,
  },
  startTime: {
    type: Date,
    default: Date.now,
    index: true,
  },
  endTime: {
    type: Date,
  },
  totalDistanceKm: {
    type: Number,
    default: 0,
  },
  totalDurationMinutes: {
    type: Number,
    default: 0,
  },
  totalGreenCredits: {
    type: Number,
    default: 0,
  },
  totalFitnessPoints: {
    type: Number,
    default: 0,
  },
  totalCombinedPoints: {
    type: Number,
    default: 0,
  },
  totalCo2AvoidedKg: {
    type: Number,
    default: 0,
  },
  totalCO2Saved: {
    type: Number,
    default: 0,
  },
  overallVerificationStatus: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'PARTIALLY_VERIFIED', 'HELD', 'REJECTED'],
    default: 'PENDING',
  },
  activeSegmentIndex: {
    type: Number,
    default: 0,
  },
  validationOutcome: {
    type: String,
    default: 'PENDING',
  },
  validationBadge: {
    type: String,
    default: '',
  },
  // Dynamic multimodal journey segments
  segments: [segmentSchema],
  // Sensor Availability diagnostics
  sensorAvailability: {
    gps: { type: Boolean, default: true },
    accelerometer: { type: Boolean, default: false },
    gyroscope: { type: Boolean, default: false },
    bluetooth: { type: Boolean, default: false },
    activityRecognition: { type: Boolean, default: false },
    isMobile: { type: Boolean, default: true },
  },
  // Real-time telemetry snapshot for desktop-mobile synchronization
  latestTelemetry: {
    timestamp: { type: Date, default: Date.now },
    speed: { type: Number, default: 0 },
    distanceKm: { type: Number, default: 0 },
    stepCount: { type: Number, default: 0 },
    cadence: { type: Number, default: 0 },
    accelerationMagnitude: { type: Number, default: 0 },
    dynamicMagnitude: { type: Number, default: 0 },
    rotationalVelocity: { type: Number, default: 0 },
    rotationAlpha: { type: Number, default: null },
    rotationBeta: { type: Number, default: null },
    rotationGamma: { type: Number, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    gpsAccuracy: { type: Number, default: null },
    heading: { type: Number, default: 0 },
    walkingConfidence: { type: Number, default: 0 },
    isWalkingVerified: { type: Boolean, default: false },
    sensorAvailability: {
      gps: Boolean,
      accelerometer: Boolean,
      gyroscope: Boolean,
      stepCounter: Boolean,
      bluetooth: Boolean,
      isMobile: Boolean,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

journeySchema.index({ userId: 1, createdAt: -1 });

const Journey = mongoose.model('Journey', journeySchema);

module.exports = Journey;
