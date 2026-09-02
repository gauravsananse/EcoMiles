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
  },
  make: {
    type: String,
    trim: true,
    default: '',
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
    uppercase: true,
    trim: true,
    default: 'ELECTRIC',
  },
  bluetoothIdentifier: {
    type: String,
    trim: true,
    default: null, // e.g. GC-EV-8F31A2
  },
  isVerified: {
    type: Boolean,
    default: true,
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
