import React, { useState } from 'react';
import {
  Car,
  Zap,
  Bus,
  Train,
  Bluetooth,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldAlert,
  Radio,
  X,
  ArrowRight
} from 'lucide-react';
import { bluetoothEVService } from '../services/bluetoothEVService';

export default function VehicleVerificationModal({
  isOpen,
  modalType, // 'VEHICLE_DETECTED' | 'EV_VERIFICATION' | 'FUEL_REJECTED' | 'PUBLIC_TRANSPORT' | 'BLE_WARNING'
  registeredVehicle,
  candidateRoutes = [],
  rejectionReason = '',
  warningMessage = '',
  onClose,
  onVerifyEV,
  onConfirmRoute,
  onDismissRoute,
  onEnableDemoMode,
}) {
  const [isConnectingBLE, setIsConnectingBLE] = useState(false);
  const [bleError, setBleError] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState(candidateRoutes[0]?.routeId || null);

  if (!isOpen) return null;

  const isBluetoothSupported = bluetoothEVService.isSupported();

  const handleConnectBLE = async () => {
    setIsConnectingBLE(true);
    setBleError('');

    try {
      if (!isBluetoothSupported) {
        throw new Error('Web Bluetooth is not supported on this browser. Please use Chrome/Edge on mobile or enable Demo Mode.');
      }
      const expectedId = registeredVehicle?.bluetoothIdentifier || 'GC-EV';
      const result = await bluetoothEVService.connectEV(expectedId);
      if (onVerifyEV) {
        await onVerifyEV(result.identifier, result.deviceName);
      }
    } catch (err) {
      setBleError(err.message || 'Bluetooth connection failed.');
    } finally {
      setIsConnectingBLE(false);
    }
  };

  const handleDemoVerifyEV = async () => {
    const demoId = registeredVehicle?.bluetoothIdentifier || 'GC-EV-8F31A2';
    bluetoothEVService.simulateConnect(demoId);
    if (onVerifyEV) {
      await onVerifyEV(demoId, 'Simulated Green Credit EV BLE (Demo)', true);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '1rem',
    }}>
      <div className="card" style={{
        maxWidth: '480px',
        width: '100%',
        animation: 'fadeIn 0.2s ease',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid var(--slate-200)',
      }}>
        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 1. FUEL REJECTED (PETROL / DIESEL / CNG) */}
        {modalType === 'FUEL_REJECTED' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: '#fef2f2',
                color: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem',
              }}>
                <ShieldAlert size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                Vehicle Not Eligible
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginTop: '0.35rem' }}>
                Your registered vehicle is not eligible for Green Credit transport rewards.
              </p>
            </div>

            <div style={{
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '10px',
              padding: '0.85rem',
              fontSize: '0.82rem',
              color: '#9f1239',
              marginBottom: '1.25rem',
              lineHeight: 1.5,
            }}>
              <strong>Reason:</strong> {rejectionReason || 'Petrol/Diesel/CNG vehicle detected. Fossil-fuel vehicles earn 0 Green Credits.'}
            </div>

            <button
              onClick={onClose}
              className="btn"
              style={{ width: '100%', background: 'var(--slate-800)', color: '#ffffff', fontWeight: 700 }}
            >
              Continue Tracking Without Credits
            </button>
          </div>
        )}

        {/* 2. EV VERIFICATION REQUIRED */}
        {modalType === 'EV_VERIFICATION' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: '#ecfdf5',
                color: '#059669',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem',
              }}>
                <Zap size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                ⚡ EV Verification Required
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginTop: '0.35rem' }}>
                Vehicle movement detected. Please connect your registered EV to verify the journey.
              </p>
            </div>

            {registeredVehicle && (
              <div style={{
                background: 'var(--slate-50)',
                border: '1px solid var(--slate-200)',
                borderRadius: '10px',
                padding: '0.75rem',
                marginBottom: '1rem',
                fontSize: '0.82rem',
              }}>
                <div style={{ fontWeight: 700, color: 'var(--slate-800)' }}>
                  {registeredVehicle.make || registeredVehicle.manufacturer} {registeredVehicle.model}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                  Plate: <strong>{registeredVehicle.registrationNumber}</strong> &bull; BLE ID: {registeredVehicle.bluetoothIdentifier || 'GC-EV-DEFAULT'}
                </div>
              </div>
            )}

            {!isBluetoothSupported && (
              <div style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#92400e',
                borderRadius: '8px',
                padding: '0.7rem',
                fontSize: '0.78rem',
                marginBottom: '1rem',
                lineHeight: 1.4,
              }}>
                <strong>Browser Limitation:</strong> Web Bluetooth is not supported on this browser. Please use Chrome/Edge on mobile or test via <strong>Demo Mode</strong>.
              </div>
            )}

            {bleError && (
              <div style={{
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#be123c',
                borderRadius: '8px',
                padding: '0.6rem 0.8rem',
                fontSize: '0.75rem',
                marginBottom: '1rem',
              }}>
                {bleError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={handleConnectBLE}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
                disabled={isConnectingBLE}
              >
                {isConnectingBLE ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Connecting EV GATT...</span>
                  </>
                ) : (
                  <>
                    <Bluetooth size={18} />
                    <span>Connect EV</span>
                  </>
                )}
              </button>

              {/* Demo Mode trigger */}
              <button
                onClick={handleDemoVerifyEV}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px dashed #059669',
                  background: '#f0fdf4',
                  color: '#047857',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Simulate BLE EV Match (Demo Mode)
              </button>
            </div>
          </div>
        )}

        {/* 3. PUBLIC TRANSPORT CANDIDATE ROUTES */}
        {(modalType === 'PUBLIC_TRANSPORT' || modalType === 'VEHICLE_DETECTED') && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem',
              }}>
                <Bus size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                🚌 Public Transport Detected
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginTop: '0.35rem' }}>
                We detected possible transit movement near your location. Confirm your route to verify credits.
              </p>
            </div>

            {candidateRoutes.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '1.5rem',
                background: 'var(--slate-50)',
                borderRadius: '10px',
                marginBottom: '1rem',
                fontSize: '0.82rem',
                color: 'var(--slate-500)',
              }}>
                Searching for nearby municipal transit corridors...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem', maxHeight: '220px', overflowY: 'auto' }}>
                {candidateRoutes.map((rt) => {
                  const isSelected = selectedRouteId === rt.routeId || (!selectedRouteId && candidateRoutes[0]?.routeId === rt.routeId);
                  return (
                    <div
                      key={rt.routeId}
                      onClick={() => setSelectedRouteId(rt.routeId)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid #2563eb' : '1px solid var(--slate-200)',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--slate-900)' }}>
                          {rt.name}
                        </div>
                        <span style={{
                          background: isSelected ? '#2563eb' : '#e2e8f0',
                          color: isSelected ? '#ffffff' : 'var(--slate-700)',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                        }}>
                          {rt.matchPercentage || 85}% Match
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                        Nearest Stop: <strong>{rt.nearestStop?.name || 'Corridor'}</strong> ({rt.distanceMeters || 45}m away)
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  const targetRoute = candidateRoutes.find((r) => r.routeId === selectedRouteId) || candidateRoutes[0];
                  if (targetRoute && onConfirmRoute) onConfirmRoute(targetRoute);
                }}
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={candidateRoutes.length === 0}
              >
                Confirm Bus / Metro
              </button>
              <button
                onClick={onDismissRoute || onClose}
                className="btn"
                style={{ background: 'var(--slate-100)', color: 'var(--slate-700)' }}
              >
                Not My Bus
              </button>
            </div>
          </div>
        )}

        {/* 4. BLE WARNING (TEMPORARILY LOST) */}
        {modalType === 'BLE_WARNING' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: '#fffbeb',
                color: '#d97706',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem',
              }}>
                <AlertTriangle size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                ⚠️ EV Verification Warning
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginTop: '0.35rem' }}>
                {warningMessage || 'EV verification temporarily lost. Reconnecting...'}
              </p>
            </div>

            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '10px',
              padding: '0.85rem',
              fontSize: '0.8rem',
              color: '#92400e',
              marginBottom: '1.25rem',
              lineHeight: 1.4,
            }}>
              A 45-second grace period is active. If Bluetooth reconnects, your EV Green Credits will continue uninterrupted.
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleConnectBLE}
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Reconnect Now
              </button>
              <button
                onClick={onClose}
                className="btn"
                style={{ background: 'var(--slate-100)', color: 'var(--slate-700)' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
