import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Square,
  Pause,
  Compass,
  Footprints,
  Bike,
  Bus,
  Train,
  Car,
  Zap,
  Flame,
  Leaf,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Navigation,
  Sparkles,
  Bluetooth,
  Trash2,
  RefreshCw,
  Smartphone,
  Check,
  XCircle,
  Activity,
  Gauge,
  Radio,
  ArrowRight,
  MapPin,
  Flag,
  AlertTriangle,
  Layers,
  Award,
  Ticket as TicketIcon
} from 'lucide-react';
import MobilityMap from '../components/MobilityMap';
import SensorEvidencePanel from '../components/SensorEvidencePanel';
import AIExplanationPanel from '../components/AIExplanationPanel';
import MultiSignalMatrix from '../components/MultiSignalMatrix';
import JourneyTimeline from '../components/JourneyTimeline';
import VerificationTimeline from '../components/VerificationTimeline';
import BluetoothScannerModal from '../components/BluetoothScannerModal';
import VehicleVerificationModal from '../components/VehicleVerificationModal';
import DeveloperTestModeBar from '../components/DeveloperTestModeBar';
import PublicTransportHub from '../components/PublicTransportHub';
import BusTicketOCRModal from '../components/BusTicketOCRModal';
import SegmentTransitionModal from '../components/SegmentTransitionModal';
import FinalJourneySummaryModal from '../components/FinalJourneySummaryModal';
import VerificationDebugPanel from '../components/VerificationDebugPanel';

import { sensorManager } from '../services/sensorManager';
import { walkingVerificationService } from '../services/walkingVerificationService';
import { cyclingVerificationEngine } from '../services/cyclingVerificationEngine';
import { stepCountingEngine } from '../services/stepCountingEngine';
import { journeyStateMachine, JOURNEY_STATES } from '../services/journeyStateMachine';
import { bluetoothEVService } from '../services/bluetoothEVService';
import { notificationService } from '../services/notificationService';
import { publicTransportConfidenceEngine } from '../services/publicTransportConfidenceEngine';
import { REPLAY_PROFILES } from '../services/replayDatasets';
import { api } from '../services/api';
import { useTranslation } from '../i18n/I18nContext';

const MODE_ICONS = {
  WALK: Footprints,
  WALKING: Footprints,
  CYCLING: Bike,
  BUS: Bus,
  METRO: Train,
  PUBLIC_TRANSPORT: Bus,
  EV: Zap,
  CAR: Car,
  SCOOTER: Navigation,
  STATIONARY: Clock,
  UNKNOWN: Navigation,
};

/**
 * Calculate distance in meters between a point and a line segment
 */
function distanceToSegmentMeters(pLat, pLng, aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const x = (bLng - aLng) * Math.cos(((aLat + bLat) * Math.PI) / 360);
  const y = bLat - aLat;
  const segLenSq = x * x + y * y;

  if (segLenSq === 0) {
    const dLat = (pLat - aLat) * (Math.PI / 180);
    const dLng = (pLng - aLng) * (Math.PI / 180);
    return R * Math.sqrt(dLat * dLat + Math.cos((aLat * Math.PI) / 180) * dLng * dLng);
  }

  const px = (pLng - aLng) * Math.cos(((aLat + bLat) * Math.PI) / 360);
  const py = pLat - aLat;
  let t = (px * x + py * y) / segLenSq;
  t = Math.max(0, Math.min(1, t));

  const projLat = aLat + t * (bLat - aLat);
  const projLng = aLng + t * (bLng - aLng);
  const dLat = (pLat - projLat) * (Math.PI / 180);
  const dLng = (pLng - projLng) * (Math.PI / 180);
  return R * Math.sqrt(dLat * dLat + Math.cos((projLat * Math.PI) / 180) * dLng * dLng);
}

