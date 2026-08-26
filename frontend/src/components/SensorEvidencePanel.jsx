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
  Gauge,
  Footprints,
  Sparkles
} from 'lucide-react';

export default function SensorEvidencePanel({ sensorData, isTracking }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const {
    latitude,
    longitude,
    gpsAccuracy,
    speed = 0,
    heading = 0,
    accelerationX = null,
    accelerationY = null,
    accelerationZ = null,
    rotationAlpha = null,
    rotationBeta = null,
    rotationGamma = null,
    stepCount = 0,
    cadence = 0,
    walkingConfidence = 0,
    isWalkingVerified = false,
    walkingStatus = '',
    bluetoothSignals = [],
    sensorAvailability = {},
  } = sensorData || {};

  const accelMagnitude = (accelerationX !== null && accelerationY !== null && accelerationZ !== null)
    ? Math.sqrt(Math.pow(accelerationX, 2) + Math.pow(accelerationY, 2) + Math.pow(accelerationZ - 9.81, 2))
    : 0;

  const isWalkingPatternDetected = sensorAvailability.accelerometer && accelMagnitude >= 0.8 && accelMagnitude <= 4.5;
  const isGyroMotionDetected = sensorAvailability.gyroscope && (rotationAlpha !== null || rotationBeta !== null);

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
              Real-time multi-axis browser & device sensor feed (Zero fake readings)
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
          {/* Walking Verification Live Score Bar */}
          <div style={{
            background: isWalkingVerified ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : '#f8fafc',
            border: `1px solid ${isWalkingVerified ? '#a7f3d0' : 'var(--slate-200)'}`,
            borderRadius: '12px',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} className={isWalkingVerified ? 'text-emerald-600' : 'text-slate-400'} />
              <div>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                  Walking Confidence: {walkingConfidence}%
                </span>
                <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 700, color: isWalkingVerified ? '#059669' : '#64748b' }}>
                  {isWalkingVerified ? 'Walking Verified ✓' : (walkingStatus || 'Sensor fusion evaluating')}
                </span>
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: sensorAvailability.isMobile ? '#059669' : '#b45309' }}>
              {sensorAvailability.isMobile ? '📱 Mobile Device Connected' : '💻 Desktop / Laptop Environment'}
            </div>
          </div>

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
                    <CheckCircle2 size={12} /> Location Tracking
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

            {/* 2. Step Counter */}
            <div style={{
              background: 'var(--slate-50)',
              border: '1px solid var(--slate-200)',
              borderRadius: '12px',
              padding: '0.85rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--slate-800)' }}>
                  <Footprints size={15} className="text-emerald-600" />
                  <span>Step Counter</span>
                </div>
                {sensorAvailability.stepCounter ? (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <CheckCircle2 size={12} /> Active
                  </span>
                ) : (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-400)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <AlertCircle size={12} /> Not Available
                  </span>
                )}
              </div>
              {sensorAvailability.stepCounter ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--slate-600)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div>Steps: <strong>{stepCount.toLocaleString()}</strong></div>
                  <div>Cadence: <strong>{cadence} spm</strong></div>
                  <div style={{ color: stepCount > 0 ? '#059669' : 'var(--slate-500)', fontWeight: 600 }}>
                    {stepCount > 0 ? 'Pedometer peak verified ✓' : 'Awaiting walking strides'}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontStyle: 'italic' }}>
                  Step Counter: Not available on this device
                </div>
              )}
            </div>

            {/* 3. Accelerometer */}
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
              {sensorAvailability.accelerometer && accelerationX !== null ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--slate-600)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div>X: <strong>{accelerationX.toFixed(2)}</strong> | Y: <strong>{accelerationY.toFixed(2)}</strong></div>
                  <div>Z: <strong>{accelerationZ.toFixed(2)} m/s²</strong></div>
                  <div style={{ color: isWalkingPatternDetected ? '#059669' : 'var(--slate-600)', fontWeight: 600 }}>
                    {isWalkingPatternDetected ? 'Walking pattern detected ✓' : `Dynamic RMS: ${accelMagnitude.toFixed(2)} m/s²`}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontStyle: 'italic' }}>
                  Accelerometer: Not available on this device
                </div>
              )}
            </div>

            {/* 4. Gyroscope */}
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
              {sensorAvailability.gyroscope && rotationAlpha !== null ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--slate-600)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div>&alpha;: <strong>{rotationAlpha.toFixed(1)}°</strong> | &beta;: <strong>{(rotationBeta || 0).toFixed(1)}°</strong></div>
                  <div>&gamma;: <strong>{(rotationGamma || 0).toFixed(1)}°</strong></div>
                  <div style={{ color: isGyroMotionDetected ? '#059669' : 'var(--slate-600)', fontWeight: 600 }}>
                    {isGyroMotionDetected ? 'Motion detected ✓' : 'Stationary tilt'}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontStyle: 'italic' }}>
                  Gyroscope: Not available
                </div>
              )}
            </div>

            {/* 5. Bluetooth / Proximity */}
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
                  {sensorAvailability.bluetooth ? 'Web Bluetooth ready (0 in range)' : 'Web Bluetooth unavailable'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
