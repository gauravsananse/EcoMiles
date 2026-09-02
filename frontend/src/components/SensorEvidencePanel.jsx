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
    accelerationMagnitude = 0,
    dynamicMagnitude = 0,
    rotationAlpha = null,
    rotationBeta = null,
    rotationGamma = null,
    rotationalVelocity = 0,
    stepCount = 0,
    cadence = 0,
    walkingConfidence = 0,
    isWalkingVerified = false,
    walkingStatus = '',
    bluetoothSignals = [],
    sensorAvailability = {},
  } = sensorData || {};

  const effectiveDynamicMag = dynamicMagnitude || (
    (accelerationX !== null && accelerationY !== null && accelerationZ !== null)
      ? Math.abs(Math.sqrt(accelerationX * accelerationX + accelerationY * accelerationY + accelerationZ * accelerationZ) - 9.81)
      : 0
  );

  const isWalkingPatternDetected = sensorAvailability.accelerometer && (effectiveDynamicMag >= 0.65 || (stepCount > 0 && cadence > 40));
  const isGyroMotionDetected = sensorAvailability.gyroscope && (rotationalVelocity > 1.5 || rotationAlpha !== null);

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
              Streaming Active
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
                    <CheckCircle2 size={12} /> Active
                  </span>
                ) : (
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <XCircle size={12} /> Unavailable
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-600)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div>Speed: <strong>{Number(speed || 0).toFixed(1)} km/h</strong></div>
                <div>Accuracy: <strong>&plusmn;{gpsAccuracy ? `${Math.round(gpsAccuracy)}m` : 'Fixing...'}</strong></div>
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
                  <div>Steps: <strong style={{ fontSize: '0.9rem', color: 'var(--slate-900)' }}>{(stepCount || 0).toLocaleString()}</strong></div>
                  <div>Cadence: <strong>{speed >= 7.8 ? '0 (Vehicular)' : `${cadence || 0} spm`}</strong></div>
                  <div style={{ color: speed >= 7.8 ? '#d97706' : (stepCount > 0 ? '#059669' : 'var(--slate-500)'), fontWeight: 600 }}>
                    {speed >= 7.8 ? 'Vehicular speed — Steps paused' : (stepCount > 0 ? 'Pedometer cadence verified ✓' : 'Awaiting 4-step walking rhythm')}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontStyle: 'italic' }}>
                  Step Counter: Requires mobile motion sensors
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
                  <div>X: <strong>{Number(accelerationX || 0).toFixed(2)}</strong> | Y: <strong>{Number(accelerationY || 0).toFixed(2)}</strong></div>
                  <div>Z: <strong>{Number(accelerationZ || 0).toFixed(2)} m/s²</strong></div>
                  <div style={{ color: isWalkingPatternDetected ? '#059669' : 'var(--slate-600)', fontWeight: 600 }}>
                    {isWalkingPatternDetected ? 'Walking rhythm active ✓' : `Dynamic: ${effectiveDynamicMag.toFixed(2)} m/s²`}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontStyle: 'italic' }}>
                  Accelerometer: Unavailable on this browser/platform
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
                  <div>&alpha;: <strong>{Number(rotationAlpha || 0).toFixed(1)}°</strong> | &beta;: <strong>{Number(rotationBeta || 0).toFixed(1)}°</strong></div>
                  <div>&gamma;: <strong>{Number(rotationGamma || 0).toFixed(1)}°</strong></div>
                  <div style={{ color: isGyroMotionDetected ? '#059669' : 'var(--slate-600)', fontWeight: 600 }}>
                    {rotationalVelocity > 0 ? `Rot Rate: ${rotationalVelocity.toFixed(1)}°/s ✓` : (isGyroMotionDetected ? 'Motion detected ✓' : 'Stationary tilt')}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontStyle: 'italic' }}>
                  Gyroscope: Unavailable on this browser/platform
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