export default function MultimodalMobilityVerification({
  user,
  selectedRoute = null,
  onClearSelectedRoute,
  onUserUpdate,
  onOpenAuth,
}) {
  const { t } = useTranslation();
  // Device & Sensor Capability State
  const [deviceInfo, setDeviceInfo] = useState(sensorManager.getDeviceCapabilities());
  const [isPairedMobileClient, setIsPairedMobileClient] = useState(false);

  // Active Planned Route State
  const [activePlannedRoute, setActivePlannedRoute] = useState(selectedRoute);
  const [remainingCoords, setRemainingCoords] = useState(selectedRoute?.coordinates || null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const lastRerouteTimeRef = useRef(0);

  // Centralized Journey State Machine Subscription
  const [journeyStateData, setJourneyStateData] = useState(journeyStateMachine.getState());

  // Live Tracking State
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [journeyId, setJourneyId] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Multi-Segment State
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [selectedUserMode, setSelectedUserMode] = useState(selectedRoute?.mode || 'WALK');
  const [showPublicTransportHub, setShowPublicTransportHub] = useState(false);
  const [attachedBusTicket, setAttachedBusTicket] = useState(null);
  const [showBusTicketModal, setShowBusTicketModal] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [completedSegmentData, setCompletedSegmentData] = useState(null);
  const [showSegmentTransitionModal, setShowSegmentTransitionModal] = useState(false);
  const [showFinalSummaryModal, setShowFinalSummaryModal] = useState(false);
  const [finalSummaryData, setFinalSummaryData] = useState(null);

  // AI Classification & Inference State
  const [currentMode, setCurrentMode] = useState(selectedRoute?.mode || 'WALK');
  const [confidence, setConfidence] = useState(0);
  const [probabilities, setProbabilities] = useState({
    walking: 0.05,
    cycling: 0.05,
    bus: 0.05,
    metro: 0.05,
    car: 0.05,
    scooter: 0.05,
    stationary: 0.70,
  });
  const [fraudScore, setFraudScore] = useState(0);
  const [fraudRiskLevel, setFraudRiskLevel] = useState('LOW');
  const [evidenceList, setEvidenceList] = useState([]);

  // Telemetry & Aggregates
  const [liveSensorData, setLiveSensorData] = useState(sensorManager.getCurrentReading());
  const [segments, setSegments] = useState([]);
  const [totalDistanceKm, setTotalDistanceKm] = useState(0.0);
  const [remainingDistanceKm, setRemainingDistanceKm] = useState(selectedRoute?.distanceKm || 0.0);
  const [totalGreenCredits, setTotalGreenCredits] = useState(0);
  const [totalFitnessPoints, setTotalFitnessPoints] = useState(0);
  const [totalCombinedPoints, setTotalCombinedPoints] = useState(0);
  const [totalCo2AvoidedKg, setTotalCo2AvoidedKg] = useState(0.0);
  const [stepCounts, setStepCounts] = useState(stepCountingEngine.getCounts());

  // Transit Context & Verification Modals
  const [transitBeacons, setTransitBeacons] = useState([]);
  const [showBLEModal, setShowBLEModal] = useState(false);
  const [verificationModalState, setVerificationModalState] = useState({
    isOpen: false,
    modalType: 'VEHICLE_DETECTED',
    rejectionReason: '',
    warningMessage: '',
    candidateRoutes: [],
  });

  // User's Registered Vehicle
  const [registeredVehicle, setRegisteredVehicle] = useState(null);

  // Developer Test Mode
  const [isTestMode, setIsTestMode] = useState(false);
  const [selectedProfileKey, setSelectedProfileKey] = useState(selectedRoute?.mode === 'CYCLING' ? 'cycling' : 'walking');
  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const replayTimerRef = useRef(null);

  // Confirmation modal before ending journey
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);

  // Submitting / Completion
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingJourney, setIsStartingJourney] = useState(false);
  const [completionResult, setCompletionResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const timerRef = useRef(null);
  const syncPollRef = useRef(null);
  const inferenceIntervalRef = useRef(null);
  const geoWatchIdRef = useRef(null);

  // Subscribe to Centralized State Machine
  useEffect(() => {
    const unsub = journeyStateMachine.subscribe((s) => {
      setJourneyStateData(s);
      if (s.detectedMode && !isTracking) setCurrentMode(s.detectedMode);
      if (s.confidence) setConfidence(s.confidence);
    });
    return unsub;
  }, [isTracking]);

  // Subscribe to Step Counting Engine
  useEffect(() => {
    stepCountingEngine.setUpdateCallback((counts) => {
      setStepCounts(counts);
    });
  }, []);

  // Fetch User's Registered Vehicle
  useEffect(() => {
    const fetchVehicle = async () => {
      if (user) {
        try {
          const res = await api.getMyVehicle();
          if (res.success && res.vehicle) {
            setRegisteredVehicle(res.vehicle);
          }
        } catch (e) {
          console.log('[Vehicle] MyVehicle lookup skipped:', e.message);
        }
      }
    };
    fetchVehicle();
  }, [user]);

  // Sync when selectedRoute prop changes
  useEffect(() => {
    if (selectedRoute) {
      setActivePlannedRoute(selectedRoute);
      setRemainingCoords(selectedRoute.coordinates || null);
      setRemainingDistanceKm(selectedRoute.distanceKm || 0);
      setCurrentMode(selectedRoute.mode || 'WALK');
      setSelectedUserMode(selectedRoute.mode || 'WALK');
      if (selectedRoute.mode === 'CYCLING') setSelectedProfileKey('cycling');
      else if (selectedRoute.mode === 'WALKING' || selectedRoute.mode === 'WALK') setSelectedProfileKey('walking');
    }
  }, [selectedRoute]);

  // Check URL query parameters for mobile pairing (?journeyId=...&pair=true)
  useEffect(() => {
    const caps = sensorManager.getDeviceCapabilities();
    setDeviceInfo(caps);
    fetchTransitContext();

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlJourneyId = urlParams.get('journeyId');
      const isPair = urlParams.get('pair') === 'true';

      if (isPair) {
        setIsPairedMobileClient(true);
      }

      if (urlJourneyId) {
        setJourneyId(urlJourneyId);
        setIsPairedMobileClient(true);

        // Pre-fetch paired journey so segments and routes are populated immediately
        api.getJourneyDetails(urlJourneyId).then((res) => {
          if (res && res.success && res.journey) {
            const j = res.journey;
            if (j.segments && j.segments.length > 0) {
              setSegments(j.segments);
              setActiveSegmentIndex(j.activeSegmentIndex || (j.segments.length - 1));
            }
            if (j.plannedRoute) {
              setActivePlannedRoute(j.plannedRoute);
              setRemainingCoords(j.plannedRoute.coordinates || null);
              setRemainingDistanceKm(j.plannedRoute.distanceKm || 0);
            }
            if (j.plannedMode) {
              setSelectedUserMode(j.plannedMode);
              setCurrentMode(j.plannedMode);
            }
            if (j.totalDistanceKm) setTotalDistanceKm(j.totalDistanceKm);
            if (j.totalGreenCredits) setTotalGreenCredits(j.totalGreenCredits);
            if (j.totalFitnessPoints) setTotalFitnessPoints(j.totalFitnessPoints);
            if (j.totalCombinedPoints) setTotalCombinedPoints(j.totalCombinedPoints);

            // If desktop already started the journey, auto-resume tracking seamlessly on mobile
            if (j.status === 'ACTIVE') {
              journeyStateMachine.startJourney(urlJourneyId, j.currentMode || 'WALK', registeredVehicle);
              setIsTracking(true);
              setIsPaused(false);
              sensorManager.startListening();
            }
          }
        }).catch((err) => {
          console.warn('[Mobile Pair] Failed to load paired journey details:', err.message);
        });
      }
    }

    // Subscribe to immediate real-time sensor updates from hardware
    sensorManager.setUpdateCallback((reading) => {
      if (!isTestMode) {
        setLiveSensorData((prev) => ({
          ...prev,
          ...reading,
        }));
      }
    });
  }, [isTestMode]);

  const fetchTransitContext = async () => {
    try {
      const res = await api.getTransitContext();
      if (res.success && res.context?.activeBeacons) {
        setTransitBeacons(res.context.activeBeacons);
      }
    } catch (err) {
      console.warn('Failed to load transit beacons:', err.message);
    }
  };

  // Main Elapsed Timer (1s)
  useEffect(() => {
    if (isTracking && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);

        // In Demo / Developer Test Mode with walking profile, simulate live walking cadence & steps
        if (isTestMode && selectedProfileKey === 'walking') {
          stepCountingEngine.registerStep(Date.now(), 2);
          setLiveSensorData((prev) => ({
            ...prev,
            stepCount: (prev.stepCount || 0) + 2,
            speed: 4.8,
            cadence: 114,
            isWalkingVerified: true,
            walkingConfidence: 95,
          }));
          setTotalDistanceKm((prev) => Number((prev + 0.0014).toFixed(3)));
        }
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTracking, isPaused, isTestMode, selectedProfileKey]);

  // Sliding Window AI Inference Pipeline (Every 5 seconds)
  useEffect(() => {
    if (isTracking && !isPaused && journeyId) {
      inferenceIntervalRef.current = setInterval(async () => {
        await executeSlidingWindowInference();
      }, 5000);
    } else {
      clearInterval(inferenceIntervalRef.current);
    }
    return () => clearInterval(inferenceIntervalRef.current);
  }, [isTracking, isPaused, journeyId, isTestMode, selectedProfileKey, currentLegIndex, currentMode]);

  // Cross-Device Telemetry Sync Polling
  useEffect(() => {
    if (journeyId && isTracking && (!deviceInfo.isMobile || isTestMode === false)) {
      syncPollRef.current = setInterval(async () => {
        try {
          const res = await api.getJourneyDetails(journeyId);
          if (res && res.success && res.journey) {
            const j = res.journey;
            if (j.latestTelemetry && (!deviceInfo.isMobile || !sensorManager.isListening)) {
              const tel = j.latestTelemetry;
              setLiveSensorData((prev) => ({
                ...prev,
                ...tel,
                speed: tel.speed || 0,
                stepCount: j.verifiedWalkingSteps || tel.stepCount || 0,
                cadence: tel.cadence || 0,
                latitude: tel.latitude || prev.latitude,
                longitude: tel.longitude || prev.longitude,
                walkingConfidence: tel.walkingConfidence || prev.walkingConfidence,
                isWalkingVerified: tel.isWalkingVerified || prev.isWalkingVerified,
                sensorAvailability: tel.sensorAvailability || prev.sensorAvailability,
              }));
            }
            if (j.currentMode && ['CAR', 'SCOOTER', 'BUS', 'METRO'].includes(j.currentMode)) {
              setCurrentMode(j.currentMode);
              sensorManager.setTransportMode(j.currentMode);
            }
            if (j.currentConfidence) setConfidence(j.currentConfidence);
            if (j.totalDistanceKm !== undefined) setTotalDistanceKm(j.totalDistanceKm);
            if (j.totalGreenCredits !== undefined) setTotalGreenCredits(j.totalGreenCredits);
            if (j.totalFitnessPoints !== undefined) setTotalFitnessPoints(j.totalFitnessPoints);
            if (j.totalCombinedPoints !== undefined) setTotalCombinedPoints(j.totalCombinedPoints);
            if (j.segments) setSegments(j.segments);
            if (j.totalCo2AvoidedKg !== undefined) setTotalCo2AvoidedKg(j.totalCo2AvoidedKg);
          }
        } catch (err) {}
      }, 2000);
    } else {
      clearInterval(syncPollRef.current);
    }
    return () => clearInterval(syncPollRef.current);
  }, [journeyId, isTracking, deviceInfo.isMobile, isTestMode]);

  // Real-Time Off-Route Detection & Auto-Reroute Engine
  const checkOffRouteDeviation = useCallback(async (currentLat, currentLng, accuracy = 10) => {
    if (!activePlannedRoute || !remainingCoords || remainingCoords.length < 2 || isRerouting) return;
    if (accuracy > 40) return;

    let minDistanceMeters = Infinity;
    for (let i = 0; i < remainingCoords.length - 1; i++) {
      const a = remainingCoords[i];
      const b = remainingCoords[i + 1];
      const dist = distanceToSegmentMeters(currentLat, currentLng, a[0], a[1], b[0], b[1]);
      if (dist < minDistanceMeters) {
        minDistanceMeters = dist;
      }
    }

    const OFF_ROUTE_THRESHOLD_METERS = 60;
    const now = Date.now();

    if (minDistanceMeters > OFF_ROUTE_THRESHOLD_METERS) {
      setIsOffRoute(true);

      if (now - lastRerouteTimeRef.current > 12000) {
        lastRerouteTimeRef.current = now;
        setIsRerouting(true);

        try {
          const res = await api.rerouteJourney(
            { lat: currentLat, lng: currentLng },
            activePlannedRoute.destination,
            activePlannedRoute.mode || 'WALKING'
          );

          if (res.success && res.route) {
            const newRoute = res.route;
            setActivePlannedRoute((prev) => ({
              ...prev,
              ...newRoute,
              steps: newRoute.steps || prev?.steps || [],
            }));
            setRemainingCoords(newRoute.coordinates);
            setRemainingDistanceKm(newRoute.distanceKm);
            setCurrentStepIndex(0);
            setIsOffRoute(false);
          }
        } catch (err) {
          console.warn('[Rerouting Error]:', err.message);
        } finally {
          setIsRerouting(false);
        }
      }
    } else {
      setIsOffRoute(false);
    }
  }, [activePlannedRoute, remainingCoords, isRerouting]);

  // Ingest GPS coordinates for live progress and off-route checking
  useEffect(() => {
    if (isTracking && liveSensorData.latitude && liveSensorData.longitude) {
      checkOffRouteDeviation(
        liveSensorData.latitude,
        liveSensorData.longitude,
        liveSensorData.gpsAccuracy || 5
      );
    }
  }, [isTracking, liveSensorData.latitude, liveSensorData.longitude, liveSensorData.gpsAccuracy, checkOffRouteDeviation]);

  /**
   * Execute continuous sliding window feature extraction and ML classification
   */
  const executeSlidingWindowInference = async () => {
    if (!journeyId) return;

    let sensorWindow = null;
    if (isTestMode) {
      const profile = REPLAY_PROFILES[selectedProfileKey];
      let frameData = null;
      if (profile?.isMultiLeg) {
        frameData = profile.legs[currentLegIndex]?.frame || profile.legs[0].frame;
      } else {
        frameData = profile?.frames[0] || { speed: 4.5 };
      }

      sensorWindow = {
        timestamp: Date.now(),
        latitude: liveSensorData.latitude || 18.5284,
        longitude: liveSensorData.longitude || 73.8744,
        gpsAccuracy: frameData.gpsAccuracy || 5,
        speed: frameData.speed,
        speeds: frameData.speeds || [frameData.speed],
        accelerationsX: frameData.accelerationsX || [0],
        accelerationsY: frameData.accelerationsY || [0],
        accelerationsZ: frameData.accelerationsZ || [9.81],
        gyrosAlpha: frameData.gyrosAlpha || [0],
        gyrosBeta: [0],
        gyrosGamma: [0],
        headings: [liveSensorData.heading || 45.0],
        cadence: frameData.cadence || 0,
        stepCount: liveSensorData.stepCount ?? 0,
        stepDelta: frameData.cadence ? Math.round(frameData.cadence / 12) : 0,
        transitCorridorOverlap: frameData.transitCorridorOverlap || 0,
        dwellTimeRatio: frameData.dwellTimeRatio || 0,
        bleSignals: frameData.bleSignals || [],
        sensorAvailability: { gps: true, accelerometer: true, gyroscope: true, stepCounter: true, bluetooth: true, isMobile: true },
        windowDurationSeconds: 5.0,
      };
    } else {
      sensorWindow = sensorManager.flushWindowBuffer(5.0);
    }

    try {
      const res = await api.sendSensorData(journeyId, sensorWindow);
      if (res.success) {
        // Only transition mode if vehicular transport or cycling is confirmed
        if (['CAR', 'SCOOTER', 'BUS', 'METRO'].includes(res.predictedMode)) {
          sensorManager.setTransportMode(res.predictedMode);
          stepCountingEngine.setTransportMode(res.predictedMode, res.confidence);
        } else if (res.predictedMode === 'CYCLING' && currentMode !== 'WALK') {
          sensorManager.setTransportMode('CYCLING');
          stepCountingEngine.setTransportMode('CYCLING', res.confidence);
        } else {
          stepCountingEngine.setTransportMode(currentMode, res.confidence);
        }
        setConfidence(res.confidence);
        setProbabilities(res.probabilities || {});
        setFraudScore(res.fraudScore || 0);
        setFraudRiskLevel(res.fraudRiskLevel || 'LOW');
        setEvidenceList(res.evidence || []);
        setSegments(res.segments || []);
        setTotalDistanceKm(res.totalDistanceKm || 0);
        setTotalGreenCredits(res.totalGreenCredits || 0);
        setTotalFitnessPoints(res.totalFitnessPoints || 0);
        setTotalCombinedPoints((res.totalFitnessPoints || 0) + (res.totalGreenCredits || 0));
        setTotalCo2AvoidedKg(Number(((res.totalDistanceKm || 0) * 0.192).toFixed(2)));
      }
    } catch (err) {
      console.warn('[Inference error]:', err.message);
    }
  };

  /**
  /**
   * User selects transport mode (without auto-starting)
   */
  const handleSelectMode = (mode) => {
    setSelectedUserMode(mode);
    setCurrentMode(mode);
  };

  /**
   * User confirms starting the selected transport mode
   */
  const handleConfirmAndStartMode = async (mode = selectedUserMode) => {
    // Request motion permissions immediately on user touch/click for iOS Safari user gesture compliance
    sensorManager.requestMotionPermissions().catch(() => {});

    const caps = sensorManager.getDeviceCapabilities();
    setDeviceInfo(caps);

    const chosenMode = mode || selectedUserMode || 'WALK';
    setSelectedUserMode(chosenMode);
    setCurrentMode(chosenMode);

    // Proceed directly to mode-specific flow on any device (mobile, tablet, desktop)
    if (chosenMode === 'PUBLIC_TRANSPORT' || chosenMode === 'BUS' || chosenMode === 'METRO') {
      setShowPublicTransportHub(true);
      return;
    }

    if (chosenMode === 'EV') {
      const isFossil = registeredVehicle && ['PETROL', 'DIESEL', 'CNG'].includes((registeredVehicle.fuelType || '').toUpperCase());
      if (isFossil) {
        setVerificationModalState({
          isOpen: true,
          modalType: 'FUEL_REJECTED',
          rejectionReason: `Registered ${registeredVehicle.fuelType} vehicle detected (${registeredVehicle.registrationNumber}). Fossil-fuel travel is ineligible for Green Credits.`,
          candidateRoutes: [],
        });
        return;
      }
      // Open EV Bluetooth connection modal
      setVerificationModalState({
        isOpen: true,
        modalType: 'EV_VERIFICATION',
        rejectionReason: '',
        warningMessage: '',
        candidateRoutes: [],
      });
      return;
    }

    // Direct start for WALK or CYCLING
    await startActiveTrackingSession(null, chosenMode);
  };

  /**
   * Start Navigation / Journey Handler
   */
  const handleStartNavigationClick = async () => {
    handleConfirmAndStartMode(selectedUserMode);
  };

  /**
   * Start Active Session with Live Browser GPS & State Machine
   */
  const startActiveTrackingSession = async (presetJourneyId = null, modeToStart = 'WALK', routeInfo = null) => {
    setErrorMessage('');
    setIsStartingJourney(true);
    setCompletionResult(null);
    setElapsedSeconds(0);
    setTotalDistanceKm(0);
    setTotalGreenCredits(0);
    setTotalFitnessPoints(0);
    setCurrentLegIndex(0);

    const initialMode = modeToStart || selectedUserMode || 'WALK';
    setCurrentMode(initialMode);
    setConfidence(0);

    const isCycling = initialMode === 'CYCLING';
    const isWalking = initialMode === 'WALK' || initialMode === 'WALKING';

    if (isCycling) {
      cyclingVerificationEngine.resetJourney();
      stepCountingEngine.setEnabled(false);
      walkingVerificationService.setTransportMode('CYCLING');
    } else {
      walkingVerificationService.resetJourney();
      walkingVerificationService.setTransportMode('WALK');
      stepCountingEngine.reset();
      stepCountingEngine.setEnabled(isWalking);
    }

    stepCountingEngine.setTransportMode(initialMode, 0);

    setLiveSensorData({
      ...sensorManager.getCurrentReading(),
      stepCount: 0,
      cadence: 0,
      speed: 0,
      distanceKm: 0,
      walkingConfidence: isCycling ? null : 0,
      cyclingConfidence: isCycling ? 0 : null,
      confidence: 0,
      isWalkingVerified: false,
      isCyclingVerified: false,
      walkingStatus: isCycling ? 'NOT VERIFIED' : 'Not enough walking evidence',
      verificationState: isCycling ? 'NOT VERIFIED' : 'Not enough walking evidence',
    });

    setStepCounts({
      rawSteps: 0,
      baselineSteps: 0,
      sessionSteps: 0,
      verifiedSteps: 0,
      verifiedWalkingSteps: 0,
      estimatedSteps: 0,
      stepCountingEnabled: isWalking,
    });

    try {
      if (!isTestMode) {
        await sensorManager.startListening(initialMode);
      }

      // Sensor startup is independent from the first cloud write. Enter the
      // active-segment screen immediately so a slow serverless cold start never
      // leaves the mobile action button spinning while the device is already
      // collecting GPS and motion evidence.
      setIsTracking(true);
      setIsPaused(false);
      setShowPublicTransportHub(false);
      setShowModeSelector(false);

      const initialReading = sensorManager.getCurrentReading();
      const activeTargetId = presetJourneyId || journeyId;

      if (routeInfo?.verifiedTicket) {
        setAttachedBusTicket(routeInfo.verifiedTicket);
      }

      if (!activeTargetId) {
        const res = await api.startMultimodalJourney({
          isReplayData: isTestMode,
          plannedMode: initialMode,
          origin: activePlannedRoute?.origin || { name: 'Origin' },
          destination: activePlannedRoute?.destination || { name: 'Destination' },
          plannedRoute: activePlannedRoute,
          initialLocation: initialReading.latitude ? {
            lat: initialReading.latitude,
            lng: initialReading.longitude,
            accuracy: initialReading.gpsAccuracy,
          } : { lat: 18.5284, lng: 73.8744, accuracy: 5 },
          sensorAvailability: initialReading.sensorAvailability,
        });

        if (res.success && res.journeyId) {
          setJourneyId(res.journeyId);
          setActiveSegmentIndex(0);
          setSegments(res.journey.segments || []);
          journeyStateMachine.startJourney(res.journeyId, initialMode, res.registeredVehicle || registeredVehicle);
          if (routeInfo?.verifiedTicket?._id) {
            api.linkTicketToJourney(res.journeyId, {
              ticketId: routeInfo.verifiedTicket._id,
              ticketNumber: routeInfo.verifiedTicket.ticketNumber,
              operator: routeInfo.verifiedTicket.operator,
            }).catch(() => {});
          }
        } else {
          throw new Error(res.error || 'Failed to start journey on server.');
        }
      } else {
        setJourneyId(activeTargetId);
        // Sync segments from backend if not yet loaded
        if (segments.length === 0) {
          try {
            const jRes = await api.getJourneyDetails(activeTargetId);
            if (jRes && jRes.success && jRes.journey) {
              setSegments(jRes.journey.segments || []);
              setActiveSegmentIndex(jRes.journey.activeSegmentIndex || 0);
              if (jRes.journey.plannedRoute && !activePlannedRoute) {
                setActivePlannedRoute(jRes.journey.plannedRoute);
                setRemainingCoords(jRes.journey.plannedRoute.coordinates || null);
              }
            }
          } catch (syncErr) {
            console.warn('[Segment sync warning]:', syncErr.message);
          }
        }
        journeyStateMachine.startJourney(activeTargetId, initialMode, registeredVehicle);
      }
    } catch (err) {
      console.error('Failed to start journey:', err);
      setErrorMessage(`${err.message || 'Could not start the cloud session.'} Your local sensor tracking is still active; retry once your connection is available.`);
    } finally {
      setIsStartingJourney(false);
    }
  };

  /**
   * Stop Current Segment (Continue Journey workflow - Requirements 2 & 6)
   */
  const handleStopCurrentSegment = async () => {
    if (!journeyId) return;

    try {
      const endLoc = { lat: liveSensorData.latitude, lng: liveSensorData.longitude };
      const finalSteps = stepCounts.verifiedWalkingSteps || 0;

      const res = await api.completeJourneySegment(journeyId, activeSegmentIndex, endLoc, finalSteps);
      if (res.success) {
        setCompletedSegmentData(res.segment);
        setShowSegmentTransitionModal(true);
        // Pause active sensor stream while user chooses next segment or ends
        setIsPaused(true);
      }
    } catch (err) {
      console.error('Failed to complete segment:', err);
      // Fallback transition
      const activeSeg = segments[activeSegmentIndex] || {
        segmentIndex: activeSegmentIndex,
        mode: currentMode,
        distanceKm: totalDistanceKm,
        durationMinutes: Math.round(elapsedSeconds / 60),
        earnedGreenCredits: totalGreenCredits,
        earnedFitnessPoints: totalFitnessPoints,
        earnedCombinedPoints: totalGreenCredits + totalFitnessPoints,
        verificationStatus: 'VERIFIED',
        verifiedSteps: stepCounts.verifiedWalkingSteps || 0,
      };
      setCompletedSegmentData(activeSeg);
      setShowSegmentTransitionModal(true);
      setIsPaused(true);
    }
  };

  /**
   * Continue Journey callback from Modal (User chooses next mode)
   */
  const handleContinueJourneyFromModal = () => {
    setShowSegmentTransitionModal(false);
    setShowModeSelector(true);
  };

  /**
   * Start Next Segment under the SAME journey
   */
  const handleStartNextSegment = async (nextMode, routeInfo = null) => {
    setShowModeSelector(false);
    setSelectedUserMode(nextMode);
    setCurrentMode(nextMode);
    stepCountingEngine.setTransportMode(nextMode, 0.95);

    if ((nextMode === 'PUBLIC_TRANSPORT' || nextMode === 'BUS' || nextMode === 'METRO') && !routeInfo) {
      setShowPublicTransportHub(true);
      return;
    }

    if (routeInfo?.verifiedTicket) {
      setAttachedBusTicket(routeInfo.verifiedTicket);
      if (journeyId && routeInfo.verifiedTicket._id) {
        api.linkTicketToJourney(journeyId, {
          ticketId: routeInfo.verifiedTicket._id,
          ticketNumber: routeInfo.verifiedTicket.ticketNumber,
          operator: routeInfo.verifiedTicket.operator,
        }).catch(() => {});
      }
    }

    try {
      const currentLocation = { lat: liveSensorData.latitude, lng: liveSensorData.longitude };
      const res = await api.startJourneySegment(
        journeyId,
        nextMode,
        { name: 'Current Location', ...currentLocation },
        { name: 'Destination' },
        routeInfo?.routeId || null,
        routeInfo?.name || routeInfo?.shortName || null,
        currentLocation
      );

      if (res.success) {
        setActiveSegmentIndex(res.segmentIndex);
        setSegments((p) => [...p, res.segment]);
        setShowPublicTransportHub(false);
        setIsPaused(false);
        setIsTracking(true);
      }
    } catch (err) {
      console.error('Failed to start next segment:', err);
      // Client-side fallback continuation
      setActiveSegmentIndex((prev) => prev + 1);
      setShowPublicTransportHub(false);
      setIsPaused(false);
      setIsTracking(true);
    }
  };

  /**
   * Finalize & End Entire Multi-Segment Journey
   */
  const handleConfirmEndJourney = async () => {
    setShowEndConfirmModal(false);
    setShowSegmentTransitionModal(false);
    setIsSubmitting(true);
    setIsTracking(false);
    setIsPaused(false);

    if (geoWatchIdRef.current && navigator.geolocation) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
    sensorManager.stopListening();
    journeyStateMachine.completeJourney();

    try {
      if (journeyId) {
        const res = await api.endMultimodalJourney(journeyId);
        if (res.success && res.journey) {
          setCompletionResult(res.journey);
          setSegments(res.journey.segments || []);
          if (onUserUpdate && res.updatedUser) {
            onUserUpdate((prev) => ({
              ...prev,
              ...res.updatedUser,
            }));
          }

          // Fetch full aggregated summary for modal
          try {
            const sumRes = await api.getJourneySummary(journeyId);
            if (sumRes.success) {
              setFinalSummaryData({ journey: sumRes.journey, totals: sumRes.totals });
              setShowFinalSummaryModal(true);
            }
          } catch (e) {
            setFinalSummaryData({ journey: res.journey, totals: null });
            setShowFinalSummaryModal(true);
          }
        }
      }
    } catch (err) {
      console.error('Failed to finalize journey:', err);
      setErrorMessage(err.message || 'Failed to complete journey verification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * EV Verification Callback from Modal
   */
  const handleEVVerified = async (identifier, deviceName, isDemo = false) => {
    if (!journeyId) {
      // Start journey directly with EV mode
      setVerificationModalState({ isOpen: false, modalType: 'EV_VERIFICATION', candidateRoutes: [] });
      startActiveTrackingSession(null, 'EV');
      return;
    }

    try {
      const res = await api.verifyEV(journeyId, {
        bluetoothIdentifier: identifier,
        deviceName,
        isDemoMode: isDemo,
      });

      if (res.success) {
        journeyStateMachine.setEVVerified(identifier);
        setVerificationModalState({ isOpen: false, modalType: 'EV_VERIFICATION', candidateRoutes: [] });
        startActiveTrackingSession(journeyId, 'EV');
      } else if (res.eligible === false) {
        setVerificationModalState({
          isOpen: true,
          modalType: 'FUEL_REJECTED',
          rejectionReason: res.reason,
          candidateRoutes: [],
        });
      }
    } catch (err) {
      setErrorMessage(err.message || 'EV verification failed.');
    }
  };

  /**
   * Confirm Public Transport Callback from Modal
   */
  const handleConfirmPublicTransportRoute = async (route) => {
    if (!journeyId || !route) return;

    try {
      const res = await api.confirmPublicTransport(journeyId, {
        routeId: route.routeId,
        userConfirmed: true,
        currentLat: liveSensorData.latitude,
        currentLng: liveSensorData.longitude,
      });

      if (res.success) {
        journeyStateMachine.confirmPublicTransportRoute(route);
        if (res.verified) {
          journeyStateMachine.setPublicTransportVerified(res.confidence, route.name);
        }
        setVerificationModalState({ isOpen: false, modalType: 'PUBLIC_TRANSPORT', candidateRoutes: [] });
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to confirm public transport route.');
    }
  };

  /**
   * Developer Test Mode Scenario Simulator (Section 47 & 48)
   */
  const handleSimulateScenario = async (scenarioKey) => {
    if (!isTracking) {
      await startActiveTrackingSession();
    }

    switch (scenarioKey) {
      case 'WALKING':
        setCurrentMode('WALK');
        setConfidence(0.95);
        journeyStateMachine.resumeWalking();
        sensorManager.setTransportMode('WALK');
        stepCountingEngine.setEnabled(true);
        stepCountingEngine.setTransportMode('WALKING', 0.95);
        stepCountingEngine.registerStep(Date.now(), 5);
        setLiveSensorData((p) => ({
          ...p,
          speed: 4.8,
          stepCount: (p.stepCount || 0) + 5,
          cadence: 112,
          isWalkingVerified: true,
          walkingConfidence: 95,
        }));
        break;

      case 'EV_DETECTED':
        setCurrentMode('EV');
        journeyStateMachine.triggerVehicleDetected([]);
        setVerificationModalState({
          isOpen: true,
          modalType: 'EV_VERIFICATION',
          candidateRoutes: [],
        });
        break;

      case 'EV_VERIFIED':
        setCurrentMode('EV');
        setConfidence(0.98);
        journeyStateMachine.setEVVerified('GC-EV-8F31A2');
        setVerificationModalState({ isOpen: false, modalType: 'EV_VERIFICATION', candidateRoutes: [] });
        if (journeyId) {
          await api.verifyEV(journeyId, { bluetoothIdentifier: 'GC-EV-8F31A2', isDemoMode: true });
        }
        break;

      case 'EV_BLE_LOST':
        journeyStateMachine.setEVVerificationWarning('⚠️ EV verification temporarily lost. Reconnecting...');
        setVerificationModalState({
          isOpen: true,
          modalType: 'BLE_WARNING',
          warningMessage: '⚠️ EV verification temporarily lost. Grace period active (45s).',
          candidateRoutes: [],
        });
        break;

      case 'BUS_DETECTED': {
        const nearbyRes = await api.getNearbyRoutes(18.5284, 73.8744);
        const routes = nearbyRes.candidates || [
          { routeId: '103', name: 'Route 103 — Pune Station ⇄ Hinjewadi', matchPercentage: 91, distanceMeters: 35 },
          { routeId: '104', name: 'Route 104 — Shivajinagar ⇄ Aundh', matchPercentage: 74, distanceMeters: 80 },
        ];
        journeyStateMachine.setPublicTransportCandidates(routes);
        setVerificationModalState({
          isOpen: true,
          modalType: 'PUBLIC_TRANSPORT',
          candidateRoutes: routes,
        });
        break;
      }

      case 'BUS_VERIFIED':
        setCurrentMode('BUS');
        setConfidence(0.89);
        journeyStateMachine.setPublicTransportVerified(0.89, 'Route 103 (BRT Express)');
        setVerificationModalState({ isOpen: false, modalType: 'PUBLIC_TRANSPORT', candidateRoutes: [] });
        if (journeyId) {
          await api.confirmPublicTransport(journeyId, { routeId: '103', userConfirmed: true });
        }
        break;

      case 'PETROL_VEHICLE':
        journeyStateMachine.triggerVehicleDetected([]);
        setVerificationModalState({
          isOpen: true,
          modalType: 'FUEL_REJECTED',
          rejectionReason: 'Petrol/Diesel vehicle detected. Fossil-fuel vehicles are ineligible for Green Credits.',
          candidateRoutes: [],
        });
        break;

      case 'FRAUD_TELEPORT':
        setFraudScore(95);
        setFraudRiskLevel('CRITICAL');
        notificationService.playVerificationWarning();
        if (journeyId) {
          await api.logVerificationEvent(journeyId, {
            type: 'GPS_ANOMALY_DETECTED',
            severity: 'ERROR',
            description: 'Simulated GPS Teleportation anomaly detected (>500m coordinate jump). Credits held.',
          });
        }
        break;

      case 'WALKING_AGAIN':
        setCurrentMode('WALK');
        setConfidence(0.94);
        journeyStateMachine.resumeWalking();
        setVerificationModalState({ isOpen: false, modalType: 'VEHICLE_DETECTED', candidateRoutes: [] });
        break;

      default:
        break;
    }
  };

  /**
   * Delete Journey
   */
  const handleDeleteJourney = async () => {
    if (!journeyId && !completionResult?._id) return;
    const targetId = journeyId || completionResult?._id;
    if (window.confirm('Are you sure you want to delete this journey and associated sensor records?')) {
      try {
        await api.deleteJourneyData(targetId);
        setJourneyId(null);
        setCompletionResult(null);
        setSegments([]);
        setTotalDistanceKm(0);
        setTotalGreenCredits(0);
        setTotalFitnessPoints(0);
        setTotalCombinedPoints(0);
        journeyStateMachine.reset();
      } catch (err) {
        alert('Failed to delete journey.');
      }
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const CurrentModeIcon = MODE_ICONS[currentMode] || Navigation;
  const isWalkingVerified = liveSensorData.isWalkingVerified || ((currentMode === 'WALK' || currentMode === 'WALKING') && confidence > 0.7 && Number(liveSensorData.speed || 0) <= 7.5);
  const activeStep = activePlannedRoute?.steps?.[currentStepIndex] || null;

  return (
    <div className="main-content" style={{ paddingBottom: isTracking ? '5.5rem' : undefined }}>
      {/* Page Header */}
      <div className="page-header">
        <div className="badge-tag">
          <Sparkles size={14} fill="#059669" color="#059669" />
          <span>Multi-Modal Multi-Segment Journey Verification System</span>
        </div>
        <h1 className="page-title">
          {isTracking ? `🗺️ Segment ${activeSegmentIndex + 1}: ${currentMode}` : 'Green Mobility Journey'}
        </h1>
        <p className="page-subtitle">
          {activePlannedRoute ? (
            <span>
              <strong>{activePlannedRoute.mode} Route</strong> &bull; {activePlannedRoute.origin?.name || 'Origin'} &rarr; {activePlannedRoute.destination?.name || 'Destination'} ({activePlannedRoute.distanceText || `${activePlannedRoute.distanceKm} km`})
            </span>
          ) : (
            'Complete multi-segment journeys with walking, cycling, registered EV bikes, and public transport — all verified under ONE journey.'
          )}
        </p>

        {/* Device Mode Badge */}
        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {isPairedMobileClient && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#ecfdf5',
              color: '#065f46',
              border: '1.5px solid #10b981',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 800,
            }}>
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>📱 Paired Mobile Device Connected</span>
            </span>
          )}

          {deviceInfo.isMobile || isPairedMobileClient ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              fontWeight: 700,
            }}>
              <Smartphone size={14} className="text-emerald-600" />
              <span>📱 Hardware Sensors Active</span>
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#f1f5f9',
                color: 'var(--slate-600)',
                border: '1px solid var(--slate-200)',
                padding: '3px 10px',
                borderRadius: '9999px',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              <AlertCircle size={14} className="text-slate-500" />
              <span>🌐 Web GPS Active</span>
            </span>
          )}

          {/* Active Segment Badge */}
          {isTracking && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#f0fdf4',
              color: '#166534',
              border: '1px solid #86efac',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '0.76rem',
              fontWeight: 800,
            }}>
              <Layers size={13} />
              <span>Active Segment {activeSegmentIndex + 1}</span>
            </span>
          )}

          {/* Centralized State Machine Status Badge */}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: journeyStateData.status.includes('VERIFIED') ? '#ecfdf5' : (journeyStateData.status.includes('WARNING') || journeyStateData.status.includes('REQUIRED') ? '#fffbeb' : '#eff6ff'),
            color: journeyStateData.status.includes('VERIFIED') ? '#065f46' : (journeyStateData.status.includes('WARNING') || journeyStateData.status.includes('REQUIRED') ? '#92400e' : '#1e40af'),
            border: '1px solid currentColor',
            padding: '3px 10px',
            borderRadius: '9999px',
            fontSize: '0.76rem',
            fontWeight: 800,
          }}>
            <Activity size={13} />
            <span>State: {journeyStateData.status}</span>
          </span>
        </div>
      </div>

      {/* Top Level Error Alert */}
      {errorMessage && (
        <div style={{
          maxWidth: '850px',
          margin: '0 auto 1.25rem',
          background: '#fff1f2',
          border: '1.5px solid #fecdd3',
          color: '#be123c',
          borderRadius: '12px',
          padding: '0.85rem 1.15rem',
          fontSize: '0.86rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          boxShadow: '0 2px 8px rgba(190, 18, 60, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            style={{ background: 'none', border: 'none', color: '#be123c', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', padding: '2px 6px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Developer Test Mode Bar with Section 47/48 Triggers */}
      <DeveloperTestModeBar
        isTestMode={isTestMode}
        selectedProfileKey={selectedProfileKey}
        onToggleTestMode={() => {
          if (isTracking) {
            alert('Please stop the current journey before switching sensor mode.');
            return;
          }
          setIsTestMode(!isTestMode);
        }}
        onSelectProfile={(key) => {
          setSelectedProfileKey(key);
          setCurrentLegIndex(0);
        }}
        onSimulateScenario={handleSimulateScenario}
        currentLegIndex={currentLegIndex}
      />

      {/* 1. Explicit Transport Mode Selector (when not tracking or continuing journey) */}
      {(!isTracking || showModeSelector) && !showPublicTransportHub && (
        <div className="card" style={{ maxWidth: '850px', margin: '0 auto 2rem', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--slate-400)', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
            {showModeSelector ? 'SELECT NEXT TRANSPORT MODE (CONTINUE JOURNEY)' : '1. CHOOSE YOUR TRANSPORT MODE'}
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '1.25rem' }}>
            {showModeSelector ? 'What mode will you use for the next segment?' : 'How would you like to travel today?'}
          </div>

          <div className="mode-grid-selector" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            {/* WALK */}
            <div
              onClick={() => handleSelectMode('WALK')}
              style={{
                border: selectedUserMode === 'WALK' ? '2.5px solid #059669' : '1px solid var(--slate-200)',
                background: selectedUserMode === 'WALK' ? '#ecfdf5' : '#ffffff',
                borderRadius: '12px',
                padding: '1.15rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                boxShadow: selectedUserMode === 'WALK' ? '0 4px 12px rgba(5, 150, 105, 0.15)' : 'none',
              }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem' }}>
                <Footprints size={24} />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--slate-900)' }}>🚶 WALK</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '4px' }}>
                Step counting ON &bull; +FP &amp; +GP
              </div>
              {selectedUserMode === 'WALK' && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', fontWeight: 800, color: '#059669' }}>
                  ✓ Selected
                </div>
              )}
            </div>

            {/* CYCLING */}
            <div
              onClick={() => handleSelectMode('CYCLING')}
              style={{
                border: selectedUserMode === 'CYCLING' ? '2.5px solid #2563eb' : '1px solid var(--slate-200)',
                background: selectedUserMode === 'CYCLING' ? '#eff6ff' : '#ffffff',
                borderRadius: '12px',
                padding: '1.15rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                boxShadow: selectedUserMode === 'CYCLING' ? '0 4px 12px rgba(37, 99, 235, 0.15)' : 'none',
              }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem' }}>
                <Bike size={24} />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--slate-900)' }}>🚲 CYCLING</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '4px' }}>
                Pedal kinematics &bull; +Green Credits
              </div>
              {selectedUserMode === 'CYCLING' && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', fontWeight: 800, color: '#2563eb' }}>
                  ✓ Selected
                </div>
              )}
            </div>

            {/* EV BIKE */}
            <div
              onClick={() => handleSelectMode('EV')}
              style={{
                border: selectedUserMode === 'EV' ? '2.5px solid #d97706' : '1px solid var(--slate-200)',
                background: selectedUserMode === 'EV' ? '#fefce8' : '#ffffff',
                borderRadius: '12px',
                padding: '1.15rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                boxShadow: selectedUserMode === 'EV' ? '0 4px 12px rgba(217, 119, 6, 0.15)' : 'none',
              }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#fefce8', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem' }}>
                <Zap size={24} />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--slate-900)' }}>⚡ EV BIKE</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '4px' }}>
                BLE GATT verified &bull; +5 GP/km
              </div>
              {selectedUserMode === 'EV' && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', fontWeight: 800, color: '#d97706' }}>
                  ✓ Selected
                </div>
              )}
            </div>

            {/* PUBLIC TRANSPORT */}
            <div
              onClick={() => handleSelectMode('PUBLIC_TRANSPORT')}
              style={{
                border: selectedUserMode === 'PUBLIC_TRANSPORT' ? '2.5px solid #4f46e5' : '1px solid var(--slate-200)',
                background: selectedUserMode === 'PUBLIC_TRANSPORT' ? '#eef2ff' : '#ffffff',
                borderRadius: '12px',
                padding: '1.15rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                boxShadow: selectedUserMode === 'PUBLIC_TRANSPORT' ? '0 4px 12px rgba(79, 70, 229, 0.15)' : 'none',
              }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem' }}>
                <Bus size={24} />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--slate-900)' }}>🚌 PUBLIC TRANSIT</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '4px' }}>
                Bus &amp; Metro &bull; +6–8 GP/km
              </div>
              {selectedUserMode === 'PUBLIC_TRANSPORT' && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', fontWeight: 800, color: '#4f46e5' }}>
                  ✓ Selected
                </div>
              )}
            </div>
          </div>

          {/* Mode Confirmation & Start Action Card */}
          <div style={{
            background: selectedUserMode === 'WALK' ? '#f0fdf4' : (selectedUserMode === 'CYCLING' ? '#eff6ff' : (selectedUserMode === 'EV' ? '#fefce8' : '#eef2ff')),
            border: `1.5px solid ${selectedUserMode === 'WALK' ? '#86efac' : (selectedUserMode === 'CYCLING' ? '#93c5fd' : (selectedUserMode === 'EV' ? '#fde68a' : '#c7d2fe'))}`,
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--slate-500)', letterSpacing: '0.05em' }}>
                {showModeSelector ? 'CONFIRM NEXT SEGMENT MODE' : 'CONFIRM YOUR TRAVEL MODE'}
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>
                  {selectedUserMode === 'WALK' && '🚶 Walking Mode Selected'}
                  {selectedUserMode === 'CYCLING' && '🚲 Cycling Mode Selected'}
                  {selectedUserMode === 'EV' && '⚡ EV Bike Mode Selected'}
                  {selectedUserMode === 'PUBLIC_TRANSPORT' && '🚌 Public Transport Mode Selected'}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--slate-600)', marginTop: '3px' }}>
                {selectedUserMode === 'WALK' && 'Step counter active • +10 FP per 1,000 steps • +5 GC/km (Max 100 FP & 50 GC/day)'}
                {selectedUserMode === 'CYCLING' && 'Pedal cadence kinematics active • +10 FP/km • +8 GC/km (Max 100 FP & 80 GC/day)'}
                {selectedUserMode === 'EV' && 'Web Bluetooth GATT required • Fossil-fuel lockout • +3 GC/km (Max 30 GC/day)'}
                {selectedUserMode === 'PUBLIC_TRANSPORT' && 'Corridor & Stop tracking • +5 GC/km (Max 50 GC/day)'}
              </div>
            </div>

            <button
              onClick={() => {
                if (isStartingJourney) return;
                if (showModeSelector) handleStartNextSegment(selectedUserMode);
                else handleConfirmAndStartMode(selectedUserMode);
              }}
              disabled={isStartingJourney}
              className="btn btn-primary btn-lg"
              style={{
                padding: '0.85rem 1.75rem',
                fontSize: '1.05rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                minWidth: '240px',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
                cursor: isStartingJourney ? 'not-allowed' : 'pointer',
              }}
            >
              {isStartingJourney ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Starting {selectedUserMode}...</span>
                </>
              ) : (
                <>
                  <Navigation size={20} fill="#ffffff" />
                  <span>{showModeSelector ? `Start Next Segment (${selectedUserMode})` : `Confirm & Start ${selectedUserMode}`}</span>
                </>
              )}
            </button>
          </div>

          {showModeSelector && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowModeSelector(false)}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem' }}
              >
                Cancel Continuation
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Dedicated Public Transport Hub Screen */}
      {showPublicTransportHub && (
        <PublicTransportHub
          journeyId={journeyId}
          currentLocation={{ lat: liveSensorData.latitude || 18.5284, lng: liveSensorData.longitude || 73.8744 }}
          isTestMode={isTestMode}
          initialMode={selectedUserMode === 'METRO' ? 'METRO' : 'BUS'}
          onBack={() => setShowPublicTransportHub(false)}
          onSegmentStarted={(segmentIdx, selectedRouteObj) => {
            if (selectedRouteObj?.verifiedTicket) {
              setAttachedBusTicket(selectedRouteObj.verifiedTicket);
            }
            if (!journeyId) {
              startActiveTrackingSession(null, 'PUBLIC_TRANSPORT', selectedRouteObj);
            } else {
              handleStartNextSegment('PUBLIC_TRANSPORT', selectedRouteObj);
            }
          }}
        />
      )}

      {/* 3. Live Active Journey Screen Card */}
      {isTracking && (
        <div className="card" style={{ maxWidth: '850px', margin: '0 auto 2rem' }}>
          {/* Top Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--slate-100)',
            paddingBottom: '1.25rem',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)', letterSpacing: '0.05em' }}>
                SEGMENT {activeSegmentIndex + 1} &bull; LIVE VERIFIED NAVIGATION
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.25rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: currentMode === 'CAR' ? '#f1f5f9' : (currentMode === 'EV' ? '#fef3c7' : (currentMode === 'BUS' || currentMode === 'PUBLIC_TRANSPORT' ? '#eff6ff' : '#ecfdf5')),
                  color: currentMode === 'CAR' ? '#64748b' : (currentMode === 'EV' ? '#d97706' : (currentMode === 'BUS' || currentMode === 'PUBLIC_TRANSPORT' ? '#2563eb' : '#059669')),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                }}>
                  <CurrentModeIcon size={22} />
                </div>

                <div>
                  <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                    {currentMode === 'EV' ? 'Electric Vehicle ⚡' : (currentMode === 'BUS' || currentMode === 'PUBLIC_TRANSPORT' ? 'Public Transit 🚌' : currentMode)}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-700)', marginLeft: '0.6rem' }}>
                    ({Math.round(confidence * 100)}% Verified)
                  </span>
                </div>
              </div>
            </div>

            {/* Verification Status Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {journeyStateData.status === 'EV_VERIFIED' && (
                <span style={{
                  background: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <Bluetooth size={14} className="text-emerald-600" />
                  <span>EV Verified ✓</span>
                </span>
              )}

              {(journeyStateData.status === 'PUBLIC_TRANSPORT_VERIFIED' || attachedBusTicket) && (
                <span style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <Bus size={14} className="text-blue-600" />
                  <span>Bus Verified {attachedBusTicket ? `(#${attachedBusTicket.ticketNumber})` : ''} ✓</span>
                </span>
              )}

              {(currentMode === 'PUBLIC_TRANSPORT' || currentMode === 'BUS') && !attachedBusTicket && (
                <button
                  type="button"
                  onClick={() => setShowBusTicketModal(true)}
                  className="btn"
                  style={{
                    fontSize: '0.78rem',
                    padding: '4px 10px',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1.5px solid #93c5fd',
                    borderRadius: '9999px',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <TicketIcon size={14} className="text-blue-600" />
                  <span>Verify Bus Ticket</span>
                </button>
              )}

              {isWalkingVerified ? (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                }}>
                  <CheckCircle2 size={15} />
                  <span>Verified ✓</span>
                </span>
              ) : (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'var(--slate-100)',
                  color: 'var(--slate-600)',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}>
                  <Sparkles size={13} />
                  <span>{journeyStateData.verificationStatus}</span>
                </span>
              )}

              <button
                type="button"
                onClick={() => setShowBLEModal(true)}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
              >
                <Bluetooth size={15} className="text-blue-600" />
                <span>BLE Scanner</span>
              </button>
            </div>
          </div>

          {/* Live Real-Time Metrics Screen */}
          <div className="live-hud-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '0.75rem',
            textAlign: 'center',
            marginBottom: '1.5rem',
          }}>
            {/* Duration */}
            <div style={{ background: 'var(--slate-50)', borderRadius: '12px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)' }}>
                Duration
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.45rem', fontWeight: 800, color: 'var(--slate-900)', marginTop: '0.2rem' }}>
                {formatTime(elapsedSeconds)}
              </div>
            </div>

            {/* Distance */}
            <div style={{ background: 'var(--slate-50)', borderRadius: '12px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)' }}>
                Distance
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.45rem', fontWeight: 800, color: 'var(--primary-700)', marginTop: '0.2rem' }}>
                {Number(totalDistanceKm || liveSensorData.distanceKm || 0).toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>km</span>
              </div>
            </div>

            {/* Speed */}
            <div style={{ background: 'var(--slate-50)', borderRadius: '12px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)' }}>
                Speed
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.45rem', fontWeight: 800, color: 'var(--slate-900)', marginTop: '0.2rem' }}>
                {Number(liveSensorData.speed || 0).toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>km/h</span>
              </div>
            </div>

            {/* Cycling Confidence or Verified Walking Steps */}
            {currentMode === 'CYCLING' ? (
              <div style={{ background: 'var(--slate-50)', borderRadius: '12px', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)' }}>
                  Cycling Confidence
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.45rem', fontWeight: 800, color: '#0284c7', marginTop: '0.2rem' }}>
                  {Math.round(liveSensorData.cyclingConfidence || 0)}%
                </div>
                <div style={{ fontSize: '0.68rem', color: liveSensorData.isCyclingVerified ? '#059669' : '#d97706', fontWeight: 700 }}>
                  {liveSensorData.isCyclingVerified ? '● Verified Cycling' : '○ Evaluating Cadence'}
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--slate-50)', borderRadius: '12px', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)' }}>
                  Verified Steps
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.45rem', fontWeight: 800, color: '#059669', marginTop: '0.2rem' }}>
                  {(stepCounts.verifiedWalkingSteps || stepCounts.sessionSteps || liveSensorData.stepCount || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.68rem', color: stepCounts.stepCountingEnabled ? '#059669' : '#94a3b8', fontWeight: 700 }}>
                  {stepCounts.verifiedWalkingSteps >= 4
                    ? '● Cadence Verified ✓'
                    : (stepCounts.sessionSteps > 0
                      ? `● Verifying rhythm (${stepCounts.sessionSteps}/4)`
                      : (stepCounts.stepCountingEnabled ? '● Step Sensor Ready' : '○ Inactive / Locked'))}
                </div>
              </div>
            )}
          </div>

          {/* Real-Time Dual Rewards Accumulation Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
            color: '#ffffff',
            borderRadius: '14px',
            padding: '1.15rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            textAlign: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                Fitness Points
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
                <Flame size={17} fill="#f97316" color="#f97316" />
                <span>+{totalFitnessPoints} FP</span>
              </div>
            </div>

            <div style={{ width: '1px', height: '32px', background: 'rgba(255, 255, 255, 0.2)' }} />

            <div>
              <div style={{ fontSize: '0.72rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                Green Credits
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
                <Leaf size={17} fill="#a7f3d0" color="#a7f3d0" />
                <span>+{totalGreenCredits} GP</span>
              </div>
            </div>

            <div style={{ width: '1px', height: '32px', background: 'rgba(255, 255, 255, 0.2)' }} />

            <div>
              <div style={{ fontSize: '0.72rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                Combined Points
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px', color: '#fef08a' }}>
                <Award size={17} fill="#fef08a" />
                <span>+{totalCombinedPoints || (totalFitnessPoints + totalGreenCredits)}</span>
              </div>
            </div>
          </div>

          {/* Action Controls: Stop Segment & End Journey (Requirements 2, 45) */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                if (isPaused) {
                  setIsPaused(false);
                  journeyStateMachine.resumeJourney();
                } else {
                  setIsPaused(true);
                  journeyStateMachine.pauseJourney();
                }
              }}
              className="btn btn-secondary"
              style={{ flex: 1, minWidth: '110px' }}
            >
              {isPaused ? <Play size={18} /> : <Pause size={18} />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            {/* STOP SEGMENT BUTTON (Triggers transition modal to Continue Journey or End) */}
            <button
              onClick={handleStopCurrentSegment}
              className="btn btn-primary"
              style={{ flex: 2, minWidth: '180px', background: '#0284c7', borderColor: '#0284c7', color: '#ffffff' }}
            >
              <Square size={16} />
              <span>Stop Segment {activeSegmentIndex + 1}</span>
            </button>

            {/* END ENTIRE JOURNEY BUTTON */}
            <button
              onClick={() => setShowEndConfirmModal(true)}
              className="btn btn-danger"
              style={{ flex: 2, minWidth: '160px', background: '#be123c', color: '#ffffff', border: 'none' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>End Entire Journey</span>
                </>
              )}
            </button>
          </div>

          {errorMessage && (
            <div style={{ marginTop: '1rem', background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', borderRadius: '10px', padding: '0.75rem', fontSize: '0.82rem' }}>
              {errorMessage}
            </div>
          )}
        </div>
      )}

      {/* Section 42: Auditable Verification Event Log / Timeline */}
      <div style={{ maxWidth: '850px', margin: '0 auto 1.5rem' }}>
        <VerificationTimeline events={journeyStateData.eventsTimeline} segments={segments} />
      </div>

      {/* Segment Transition Modal (Section 6: Continue Journey vs End Entire Journey) */}
      {showSegmentTransitionModal && completedSegmentData && (
        <SegmentTransitionModal
          segment={completedSegmentData}
          segmentIndex={activeSegmentIndex}
          journeySegmentsCount={segments.length}
          onContinueJourney={handleContinueJourneyFromModal}
          onEndJourney={handleConfirmEndJourney}
        />
      )}

      {/* Final Multi-Segment Journey Summary Modal (Section 10: Combined Points) */}
      {showFinalSummaryModal && finalSummaryData && (
        <FinalJourneySummaryModal
          journey={finalSummaryData.journey}
          totals={finalSummaryData.totals}
          onClose={() => {
            setShowFinalSummaryModal(false);
            setJourneyId(null);
            setCompletionResult(null);
            setSegments([]);
            setTotalDistanceKm(0);
            setTotalGreenCredits(0);
            setTotalFitnessPoints(0);
            setTotalCombinedPoints(0);
            journeyStateMachine.reset();
          }}
          onViewJourney={() => {
            setShowFinalSummaryModal(false);
          }}
        />
      )}

      {/* End Journey Confirmation Modal */}
      {showEndConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem',
        }}>
          <div className="card" style={{ maxWidth: '420px', textAlign: 'center', padding: '1.75rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <ShieldAlert size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', marginBottom: '0.5rem' }}>
              End entire multi-segment journey?
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--slate-600)', marginBottom: '1.5rem' }}>
              All {segments.length || 1} verified transport segments will be finalized on the server to release your grand total Fitness Points, Green Credits, and Combined Points.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowEndConfirmModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEndJourney}
                className="btn btn-primary"
                style={{ flex: 1, background: '#be123c' }}
              >
                End Journey
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Map & Telemetry Dashboard */}
      <div style={{
        maxWidth: '850px',
        margin: '0 auto 2rem',
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '1.5rem',
      }}>
        {/* Interactive Google-Style Live Navigation Map */}
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                {isTracking ? `Active Segment ${activeSegmentIndex + 1}: ${currentMode}` : 'Route Overview Map'}
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                {activePlannedRoute ? `${activePlannedRoute.origin?.name || 'Origin'} ➔ ${activePlannedRoute.destination?.name || 'Destination'}` : 'Interactive GPS Map'}
              </div>
            </div>
          </div>

          <MobilityMap
            currentLocation={Number.isFinite(liveSensorData.latitude) && Number.isFinite(liveSensorData.longitude) ? {
              lat: liveSensorData.latitude,
              lng: liveSensorData.longitude,
              accuracy: liveSensorData.gpsAccuracy,
              speed: liveSensorData.speed,
              heading: liveSensorData.heading,
            } : null}
            selectedRoute={activePlannedRoute}
            remainingRouteCoordinates={remainingCoords}
            currentStep={activeStep}
            isOffRoute={isOffRoute}
            isRerouting={isRerouting}
            segments={segments}
            currentMode={currentMode}
            transitBeacons={transitBeacons}
            isTracking={isTracking}
            elapsedSeconds={elapsedSeconds}
            totalDistanceKm={Number(totalDistanceKm || liveSensorData.distanceKm || 0)}
            remainingDistanceKm={remainingDistanceKm}
            currentSpeed={Number(liveSensorData.speed || 0)}
            gpsStatus={liveSensorData.gpsStatus || 'ACTIVE'}
          />
        </div>

        {/* Live Sensor Evidence Panel */}
        <SensorEvidencePanel
          sensorData={liveSensorData}
          isTracking={isTracking}
          currentMode={currentMode}
        />

        {/* Dev Verification Debug Panel (Section 22) */}
        <VerificationDebugPanel currentMode={currentMode} />

        {/* AI Explanation Panel */}
        <AIExplanationPanel
          currentMode={currentMode}
          confidence={confidence}
          evidenceList={evidenceList}
          fraudScore={fraudScore}
          fraudRiskLevel={fraudRiskLevel}
        />

        {/* Multi-Signal Probability Matrix */}
        <MultiSignalMatrix
          probabilities={probabilities}
          currentMode={currentMode}
        />

        {/* Segmented Journey Timeline */}
        <JourneyTimeline
          segments={segments}
          totalCredits={totalGreenCredits}
          totalPoints={totalFitnessPoints}
        />
      </div>

      {/* Vehicle / EV / Public Transport Verification Modal */}
      <VehicleVerificationModal
        isOpen={verificationModalState.isOpen}
        modalType={verificationModalState.modalType}
        registeredVehicle={registeredVehicle}
        candidateRoutes={verificationModalState.candidateRoutes}
        rejectionReason={verificationModalState.rejectionReason}
        warningMessage={verificationModalState.warningMessage}
        onClose={() => setVerificationModalState({ ...verificationModalState, isOpen: false })}
        onVerifyEV={handleEVVerified}
        onConfirmRoute={handleConfirmPublicTransportRoute}
        onDismissRoute={() => setVerificationModalState({ ...verificationModalState, isOpen: false })}
      />

      {/* Web Bluetooth Scanner Modal */}
      <BluetoothScannerModal
        isOpen={showBLEModal}
        onClose={() => setShowBLEModal(false)}
        onBeaconDetected={(beacon) => {
          setLiveSensorData((prev) => ({
            ...prev,
            bluetoothSignals: [beacon, ...(prev.bluetoothSignals || [])],
          }));
        }}
      />

      {/* Persistent Floating Journey Controls (Always in view on mobile & compact screens) */}
      {isTracking && (
        <div className="floating-journey-controls" style={{
          position: 'fixed',
          left: 0,
          right: 0,
          zIndex: 999,
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '0.65rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.6rem',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.35)',
        }}>
          {/* Left: Active Segment Mode & Telemetry */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: currentMode === 'EV' ? '#fef3c7' : (currentMode === 'BUS' || currentMode === 'PUBLIC_TRANSPORT' ? '#eff6ff' : '#ecfdf5'),
              color: currentMode === 'EV' ? '#d97706' : (currentMode === 'BUS' || currentMode === 'PUBLIC_TRANSPORT' ? '#2563eb' : '#059669'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <CurrentModeIcon size={20} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Seg {activeSegmentIndex + 1}: {currentMode}
                {(currentMode === 'CYCLING' ? liveSensorData.isCyclingVerified : isWalkingVerified) && <span style={{ color: '#10b981', marginLeft: '5px' }}>✓</span>}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', gap: '6px', fontFamily: 'var(--font-mono)' }}>
                <span>{Number(liveSensorData.speed || 0).toFixed(1)} km/h</span>
                <span>&bull;</span>
                {currentMode === 'CYCLING' ? (
                  <span>{Math.round(liveSensorData.cyclingConfidence || 0)}% Conf</span>
                ) : (
                  <span>{(stepCounts.verifiedWalkingSteps || stepCounts.sessionSteps || liveSensorData.stepCount || 0).toLocaleString()} steps</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Segment Options & End Journey Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
            {/* Pause / Resume */}
            <button
              onClick={() => {
                if (isPaused) {
                  setIsPaused(false);
                  journeyStateMachine.resumeJourney();
                } else {
                  setIsPaused(true);
                  journeyStateMachine.pauseJourney();
                }
              }}
              style={{
                background: isPaused ? '#10b981' : '#334155',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 0.65rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? <Play size={16} fill="#ffffff" /> : <Pause size={16} fill="#ffffff" />}
            </button>

            {/* Stop Segment (Continue / Transition workflow) */}
            <button
              onClick={handleStopCurrentSegment}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.52rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
              }}
            >
              <Square size={13} fill="#ffffff" />
              <span>Next Segment</span>
            </button>

            {/* End Entire Journey */}
            <button
              onClick={() => setShowEndConfirmModal(true)}
              style={{
                background: '#be123c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.52rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 8px rgba(190, 18, 60, 0.35)',
              }}
            >
              <ShieldCheck size={14} />
              <span>End Journey</span>
            </button>
          </div>
        </div>
      )}

      {/* Bus Ticket OCR Verification Modal */}
      <BusTicketOCRModal
        isOpen={showBusTicketModal}
        onClose={() => setShowBusTicketModal(false)}
        currentRoute={activePlannedRoute}
        onTicketVerified={async (res) => {
          if (res?.ticket) {
            setAttachedBusTicket(res.ticket);
            if (journeyId) {
              try {
                await api.linkTicketToJourney(journeyId, {
                  ticketId: res.ticket._id || `BTK-${Date.now()}`,
                  ticketNumber: res.ticket.ticketNumber,
                  operator: res.ticket.operator || 'PMPML',
                  passengerSlot: 0,
                  coTravellers: [],
                });
              } catch (_) {}
            }
          }
        }}
      />
    </div>
  );
}
