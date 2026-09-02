import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Footprints,
  Bike,
  Bus,
  Car,
  Flame,
  Leaf,
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Navigation,
  ArrowRight,
  TrendingUp,
  RotateCcw
} from 'lucide-react';
import PlaceAutocompleteInput from '../components/PlaceAutocompleteInput';
import { api } from '../services/api';
import { useTranslation } from '../i18n/I18nContext';

export default function SmartRoutePlanner({ onSelectRouteToTrack }) {
  const { t } = useTranslation();

  // Origin & Destination Place Objects
  const [originPlace, setOriginPlace] = useState({
    placeId: 'default_pune_station',
    name: 'Pune Railway Station',
    formattedAddress: 'Agarkar Nagar, Pune, Maharashtra 411001, India',
    latitude: 18.5284,
    longitude: 73.8744,
  });

  const [destPlace, setDestPlace] = useState({
    placeId: 'default_pune_uni',
    name: 'Savitribai Phule Pune University',
    formattedAddress: 'Ganeshkhind, Pune, Maharashtra 411007, India',
    latitude: 18.5529,
    longitude: 73.8267,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [routePlan, setRoutePlan] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Popular corridors for instant one-click testing
  const presets = [
    {
      name: 'Pune Stn → University',
      origin: { name: 'Pune Railway Station', formattedAddress: 'Agarkar Nagar, Pune, Maharashtra', latitude: 18.5284, longitude: 73.8744 },
      destination: { name: 'Savitribai Phule Pune University', formattedAddress: 'Ganeshkhind, Pune, Maharashtra', latitude: 18.5529, longitude: 73.8267 },
    },
    {
      name: 'Shivajinagar → Magarpatta IT City',
      origin: { name: 'Shivajinagar Station', formattedAddress: 'Shivajinagar, Pune, Maharashtra', latitude: 18.5314, longitude: 73.8446 },
      destination: { name: 'Magarpatta Cybercity', formattedAddress: 'Hadapsar, Pune, Maharashtra', latitude: 18.5158, longitude: 73.9272 },
    },
    {
      name: 'Kothrud → Hinjawadi Phase 1',
      origin: { name: 'Kothrud Bus Stand', formattedAddress: 'Kothrud, Pune, Maharashtra', latitude: 18.5074, longitude: 73.8077 },
      destination: { name: 'Hinjawadi IT Park', formattedAddress: 'Hinjawadi Phase 1, Pune, Maharashtra', latitude: 18.5913, longitude: 73.7389 },
    },
  ];

  // Fetch real routes on initial mount
  useEffect(() => {
    if (originPlace && destPlace) {
      fetchRealRoutes(originPlace, destPlace);
    }
  }, []);

  const fetchRealRoutes = async (orig, dest) => {
    if (!orig || !dest) return;
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await api.planSmartRoute(orig, dest);
      if (res.success && res.routes && res.routes.length > 0) {
        setRoutePlan({
          origin: res.origin || orig,
          destination: res.destination || dest,
          routes: res.routes,
        });
      } else {
        setErrorMsg(t('routes.noRoutesFound'));
      }
    } catch (err) {
      console.error('Failed to compute real routes:', err);
      setErrorMsg(err.message || t('routes.noRoutesFound'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOriginSelect = (place) => {
    setOriginPlace(place);
    if (place && destPlace) {
      fetchRealRoutes(place, destPlace);
    }
  };

  const handleDestSelect = (place) => {
    setDestPlace(place);
    if (originPlace && place) {
      fetchRealRoutes(originPlace, place);
    }
  };

  const handlePresetClick = (preset) => {
    setOriginPlace(preset.origin);
    setDestPlace(preset.destination);
    fetchRealRoutes(preset.origin, preset.destination);
  };

  const handleFindRouteForMode = (route) => {
    if (onSelectRouteToTrack) {
      onSelectRouteToTrack(route);
    }
  };

  const getModeIcon = (mode, size = 20) => {
    switch (mode?.toUpperCase()) {
      case 'WALKING':
        return <Footprints size={size} className="text-emerald-600" />;
      case 'CYCLING':
        return <Bike size={size} className="text-amber-600" />;
      case 'BUS':
        return <Bus size={size} className="text-blue-600" />;
      default:
        return <Car size={size} className="text-slate-600" />;
    }
  };

  return (
    <div className="main-content">
      {/* Page Header */}
      <div className="page-header">
        <div className="badge-tag">
          <Sparkles size={14} fill="#059669" color="#059669" />
          <span>{t('routes.badge')}</span>
        </div>
        <h1 className="page-title">{t('routes.title')}</h1>
        <p className="page-subtitle">
          {t('routes.subtitle')}
        </p>
      </div>

      {/* Origin & Destination Search Card */}
      <div className="card" style={{ maxWidth: '780px', margin: '0 auto 2rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          alignItems: 'flex-start',
        }}>
          {/* Starting Location with Current Location option */}
          <PlaceAutocompleteInput
            label={t('routes.startPoint')}
            placeholder={t('routes.originPlaceholder')}
            value={originPlace}
            onChange={(val) => { if (!val) setOriginPlace(null); }}
            onSelectPlace={handleOriginSelect}
            showCurrentLocationOption={true}
            icon={MapPin}
          />

          {/* Destination Location */}
          <PlaceAutocompleteInput
            label={t('routes.destination')}
            placeholder={t('routes.destinationPlaceholder')}
            value={destPlace}
            onChange={(val) => { if (!val) setDestPlace(null); }}
            onSelectPlace={handleDestSelect}
            showCurrentLocationOption={false}
            icon={Navigation}
          />
        </div>

        {/* Quick Corridor Presets */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.45rem',
          marginTop: '1.25rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--slate-100)',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 700 }}>
            {t('routes.popularCorridors')}
          </span>
          {presets.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handlePresetClick(p)}
              style={{
                background: 'var(--slate-100)',
                border: '1px solid var(--slate-200)',
                borderRadius: '9999px',
                padding: '4px 12px',
                fontSize: '0.76rem',
                cursor: 'pointer',
                color: 'var(--slate-700)',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div style={{
            marginTop: '1rem',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#be123c',
            borderRadius: '10px',
            padding: '0.75rem',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          color: 'var(--slate-500)',
          background: 'rgba(255, 255, 255, 0.7)',
          borderRadius: '16px',
          maxWidth: '780px',
          margin: '0 auto 2rem',
        }}>
          <Loader2 size={36} className="animate-spin text-emerald-600" style={{ margin: '0 auto 0.75rem' }} />
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--slate-800)' }}>
            {t('routes.calculating')}
          </div>
        </div>
      )}

      {/* Routes List */}
      {routePlan && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '780px', margin: '0 auto' }}>
          {routePlan.routes.map((route) => {
            const isWalking = route.mode === 'WALKING';
            const isCycling = route.mode === 'CYCLING';
            const isCar = route.mode === 'CAR';
            const isRec = route.isRecommended || isWalking;

            return (
              <div
                key={route.id}
                className={`card ${isRec ? 'verify-card' : ''}`}
                style={{
                  border: isRec ? '2px solid var(--primary-500)' : '1px solid var(--slate-200)',
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '1.5rem',
                  boxShadow: isRec ? '0 8px 24px rgba(16, 185, 129, 0.12)' : 'var(--shadow-md)',
                }}
              >
                {/* Header Tag Badge */}
                {isRec && (
                  <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1.25rem',
                    background: 'var(--primary-600)',
                    color: '#ffffff',
                    padding: '3px 12px',
                    borderRadius: '9999px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
                  }}>
                    ★ {route.tag || t('routes.recommended')}
                  </div>
                )}

                {/* Title & Core Distance / Duration */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', marginBottom: '1.15rem' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: isWalking ? '#ecfdf5' : (isCycling ? '#fffbeb' : '#f1f5f9'),
                    border: `1.5px solid ${isWalking ? '#a7f3d0' : (isCycling ? '#fde68a' : '#cbd5e1')}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {getModeIcon(route.mode, 22)}
                  </div>

                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', lineHeight: 1.2 }}>
                      {route.title}
                    </h3>
                    <div style={{
                      fontSize: '0.88rem',
                      color: 'var(--slate-600)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      marginTop: '0.35rem',
                      fontWeight: 600,
                    }}>
                      <span style={{ color: 'var(--slate-900)', fontWeight: 800, fontSize: '1.05rem' }}>
                        {route.durationText || `${route.durationMinutes} min`}
                      </span>
                      <span>&bull;</span>
                      <span style={{ color: 'var(--slate-700)' }}>
                        {route.distanceText || `${route.distanceKm} km`}
                      </span>
                      {route.estimatedCalories > 0 && (
                        <>
                          <span>&bull;</span>
                          <span style={{ color: '#ea580c' }}>
                            ~{route.estimatedCalories} kcal
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step-by-Step Route Summary Preview */}
                {route.steps && route.steps.length > 0 && (
                  <div style={{
                    background: 'var(--slate-50)',
                    borderRadius: '12px',
                    padding: '0.9rem 1.1rem',
                    marginBottom: '1.15rem',
                    border: '1px solid var(--slate-100)',
                  }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                      Key Navigation Steps:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {route.steps.slice(0, 3).map((step, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.82rem' }}>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            border: '1px solid var(--slate-300)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            color: 'var(--slate-600)',
                            flexShrink: 0,
                          }}>
                            {idx + 1}
                          </div>
                          <div style={{ flex: 1, color: 'var(--slate-800)', fontWeight: 500 }}>
                            {step.instruction}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600 }}>
                            {step.distanceKm ? `${step.distanceKm} km` : `${step.distanceMeters} m`}
                          </div>
                        </div>
                      ))}
                      {route.steps.length > 3 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--slate-400)', fontStyle: 'italic', paddingLeft: '1.65rem' }}>
                          + {route.steps.length - 3} more maneuvers
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Score Banner (Fitness Points, Green Credits, CO2) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem',
                  textAlign: 'center',
                  background: isRec ? 'rgba(255, 255, 255, 0.95)' : 'var(--slate-50)',
                  border: isRec ? '1.5px solid var(--primary-200)' : '1px solid var(--slate-200)',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  marginBottom: '1.15rem',
                }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                      {t('routes.fitnessPointsEarnable')}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: route.fitnessPoints > 0 ? '#ea580c' : 'var(--slate-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', marginTop: '2px' }}>
                      {route.fitnessPoints > 0 ? (
                        <>
                          <Flame size={16} fill="#ea580c" />
                          <span>+{route.fitnessPoints} FP</span>
                        </>
                      ) : (
                        <span>0 FP</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                      {t('routes.greenCreditsEarnable')}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: route.greenCredits > 0 ? '#059669' : 'var(--slate-400)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', marginTop: '2px' }}>
                      {route.greenCredits > 0 ? (
                        <>
                          <Leaf size={16} fill="#059669" />
                          <span>+{route.greenCredits} GP</span>
                        </>
                      ) : (
                        <span>0 GP</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                      {t('routes.co2Saved')}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isCar ? '#ef4444' : 'var(--slate-900)', marginTop: '2px' }}>
                      {route.co2AvoidedKg > 0 ? (
                        <span style={{ color: '#059669' }}>-{route.co2AvoidedKg} kg</span>
                      ) : (
                        <span style={{ color: '#ef4444' }}>+{route.co2EmittedKg || (route.distanceKm * 0.192).toFixed(2)} kg</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Health Highlight */}
                {route.healthHighlight && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-600)', fontStyle: 'italic', marginBottom: '1.25rem' }}>
                    {route.healthHighlight}
                  </div>
                )}

                {/* Individual CTA Button */}
                <button
                  onClick={() => handleFindRouteForMode(route)}
                  className={`btn ${isRec ? 'btn-primary' : 'btn-secondary'} btn-full`}
                  style={{
                    padding: '0.8rem 1.25rem',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    gap: '0.6rem',
                    background: isCar ? '#334155' : undefined,
                    color: isCar ? '#ffffff' : undefined,
                  }}
                >
                  <Navigation size={17} />
                  <span>{t('routes.startJourneyWithRoute')} &bull; {route.mode}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
