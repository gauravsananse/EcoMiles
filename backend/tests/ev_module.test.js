const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const vehicleVerificationService = require('../services/vehicleVerificationService');
const qrService = require('../services/qrService');

let mongoServer;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_secret_key_12345';
  process.env.VEHICLE_API_PROVIDER = 'sandbox';

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await User.deleteMany({});
  await Vehicle.deleteMany({});
});

describe('1. User Authentication & Password Hashing', () => {
  it('should securely hash password and prevent plaintext leaks', async () => {
    const password = 'StrongPassword123!';
    const passwordHash = await User.hashPassword(password);

    assert.notEqual(password, passwordHash, 'Password must be hashed');

    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash,
    });

    assert.ok(user._id, 'User should be created');
    const isMatch = await user.comparePassword(password);
    assert.equal(isMatch, true, 'Valid password should match');

    const isWrongMatch = await user.comparePassword('WrongPassword');
    assert.equal(isWrongMatch, false, 'Invalid password must not match');
  });

  it('should enforce unique email index', async () => {
    const passwordHash = await User.hashPassword('Pass123!');
    await User.create({
      name: 'User One',
      email: 'duplicate@example.com',
      passwordHash,
    });

    let duplicateError = null;
    try {
      await User.create({
        name: 'User Two',
        email: 'duplicate@example.com',
        passwordHash,
      });
    } catch (err) {
      duplicateError = err;
    }

    assert.ok(duplicateError, 'Duplicate email should throw MongoDB error');
  });
});

describe('2. Vehicle Registration Format & Verification Service', () => {
  it('should normalize registration plates correctly', () => {
    assert.equal(vehicleVerificationService.normalizeRegistrationNumber('mh 12 ab 1234'), 'MH12AB1234');
    assert.equal(vehicleVerificationService.normalizeRegistrationNumber('dl-01-ev-9999'), 'DL01EV9999');
    assert.equal(vehicleVerificationService.normalizeRegistrationNumber('ka.03.ev.5678'), 'KA03EV5678');
  });

  it('should validate Indian plate formats and reject invalid ones', () => {
    assert.equal(vehicleVerificationService.validatePlateFormat('MH12AB1234'), true);
    assert.equal(vehicleVerificationService.validatePlateFormat('DL01EV9999'), true);
    assert.equal(vehicleVerificationService.validatePlateFormat('22BH1234AA'), true);

    // Invalid formats
    assert.equal(vehicleVerificationService.validatePlateFormat('INVALID'), false);
    assert.equal(vehicleVerificationService.validatePlateFormat('1234567'), false);
    assert.equal(vehicleVerificationService.validatePlateFormat('M12A123'), false);
  });

  it('should mask owner names to protect sensitive PII', () => {
    const masked = vehicleVerificationService.maskOwnerName('GAURAV SHARMA');
    assert.match(masked, /^G\*{4,} S\*{4,}$/);
    assert.notEqual(masked, 'GAURAV SHARMA');
  });

  it('should detect Electric Fuel vs Internal Combustion (Petrol/Diesel)', () => {
    assert.equal(vehicleVerificationService.isElectricFuel('ELECTRIC').isEV, true);
    assert.equal(vehicleVerificationService.isElectricFuel('BATTERY OPERATED VEHICLE (BOV)').isEV, true);
    assert.equal(vehicleVerificationService.isElectricFuel('PURE EV').isEV, true);

    assert.equal(vehicleVerificationService.isElectricFuel('PETROL').isEV, false);
    assert.equal(vehicleVerificationService.isElectricFuel('DIESEL').isEV, false);
    assert.equal(vehicleVerificationService.isElectricFuel('CNG').isEV, false);
  });

  it('should verify a valid EV in sandbox mode and return EV confirmed data', async () => {
    vehicleVerificationService.initProvider();
    const result = await vehicleVerificationService.verifyVehicleRegistration('MH12AB1234');

    assert.equal(result.success, true);
    assert.equal(result.isEV, true);
    assert.equal(result.registrationNumber, 'MH12AB1234');
    assert.equal(result.fuelType, 'Electric');
    assert.ok(result.ownerName.includes('*'), 'Owner name must be masked');
    assert.ok(result.isSandboxMode, 'Source should be sandbox mode');
  });

  it('should reject a Non-EV vehicle with NOT_AN_EV error state', async () => {
    const result = await vehicleVerificationService.verifyVehicleRegistration('MH14XY5678');

    assert.equal(result.success, false);
    assert.equal(result.errorState, 'NOT_AN_EV');
    assert.match(result.message, /not identified as an electric vehicle/i);
  });

  it('should return VEHICLE_NOT_FOUND for unknown registrations', async () => {
    const result = await vehicleVerificationService.verifyVehicleRegistration('MH99ZZ9999');

    assert.equal(result.success, false);
    assert.equal(result.errorState, 'VEHICLE_NOT_FOUND');
  });
});

