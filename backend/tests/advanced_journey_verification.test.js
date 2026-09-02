const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;
let testUserToken;
let testUserId;
let petrolUserToken;
let petrolUserId;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'super_secret_test_jwt_key';

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = require('../server');

  const User = require('../models/User');
  const Vehicle = require('../models/Vehicle');
  const jwt = require('jsonwebtoken');

  // 1. EV User
  const evUser = await User.create({
    name: 'EV Commuter',
    email: 'evcommuter@example.com',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
    fitnessPoints: 50,
    greenCredits: 20,
  });
  testUserId = evUser._id;
  testUserToken = jwt.sign({ id: evUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  await Vehicle.create({
    userId: evUser._id,
    registrationNumber: 'MH12EV9999',
    vehicleType: 'EV',
    fuelType: 'ELECTRIC',
    make: 'Tata',
    model: 'Nexon EV',
    bluetoothIdentifier: 'GC-EV-8F31A2',
    isVerified: true,
    verificationSource: 'Vahan Gateway',
    qrToken: 'test_qr_token_ev_123',
  });

  // 2. Petrol User
  const petrolUser = await User.create({
    name: 'Petrol Driver',
    email: 'petrol@example.com',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
    fitnessPoints: 10,
    greenCredits: 5,
  });
  petrolUserId = petrolUser._id;
  petrolUserToken = jwt.sign({ id: petrolUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  await Vehicle.create({
    userId: petrolUser._id,
    registrationNumber: 'MH12AB1234',
    vehicleType: '4W',
    fuelType: 'PETROL',
    make: 'Hyundai',
    model: 'i20 Petrol',
    isVerified: true,
    verificationSource: 'Vahan Gateway',
    qrToken: 'test_qr_token_petrol_456',
  });
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Advanced Journey Verification System End-to-End Test Scenarios (Section 48)', () => {
  let activeJourneyId;

  // Scenario 1 — Walking
  it('Scenario 1 — Walking: Start journey -> Walking detected -> Step counter active -> Fitness points increase', async () => {
    const startRes = await request(app)
      .post('/api/journey/start')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        plannedMode: 'WALKING',
        initialLocation: { lat: 18.5284, lng: 73.8744, accuracy: 5 },
        sensorAvailability: { gps: true, accelerometer: true, isMobile: true },
      });

    assert.equal(startRes.status, 201);
    assert.ok(startRes.body.journeyId);
    activeJourneyId = startRes.body.journeyId;
    assert.equal(startRes.body.journey.journeyState, 'WALKING');

    // Send walking sensor data
    const sensorRes = await request(app)
      .post('/api/journey/sensor-data')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        journeyId: activeJourneyId,
        sensorWindow: {
          latitude: 18.5290,
          longitude: 73.8748,
          gpsAccuracy: 5,
          speed: 4.8,
          speeds: [4.5, 4.8, 5.0],
          accelerationsX: [0.6, -0.5, 0.4],
          accelerationsY: [0.5, 0.8, -0.6],
          accelerationsZ: [11.2, 8.4, 11.6],
          cadence: 114,
          stepDelta: 10,
          transitCorridorOverlap: 0.1,
          stopFrequency: 0.05,
        },
      });

    assert.equal(sensorRes.status, 200);
    assert.equal(sensorRes.body.predictedMode, 'WALKING');
    assert.equal(sensorRes.body.stepCountingEnabled, true);
    assert.ok(sensorRes.body.verifiedWalkingSteps >= 10);
  });

  // Scenario 2 — Walking -> EV
  it('Scenario 2 — Walking -> EV: Vehicle detected -> EV Bluetooth verification -> EV verified -> Step counter OFF -> EV Green Credit active', async () => {
    // Send EV verification request with matching BLE ID
    const verifyRes = await request(app)
      .post(`/api/journey/${activeJourneyId}/verify-ev`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        bluetoothIdentifier: 'GC-EV-8F31A2',
        deviceName: 'Tata Nexon EV BLE',
      });

    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.verified, true);
    assert.equal(verifyRes.body.journeyState, 'EV_VERIFIED');

    // Send vehicle sensor data while EV is verified
    const sensorRes = await request(app)
      .post('/api/journey/sensor-data')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        journeyId: activeJourneyId,
        sensorWindow: {
          latitude: 18.5415,
          longitude: 73.8340,
          gpsAccuracy: 5,
          speed: 38.0,
          speeds: [35.0, 38.0, 42.0],
          accelerationsX: [0.1, -0.1, 0.1],
          accelerationsY: [0.1, 0.2, -0.1],
          accelerationsZ: [9.8, 9.85, 9.81],
          cadence: 0,
          stepDelta: 5, // Vehicle vibration should be rejected from verified steps
          transitCorridorOverlap: 0.1,
          stopFrequency: 0.0,
        },
      });

    assert.equal(sensorRes.status, 200);
    assert.equal(sensorRes.body.stepCountingEnabled, false);
    // Verified steps should remain locked
    assert.equal(sensorRes.body.verifiedWalkingSteps, 10);
  });

  // Scenario 3 — Petrol Vehicle Rejection
  it('Scenario 3 — Petrol Vehicle Rejection: Registered vehicle = PETROL -> Rejected -> 0 Green Credits', async () => {
    const petrolJourneyRes = await request(app)
      .post('/api/journey/start')
      .set('Authorization', `Bearer ${petrolUserToken}`)
      .send({
        plannedMode: 'WALKING',
        initialLocation: { lat: 18.5284, lng: 73.8744, accuracy: 5 },
      });

    const petrolJourneyId = petrolJourneyRes.body.journeyId;

    const verifyRes = await request(app)
      .post(`/api/journey/${petrolJourneyId}/verify-ev`)
      .set('Authorization', `Bearer ${petrolUserToken}`)
      .send({
        bluetoothIdentifier: 'ANY_DEVICE',
      });

    // Server must reject fossil-fuel vehicle
    assert.equal(verifyRes.status, 422);
    assert.equal(verifyRes.body.eligible, false);
    assert.ok(verifyRes.body.reason.includes('PETROL'));
  });

  // Scenario 5 — Bus Detection & Continuous Verification
  it('Scenario 5 — Bus: Confirm Route 103 -> Public transport verified -> Step counter OFF -> Bus Green Credits active', async () => {
    const busConfirmRes = await request(app)
      .post(`/api/journey/${activeJourneyId}/public-transport-confirm`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        routeId: '103',
        userConfirmed: true,
        currentLat: 18.5312,
        currentLng: 73.8567,
      });

    assert.equal(busConfirmRes.status, 200);
    assert.equal(busConfirmRes.body.mode, 'BUS');
    assert.ok(busConfirmRes.body.confidence >= 0.70);
  });

  // Scenario 8 — GPS Anomaly & Teleportation Detection
  it('Scenario 8 — GPS Anomaly: Large coordinate jump (>500m in 1s) -> Flagged as fraud', async () => {
    const fraudSensorRes = await request(app)
      .post('/api/journey/sensor-data')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        journeyId: activeJourneyId,
        sensorWindow: {
          latitude: 19.0760, // Teleported to Mumbai from Pune
          longitude: 72.8777,
          gpsAccuracy: 5,
          speed: 180.0,
          speeds: [180.0, 190.0],
          cadence: 0,
        },
      });

    assert.equal(fraudSensorRes.status, 200);
    assert.ok(fraudSensorRes.body.fraudScore > 50);
  });
});
