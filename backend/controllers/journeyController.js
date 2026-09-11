const Journey = require('../models/Journey');
const User = require('../models/User');
const aiModeDetectionService = require('../services/aiModeDetectionService');
const rewardEngine = require('../services/rewardEngine');

// @desc    Record and verify a completed journey
// @route   POST /api/journeys/record
// @access  Private
exports.recordJourney = async (req, res) => {
  try {
    const {
      originName,
      destinationName,
      distanceKm,
      durationMinutes,
      avgSpeedKmh,
      maxSpeedKmh,
      cadenceStepsPerMin,
      accelerationVariance,
      routeWaypoints,
      verifiedWalkingSteps,
    } = req.body;

    const dist = Number(distanceKm) || 3.2;
    const dur = Number(durationMinutes) || 18;
    const speed = Number(avgSpeedKmh) || (dist / (dur / 60));
    const maxSpeed = Number(maxSpeedKmh) || (speed * 1.4);

    // 1. AI Transport Mode Classification
    const classification = aiModeDetectionService.classifyTelemetry({
      avgSpeedKmh: speed,
      maxSpeedKmh: maxSpeed,
      cadenceStepsPerMin: Number(cadenceStepsPerMin) || 0,
      accelerationVariance: Number(accelerationVariance) || 0.4,
      stopsCount: routeWaypoints?.length > 4 ? 2 : 0,
    });

    const isVerified = Boolean(classification.isVerified);
    const steps = Number(verifiedWalkingSteps) || (classification.mode === 'WALKING' ? Math.round(Number(cadenceStepsPerMin || 110) * dur) : 0);

    // 2. Save Journey Record
    const journey = await Journey.create({
      userId: req.user._id,
      mode: classification.mode,
      originName: originName || 'Current Location',
      destinationName: destinationName || 'Destination Point',
      distanceKm: dist,
      durationMinutes: dur,
      averageSpeedKmh: Number(speed.toFixed(1)),
      maxSpeedKmh: Number(maxSpeed.toFixed(1)),
      caloriesBurned: Math.round(dur * 3.5),
      fitnessPointsEarned: 0,
      greenCreditsEarned: 0,
      co2AvoidedKg: 0,
      verificationStatus: isVerified ? 'VERIFIED' : 'PENDING',
      overallVerificationStatus: isVerified ? 'VERIFIED' : 'PENDING',
      confidenceScore: classification.confidence,
      detectionReasoning: classification.reasoning,
      routeWaypoints: routeWaypoints || [],
    });

    // 3. Award Authoritative Rewards via centralized Reward Engine
    let rewardResult = { rewardedFP: 0, rewardedGC: 0, co2AvoidedKg: 0 };
    if (isVerified) {
      rewardResult = await rewardEngine.awardDirectJourneyReward({
        journeyId: journey._id,
        userId: req.user._id,
        mode: classification.mode,
        distanceKm: dist,
        durationMinutes: dur,
        verifiedSteps: steps,
        isVerified: true,
        confidence: classification.confidence,
      });

      journey.fitnessPointsEarned = rewardResult.rewardedFP;
      journey.greenCreditsEarned = rewardResult.rewardedGC;
      journey.co2AvoidedKg = rewardResult.co2AvoidedKg;
      await journey.save();
    }

    const updatedUser = await User.findById(req.user._id);

    return res.status(201).json({
      success: true,
      message: isVerified
        ? 'Journey successfully verified by AI engine and points credited!'
        : 'Journey recorded as unverified — 0 points awarded.',
      journey,
      updatedUser: updatedUser ? {
        fitnessPoints: updatedUser.fitnessPoints,
        greenCredits: updatedUser.greenCredits,
        totalCo2SavedKg: updatedUser.totalCo2SavedKg,
      } : null,
    });
  } catch (error) {
    console.error('[JourneyController.recordJourney] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to record journey.',
    });
  }
};

// @desc    Get user's journey history
// @route   GET /api/journeys/history
// @access  Private
exports.getJourneyHistory = async (req, res) => {
  try {
    const journeys = await Journey.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);

    return res.status(200).json({
      success: true,
      count: journeys.length,
      journeys,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch journey history.',
    });
  }
};
