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
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Navigation
} from 'lucide-react';
import { api } from '../services/api';

export default function SmartRoutePlanner({ onSelectRouteToTrack }) {
  const [origin, setOrigin] = useState('Student Hostel Block C');
  const [destination, setDestination] = useState('Main Engineering Campus / IT Hub');
  const [isLoading, setIsLoading] = useState(false);
  const [routePlan, setRoutePlan] = useState(null);

  const presets = [
    { origin: 'Student Hostel Block C', destination: 'Engineering Campus / IT Hub' },
    { origin: 'Sector 14 Residential Hub', destination: 'Central Metro Station' },
    { origin: 'Old City Market', destination: 'Tech Valley Business Park' },
  ];

  useEffect(() => {
    fetchRoutes(origin, destination);
  }, []);

  const fetchRoutes = async (orig, dest) => {
    setIsLoading(true);
    try {
      const res = await api.planSmartRoute(orig, dest);
      if (res.success && res.data) {
        setRoutePlan(res.data);
      }
    } catch (err) {
      console.error('Failed to plan route:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (origin.trim() && destination.trim()) {
      fetchRoutes(origin.trim(), destination.trim());
    }
  };

  const getSegmentIcon = (mode) => {
    switch (mode) {
      case 'WALKING':
        return <Footprints size={16} className="text-emerald-600" />;
      case 'CYCLING':
        return <Bike size={16} className="text-amber-600" />;
      case 'BUS':
        return <Bus size={16} className="text-blue-600" />;
      default:
        return <Car size={16} className="text-rose-500" />;
    }
  };

  return (
    <div className="main-content">
      {/* Header */}
      <div className="page-header">
        <div className="badge-tag">
          <Sparkles size={14} fill="#059669" color="#059669" />
          <span>Active Transport Network</span>
        </div>
        <h1 className="page-title">Fitness-Aware Smart Routes</h1>
        <p className="page-subtitle">
          Instead of just asking "How did you travel?", our smart mobility engine shows you the healthiest and greenest way to reach your destination.
        </p>
      </div>

      {/* Input / Search Card */}
      <div className="card" style={{ maxWidth: '720px', margin: '0 auto 2rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-500)', marginBottom: '0.35rem' }}>
              Origin (Starting Point)
            </label>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g. Student Hostel"
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid var(--slate-300)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-500)', marginBottom: '0.35rem' }}>
              Destination Point
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. College / Office"
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid var(--slate-300)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ height: '42px', padding: '0 1.25rem' }}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Find Routes'}
          </button>
        </form>

        {/* Quick presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600 }}>Try Corridors:</span>
          {presets.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setOrigin(p.origin);
                setDestination(p.destination);
                fetchRoutes(p.origin, p.destination);
              }}
              style={{
                background: 'var(--slate-100)',
                border: '1px solid var(--slate-200)',
                borderRadius: '9999px',
                padding: '3px 10px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                color: 'var(--slate-700)',
              }}
            >
              {p.origin.split(' ')[0]} &rarr; {p.destination.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Routes List */}
      {routePlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '780px', margin: '0 auto' }}>
          {routePlan.routes.map((r) => {
            const isRec = r.isRecommended;

            return (
              <div
                key={r.id}
                className={`card ${isRec ? 'verify-card' : ''}`}
                style={{
                  border: isRec ? '2px solid var(--primary-500)' : '1px solid var(--slate-200)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {isRec && (
                  <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1.25rem',
                    background: 'var(--primary-600)',
                    color: '#ffffff',
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}>
                    ★ {r.tag}
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                    {r.name}
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                    <span><strong>{r.totalDurationMinutes} mins</strong> total</span>
                    <span>&bull;</span>
                    <span>{r.totalDistanceKm} km</span>
                  </div>
                </div>

                {/* Segments Visual Line */}
                <div style={{
                  background: 'var(--slate-50)',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '1.25rem',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {r.segments.map((seg, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: '#ffffff',
                          border: '1px solid var(--slate-200)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {getSegmentIcon(seg.mode)}
                        </div>
                        <div style={{ flex: 1, color: 'var(--slate-800)', fontWeight: 500 }}>
                          {seg.instruction}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)', fontWeight: 600 }}>
                          {seg.distanceKm} km &bull; {seg.durationMin} min
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Score Banner (FP, GP, CO2) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem',
                  textAlign: 'center',
                  background: isRec ? 'rgba(255, 255, 255, 0.9)' : 'var(--slate-50)',
                  border: isRec ? '1px solid var(--primary-200)' : '1px solid var(--slate-200)',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  marginBottom: '1rem',
                }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                      Fitness Points
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                      <Flame size={16} fill="#ea580c" />
                      <span>+{r.fitnessPoints} FP</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                      Green Credits
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                      <Leaf size={16} fill="#059669" />
                      <span>+{r.greenCredits} GP</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                      CO₂ Avoided
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                      {r.co2AvoidedKg ? `${r.co2AvoidedKg} kg` : <span style={{ color: '#ef4444' }}>0 kg (Car)</span>}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--slate-600)', fontStyle: 'italic', marginBottom: '1rem' }}>
                  {r.healthHighlight}
                </div>

                {isRec && (
                  <button
                    onClick={() => onSelectRouteToTrack && onSelectRouteToTrack(r)}
                    className="btn btn-primary btn-full"
                  >
                    <Navigation size={16} />
                    <span>Start Tracking This Active Route</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
