import React from 'react';
import { CheckCircle2, Shield, Calendar, User, Truck, Fuel, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from '../i18n/I18nContext';

export default function VehicleDetails({
  vehicleData,
  onRegister,
  isRegistering,
  isLoggedIn,
  onRequireAuth,
}) {
  const { t } = useTranslation();
  if (!vehicleData) return null;

  return (
    <div className="card verify-card" style={{ maxWidth: '640px', margin: '2rem auto 0' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="verify-badge-top">
          <CheckCircle2 size={16} />
          <span>{t('ev.vehicleVerified')}</span>
        </div>
      </div>

      <div className="grid-details">
        <div className="detail-item">
          <div className="detail-label">{t('ev.registrationNo')}</div>
          <div className="detail-value mono" style={{ color: 'var(--primary-700)' }}>
            {vehicleData.registrationNumber}
          </div>
        </div>

        <div className="detail-item">
          <div className="detail-label">{t('ev.vehicleType')}</div>
          <div className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
            }}></span>
            {t('ev.electricVehicle')}
          </div>
        </div>

        <div className="detail-item">
          <div className="detail-label">{t('ev.manufacturer')}</div>
          <div className="detail-value">{vehicleData.manufacturer || 'N/A'}</div>
        </div>

        <div className="detail-item">
          <div className="detail-label">{t('ev.model')}</div>
          <div className="detail-value">{vehicleData.model || 'N/A'}</div>
        </div>

        <div className="detail-item">
          <div className="detail-label">{t('ev.fuelType')}</div>
          <div className="detail-value" style={{ color: '#059669', fontWeight: 800 }}>
            {vehicleData.fuelType}
          </div>
        </div>

        <div className="detail-item">
          <div className="detail-label">{t('ev.ownerMasked')}</div>
          <div className="detail-value mono" style={{ fontSize: '0.95rem' }}>
            {vehicleData.ownerName || 'Registered Owner'}
          </div>
        </div>

        <div className="detail-item">
          <div className="detail-label">{t('ev.registrationDate')}</div>
          <div className="detail-value" style={{ fontSize: '0.95rem' }}>
            {vehicleData.registrationDate || 'N/A'}
          </div>
        </div>

        <div className="detail-item">
          <div className="detail-label">{t('ev.verificationSource')}</div>
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
        {t('ev.qualificationNotice')}
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
                <span>{t('ev.binding')}</span>
              </>
            ) : (
              <>
                <span>{t('ev.bindVehicle')}</span>
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
            <span>{t('rewards.signInToRedeem')}</span>
            <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
