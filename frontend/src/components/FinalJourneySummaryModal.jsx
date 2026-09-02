import React from 'react';
import {
  CheckCircle2,
  Footprints,
  Bike,
  Bus,
  Train,
  Zap,
  Flame,
  Leaf,
  AlertCircle,
  MapPin,
  Clock,
  Award,
  Trophy
} from 'lucide-react';

const MODE_ICONS = {
  WALK: Footprints,
  WALKING: Footprints,
  CYCLING: Bike,
  BUS: Bus,
  METRO: Train,
  PUBLIC_TRANSPORT: Bus,
  EV: Zap,
};

const MODE_LABELS = {
  WALK: '🚶 Walking',
  WALKING: '🚶 Walking',
  CYCLING: '🚲 Cycling',
  BUS: '🚌 Public Bus',
  METRO: '🚇 Metro / Rail',
  PUBLIC_TRANSPORT: '🚌 Public Transport',
  EV: '⚡ Electric Vehicle',
};

const MODE_COLORS = {
  WALK: { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
  WALKING: { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
  CYCLING: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  BUS: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  METRO: { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
  PUBLIC_TRANSPORT: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  EV: { bg: '#fefce8', color: '#92400e', border: '#fde68a' },
};

function formatDuration(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function SegmentRow({ segment, index }) {
  const mode = segment.selectedMode || segment.mode || 'WALK';
  const Icon = MODE_ICONS[mode] || Bus;
  const c = MODE_COLORS[mode] || MODE_COLORS.WALK;
  const isVerified = segment.verificationStatus === 'VERIFIED';

  return (
    <div style={{
      display: 'flex', gap: '0.75rem', padding: '0.85rem',
      border: '1px solid var(--slate-100)', borderRadius: '10px',
      background: '#fafafa',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '8px',
        background: c.bg, color: c.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--slate-900)' }}>
            {MODE_LABELS[mode] || mode}
            {segment.selectedRouteName && <span style={{ fontWeight: 400, color: 'var(--slate-500)', marginLeft: '5px' }}>· {segment.selectedRouteName}</span>}
          </div>
          <span style={{
            fontSize: '0.7rem', fontWeight: 800, padding: '2px 7px', borderRadius: '9999px',
            background: isVerified ? '#ecfdf5' : '#fef3c7',
            color: isVerified ? '#065f46' : '#92400e',
          }}>
            {isVerified ? '✓ Verified' : 'Pending'}
          </span>
        </div>

        <div style={{ fontSize: '0.77rem', color: 'var(--slate-500)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
          <span>{Number(segment.distanceKm || 0).toFixed(2)} km</span>
          <span>·</span>
          <span>{formatDuration(segment.durationMinutes)}</span>
          {(mode === 'WALK' || mode === 'WALKING') && segment.verifiedSteps > 0 && (
            <><span>·</span><span>{segment.verifiedSteps.toLocaleString()} verified steps</span></>
          )}
          {formatTime(segment.startTime) && (
            <><span>·</span><span>{formatTime(segment.startTime)}–{formatTime(segment.endTime)}</span></>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {segment.earnedFitnessPoints > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.8rem', fontWeight: 700, color: '#ea580c' }}>
              <Flame size={13} fill="#f97316" color="#f97316" />
              +{segment.earnedFitnessPoints} FP
            </span>
          )}
          {segment.earnedGreenCredits > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.8rem', fontWeight: 700, color: '#059669' }}>
              <Leaf size={13} fill="#059669" color="#059669" />
              +{segment.earnedGreenCredits} GP
            </span>
          )}
          {(segment.earnedFitnessPoints === 0 && segment.earnedGreenCredits === 0) && (
            <span style={{ fontSize: '0.77rem', color: 'var(--slate-400)' }}>No rewards (unverified or ineligible)</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FinalJourneySummaryModal({ journey, totals, onClose, onViewJourney }) {
  if (!journey) return null;

  const segments = journey.segments || [];
  const t = totals || {
    totalFitnessPoints: segments.reduce((a, s) => a + (s.earnedFitnessPoints || 0), 0),
    totalGreenCredits: segments.reduce((a, s) => a + (s.earnedGreenCredits || 0), 0),
    totalCombinedPoints: 0,
    totalDistanceKm: segments.reduce((a, s) => a + (s.distanceKm || 0), 0),
    totalDurationMinutes: segments.reduce((a, s) => a + (s.durationMinutes || 0), 0),
    totalCO2Saved: 0,
    totalVerifiedSteps: segments.reduce((a, s) => a + (s.verifiedSteps || 0), 0),
    overallVerificationStatus: 'PENDING',
  };
  t.totalCombinedPoints = t.totalCombinedPoints || (t.totalFitnessPoints + t.totalGreenCredits);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10002, padding: '1rem', overflowY: 'auto',
    }}>
      <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '1.75rem', animation: 'fadeIn 0.3s ease', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #064e3b, #047857)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 0.75rem', color: '#fff',
          }}>
            <Trophy size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
            Journey Complete ✓
          </h2>
          <div style={{ color: 'var(--slate-500)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
            {journey.origin?.name || 'Start'} → {journey.destination?.name || 'Destination'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--slate-400)', flexWrap: 'wrap' }}>
            <span>⏱ {formatDuration(t.totalDurationMinutes)}</span>
            <span>·</span>
            <span>📍 {Number(t.totalDistanceKm || 0).toFixed(2)} km</span>
            <span>·</span>
            <span>🚶 {(t.totalVerifiedSteps || 0).toLocaleString()} verified steps</span>
          </div>
        </div>

        {/* Combined Rewards Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
          borderRadius: '14px', padding: '1.15rem 1.5rem', color: '#fff',
          display: 'flex', justifyContent: 'space-around', textAlign: 'center',
          marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem',
        }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: '#a7f3d0', fontWeight: 700, textTransform: 'uppercase' }}>Total Fitness Points</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
              <Flame size={16} fill="#f97316" color="#f97316" />
              +{t.totalFitnessPoints}
            </div>
          </div>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <div style={{ fontSize: '0.68rem', color: '#a7f3d0', fontWeight: 700, textTransform: 'uppercase' }}>Total Green Credits</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
              <Leaf size={16} fill="#a7f3d0" color="#a7f3d0" />
              +{t.totalGreenCredits}
            </div>
          </div>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <div style={{ fontSize: '0.68rem', color: '#a7f3d0', fontWeight: 700, textTransform: 'uppercase' }}>Combined Points</div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
              <Award size={16} fill="#fcd34d" color="#fcd34d" />
              +{t.totalCombinedPoints}
            </div>
          </div>
        </div>

        {/* CO2 Saved */}
        {t.totalCO2Saved > 0 && (
          <div style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '0.65rem 1rem', marginBottom: '1.25rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065f46' }}>
              🌱 CO₂ Avoided: {Number(t.totalCO2Saved).toFixed(2)} kg
            </span>
          </div>
        )}

        {/* Formula Note */}
        <div style={{ background: '#f8fafc', border: '1px solid var(--slate-200)', borderRadius: '8px', padding: '0.5rem 0.85rem', marginBottom: '1.25rem', fontSize: '0.75rem', color: 'var(--slate-500)', textAlign: 'center' }}>
          Combined Points = Fitness Points ({t.totalFitnessPoints}) + Green Credits ({t.totalGreenCredits}) = <strong>{t.totalCombinedPoints}</strong>
        </div>

        {/* Individual Segments */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.65rem' }}>
            YOUR JOURNEY
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {segments.map((seg, i) => (
              <SegmentRow key={i} segment={seg} index={i} />
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {onViewJourney && (
            <button onClick={onViewJourney} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}>
              View Journey Details
            </button>
          )}
          <button onClick={onClose} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
            Close & Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}
