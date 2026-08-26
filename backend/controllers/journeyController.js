const Journey = require('../models/Journey');
const User = require('../models/User');
const aiModeDetectionService = require('../services/aiModeDetectionService');

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

    // 2. Dual Points & CO2 Avoided Calculation
    const impact = aiModeDetectionService.calculateImpact(classification.mode, dist, dur);

    // 3. Save Journey Record
    const journey = await Journey.create({
      userId: req.user._id,
      mode: classification.mode,
      originName: originName || 'Current Location',
      destinationName: destinationName || 'Destination Point',
      distanceKm: dist,
      durationMinutes: dur,
      averageSpeedKmh: Number(speed.toFixed(1)),
      maxSpeedKmh: Number(maxSpeed.toFixed(1)),
      caloriesBurned: impact.caloriesBurned,
      fitnessPointsEarned: impact.fitnessPoints,
      greenCreditsEarned: impact.greenCredits,
      co2AvoidedKg: impact.co2AvoidedKg,
      verificationStatus: classification.isVerified ? 'VERIFIED' : 'PENDING',
      confidenceScore: classification.confidence,
      detectionReasoning: classification.reasoning,
      routeWaypoints: routeWaypoints || [],
    });

    // 4. Update User Balances
    const user = await User.findById(req.user._id);
    if (user) {
      user.fitnessPoints = (user.fitnessPoints || 0) + impact.fitnessPoints;
      user.greenCredits = (user.greenCredits || 0) + impact.greenCredits;
      user.totalCo2SavedKg = Number(((user.totalCo2SavedKg || 0) + impact.co2AvoidedKg).toFixed(2));
      user.totalDistanceKm = Number(((user.totalDistanceKm || 0) + dist).toFixed(1));
      user.totalActiveMinutes = (user.totalActiveMinutes || 0) + dur;
      await user.save();
    }

    return res.status(201).json({
      success: true,
      message: 'Journey successfully verified by AI engine and points credited!',
      journey,
      updatedUser: {
        fitnessPoints: user ? user.fitnessPoints : 0,
        greenCredits: user ? user.greenCredits : 0,
        totalCo2SavedKg: user ? user.totalCo2SavedKg : 0,
      },
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
