import React from 'react';
import {
  AlertTriangle,
  XCircle,
  AlertOctagon,
  Info,
  ShieldAlert,
  KeyRound,
  Fuel,
  Zap,
  ArrowRight,
} from 'lucide-react';

export default function VerificationStatus({
  errorState,
  message,
  vehicleData,
  onReset,
  onTestEV,
  onReverifyAsEV,
}) {
  if (!errorState && !message) return null;

  // Custom rich card for Petrol / Non-EV rejection
  if (errorState === 'NOT_AN_EV') {
    const fuelType = vehicleData?.fuelType || 'PETROL';
    const regNo = vehicleData?.registrationNumber;
    const model = vehicleData?.model || 'Scooter / Motorcycle';
    const manufacturer = vehicleData?.manufacturer || 'Automobile Manufacturer';
    const vehicleClass = vehicleData?.vehicleClass || 'Two Wheeler (Scooter - Non-EV)';
    const ownerName = vehicleData?.ownerName || vehicleData?.maskedOwnerName || 'Registered Owner';
    const ownershipNumber = vehicleData?.ownershipNumber || '1st Owner';
    const rtoLocation = vehicleData?.rtoLocation || 'Regional Transport Office';
    const registrationDate = vehicleData?.registrationDate || 'N/A';
    const rcStatus = vehicleData?.status || 'Active';

    return (
      <div
        className="card"
        style={{
          maxWidth: '640px',
          margin: '1.5rem auto',
          border: '2px solid #f59e0b',
          background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)',
          boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#fef3c7',
              color: '#d97706',
              border: '1px solid #fcd34d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Fuel size={24} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  background: '#fee2e2',
                  color: '#991b1b',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  border: '1px solid #fca5a5',
                }}
              >
                🚫 Registration Blocked
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  background: '#fef3c7',
                  color: '#92400e',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  border: '1px solid #fcd34d',
                }}
              >
                ⛽ {fuelType} ENGINE
              </span>
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#92400e', marginTop: '0.4rem' }}>
              Non-Electric (Fossil Fuel) Vehicle Detected
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#78350f', marginTop: '0.2rem', lineHeight: 1.4 }}>
              This vehicle is powered by <strong>{fuelType}</strong> (Internal Combustion Engine). Only zero-emission <strong>Electric Vehicles (EVs)</strong> qualify for EV Green Pass & commute credits.
            </p>
          </div>
        </div>

        {/* Detected Vehicle Summary Box */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #fed7aa',
            padding: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Official Vahan Registry RC Record:</span>
            <span style={{ fontSize: '0.72rem', color: '#059669', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
              ✓ Verified Record
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {regNo && (
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600 }}>Registration No.</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.95rem', color: 'var(--slate-900)' }}>
                  {regNo}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600 }}>Registered Owner</div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--slate-900)' }}>
                {ownerName}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600 }}>Ownership Serial</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--slate-800)' }}>
                {ownershipNumber}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600 }}>Fuel Classification</div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Fuel size={14} />
                <span>{fuelType} (Non-EV)</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600 }}>Maker / Manufacturer</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--slate-800)' }}>
                {manufacturer}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600 }}>Model Description</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--slate-800)' }}>
                {model}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600 }}>Vehicle Category</div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--slate-700)' }}>
                {vehicleClass}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600 }}>RTO Office / State</div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--slate-700)' }}>
                {rtoLocation}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600 }}>Registration Date</div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--slate-700)' }}>
                {registrationDate}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontWeight: 600 }}>RC Status</div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#059669' }}>
                {rcStatus}
              </div>
            </div>
          </div>
        </div>

        {/* Reason explanation */}
        <div
          style={{
            background: '#fff7ed',
            borderRadius: '10px',
            border: '1px dashed #fdba74',
            padding: '0.85rem 1rem',
            fontSize: '0.82rem',
            color: '#9a3412',
            lineHeight: 1.5,
            marginBottom: '1.25rem',
          }}
        >
          <strong>Why is this restricted?</strong> Green Credits EV Mobility & QR Pass issuance are exclusively reserved for 100% Electric Vehicles (EVs) to incentivize zero-emission travel. Petrol and diesel vehicles do not qualify for EV carbon offset tokens.
        </div>

        {/* Re-verify as EV button if vehicle actually has a green plate */}
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#065f46' }}>
              Is {regNo} an Electric Vehicle with a Green Plate?
            </div>
            <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '2px' }}>
              Some Indian RTOs issue standard series for EVs. Click below to verify as an Electric Vehicle.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onReverifyAsEV ? onReverifyAsEV(regNo) : (onTestEV && onTestEV(regNo, { isEV: true }))}
            className="btn btn-primary"
            style={{ fontSize: '0.82rem', padding: '0.45rem 1rem', background: '#059669', borderColor: '#047857', color: '#ffffff', fontWeight: 700 }}
          >
            <Zap size={14} fill="#ffffff" color="#ffffff" />
            <span>Verify as Electric Vehicle</span>
          </button>
        </div>

        {/* Test with EV shortcut buttons */}
        {onTestEV && (
          <div style={{ borderTop: '1px solid #fed7aa', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--slate-600)', marginBottom: '0.5rem' }}>
              Quick Test with Verified Electric Vehicles:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => onTestEV('MH14LM7409', { isEV: true })}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', borderColor: '#a7f3d0', background: '#ecfdf5', color: '#065f46', fontWeight: 700 }}
              >
                <Zap size={13} fill="#059669" color="#059669" />
                <span>Chetak EV (MH14LM7409)</span>
              </button>
              <button
                type="button"
                onClick={() => onTestEV('MH20HK3845')}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', borderColor: '#a7f3d0', background: '#ecfdf5', color: '#065f46', fontWeight: 700 }}
              >
                <Zap size={13} fill="#059669" color="#059669" />
                <span>Bajaj Chetak EV (MH20HK3845)</span>
              </button>
              <button
                type="button"
                onClick={() => onTestEV('MH12AB1234')}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', borderColor: '#a7f3d0', background: '#ecfdf5', color: '#065f46', fontWeight: 700 }}
              >
                <Zap size={13} fill="#059669" color="#059669" />
                <span>Ather 450X (MH12AB1234)</span>
              </button>
            </div>
          </div>
        )}

        {onReset && (
          <div style={{ textAlign: 'right', marginTop: '1rem' }}>
            <button
              onClick={onReset}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
            >
              Clear / Try Another Plate
            </button>
          </div>
        )}
      </div>
    );
  }

  const getStatusConfig = () => {
    switch (errorState) {
      case 'VEHICLE_NOT_FOUND':
        return {
          type: 'error',
          icon: <XCircle size={22} className="text-rose-600" />,
          title: 'Vehicle Not Found on Registry',
          description: message || 'Vehicle registration was not found in the national Vahan database.',
          hint: 'Please check for typos in the state code, district code, or number series.',
        };

      case 'ALREADY_REGISTERED':
        return {
          type: 'error',
          icon: <ShieldAlert size={22} className="text-rose-600" />,
          title: 'Vehicle Already Associated',
          description: message || 'This vehicle is already associated with another account.',
          hint: 'To prevent duplicate credit issuance, a vehicle can only be bound to one Green Credits user account at a time.',
        };

      case 'VERIFICATION_UNAVAILABLE':
        return {
          type: 'warning',
          icon: <KeyRound size={22} className="text-amber-600" />,
          title: 'Live Verification Unconfigured',
          description: message || 'Live vehicle verification is not configured. Add a valid vehicle verification API key in the backend environment variables.',
          hint: 'In development, set VEHICLE_API_PROVIDER=sandbox in backend/.env to use the official development testbed.',
        };

      case 'RATE_LIMITED':
        return {
          type: 'warning',
          icon: <AlertOctagon size={22} className="text-amber-600" />,
          title: 'Rate Limit Reached',
          description: message || 'RC verification provider rate limit reached. Please wait a few moments.',
          hint: 'Rate limiting protects external registry bandwidth and prevents brute-force attempts.',
        };

      case 'INVALID_REGISTRATION':
        return {
          type: 'error',
          icon: <Info size={22} className="text-rose-600" />,
          title: 'Invalid Plate Format',
          description: message || 'Please enter a valid Indian vehicle registration number format (e.g. MH12AB1234).',
          hint: 'Standard format: 2-letter State Code + 1-2 digit District + 1-3 Series Letters + 4 digit number.',
        };

      default:
        return {
          type: 'error',
          icon: <AlertCircle size={22} className="text-rose-600" />,
          title: 'Verification Error',
          description: message || 'An unexpected error occurred during vehicle lookup.',
          hint: 'Please try again later or check your backend connection.',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`status-banner ${config.type}`} style={{ maxWidth: '640px', margin: '1.5rem auto' }}>
      <div style={{ flexShrink: 0, marginTop: '2px' }}>{config.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>
          {config.title}
        </div>
        <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem', lineHeight: 1.4 }}>
          {config.description}
        </div>
        {config.hint && (
          <div style={{ fontSize: '0.8rem', opacity: 0.85, fontStyle: 'italic' }}>
            {config.hint}
          </div>
        )}
      </div>
      {onReset && (
        <button
          onClick={onReset}
          className="btn btn-secondary"
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', alignSelf: 'center' }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

function AlertCircle(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
