const mongoose = require('mongoose');

const verificationEventSchema = new mongoose.Schema({
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
  segmentId: {
    type: String,
    default: null,
  },
  type: {
    type: String,
    enum: [
      'JOURNEY_STARTED',
      'WALKING_DETECTED',
      'WALKING_VERIFIED',
      'CYCLING_DETECTED',
      'CYCLING_VERIFIED',
      'VEHICLE_DETECTED',
      'EV_VERIFICATION_REQUESTED',
      'EV_VERIFIED',
      'EV_VERIFICATION_WARNING',
      'EV_VERIFICATION_LOST',
      'EV_VERIFICATION_FAILED',
      'PETROL_VEHICLE_REJECTED',
      'DIESEL_VEHICLE_REJECTED',
      'CNG_VEHICLE_REJECTED',
      'PUBLIC_TRANSPORT_CANDIDATE',
      'PUBLIC_TRANSPORT_ROUTE_SELECTED',
      'PUBLIC_TRANSPORT_VERIFYING',
      'PUBLIC_TRANSPORT_VERIFIED',
      'PUBLIC_TRANSPORT_REJECTED',
      'STEP_COUNTING_PAUSED',
      'STEP_COUNTING_RESUMED',
      'GPS_ANOMALY_DETECTED',
      'FRAUD_FLAGGED',
      'JOURNEY_PAUSED',
      'JOURNEY_RESUMED',
      'SEGMENT_STARTED',
      'SEGMENT_COMPLETED',
      'JOURNEY_COMPLETED',
    ],
    required: true,
    index: true,
  },
  state: {
    type: String,
    default: 'READY',
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    speedKmh: { type: Number, default: 0 },
  },
  confidence: {
    type: Number,
    default: 1.0,
  },
  severity: {
    type: String,
    enum: ['INFO', 'WARNING', 'ERROR', 'SUCCESS'],
    default: 'INFO',
  },
  description: {
    type: String,
    required: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
});

verificationEventSchema.index({ journeyId: 1, timestamp: 1 });

const VerificationEvent = mongoose.model('VerificationEvent', verificationEventSchema);

module.exports = VerificationEvent;
