import React, { useState, useEffect } from 'react';
import {
  Building2,
  Bus,
  Train,
  Zap,
  Radio,
  Layers,
  Sparkles,
  CheckCircle2,
  Activity,
  Navigation
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../i18n/I18nContext';

export default function CityTransportNetwork() {
  const { t } = useTranslation();
  const [transitData, setTransitData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCityNetwork();
  }, []);

  const loadCityNetwork = async () => {
    setIsLoading(true);
    try {
      const res = await api.getTransitContext();
      if (res.success && res.context) {
        setTransitData(res.context);
      }
    } catch (err) {
      console.error('Failed to load transit network:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="main-content">
      <div className="page-header">
        <div className="badge-tag">
          <Building2 size={14} fill="#059669" color="#059669" />
          <span>{t('city.badge')}</span>
        </div>
        <h1 className="page-title">{t('city.title')}</h1>
        <p className="page-subtitle">
          {t('city.subtitle')}
        </p>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Active Beacons Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                {t('city.bleBeacons')}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                {t('city.bleBeaconsDesc')}
              </div>
            </div>
            <Radio size={20} className="text-emerald-600" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {transitData?.activeBeacons?.map((b) => (
              <div
                key={b._id || b.beaconId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-200)',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: b.transportType === 'BUS' ? '#eff6ff' : (b.transportType === 'METRO' ? '#f5f3ff' : '#ecfdf5'),
                    color: b.transportType === 'BUS' ? '#2563eb' : (b.transportType === 'METRO' ? '#7c3aed' : '#059669'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {b.transportType === 'BUS' ? <Bus size={18} /> : (b.transportType === 'METRO' ? <Train size={18} /> : <Zap size={18} />)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--slate-900)' }}>
                      {b.stationName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                      ID: <code style={{ fontFamily: 'var(--font-mono)' }}>{b.beaconId}</code> &bull; Line: {b.routeName}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    background: '#ecfdf5',
                    color: '#065f46',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}>
                    ● {b.status || t('city.active')}
                  </span>
                  <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)', marginTop: '2px' }}>
                    {b.operator}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transit Corridors Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                {t('city.cleanCorridors')}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                {t('city.cleanCorridorsDesc')}
              </div>
            </div>
            <Layers size={20} className="text-blue-600" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
            <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--slate-200)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <Bus size={16} className="text-blue-600" />
                <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>Line 101 Bus Rapid Transit</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-600)' }}>
                High-density arterial with 8 registered BLE verification beacons and dedicated bus lanes.
              </div>
            </div>

            <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--slate-200)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <Train size={16} className="text-purple-600" />
                <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>Airport Express Metro Corridor</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-600)' }}>
                Subterranean & elevated guideway with automated underground GPS degradation compensation.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
