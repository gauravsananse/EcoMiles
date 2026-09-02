import React from 'react';
import {
  Terminal,
  Play,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  Footprints,
  Zap,
  Bus,
  Car,
  AlertOctagon,
  BluetoothOff
} from 'lucide-react';
import { REPLAY_PROFILES } from '../services/replayDatasets';

export default function DeveloperTestModeBar({
  isTestMode,
  selectedProfileKey,
  onToggleTestMode,
  onSelectProfile,
  onSimulateScenario,
  currentLegIndex = 0,
}) {
  const profile = REPLAY_PROFILES[selectedProfileKey] || REPLAY_PROFILES.walking;

  const DEMO_SCENARIOS = [
    { key: 'WALKING', label: 'Simulate Walking', icon: Footprints, color: '#10b981' },
    { key: 'EV_DETECTED', label: 'Simulate EV Detection', icon: Zap, color: '#f59e0b' },
    { key: 'EV_VERIFIED', label: 'Simulate EV Verified', icon: Zap, color: '#10b981' },
    { key: 'EV_BLE_LOST', label: 'Simulate EV Bluetooth Lost', icon: BluetoothOff, color: '#ef4444' },
    { key: 'BUS_DETECTED', label: 'Simulate Bus Detection', icon: Bus, color: '#3b82f6' },
    { key: 'BUS_VERIFIED', label: 'Simulate Bus Verification', icon: Bus, color: '#10b981' },
    { key: 'PETROL_VEHICLE', label: 'Simulate Petrol Vehicle', icon: Car, color: '#f43f5e' },
    { key: 'FRAUD_TELEPORT', label: 'Simulate Fraud / Teleport', icon: AlertOctagon, color: '#dc2626' },
    { key: 'WALKING_AGAIN', label: 'Simulate Walking Again', icon: Footprints, color: '#10b981' },
  ];

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
                {isTestMode ? 'DEMO & VERIFICATION TEST MODE' : 'LIVE DEVICE SENSOR MODE'}
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
                {isTestMode ? 'DEMO MODE' : 'REAL HARDWARE'}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: isTestMode ? '#94a3b8' : 'var(--slate-500)' }}>
              {isTestMode
                ? 'Simulate multi-modal transitions, EV verification, bus matching, fossil fuel rejection, and anti-fraud.'
                : 'Uses real device Geolocation, Accelerometer, Gyroscope & Web Bluetooth APIs.'}
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
            {isTestMode ? 'Switch to Live Hardware Mode' : 'Enable Demo Test Mode'}
          </button>
        </div>
      </div>

      {/* Demo Scenario Shortcuts if in Test Mode */}
      {isTestMode && (
        <div style={{ marginTop: '0.85rem', borderTop: '1px solid #334155', paddingTop: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.04em' }}>
            Multi-Modal Simulation Triggers (Section 47 & 48 Test Scenarios):
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {DEMO_SCENARIOS.map((sc) => {
              const Icon = sc.icon;
              return (
                <button
                  key={sc.key}
                  type="button"
                  onClick={() => onSimulateScenario && onSimulateScenario(sc.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 9px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: '#1e293b',
                    color: '#ffffff',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.borderColor = sc.color)}
                  onMouseOut={(e) => (e.currentTarget.style.borderColor = '#475569')}
                >
                  <Icon size={13} style={{ color: sc.color }} />
                  <span>{sc.label}</span>
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
              <strong>Replay Dataset: {profile.name}</strong> &bull; {profile.description}
            </div>

            {profile.isMultiLeg && (
              <span style={{ color: '#38bdf8', fontWeight: 700, whiteSpace: 'nowrap' }}>
                Leg: {profile.legs[currentLegIndex]?.legName}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
