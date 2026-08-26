const mongoose = require('mongoose');

const transitBeaconSchema = new mongoose.Schema({
  beaconId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  transportType: {
    type: String,
    enum: ['BUS', 'METRO', 'TRAIN', 'EV_CHARGER', 'TRANSIT_STATION'],
    required: true,
  },
  routeId: {
    type: String,
    default: 'CORRIDOR-1',
  },
  routeName: {
    type: String,
    default: 'City Smart Transit Line',
  },
  stationId: {
    type: String,
    default: 'STN-01',
  },
  stationName: {
    type: String,
    default: 'Central Transit Hub',
  },
  operator: {
    type: String,
    default: 'Metropolitan Urban Transport Authority (MUTA)',
  },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'MAINTENANCE', 'DECOMMISSIONED'],
    default: 'ACTIVE',
  },
  txPower: {
    type: Number,
    default: -59, // dBm at 1m
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const TransitBeacon = mongoose.model('TransitBeacon', transitBeaconSchema);

module.exports = TransitBeacon;
