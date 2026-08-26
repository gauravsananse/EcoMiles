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

describe('5. End-to-End REST API Workflow Test', () => {
  let userAToken;
  let userBToken;
  let userAId;
  let registeredVehicle;

  it('POST /api/auth/register should create User A and return JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Gaurav Sharma',
        email: 'gaurav.sharma@example.com',
        password: 'Password123!',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    userAToken = res.body.token;
    userAId = res.body.user.id;
  });

  it('POST /api/auth/register should create User B and return JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Anita Verma',
        email: 'anita.verma@example.com',
        password: 'Password123!',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.token);
    userBToken = res.body.token;
  });

  it('POST /api/vehicles/verify should normalize and verify EV plate MH12AB1234', async () => {
    const res = await request(app)
      .post('/api/vehicles/verify')
      .send({ registrationNumber: 'mh 12 ab 1234' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.registrationNumber, 'MH12AB1234');
    assert.equal(res.body.data.isEV, true);
    assert.equal(res.body.data.fuelType, 'Electric');
    assert.ok(res.body.data.ownerName.includes('*'), 'Owner name must be masked for privacy');
  });

  it('POST /api/vehicles/verify should reject non-EV vehicle MH14XY5678 with NOT_AN_EV', async () => {
    const res = await request(app)
      .post('/api/vehicles/verify')
      .send({ registrationNumber: 'MH14XY5678' });

    assert.equal(res.status, 422);
    assert.equal(res.body.success, false);
    assert.equal(res.body.errorState, 'NOT_AN_EV');
  });

  it('POST /api/vehicles/register should bind verified EV to User A', async () => {
    const res = await request(app)
      .post('/api/vehicles/register')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        registrationNumber: 'MH12AB1234',
        manufacturer: 'Ather Energy',
        model: '450X Gen 3',
        fuelType: 'Electric',
        vehicleClass: 'Two Wheeler (2W-EV)',
        registrationDate: '2023-04-14',
        maskedOwnerName: 'G***** S******',
        verificationSource: 'National Vahan Gateway',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.vehicle.registrationNumber, 'MH12AB1234');
    assert.ok(res.body.vehicle.qrToken);
    assert.ok(res.body.vehicle.qrDataURL);
    registeredVehicle = res.body.vehicle;
  });

  it('POST /api/vehicles/register should reject User B attempting to register the same vehicle (Duplicate Protection)', async () => {
    const res = await request(app)
      .post('/api/vehicles/register')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        registrationNumber: 'MH12AB1234',
        manufacturer: 'Ather Energy',
        model: '450X Gen 3',
        fuelType: 'Electric',
        vehicleClass: 'Two Wheeler (2W-EV)',
        registrationDate: '2023-04-14',
        maskedOwnerName: 'G***** S******',
        verificationSource: 'National Vahan Gateway',
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.errorState, 'ALREADY_REGISTERED');
    assert.equal(res.body.error, 'This vehicle is already associated with another account.');
  });

  it('GET /api/vehicles/my-vehicle should return User A registered EV', async () => {
    const res = await request(app)
      .get('/api/vehicles/my-vehicle')
      .set('Authorization', `Bearer ${userAToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.vehicle.registrationNumber, 'MH12AB1234');
    assert.equal(res.body.vehicle.qrToken, registeredVehicle.qrToken);
  });

  it('POST /api/vehicles/qr/verify should confirm binding when scanned by User A', async () => {
    const res = await request(app)
      .post('/api/vehicles/qr/verify')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ qrToken: registeredVehicle.qrToken });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.verified, true);
    assert.equal(res.body.message, '✓ Vehicle Binding Confirmed');
  });

  it('POST /api/vehicles/qr/verify should reject when scanned by User B (Non-owner)', async () => {
    const res = await request(app)
      .post('/api/vehicles/qr/verify')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ qrToken: registeredVehicle.qrToken });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.verified, false);
    assert.equal(res.body.error, '✕ This vehicle is not associated with your account.');
  });

  it('POST /api/vehicles/qr/regenerate should create a new QR token for User A', async () => {
    const res = await request(app)
      .post('/api/vehicles/qr/regenerate')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ vehicleId: registeredVehicle.id });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.notEqual(res.body.qrToken, registeredVehicle.qrToken);
    registeredVehicle.qrToken = res.body.qrToken;
  });

  it('DELETE /api/vehicles/:vehicleId should unlink vehicle from User A account', async () => {
    const res = await request(app)
      .delete(`/api/vehicles/${registeredVehicle.id}`)
      .set('Authorization', `Bearer ${userAToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    // Verify it is no longer bound
    const checkRes = await request(app)
      .get('/api/vehicles/my-vehicle')
      .set('Authorization', `Bearer ${userAToken}`);

    assert.equal(checkRes.status, 200);
    assert.equal(checkRes.body.vehicle, null);
  });
});
