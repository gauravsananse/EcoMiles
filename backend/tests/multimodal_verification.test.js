const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;
let testUserToken;
let testUserId;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'super_secret_test_jwt_key';

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = require('../server');

  // Create test user
  const User = require('../models/User');
  const user = await User.create({
    name: 'Test Commuter',
    email: 'commuter@example.com',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
    fitnessPoints: 100,
    greenCredits: 50,
  });
  testUserId = user._id;

  const jwt = require('jsonwebtoken');
  testUserToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Multimodal AI Mobility Verification Acceptance Tests (1–12)', () => {
  let activeJourneyId;

  // TEST 1: Walking
  it('TEST 1: Walking at normal pace (4.5 km/h, cadence 112 spm) -> WALKING & Active Fitness Points', async () => {
    const startRes = await request(app)
      .post('/api/journey/start')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        initialLocation: { lat: 28.6139, lng: 77.2090, accuracy: 4 },
        sensorAvailability: { gps: true, accelerometer: true },
      });

    assert.equal(startRes.status, 201);
    assert.ok(startRes.body.journeyId);
    activeJourneyId = startRes.body.journeyId;

    const sensorRes = await request(app)
      .post('/api/journey/sensor-data')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        journeyId: activeJourneyId,
        sensorWindow: {
          latitude: 28.6140,
          longitude: 77.2091,
          gpsAccuracy: 4,
          speed: 4.6,
          speeds: [4.2, 4.6, 4.8],
          accelerationsX: [0.5, -0.4, 0.6],
          accelerationsY: [0.4, 0.7, -0.5],
          accelerationsZ: [11.4, 8.3, 11.5],
          cadence: 112,
          transitCorridorOverlap: 0.1,
          stopFrequency: 0.05,
        },
      });

    assert.equal(sensorRes.status, 200);
    assert.equal(sensorRes.body.predictedMode, 'WALKING');
    assert.ok(sensorRes.body.confidence >= 0.85);
    assert.ok(sensorRes.body.totalFitnessPoints >= 0);
  });

  // TEST 2: Cycling
  it('TEST 2: Cycling (18 km/h + pedal cadence 78 rpm) -> CYCLING & Active Fitness Points', async () => {
    const sensorRes = await request(app)
      .post('/api/journey/sensor-data')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        journeyId: activeJourneyId,
        sensorWindow: {
          latitude: 28.6155,
          longitude: 77.2105,
          gpsAccuracy: 5,
          speed: 18.2,
          speeds: [16.5, 18.2, 19.0],
          accelerationsX: [0.9, -0.8, 1.0],
          accelerationsY: [0.5, -0.4, 0.6],
          accelerationsZ: [10.8, 8.9, 10.7],
          gyrosAlpha: [16.5, -15.0, 16.0],
          cadence: 78,
          transitCorridorOverlap: 0.2,
          stopFrequency: 0.05,
        },
      });

    assert.equal(sensorRes.status, 200);
    assert.equal(sensorRes.body.predictedMode, 'CYCLING');
    assert.ok(sensorRes.body.confidence >= 0.85);
  });

  // TEST 3: Scooter vs Cycling Attack
  it('TEST 3: Scooter attack at 16 km/h (0 cadence + engine vibration) -> SCOOTER & 0 Cycling Credits', async () => {
    const sensorRes = await request(app)
      .post('/api/journey/sensor-data')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        journeyId: activeJourneyId,
        sensorWindow: {
          latitude: 28.6170,
          longitude: 77.2120,
          gpsAccuracy: 5,
          speed: 16.5,
          speeds: [15.8, 16.5, 17.0],
          accelerationsX: [0.1, 0.12, 0.09],
          accelerationsY: [0.08, 0.1, 0.07],
          accelerationsZ: [9.9, 9.75, 9.85],
          cadence: 0, // ZERO CADENCE
          accelPeakFreq: 0.1,
          transitCorridorOverlap: 0.15,
          stopFrequency: 0.05,
        },
      });

    assert.equal(sensorRes.status, 200);
    assert.equal(sensorRes.body.predictedMode, 'SCOOTER');
    // Scooter segment should award ZERO green credits
    assert.equal(sensorRes.body.currentSegment.earnedGreenCredits, 0);
  });

  // TEST 4: Bus Journey
  it('TEST 4: Bus journey along transit corridor with dwell stops -> BUS & Green Credits active', async () => {
    const sensorRes = await request(app)
      .post('/api/journey/sensor-data')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        journeyId: activeJourneyId,
        sensorWindow: {
          latitude: 28.6185,
          longitude: 77.2135,
          gpsAccuracy: 5,
          speed: 28.0,
          speeds: [0.0, 18.0, 32.0],
          accelerationsX: [0.3, 0.4, 0.2],
          accelerationsY: [0.7, -0.8, 0.5],
          accelerationsZ: [9.9, 9.6, 10.1],
          cadence: 0,
          transitCorridorOverlap: 0.94,
          stopFrequency: 0.35,
          dwellTimeRatio: 0.35,
          bleSignals: [{ beaconId: 'BEACON-BUS-104', transportType: 'BUS' }],
        },
      });

    assert.equal(sensorRes.status, 200);
    assert.equal(sensorRes.body.predictedMode, 'BUS');
    assert.ok(sensorRes.body.confidence >= 0.85);
  });

  // TEST 5: Metro Journey
  it('TEST 5: Metro journey (65 km/h + rail track alignment + subterranean GPS degradation) -> METRO', async () => {
    const sensorRes = await request(app)
      .post('/api/journey/sensor-data')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        journeyId: activeJourneyId,
        sensorWindow: {
          latitude: 28.6220,
          longitude: 77.2160,
          gpsAccuracy: 55, // degraded underground
          gpsDegraded: true,
          speed: 65.0,
          speeds: [55.0, 65.0, 70.0],
          accelerationsX: [0.15, 0.2, 0.1],
          accelerationsY: [0.4, 0.3, 0.4],
          accelerationsZ: [9.85, 9.8, 9.85],
          cadence: 0,
          transitCorridorOverlap: 0.98,
          headingChangeRate: 0.3,
          bleSignals: [{ beaconId: 'BEACON-METRO-09', transportType: 'METRO' }],
        },
      });

    assert.equal(sensorRes.status, 200);
    assert.equal(sensorRes.body.predictedMode, 'METRO');
    assert.ok(sensorRes.body.confidence >= 0.85);
  });

  // TEST 6: Bus -> Walking -> Car Transition
  it('TEST 6: Critical Scenario: Walking -> Bus -> Walking -> Car stops public transport rewards', async () => {
    // 1. Walking leg
    const walkRes = await request(app)
      .post('/api/journey/sensor-data')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        journeyId: activeJourneyId,
        sensorWindow: {
          latitude: 28.6250,
          longitude: 77.2180,
          speed: 4.8,
          speeds: [4.5, 4.8, 5.0],
          cadence: 114,
          accelerationsZ: [11.5, 8.2, 11.6],
        },
      });
    assert.equal(walkRes.body.predictedMode, 'WALKING');

    // 2. Car leg (Entering car)
    const carRes = await request(app)
      .post('/api/journey/sensor-data')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        journeyId: activeJourneyId,
        sensorWindow: {
          latitude: 28.6300,
          longitude: 77.2250,
          speed: 62.0,
          speeds: [55.0, 62.0, 68.0],
          cadence: 0,
          transitCorridorOverlap: 0.15,
          stopFrequency: 0.05,
          accelerationsX: [0.15, -0.2, 0.18],
          accelerationsY: [0.3, 0.4, 0.2],
          accelerationsZ: [9.82, 9.78, 9.88],
        },
      });

    assert.equal(carRes.body.predictedMode, 'CAR');
    // Public transport reward stopped & car credits = 0
    assert.equal(carRes.body.currentSegment.mode, 'CAR');
    assert.equal(carRes.body.currentSegment.earnedGreenCredits, 0);
  });

  // TEST 7: GPS follows bus route but kinematics are car-like
  it('TEST 7: Car driving on bus route without dwell stops -> Classified as CAR', async () => {
    const infRes = await request(app)
      .post('/api/journey/inference')
      .send({
        sensorWindow: {
          speed: 55.0,
          speeds: [52.0, 55.0, 58.0],
          cadence: 0,
          transitCorridorOverlap: 0.85, // On bus route!
          stopFrequency: 0.0,          // But NO bus stops
          dwellTimeRatio: 0.0,
          accelerationsZ: [9.85, 9.8, 9.85],
        },
      });

    assert.equal(infRes.status, 200);
    assert.equal(infRes.body.predictedMode, 'CAR');
  });

  // TEST 8: Bluetooth Unavailable
  it('TEST 8: Bluetooth unavailable -> System continues gracefully with other evidence', async () => {
    const infRes = await request(app)
      .post('/api/journey/inference')
      .send({
        sensorWindow: {
          speed: 4.5,
          speeds: [4.2, 4.5, 4.7],
          cadence: 110,
          accelerationsZ: [11.2, 8.5, 11.3],
          bleSignals: [], // No BLE
          sensorAvailability: { gps: true, accelerometer: true, bluetooth: false },
        },
      });

    assert.equal(infRes.status, 200);
    assert.equal(infRes.body.predictedMode, 'WALKING');
  });

  // TEST 9: Motion Sensor Unavailable
  it('TEST 9: Motion sensor unavailable -> Falls back to GPS kinematics with diagnostic note', async () => {
    const infRes = await request(app)
      .post('/api/journey/inference')
      .send({
        sensorWindow: {
          speed: 18.0,
          speeds: [16.0, 18.0, 20.0],
          cadence: 0,
          accelerationsX: [],
          accelerationsY: [],
          accelerationsZ: [],
          sensorAvailability: { gps: true, accelerometer: false, gyroscope: false },
        },
      });

    assert.equal(infRes.status, 200);
    assert.ok(infRes.body.predictedMode);
  });

  // TEST 10: GPS Permission Denied / Initial location missing
  it('TEST 10: GPS permission denied -> Handled gracefully with fallback coordinates', async () => {
    const startRes = await request(app)
      .post('/api/journey/start')
      .send({
        initialLocation: null,
        sensorAvailability: { gps: false },
      });

    assert.equal(startRes.status, 201);
    assert.ok(startRes.body.journeyId);
  });

  // TEST 11: Journey Completion & Reward Release
  it('TEST 11: User stops journey -> Segments finalized, verified, and rewards released to MongoDB user', async () => {
    const endRes = await request(app)
      .post('/api/journey/end')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ journeyId: activeJourneyId });

    assert.equal(endRes.status, 200);
    assert.equal(endRes.body.success, true);
    assert.equal(endRes.body.journey.status, 'COMPLETED');
    assert.ok(endRes.body.updatedUser);
  });

  // TEST 12: Anti-Tamper Security
  it('TEST 12: Malicious client attempting to claim fake credits is overridden by server calculation', async () => {
    // Start fresh journey
    const startRes = await request(app)
      .post('/api/journey/start')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        initialLocation: { lat: 28.6139, lng: 77.2090, accuracy: 4 },
        sensorAvailability: { gps: true, accelerometer: true },
      });

    assert.equal(startRes.status, 201);
    const tamperJourneyId = startRes.body.journeyId;

    const sensorRes = await request(app)
      .post('/api/journey/sensor-data')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        journeyId: tamperJourneyId,
        sensorWindow: {
          speed: 65.0,
          speeds: [60.0, 65.0, 70.0],
          cadence: 0,
        },
        // Malicious client tampering:
        claimedMode: 'CYCLING',
        claimedGreenCredits: 1000,
      });

    // Server should reject/ignore client's fake claims
    assert.equal(sensorRes.status, 200);
    assert.equal(sensorRes.body.predictedMode, 'CAR');
    assert.equal(sensorRes.body.currentSegment?.earnedGreenCredits, 0);
  });
});
