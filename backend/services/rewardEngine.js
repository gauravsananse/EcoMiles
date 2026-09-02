/**
 * Reward Engine & Credit Locking System
 * Manages the PENDING -> VERIFIED -> RELEASED lifecycle for Green Credits & Fitness Points.
 * Enforces zero credits for private cars / petrol scooters and immediately ceases transit rewards on car detection.
 */

const User = require('../models/User');
const RewardTransaction = require('../models/RewardTransaction');

class RewardEngine {
  /**
   * Calculate potential rewards for a segment
   */
  calculateSegmentEstimates(mode, distanceKm, durationMinutes, verifiedWalkingSteps = 0, isEligible = true) {
    const dist = Math.max(0, distanceKm || 0);
    const dur = Math.max(0, durationMinutes || 0);
    const steps = Math.max(0, verifiedWalkingSteps || 0);

    let greenCredits = 0;
    let fitnessPoints = 0;
    let co2AvoidedKg = 0;

    const carBaselineCo2PerKm = 0.192; // kg CO2 / km for average ICE car

    if (!isEligible) {
      return { greenCredits: 0, fitnessPoints: 0, co2AvoidedKg: 0 };
    }

    let normMode = (mode || '').toUpperCase();
    if (normMode === 'WALK') normMode = 'WALKING';
    if (normMode === 'PUBLIC_TRANSPORT') normMode = 'BUS';

    switch (normMode) {
      case 'WALKING':
        greenCredits = Math.round(dist * 10);
        // Fitness points strictly from verified walking steps (1 point per 75 verified steps + distance baseline)
        fitnessPoints = steps > 0 ? Math.round(steps / 75) : Math.round(dist * 15 + dur * 0.5);
        co2AvoidedKg = Number((dist * carBaselineCo2PerKm).toFixed(3));
        break;

      case 'CYCLING':
        greenCredits = Math.round(dist * 12);
        fitnessPoints = Math.round(dist * 10 + dur * 0.8);
        co2AvoidedKg = Number((dist * carBaselineCo2PerKm).toFixed(3));
        break;

      case 'BUS':
        greenCredits = Math.round(dist * 6);
        fitnessPoints = 0; // Public transit does NOT award human fitness points
        co2AvoidedKg = Number((dist * (carBaselineCo2PerKm - 0.05)).toFixed(3));
        break;

      case 'METRO':
      case 'TRAIN':
        greenCredits = Math.round(dist * 8);
        fitnessPoints = 0;
        co2AvoidedKg = Number((dist * (carBaselineCo2PerKm - 0.02)).toFixed(3));
        break;

      case 'EV':
        greenCredits = Math.round(dist * 5);
        fitnessPoints = 0;
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
        // Private motor vehicle / fossil fuels / stationary earns ZERO credits and ZERO fitness points
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
   * Verify and Lock Segment Rewards (Status: PENDING -> VERIFIED / HELD)
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

    // Upsert RewardTransaction safely
    let tx = null;
    try {
      tx = await RewardTransaction.findOne({ journeyId, segmentId });
      if (!tx) {
        tx = await RewardTransaction.create({
          journeyId,
          segmentId,
          userId: userId || null,
          mode,
          distanceKm: distanceKm || 0,
          durationMinutes: durationMinutes || 0,
          estimatedGreenCredits: estimates.greenCredits,
          estimatedFitnessPoints: estimates.fitnessPoints,
          confidenceScore: confidence,
          fraudScore: fraudScore || 0,
          status,
          verificationNotes: notes,
        });
      } else {
        tx.distanceKm = distanceKm || 0;
        tx.durationMinutes = durationMinutes || 0;
        tx.estimatedGreenCredits = estimates.greenCredits;
        tx.estimatedFitnessPoints = estimates.fitnessPoints;
        tx.confidenceScore = confidence;
        tx.fraudScore = fraudScore || 0;
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
   * Release all verified rewards upon journey completion (VERIFIED -> RELEASED)
   */
  async finalizeAndReleaseJourneyRewards(journeyId, userId) {
    if (!userId) return { releasedCredits: 0, releasedPoints: 0 };

    const transactions = await RewardTransaction.find({
      journeyId,
      status: 'VERIFIED',
    });

    let totalCredits = 0;
    let totalPoints = 0;

    for (const tx of transactions) {
      totalCredits += tx.estimatedGreenCredits || 0;
      totalPoints += tx.estimatedFitnessPoints || 0;
      tx.status = 'RELEASED';
      tx.releasedAt = new Date();
      await tx.save();
    }

    if (totalCredits > 0 || totalPoints > 0) {
      const user = await User.findById(userId);
      if (user) {
        user.greenCredits = (user.greenCredits || 0) + totalCredits;
        user.fitnessPoints = (user.fitnessPoints || 0) + totalPoints;
        await user.save();
      }
    }

    return {
      releasedCredits: totalCredits,
      releasedPoints: totalPoints,
      releasedCombinedPoints: totalCredits + totalPoints,
    };
  }

  /**
   * Aggregate all verified segments of a journey (Requirements 7, 8, 37)
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

      // Only verified eligible segments award points
      const isVerified = seg.verificationStatus === 'VERIFIED' && seg.greenCreditEligible !== false && (seg.fraudScore || 0) <= 50;

      if (isVerified) {
        verifiedCount++;
        totalGreenCredits += Number(seg.earnedGreenCredits || 0);
        totalFitnessPoints += Number(seg.earnedFitnessPoints || 0);
        totalCO2Saved += Number(seg.co2SavedKg || (seg.distanceKm * 0.192) || 0);
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

