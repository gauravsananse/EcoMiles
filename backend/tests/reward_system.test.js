const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../models/User');
const Journey = require('../models/Journey');
const RewardTransaction = require('../models/RewardTransaction');
const Reward = require('../models/Reward');
const rewardEngine = require('../services/rewardEngine');
const rewardController = require('../controllers/rewardController');

describe('EcoMiles Reward Distribution & Daily Limit Engine Suite', () => {
  let mongoServer;
  let testUserA;
  let testUserB;

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

  beforeEach(async () => {
    await User.deleteMany({});
    await Journey.deleteMany({});
    await RewardTransaction.deleteMany({});
    await Reward.deleteMany({});

    testUserA = await User.create({
      name: 'Eco User A',
      email: 'usera@example.com',
      passwordHash: '$2a$10$hashedpasswordforexampleuser',
      fitnessPoints: 0,
      greenCredits: 0,
    });

    testUserB = await User.create({
      name: 'Eco User B',
      email: 'userb@example.com',
      passwordHash: '$2a$10$hashedpasswordforexampleuser',
      fitnessPoints: 0,
      greenCredits: 0,
    });
  });

  it('TEST 1: Walking reward rate (10 FP / 1,000 steps, 5 GC / km)', async () => {
    // 3,000 steps, 2.0 km -> 30 FP, 10 GC
    const raw = rewardEngine.calculatePotentialRewards('WALK', { distanceKm: 2.0, steps: 3000 });
    assert.strictEqual(raw.fitnessPoints, 30);
    assert.strictEqual(raw.greenCredits, 10);
  });

  it('TEST 2: Cycling reward rate (10 FP / km, 8 GC / km)', async () => {
    // 5 km cycling -> 50 FP, 40 GC
    const raw = rewardEngine.calculatePotentialRewards('CYCLING', { distanceKm: 5.0 });
    assert.strictEqual(raw.fitnessPoints, 50);
    assert.strictEqual(raw.greenCredits, 40);
  });

  it('TEST 3: Public Transport reward rate (5 GC / km, 0 FP)', async () => {
    // 6 km public transport -> 0 FP, 30 GC
    const raw = rewardEngine.calculatePotentialRewards('PUBLIC_TRANSPORT', { distanceKm: 6.0 });
    assert.strictEqual(raw.fitnessPoints, 0);
    assert.strictEqual(raw.greenCredits, 30);
  });

  it('TEST 4: Metro reward rate (5 GC / km, 0 FP)', async () => {
    // 4 km metro -> 0 FP, 20 GC
    const raw = rewardEngine.calculatePotentialRewards('METRO', { distanceKm: 4.0 });
    assert.strictEqual(raw.fitnessPoints, 0);
    assert.strictEqual(raw.greenCredits, 20);
  });

  it('TEST 5: EV reward rate (3 GC / km, 0 FP)', async () => {
    // 5 km EV -> 0 FP, 15 GC
    const raw = rewardEngine.calculatePotentialRewards('EV', { distanceKm: 5.0 });
    assert.strictEqual(raw.fitnessPoints, 0);
    assert.strictEqual(raw.greenCredits, 15);
  });

  it('TEST 6: Unverified journey awards 0 FP and 0 GC', async () => {
    const journey = await Journey.create({
      userId: testUserA._id,
      transportMode: 'WALK',
      verificationStatus: 'TRACKING',
      distance: 3.0,
      steps: 3000,
    });

    const result = await rewardEngine.finalizeAndReleaseJourneyRewards(journey, testUserA._id);
    assert.strictEqual(result.rewardAwarded, false);
    assert.strictEqual(result.fitnessPoints, 0);
    assert.strictEqual(result.greenCredits, 0);

    const user = await User.findById(testUserA._id);
    assert.strictEqual(user.fitnessPoints, 0);
    assert.strictEqual(user.greenCredits, 0);
  });

  it('TEST 7: Rejected journey awards 0 FP and 0 GC', async () => {
    const journey = await Journey.create({
      userId: testUserA._id,
      transportMode: 'CYCLING',
      verificationStatus: 'REJECTED',
      distance: 10.0,
    });

    const result = await rewardEngine.finalizeAndReleaseJourneyRewards(journey, testUserA._id);
    assert.strictEqual(result.rewardAwarded, false);
    assert.strictEqual(result.fitnessPoints, 0);
    assert.strictEqual(result.greenCredits, 0);

    const user = await User.findById(testUserA._id);
    assert.strictEqual(user.fitnessPoints, 0);
    assert.strictEqual(user.greenCredits, 0);
  });

  it('TEST 8: Duplicate journey reward prevention across retries', async () => {
    const journey = await Journey.create({
      userId: testUserA._id,
      transportMode: 'WALK',
      verificationStatus: 'VERIFIED',
      distance: 2.0,
      steps: 2000,
    });

    // 1st attempt: should succeed and award 20 FP, 10 GC
    const firstCall = await rewardEngine.finalizeAndReleaseJourneyRewards(journey, testUserA._id);
    assert.strictEqual(firstCall.rewardAwarded, true);
    assert.strictEqual(firstCall.fitnessPoints, 20);
    assert.strictEqual(firstCall.greenCredits, 10);

    // Refresh journey doc
    const updatedJourney = await Journey.findById(journey._id);
    assert.strictEqual(updatedJourney.rewardClaimed, true);

    // 2nd attempt (e.g. page refresh / retry): duplicate check triggers
    const secondCall = await rewardEngine.finalizeAndReleaseJourneyRewards(updatedJourney, testUserA._id);
    assert.strictEqual(secondCall.rewardAwarded, false);
    assert.strictEqual(secondCall.duplicate, true);

    // Check balance remains exactly 20 FP and 10 GC, not double
    const user = await User.findById(testUserA._id);
    assert.strictEqual(user.fitnessPoints, 20);
    assert.strictEqual(user.greenCredits, 10);
  });

  it('TEST 9: Daily FP limit cap (walk 12,000 steps capped at 100 FP/day)', async () => {
    const journey = await Journey.create({
      userId: testUserA._id,
      transportMode: 'WALK',
      verificationStatus: 'VERIFIED',
      distance: 2.0,
      steps: 12000, // raw calculation would be 120 FP
    });

    const result = await rewardEngine.finalizeAndReleaseJourneyRewards(journey, testUserA._id);
    assert.strictEqual(result.rewardAwarded, true);
    assert.strictEqual(result.fitnessPoints, 100); // capped at 100 FP
    assert.strictEqual(result.greenCredits, 10);

    const user = await User.findById(testUserA._id);
    assert.strictEqual(user.fitnessPoints, 100);
  });

  it('TEST 10: Daily GC limit cap (public transport 12 km capped at 50 GC/day)', async () => {
    const journey = await Journey.create({
      userId: testUserA._id,
      transportMode: 'PUBLIC_TRANSPORT',
      verificationStatus: 'VERIFIED',
      distance: 12.0, // raw calculation would be 60 GC
    });

    const result = await rewardEngine.finalizeAndReleaseJourneyRewards(journey, testUserA._id);
    assert.strictEqual(result.rewardAwarded, true);
    assert.strictEqual(result.fitnessPoints, 0);
    assert.strictEqual(result.greenCredits, 50); // capped at 50 GC

    const user = await User.findById(testUserA._id);
    assert.strictEqual(user.greenCredits, 50);
  });

  it('TEST 11: Multi-journey daily limit accumulation (4k + 5k + 5k steps -> 40, 50, 10 FP)', async () => {
    // Journey 1: 4,000 steps -> 40 FP
    const j1 = await Journey.create({
      userId: testUserA._id,
      transportMode: 'WALK',
      verificationStatus: 'VERIFIED',
      distance: 2.0,
      steps: 4000,
    });
    const r1 = await rewardEngine.finalizeAndReleaseJourneyRewards(j1, testUserA._id);
    assert.strictEqual(r1.fitnessPoints, 40);

    // Journey 2: 5,000 steps -> 50 FP (total 90 FP)
    const j2 = await Journey.create({
      userId: testUserA._id,
      transportMode: 'WALK',
      verificationStatus: 'VERIFIED',
      distance: 2.0,
      steps: 5000,
    });
    const r2 = await rewardEngine.finalizeAndReleaseJourneyRewards(j2, testUserA._id);
    assert.strictEqual(r2.fitnessPoints, 50);

    // Journey 3: 5,000 steps -> only 10 FP remaining before reaching 100 FP limit
    const j3 = await Journey.create({
      userId: testUserA._id,
      transportMode: 'WALK',
      verificationStatus: 'VERIFIED',
      distance: 2.0,
      steps: 5000,
    });
    const r3 = await rewardEngine.finalizeAndReleaseJourneyRewards(j3, testUserA._id);
    assert.strictEqual(r3.fitnessPoints, 10);

    // User balance should be exactly 100 FP
    const user = await User.findById(testUserA._id);
    assert.strictEqual(user.fitnessPoints, 100);

    // Journey 4: additional walking on same day -> 0 FP
    const j4 = await Journey.create({
      userId: testUserA._id,
      transportMode: 'WALK',
      verificationStatus: 'VERIFIED',
      distance: 1.0,
      steps: 1000,
    });
    const r4 = await rewardEngine.finalizeAndReleaseJourneyRewards(j4, testUserA._id);
    assert.strictEqual(r4.fitnessPoints, 0);
  });

  it('TEST 12: User isolation (User A rewards do not count toward User B daily limit)', async () => {
    // User A hits walking limit (10,000 steps -> 100 FP)
    const jA = await Journey.create({
      userId: testUserA._id,
      transportMode: 'WALK',
      verificationStatus: 'VERIFIED',
      distance: 5.0,
      steps: 10000,
    });
    await rewardEngine.finalizeAndReleaseJourneyRewards(jA, testUserA._id);

    // User B takes a walk on the same day -> gets full points
    const jB = await Journey.create({
      userId: testUserB._id,
      transportMode: 'WALK',
      verificationStatus: 'VERIFIED',
      distance: 2.0,
      steps: 3000,
    });
    const rB = await rewardEngine.finalizeAndReleaseJourneyRewards(jB, testUserB._id);
    assert.strictEqual(rB.fitnessPoints, 30);
    assert.strictEqual(rB.greenCredits, 10);

    const userA = await User.findById(testUserA._id);
    const userB = await User.findById(testUserB._id);
    assert.strictEqual(userA.fitnessPoints, 100);
    assert.strictEqual(userB.fitnessPoints, 30);
  });

  it('TEST 13: Direct award helper (Metro/EV/Bus direct trips)', async () => {
    const fakeJourneyId = new mongoose.Types.ObjectId();
    const directResult = await rewardEngine.awardDirectJourneyReward({
      userId: testUserA._id,
      journeyId: fakeJourneyId,
      mode: 'METRO',
      distanceKm: 6.0,
    });

    assert.strictEqual(directResult.success, true);
    assert.strictEqual(directResult.greenCredits, 30);
    assert.strictEqual(directResult.fitnessPoints, 0);

    const user = await User.findById(testUserA._id);
    assert.strictEqual(user.greenCredits, 30);
  });

  it('TEST 14: RewardTransaction creates audit fields and legacy compatibility', async () => {
    const journey = await Journey.create({
      userId: testUserA._id,
      transportMode: 'CYCLING',
      verificationStatus: 'VERIFIED',
      distance: 4.0,
    });

    await rewardEngine.finalizeAndReleaseJourneyRewards(journey, testUserA._id);

    const tx = await RewardTransaction.findOne({ journeyId: journey._id.toString() });
    assert.ok(tx);
    assert.strictEqual(tx.userId.toString(), testUserA._id.toString());
    assert.strictEqual(tx.transportMode, 'CYCLING');
    assert.strictEqual(tx.fitnessPoints, 40);
    assert.strictEqual(tx.greenCredits, 32);
    assert.strictEqual(tx.verificationStatus, 'RELEASED');
    assert.strictEqual(tx.status, 'RELEASED');
    assert.strictEqual(tx.distanceKm, 4.0);
  });

  it('TEST 15: Voucher redemption deducts points and prevents negative balance', async () => {
    // Give user 600 FP and 400 GC
    await User.findByIdAndUpdate(testUserA._id, { fitnessPoints: 600, greenCredits: 400 });

    // Seed voucher
    const fpVoucher = await Reward.create({
      title: 'Fast&Up Electrolytes',
      category: 'FITNESS',
      partner: 'Fast&Up',
      discountValue: '₹50 OFF',
      description: 'Clean hydration fuel for runners.',
      pointsRequired: 500,
      pointsType: 'FITNESS_POINTS',
      voucherCode: 'TEST500FP',
      isActive: true,
    });

    const fpVoucher2 = await Reward.create({
      title: 'Cult.fit Pass',
      category: 'FITNESS',
      partner: 'Cult.fit',
      discountValue: '₹100 OFF',
      description: 'Gym session pass.',
      pointsRequired: 500,
      pointsType: 'FITNESS_POINTS',
      voucherCode: 'TESTCULT500',
      isActive: true,
    });

    const gcVoucher = await Reward.create({
      title: 'Decathlon Bottle',
      category: 'GREEN',
      partner: 'Decathlon',
      discountValue: '₹50 OFF',
      description: 'Stainless steel reusable bottle.',
      pointsRequired: 500,
      pointsType: 'GREEN_CREDITS',
      voucherCode: 'TEST500GC',
      isActive: true,
    });

    // 1. Redeem FP voucher (needs 500, user has 600) -> should succeed
    const req1 = { user: { id: testUserA._id.toString() }, params: { rewardId: fpVoucher._id.toString() } };
    let jsonRes1;
    const res1 = {
      status: (code) => ({
        json: (data) => { jsonRes1 = { code, ...data }; return jsonRes1; }
      }),
      json: (data) => { jsonRes1 = data; return jsonRes1; }
    };
    await rewardController.redeemReward(req1, res1);
    assert.strictEqual(jsonRes1.success, true);
    assert.strictEqual(jsonRes1.updatedBalances.fitnessPoints, 100);

    // 2. Try to redeem another 500 FP voucher (user now has only 100 FP) -> should reject, no negative balance
    const req2 = { user: { id: testUserA._id.toString() }, params: { rewardId: fpVoucher2._id.toString() } };
    let jsonRes2;
    const res2 = {
      status: (code) => ({
        json: (data) => { jsonRes2 = { code, ...data }; return jsonRes2; }
      }),
      json: (data) => { jsonRes2 = data; return jsonRes2; }
    };
    await rewardController.redeemReward(req2, res2);
    assert.strictEqual(jsonRes2.success, false);
    assert.strictEqual(jsonRes2.code, 400);

    // 3. Try to redeem 500 GC voucher (user has only 400 GC) -> should reject
    const req3 = { user: { id: testUserA._id.toString() }, params: { rewardId: gcVoucher._id.toString() } };
    let jsonRes3;
    const res3 = {
      status: (code) => ({
        json: (data) => { jsonRes3 = { code, ...data }; return jsonRes3; }
      }),
      json: (data) => { jsonRes3 = data; return jsonRes3; }
    };
    await rewardController.redeemReward(req3, res3);
    assert.strictEqual(jsonRes3.success, false);
    assert.strictEqual(jsonRes3.code, 400);

    // Final balance check: FP must be 100, GC must be 400
    const finalUser = await User.findById(testUserA._id);
    assert.strictEqual(finalUser.fitnessPoints, 100);
    assert.strictEqual(finalUser.greenCredits, 400);
  });

  it('TEST 16: Past calendar day transactions do not count toward today limit', async () => {
    // Create yesterday transaction of 100 FP walking
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayJourneyId = new mongoose.Types.ObjectId();

    await RewardTransaction.create({
      userId: testUserA._id,
      journeyId: yesterdayJourneyId,
      transportMode: 'WALK',
      fitnessPoints: 100,
      greenCredits: 50,
      verificationStatus: 'RELEASED',
      timestamp: yesterday,
      createdAt: yesterday,
    });

    // Today user walks again -> should get full today allowance (up to 100 FP)
    const todayJourney = await Journey.create({
      userId: testUserA._id,
      transportMode: 'WALK',
      verificationStatus: 'VERIFIED',
      distance: 2.0,
      steps: 4000,
    });

    const result = await rewardEngine.finalizeAndReleaseJourneyRewards(todayJourney, testUserA._id);
    assert.strictEqual(result.rewardAwarded, true);
    assert.strictEqual(result.fitnessPoints, 40);
    assert.strictEqual(result.greenCredits, 10);
  });
});
