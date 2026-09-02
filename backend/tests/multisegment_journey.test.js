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

  const User = require('../models/User');
  const jwt = require('jsonwebtoken');

  const user = await User.create({
    name: 'Multi-Modal Commuter',
    email: 'multimodal@example.com',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
    fitnessPoints: 10,
    greenCredits: 5,
  });
  testUserId = user._id;
  testUserToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Multi-Segment Journey & Dedicated Transit Hub Test Suite (Requirements 1–57)', () => {
  let activeJourneyId;

  // 1. Transit Hub APIs
  it('1. GET /api/transit/stops/nearby returns nearby Indian bus/metro stops with distance and routes', async () => {
    const res = await request(app)
      .get('/api/transit/stops/nearby?lat=18.5284&lng=73.8744&radius=4000');

    assert.equal(res.status, 200);
    assert.ok(res.body.success);
    assert.ok(res.body.stops.length > 0);
    const stop = res.body.stops[0];
    assert.ok(stop.name);
    assert.ok(stop.distanceMeters >= 0);
  });

  it('2. GET /api/transit/arrivals/:stopId returns upcoming bus schedule and transparent status tags', async () => {
    const res = await request(app)
      .get('/api/transit/arrivals/STN-PUNE-01');

    assert.equal(res.status, 200);
    assert.ok(res.body.success);
    assert.ok(res.body.arrivals.length > 0);
    const arrival = res.body.arrivals[0];
    assert.ok(arrival.busNumber);
    assert.ok(arrival.etaMinutes > 0);
    assert.equal(arrival.status, 'SCHEDULED');
  });

  it('3. GET /api/transit/routes/search calculates multimodal transit itineraries with walking & transit legs', async () => {
    const res = await request(app)
      .get('/api/transit/routes/search?origin=Home&destination=Hinjewadi+Phase+1&lat=18.5284&lng=73.8744');

    assert.equal(res.status, 200);
    assert.ok(res.body.success);
    assert.ok(res.body.itineraries.length > 0);
    const itin = res.body.itineraries[0];
    assert.ok(itin.totalDurationMinutes > 0);
    assert.ok(itin.steps.length >= 3);
    assert.equal(itin.steps[0].type, 'WALK');
    assert.ok(itin.estimatedGreenCredits > 0);
  });

  // 2. Multi-Segment Journey: Segment 1 (Walk)
  it('4. Segment 1: Start journey in WALK mode, accumulate verified steps, stop segment 0', async () => {
    const startRes = await request(app)
      .post('/api/journey/start')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        plannedMode: 'WALK',
        origin: { name: 'Home', lat: 18.5284, lng: 73.8744 },
        destination: { name: 'Hinjewadi Phase 1' },
        initialLocation: { lat: 18.5284, lng: 73.8744, accuracy: 5 },
      });

    assert.equal(startRes.status, 201);
    assert.ok(startRes.body.journeyId);
    activeJourneyId = startRes.body.journeyId;

    // Send walking sensor data
    await request(app)
      .post('/api/journey/sensor-data')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        journeyId: activeJourneyId,
        sensorWindow: {
          latitude: 18.5312,
          longitude: 73.8567,
          speed: 4.8,
          speeds: [4.5, 4.8, 5.0],
          cadence: 114,
          stepDelta: 185,
        },
      });

    // Complete Segment 0 (Walking)
    const completeSegRes = await request(app)
      .post(`/api/journey/${activeJourneyId}/segments/0/complete`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        endLocation: { lat: 18.5312, lng: 73.8567 },
        finalSteps: 1665, // Total 1850 verified steps
      });

    assert.equal(completeSegRes.status, 200);
    assert.ok(completeSegRes.body.success);
    assert.equal(completeSegRes.body.segment.verificationStatus, 'VERIFIED');
    assert.ok(completeSegRes.body.earnedFitnessPoints >= 0);
  });

  // 3. Multi-Segment Journey: Continue Journey -> Segment 2 (Public Transport - Bus 103)
  it('5. Segment 2: Continue Journey under SAME journeyId -> Start PUBLIC_TRANSPORT segment (Bus 103)', async () => {
    const startSegRes = await request(app)
      .post(`/api/journey/${activeJourneyId}/segments/start`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        selectedMode: 'PUBLIC_TRANSPORT',
        selectedRouteId: '103',
        selectedRouteName: 'Route 103 — Pune Station ⇄ Hinjewadi',
        origin: { name: 'Shivajinagar Bus Stop' },
        destination: { name: 'Hinjewadi IT Park' },
        currentLocation: { lat: 18.5312, lng: 73.8567 },
      });

    assert.equal(startSegRes.status, 201);
    assert.equal(startSegRes.body.segmentIndex, 1);
    assert.equal(startSegRes.body.stepCountingEnabled, false);

    // Send Bus telemetry (step counting should be locked)
    const busSensorRes = await request(app)
      .post('/api/journey/sensor-data')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        journeyId: activeJourneyId,
        sensorWindow: {
          latitude: 18.5601,
          longitude: 73.8055,
          speed: 34.0,
          speeds: [0, 25, 34, 40],
          cadence: 0,
          stepDelta: 15, // Vehicular vibrations must be suppressed
        },
      });

    assert.equal(busSensorRes.status, 200);
    assert.equal(busSensorRes.body.stepCountingEnabled, false);

    // Complete Segment 1 (Bus)
    const completeBusRes = await request(app)
      .post(`/api/journey/${activeJourneyId}/segments/1/complete`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        endLocation: { lat: 18.5915, lng: 73.7380 },
      });

    assert.equal(completeBusRes.status, 200);
    assert.equal(completeBusRes.body.segment.status, 'COMPLETED');
  });

  // 4. End Entire Journey & Aggregate Rewards
  it('6. End Entire Journey -> Aggregates verified Walk & Bus segments into total FP, GP, and Combined Points', async () => {
    const endRes = await request(app)
      .post('/api/journey/end')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        journeyId: activeJourneyId,
      });

    assert.equal(endRes.status, 200);
    assert.ok(endRes.body.success);
    assert.equal(endRes.body.journey.status, 'COMPLETED');
    assert.equal(endRes.body.journey.segments.length, 2);

    // Fetch full summary
    const sumRes = await request(app)
      .get(`/api/journey/${activeJourneyId}/summary`)
      .set('Authorization', `Bearer ${testUserToken}`);

    assert.equal(sumRes.status, 200);
    assert.ok(sumRes.body.totals);
    assert.equal(sumRes.body.totals.segmentsCount, 2);
    assert.ok(sumRes.body.totals.totalCombinedPoints >= (sumRes.body.totals.totalFitnessPoints + sumRes.body.totals.totalGreenCredits));
  });
});
