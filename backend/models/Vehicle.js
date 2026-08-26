const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  vehicleType: {
    type: String,
    default: 'EV',
    enum: ['EV', 'Electric Vehicle', '2W-EV', '3W-EV', '4W-EV'],
  },
  manufacturer: {
    type: String,
    trim: true,
    default: 'Unknown Manufacturer',
  },
  model: {
    type: String,
    trim: true,
    default: 'Unknown Model',
  },
  fuelType: {
    type: String,
    required: [true, 'Fuel type is required'],
    trim: true,
  },
  vehicleClass: {
    type: String,
    trim: true,
    default: 'Motor Car / Two Wheeler (EV)',
  },
  maskedOwnerName: {
    type: String,
    trim: true,
  },
  registrationDate: {
    type: String,
    trim: true,
  },
  verificationStatus: {
    type: String,
    enum: ['verified', 'pending', 'rejected'],
    default: 'verified',
  },
  verificationSource: {
    type: String,
    required: [true, 'Verification source is required'],
    trim: true,
  },
  verifiedAt: {
    type: Date,
    default: Date.now,
  },
  qrToken: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  qrCreatedAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

module.exports = Vehicle;
