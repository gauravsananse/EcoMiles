import React from 'react';
import { CheckCircle2, Shield, Calendar, User, Truck, Fuel, ArrowRight, Loader2 } from 'lucide-react';

export default function VehicleDetails({
  vehicleData,
  onRegister,
  isRegistering,
  isLoggedIn,
  onRequireAuth,
}) {
  if (!vehicleData) return null;

  return (
    <div className="card verify-card" style={{ maxWidth: '640px', margin: '2rem auto 0' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="verify-badge-top">
          <CheckCircle2 size={16} />
          <span>✓ VEHICLE VERIFIED</span>
        </div>
      </div>

      <div className="grid-details">
        <div className="detail-item">
          <div className="detail-label">Registration</div>
          <div className="detail-value mono" style={{ color: 'var(--primary-700)' }}>
            {vehicleData.registrationNumber}
          </div>
        </div>

        <div className="detail-item">
          <div className="detail-label">Vehicle Type</div>
          <div className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
            }}></span>
            Electric Vehicle (EV)
          </div>
        </div>

        <div className="detail-item">
          <div className="detail-label">Manufacturer</div>
          <div className="detail-value">{vehicleData.manufacturer || 'N/A'}</div>
        </div>

        <div className="detail-item">
          <div className="detail-label">Model</div>
          <div className="detail-value">{vehicleData.model || 'N/A'}</div>
        </div>

        <div className="detail-item">
          <div className="detail-label">Fuel Classification</div>
          <div className="detail-value" style={{ color: '#059669', fontWeight: 800 }}>
            {vehicleData.fuelType}
          </div>
        </div>

        <div className="detail-item">
          <div className="detail-label">Owner (Masked)</div>
          <div className="detail-value mono" style={{ fontSize: '0.95rem' }}>
            {vehicleData.ownerName || 'Registered Owner'}
          </div>
        </div>

        <div className="detail-item">
          <div className="detail-label">Registration Date</div>
          <div className="detail-value" style={{ fontSize: '0.95rem' }}>
            {vehicleData.registrationDate || 'N/A'}
          </div>
        </div>

        <div className="detail-item">
          <div className="detail-label">Verification Source</div>
          <div className="detail-value" style={{ fontSize: '0.9rem', color: 'var(--slate-700)' }}>
            {vehicleData.verificationSource}
          </div>
        </div>
      </div>

      <div style={{
        background: 'rgba(255, 255, 255, 0.7)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1.5rem',
        border: '1px solid var(--primary-200)',
        fontSize: '0.85rem',
        color: 'var(--primary-900)',
      }}>
        <strong>EV Qualification Confirmed:</strong> This vehicle satisfies all Green Credits criteria for electric mobility. Ready for account binding and QR token generation.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
        {isLoggedIn ? (
          <button
            onClick={() => onRegister(vehicleData)}
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={isRegistering}
          >
            {isRegistering ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Binding EV to account...</span>
              </>
            ) : (
              <>
                <span>Register This EV</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onRequireAuth}
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
          >
            <span>Sign In to Register This EV</span>
            <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
