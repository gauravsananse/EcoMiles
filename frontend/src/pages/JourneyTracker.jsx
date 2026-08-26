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
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Navigation,
  Sparkles,
  Award
} from 'lucide-react';
import { api } from '../services/api';

export default function JourneyTracker({ user, onUserUpdate, onOpenAuth }) {
  // Tracking State
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [journeyMode, setJourneyMode] = useState('WALKING'); // AI classified
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0.0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0.0);
  const [cadence, setCadence] = useState(110);
  const [calories, setCalories] = useState(0);

  // Preset Mode Switch for Simulation
  const [simulatedActivity, setSimulatedActivity] = useState('WALKING'); // 'WALKING' | 'CYCLING' | 'BUS' | 'METRO'

  // Completion modal / toast
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completionResult, setCompletionResult] = useState(null);

  // Journey History
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const res = await api.getJourneyHistory();
      if (res.success && res.journeys) {
        setHistory(res.journeys);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Live Timer & GPS/Cadence Simulator
  useEffect(() => {
    if (isTracking && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);

        // Simulation physics based on selected activity
        let baseSpeed = 4.8;
        let baseCadence = 112;

        if (simulatedActivity === 'CYCLING') {
          baseSpeed = 16.5;
          baseCadence = 75;
        } else if (simulatedActivity === 'BUS') {
          baseSpeed = 28.0;
          baseCadence = 0;
        } else if (simulatedActivity === 'METRO') {
          baseSpeed = 48.0;
          baseCadence = 0;
        }

        // Add micro variation for realism
        const jitter = (Math.random() - 0.5) * 1.2;
        const liveSpeed = Math.max(0.5, baseSpeed + jitter);
        setCurrentSpeedKmh(Number(liveSpeed.toFixed(1)));

        // Increment distance (speed in km/h -> km/sec)
        const kmPerSec = liveSpeed / 3600;
        setDistanceKm((prev) => Number((prev + kmPerSec).toFixed(3)));

        // Cadence & Calories
        setCadence(baseCadence > 0 ? Math.round(baseCadence + (Math.random() - 0.5) * 8) : 0);
        setCalories((prev) => Math.round(prev + (liveSpeed > 10 ? 0.08 : 0.04)));

        // Real-time AI classification update
        if (liveSpeed < 8) {
          setJourneyMode('WALKING');
        } else if (liveSpeed <= 25) {
          setJourneyMode('CYCLING');
        } else if (liveSpeed <= 40) {
          setJourneyMode('BUS');
        } else {
          setJourneyMode('METRO');
        }
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isTracking, isPaused, simulatedActivity]);

  const handleStartTracking = () => {
    if (!user) {
      onOpenAuth('login');
      return;
    }
    setElapsedSeconds(0);
    setDistanceKm(0.0);
    setCalories(0);
    setCompletionResult(null);
    setIsTracking(true);
    setIsPaused(false);
  };

  const handleStopAndVerify = async () => {
    setIsTracking(false);
    setIsPaused(false);
    clearInterval(timerRef.current);

    if (distanceKm < 0.05 && elapsedSeconds < 5) {
      alert('Journey too short to record.');
      return;
    }

    setIsSubmitting(true);
    try {
      const durationMin = Math.max(1, Math.round(elapsedSeconds / 60));
      const res = await api.recordJourney({
        originName: 'Current Active Location',
        destinationName: 'Destination Hub',
        distanceKm: Number(distanceKm.toFixed(2)),
        durationMinutes: durationMin,
        avgSpeedKmh: currentSpeedKmh || (distanceKm / (durationMin / 60)),
        maxSpeedKmh: currentSpeedKmh * 1.3,
        cadenceStepsPerMin: cadence,
        accelerationVariance: 0.45,
      });

      if (res.success && res.journey) {
        setCompletionResult(res.journey);
        if (onUserUpdate && res.updatedUser) {
          onUserUpdate((prev) => ({
            ...prev,
            ...res.updatedUser,
          }));
        }
        loadHistory();
      }
    } catch (err) {
      console.error('Failed to submit journey:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getModeIcon = (mode, size = 18) => {
    switch (mode) {
      case 'WALKING':
        return <Footprints size={size} className="text-emerald-600" />;
      case 'CYCLING':
        return <Bike size={size} className="text-amber-600" />;
      case 'BUS':
        return <Bus size={size} className="text-blue-600" />;
      case 'METRO':
        return <Train size={size} className="text-purple-600" />;
      case 'EV':
        return <Zap size={size} className="text-emerald-500" />;
      default:
        return <Navigation size={size} className="text-slate-600" />;
    }
  };

  return (
    <div className="main-content">
      {/* Header */}
      <div className="page-header">
        <div className="badge-tag">
          <Compass size={14} fill="#059669" color="#059669" />
          <span>AI Transport Mode Detection</span>
        </div>
        <h1 className="page-title">Live Journey Tracker</h1>
        <p className="page-subtitle">
          Start your commute. Our AI engine automatically detects walking, cycling, or transit, verifies your journey, and credits your dual points in real-time.
        </p>
      </div>

      {/* Main Tracker Card */}
      <div className="card" style={{ maxWidth: '680px', margin: '0 auto 2.5rem' }}>
        {/* Active Mode Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--slate-100)',
          paddingBottom: '1.25rem',
          marginBottom: '1.5rem',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)', letterSpacing: '0.05em' }}>
              Detected Transport Mode
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              {getModeIcon(journeyMode, 22)}
              <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                {journeyMode}
              </span>
              {isTracking && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'var(--primary-50)',
                  color: 'var(--primary-700)',
                  border: '1px solid var(--primary-200)',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} className="animate-pulse-subtle" />
                  AI Live Sensor Feed
                </span>
              )}
            </div>
          </div>

          {/* Activity Simulation Selector */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--slate-500)', marginBottom: '0.25rem' }}>
              Test Mode Simulation:
            </div>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {['WALKING', 'CYCLING', 'BUS', 'METRO'].map((act) => (
                <button
                  key={act}
                  onClick={() => setSimulatedActivity(act)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--slate-200)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: simulatedActivity === act ? 'var(--slate-900)' : '#ffffff',
                    color: simulatedActivity === act ? '#ffffff' : 'var(--slate-600)',
                  }}
                >
                  {act}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Big Live Metrics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          textAlign: 'center',
          marginBottom: '1.5rem',
        }}>
          <div style={{ background: 'var(--slate-50)', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)' }}>
              Duration
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--slate-900)', marginTop: '0.25rem' }}>
              {formatTime(elapsedSeconds)}
            </div>
          </div>

          <div style={{ background: 'var(--slate-50)', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)' }}>
              Distance
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-700)', marginTop: '0.25rem' }}>
              {distanceKm.toFixed(2)} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>km</span>
            </div>
          </div>

          <div style={{ background: 'var(--slate-50)', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)' }}>
              Live Speed
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.8rem', fontWeight: 800, color: 'var(--slate-900)', marginTop: '0.25rem' }}>
              {currentSpeedKmh.toFixed(1)} <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>km/h</span>
            </div>
          </div>
        </div>

        {/* Real-Time Dual Rewards Accumulation Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
          color: '#ffffff',
          borderRadius: '14px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              Fitness Points
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
              <Flame size={18} fill="#f97316" color="#f97316" />
              <span>+{Math.round(distanceKm * (journeyMode === 'WALKING' ? 15 : 10))} FP</span>
            </div>
          </div>

          <div style={{ width: '1px', height: '36px', background: 'rgba(255, 255, 255, 0.2)' }} />

          <div>
            <div style={{ fontSize: '0.72rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              Green Credits
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
              <Leaf size={18} fill="#a7f3d0" color="#a7f3d0" />
              <span>+{Math.round(distanceKm * (journeyMode === 'WALKING' ? 10 : 8))} GP</span>
            </div>
          </div>

          <div style={{ width: '1px', height: '36px', background: 'rgba(255, 255, 255, 0.2)' }} />

          <div>
            <div style={{ fontSize: '0.72rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              CO₂ Avoided
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2px' }}>
              {(distanceKm * 0.192).toFixed(2)} <span style={{ fontSize: '0.85rem' }}>kg</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          {!isTracking ? (
            <button
              onClick={handleStartTracking}
              className="btn btn-primary btn-lg"
              style={{ width: '100%', maxWidth: '380px' }}
            >
              <Play size={20} fill="#ffffff" />
              <span>Start Active Journey</span>
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
                    <span>Complete & Verify Journey</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Verified Journey Success Modal / Card */}
      {completionResult && (
        <div className="status-banner success" style={{ maxWidth: '680px', margin: '0 auto 2.5rem', animation: 'fadeIn 0.2s ease' }}>
          <CheckCircle2 size={28} className="text-emerald-600" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', marginBottom: '0.25rem' }}>
              🎉 Journey Verified by AI!
            </div>
            <div style={{ fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>
              <strong>{completionResult.mode}</strong> &bull; {completionResult.distanceKm} km in {completionResult.durationMinutes} mins
            </div>
            <div style={{
              display: 'flex',
              gap: '1rem',
              background: 'rgba(255, 255, 255, 0.8)',
              padding: '0.6rem 1rem',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 700,
            }}>
              <span style={{ color: '#ea580c' }}>+{completionResult.fitnessPointsEarned} Fitness Points</span>
              <span>&bull;</span>
              <span style={{ color: '#059669' }}>+{completionResult.greenCreditsEarned} Green Credits</span>
              <span>&bull;</span>
              <span>{completionResult.co2AvoidedKg} kg CO₂ Saved</span>
            </div>
            <div style={{ fontSize: '0.78rem', marginTop: '0.5rem', opacity: 0.85 }}>
              Reasoning: {completionResult.detectionReasoning}
            </div>
          </div>
        </div>
      )}

      {/* Past Journey History Table */}
      <div className="card" style={{ maxWidth: '850px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)' }}>
              Recent Verified Journeys
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
              AI telemetry log of active commutes and credits earned
            </p>
          </div>
          <Award size={20} className="text-emerald-600" />
        </div>

        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--slate-400)', fontSize: '0.9rem' }}>
            <Compass size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
            <div>No journeys recorded yet. Click "Start Active Journey" above!</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--slate-100)', textAlign: 'left', color: 'var(--slate-500)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Mode</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Distance</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Duration</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Points Earned</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>CO₂ Saved</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((j) => (
                  <tr key={j._id} style={{ borderBottom: '1px solid var(--slate-100)' }}>
                    <td style={{ padding: '0.85rem 0.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {getModeIcon(j.mode, 16)}
                      <span>{j.mode}</span>
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem', fontFamily: 'var(--font-mono)' }}>
                      {j.distanceKm} km
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      {j.durationMinutes} min
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem', fontWeight: 700 }}>
                      <span style={{ color: '#ea580c' }}>+{j.fitnessPointsEarned} FP</span>
                      {' / '}
                      <span style={{ color: '#059669' }}>+{j.greenCreditsEarned} GP</span>
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem', color: 'var(--slate-600)' }}>
                      {j.co2AvoidedKg} kg
                    </td>
                    <td style={{ padding: '0.85rem 0.5rem' }}>
                      <span style={{
                        background: 'var(--primary-50)',
                        color: 'var(--primary-700)',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}>
                        ✓ AI Verified
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
