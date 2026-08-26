const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
  segmentIndex: {
    type: Number,
    required: true,
  },
  mode: {
    type: String,
    enum: ['WALKING', 'CYCLING', 'BUS', 'METRO', 'EV', 'CAR', 'SCOOTER', 'STATIONARY', 'UNKNOWN'],
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
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
    enum: ['PENDING', 'VERIFIED', 'FLAGGED', 'REJECTED'],
    default: 'PENDING',
  },
  rewardStatus: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'RELEASED', 'HELD', 'REJECTED'],
    default: 'PENDING',
  },
  earnedGreenCredits: {
    type: Number,
    default: 0,
  },
  earnedFitnessPoints: {
    type: Number,
    default: 0,
  },
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
  currentMode: {
    type: String,
    enum: ['WALKING', 'CYCLING', 'BUS', 'METRO', 'EV', 'CAR', 'SCOOTER', 'STATIONARY', 'UNKNOWN'],
    default: 'STATIONARY',
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
  totalCo2AvoidedKg: {
    type: Number,
    default: 0,
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
