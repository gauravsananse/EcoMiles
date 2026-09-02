const mongoose = require('mongoose');

const transitStopSchema = new mongoose.Schema({
  stopId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    default: 'Pune',
  },
  operator: {
    type: String,
    default: 'PMPML City Transport',
  },
  latitude: {
    type: Number,
    required: true,
    index: true,
  },
  longitude: {
    type: Number,
    required: true,
    index: true,
  },
  routes: [
    {
      routeId: String,
      routeName: String,
      mode: { type: String, default: 'BUS' },
      direction: String,
      intervalMinutes: { type: Number, default: 10 },
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
  isSampleData: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

transitStopSchema.index({ latitude: 1, longitude: 1 });

const TransitStop = mongoose.model('TransitStop', transitStopSchema);

module.exports = TransitStop;
