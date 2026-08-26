import React from 'react';
import {
  Footprints,
  Bike,
  Bus,
  Train,
  Car,
  Zap,
  Navigation,
  Activity
} from 'lucide-react';

const MODE_CONFIG = {
  walking: { label: 'Walking', icon: Footprints, color: '#10b981' },
  cycling: { label: 'Cycling', icon: Bike, color: '#f59e0b' },
  bus: { label: 'Bus (Transit)', icon: Bus, color: '#3b82f6' },
  metro: { label: 'Metro / Rail', icon: Train, color: '#8b5cf6' },
  car: { label: 'Private Car', icon: Car, color: '#64748b' },
  scooter: { label: 'Motor Scooter', icon: Navigation, color: '#f97316' },
  stationary: { label: 'Stationary', icon: Activity, color: '#94a3b8' },
};

export default function MultiSignalMatrix({ probabilities = {}, currentMode = 'STATIONARY' }) {
  const modes = ['walking', 'cycling', 'bus', 'metro', 'car', 'scooter', 'stationary'];

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-900)' }}>
            Sensor Fusion Probability Matrix
          </h3>
          <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
            Bayesian ensemble posterior distribution across 7 mobility modes
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {modes.map((m) => {
          const cfg = MODE_CONFIG[m];
          const Icon = cfg.icon;
          const prob = probabilities[m] !== undefined ? probabilities[m] : 0.05;
          const percent = Math.round(prob * 100);
          const isSelected = currentMode.toLowerCase() === m;

          return (
            <div
              key={m}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.45rem 0.65rem',
                borderRadius: '10px',
                background: isSelected ? 'var(--slate-50)' : 'transparent',
                border: isSelected ? `1px solid ${cfg.color}40` : '1px solid transparent',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Mode Icon */}
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: `${cfg.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: cfg.color,
                flexShrink: 0,
              }}>
                <Icon size={16} />
              </div>

              {/* Label */}
              <div style={{ width: '110px', fontSize: '0.8rem', fontWeight: isSelected ? 800 : 600, color: 'var(--slate-800)', flexShrink: 0 }}>
                {cfg.label}
              </div>

              {/* Bar Container */}
              <div style={{ flex: 1, height: '8px', background: 'var(--slate-100)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${percent}%`,
                    background: cfg.color,
                    borderRadius: '9999px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>

              {/* Percentage */}
              <div style={{ width: '42px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700, color: isSelected ? cfg.color : 'var(--slate-600)' }}>
                {percent}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
