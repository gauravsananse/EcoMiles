const mongoose = require('mongoose');

const rewardTransactionSchema = new mongoose.Schema({
  journeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Journey',
    required: true,
    index: true,
  },
  segmentId: {
    type: String,
    default: 'seg_0',
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  transportMode: {
    type: String,
    enum: ['WALK', 'WALKING', 'CYCLING', 'BUS', 'METRO', 'EV', 'PUBLIC_TRANSPORT', 'CAR', 'SCOOTER', 'STATIONARY'],
    required: true,
  },
  mode: {
    type: String,
    enum: ['WALK', 'WALKING', 'CYCLING', 'BUS', 'METRO', 'EV', 'PUBLIC_TRANSPORT', 'CAR', 'SCOOTER', 'STATIONARY'],
  },
  verifiedDistance: {
    type: Number,
    default: 0,
  },
  distanceKm: {
    type: Number,
    default: 0,
  },
  verifiedSteps: {
    type: Number,
    default: 0,
  },
  fitnessPoints: {
    type: Number,
    default: 0,
  },
  greenCredits: {
    type: Number,
    default: 0,
  },
  estimatedGreenCredits: {
    type: Number,
    default: 0,
  },
  estimatedFitnessPoints: {
    type: Number,
    default: 0,
  },
  verificationStatus: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'RELEASED', 'HELD', 'REJECTED', 'UNVERIFIED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'RELEASED', 'HELD', 'REJECTED', 'UNVERIFIED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  },
  durationMinutes: {
    type: Number,
    default: 0,
  },
  co2SavedKg: {
    type: Number,
    default: 0,
  },
  confidenceScore: {
    type: Number,
    default: 0.9,
  },
  fraudScore: {
    type: Number,
    default: 0,
  },
  verificationNotes: {
    type: String,
    default: 'Awaiting sensor window verification',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  releasedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Pre-save hook to ensure both standard and legacy alias fields stay in perfect sync
rewardTransactionSchema.pre('save', function (next) {
  if (!this.transportMode && this.mode) {
    this.transportMode = this.mode;
  }
  if (!this.mode && this.transportMode) {
    this.mode = this.transportMode;
  }

  if (this.verifiedDistance === undefined && this.distanceKm !== undefined) {
    this.verifiedDistance = this.distanceKm;
  }
  if (this.distanceKm === undefined && this.verifiedDistance !== undefined) {
    this.distanceKm = this.verifiedDistance;
  }

  if (this.fitnessPoints !== undefined) {
    this.estimatedFitnessPoints = this.fitnessPoints;
  } else if (this.estimatedFitnessPoints !== undefined) {
    this.fitnessPoints = this.estimatedFitnessPoints;
  }

  if (this.greenCredits !== undefined) {
    this.estimatedGreenCredits = this.greenCredits;
  } else if (this.estimatedGreenCredits !== undefined) {
    this.greenCredits = this.estimatedGreenCredits;
  }

  if (!this.verificationStatus && this.status) {
    this.verificationStatus = this.status;
  }
  if (!this.status && this.verificationStatus) {
    this.status = this.verificationStatus;
  }

  if (!this.timestamp && this.createdAt) {
    this.timestamp = this.createdAt;
  }

  next();
});

const RewardTransaction = mongoose.model('RewardTransaction', rewardTransactionSchema);

module.exports = RewardTransaction;
