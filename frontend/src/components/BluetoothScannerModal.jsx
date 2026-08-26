import React, { useState } from 'react';
import {
  Bluetooth,
  Radio,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Signal
} from 'lucide-react';
import { sensorManager } from '../services/sensorManager';

export default function BluetoothScannerModal({ isOpen, onClose, onBeaconDetected }) {
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleScan = async () => {
    setIsScanning(true);
    setErrorMessage('');
    try {
      const res = await sensorManager.scanForBluetoothBeacons();
      if (res.success && res.device) {
        setDiscoveredDevices((prev) => [res.device, ...prev]);
        if (onBeaconDetected) onBeaconDetected(res.device);
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    } catch (err) {
      setErrorMessage(err.message || 'BLE scan error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSimulateBeacon = (type) => {
    const mockBeacon = {
      beaconId: type === 'BUS' ? 'BEACON-BUS-104' : 'BEACON-METRO-09',
      transportType: type,
      name: type === 'BUS' ? 'MUTA Smart Bus 104 BLE Beacon' : 'Metro Gate Stn-09 Beacon',
      rssi: -58,
      timestamp: Date.now(),
    };
    setDiscoveredDevices((prev) => [mockBeacon, ...prev]);
    if (onBeaconDetected) onBeaconDetected(mockBeacon);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem',
    }}>
      <div className="card" style={{ maxWidth: '480px', width: '100%', animation: 'fadeIn 0.2s ease' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
            }}>
              <Bluetooth size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                Nearby Transit BLE Beacons
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                Web Bluetooth proximity verification
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Info Banner */}
        <div style={{
          background: 'var(--slate-50)',
          border: '1px solid var(--slate-200)',
          borderRadius: '10px',
          padding: '0.75rem',
          fontSize: '0.78rem',
          color: 'var(--slate-600)',
          marginBottom: '1rem',
          lineHeight: 1.4,
        }}>
          Municipal transit beacons broadcast cryptographic identifiers on buses and rail platforms. Detection of a verified beacon strengthens Public Transport Confidence.
        </div>

        {/* Scan Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <button
            onClick={handleScan}
            className="btn btn-primary"
            style={{ flex: 1 }}
            disabled={isScanning}
          >
            {isScanning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Scanning BLE...</span>
              </>
            ) : (
              <>
                <Radio size={16} />
                <span>Scan for BLE Devices</span>
              </>
            )}
          </button>
        </div>

        {/* Simulated Beacon Buttons for Desktop Testing */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Desktop / Emulation Mode:
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => handleSimulateBeacon('BUS')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Bus 104 Beacon
            </button>
            <button
              onClick={() => handleSimulateBeacon('METRO')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #ddd6fe',
                background: '#f5f3ff',
                color: '#6d28d9',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Metro Gate Beacon
            </button>
          </div>
        </div>

        {errorMessage && (
          <div style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#be123c',
            borderRadius: '8px',
            padding: '0.6rem 0.8rem',
            fontSize: '0.75rem',
            marginBottom: '1rem',
          }}>
            {errorMessage}
          </div>
        )}

        {/* Discovered List */}
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', marginBottom: '0.5rem' }}>
            Discovered Signals ({discoveredDevices.length})
          </div>

          {discoveredDevices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--slate-400)', fontSize: '0.8rem' }}>
              No Bluetooth devices detected yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
              {discoveredDevices.map((dev, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--slate-50)',
                    border: '1px solid var(--slate-200)',
                    borderRadius: '8px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--slate-900)' }}>
                      {dev.name || 'Unnamed Device'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>
                      Type: <strong>{dev.transportType || 'UNKNOWN'}</strong> &bull; RSSI: {dev.rssi || -70} dBm
                    </div>
                  </div>
                  <span style={{
                    background: '#ecfdf5',
                    color: '#065f46',
                    padding: '2px 6px',
                    borderRadius: '9999px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                  }}>
                    ✓ Verified
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
