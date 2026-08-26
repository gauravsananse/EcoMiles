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
  calculateSegmentEstimates(mode, distanceKm, durationMinutes) {
    const dist = Math.max(0, distanceKm || 0);
    const dur = Math.max(0, durationMinutes || 0);

    let greenCredits = 0;
    let fitnessPoints = 0;
    let co2AvoidedKg = 0;

    const carBaselineCo2PerKm = 0.192; // kg CO2 / km for average ICE car

    switch (mode) {
      case 'WALKING':
        greenCredits = Math.round(dist * 10);
        fitnessPoints = Math.round(dist * 15 + dur * 0.5);
        co2AvoidedKg = Number((dist * carBaselineCo2PerKm).toFixed(3));
        break;

      case 'CYCLING':
        greenCredits = Math.round(dist * 12);
        fitnessPoints = Math.round(dist * 10 + dur * 0.8);
        co2AvoidedKg = Number((dist * carBaselineCo2PerKm).toFixed(3));
        break;

      case 'BUS':
        greenCredits = Math.round(dist * 6);
        fitnessPoints = 0; // Public transit does not award human fitness points
        co2AvoidedKg = Number((dist * (carBaselineCo2PerKm - 0.05)).toFixed(3));
        break;

      case 'METRO':
        greenCredits = Math.round(dist * 8);
        fitnessPoints = 0;
        co2AvoidedKg = Number((dist * (carBaselineCo2PerKm - 0.02)).toFixed(3));
        break;

      case 'EV':
        greenCredits = Math.round(dist * 5);
        fitnessPoints = 0;
        co2AvoidedKg = Number((dist * 0.12).toFixed(3));
        break;

      case 'CAR':
      case 'SCOOTER':
      case 'STATIONARY':
      default:
        // Private motor vehicle / scooter / stationary earns ZERO credits
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
  async lockSegmentRewards({ journeyId, segmentId, userId, mode, distanceKm, durationMinutes, confidence, fraudScore }) {
    const estimates = this.calculateSegmentEstimates(mode, distanceKm, durationMinutes);

    let status = 'PENDING';
    let notes = 'Pending final trip verification';

    if (fraudScore > 50) {
      status = 'HELD';
      notes = `Held due to fraud risk score: ${fraudScore}/100`;
    } else if (confidence >= 0.75) {
      status = 'VERIFIED';
      notes = `AI Verified with ${Math.round(confidence * 100)}% confidence`;
    }

    // Upsert RewardTransaction
    let tx = await RewardTransaction.findOne({ journeyId, segmentId });
    if (!tx && userId) {
      tx = await RewardTransaction.create({
        journeyId,
        segmentId,
        userId,
        mode,
        distanceKm,
        durationMinutes,
        estimatedGreenCredits: estimates.greenCredits,
        estimatedFitnessPoints: estimates.fitnessPoints,
        confidenceScore: confidence,
        fraudScore,
        status,
        verificationNotes: notes,
      });
    } else if (tx) {
      tx.distanceKm = distanceKm;
      tx.durationMinutes = durationMinutes;
      tx.estimatedGreenCredits = estimates.greenCredits;
      tx.estimatedFitnessPoints = estimates.fitnessPoints;
      tx.confidenceScore = confidence;
      tx.fraudScore = fraudScore;
      tx.status = status;
      tx.verificationNotes = notes;
      await tx.save();
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
    };
  }
}

module.exports = new RewardEngine();
