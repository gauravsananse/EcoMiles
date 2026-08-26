import React from 'react';
import {
  Footprints,
  Bike,
  Bus,
  Train,
  Car,
  Navigation,
  CheckCircle2,
  Clock,
  Flame,
  Leaf,
  ShieldCheck,
  AlertTriangle,
  Lock
} from 'lucide-react';

const MODE_ICONS = {
  WALKING: Footprints,
  CYCLING: Bike,
  BUS: Bus,
  METRO: Train,
  CAR: Car,
  SCOOTER: Navigation,
  STATIONARY: Clock,
};

export default function JourneyTimeline({ segments = [], totalCredits = 0, totalPoints = 0 }) {
  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getStatusBadge = (status, fraudScore) => {
    if (fraudScore > 50 || status === 'HELD' || status === 'REJECTED') {
      return (
        <span style={{
          background: '#fee2e2',
          color: '#991b1b',
          border: '1px solid #f87171',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '0.7rem',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
        }}>
          <AlertTriangle size={11} /> Flagged / Held
        </span>
      );
    }

    if (status === 'VERIFIED' || status === 'RELEASED') {
      return (
        <span style={{
          background: '#ecfdf5',
          color: '#065f46',
          border: '1px solid #a7f3d0',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '0.7rem',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
        }}>
          <CheckCircle2 size={11} /> {status === 'RELEASED' ? 'Released' : 'Verified'}
        </span>
      );
    }

    return (
      <span style={{
        background: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fcd34d',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '0.7rem',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
      }}>
        <Lock size={11} /> Pending Lock
      </span>
    );
  };

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-900)' }}>
            Dynamic Journey Segmentation Timeline
          </h3>
          <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
            Automatic multi-leg transition tracking & cryptographic reward locking
          </div>
        </div>

        {/* Total Aggregates Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'var(--slate-100)',
          padding: '4px 10px',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 700,
        }}>
          <span style={{ color: '#ea580c', display: 'flex', alignItems: 'center', gap: '2px' }}>
            <Flame size={13} fill="#ea580c" /> +{totalPoints} FP
          </span>
          <span>&bull;</span>
          <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '2px' }}>
            <Leaf size={13} fill="#059669" /> +{totalCredits} GP
          </span>
        </div>
      </div>

      {segments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--slate-400)', fontSize: '0.85rem' }}>
          No active segments recorded. Press "Start Journey" to initiate continuous telemetry tracking.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
          {/* Vertical line indicator */}
          <div style={{
            position: 'absolute',
            top: '20px',
            bottom: '20px',
            left: '18px',
            width: '2px',
            background: 'var(--slate-200)',
            zIndex: 0,
          }} />

          {segments.map((seg, idx) => {
            const Icon = MODE_ICONS[seg.mode] || Navigation;
            const isCar = seg.mode === 'CAR' || seg.mode === 'SCOOTER';

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.85rem',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {/* Node Dot */}
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: isCar ? '#f1f5f9' : '#ecfdf5',
                  border: isCar ? '2px solid #cbd5e1' : '2px solid #10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isCar ? '#64748b' : '#059669',
                  flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                }}>
                  <Icon size={18} />
                </div>

                {/* Segment Content Card */}
                <div style={{
                  flex: 1,
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-200)',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--slate-900)' }}>
                        Segment {idx + 1}: {seg.mode}
                      </span>
                      {getStatusBadge(seg.rewardStatus || seg.verificationStatus, seg.fraudScore)}
                    </div>

                    <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--slate-500)' }}>
                      {formatTime(seg.startTime)} &ndash; {seg.endTime ? formatTime(seg.endTime) : 'Active Now'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--slate-600)', marginBottom: '0.4rem' }}>
                    <span><strong>{(seg.distanceKm || 0).toFixed(2)} km</strong></span>
                    <span>&bull;</span>
                    <span><strong>{(seg.durationMinutes || 0.1).toFixed(1)} mins</strong></span>
                    <span>&bull;</span>
                    <span>Conf: {Math.round((seg.confidence || 0.9) * 100)}%</span>
                  </div>

                  {/* Rewards Breakdown */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--slate-200)', paddingTop: '0.4rem', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      {seg.earnedFitnessPoints > 0 && (
                        <span style={{ color: '#ea580c', fontWeight: 700 }}>+{seg.earnedFitnessPoints} FP</span>
                      )}
                      {seg.earnedGreenCredits > 0 && (
                        <span style={{ color: '#059669', fontWeight: 700 }}>+{seg.earnedGreenCredits} GP</span>
                      )}
                      {isCar && (
                        <span style={{ color: 'var(--slate-400)', fontStyle: 'italic' }}>0 GP (Private Vehicle)</span>
                      )}
                    </div>

                    {seg.fraudScore > 0 && (
                      <div style={{ fontSize: '0.72rem', color: seg.fraudScore > 50 ? '#dc2626' : '#d97706', fontWeight: 700 }}>
                        Risk Score: {seg.fraudScore}/100
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
