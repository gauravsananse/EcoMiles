const Journey = require('../models/Journey');
const SensorWindow = require('../models/SensorWindow');
const User = require('../models/User');
const sensorFusionService = require('../services/sensorFusionService');
const fraudDetectionService = require('../services/fraudDetectionService');
const rewardEngine = require('../services/rewardEngine');
const publicTransportVerification = require('../services/publicTransportVerification');

/**
 * Start a new multimodal mobility journey
 * POST /api/journey/start
 */
exports.startJourney = async (req, res) => {
  try {
    const { isReplayData = false, initialLocation = null, sensorAvailability = {} } = req.body;
    const userId = req.user ? req.user._id : null;
    const anonymousSessionId = req.headers['x-session-id'] || `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create journey record
    const journey = await Journey.create({
      userId,
      anonymousSessionId,
      status: 'ACTIVE',
      currentMode: 'STATIONARY',
      currentConfidence: 0.95,
      overallFraudScore: 0,
      isReplayData: Boolean(isReplayData),
      startTime: new Date(),
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      totalGreenCredits: 0,
      totalFitnessPoints: 0,
      totalCo2AvoidedKg: 0,
      sensorAvailability: {
        gps: sensorAvailability.gps ?? true,
        accelerometer: sensorAvailability.accelerometer ?? false,
        gyroscope: sensorAvailability.gyroscope ?? false,
        bluetooth: sensorAvailability.bluetooth ?? false,
        activityRecognition: sensorAvailability.activityRecognition ?? false,
      },
      segments: [
        {
          segmentIndex: 0,
          mode: 'STATIONARY',
          startTime: new Date(),
          distanceKm: 0,
          durationMinutes: 0,
          confidence: 0.95,
          fraudScore: 0,
          verificationStatus: 'VERIFIED',
          rewardStatus: 'PENDING',
          sensorEvidence: ['Journey initiated in stationary state.'],
          waypoints: initialLocation ? [{
            lat: initialLocation.lat,
            lng: initialLocation.lng,
            speedKmh: 0,
            accuracy: initialLocation.accuracy || 5,
            timestamp: new Date(),
          }] : [],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: 'Journey started successfully',
      journeyId: journey._id,
      journey,
    });
  } catch (error) {
    console.error('[JourneyVerificationController.startJourney] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to start journey' });
  }
};

/**
 * Ingest sensor data window & execute continuous AI multimodal classification
 * POST /api/journey/sensor-data
 */
exports.processSensorData = async (req, res) => {
  try {
    const { journeyId, sensorWindow } = req.body;
    if (!journeyId || !sensorWindow) {
      return res.status(400).json({ success: false, error: 'journeyId and sensorWindow are required' });
    }

    const journey = await Journey.findById(journeyId);
    if (!journey || journey.status === 'COMPLETED') {
      return res.status(404).json({ success: false, error: 'Active journey not found' });
    }

    // 1. Run Sensor Fusion Classifier
    const classification = sensorFusionService.classifyWindow(sensorWindow, journeyId.toString());

    // 2. Run Anti-Fraud Engine
    const fraudResult = await fraudDetectionService.evaluateWindow(sensorWindow, classification, journey);

    // 3. Public Transport Verification check
    const transitCheck = await publicTransportVerification.verifyTransitEvidence({
      latitude: sensorWindow.latitude,
      longitude: sensorWindow.longitude,
      speedKmh: classification.extractedFeatures.gpsSpeedAvg,
      dwellTimeRatio: classification.extractedFeatures.dwellTimeRatio,
      stopFrequency: classification.extractedFeatures.stopFrequency,
      bleSignals: sensorWindow.bleSignals || [],
    });

    if (transitCheck.evidence.length > 0) {
      classification.evidenceList.push(...transitCheck.evidence);
    }

    // 4. Record SensorWindow to DB
    try {
      await SensorWindow.create({
        journeyId: journey._id,
        timestamp: new Date(),
        gps: {
          lat: sensorWindow.latitude,
          lng: sensorWindow.longitude,
          accuracy: sensorWindow.gpsAccuracy || 5,
          speedKmh: classification.extractedFeatures.gpsSpeedAvg,
          heading: sensorWindow.heading || 0,
        },
        extractedFeatures: classification.extractedFeatures,
        predictedMode: classification.predictedMode,
        probabilities: classification.probabilities,
        confidence: classification.confidence,
        fraudScore: fraudResult.fraudScore,
        sensorAvailability: sensorWindow.sensorAvailability || journey.sensorAvailability,
        isReplayData: journey.isReplayData,
      });
    } catch (err) {
      console.warn('[SensorWindow] Log warning:', err.message);
    }

    // 5. Dynamic Journey Segmentation & Transition Handling
    const segments = journey.segments || [];
    let currentSegment = segments[segments.length - 1];

    const currentMode = classification.predictedMode;
    const isNewMode = currentSegment && currentSegment.mode !== currentMode && currentSegment.mode !== 'STATIONARY';
    const now = new Date();

    // Calculate incremental distance & duration
    const speedKmh = classification.extractedFeatures.gpsSpeedAvg;
    const windowDurationSec = sensorWindow.windowDurationSeconds || 5.0;
    const distDeltaKm = (speedKmh / 3600) * windowDurationSec;

    if (isNewMode) {
      // Close old segment
      currentSegment.endTime = now;
      const segDurationMin = Math.max(0.1, (now.getTime() - new Date(currentSegment.startTime).getTime()) / 60000);
      currentSegment.durationMinutes = Number(segDurationMin.toFixed(1));

      // Lock rewards for closed segment
      const lockRes = await rewardEngine.lockSegmentRewards({
        journeyId: journey._id,
        segmentId: `${journey._id}_seg_${currentSegment.segmentIndex}`,
        userId: journey.userId,
        mode: currentSegment.mode,
        distanceKm: currentSegment.distanceKm,
        durationMinutes: currentSegment.durationMinutes,
        confidence: currentSegment.confidence,
        fraudScore: currentSegment.fraudScore,
      });

      currentSegment.rewardStatus = lockRes.rewardStatus;
      currentSegment.earnedGreenCredits = lockRes.earnedGreenCredits;
      currentSegment.earnedFitnessPoints = lockRes.earnedFitnessPoints;
      currentSegment.verificationStatus = lockRes.rewardStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING';

      // Start new segment
      const newSegment = {
        segmentIndex: segments.length,
        mode: currentMode,
        startTime: now,
        distanceKm: Number(distDeltaKm.toFixed(3)),
        durationMinutes: 0.1,
        avgSpeedKmh: speedKmh,
        maxSpeedKmh: classification.extractedFeatures.gpsSpeedMax,
        confidence: classification.confidence,
        fraudScore: fraudResult.fraudScore,
        verificationStatus: 'PENDING',
        rewardStatus: 'PENDING',
        sensorEvidence: classification.evidenceList,
        waypoints: sensorWindow.latitude ? [{
          lat: sensorWindow.latitude,
          lng: sensorWindow.longitude,
          speedKmh,
          accuracy: sensorWindow.gpsAccuracy || 5,
          timestamp: now,
        }] : [],
      };
      segments.push(newSegment);
      currentSegment = newSegment;
    } else {
      // Update existing segment
      if (currentSegment) {
        if (currentSegment.mode === 'STATIONARY' && currentMode !== 'STATIONARY') {
          currentSegment.mode = currentMode;
        }
        currentSegment.distanceKm = Number(((currentSegment.distanceKm || 0) + distDeltaKm).toFixed(3));
        const segDurationMin = Math.max(0.1, (now.getTime() - new Date(currentSegment.startTime).getTime()) / 60000);
        currentSegment.durationMinutes = Number(segDurationMin.toFixed(1));
        currentSegment.avgSpeedKmh = Number((((currentSegment.avgSpeedKmh || speedKmh) + speedKmh) / 2).toFixed(1));
        currentSegment.maxSpeedKmh = Math.max(currentSegment.maxSpeedKmh || 0, classification.extractedFeatures.gpsSpeedMax);
        currentSegment.confidence = classification.confidence;
        currentSegment.fraudScore = Math.max(currentSegment.fraudScore || 0, fraudResult.fraudScore);
        currentSegment.sensorEvidence = classification.evidenceList;

        if (sensorWindow.latitude) {
          currentSegment.waypoints.push({
            lat: sensorWindow.latitude,
            lng: sensorWindow.longitude,
            speedKmh,
            accuracy: sensorWindow.gpsAccuracy || 5,
            timestamp: now,
          });
          if (currentSegment.waypoints.length > 500) {
            currentSegment.waypoints.shift();
          }
        }
      }
    }

    // Update overall journey aggregates
    journey.currentMode = currentMode;
    journey.currentConfidence = classification.confidence;
    journey.overallFraudScore = Math.max(journey.overallFraudScore || 0, fraudResult.fraudScore);
    journey.totalDistanceKm = Number(segments.reduce((acc, s) => acc + (s.distanceKm || 0), 0).toFixed(2));
    journey.totalDurationMinutes = Number(Math.max(0.1, (now.getTime() - new Date(journey.startTime).getTime()) / 60000).toFixed(1));

    // Calculate total earned credits across segments
    journey.totalGreenCredits = segments.reduce((acc, s) => acc + (s.earnedGreenCredits || 0), 0);
    journey.totalFitnessPoints = segments.reduce((acc, s) => acc + (s.earnedFitnessPoints || 0), 0);
    journey.totalCo2AvoidedKg = Number((journey.totalDistanceKm * 0.192).toFixed(2));

    const sanitizedCurrentSegment = currentSegment ? {
      ...(currentSegment.toObject ? currentSegment.toObject() : currentSegment),
      earnedGreenCredits: currentSegment.earnedGreenCredits || 0,
      earnedFitnessPoints: currentSegment.earnedFitnessPoints || 0,
    } : null;

    return res.status(200).json({
      success: true,
      predictedMode: classification.predictedMode,
      confidence: classification.confidence,
      probabilities: classification.probabilities,
      fraudScore: fraudResult.fraudScore,
      fraudRiskLevel: fraudResult.riskLevel,
      fraudEvents: fraudResult.fraudEvents,
      evidence: classification.evidenceList,
      currentSegment: sanitizedCurrentSegment,
      totalDistanceKm: journey.totalDistanceKm,
      totalDurationMinutes: journey.totalDurationMinutes,
      totalGreenCredits: journey.totalGreenCredits,
      totalFitnessPoints: journey.totalFitnessPoints,
      segments: journey.segments,
    });
  } catch (error) {
    console.error('[JourneyVerificationController.processSensorData] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Sensor data processing failed' });
  }
};

/**
 * Fast stateless ML inference endpoint
 * POST /api/journey/inference
 */
exports.runInferenceOnly = async (req, res) => {
  try {
    const { sensorWindow } = req.body;
    if (!sensorWindow) {
      return res.status(400).json({ success: false, error: 'sensorWindow is required' });
    }

    const classification = sensorFusionService.classifyWindow(sensorWindow);
    const fraudResult = await fraudDetectionService.evaluateWindow(sensorWindow, classification);

    return res.status(200).json({
      success: true,
      predictedMode: classification.predictedMode,
      confidence: classification.confidence,
      probabilities: classification.probabilities,
      extractedFeatures: classification.extractedFeatures,
      fraudScore: fraudResult.fraudScore,
      evidence: classification.evidenceList,
    });
  } catch (error) {
    console.error('[JourneyVerificationController.runInferenceOnly] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Inference failed' });
  }
};

/**
 * End journey, finalize segments, release rewards, update user wallet
 * POST /api/journey/end
 */
exports.endJourney = async (req, res) => {
  try {
    const { journeyId } = req.body;
    if (!journeyId) {
      return res.status(400).json({ success: false, error: 'journeyId is required' });
    }

    const journey = await Journey.findById(journeyId);
    if (!journey) {
      return res.status(404).json({ success: false, error: 'Journey not found' });
    }

    const now = new Date();
    journey.status = 'COMPLETED';
    journey.endTime = now;

    // Finalize last active segment
    const segments = journey.segments || [];
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      if (!lastSegment.endTime) {
        lastSegment.endTime = now;
        const durMin = Math.max(0.1, (now.getTime() - new Date(lastSegment.startTime).getTime()) / 60000);
        lastSegment.durationMinutes = Number(durMin.toFixed(1));

        const lockRes = await rewardEngine.lockSegmentRewards({
          journeyId: journey._id,
          segmentId: `${journey._id}_seg_${lastSegment.segmentIndex}`,
          userId: journey.userId,
          mode: lastSegment.mode,
          distanceKm: lastSegment.distanceKm,
          durationMinutes: lastSegment.durationMinutes,
          confidence: lastSegment.confidence,
          fraudScore: lastSegment.fraudScore,
        });

        lastSegment.rewardStatus = lockRes.rewardStatus;
        lastSegment.earnedGreenCredits = lockRes.earnedGreenCredits;
        lastSegment.earnedFitnessPoints = lockRes.earnedFitnessPoints;
        lastSegment.verificationStatus = lockRes.rewardStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING';
      }
    }

    // Determine Validation Outcome (Requirements 7 & 8)
    const isMobile = journey.sensorAvailability?.isMobile !== false && journey.sensorAvailability?.deviceType !== 'DESKTOP' && journey.sensorAvailability?.deviceType !== 'LAPTOP';
    const isSuspicious = journey.overallFraudScore > 40 || !isMobile;
    const validationOutcome = isSuspicious ? 'UNVERIFIED JOURNEY' : 'VALID WALKING JOURNEY';
    const validationBadge = journey.overallFraudScore > 40 ? '⚠️ Journey Requires Verification' : (!isMobile ? 'UNVERIFIED JOURNEY (Desktop)' : 'VALID WALKING JOURNEY');

    journey.validationOutcome = validationOutcome;
    journey.validationBadge = validationBadge;

    // Release verified rewards only if valid and not suspicious
    let releaseRes = { releasedCredits: 0, releasedPoints: 0 };
    if (!isSuspicious) {
      releaseRes = await rewardEngine.finalizeAndReleaseJourneyRewards(journey._id, journey.userId);
    } else {
      // Zero out credits for unverified journeys
      journey.totalGreenCredits = 0;
      journey.totalFitnessPoints = 0;
    }

    journey.totalGreenCredits = isSuspicious ? 0 : segments.reduce((acc, s) => acc + (s.earnedGreenCredits || 0), 0);
    journey.totalFitnessPoints = isSuspicious ? 0 : segments.reduce((acc, s) => acc + (s.earnedFitnessPoints || 0), 0);
    journey.totalDurationMinutes = Number(Math.max(0.1, (now.getTime() - new Date(journey.startTime).getTime()) / 60000).toFixed(1));

    await journey.save();

    // Clear memory buffer
    sensorFusionService.clearJourneyHistory(journey._id.toString());

    // Fetch updated user wallet
    let updatedUser = null;
    if (journey.userId) {
      updatedUser = await User.findById(journey.userId);
    }

    return res.status(200).json({
      success: true,
      message: isSuspicious ? 'Journey ended but requires verification. No credits awarded.' : 'Journey completed, verified, and rewards released!',
      journey: {
        ...journey.toObject(),
        validationOutcome,
        validationBadge,
      },
      validationOutcome,
      validationBadge,
      releasedRewards: releaseRes,
      updatedUser: updatedUser ? {
        fitnessPoints: updatedUser.fitnessPoints,
        greenCredits: updatedUser.greenCredits,
        totalCo2SavedKg: updatedUser.totalCo2SavedKg,
      } : null,
    });
  } catch (error) {
    console.error('[JourneyVerificationController.endJourney] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to end journey' });
  }
};

/**
 * Get journey by ID
 * GET /api/journey/:id
 */
exports.getJourney = async (req, res) => {
  try {
    const journey = await Journey.findById(req.params.id);
    if (!journey) {
      return res.status(404).json({ success: false, error: 'Journey not found' });
    }
    return res.status(200).json({ success: true, journey });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch journey' });
  }
};

/**
 * Get segments by journey ID
 * GET /api/journey/:id/segments
 */
exports.getJourneySegments = async (req, res) => {
  try {
    const journey = await Journey.findById(req.params.id);
    if (!journey) {
      return res.status(404).json({ success: false, error: 'Journey not found' });
    }
    return res.status(200).json({ success: true, segments: journey.segments });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch segments' });
  }
};

/**
 * Privacy endpoint: Delete journey & sensor data
 * DELETE /api/journey/:id
 */
exports.deleteJourney = async (req, res) => {
  try {
    const journey = await Journey.findById(req.params.id);
    if (!journey) {
      return res.status(404).json({ success: false, error: 'Journey not found' });
    }

    // Delete associated sensor telemetry windows
    await SensorWindow.deleteMany({ journeyId: journey._id });
    await Journey.findByIdAndDelete(journey._id);

    return res.status(200).json({
      success: true,
      message: 'Journey and associated raw sensor records permanently deleted.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete journey data' });
  }
};
