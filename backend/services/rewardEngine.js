/**
 * Authoritative Reward Engine & Daily Limit Enforcement System
 * Manages dual-economy rewards:
 *   - Fitness Points (FP): Verified physical activities (Walk, Cycle)
 *   - Green Credits (GC): Verified sustainable modes (Walk, Cycle, Public Transport, Metro, EV)
 *
 * Strict Daily Limits per Calendar Day:
 *   - WALKING: Max 100 FP/day (10,000 steps/day), Max 50 GC/day (10 km/day)
 *   - CYCLING: Max 100 FP/day, Max 80 GC/day (10 km/day)
 *   - PUBLIC TRANSPORT: Max 50 GC/day (10 km/day), No FP
 *   - METRO: Max 50 GC/day (10 km/day), No FP
 *   - EV: Max 30 GC/day (10 km/day), No FP
 *
 * Anti-Farming & Duplicate Protection:
 *   - Only VERIFIED journeys award points (UNVERIFIED / REJECTED / CANCELLED award 0).
 *   - Strict duplicate prevention per journeyId across retries, re-submissions, and refreshes.
 *   - Daily limits apply to user's cumulative points earned today; auto-resets on next calendar day.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const RewardTransaction = require('../models/RewardTransaction');

const DAILY_LIMITS = {
  WALKING: { maxFP: 100, maxGC: 50, maxSteps: 10000, maxDistanceKm: 10 },
  WALK: { maxFP: 100, maxGC: 50, maxSteps: 10000, maxDistanceKm: 10 },
  CYCLING: { maxFP: 100, maxGC: 80, maxDistanceKm: 10 },
  PUBLIC_TRANSPORT: { maxFP: 0, maxGC: 50, maxDistanceKm: 10 },
  BUS: { maxFP: 0, maxGC: 50, maxDistanceKm: 10 },
  METRO: { maxFP: 0, maxGC: 50, maxDistanceKm: 10 },
  EV: { maxFP: 0, maxGC: 30, maxDistanceKm: 10 },
};

class RewardEngine {
  constructor() {
    this.DAILY_LIMITS = DAILY_LIMITS;
  }

  /**
   * Normalize mode strings
   */
  normalizeMode(mode) {
    let norm = (mode || '').toUpperCase();
    if (norm === 'WALK') return 'WALKING';
    if (norm === 'PUBLIC_TRANSPORT') return 'BUS';
    if (norm === 'TRAIN') return 'METRO';
    return norm;
  }

  /**
   * Calculate potential rewards for a mode and metrics
   */
  calculatePotentialRewards(mode, { distanceKm = 0, steps = 0, durationMinutes = 0 } = {}) {
    const estimates = this.calculateSegmentEstimates(mode, distanceKm, durationMinutes, steps, true);
    return {
      fitnessPoints: estimates.fitnessPoints,
      greenCredits: estimates.greenCredits,
      co2AvoidedKg: estimates.co2AvoidedKg,
    };
  }

  /**
   * Calculate potential rewards for a segment according to exact rate specification
   * Rates:
   *   Walking: 10 FP per 1,000 verified steps, 5 GC per verified kilometer
   *   Cycling: 10 FP per verified kilometer, 8 GC per verified kilometer
   *   Public Transport: 5 GC per verified kilometer, 0 FP
   *   Metro: 5 GC per verified kilometer, 0 FP
   *   EV Ride: 3 GC per verified kilometer, 0 FP
   */
  calculateSegmentEstimates(mode, distanceKm, durationMinutes, verifiedWalkingSteps = 0, isEligible = true) {
    const dist = Math.max(0, Number(distanceKm) || 0);
    const dur = Math.max(0, Number(durationMinutes) || 0);
    const steps = Math.max(0, Number(verifiedWalkingSteps) || 0);

    let greenCredits = 0;
    let fitnessPoints = 0;
    let co2AvoidedKg = 0;

    const carBaselineCo2PerKm = 0.192; // kg CO2 / km for average ICE car

    if (!isEligible) {
      return { greenCredits: 0, fitnessPoints: 0, co2AvoidedKg: 0 };
    }

    const normMode = this.normalizeMode(mode);

    switch (normMode) {
      case 'WALKING':
        // 10 FP per 1,000 verified steps
        fitnessPoints = Math.floor(steps / 1000) * 10;
        // 5 GC per verified km
        greenCredits = Math.round(dist * 5);
        co2AvoidedKg = Number((dist * carBaselineCo2PerKm).toFixed(3));
        break;

      case 'CYCLING':
        // 10 FP per verified km
        fitnessPoints = Math.round(dist * 10);
        // 8 GC per verified km
        greenCredits = Math.round(dist * 8);
        co2AvoidedKg = Number((dist * carBaselineCo2PerKm).toFixed(3));
        break;

      case 'BUS':
        // 5 GC per verified km, No FP
        fitnessPoints = 0;
        greenCredits = Math.round(dist * 5);
        co2AvoidedKg = Number((dist * (carBaselineCo2PerKm - 0.05)).toFixed(3));
        break;

      case 'METRO':
        // 5 GC per verified km, No FP
        fitnessPoints = 0;
        greenCredits = Math.round(dist * 5);
        co2AvoidedKg = Number((dist * (carBaselineCo2PerKm - 0.02)).toFixed(3));
        break;

      case 'EV':
        // 3 GC per verified km, No FP
        fitnessPoints = 0;
        greenCredits = Math.round(dist * 3);
        co2AvoidedKg = Number((dist * 0.12).toFixed(3));
        break;

      case 'PETROL':
      case 'DIESEL':
      case 'CNG':
      case 'CAR':
      case 'SCOOTER':
      case 'STATIONARY':
      case 'UNKNOWN':
      default:
        // Fossil fuel / stationary / unknown earns 0 FP and 0 GC
        greenCredits = 0;
        fitnessPoints = 0;
        co2AvoidedKg = 0;
        break;
    }

    return {
      greenCredits,
      fitnessPoints,
      co2AvoidedKg,
    };
  }

  /**
   * Get user's cumulative rewards earned TODAY for a given mode or across all modes
   */
  async getTodayEarnedRewards(userId, mode = null, referenceDate = new Date()) {
    if (!userId) return { earnedFP: 0, earnedGC: 0, totalDist: 0, totalSteps: 0 };

    const startOfDay = new Date(referenceDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(referenceDate);
    endOfDay.setHours(23, 59, 59, 999);

    const filter = {
      userId,
      status: 'RELEASED',
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    };

    if (mode) {
      const normMode = this.normalizeMode(mode);
      const modeVariants = [normMode];
      if (normMode === 'WALKING') modeVariants.push('WALK');
      if (normMode === 'BUS') modeVariants.push('PUBLIC_TRANSPORT');
      if (normMode === 'METRO') modeVariants.push('TRAIN');

      filter.$or = [
        { mode: { $in: modeVariants } },
        { transportMode: { $in: modeVariants } },
      ];
    }

    const txs = await RewardTransaction.find(filter);
    let earnedFP = 0;
    let earnedGC = 0;
    let totalDist = 0;
    let totalSteps = 0;

    for (const tx of txs) {
      earnedFP += Number(tx.fitnessPoints || tx.estimatedFitnessPoints || 0);
      earnedGC += Number(tx.greenCredits || tx.estimatedGreenCredits || 0);
      totalDist += Number(tx.verifiedDistance || tx.distanceKm || 0);
      totalSteps += Number(tx.verifiedSteps || 0);
    }

    return { earnedFP, earnedGC, totalDist, totalSteps };
  }

  /**
   * Apply daily limit cap based on user's points already earned today
   * Never allows user to exceed daily maximum
   */
  async applyDailyLimits({ userId, mode, rawFP, rawGC, referenceDate = new Date() }) {
    const normMode = this.normalizeMode(mode);
    const limitConfig = DAILY_LIMITS[normMode] || { maxFP: 0, maxGC: 0 };

    if (!userId) {
      // Unauthenticated: clamp by single-day maximum
      return {
        finalFP: Math.min(rawFP, limitConfig.maxFP),
        finalGC: Math.min(rawGC, limitConfig.maxGC),
        remainingFP: Math.min(rawFP, limitConfig.maxFP),
        remainingGC: Math.min(rawGC, limitConfig.maxGC),
      };
    }

    const todayEarned = await this.getTodayEarnedRewards(userId, normMode, referenceDate);

    const remainingEligibleFP = Math.max(0, limitConfig.maxFP - todayEarned.earnedFP);
    const remainingEligibleGC = Math.max(0, limitConfig.maxGC - todayEarned.earnedGC);

    const finalFP = Math.min(rawFP, remainingEligibleFP);
    const finalGC = Math.min(rawGC, remainingEligibleGC);

    return {
      finalFP,
      finalGC,
      todayEarnedFP: todayEarned.earnedFP,
      todayEarnedGC: todayEarned.earnedGC,
      remainingEligibleFP,
      remainingEligibleGC,
      limitReached: finalFP < rawFP || finalGC < rawGC || (remainingEligibleFP === 0 && remainingEligibleGC === 0),
    };
  }

  /**
   * Verify and Lock Segment Rewards (Status: PENDING -> VERIFIED / HELD)
   * Used during real-time tracking / segment completion before final release
   */
  async lockSegmentRewards({
    journeyId,
    segmentId,
    userId,
    mode,
    distanceKm,
    durationMinutes,
    confidence,
    fraudScore,
    verifiedWalkingSteps = 0,
    greenCreditEligible = true,
  }) {
    const estimates = this.calculateSegmentEstimates(
      mode,
      distanceKm,
      durationMinutes,
      verifiedWalkingSteps,
      greenCreditEligible
    );

    let status = 'PENDING';
    let notes = 'Pending final trip verification';

    if (fraudScore > 50) {
      status = 'HELD';
      notes = `Held due to fraud risk score: ${fraudScore}/100`;
    } else if (confidence >= 0.75 && greenCreditEligible) {
      status = 'VERIFIED';
      notes = `AI Verified with ${Math.round(confidence * 100)}% confidence`;
    } else if (!greenCreditEligible) {
      status = 'REJECTED';
      notes = 'Ineligible transport mode or fuel type';
    }

    const normMode = this.normalizeMode(mode);

    // Upsert RewardTransaction safely
    let tx = null;
    try {
      tx = await RewardTransaction.findOne({ journeyId, segmentId });
      if (!tx) {
        tx = await RewardTransaction.create({
          journeyId,
          segmentId,
          userId: userId || null,
          transportMode: normMode,
          mode: normMode,
          verifiedDistance: distanceKm || 0,
          distanceKm: distanceKm || 0,
          durationMinutes: durationMinutes || 0,
          verifiedSteps: verifiedWalkingSteps || 0,
          fitnessPoints: estimates.fitnessPoints,
          greenCredits: estimates.greenCredits,
          estimatedGreenCredits: estimates.greenCredits,
          estimatedFitnessPoints: estimates.fitnessPoints,
          confidenceScore: confidence,
          fraudScore: fraudScore || 0,
          verificationStatus: status,
          status,
          verificationNotes: notes,
          timestamp: new Date(),
        });
      } else {
        tx.verifiedDistance = distanceKm || 0;
        tx.distanceKm = distanceKm || 0;
        tx.durationMinutes = durationMinutes || 0;
        tx.verifiedSteps = verifiedWalkingSteps || 0;
        tx.fitnessPoints = estimates.fitnessPoints;
        tx.greenCredits = estimates.greenCredits;
        tx.estimatedGreenCredits = estimates.greenCredits;
        tx.estimatedFitnessPoints = estimates.fitnessPoints;
        tx.confidenceScore = confidence;
        tx.fraudScore = fraudScore || 0;
        tx.verificationStatus = status;
        tx.status = status;
        tx.verificationNotes = notes;
        await tx.save();
      }
    } catch (txErr) {
      console.warn('[RewardEngine.lockSegmentRewards] Warning:', txErr.message);
    }

    return {
      rewardStatus: status,
      earnedGreenCredits: status === 'VERIFIED' ? estimates.greenCredits : 0,
      earnedFitnessPoints: status === 'VERIFIED' ? estimates.fitnessPoints : 0,
      co2AvoidedKg: estimates.co2AvoidedKg,
      transaction: tx,
    };
  }

  /**
   * Finalize and release all verified rewards upon journey completion (VERIFIED -> RELEASED)
   * Enforces:
   *   1. DUPLICATE CHECK: Journey must never award points more than once.
   *   2. DAILY LIMITS: Applies mode-specific daily limits against user's points already earned today.
   *   3. VERIFICATION REQUIREMENT: Only VERIFIED journeys award points.
   *   4. USER SPECIFIC: Atomically updates user's FP and GC balance in MongoDB.
   */
  async finalizeAndReleaseJourneyRewards(journeyOrId, userId, referenceDate = new Date()) {
    if (!journeyOrId) {
      return {
        rewardAwarded: false,
        fitnessPoints: 0,
        greenCredits: 0,
        releasedCredits: 0,
        releasedPoints: 0,
        alreadyClaimed: false,
      };
    }

    const Journey = require('../models/Journey');
    let journey = null;
    let journeyId = null;

    if (journeyOrId._id) {
      journey = journeyOrId;
      journeyId = journeyOrId._id;
    } else {
      journeyId = journeyOrId;
      journey = await Journey.findById(journeyId);
    }

    if (!journey) {
      return {
        rewardAwarded: false,
        fitnessPoints: 0,
        greenCredits: 0,
        releasedCredits: 0,
        releasedPoints: 0,
      };
    }

    // 1. DUPLICATE REWARD CHECK
    if (journey.rewardClaimed) {
      return {
        rewardAwarded: false,
        duplicate: true,
        fitnessPoints: 0,
        greenCredits: 0,
        releasedCredits: 0,
        releasedPoints: 0,
        releasedCombinedPoints: 0,
        alreadyClaimed: true,
        message: 'Rewards for this journey have already been claimed.',
      };
    }

    const existingReleased = await RewardTransaction.findOne({
      journeyId,
      status: 'RELEASED',
    });
    if (existingReleased) {
      journey.rewardClaimed = true;
      journey.rewardClaimedAt = journey.rewardClaimedAt || new Date();
      await journey.save();
      return {
        rewardAwarded: false,
        duplicate: true,
        fitnessPoints: 0,
        greenCredits: 0,
        releasedCredits: 0,
        releasedPoints: 0,
        releasedCombinedPoints: 0,
        alreadyClaimed: true,
        message: 'Reward transaction already exists for this journey.',
      };
    }

    // 2. VERIFICATION REQUIREMENT
    const isSuspicious =
      (journey.overallFraudScore || 0) > 50 ||
      journey.overallVerificationStatus === 'REJECTED' ||
      journey.overallVerificationStatus === 'HELD' ||
      journey.verificationStatus === 'REJECTED' ||
      journey.verificationStatus === 'HELD' ||
      journey.verificationStatus === 'TRACKING';

    if (isSuspicious) {
      // Create rejected / unverified audit transaction with 0 points
      const normMode = this.normalizeMode(journey.verifiedMode || journey.currentMode || 'UNKNOWN');
      await RewardTransaction.create({
        journeyId: journey._id,
        segmentId: `${journey._id}_unverified`,
        userId: userId || journey.userId || null,
        transportMode: normMode,
        mode: normMode,
        verifiedDistance: journey.totalDistanceKm || 0,
        distanceKm: journey.totalDistanceKm || 0,
        verifiedSteps: journey.verifiedWalkingSteps || 0,
        fitnessPoints: 0,
        greenCredits: 0,
        estimatedFitnessPoints: 0,
        estimatedGreenCredits: 0,
        verificationStatus: 'REJECTED',
        status: 'REJECTED',
        durationMinutes: journey.totalDurationMinutes || 0,
        co2SavedKg: 0,
        confidenceScore: journey.currentConfidence || 0,
        fraudScore: journey.overallFraudScore || 0,
        verificationNotes: 'Unverified or rejected journey — 0 points awarded',
        timestamp: new Date(),
      });

      journey.rewardClaimed = true;
      journey.rewardClaimedAt = new Date();
      journey.totalFitnessPoints = 0;
      journey.totalGreenCredits = 0;
      journey.totalCombinedPoints = 0;
      await journey.save();

      return {
        rewardAwarded: false,
        fitnessPoints: 0,
        greenCredits: 0,
        releasedCredits: 0,
        releasedPoints: 0,
        releasedCombinedPoints: 0,
        verificationFailed: true,
      };
    }

    // 3. CALCULATE AND APPLY DAILY LIMITS ACROSS VERIFIED SEGMENTS
    let segments = journey.segments || [];
    if (segments.length === 0) {
      const modeCandidate = journey.transportMode || journey.verifiedMode;
      const effectiveMode = (modeCandidate && modeCandidate !== 'STATIONARY')
        ? modeCandidate
        : (journey.currentMode !== 'STATIONARY' ? journey.currentMode : (journey.plannedMode || 'WALK'));
      segments = [
        {
          segmentIndex: 0,
          mode: effectiveMode,
          distanceKm: journey.totalDistanceKm || journey.distance || 0,
          durationMinutes: journey.totalDurationMinutes || 0,
          verifiedSteps: journey.verifiedWalkingSteps || journey.steps || 0,
          verificationStatus: 'VERIFIED',
          greenCreditEligible: true,
        },
      ];
    }

    let totalReleasedCredits = 0;
    let totalReleasedPoints = 0;
    let totalCo2Saved = 0;
    const effectiveUserId = userId || journey.userId;

    for (const seg of segments) {
      const segVerified = seg.verificationStatus === 'VERIFIED' && (seg.fraudScore || 0) <= 50;
      if (!segVerified) continue;

      const normMode = this.normalizeMode(seg.mode || journey.verifiedMode);

      const estimates = this.calculateSegmentEstimates(
        normMode,
        seg.distanceKm || 0,
        seg.durationMinutes || 0,
        seg.verifiedSteps || 0,
        seg.greenCreditEligible !== false
      );

      // Apply daily limit considering points already released today
      const limitResult = await this.applyDailyLimits({
        userId: effectiveUserId,
        mode: normMode,
        rawFP: estimates.fitnessPoints,
        rawGC: estimates.greenCredits,
        referenceDate,
      });

      const awardedFP = limitResult.finalFP;
      const awardedGC = limitResult.finalGC;

      totalReleasedPoints += awardedFP;
      totalReleasedCredits += awardedGC;
      totalCo2Saved += estimates.co2AvoidedKg;

      seg.earnedFitnessPoints = awardedFP;
      seg.earnedGreenCredits = awardedGC;
      seg.earnedCombinedPoints = awardedFP + awardedGC;
      seg.rewardStatus = 'RELEASED';
      seg.verificationStatus = 'VERIFIED';

      // Save RewardTransaction audit record
      const segId = `${journey._id}_seg_${seg.segmentIndex ?? 0}`;
      await RewardTransaction.findOneAndUpdate(
        { journeyId: journey._id, segmentId: segId },
        {
          journeyId: journey._id,
          segmentId: segId,
          userId: effectiveUserId || null,
          transportMode: normMode,
          mode: normMode,
          verifiedDistance: seg.distanceKm || 0,
          distanceKm: seg.distanceKm || 0,
          verifiedSteps: seg.verifiedSteps || 0,
          fitnessPoints: awardedFP,
          greenCredits: awardedGC,
          estimatedFitnessPoints: awardedFP,
          estimatedGreenCredits: awardedGC,
          verificationStatus: 'RELEASED',
          status: 'RELEASED',
          durationMinutes: seg.durationMinutes || 0,
          co2SavedKg: estimates.co2AvoidedKg,
          confidenceScore: seg.confidence || 0.95,
          fraudScore: seg.fraudScore || 0,
          verificationNotes: `Verified ${normMode}. Awarded: +${awardedFP} FP, +${awardedGC} GC`,
          releasedAt: new Date(),
          timestamp: new Date(),
        },
        { upsert: true, new: true }
      );
    }

    // 4. MARK JOURNEY AS REWARD CLAIMED (Prevents any future duplication)
    journey.rewardClaimed = true;
    journey.rewardClaimedAt = new Date();
    journey.totalFitnessPoints = totalReleasedPoints;
    journey.totalGreenCredits = totalReleasedCredits;
    journey.totalCombinedPoints = totalReleasedPoints + totalReleasedCredits;
    journey.overallVerificationStatus = 'VERIFIED';
    if (typeof journey.markModified === 'function') {
      journey.markModified('segments');
    }
    if (typeof journey.save === 'function') {
      await journey.save();
    }

    // 5. UPDATE USER POINTS BALANCE IN MONGODB
    if (effectiveUserId && (totalReleasedPoints > 0 || totalReleasedCredits > 0)) {
      await User.findByIdAndUpdate(effectiveUserId, {
        $inc: {
          fitnessPoints: totalReleasedPoints,
          greenCredits: totalReleasedCredits,
          totalDistanceKm: Number((journey.totalDistanceKm || 0).toFixed(2)),
          totalCo2SavedKg: Number((totalCo2Saved || journey.totalCo2AvoidedKg || 0).toFixed(3)),
        },
      });
    }

    return {
      rewardAwarded: totalReleasedPoints > 0 || totalReleasedCredits > 0,
      fitnessPoints: totalReleasedPoints,
      greenCredits: totalReleasedCredits,
      releasedCredits: totalReleasedCredits,
      releasedPoints: totalReleasedPoints,
      releasedCombinedPoints: totalReleasedPoints + totalReleasedCredits,
    };
  }

  /**
   * Direct authoritative journey reward awarding for non-segmented single flows (e.g. Metro, quick record)
   */
  async awardDirectJourneyReward({
    journeyId,
    userId,
    mode,
    distanceKm,
    durationMinutes = 0,
    verifiedSteps = 0,
    isVerified = true,
    confidence = 0.95,
    fraudScore = 0,
    referenceDate = new Date(),
  }) {
    const Journey = require('../models/Journey');
    let journey = null;
    if (journeyId && mongoose.Types.ObjectId.isValid(journeyId)) {
      journey = await Journey.findById(journeyId);
      if (journey && journey.rewardClaimed) {
        return {
          rewardedFP: 0,
          rewardedGC: 0,
          alreadyClaimed: true,
          message: 'Journey already rewarded.',
        };
      }
    }

    // Check existing transaction for duplicate protection
    if (journeyId) {
      const existing = await RewardTransaction.findOne({ journeyId, status: 'RELEASED' });
      if (existing) {
        if (journey) {
          journey.rewardClaimed = true;
          journey.rewardClaimedAt = journey.rewardClaimedAt || new Date();
          await journey.save();
        }
        return {
          rewardedFP: 0,
          rewardedGC: 0,
          alreadyClaimed: true,
          message: 'Transaction already released for this journey.',
        };
      }
    }

    const normMode = this.normalizeMode(mode);

    // If journey verification failed: award 0 points
    if (!isVerified || fraudScore > 50) {
      if (journeyId) {
        await RewardTransaction.create({
          journeyId,
          segmentId: `${journeyId}_direct`,
          userId: userId || null,
          transportMode: normMode,
          mode: normMode,
          verifiedDistance: distanceKm || 0,
          distanceKm: distanceKm || 0,
          verifiedSteps: verifiedSteps || 0,
          fitnessPoints: 0,
          greenCredits: 0,
          estimatedFitnessPoints: 0,
          estimatedGreenCredits: 0,
          verificationStatus: 'REJECTED',
          status: 'REJECTED',
          durationMinutes,
          co2SavedKg: 0,
          confidenceScore: confidence,
          fraudScore,
          verificationNotes: 'Unverified journey — 0 points awarded',
          timestamp: new Date(),
        });

        if (journey) {
          journey.rewardClaimed = true;
          journey.rewardClaimedAt = new Date();
          journey.totalFitnessPoints = 0;
          journey.totalGreenCredits = 0;
          journey.totalCombinedPoints = 0;
          await journey.save();
        }
      }

      return {
        rewardedFP: 0,
        rewardedGC: 0,
        verificationFailed: true,
      };
    }

    // Calculate raw reward rates
    const rawEstimates = this.calculateSegmentEstimates(
      normMode,
      distanceKm,
      durationMinutes,
      verifiedSteps,
      true
    );

    // Apply mode-specific daily limits against user's today's earned points
    const limitResult = await this.applyDailyLimits({
      userId,
      mode: normMode,
      rawFP: rawEstimates.fitnessPoints,
      rawGC: rawEstimates.greenCredits,
      referenceDate,
    });

    const finalFP = limitResult.finalFP;
    const finalGC = limitResult.finalGC;

    // Create RewardTransaction record
    if (journeyId) {
      await RewardTransaction.create({
        journeyId,
        segmentId: `${journeyId}_direct`,
        userId: userId || null,
        transportMode: normMode,
        mode: normMode,
        verifiedDistance: distanceKm || 0,
        distanceKm: distanceKm || 0,
        verifiedSteps: verifiedSteps || 0,
        fitnessPoints: finalFP,
        greenCredits: finalGC,
        estimatedFitnessPoints: finalFP,
        estimatedGreenCredits: finalGC,
        verificationStatus: 'VERIFIED',
        status: 'RELEASED',
        durationMinutes,
        co2SavedKg: rawEstimates.co2AvoidedKg,
        confidenceScore: confidence,
        fraudScore,
        verificationNotes: `Verified ${normMode}. Awarded: +${finalFP} FP, +${finalGC} GC`,
        releasedAt: new Date(),
        timestamp: new Date(),
      });

      if (journey) {
        journey.rewardClaimed = true;
        journey.rewardClaimedAt = new Date();
        journey.totalFitnessPoints = finalFP;
        journey.totalGreenCredits = finalGC;
        journey.totalCombinedPoints = finalFP + finalGC;
        journey.overallVerificationStatus = 'VERIFIED';
        await journey.save();
      }
    }

    // Atomically increment user balance in MongoDB
    if (userId && (finalFP > 0 || finalGC > 0)) {
      await User.findByIdAndUpdate(userId, {
        $inc: {
          fitnessPoints: finalFP,
          greenCredits: finalGC,
          totalDistanceKm: Number((distanceKm || 0).toFixed(2)),
          totalCo2SavedKg: Number((rawEstimates.co2AvoidedKg || 0).toFixed(3)),
          totalActiveMinutes: durationMinutes || 0,
        },
      });
    }

    return {
      success: true,
      fitnessPoints: finalFP,
      greenCredits: finalGC,
      rewardedFP: finalFP,
      rewardedGC: finalGC,
      co2AvoidedKg: rawEstimates.co2AvoidedKg,
      limitReached: limitResult.limitReached,
    };
  }

  /**
   * Aggregate all verified segments of a journey
   */
  calculateJourneyTotals(journey) {
    const segments = journey.segments || [];

    let totalGreenCredits = 0;
    let totalFitnessPoints = 0;
    let totalDistanceKm = 0;
    let totalDurationMinutes = 0;
    let totalCO2Saved = 0;
    let totalVerifiedSteps = 0;
    let verifiedCount = 0;

    for (const seg of segments) {
      totalDistanceKm += Number(seg.distanceKm || 0);
      totalDurationMinutes += Number(seg.durationMinutes || 0);

      const isVerified =
        seg.verificationStatus === 'VERIFIED' &&
        seg.greenCreditEligible !== false &&
        (seg.fraudScore || 0) <= 50;

      if (isVerified) {
        verifiedCount++;
        totalGreenCredits += Number(seg.earnedGreenCredits || 0);
        totalFitnessPoints += Number(seg.earnedFitnessPoints || 0);
        totalCO2Saved += Number(seg.co2SavedKg || seg.distanceKm * 0.192 || 0);
        if (seg.mode === 'WALK' || seg.mode === 'WALKING') {
          totalVerifiedSteps += Number(seg.verifiedSteps || 0);
        }
      }
    }

    const totalCombinedPoints = totalFitnessPoints + totalGreenCredits;

    let overallVerificationStatus = 'PENDING';
    if (segments.length === 0) {
      overallVerificationStatus = 'PENDING';
    } else if (verifiedCount === segments.length) {
      overallVerificationStatus = 'VERIFIED';
    } else if (verifiedCount > 0) {
      overallVerificationStatus = 'PARTIALLY_VERIFIED';
    } else {
      overallVerificationStatus = 'REJECTED';
    }

    return {
      totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
      totalDurationMinutes: Number(totalDurationMinutes.toFixed(1)),
      totalGreenCredits,
      totalFitnessPoints,
      totalCombinedPoints,
      totalCO2Saved: Number(totalCO2Saved.toFixed(3)),
      totalVerifiedSteps,
      overallVerificationStatus,
      segmentsCount: segments.length,
      verifiedSegmentsCount: verifiedCount,
    };
  }
}

module.exports = new RewardEngine();


