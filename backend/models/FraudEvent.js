const mongoose = require('mongoose');

const fraudEventSchema = new mongoose.Schema({
  journeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Journey',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  fraudType: {
    type: String,
    enum: [
      'SCOOTER_PRETENDING_CYCLING',
      'CAR_PRETENDING_BUS',
      'GPS_SPOOFING_IMPOSSIBLE_SPEED',
      'IMPOSSIBLE_ACCELERATION',
      'LOCATION_TELEPORTATION',
      'SENSOR_INCONSISTENCY',
      'SUSPICIOUS_REWARD_FARMING',
      'MOCK_LOCATION_DETECTED',
    ],
    required: true,
  },
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM',
  },
  fraudScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
  },
  evidence: {
    claimedMode: String,
    detectedMode: String,
    gpsSpeedKmh: Number,
    cadence: Number,
    accelJerk: Number,
    details: String,
  },
  actionTaken: {
    type: String,
    enum: ['REWARD_HELD', 'REWARD_REJECTED', 'MODE_OVERRIDDEN', 'FLAGGED_FOR_AUDIT'],
    default: 'REWARD_HELD',
  },
});

const FraudEvent = mongoose.model('FraudEvent', fraudEventSchema);

module.exports = FraudEvent;
