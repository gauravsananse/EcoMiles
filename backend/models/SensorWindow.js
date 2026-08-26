const mongoose = require('mongoose');

const sensorWindowSchema = new mongoose.Schema({
  journeyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Journey',
    required: true,
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  windowDurationSeconds: {
    type: Number,
    default: 5.0,
  },
  gps: {
    lat: Number,
    lng: Number,
    accuracy: Number,
    speedKmh: Number,
    heading: Number,
  },
  extractedFeatures: {
    gpsSpeedAvg: Number,
    gpsSpeedVar: Number,
    gpsSpeedMax: Number,
    gpsAccelRms: Number,
    headingChangeRate: Number,
    stopFrequency: Number,
    accelMagnitudeMean: Number,
    accelMagnitudeVar: Number,
    accelRms: Number,
    accelJerkMean: Number,
    accelPeakFreq: Number,
    gyroMagnitudeMean: Number,
    gyroMagnitudeVar: Number,
    gyroRms: Number,
    cadence: Number,
    transitCorridorOverlap: Number,
    dwellTimeRatio: Number,
    bleBeaconProximity: Number,
  },
  predictedMode: {
    type: String,
    enum: ['WALKING', 'CYCLING', 'BUS', 'METRO', 'CAR', 'SCOOTER', 'STATIONARY'],
    required: true,
  },
  probabilities: {
    walking: Number,
    cycling: Number,
    bus: Number,
    metro: Number,
    car: Number,
    scooter: Number,
    stationary: Number,
  },
  confidence: {
    type: Number,
    required: true,
  },
  fraudScore: {
    type: Number,
    default: 0,
  },
  sensorAvailability: {
    gps: { type: Boolean, default: true },
    accelerometer: { type: Boolean, default: false },
    gyroscope: { type: Boolean, default: false },
    bluetooth: { type: Boolean, default: false },
    activityRecognition: { type: Boolean, default: false },
  },
  isReplayData: {
    type: Boolean,
    default: false,
  },
});

sensorWindowSchema.index({ journeyId: 1, timestamp: 1 });

const SensorWindow = mongoose.model('SensorWindow', sensorWindowSchema);

module.exports = SensorWindow;
