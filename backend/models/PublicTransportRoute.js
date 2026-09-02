const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  stopId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  latitude: {
    type: Number,
    required: true,
  },
  longitude: {
    type: Number,
    required: true,
  },
  sequence: {
    type: Number,
    default: 0,
  },
});

const publicTransportRouteSchema = new mongoose.Schema({
  routeId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  mode: {
    type: String,
    enum: ['BUS', 'METRO', 'TRAIN'],
    default: 'BUS',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  shortName: {
    type: String,
    default: '',
  },
  operator: {
    type: String,
    default: 'City Public Transit',
  },
  direction: {
    type: String,
    default: 'Outbound',
  },
  // GeoJSON LineString coordinates or array of [lat, lng]
  geometry: {
    type: [[Number]], // Array of [lat, lng] coordinates along the route
    default: [],
  },
  stops: [stopSchema],
  isActive: {
    type: Boolean,
    default: true,
  },
  isSampleData: {
    type: Boolean,
    default: true, // Prototype / Sample Transit Data flag
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

publicTransportRouteSchema.index({ 'stops.latitude': 1, 'stops.longitude': 1 });

const PublicTransportRoute = mongoose.model('PublicTransportRoute', publicTransportRouteSchema);

module.exports = PublicTransportRoute;
