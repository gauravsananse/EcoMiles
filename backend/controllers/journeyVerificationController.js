const Journey = require('../models/Journey');
const SensorWindow = require('../models/SensorWindow');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const PublicTransportRoute = require('../models/PublicTransportRoute');
const VerificationEvent = require('../models/VerificationEvent');
const RewardTransaction = require('../models/RewardTransaction');
const sensorFusionService = require('../services/sensorFusionService');
const fraudDetectionService = require('../services/fraudDetectionService');
const rewardEngine = require('../services/rewardEngine');
const publicTransportRouteService = require('../services/publicTransportRouteService');
const publicTransportVerification = require('../services/publicTransportVerification');
const config = require('../config/journeyConfig');

/**
 * Start a new multimodal mobility journey
 * POST /api/journey/start
 */
exports.startJourney = async (req, res) => {
  try {
    const {
      isReplayData = false,
      initialLocation = null,
      sensorAvailability = {},
      plannedMode = 'WALKING',
      origin = null,
      destination = null,
      plannedRoute = null,
    } = req.body;
    const userId = req.user ? req.user._id : null;
    const anonymousSessionId = req.headers['x-session-id'] || `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Check if user has a registered vehicle to link
    let userVehicle = null;
    if (userId) {
      userVehicle = await Vehicle.findOne({ userId, isActive: true });
    }

    const normMode = (plannedMode || 'WALK').toUpperCase();
    let startState = 'WALKING';
    let initialModeVal = 'WALKING';
    if (normMode === 'CYCLING') {
      startState = 'CYCLING';
      initialModeVal = 'CYCLING';
    } else if (normMode === 'EV') {
      startState = 'EV_VERIFICATION_REQUIRED';
      initialModeVal = 'EV';
    } else if (['PUBLIC_TRANSPORT', 'BUS', 'METRO'].includes(normMode)) {
      startState = 'PUBLIC_TRANSPORT_ROUTE_SELECTION';
      initialModeVal = normMode;
    } else if (normMode === 'WALK' || normMode === 'WALKING') {
      startState = 'WALKING';
      initialModeVal = 'WALKING';
    }

    // Create journey record
    const journey = await Journey.create({
      userId,
      anonymousSessionId,
      status: 'ACTIVE',
      journeyState: startState,
      plannedMode: normMode,
      origin: origin ? {
        name: origin.name || 'Starting Point',
        address: origin.address || origin.formattedAddress || '',
        latitude: origin.latitude || origin.lat || null,
        longitude: origin.longitude || origin.lng || null,
      } : { name: 'Starting Point', address: '', latitude: null, longitude: null },
      destination: destination ? {
        name: destination.name || 'Destination Point',
        address: destination.address || destination.formattedAddress || '',
        latitude: destination.latitude || destination.lat || null,
        longitude: destination.longitude || destination.lng || null,
      } : { name: 'Destination Point', address: '', latitude: null, longitude: null },
      plannedRoute: plannedRoute ? {
        polyline: plannedRoute.polyline || plannedRoute.encodedPolyline || '',
        distanceKm: plannedRoute.distanceKm || (plannedRoute.distanceMeters ? plannedRoute.distanceMeters / 1000 : 0),
        durationMinutes: plannedRoute.durationMinutes || (plannedRoute.durationSeconds ? Math.round(plannedRoute.durationSeconds / 60) : 0),
        steps: plannedRoute.steps || [],
      } : { polyline: '', distanceKm: 0, durationMinutes: 0, steps: [] },
      currentMode: initialModeVal,
      verifiedMode: initialModeVal,
      currentConfidence: 0.95,
      overallFraudScore: 0,
      isReplayData: Boolean(isReplayData),
      startTime: new Date(),
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      totalGreenCredits: 0,
      totalFitnessPoints: 0,
      totalCo2AvoidedKg: 0,
      verifiedWalkingSteps: 0,
      rawSteps: 0,
      activeSegmentIndex: 0,
      verifiedVehicleId: userVehicle ? userVehicle._id : null,
      sensorAvailability: {
        gps: sensorAvailability.gps ?? true,
        accelerometer: sensorAvailability.accelerometer ?? false,
        gyroscope: sensorAvailability.gyroscope ?? false,
        bluetooth: sensorAvailability.bluetooth ?? false,
        activityRecognition: sensorAvailability.activityRecognition ?? false,
        isMobile: sensorAvailability.isMobile ?? true,
      },
      segments: [
        {
          segmentIndex: 0,
          mode: initialModeVal === 'WALKING' ? 'WALK' : initialModeVal,
          selectedMode: normMode,
          status: 'ACTIVE',
          startTime: new Date(),
          distanceKm: 0,
          durationMinutes: 0,
          confidence: 0.95,
          fraudScore: 0,
          verificationStatus: 'VERIFIED',
          rewardStatus: 'PENDING',
          greenCreditEligible: true,
          fitnessEligible: true,
          verifiedSteps: 0,
          rawSteps: 0,
          evidence: [`Journey initiated in verified ${startState} mode.`],
          sensorEvidence: [`Journey initiated in verified ${startState} mode.`],
          waypoints: initialLocation ? [{
            lat: initialLocation.lat || initialLocation.latitude,
            lng: initialLocation.lng || initialLocation.longitude,
            speedKmh: 0,
            accuracy: initialLocation.accuracy || 5,
            timestamp: new Date(),
          }] : [],
        },
      ],
    });

    // Create Initial VerificationEvent
    try {
      await VerificationEvent.create({
        journeyId: journey._id,
        userId,
        type: 'JOURNEY_STARTED',
        state: startState,
        timestamp: new Date(),
        location: initialLocation ? {
          latitude: initialLocation.lat || initialLocation.latitude,
          longitude: initialLocation.lng || initialLocation.longitude,
          accuracy: initialLocation.accuracy || 5,
          speedKmh: 0,
        } : {},
        confidence: 0.95,
        severity: 'INFO',
        description: `Journey started with ${startState} state tracking enabled.`,
      });
    } catch (evErr) {
      console.warn('[VerificationEvent] Log error:', evErr.message);
    }

    // Ensure sample transit routes exist for prototype
    await publicTransportRouteService.ensureSampleRoutesSeeded();

    return res.status(201).json({
      success: true,
      message: 'Journey started successfully',
      journeyId: journey._id,
      journey,
      registeredVehicle: userVehicle ? {
        id: userVehicle._id,
        registrationNumber: userVehicle.registrationNumber,
        fuelType: userVehicle.fuelType,
        make: userVehicle.make || userVehicle.manufacturer,
        model: userVehicle.model,
        bluetoothIdentifier: userVehicle.bluetoothIdentifier,
      } : null,
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

    // 3. Transit Route Checking if user has confirmed public transport or is in transit corridor
    let transitEvidence = [];
    if (journey.verifiedTransitRouteId) {
      const ptRoute = await PublicTransportRoute.findOne({ routeId: journey.verifiedTransitRouteId });
      if (ptRoute) {
        const lastSeg = journey.segments[journey.segments.length - 1];
        const ptEval = publicTransportRouteService.calculateConfidenceScore({
          route: ptRoute,
          currentLat: sensorWindow.latitude || 18.5284,
          currentLng: sensorWindow.longitude || 73.8744,
          currentSpeedKmh: classification.extractedFeatures.gpsSpeedAvg,
          currentHeading: sensorWindow.heading || 0,
          recentWaypoints: lastSeg ? lastSeg.waypoints : [],
          stopDwellCount: classification.extractedFeatures.stopFrequency > 0.2 ? 2 : 0,
        });

        if (ptEval.verified) {
          classification.predictedMode = ptRoute.mode;
          classification.confidence = Math.max(classification.confidence, ptEval.confidence);
          transitEvidence.push(`Continuous PT match on ${ptRoute.name} (${Math.round(ptEval.confidence * 100)}%)`);
        }
      }
    }

    if (transitEvidence.length > 0) {
      classification.evidenceList.push(...transitEvidence);
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

    // 5. Dynamic Journey Segmentation & State Machine Transitions
    const segments = journey.segments || [];
    let currentSegment = (journey.activeSegmentIndex !== undefined && segments[journey.activeSegmentIndex])
      ? segments[journey.activeSegmentIndex]
      : segments[segments.length - 1];

    const currentMode = classification.predictedMode;
    const now = new Date();
    const speedKmh = classification.extractedFeatures.gpsSpeedAvg;
    const windowDurationSec = sensorWindow.windowDurationSeconds || 5.0;
    const distDeltaKm = (speedKmh / 3600) * windowDurationSec;

    // Mode-aware step counting enforcement:
    // Raw steps always track hardware steps
    const rawStepDelta = Math.max(0, (sensorWindow.stepDelta || 0));
    journey.rawSteps = (journey.rawSteps || 0) + rawStepDelta;

    // Verified walking steps ONLY increment when in verified WALKING mode
    const isWalkingMode = currentMode === 'WALKING' && classification.confidence >= config.WALKING_CONFIDENCE_THRESHOLD;
    const verifiedStepDelta = isWalkingMode ? rawStepDelta : 0;
    journey.verifiedWalkingSteps = (journey.verifiedWalkingSteps || 0) + verifiedStepDelta;

    // Determine Green Credit eligibility for current mode
    let isSegmentGreenEligible = true;
    if (['PETROL', 'DIESEL', 'CNG', 'CAR', 'SCOOTER', 'UNKNOWN'].includes(currentMode)) {
      isSegmentGreenEligible = false;
    } else if (currentMode === 'EV' && journey.journeyState !== 'EV_VERIFIED') {
      isSegmentGreenEligible = false;
    }

    const isCompatible = currentSegment && (
      (currentSegment.mode === currentMode) ||
      (currentSegment.selectedMode === 'PUBLIC_TRANSPORT') ||
      ((currentSegment.mode === 'WALK' || currentSegment.mode === 'WALKING' || currentSegment.selectedMode === 'WALK') && (currentMode === 'WALKING' || currentMode === 'WALK' || currentMode === 'STATIONARY')) ||
      ((currentSegment.mode === 'CYCLING' || currentSegment.selectedMode === 'CYCLING') && (currentMode === 'CYCLING' || currentMode === 'STATIONARY')) ||
      ((currentSegment.mode === 'EV' || currentSegment.selectedMode === 'EV') && ['EV', 'CAR', 'SCOOTER', 'STATIONARY'].includes(currentMode))
    );

    const isNewMode = currentSegment && currentSegment.status === 'ACTIVE' && !isCompatible && currentSegment.mode !== 'STATIONARY';

    if (isNewMode) {
      // Close previous segment
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
        verifiedWalkingSteps: currentSegment.verifiedSteps || 0,
        greenCreditEligible: currentSegment.greenCreditEligible,
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
        verificationStatus: isSegmentGreenEligible ? 'VERIFIED' : 'PENDING',
        rewardStatus: 'PENDING',
        greenCreditEligible: isSegmentGreenEligible,
        fitnessEligible: currentMode === 'WALKING' || currentMode === 'CYCLING',
        verifiedSteps: verifiedStepDelta,
        rawSteps: rawStepDelta,
        earnedGreenCredits: 0,
        earnedFitnessPoints: 0,
        evidence: classification.evidenceList,
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
        currentSegment.evidence = classification.evidenceList;
        currentSegment.sensorEvidence = classification.evidenceList;
        currentSegment.verifiedSteps = (currentSegment.verifiedSteps || 0) + verifiedStepDelta;
        currentSegment.rawSteps = (currentSegment.rawSteps || 0) + rawStepDelta;
        currentSegment.greenCreditEligible = isSegmentGreenEligible;

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

    // Calculate total earned credits strictly from eligible segments
    journey.totalGreenCredits = segments.reduce((acc, s) => acc + (s.earnedGreenCredits || 0), 0);
    journey.totalFitnessPoints = segments.reduce((acc, s) => acc + (s.earnedFitnessPoints || 0), 0);
    journey.totalCo2AvoidedKg = Number((journey.totalDistanceKm * 0.192).toFixed(2));

    // Real-time telemetry snapshot for cross-device desktop/mobile sync
    journey.latestTelemetry = {
      timestamp: now,
      speed: speedKmh,
      distanceKm: journey.totalDistanceKm,
      stepCount: journey.verifiedWalkingSteps,
      rawStepCount: journey.rawSteps,
      cadence: classification.extractedFeatures.cadence || 0,
      accelerationMagnitude: classification.extractedFeatures.accelRms || 0,
      dynamicMagnitude: classification.extractedFeatures.accelMagnitudeMean || 0,
      rotationalVelocity: classification.extractedFeatures.gyroRms || 0,
      rotationAlpha: sensorWindow.gyrosAlpha ? sensorWindow.gyrosAlpha[sensorWindow.gyrosAlpha.length - 1] : null,
      rotationBeta: sensorWindow.gyrosBeta ? sensorWindow.gyrosBeta[sensorWindow.gyrosBeta.length - 1] : null,
      rotationGamma: sensorWindow.gyrosGamma ? sensorWindow.gyrosGamma[sensorWindow.gyrosGamma.length - 1] : null,
      latitude: sensorWindow.latitude || null,
      longitude: sensorWindow.longitude || null,
      gpsAccuracy: sensorWindow.gpsAccuracy || null,
      heading: sensorWindow.heading || 0,
      walkingConfidence: Math.round(classification.confidence * 100),
      isWalkingVerified: isWalkingMode,
      stepCountingEnabled: isWalkingMode,
      sensorAvailability: sensorWindow.sensorAvailability || journey.sensorAvailability,
    };

    if (journey.save) {
      await journey.save();
    }

    const sanitizedCurrentSegment = currentSegment ? {
      ...(currentSegment.toObject ? currentSegment.toObject() : currentSegment),
      earnedGreenCredits: currentSegment.earnedGreenCredits || 0,
      earnedFitnessPoints: currentSegment.earnedFitnessPoints || 0,
    } : null;

    return res.status(200).json({
      success: true,
      journeyState: journey.journeyState,
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
      verifiedWalkingSteps: journey.verifiedWalkingSteps,
      rawSteps: journey.rawSteps,
      stepCountingEnabled: isWalkingMode,
      greenCreditEligible: isSegmentGreenEligible,
      segments: journey.segments,
      latestTelemetry: journey.latestTelemetry,
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
 * Verify EV via Bluetooth or Authenticated Vehicle Record
 * Enforces backend rejection for PETROL, DIESEL, CNG vehicles.
 * POST /api/journey/:id/verify-ev
 */
exports.verifyEV = async (req, res) => {
  try {
    const { id } = req.params;
    const { bluetoothIdentifier, deviceName, isDemoMode = false } = req.body;

    const journey = await Journey.findById(id);
    if (!journey) {
      return res.status(404).json({ success: false, error: 'Journey not found' });
    }

    // 1. Fetch User's Registered Vehicle
    let vehicle = null;
    if (journey.userId) {
      vehicle = await Vehicle.findOne({ userId: journey.userId, isActive: true });
    }

    // 2. Reject Ineligible Fuel Types (PETROL, DIESEL, CNG)
    if (vehicle) {
      const fuel = (vehicle.fuelType || '').toUpperCase();
      if (['PETROL', 'DIESEL', 'CNG'].includes(fuel)) {
        // Log verification failure event
        await VerificationEvent.create({
          journeyId: journey._id,
          userId: journey.userId,
          type: `${fuel}_VEHICLE_REJECTED`,
          state: 'VERIFICATION_FAILED',
          timestamp: new Date(),
          confidence: 1.0,
          severity: 'ERROR',
          description: `Vehicle Not Eligible. Reason: Registered fuel type is ${fuel}. Fossil fuel transport is ineligible for Green Credits.`,
          metadata: { fuelType: fuel, registrationNumber: vehicle.registrationNumber },
        });

        journey.journeyState = 'VERIFICATION_FAILED';
        journey.verifiedMode = fuel;
        await journey.save();

        return res.status(422).json({
          success: false,
          eligible: false,
          verified: false,
          fuelType: fuel,
          reason: `Vehicle Not Eligible. Your registered vehicle (${vehicle.registrationNumber}) is ${fuel} powered and cannot earn Green Credits.`,
        });
      }
    }

    // 3. EV Verification Flow
    let isMatched = false;
    let verifiedIdentifier = bluetoothIdentifier || vehicle?.bluetoothIdentifier || 'GC-EV-DEFAULT';

    if (isDemoMode) {
      // Demo mode authorized verification
      isMatched = true;
    } else if (vehicle && vehicle.fuelType === 'ELECTRIC') {
      // Check BLE identifier against registered vehicle
      if (!vehicle.bluetoothIdentifier || vehicle.bluetoothIdentifier === bluetoothIdentifier || bluetoothIdentifier?.includes('GC-EV') || bluetoothIdentifier?.includes('EV')) {
        isMatched = true;
        verifiedIdentifier = vehicle.bluetoothIdentifier || bluetoothIdentifier;
      }
    } else if (bluetoothIdentifier && (bluetoothIdentifier.includes('GC-EV') || bluetoothIdentifier.includes('EV'))) {
      isMatched = true;
    }

    if (!isMatched) {
      await VerificationEvent.create({
        journeyId: journey._id,
        userId: journey.userId,
        type: 'EV_VERIFICATION_FAILED',
        state: 'VERIFICATION_FAILED',
        timestamp: new Date(),
        confidence: 0.9,
        severity: 'WARNING',
        description: `EV verification mismatch. Bluetooth identifier does not match registered vehicle.`,
        metadata: { expected: vehicle?.bluetoothIdentifier, received: bluetoothIdentifier },
      });

      return res.status(400).json({
        success: false,
        verified: false,
        reason: 'Bluetooth identity mismatch with registered EV.',
      });
    }

    // Update Journey State to EV_VERIFIED
    journey.journeyState = 'EV_VERIFIED';
    journey.verifiedMode = 'EV';
    journey.currentMode = 'EV';
    if (vehicle) journey.verifiedVehicleId = vehicle._id;

    // Update active segment to EV
    const segments = journey.segments || [];
    if (segments.length > 0) {
      const activeSeg = segments[segments.length - 1];
      activeSeg.mode = 'EV';
      activeSeg.greenCreditEligible = true;
      activeSeg.fitnessEligible = false;
      activeSeg.verificationStatus = 'VERIFIED';
      activeSeg.evidence.push(`Bluetooth EV identity verified (${verifiedIdentifier})`);
    }

    await journey.save();

    await VerificationEvent.create({
      journeyId: journey._id,
      userId: journey.userId,
      type: 'EV_VERIFIED',
      state: 'EV_VERIFIED',
      timestamp: new Date(),
      confidence: 0.98,
      severity: 'SUCCESS',
      description: `EV Bluetooth verified: ${verifiedIdentifier} — Green Credit accumulation active.`,
      metadata: { bluetoothIdentifier: verifiedIdentifier, deviceName },
    });

    return res.status(200).json({
      success: true,
      verified: true,
      eligible: true,
      journeyState: 'EV_VERIFIED',
      mode: 'EV',
      bluetoothIdentifier: verifiedIdentifier,
      message: 'Electric Vehicle verified successfully. Green Credits are now active.',
    });
  } catch (error) {
    console.error('[JourneyVerificationController.verifyEV] Error:', error.message);
    return res.status(500).json({ success: false, error: 'EV verification failed' });
  }
};

/**
 * Confirm user's selected public transport route & start continuous verification
 * POST /api/journey/:id/public-transport-confirm
 */
exports.confirmPublicTransport = async (req, res) => {
  try {
    const { id } = req.params;
    const { routeId, userConfirmed = true, currentLat, currentLng } = req.body;

    const journey = await Journey.findById(id);
    if (!journey) {
      return res.status(404).json({ success: false, error: 'Journey not found' });
    }

    const route = await PublicTransportRoute.findOne({ routeId, isActive: true });
    if (!route) {
      return res.status(404).json({ success: false, error: 'Public transport route not found' });
    }

    if (!userConfirmed) {
      journey.journeyState = 'VEHICLE_DETECTED';
      await journey.save();
      return res.status(200).json({ success: true, message: 'Route selection dismissed' });
    }

    // Set state to PUBLIC_TRANSPORT_VERIFYING
    journey.journeyState = 'PUBLIC_TRANSPORT_VERIFYING';
    journey.verifiedTransitRouteId = route.routeId;
    journey.verifiedMode = route.mode;

    // Calculate initial confidence
    const lat = currentLat || 18.5284;
    const lng = currentLng || 73.8744;
    const confResult = publicTransportRouteService.calculateConfidenceScore({
      route,
      currentLat: lat,
      currentLng: lng,
      currentSpeedKmh: 25.0,
      currentHeading: 0,
      stopDwellCount: 1,
    });

    if (confResult.verified) {
      journey.journeyState = 'PUBLIC_TRANSPORT_VERIFIED';
    }

    // Update active segment
    const segments = journey.segments || [];
    if (segments.length > 0) {
      const activeSeg = segments[segments.length - 1];
      activeSeg.mode = route.mode;
      activeSeg.greenCreditEligible = true;
      activeSeg.fitnessEligible = false;
      activeSeg.verificationStatus = confResult.verified ? 'VERIFIED' : 'PENDING';
      activeSeg.evidence.push(`Public transport confirmed: ${route.name} (Confidence: ${Math.round(confResult.confidence * 100)}%)`);
    }

    await journey.save();

    await VerificationEvent.create({
      journeyId: journey._id,
      userId: journey.userId,
      type: confResult.verified ? 'PUBLIC_TRANSPORT_VERIFIED' : 'PUBLIC_TRANSPORT_ROUTE_SELECTED',
      state: journey.journeyState,
      timestamp: new Date(),
      location: { latitude: lat, longitude: lng },
      confidence: confResult.confidence,
      severity: 'SUCCESS',
      description: `Public Transport confirmed on ${route.name}. Mode: ${route.mode}. Confidence: ${Math.round(confResult.confidence * 100)}%.`,
      metadata: { routeId: route.routeId, routeName: route.name, evidence: confResult.evidence },
    });

    return res.status(200).json({
      success: true,
      journeyState: journey.journeyState,
      mode: route.mode,
      routeId: route.routeId,
      routeName: route.name,
      confidence: confResult.confidence,
      verified: confResult.verified,
      evidence: confResult.evidence,
      message: `Confirmed ${route.name}. Public transport continuous verification active.`,
    });
  } catch (error) {
    console.error('[JourneyVerificationController.confirmPublicTransport] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to confirm public transport' });
  }
};

/**
 * Get nearby candidate transit routes
 * GET /api/journey/nearby-routes?lat=...&lng=...
 */
exports.getNearbyRoutes = async (req, res) => {
  try {
    const lat = Number(req.query.lat) || 18.5284;
    const lng = Number(req.query.lng) || 73.8744;
    const radius = Number(req.query.radius) || 2000;

    const candidates = await publicTransportRouteService.findNearbyCandidateRoutes(lat, lng, radius);

    return res.status(200).json({
      success: true,
      count: candidates.length,
      candidates,
    });
  } catch (error) {
    console.error('[JourneyVerificationController.getNearbyRoutes] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to find nearby transit routes' });
  }
};

/**
 * Custom Verification Event Logging
 * POST /api/journey/:id/verification-event
 */
exports.logVerificationEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, state, description, location, confidence, severity = 'INFO', metadata = {} } = req.body;

    const journey = await Journey.findById(id);
    if (!journey) {
      return res.status(404).json({ success: false, error: 'Journey not found' });
    }

    if (state && journey.journeyState !== state) {
      journey.journeyState = state;
      await journey.save();
    }

    const event = await VerificationEvent.create({
      journeyId: journey._id,
      userId: journey.userId,
      type: type || 'EVENT',
      state: state || journey.journeyState,
      timestamp: new Date(),
      location: location || {},
      confidence: confidence ?? 1.0,
      severity,
      description: description || `State updated to ${state}`,
      metadata,
    });

    return res.status(201).json({ success: true, event });
  } catch (error) {
    console.error('[JourneyVerificationController.logVerificationEvent] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to log verification event' });
  }
};

/**
 * Get Verification Events / Timeline for a Journey
 * GET /api/journey/:id/events
 */
exports.getVerificationEvents = async (req, res) => {
  try {
    const events = await VerificationEvent.find({ journeyId: req.params.id })
      .sort({ timestamp: 1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch verification events' });
  }
};

/**
 * Update step counts with mode-aware server validation
 * POST /api/journey/:id/steps
 */
exports.updateSteps = async (req, res) => {
  try {
    const { id } = req.params;
    const { rawStepsDelta, timestamp = Date.now() } = req.body;

    const journey = await Journey.findById(id);
    if (!journey || journey.status === 'COMPLETED') {
      return res.status(404).json({ success: false, error: 'Active journey not found' });
    }

    const delta = Math.max(0, Number(rawStepsDelta) || 0);
    journey.rawSteps = (journey.rawSteps || 0) + delta;

    // Verified walking steps accumulate ONLY if currentMode is WALKING
    const isWalking = journey.currentMode === 'WALKING' && journey.currentConfidence >= config.WALKING_CONFIDENCE_THRESHOLD;
    if (isWalking) {
      journey.verifiedWalkingSteps = (journey.verifiedWalkingSteps || 0) + delta;
    }

    await journey.save();

    return res.status(200).json({
      success: true,
      rawSteps: journey.rawSteps,
      verifiedWalkingSteps: journey.verifiedWalkingSteps,
      stepCountingEnabled: isWalking,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update steps' });
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
    journey.journeyState = 'COMPLETED';
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
          verifiedWalkingSteps: lastSegment.verifiedSteps || 0,
          greenCreditEligible: lastSegment.greenCreditEligible,
        });

        lastSegment.rewardStatus = lockRes.rewardStatus;
        lastSegment.earnedGreenCredits = lockRes.earnedGreenCredits;
        lastSegment.earnedFitnessPoints = lockRes.earnedFitnessPoints;
        lastSegment.verificationStatus = lockRes.rewardStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING';
      }
    }

    // Determine Validation Outcome
    const isMobile = journey.sensorAvailability?.isMobile !== false && journey.sensorAvailability?.deviceType !== 'DESKTOP' && journey.sensorAvailability?.deviceType !== 'LAPTOP';
    const isSuspicious = journey.overallFraudScore > 50 || (!isMobile && !journey.isReplayData);
    const activeMode = (journey.currentMode !== 'STATIONARY' && journey.currentMode !== 'UNKNOWN') ? journey.currentMode : (journey.plannedMode || 'WALKING');
    const validLabel = `VALID ${activeMode} JOURNEY`;
    const validationOutcome = isSuspicious ? 'UNVERIFIED JOURNEY' : validLabel;
    const validationBadge = journey.overallFraudScore > 50 ? '⚠️ Journey Requires Verification' : (!isMobile && !journey.isReplayData ? 'UNVERIFIED JOURNEY (Desktop)' : validLabel);

    journey.validationOutcome = validationOutcome;
    journey.validationBadge = validationBadge;

    // Release verified rewards only if valid and not suspicious
    let releaseRes = { releasedCredits: 0, releasedPoints: 0 };
    if (!isSuspicious) {
      releaseRes = await rewardEngine.finalizeAndReleaseJourneyRewards(journey._id, journey.userId);
      journey.totalGreenCredits = releaseRes.releasedCredits;
      journey.totalFitnessPoints = releaseRes.releasedPoints;
      journey.totalCombinedPoints = releaseRes.releasedCombinedPoints || (releaseRes.releasedCredits + releaseRes.releasedPoints);
      journey.overallVerificationStatus = 'VERIFIED';
    } else {
      // Zero out credits for unverified journeys
      journey.totalGreenCredits = 0;
      journey.totalFitnessPoints = 0;
      journey.totalCombinedPoints = 0;
      journey.overallVerificationStatus = 'HELD';
      await rewardEngine.finalizeAndReleaseJourneyRewards(journey._id, journey.userId);
    }

    const totals = rewardEngine.calculateJourneyTotals(journey);
    journey.totalCO2Saved = totals.totalCO2Saved;
    journey.totalDurationMinutes = Number(Math.max(0.1, (now.getTime() - new Date(journey.startTime).getTime()) / 60000).toFixed(1));

    await journey.save();

    // Log completion event
    await VerificationEvent.create({
      journeyId: journey._id,
      userId: journey.userId,
      type: 'JOURNEY_COMPLETED',
      state: 'COMPLETED',
      timestamp: now,
      confidence: isSuspicious ? 0.4 : 0.95,
      severity: isSuspicious ? 'WARNING' : 'SUCCESS',
      description: `Journey completed. Total distance: ${journey.totalDistanceKm}km. Verified Steps: ${journey.verifiedWalkingSteps}. Green Credits: +${journey.totalGreenCredits}. Fitness Points: +${journey.totalFitnessPoints}.`,
    });

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
    await SensorWindow.deleteMany({ journeyId: journey._id });
    await VerificationEvent.deleteMany({ journeyId: journey._id });
    await Journey.findByIdAndDelete(journey._id);
    return res.status(200).json({
      success: true,
      message: 'Journey and associated raw sensor records permanently deleted.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to delete journey data' });
  }
};

/**
 * Start a NEW segment under an existing journey (multi-segment "Continue Journey")
 * POST /api/journey/:id/segments/start
 */
exports.startSegment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      selectedMode = 'WALK',
      origin = null,
      destination = null,
      selectedRouteId = null,
      selectedRouteName = null,
      selectedVehicleId = null,
      currentLocation = null,
    } = req.body;

    const journey = await Journey.findById(id);
    if (!journey) return res.status(404).json({ success: false, error: 'Journey not found' });
    if (journey.status === 'COMPLETED') return res.status(400).json({ success: false, error: 'Journey is already completed' });

    const normalizedMode = selectedMode.toUpperCase() === 'WALK' ? 'WALK' : selectedMode.toUpperCase();
    const now = new Date();
    const segmentIndex = (journey.segments || []).length;

    const stepCountingEnabled = normalizedMode === 'WALK' || normalizedMode === 'WALKING';
    const greenEligible = !['PETROL', 'DIESEL', 'CNG'].includes(normalizedMode);

    let journeyState = 'WALKING';
    if (normalizedMode === 'CYCLING') journeyState = 'CYCLING';
    else if (normalizedMode === 'EV') journeyState = 'EV_VERIFICATION_REQUIRED';
    else if (['PUBLIC_TRANSPORT', 'BUS', 'METRO'].includes(normalizedMode)) journeyState = 'PUBLIC_TRANSPORT_ROUTE_SELECTION';

    const newSegment = {
      segmentIndex,
      mode: normalizedMode,
      selectedMode: normalizedMode,
      status: 'ACTIVE',
      selectedRouteId: selectedRouteId || null,
      selectedRouteName: selectedRouteName || null,
      selectedVehicleId: selectedVehicleId || null,
      startTime: now,
      origin: origin
        ? { name: origin.name || 'Segment Start', address: origin.address || '', latitude: origin.lat || origin.latitude || null, longitude: origin.lng || origin.longitude || null }
        : (currentLocation ? { name: 'Current Location', latitude: currentLocation.lat || null, longitude: currentLocation.lng || null } : { name: 'Segment Start' }),
      destination: destination
        ? { name: destination.name || 'Destination', address: destination.address || '', latitude: destination.lat || destination.latitude || null, longitude: destination.lng || destination.longitude || null }
        : { name: 'Destination' },
      distanceKm: 0,
      durationMinutes: 0,
      avgSpeedKmh: 0,
      confidence: 0.9,
      fraudScore: 0,
      verificationStatus: 'PENDING',
      rewardStatus: 'PENDING',
      greenCreditEligible: greenEligible,
      fitnessEligible: stepCountingEnabled,
      verifiedSteps: 0,
      rawSteps: 0,
      earnedGreenCredits: 0,
      earnedFitnessPoints: 0,
      earnedCombinedPoints: 0,
      co2SavedKg: 0,
      evidence: [`Segment ${segmentIndex + 1} started: ${normalizedMode}`],
      sensorEvidence: [],
      waypoints: currentLocation ? [{ lat: currentLocation.lat, lng: currentLocation.lng, speedKmh: 0, accuracy: currentLocation.accuracy || 5, timestamp: now }] : [],
    };

    journey.segments.push(newSegment);
    journey.status = 'ACTIVE';
    journey.journeyState = journeyState;
    journey.currentMode = normalizedMode === 'WALK' ? 'WALKING' : normalizedMode;
    journey.activeSegmentIndex = segmentIndex;

    await journey.save();

    await VerificationEvent.create({
      journeyId: journey._id,
      userId: journey.userId,
      type: 'SEGMENT_STARTED',
      state: journeyState,
      timestamp: now,
      location: currentLocation ? { latitude: currentLocation.lat, longitude: currentLocation.lng, accuracy: currentLocation.accuracy || 5 } : {},
      confidence: 0.9,
      severity: 'INFO',
      description: `Segment ${segmentIndex + 1} started: ${normalizedMode}${selectedRouteName ? ` on ${selectedRouteName}` : ''}`,
    });

    return res.status(201).json({
      success: true,
      journeyId: journey._id,
      segmentIndex,
      segment: journey.segments[segmentIndex],
      journeyState,
      stepCountingEnabled,
      message: `Segment ${segmentIndex + 1} started in ${normalizedMode} mode.`,
    });
  } catch (error) {
    console.error('[journeyVerificationController.startSegment] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to start journey segment' });
  }
};

/**
 * Complete the active segment and lock rewards
 * POST /api/journey/:id/segments/:segmentIndex/complete
 */
exports.completeSegment = async (req, res) => {
  try {
    const { id, segmentIndex } = req.params;
    const { endLocation = null, finalSteps = 0 } = req.body;

    const journey = await Journey.findById(id);
    if (!journey) return res.status(404).json({ success: false, error: 'Journey not found' });

    const idx = Number(segmentIndex);
    const segment = (journey.segments || [])[idx];
    if (!segment) return res.status(404).json({ success: false, error: 'Segment not found' });
    if (segment.status === 'COMPLETED') return res.status(200).json({ success: true, message: 'Segment already completed', segment });

    const now = new Date();
    segment.endTime = now;
    segment.status = 'COMPLETED';
    if (endLocation) {
      segment.endLocation = { latitude: endLocation.lat || endLocation.latitude, longitude: endLocation.lng || endLocation.longitude };
    }
    const durMin = Math.max(0.1, (now.getTime() - new Date(segment.startTime).getTime()) / 60000);
    segment.durationMinutes = Number(durMin.toFixed(1));

    if ((segment.mode === 'WALK' || segment.mode === 'WALKING') && finalSteps > 0) {
      segment.verifiedSteps = (segment.verifiedSteps || 0) + Math.max(0, finalSteps);
      journey.verifiedWalkingSteps = (journey.verifiedWalkingSteps || 0) + Math.max(0, finalSteps);
    }

    const segmentConfidence = Math.max(0.85, segment.confidence || 0.9);
    const lockRes = await rewardEngine.lockSegmentRewards({
      journeyId: journey._id,
      segmentId: `${journey._id}_seg_${idx}`,
      userId: journey.userId,
      mode: (segment.mode === 'WALK' || segment.mode === 'WALKING') ? 'WALKING' : ((segment.mode === 'PUBLIC_TRANSPORT' || segment.mode === 'BUS') ? 'BUS' : segment.mode),
      distanceKm: Math.max(0.1, Number(segment.distanceKm || 0)),
      durationMinutes: Math.max(0.1, Number(segment.durationMinutes || 0)),
      confidence: segmentConfidence,
      fraudScore: segment.fraudScore || 0,
      verifiedWalkingSteps: segment.verifiedSteps || 0,
      greenCreditEligible: segment.greenCreditEligible !== false,
    });

    segment.rewardStatus = lockRes.rewardStatus;
    segment.earnedGreenCredits = lockRes.earnedGreenCredits;
    segment.earnedFitnessPoints = lockRes.earnedFitnessPoints;
    segment.earnedCombinedPoints = lockRes.earnedGreenCredits + lockRes.earnedFitnessPoints;
    segment.co2SavedKg = Number((segment.distanceKm * 0.192).toFixed(3));
    segment.verificationStatus = (lockRes.rewardStatus === 'VERIFIED' || segment.confidence >= 0.75) ? 'VERIFIED' : 'PENDING';

    journey.journeyState = 'SEGMENT_COMPLETED';
    journey.markModified('segments');

    await journey.save();

    await VerificationEvent.create({
      journeyId: journey._id,
      userId: journey.userId,
      type: 'SEGMENT_COMPLETED',
      state: 'SEGMENT_COMPLETED',
      timestamp: now,
      confidence: segment.confidence,
      severity: 'SUCCESS',
      description: `Segment ${idx + 1} (${segment.mode}) completed. Distance: ${segment.distanceKm}km. Steps: ${segment.verifiedSteps}. GP: +${segment.earnedGreenCredits}. FP: +${segment.earnedFitnessPoints}.`,
    });

    return res.status(200).json({
      success: true,
      segmentIndex: idx,
      segment,
      earnedGreenCredits: segment.earnedGreenCredits,
      earnedFitnessPoints: segment.earnedFitnessPoints,
      earnedCombinedPoints: segment.earnedCombinedPoints,
      co2SavedKg: segment.co2SavedKg,
      verificationStatus: segment.verificationStatus,
      message: `Segment ${idx + 1} completed and verified.`,
    });
  } catch (error) {
    console.error('[journeyVerificationController.completeSegment] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to complete segment' });
  }
};

/**
 * Get full journey summary with aggregated rewards
 * GET /api/journey/:id/summary
 */
exports.getJourneySummary = async (req, res) => {
  try {
    const journey = await Journey.findById(req.params.id);
    if (!journey) return res.status(404).json({ success: false, error: 'Journey not found' });

    const totals = rewardEngine.calculateJourneyTotals(journey);

    return res.status(200).json({
      success: true,
      journeyId: journey._id,
      status: journey.status,
      journeyState: journey.journeyState,
      origin: journey.origin,
      destination: journey.destination,
      startTime: journey.startTime,
      endTime: journey.endTime,
      segments: journey.segments,
      totals,
    });
  } catch (error) {
    console.error('[journeyVerificationController.getJourneySummary] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to fetch journey summary' });
  }
};
