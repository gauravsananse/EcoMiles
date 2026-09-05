const mongoose = require('mongoose');

const metroStationSchema = new mongoose.Schema({
  stationId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  localName: {
    type: String,
    default: '',
  },
  city: {
    type: String,
    default: 'Pune',
    index: true,
  },
  line: {
    type: String,
    enum: ['Purple Line', 'Aqua Line', 'Green Line', 'Line 1', 'Line 2', 'Line 3'],
    default: 'Purple Line',
  },
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
  geofenceRadiusMeters: {
    type: Number,
    default: 250, // Configurable per station (150m - 350m)
  },
  isUnderground: {
    type: Boolean,
    default: false,
  },
  isInterchange: {
    type: Boolean,
    default: false,
  },
  fareZone: {
    type: Number,
    default: 1,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'PLANNED', 'MAINTENANCE'],
    default: 'ACTIVE',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

metroStationSchema.index({ city: 1, status: 1 });

const MetroStation = mongoose.model('MetroStation', metroStationSchema);

module.exports = MetroStation;
