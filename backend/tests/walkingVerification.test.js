const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fraudDetectionService = require('../services/fraudDetectionService');
const sensorFusionService = require('../services/sensorFusionService');

describe('Walking Verification & Anti-Fraud Suite', () => {
  let mongoServer;

  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('TEST 1: Valid mobile walking profile with cadence and movement passes verification', async () => {
    const sensorWindow = {
      latitude: 28.6139,
      longitude: 77.2090,
      gpsAccuracy: 4.0,
      speed: 4.8,
      speeds: [4.6, 4.8, 5.0],
      stepCount: 450,
      accelerationsX: [0.3, 0.4, -0.2],
      accelerationsY: [0.8, 1.2, 0.9],
      accelerationsZ: [9.8, 11.2, 8.9],
      gyrosAlpha: [12.0, 15.0],
      gyrosBeta: [4.0, 6.0],
      gyrosGamma: [2.0, 3.0],
      cadence: 110,
      sensorAvailability: {
        gps: true,
        accelerometer: true,
        gyroscope: true,
        stepCounter: true,
        isMobile: true,
        deviceType: 'MOBILE',
      },
    };

    const classification = sensorFusionService.classifyWindow(sensorWindow);
    assert.strictEqual(classification.predictedMode, 'WALKING');

    const fraudResult = await fraudDetectionService.evaluateWindow(sensorWindow, classification);
    assert.strictEqual(fraudResult.riskLevel, 'LOW');
    assert.ok(fraudResult.fraudScore < 30);
  });

  it('TEST 2: Desktop claim attempting walking verification triggers fraud score and alert', async () => {
    const desktopWindow = {
      latitude: 28.6139,
      longitude: 77.2090,
      speed: 4.5,
      speeds: [4.5],
      stepCount: 0,
      sensorAvailability: {
        gps: true,
        accelerometer: false,
        gyroscope: false,
        stepCounter: false,
        isMobile: false,
        deviceType: 'DESKTOP',
      },
    };

    const classification = sensorFusionService.classifyWindow(desktopWindow);
    const fraudResult = await fraudDetectionService.evaluateWindow(desktopWindow, classification);

    assert.ok(fraudResult.fraudScore >= 60, 'Desktop walking claim should have high fraud score');
    assert.ok(fraudResult.fraudEvents.some((e) => e.fraudType === 'DESKTOP_UNVERIFIED_WALKING_CLAIM'));
  });

  it('TEST 3: High GPS speed (>8.5 km/h) with zero/few steps triggers HIGH_SPEED_ZERO_STEPS_MISMATCH', async () => {
    const vehicleWindow = {
      latitude: 28.6139,
      longitude: 77.2090,
      speed: 16.0,
      speeds: [16.0, 18.0],
      stepCount: 5,
      accelerationsX: [0.1],
      accelerationsY: [0.1],
      accelerationsZ: [9.8],
      sensorAvailability: {
        gps: true,
        accelerometer: true,
        gyroscope: true,
        stepCounter: true,
        isMobile: true,
        deviceType: 'MOBILE',
      },
    };

    const classification = {
      predictedMode: 'WALKING',
      extractedFeatures: {
        gpsSpeedAvg: 16.0,
        gpsSpeedMax: 18.0,
      },
    };

    const mockJourney = { totalDurationMinutes: 1.0, totalDistanceKm: 0.5 };
    const fraudResult = await fraudDetectionService.evaluateWindow(vehicleWindow, classification, mockJourney);

    assert.ok(fraudResult.fraudEvents.some((e) => e.fraudType === 'HIGH_SPEED_ZERO_STEPS_MISMATCH'));
  });

  it('TEST 4: Stationary phone shaking (hundreds of steps with near-zero GPS displacement) triggers STATIONARY_PHONE_SHAKING', async () => {
    const shakingWindow = {
      latitude: 28.6139,
      longitude: 77.2090,
      speed: 0.1,
      stepCount: 400,
      accelerationsX: [1.2],
      accelerationsY: [2.5],
      accelerationsZ: [10.5],
      sensorAvailability: {
        gps: true,
        accelerometer: true,
        gyroscope: true,
        stepCounter: true,
        isMobile: true,
      },
    };

    const classification = {
      predictedMode: 'WALKING',
      extractedFeatures: {
        gpsSpeedAvg: 0.1,
        gpsSpeedMax: 0.2,
      },
    };

    const mockStationaryJourney = { totalDurationMinutes: 2.0, totalDistanceKm: 0.005 };
    const fraudResult = await fraudDetectionService.evaluateWindow(shakingWindow, classification, mockStationaryJourney);

    assert.ok(fraudResult.fraudEvents.some((e) => e.fraudType === 'STATIONARY_PHONE_SHAKING'));
  });
});
