const mongoose = require('mongoose');

const metroTicketSchema = new mongoose.Schema({
  ticketHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  ticketNumber: {
    type: String,
    required: true,
    index: true,
  },
  provider: {
    type: String,
    enum: ['OFFICIAL_METRO_API', 'DEV_MOCK_PROVIDER'],
    default: 'DEV_MOCK_PROVIDER',
  },
  isOperatorAuthenticated: {
    type: Boolean,
    default: false,
  },
  operator: {
    type: String,
    default: 'MahaMetro Pune',
  },
  originStationId: {
    type: String,
    required: true,
  },
  originStationName: {
    type: String,
    required: true,
  },
  destinationStationId: {
    type: String,
    required: true,
  },
  destinationStationName: {
    type: String,
    required: true,
  },
  fare: {
    type: Number,
    default: 20,
  },
  issuedAt: {
    type: Date,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['VALID', 'CLAIMED', 'USED', 'EXPIRED', 'INVALID'],
    default: 'VALID',
    index: true,
  },
  claimedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  claimedAt: {
    type: Date,
    default: null,
  },
  journeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Journey',
    default: null,
  },
  verificationMethod: {
    type: String,
    enum: ['CAMERA_SCAN', 'SCREENSHOT_UPLOAD', 'MANUAL_ENTRY'],
    default: 'CAMERA_SCAN',
  },
  verificationMetadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

metroTicketSchema.index({ ticketHash: 1, claimedByUserId: 1 });

const MetroTicket = mongoose.model('MetroTicket', metroTicketSchema);

module.exports = MetroTicket;
