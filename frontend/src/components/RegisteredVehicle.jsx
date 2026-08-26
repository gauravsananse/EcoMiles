import React, { useState } from 'react';
import {
  CheckCircle2,
  QrCode,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Calendar,
  Zap,
  Loader2,
  Car
} from 'lucide-react';

export default function RegisteredVehicle({
  vehicle,
  onViewQR,
  onRegenerateQR,
  onUnlink,
  isRegenerating,
  isUnlinking,
}) {
  const [showConfirmUnlink, setShowConfirmUnlink] = useState(false);

  if (!vehicle) return null;

  return (
    <div className="card" style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)' }}>
            My Registered EV
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>
            Active vehicle bound to your Green Credits account
          </p>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          background: 'var(--primary-50)',
          color: 'var(--primary-700)',
          border: '1px solid var(--primary-200)',
          padding: '0.3rem 0.75rem',
          borderRadius: '9999px',
          fontSize: '0.8rem',
          fontWeight: 700,
        }}>
          <CheckCircle2 size={14} />
          <span>Active & Verified</span>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 8px 20px rgba(6, 78, 59, 0.25)',
        marginBottom: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle decorative background circle */}
        <div style={{
          position: 'absolute',
          right: '-20px',
          bottom: '-20px',
          width: '140px',
          height: '140px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#a7f3d0',
              fontWeight: 700,
            }}>
              Green Credits EV Pass
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.75rem',
              fontWeight: 800,
              letterSpacing: '2px',
              marginTop: '0.25rem',
            }}>
              {vehicle.registrationNumber}
            </div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(4px)',
            padding: '0.25rem 0.65rem',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
          }}>
            {vehicle.vehicleId || `EV-${vehicle.id?.slice(-4).toUpperCase()}`}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 600 }}>
              Model
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
              {vehicle.manufacturer} {vehicle.model}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 600 }}>
              Fuel / Type
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Zap size={14} fill="#a7f3d0" color="#a7f3d0" />
              <span>{vehicle.fuelType || 'Electric'}</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 600 }}>
              Status
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#d1fae5' }}>
              ● Verified & Active
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.72rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 600 }}>
              Verification Source
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#d1fae5' }}>
              {vehicle.verificationSource || 'National Vahan RC'}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
        <button
          onClick={onViewQR}
          className="btn btn-primary"
          style={{ flex: '1 1 180px' }}
        >
          <QrCode size={17} />
          <span>View QR Code</span>
        </button>

        <button
          onClick={onRegenerateQR}
          className="btn btn-secondary"
          style={{ flex: '1 1 180px' }}
          disabled={isRegenerating}
        >
          {isRegenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Regenerating...</span>
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              <span>Regenerate QR</span>
            </>
          )}
        </button>

        {!showConfirmUnlink ? (
          <button
            onClick={() => setShowConfirmUnlink(true)}
            className="btn btn-danger"
            style={{ flex: '1 1 180px' }}
          >
            <Trash2 size={16} />
            <span>Unlink Vehicle</span>
          </button>
        ) : (
          <div style={{
            width: '100%',
            background: 'var(--rose-50)',
            border: '1px solid #fecdd3',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            marginTop: '0.5rem',
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--rose-700)', fontWeight: 600 }}>
              Are you sure? This will remove vehicle binding.
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowConfirmUnlink(false)}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmUnlink(false);
                  onUnlink(vehicle.id || vehicle._id);
                }}
                className="btn btn-danger"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: 'var(--rose-600)', color: '#fff' }}
                disabled={isUnlinking}
              >
                {isUnlinking ? 'Unlinking...' : 'Yes, Unlink'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
