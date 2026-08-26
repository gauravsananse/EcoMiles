import React, { useState, useEffect, useRef } from 'react';
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
  Gauge
} from 'lucide-react';
import MobilityMap from '../components/MobilityMap';
import SensorEvidencePanel from '../components/SensorEvidencePanel';
import AIExplanationPanel from '../components/AIExplanationPanel';
import MultiSignalMatrix from '../components/MultiSignalMatrix';
import JourneyTimeline from '../components/JourneyTimeline';
import BluetoothScannerModal from '../components/BluetoothScannerModal';
import DeveloperTestModeBar from '../components/DeveloperTestModeBar';
import DesktopMobileHandoverModal from '../components/DesktopMobileHandoverModal';
import { sensorManager } from '../services/sensorManager';
import { walkingVerificationService } from '../services/walkingVerificationService';
import { REPLAY_PROFILES } from '../services/replayDatasets';
import { api } from '../services/api';

const MODE_ICONS = {
  WALKING: Footprints,
  CYCLING: Bike,
  BUS: Bus,
  METRO: Train,
  CAR: Car,
  SCOOTER: Navigation,
  STATIONARY: Clock,
  UNKNOWN: Navigation,
};

export default function MultimodalMobilityVerification({ user, onUserUpdate, onOpenAuth }) {
  // Device & Sensor Capability State
  const [deviceInfo, setDeviceInfo] = useState(sensorManager.getDeviceCapabilities());
  const [showDesktopModal, setShowDesktopModal] = useState(false);
  const [isDesktopMapOnlyMode, setIsDesktopMapOnlyMode] = useState(false);

  // Live Tracking State
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [journeyId, setJourneyId] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // AI Classification & Inference State
  const [currentMode, setCurrentMode] = useState('STATIONARY');
  const [confidence, setConfidence] = useState(0.95);
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
  const [totalGreenCredits, setTotalGreenCredits] = useState(0);
  const [totalFitnessPoints, setTotalFitnessPoints] = useState(0);
  const [totalCo2AvoidedKg, setTotalCo2AvoidedKg] = useState(0.0);

  // Transit Context & Beacons
  const [transitBeacons, setTransitBeacons] = useState([]);
  const [showBLEModal, setShowBLEModal] = useState(false);

  // Developer Test Mode
  const [isTestMode, setIsTestMode] = useState(false);
  const [selectedProfileKey, setSelectedProfileKey] = useState('walking');
  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const replayTimerRef = useRef(null);

  // Submitting / Completion
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completionResult, setCompletionResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const timerRef = useRef(null);
  const sensorPollRef = useRef(null);
  const inferenceIntervalRef = useRef(null);

  // Re-check device capabilities on mount
  useEffect(() => {
    const caps = sensorManager.getDeviceCapabilities();
    setDeviceInfo(caps);
    fetchTransitContext();
  }, []);

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

  // Live Sensor Polling (10 Hz)
  useEffect(() => {
    if (isTracking && !isPaused && !isTestMode) {
      sensorPollRef.current = setInterval(() => {
        setLiveSensorData(sensorManager.getCurrentReading());
      }, 150);
    } else {
      clearInterval(sensorPollRef.current);
    }
    return () => clearInterval(sensorPollRef.current);
  }, [isTracking, isPaused, isTestMode]);

  // Main Elapsed Timer (1s)
  useEffect(() => {
    if (isTracking && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTracking, isPaused]);

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
  }, [isTracking, isPaused, journeyId, isTestMode, selectedProfileKey, currentLegIndex]);

  // Developer Test Mode Replay Runner
  useEffect(() => {
    if (isTracking && !isPaused && isTestMode) {
      const profile = REPLAY_PROFILES[selectedProfileKey];
      let frameIdx = 0;

      replayTimerRef.current = setInterval(() => {
        let activeFrame = null;
        if (profile.isMultiLeg) {
          const activeLeg = profile.legs[currentLegIndex] || profile.legs[0];
          activeFrame = activeLeg.frame;
        } else {
          activeFrame = profile.frames[frameIdx % profile.frames.length];
          frameIdx++;
        }

        if (activeFrame) {
          const syntheticReading = {
            ...sensorManager.getCurrentReading(),
            speed: activeFrame.speed,
            cadence: activeFrame.cadence || 0,
            stepCount: (liveSensorData.stepCount || 0) + Math.round((activeFrame.cadence || 100) / 40),
            accelerationX: activeFrame.accelerationsX ? activeFrame.accelerationsX[0] : 0,
            accelerationY: activeFrame.accelerationsY ? activeFrame.accelerationsY[0] : 0,
            accelerationZ: activeFrame.accelerationsZ ? activeFrame.accelerationsZ[0] : 9.81,
            walkingConfidence: activeFrame.speed < 7 ? 94 : 20,
            isWalkingVerified: activeFrame.speed < 7,
            bluetoothSignals: activeFrame.bleSignals || [],
            sensorAvailability: {
              gps: true,
              accelerometer: true,
              gyroscope: true,
              stepCounter: true,
              bluetooth: Boolean(activeFrame.bleSignals?.length),
              activityRecognition: true,
              isMobile: true,
            },
          };
          setLiveSensorData(syntheticReading);
        }
      }, 1500);

      let legTimeout;
      if (profile.isMultiLeg) {
        const activeLeg = profile.legs[currentLegIndex];
        if (activeLeg) {
          legTimeout = setTimeout(() => {
            if (currentLegIndex < profile.legs.length - 1) {
              setCurrentLegIndex((prev) => prev + 1);
            }
          }, (activeLeg.durationSec || 10) * 1000);
        }
      }

      return () => {
        clearInterval(replayTimerRef.current);
        clearTimeout(legTimeout);
      };
    }
  }, [isTracking, isPaused, isTestMode, selectedProfileKey, currentLegIndex, liveSensorData.stepCount]);

  /**
   * Execute continuous sliding window feature extraction and ML classification on backend
   */
  const executeSlidingWindowInference = async () => {
    if (!journeyId) return;

    let sensorWindow = null;
    if (isTestMode) {
      const profile = REPLAY_PROFILES[selectedProfileKey];
      let frameData = null;
      if (profile.isMultiLeg) {
        frameData = profile.legs[currentLegIndex]?.frame || profile.legs[0].frame;
      } else {
        frameData = profile.frames[0];
      }

      sensorWindow = {
        timestamp: Date.now(),
        latitude: 28.6139 + (Math.random() - 0.5) * 0.005,
        longitude: 77.2090 + (Math.random() - 0.5) * 0.005,
        gpsAccuracy: frameData.gpsAccuracy || 5,
        speed: frameData.speed,
        speeds: frameData.speeds || [frameData.speed],
        accelerationsX: frameData.accelerationsX || [0],
        accelerationsY: frameData.accelerationsY || [0],
        accelerationsZ: frameData.accelerationsZ || [9.81],
        gyrosAlpha: frameData.gyrosAlpha || [0],
        gyrosBeta: [0],
        gyrosGamma: [0],
        headings: [45.0],
        cadence: frameData.cadence || 0,
        stepCount: liveSensorData.stepCount || 100,
        transitCorridorOverlap: frameData.transitCorridorOverlap || 0,
        dwellTimeRatio: frameData.dwellTimeRatio || 0,
        bleSignals: frameData.bleSignals || [],
        sensorAvailability: { gps: true, accelerometer: true, gyroscope: true, stepCounter: true, bluetooth: true, isMobile: true },
        windowDurationSeconds: 5.0,
      };
    } else {
      // Real device window (never faking sensor arrays)
      sensorWindow = sensorManager.flushWindowBuffer(5.0);
    }

    try {
      const res = await api.sendSensorData(journeyId, sensorWindow);
      if (res.success) {
        setCurrentMode(res.predictedMode);
        setConfidence(res.confidence);
        setProbabilities(res.probabilities || {});
        setFraudScore(res.fraudScore || 0);
        setFraudRiskLevel(res.fraudRiskLevel || 'LOW');
        setEvidenceList(res.evidence || []);
        setSegments(res.segments || []);
        setTotalDistanceKm(res.totalDistanceKm || 0);
        setTotalGreenCredits(res.totalGreenCredits || 0);
        setTotalFitnessPoints(res.totalFitnessPoints || 0);
        setTotalCo2AvoidedKg(Number(((res.totalDistanceKm || 0) * 0.192).toFixed(2)));
      }
    } catch (err) {
      console.warn('[Inference error]:', err.message);
    }
  };

  /**
   * Start Journey Trigger with Intelligent Device Capability Detection
   */
  const handleStartJourneyClick = () => {
    // 1. Probe device capabilities
    const caps = sensorManager.getDeviceCapabilities();
    setDeviceInfo(caps);

    // 2. If on Laptop / Desktop and not in test mode, display Mobile Device Required Handover Modal
    if (!caps.isMobile && !isTestMode && !isDesktopMapOnlyMode) {
      setShowDesktopModal(true);
      return;
    }

    // 3. Otherwise start mobile journey
    startActiveTrackingSession();
  };

  /**
   * Start Active Session
   */
  const startActiveTrackingSession = async () => {
    setErrorMessage('');
    setCompletionResult(null);
    setElapsedSeconds(0);
    setTotalDistanceKm(0);
    setTotalGreenCredits(0);
    setTotalFitnessPoints(0);
    setCurrentLegIndex(0);

    try {
      if (!isTestMode) {
        await sensorManager.startListening();
      }

      const initialReading = sensorManager.getCurrentReading();

      // Initialize Journey session on backend with real device capabilities
      const res = await api.startMultimodalJourney({
        isReplayData: isTestMode,
        initialLocation: initialReading.latitude ? {
          lat: initialReading.latitude,
          lng: initialReading.longitude,
          accuracy: initialReading.gpsAccuracy,
        } : { lat: 28.6139, lng: 77.2090, accuracy: 5 },
        sensorAvailability: initialReading.sensorAvailability,
      });

      if (res.success && res.journeyId) {
        setJourneyId(res.journeyId);
        setSegments(res.journey.segments || []);
        setIsTracking(true);
        setIsPaused(false);
      }
    } catch (err) {
      console.error('Failed to start journey:', err);
      setErrorMessage(err.message || 'Failed to start journey verification session.');
    }
  };

  /**
   * Stop & Verify Journey Action
   */
  const handleStopAndVerify = async () => {
    setIsSubmitting(true);
    setIsTracking(false);
    setIsPaused(false);
    sensorManager.stopListening();

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
   * Delete Journey (Privacy requirement)
   */
  const handleDeleteJourney = async () => {
    if (!journeyId && !completionResult?._id) return;
    const targetId = journeyId || completionResult?._id;
    if (window.confirm('Are you sure you want to permanently delete this journey and all raw sensor records?')) {
      try {
        await api.deleteJourneyData(targetId);
        setJourneyId(null);
        setCompletionResult(null);
        setSegments([]);
        setTotalDistanceKm(0);
        setTotalGreenCredits(0);
        setTotalFitnessPoints(0);
        alert('Journey and sensor data permanently deleted.');
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
  const isWalkingVerified = liveSensorData.isWalkingVerified || (currentMode === 'WALKING' && confidence > 0.8 && liveSensorData.speed <= 7.0 && deviceInfo.isMobile);

  return (
    <div className="main-content">
      {/* Page Header */}
      <div className="page-header">
        <div className="badge-tag">
          <Sparkles size={14} fill="#059669" color="#059669" />
          <span>Green Journey &bull; Walking Verification</span>
        </div>
        <h1 className="page-title">🚶 Green Journey & Walking Verification</h1>
        <p className="page-subtitle">
          Intelligent multi-signal sensor fusion detects walking, cycling, transit, or motorized travel with hardware motion validation and cryptographic anti-fraud audit.
        </p>

        {/* Device Mode Badge */}
        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {deviceInfo.isMobile ? (
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
              <span>📱 Mobile Journey Mode</span>
            </span>
          ) : (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#fffbeb',
              color: '#92400e',
              border: '1px solid #fde68a',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              fontWeight: 700,
            }}>
              <AlertCircle size={14} className="text-amber-600" />
              <span>💻 Desktop / Laptop Detected (Mobile Required for Walking Credits)</span>
            </span>
          )}
        </div>
      </div>

      {/* Developer Test Mode Bar */}
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
        currentLegIndex={currentLegIndex}
      />

      {/* Primary Journey Screen Card */}
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
              {isTracking ? '🚶 GREEN JOURNEY ACTIVE' : 'Transport Mode & Verification'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.25rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: currentMode === 'CAR' ? '#f1f5f9' : '#ecfdf5',
                color: currentMode === 'CAR' ? '#64748b' : '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
              }}>
                <CurrentModeIcon size={22} />
              </div>

              <div>
                <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                  {currentMode}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-700)', marginLeft: '0.6rem' }}>
                  ({Math.round(confidence * 100)}% Confidence)
                </span>
              </div>
            </div>
          </div>

          {/* Verification Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                <span>Walking Verified ✓</span>
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
                <span>Walking Confidence: {liveSensorData.walkingConfidence || 0}%</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => setShowBLEModal(true)}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
            >
              <Bluetooth size={15} className="text-blue-600" />
              <span>Transit Beacons</span>
            </button>
          </div>
        </div>

        {/* Live Real-Time Journey Screen (Requirement 6) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
          textAlign: 'center',
          marginBottom: '1.5rem',
        }}>
          {/* Duration */}
          <div style={{ background: 'var(--slate-50)', borderRadius: '12px', padding: '0.85rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)' }}>
              Duration
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-900)', marginTop: '0.2rem' }}>
              {formatTime(elapsedSeconds)}
            </div>
          </div>

          {/* Distance */}
          <div style={{ background: 'var(--slate-50)', borderRadius: '12px', padding: '0.85rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)' }}>
              Distance
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-700)', marginTop: '0.2rem' }}>
              {totalDistanceKm.toFixed(2)} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>km</span>
            </div>
          </div>

          {/* Current Speed */}
          <div style={{ background: 'var(--slate-50)', borderRadius: '12px', padding: '0.85rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)' }}>
              Current Speed
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-900)', marginTop: '0.2rem' }}>
              {liveSensorData.speed?.toFixed(1) || '0.0'} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>km/h</span>
            </div>
          </div>

          {/* Steps */}
          <div style={{ background: 'var(--slate-50)', borderRadius: '12px', padding: '0.85rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)' }}>
              Steps
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-900)', marginTop: '0.2rem' }}>
              {liveSensorData.sensorAvailability?.stepCounter
                ? (liveSensorData.stepCount || 0).toLocaleString()
                : <span style={{ fontSize: '0.7rem', color: 'var(--slate-400)', fontWeight: 600 }}>Not Available</span>
              }
            </div>
          </div>

          {/* Accelerometer */}
          <div style={{ background: 'var(--slate-50)', borderRadius: '12px', padding: '0.85rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)' }}>
              Accelerometer
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, marginTop: '0.45rem' }}>
              {liveSensorData.sensorAvailability?.accelerometer ? (
                <span style={{ color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                  <CheckCircle2 size={14} /> Active
                </span>
              ) : (
                <span style={{ color: 'var(--slate-400)', fontSize: '0.75rem', fontWeight: 600 }}>
                  Not Available
                </span>
              )}
            </div>
          </div>

          {/* Gyroscope */}
          <div style={{ background: 'var(--slate-50)', borderRadius: '12px', padding: '0.85rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)' }}>
              Gyroscope
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, marginTop: '0.45rem' }}>
              {liveSensorData.sensorAvailability?.gyroscope ? (
                <span style={{ color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                  <CheckCircle2 size={14} /> Active
                </span>
              ) : (
                <span style={{ color: 'var(--slate-400)', fontSize: '0.75rem', fontWeight: 600 }}>
                  Not Available
                </span>
              )}
            </div>
          </div>
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
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              Fitness Points (Active)
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
              <Flame size={17} fill="#f97316" color="#f97316" />
              <span>+{totalFitnessPoints} FP</span>
            </div>
          </div>

          <div style={{ width: '1px', height: '32px', background: 'rgba(255, 255, 255, 0.2)' }} />

          <div>
            <div style={{ fontSize: '0.72rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              Green Credits (Verified)
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
              <Leaf size={17} fill="#a7f3d0" color="#a7f3d0" />
              <span>+{totalGreenCredits} GP</span>
            </div>
          </div>

          <div style={{ width: '1px', height: '32px', background: 'rgba(255, 255, 255, 0.2)' }} />

          <div>
            <div style={{ fontSize: '0.72rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              CO₂ Avoided
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '2px' }}>
              {totalCo2AvoidedKg.toFixed(2)} <span style={{ fontSize: '0.8rem' }}>kg</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          {!isTracking ? (
            <button
              onClick={handleStartJourneyClick}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', maxWidth: '420px', padding: '0.85rem 1.5rem', fontSize: '1.05rem', justifyContent: 'center' }}
            >
              <Footprints size={22} fill="#ffffff" />
              <span>🚶 Start Green Journey</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                {isPaused ? <Play size={18} /> : <Pause size={18} />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>

              <button
                onClick={handleStopAndVerify}
                className="btn btn-primary"
                style={{ flex: 2, background: 'var(--primary-700)' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>AI Verifying Journey...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>[ End Journey ]</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {errorMessage && (
          <div style={{ marginTop: '1rem', background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', borderRadius: '10px', padding: '0.75rem', fontSize: '0.82rem' }}>
            {errorMessage}
          </div>
        )}
      </div>

      {/* Journey Validation Outcome Card (Requirements 7 & 8) */}
      {completionResult && (
        <div className={`status-banner ${completionResult.validationOutcome === 'VALID WALKING JOURNEY' ? 'success' : 'warning'}`} style={{
          maxWidth: '850px',
          margin: '0 auto 2rem',
          animation: 'fadeIn 0.2s ease',
          borderLeft: completionResult.validationOutcome === 'VALID WALKING JOURNEY' ? '6px solid #059669' : '6px solid #f59e0b',
        }}>
          {completionResult.validationOutcome === 'VALID WALKING JOURNEY' ? (
            <CheckCircle2 size={32} className="text-emerald-600" style={{ flexShrink: 0, marginTop: '2px' }} />
          ) : (
            <AlertCircle size={32} className="text-amber-600" style={{ flexShrink: 0, marginTop: '2px' }} />
          )}

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>
                {completionResult.validationOutcome === 'VALID WALKING JOURNEY'
                  ? '🎉 VALID WALKING JOURNEY'
                  : (completionResult.validationBadge || '⚠️ Journey Requires Verification')
                }
              </div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '9999px',
                background: completionResult.validationOutcome === 'VALID WALKING JOURNEY' ? '#ecfdf5' : '#fef3c7',
                color: completionResult.validationOutcome === 'VALID WALKING JOURNEY' ? '#065f46' : '#92400e',
              }}>
                {completionResult.validationOutcome === 'VALID WALKING JOURNEY' ? 'Verified ✓' : 'Credits Withheld'}
              </span>
            </div>

            <div style={{ fontSize: '0.88rem', marginBottom: '0.75rem', color: 'var(--slate-700)' }}>
              <strong>Distance:</strong> {completionResult.totalDistanceKm} km &bull; <strong>Duration:</strong> {completionResult.totalDurationMinutes} mins &bull; <strong>Steps:</strong> {liveSensorData.sensorAvailability?.stepCounter ? liveSensorData.stepCount.toLocaleString() : 'Not Available'}
            </div>

            {completionResult.validationOutcome === 'VALID WALKING JOURNEY' ? (
              <div style={{
                display: 'flex',
                gap: '1rem',
                background: 'rgba(255, 255, 255, 0.85)',
                padding: '0.6rem 1rem',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 700,
              }}>
                <span style={{ color: '#ea580c' }}>+{completionResult.totalFitnessPoints} Fitness Points</span>
                <span>&bull;</span>
                <span style={{ color: '#059669' }}>+{completionResult.totalGreenCredits} Green Credits</span>
                <span>&bull;</span>
                <span>{completionResult.totalCo2AvoidedKg} kg CO₂ Avoided</span>
              </div>
            ) : (
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                padding: '0.6rem 1rem',
                borderRadius: '10px',
                fontSize: '0.8rem',
                color: '#92400e',
              }}>
                <strong>Verification Note:</strong> This journey did not meet full walking motion criteria or was conducted on desktop without required mobile sensors. Walking GreenCredits are only awarded for verified mobile sessions.
              </div>
            )}

            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleDeleteJourney}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', color: '#dc2626' }}
              >
                <Trash2 size={13} />
                <span>Delete Journey & Sensor Data (Privacy)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout for Map & Intelligence */}
      <div style={{
        maxWidth: '850px',
        margin: '0 auto 2rem',
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '1.5rem',
      }}>
        {/* Interactive Live Map */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                Live Geospatial Corridor & Segment Map
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                Real-time OpenStreetMap tracking with distinct segment color coding
              </div>
            </div>
          </div>
          <MobilityMap
            currentLocation={liveSensorData.latitude ? { lat: liveSensorData.latitude, lng: liveSensorData.longitude } : { lat: 28.6139, lng: 77.2090 }}
            segments={segments}
            currentMode={currentMode}
            transitBeacons={transitBeacons}
            isTracking={isTracking}
          />
        </div>

        {/* Live Sensor Evidence Panel */}
        <SensorEvidencePanel
          sensorData={liveSensorData}
          isTracking={isTracking}
        />

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

      {/* Desktop / Laptop Handover Modal (Requirement 4 & 5) */}
      <DesktopMobileHandoverModal
        isOpen={showDesktopModal}
        onClose={() => setShowDesktopModal(false)}
        onProceedDesktopMapOnly={() => {
          setIsDesktopMapOnlyMode(true);
          startActiveTrackingSession();
        }}
      />
    </div>
  );
}
