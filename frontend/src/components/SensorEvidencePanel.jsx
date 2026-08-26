import React, { useState } from 'react';
import {
  Activity,
  Compass,
  Radio,
  Wifi,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bluetooth,
  Gauge
} from 'lucide-react';

export default function SensorEvidencePanel({ sensorData, isTracking }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const {
    latitude,
    longitude,
    gpsAccuracy,
    speed = 0,
    heading = 0,
    accelerationX = 0,
    accelerationY = 0,
    accelerationZ = 9.81,
    rotationAlpha = 0,
    rotationBeta = 0,
    rotationGamma = 0,
    cadence = 0,
    bluetoothSignals = [],
    sensorAvailability = {},
  } = sensorData || {};

  const accelMagnitude = Math.sqrt(
    Math.pow(accelerationX, 2) + Math.pow(accelerationY, 2) + Math.pow(accelerationZ - 9.81, 2)
  );

  return (
    <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
      {/* Panel Header Toggle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--primary-50)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary-700)',
          }}>
            <Activity size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--slate-900)' }}>
              Live Sensor Evidence & Hardware Telemetry
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
              Real-time multi-axis browser & device sensor feed
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isTracking && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} className="animate-pulse-subtle" />
              Streaming (10 Hz)
            </span>
          )}
          {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </div>
      </div>

      {isExpanded && (
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Sensor Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem',
          }}>
            {/* 1. GPS / Location */}
            <div style={{
              background: 'var(--slate-50)',
              border: '1px solid var(--slate-200)',
              borderRadius: '12px',
              padding: '0.85rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-800)' }}>
                  <Compass size={15} className="text-blue-600" />
                  <span>GPS / Kinematics</span>
                </div>
                {sensorAvailability.gps ? (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <CheckCircle2 size={12} /> Connected
                  </span>
                ) : (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <XCircle size={12} /> Unavailable
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-600)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div>Speed: <strong>{speed.toFixed(1)} km/h</strong></div>
                <div>Accuracy: <strong>&plusmn;{gpsAccuracy ? `${Math.round(gpsAccuracy)}m` : 'N/A'}</strong></div>
                <div>Heading: <strong>{heading ? `${Math.round(heading)}°` : '0°'}</strong></div>
              </div>
            </div>

            {/* 2. Accelerometer */}
            <div style={{
              background: 'var(--slate-50)',
              border: '1px solid var(--slate-200)',
              borderRadius: '12px',
              padding: '0.85rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-800)' }}>
                  <Activity size={15} className="text-emerald-600" />
                  <span>Accelerometer</span>
                </div>
                {sensorAvailability.accelerometer ? (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <CheckCircle2 size={12} /> Active
                  </span>
                ) : (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-400)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <AlertCircle size={12} /> Unavailable
                  </span>
                )}
              </div>
              {sensorAvailability.accelerometer ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--slate-600)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div>X: <strong>{accelerationX.toFixed(2)}</strong> | Y: <strong>{accelerationY.toFixed(2)}</strong></div>
                  <div>Z: <strong>{accelerationZ.toFixed(2)} m/s²</strong></div>
                  <div>Dynamic RMS: <strong>{accelMagnitude.toFixed(2)} m/s²</strong></div>
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--slate-400)', fontStyle: 'italic' }}>
                  Unavailable on this device/browser
                </div>
              )}
            </div>

            {/* 3. Gyroscope */}
            <div style={{
              background: 'var(--slate-50)',
              border: '1px solid var(--slate-200)',
              borderRadius: '12px',
              padding: '0.85rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-800)' }}>
                  <Gauge size={15} className="text-purple-600" />
                  <span>Gyroscope / Tilt</span>
                </div>
                {sensorAvailability.gyroscope ? (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <CheckCircle2 size={12} /> Active
                  </span>
                ) : (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-400)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <AlertCircle size={12} /> Unavailable
                  </span>
                )}
              </div>
              {sensorAvailability.gyroscope ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--slate-600)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div>&alpha;: <strong>{rotationAlpha.toFixed(1)}°</strong></div>
                  <div>&beta;: <strong>{rotationBeta.toFixed(1)}°</strong> | &gamma;: <strong>{rotationGamma.toFixed(1)}°</strong></div>
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--slate-400)', fontStyle: 'italic' }}>
                  Unavailable on this device/browser
                </div>
              )}
            </div>

            {/* 4. Bluetooth / Proximity */}
            <div style={{
              background: 'var(--slate-50)',
              border: '1px solid var(--slate-200)',
              borderRadius: '12px',
              padding: '0.85rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-800)' }}>
                  <Bluetooth size={15} className="text-blue-500" />
                  <span>Transit BLE Beacon</span>
                </div>
                {sensorAvailability.bluetooth ? (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <CheckCircle2 size={12} /> Ready
                  </span>
                ) : (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-400)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <AlertCircle size={12} /> Unavailable
                  </span>
                )}
              </div>
              {bluetoothSignals.length > 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 600 }}>
                  ✓ Discovered: {bluetoothSignals[0].name || bluetoothSignals[0].beaconId}
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                  {sensorAvailability.bluetooth ? 'Web Bluetooth ready (0 beacons in range)' : 'Web Bluetooth unavailable in this browser'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