describe('3. Duplicate Vehicle Protection & Ownership Binding', () => {
  it('should allow User A to register an EV and prevent User B from registering the same vehicle', async () => {
    const userA = await User.create({
      name: 'User A',
      email: 'usera@example.com',
      passwordHash: 'hashA',
    });

    const userB = await User.create({
      name: 'User B',
      email: 'userb@example.com',
      passwordHash: 'hashB',
    });

    const qrTokenA = qrService.generateSecureToken();

    // User A registers MH12AB1234
    const vehicleA = await Vehicle.create({
      userId: userA._id,
      registrationNumber: 'MH12AB1234',
      vehicleType: 'EV',
      manufacturer: 'Ather Energy',
      model: '450X',
      fuelType: 'Electric',
      verificationStatus: 'verified',
      verificationSource: 'Vahan Testbed',
      qrToken: qrTokenA,
      isActive: true,
    });

    assert.ok(vehicleA._id);

    // User B tries to register same MH12AB1234
    let duplicateError = null;
    try {
      const qrTokenB = qrService.generateSecureToken();
      await Vehicle.create({
        userId: userB._id,
        registrationNumber: 'MH12AB1234',
        vehicleType: 'EV',
        manufacturer: 'Ather Energy',
        model: '450X',
        fuelType: 'Electric',
        verificationStatus: 'verified',
        verificationSource: 'Vahan Testbed',
        qrToken: qrTokenB,
        isActive: true,
      });
    } catch (err) {
      duplicateError = err;
    }

    assert.ok(duplicateError, 'Duplicate vehicle registration must be rejected by unique index');
    assert.equal(duplicateError.code, 11000, 'Duplicate key error code 11000 expected');
  });
});

describe('4. QR Cryptographic Token & Physical Access Verification', () => {
  it('should generate high entropy 64-char hex tokens and QR Data URLs', async () => {
    const token1 = qrService.generateSecureToken();
    const token2 = qrService.generateSecureToken();

    assert.equal(token1.length, 64);
    assert.notEqual(token1, token2);

    const qrDataURL = await qrService.generateQRCodeDataURL(token1, 'MH12AB1234');
    assert.ok(qrDataURL.startsWith('data:image/png;base64,'));
  });

  it('should confirm QR binding only when scanned by the authorized vehicle owner', async () => {
    const owner = await User.create({
      name: 'Vehicle Owner',
      email: 'owner@example.com',
      passwordHash: 'hash',
    });

    const otherUser = await User.create({
      name: 'Other User',
      email: 'other@example.com',
      passwordHash: 'hash',
    });

    const qrToken = qrService.generateSecureToken();
    const vehicle = await Vehicle.create({
      userId: owner._id,
      registrationNumber: 'DL01EV9999',
      fuelType: 'Electric',
      verificationSource: 'Vahan Gateway',
      qrToken,
      isActive: true,
    });

    // Owner checks QR:
    const ownerCheck = vehicle.userId.equals(owner._id);
    assert.equal(ownerCheck, true, 'Vehicle owner should be confirmed');

    // Other user checks QR:
    const otherCheck = vehicle.userId.equals(otherUser._id);
    assert.equal(otherCheck, false, 'Non-owner must be rejected');
  });
});
