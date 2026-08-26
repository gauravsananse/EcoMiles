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
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  mode: {
    type: String,
    enum: ['WALKING', 'CYCLING', 'BUS', 'METRO', 'EV', 'CAR', 'SCOOTER', 'STATIONARY'],
    required: true,
  },
  distanceKm: {
    type: Number,
    required: true,
  },
  durationMinutes: {
    type: Number,
    required: true,
  },
  estimatedGreenCredits: {
    type: Number,
    default: 0,
  },
  estimatedFitnessPoints: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'RELEASED', 'HELD', 'REJECTED'],
    default: 'PENDING',
    index: true,
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
  releasedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const RewardTransaction = mongoose.model('RewardTransaction', rewardTransactionSchema);

module.exports = RewardTransaction;
