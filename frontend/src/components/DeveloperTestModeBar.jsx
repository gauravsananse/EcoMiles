import React from 'react';
import { Terminal, Play, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { REPLAY_PROFILES } from '../services/replayDatasets';

export default function DeveloperTestModeBar({
  isTestMode,
  selectedProfileKey,
  onToggleTestMode,
  onSelectProfile,
  onReplayNextFrame,
  currentLegIndex = 0,
}) {
  const profile = REPLAY_PROFILES[selectedProfileKey] || REPLAY_PROFILES.walking;

  return (
    <div style={{
      background: isTestMode ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : '#f8fafc',
      color: isTestMode ? '#f8fafc' : 'var(--slate-700)',
      border: isTestMode ? '1px solid #334155' : '1px solid var(--slate-200)',
      borderRadius: '14px',
      padding: '0.85rem 1.15rem',
      marginBottom: '1.5rem',
      boxShadow: isTestMode ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
      transition: 'all 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        {/* Title & Mode Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: isTestMode ? '#f59e0b' : 'var(--slate-200)',
            color: isTestMode ? '#0f172a' : 'var(--slate-600)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Terminal size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>
                {isTestMode ? 'TEST MODE — REPLAYED SENSOR DATA' : 'LIVE DEVICE SENSOR MODE'}
              </span>
              <span style={{
                background: isTestMode ? '#fef3c7' : '#ecfdf5',
                color: isTestMode ? '#92400e' : '#065f46',
                border: isTestMode ? '1px solid #fcd34d' : '1px solid #a7f3d0',
                padding: '1px 6px',
                borderRadius: '9999px',
                fontSize: '0.68rem',
                fontWeight: 700,
              }}>
                {isTestMode ? 'SIMULATED TELEMETRY' : 'REAL BROWSER SENSORS'}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: isTestMode ? '#94a3b8' : 'var(--slate-500)' }}>
              {isTestMode
                ? 'Feeds recorded multi-modal kinematics through the exact same ML inference pipeline.'
                : 'Uses real device Geolocation, Accelerometer, Gyroscope & Bluetooth APIs.'}
            </div>
          </div>
        </div>

        {/* Toggle Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onToggleTestMode}
            style={{
              padding: '5px 12px',
              borderRadius: '8px',
              border: isTestMode ? '1px solid #f59e0b' : '1px solid var(--slate-300)',
              background: isTestMode ? '#f59e0b' : '#ffffff',
              color: isTestMode ? '#0f172a' : 'var(--slate-800)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isTestMode ? 'Switch to Live Device Mode' : 'Enable Developer Test Mode'}
          </button>
        </div>
      </div>

      {/* Profile Selector if in Test Mode */}
      {isTestMode && (
        <div style={{ marginTop: '0.85rem', borderTop: '1px solid #334155', paddingTop: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.04em' }}>
            Select Recorded Kinematic Scenario:
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.65rem' }}>
            {Object.keys(REPLAY_PROFILES).map((key) => {
              const p = REPLAY_PROFILES[key];
              const isSelected = selectedProfileKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectProfile(key)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: isSelected ? '1px solid #38bdf8' : '1px solid #475569',
                    background: isSelected ? '#0284c7' : '#1e293b',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                  }}
                >
                  {p.name.split(' ')[0]} {p.name.split(' ')[1]}
                </button>
              );
            })}
          </div>

          <div style={{
            background: '#0f172a',
            borderRadius: '8px',
            padding: '0.6rem 0.8rem',
            fontSize: '0.75rem',
            color: '#cbd5e1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <strong>{profile.name}</strong>: {profile.description}
            </div>

            {profile.isMultiLeg && (
              <span style={{ color: '#38bdf8', fontWeight: 700, whiteSpace: 'nowrap' }}>
                Active: {profile.legs[currentLegIndex]?.legName}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
