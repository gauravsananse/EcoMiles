import React from 'react';
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Footprints,
  Bike,
  Bus,
  Train,
  Zap,
  ArrowRight,
  Clock,
  MapPin,
  Flame,
  Leaf,
  AlertCircle,
  Award
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
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ModeChip({ mode }) {
  const Icon = MODE_ICONS[mode] || Bus;
  const style = MODE_COLORS[mode] || MODE_COLORS.WALK;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: style.bg, color: style.color, border: `1px solid ${style.border}`,
      padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
    }}>
      <Icon size={13} />
      {mode === 'PUBLIC_TRANSPORT' ? 'BUS / METRO' : mode}
    </span>
  );
}

export default function SegmentTransitionModal({ segment, segmentIndex, onContinueJourney, onEndJourney, journeySegmentsCount = 1 }) {
  const [expanded, setExpanded] = React.useState(false);

  if (!segment) return null;

  const mode = segment.selectedMode || segment.mode || 'WALK';
  const Icon = MODE_ICONS[mode] || Footprints;
  const isVerified = segment.verificationStatus === 'VERIFIED' || segment.rewardStatus === 'VERIFIED';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10001, padding: '1rem',
    }}>
      <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '1.75rem', animation: 'fadeIn 0.25s ease' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: isVerified ? '#ecfdf5' : '#fef3c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 0.6rem', color: isVerified ? '#059669' : '#d97706',
          }}>
            {isVerified ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}
          </div>

          <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--slate-900)' }}>
            Segment {segmentIndex + 1} Completed ✓
          </div>

          <div style={{ marginTop: '0.35rem' }}>
            <ModeChip mode={mode} />
          </div>
        </div>

        {/* Segment Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: '0.65rem',
          marginBottom: '1.25rem',
        }}>
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--slate-400)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Distance</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-700)' }}>
              {Number(segment.distanceKm || 0).toFixed(2)} <span style={{ fontSize: '0.75rem' }}>km</span>
            </div>
          </div>

          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--slate-400)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Duration</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)' }}>
              {formatDuration(segment.durationMinutes)}
            </div>
          </div>

          {(mode === 'WALK' || mode === 'WALKING') && (
            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--slate-400)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>Verified Steps</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>
                {(segment.verifiedSteps || 0).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Rewards Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
          borderRadius: '12px', padding: '1rem 1.25rem', color: '#fff',
          display: 'flex', justifyContent: 'space-around', textAlign: 'center',
          marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem',
        }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: '#a7f3d0', fontWeight: 700, textTransform: 'uppercase' }}>Fitness Points</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
              <Flame size={15} fill="#f97316" color="#f97316" />
              <span>+{segment.earnedFitnessPoints || 0} FP</span>
            </div>
          </div>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <div style={{ fontSize: '0.68rem', color: '#a7f3d0', fontWeight: 700, textTransform: 'uppercase' }}>Green Credits</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px' }}>
              <Leaf size={15} fill="#a7f3d0" color="#a7f3d0" />
              <span>+{segment.earnedGreenCredits || 0} GP</span>
            </div>
          </div>

          {segment.earnedCombinedPoints > 0 && (
            <>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
              <div>
                <div style={{ fontSize: '0.68rem', color: '#a7f3d0', fontWeight: 700, textTransform: 'uppercase' }}>Combined</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '2px' }}>
                  +{segment.earnedCombinedPoints || 0} pts
                </div>
              </div>
            </>
          )}
        </div>

        {/* Verification Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: isVerified ? '#ecfdf5' : '#fef3c7',
            color: isVerified ? '#065f46' : '#92400e',
            border: `1px solid ${isVerified ? '#a7f3d0' : '#fcd34d'}`,
            padding: '4px 12px', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 800,
          }}>
            {isVerified ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {isVerified ? '✓ Verified' : 'Pending Verification'}
            {segment.confidence ? ` · ${Math.round(segment.confidence * 100)}%` : ''}
          </span>
        </div>

        {/* What's next heading */}
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', color: 'var(--slate-500)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          What do you want to do next?
        </div>

        {/* Continue / End Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <button
            onClick={onContinueJourney}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem 1rem', fontSize: '1rem', gap: '0.5rem' }}
          >
            <ArrowRight size={18} />
            <span>Continue Journey — Add Next Segment</span>
          </button>

          <button
            onClick={onEndJourney}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.65rem 1rem', fontSize: '0.92rem' }}
          >
            <CheckCircle2 size={16} />
            <span>End Entire Journey & Collect Rewards</span>
          </button>
        </div>
      </div>
    </div>
  );
}
