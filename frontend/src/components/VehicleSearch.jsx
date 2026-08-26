import React, { useState } from 'react';
import { Search, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

export default function VehicleSearch({ onVerify, isVerifying, disabled }) {
  const [regInput, setRegInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Normalize Indian plate number
  const handleInputChange = (e) => {
    const raw = e.target.value.toUpperCase();
    // Strip hyphens, spaces, dots
    const cleaned = raw.replace(/[\s\-_.]/g, '');
    if (cleaned.length <= 12) {
      setRegInput(cleaned);
      if (validationError) setValidationError('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanReg = regInput.trim().toUpperCase();

    if (!cleanReg) {
      setValidationError('Please enter a vehicle registration number.');
      return;
    }

    // Standard Indian license plate validation
    const stateRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;
    const bhRegex = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;

    if (!stateRegex.test(cleanReg) && !bhRegex.test(cleanReg)) {
      setValidationError('Please enter a valid format (e.g. MH12AB1234 or 22BH1234AA).');
      return;
    }

    setValidationError('');
    onVerify(cleanReg);
  };

  return (
    <div className="card" style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--slate-900)' }}>
          Vehicle RC Verification
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--slate-500)', marginTop: '0.25rem' }}>
          Enter your Indian vehicle registration number to verify official RC details and electric status.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="plate-wrapper">
          <div className={`plate-box ${isFocused ? 'focused' : ''}`}>
            <div className="plate-ind">
              <div className="plate-ind-chakra"></div>
              <span>IND</span>
            </div>
            <input
              type="text"
              className="plate-input"
              placeholder="MH12AB1234"
              value={regInput}
              onChange={handleInputChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={isVerifying || disabled}
              maxLength={12}
              autoComplete="off"
              spellCheck="false"
            />
          </div>
        </div>

        {validationError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.375rem',
            color: 'var(--rose-600)',
            fontSize: '0.85rem',
            fontWeight: 500,
            marginBottom: '1rem'
          }}>
            <AlertCircle size={15} />
            <span>{validationError}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', maxWidth: '340px' }}
            disabled={isVerifying || !regInput.trim()}
          >
            {isVerifying ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Verifying vehicle...</span>
              </>
            ) : (
              <>
                <Search size={18} />
                <span>Verify Vehicle</span>
              </>
            )}
          </button>
        </div>
      </form>

      <div style={{
        marginTop: '1.5rem',
        paddingTop: '1rem',
        borderTop: '1px solid var(--slate-100)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        fontSize: '0.78rem',
        color: 'var(--slate-500)'
      }}>
        <ShieldCheck size={14} style={{ color: 'var(--primary-600)' }} />
        <span>Connected to National Vahan RC Registry via secure provider adapter</span>
      </div>
    </div>
  );
}
