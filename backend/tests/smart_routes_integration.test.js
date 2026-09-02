const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'super_secret_test_jwt_key';
  process.env.VEHICLE_API_PROVIDER = 'sandbox';

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = require('../server');
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Google Maps Style Smart Routes & Navigation Integration Suite', () => {
  let userToken;
  let plannedCyclingRoute;
  let activeJourneyId;

  it('1. POST /api/auth/register should create user account and return JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Gaurav Sananse',
        email: 'gaurav.smartroutes@example.com',
        password: 'Password123!',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    userToken = res.body.token;
  });

  it('2. GET /api/routes/places/autocomplete should return real location suggestions for "Pune"', async () => {
    const res = await request(app)
      .get('/api/routes/places/autocomplete?input=Pune');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.predictions));
    assert.ok(res.body.predictions.length > 0, 'Must return place predictions');
    const first = res.body.predictions[0];
    assert.ok(first.name);
    assert.ok(first.formattedAddress || first.secondaryText);
  });

  it('3. GET /api/routes/places/reverse-geocode should resolve coordinates for "Use my current location"', async () => {
    const res = await request(app)
      .get('/api/routes/places/reverse-geocode?lat=18.5284&lng=73.8744');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.location);
    assert.equal(res.body.location.latitude, 18.5284);
    assert.equal(res.body.location.longitude, 73.8744);
    assert.ok(res.body.location.name);
  });

  it('4. POST /api/routes/smart-plan should calculate 3 separate real routes (Walking, Cycling, Driving) for Pune Stn -> SPPU', async () => {
    const origin = {
      name: 'Pune Railway Station',
      formattedAddress: 'Agarkar Nagar, Pune, Maharashtra 411001',
      latitude: 18.5284,
      longitude: 73.8744,
    };
    const destination = {
      name: 'Savitribai Phule Pune University',
      formattedAddress: 'Ganeshkhind, Pune, Maharashtra 411007',
      latitude: 18.5529,
      longitude: 73.8267,
    };

    const res = await request(app)
      .post('/api/routes/smart-plan')
      .send({ origin, destination });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.routes));
    assert.equal(res.body.routes.length, 3, 'Must return Walking, Cycling, and Driving routes');

    // Verify Walking Route
    const walkingRoute = res.body.routes.find((r) => r.mode === 'WALKING');
    assert.ok(walkingRoute, 'Walking route must exist');
    assert.ok(walkingRoute.distanceKm > 0, 'Distance must be > 0');
    assert.ok(walkingRoute.durationMinutes > 0, 'Duration must be > 0');
    assert.ok(walkingRoute.encodedPolyline, 'Must contain polyline geometry');
    assert.ok(Array.isArray(walkingRoute.coordinates) && walkingRoute.coordinates.length > 0);
    assert.ok(Array.isArray(walkingRoute.steps), 'Must contain navigation steps');
    assert.ok(walkingRoute.fitnessPoints > 0, 'Walking must earn Fitness Points');
    assert.ok(walkingRoute.greenCredits > 0, 'Walking must earn Green Credits');
    assert.ok(walkingRoute.co2AvoidedKg > 0, 'Walking must avoid CO2');

    // Verify Cycling Route
    const cyclingRoute = res.body.routes.find((r) => r.mode === 'CYCLING');
    assert.ok(cyclingRoute, 'Cycling route must exist');
    assert.ok(cyclingRoute.distanceKm > 0);
    assert.ok(cyclingRoute.durationMinutes > 0);
    assert.ok(cyclingRoute.fitnessPoints > 0);
    assert.ok(cyclingRoute.greenCredits > 0);
    plannedCyclingRoute = cyclingRoute;

    // Verify Driving Route
    const drivingRoute = res.body.routes.find((r) => r.mode === 'CAR');
    assert.ok(drivingRoute, 'Driving route must exist');
    assert.equal(drivingRoute.fitnessPoints, 0, 'Car route earns 0 Fitness Points');
    assert.equal(drivingRoute.greenCredits, 0, 'Car route earns 0 Green Credits');
    assert.ok(drivingRoute.co2EmittedKg > 0, 'Car route emits CO2');
  });

  it('5. POST /api/routes/reroute should compute new real route when off-route deviation occurs', async () => {
    const currentLocation = { lat: 18.5350, lng: 73.8500 };
    const destination = {
      name: 'Savitribai Phule Pune University',
      latitude: 18.5529,
      longitude: 73.8267,
    };

    const res = await request(app)
      .post('/api/routes/reroute')
      .send({
        currentLocation,
        destination,
        mode: 'CYCLING',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.route);
    assert.ok(res.body.route.coordinates.length > 0);
    assert.ok(res.body.route.steps.length > 0);
  });

  it('6. POST /api/journey/start should initialize journey with selected planned route & mode', async () => {
    const res = await request(app)
      .post('/api/journey/start')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        plannedMode: 'CYCLING',
        origin: plannedCyclingRoute.origin,
        destination: plannedCyclingRoute.destination,
        plannedRoute: plannedCyclingRoute,
        initialLocation: { lat: 18.5284, lng: 73.8744, accuracy: 5 },
        sensorAvailability: { gps: true, accelerometer: true, gyroscope: true, isMobile: true },
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.journeyId);
    assert.equal(res.body.journey.plannedMode, 'CYCLING');
    assert.equal(res.body.journey.origin.name, 'Pune Railway Station');
    assert.equal(res.body.journey.destination.name, 'Savitribai Phule Pune University');
    activeJourneyId = res.body.journeyId;
  });

  it('7. POST /api/journey/sensor-data should ingest live cycling kinematics and track progress', async () => {
    const cyclingSensorWindow = {
      timestamp: Date.now(),
      latitude: 18.5286,
      longitude: 73.8746,
      gpsAccuracy: 4,
      speed: 16.5,
      speeds: [15.2, 16.0, 16.8, 17.2, 16.5],
      accelerationsX: [0.2, 0.4, -0.3, 0.1, 0.5],
      accelerationsY: [0.1, -0.2, 0.3, -0.1, 0.2],
      accelerationsZ: [9.8, 10.2, 9.4, 9.9, 10.1],
      gyrosAlpha: [1.2, 2.0, 1.5],
      gyrosBeta: [0.5, 0.8, 0.3],
      gyrosGamma: [0.2, 0.4, 0.1],
      headings: [45.0, 48.0, 46.0],
      cadence: 76,
      stepCount: 150,
      transitCorridorOverlap: 0,
      dwellTimeRatio: 0,
      bleSignals: [],
      sensorAvailability: { gps: true, accelerometer: true, gyroscope: true, stepCounter: true, isMobile: true },
      windowDurationSeconds: 5.0,
    };

    const res = await request(app)
      .post('/api/journey/sensor-data')
      .send({
        journeyId: activeJourneyId,
        sensorWindow: cyclingSensorWindow,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.predictedMode, 'CYCLING');
    assert.ok(res.body.totalDistanceKm > 0);
  });

  it('8. POST /api/journey/end should finalize journey and award verified Fitness Points & Green Credits', async () => {
    const res = await request(app)
      .post('/api/journey/end')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ journeyId: activeJourneyId });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.journey);
    assert.equal(res.body.journey.status, 'COMPLETED');
    assert.ok(res.body.validationOutcome.includes('VALID'));
    assert.ok(res.body.updatedUser, 'Must return updated user wallet');
  });
});
