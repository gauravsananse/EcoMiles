import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Bus,
  Footprints,
  Bike,
  Zap,
  Flame,
  Clock,
  MapPin,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Info,
  Calendar,
  Filter,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

/**
 * Clean Interactive Vertical Bar Chart for 6 AM – 9 PM Activity
 */
function TimeActivityBarChart({ data = [], barColor = '#10b981', emptyText = 'No activity recorded' }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const maxVal = Math.max(1, ...data.map((d) => d.journeys || 0));
  const hasData = data.some((d) => d.journeys > 0);

  if (!hasData) {
    return (
      <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-400)', fontSize: '0.82rem', fontStyle: 'italic', background: 'var(--slate-50)', borderRadius: '12px' }}>
        {emptyText}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', position: 'relative', paddingTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', height: '150px', gap: '5px', paddingBottom: '24px', position: 'relative' }}>
        {data.map((item, idx) => {
          const heightPct = Math.round(((item.journeys || 0) / maxVal) * 100);
          const isHovered = hoveredIndex === idx;

          return (
            <div
              key={item.time || idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%',
                position: 'relative',
                cursor: 'pointer',
              }}
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div style={{
                  position: 'absolute',
                  top: '-32px',
                  background: 'var(--slate-900)',
                  color: '#ffffff',
                  padding: '3px 7px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  zIndex: 20,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                }}>
                  {item.time}: {item.journeys} {item.journeys === 1 ? 'journey' : 'journeys'}
                </div>
              )}

              {/* The bar */}
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(item.journeys > 0 ? 6 : 2, heightPct)}%`,
                  background: isHovered ? 'var(--slate-800)' : barColor,
                  borderRadius: '4px 4px 0 0',
                  opacity: item.journeys > 0 ? 0.9 : 0.2,
                  transition: 'all 0.2s ease',
                }}
              />

              {/* X-axis Label */}
              <span style={{
                position: 'absolute',
                bottom: 0,
                fontSize: '0.62rem',
                color: isHovered ? 'var(--slate-900)' : 'var(--slate-400)',
                fontWeight: isHovered ? 700 : 500,
                whiteSpace: 'nowrap',
              }}>
                {idx % 2 === 0 ? item.time : ''}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--slate-400)', borderTop: '1px solid var(--slate-200)', paddingTop: '4px' }}>
        <span>6 AM</span>
        <span>Hourly Commute Windows</span>
        <span>9 PM</span>
      </div>
    </div>
  );
}

/**
 * Clean Horizontal Bar Chart for Locations / Origins / Destinations
 */
function HorizontalBarChart({ items = [], labelKey = 'location', valueKey = 'journeys', barColor = '#10b981', emptyText = 'No location data available' }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-400)', fontSize: '0.82rem', fontStyle: 'italic', background: 'var(--slate-50)', borderRadius: '12px' }}>
        {emptyText}
      </div>
    );
  }

  const maxVal = Math.max(1, ...items.map((it) => it[valueKey] || 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      {items.map((it, idx) => {
        const val = it[valueKey] || 0;
        const widthPct = Math.min(100, Math.round((val / maxVal) * 100));
        const label = it[labelKey] || 'Unknown Location';

        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--slate-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>
                {label}
              </span>
              <span style={{ fontWeight: 800, color: 'var(--slate-600)' }}>
                {val} <span style={{ fontSize: '0.68rem', color: 'var(--slate-400)' }}>trips</span>
              </span>
            </div>

            <div style={{ width: '100%', height: '8px', background: 'var(--slate-100)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${widthPct}%`,
                  height: '100%',
                  background: barColor,
                  borderRadius: '9999px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Clean Line / Area Chart for CO2 Saved Over Time
 */
function Co2OverTimeChart({ data = [], emptyText = 'No emissions data recorded over this period' }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  if (!data || data.length === 0) {
    return (
      <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-400)', fontSize: '0.82rem', fontStyle: 'italic', background: 'var(--slate-50)', borderRadius: '12px' }}>
        {emptyText}
      </div>
    );
  }

  const maxVal = Math.max(1, ...data.map((d) => d.co2SavedKg || 0));

  return (
    <div style={{ width: '100%', position: 'relative', paddingTop: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', height: '140px', gap: '8px', paddingBottom: '24px', position: 'relative' }}>
        {data.map((item, idx) => {
          const heightPct = Math.round(((item.co2SavedKg || 0) / maxVal) * 100);
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={item.timeLabel || idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%',
                position: 'relative',
                cursor: 'pointer',
              }}
            >
              {isHovered && (
                <div style={{
                  position: 'absolute',
                  top: '-32px',
                  background: '#065f46',
                  color: '#ffffff',
                  padding: '3px 7px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  zIndex: 20,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                }}>
                  {item.timeLabel}: {item.co2SavedKg} kg CO₂
                </div>
              )}

              <div
                style={{
                  width: '100%',
                  height: `${Math.max(6, heightPct)}%`,
                  background: isHovered ? '#047857' : '#10b981',
                  borderRadius: '4px 4px 0 0',
                  transition: 'all 0.2s ease',
                }}
              />

              <span style={{
                position: 'absolute',
                bottom: 0,
                fontSize: '0.65rem',
                color: isHovered ? 'var(--slate-900)' : 'var(--slate-500)',
                fontWeight: isHovered ? 700 : 500,
                whiteSpace: 'nowrap',
              }}>
                {item.timeLabel}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: '0.68rem', color: 'var(--slate-400)', borderTop: '1px solid var(--slate-200)', paddingTop: '4px', textAlign: 'center' }}>
        Aggregated CO₂ Avoidance (kg)
      </div>
    </div>
  );
}

export default function CityTransportNetwork() {
  // Global Filters
  const [dateFilter, setDateFilter] = useState('ALL_TIME');
  const [modeFilter, setModeFilter] = useState('ALL');

  // Mode Toggle: Live Data vs Demo Data (Defaults to Demo for immediate presentation)
  const [isDemo, setIsDemo] = useState(true);

  // Data & Loading States
  const [overviewData, setOverviewData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString());

  // Fetch from backend
  const fetchOverview = useCallback(async (isBackground = false) => {
    if (isBackground) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await api.getCityMobilityOverview({
        dateFilter,
        modeFilter,
        isDemo,
      });

      if (res.success && res.data) {
        setOverviewData(res.data);
        setLastUpdated(new Date(res.data.lastUpdated || Date.now()).toLocaleTimeString());
      }
    } catch (err) {
      console.error('[CityTransportNetwork] Error fetching city overview:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [dateFilter, modeFilter, isDemo]);

  // Initial and filter change effect
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // 45-second background polling
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchOverview(true);
    }, 45000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchOverview]);

  const summary = overviewData?.summary || {};
  const walking = overviewData?.walking || {};
  const cycling = overviewData?.cycling || {};
  const ev = overviewData?.ev || {};
  const publicTransport = overviewData?.publicTransport || {};
  const envImpact = overviewData?.environmentalImpact || {};

  return (
    <div className="main-content" style={{ maxWidth: '1160px', margin: '0 auto', paddingBottom: '5rem' }}>
      {/* ─── 1. CITY NETWORK MAIN DASHBOARD HEADER ───────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: '1.75rem', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="badge-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#ecfdf5', color: '#065f46', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              <Building2 size={15} />
              <span>MUNICIPAL MOBILITY GRID</span>
            </div>
            <h1 className="page-title" style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--slate-900)', margin: '0.2rem 0' }}>
              City Mobility Overview
            </h1>
            <p className="page-subtitle" style={{ fontSize: '0.9rem', color: 'var(--slate-600)', margin: 0 }}>
              Verified urban mobility analytics across walking, cycling, EV rides and public transport.
            </p>
          </div>

          {/* Controls: Live vs Demo Toggle + Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Live / Demo Mode Switch */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--slate-100)',
              padding: '4px',
              borderRadius: '12px',
              border: '1px solid var(--slate-200)',
            }}>
              <button
                onClick={() => setIsDemo(false)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: !isDemo ? '#059669' : 'transparent',
                  color: !isDemo ? '#ffffff' : 'var(--slate-600)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: !isDemo ? '#ffffff' : '#10b981' }} />
                <span>LIVE DATA</span>
              </button>

              <button
                onClick={() => setIsDemo(true)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: isDemo ? '#d97706' : 'transparent',
                  color: isDemo ? '#ffffff' : 'var(--slate-600)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Sparkles size={13} />
                <span>DEMO ANALYTICS</span>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchOverview(true)}
              disabled={isRefreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                background: '#ffffff',
                border: '1px solid var(--slate-300)',
                borderRadius: '10px',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--slate-700)',
                cursor: 'pointer',
              }}
              title="Refresh City Analytics"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-emerald-600' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Live Status & Last Updated */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.76rem', color: 'var(--slate-500)', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: isDemo ? '#f59e0b' : '#10b981' }} />
            <span>
              Status: <strong>{isDemo ? 'Demo Analytics (Presentation Sandbox)' : 'Live Database Stream (Verified Journeys Only)'}</strong>
            </span>
          </div>
          <div>
            Last Updated: <strong>{lastUpdated}</strong> (Auto-refresh: 45s)
          </div>
        </div>
      </div>

      {/* ─── TOP SUMMARY CARDS (6 DYNAMIC VALUES) ─────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.85rem',
        marginBottom: '1.75rem',
      }}>
        {/* Total Verified Journeys */}
        <div className="card" style={{ padding: '1rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-500)', fontSize: '0.74rem', fontWeight: 700 }}>
            <span>Total Journeys</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--slate-900)', marginTop: '0.35rem' }}>
            {summary.totalVerifiedJourneys?.toLocaleString() || 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)', marginTop: '2px' }}>
            Verified & Completed
          </div>
        </div>

        {/* Walking Journeys */}
        <div className="card" style={{ padding: '1rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-500)', fontSize: '0.74rem', fontWeight: 700 }}>
            <span>Walking</span>
            <Footprints size={16} className="text-emerald-600" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#059669', marginTop: '0.35rem' }}>
            {summary.walkingJourneys?.toLocaleString() || 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)', marginTop: '2px' }}>
            Pedestrian Journeys
          </div>
        </div>

        {/* Cycling Journeys */}
        <div className="card" style={{ padding: '1rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-500)', fontSize: '0.74rem', fontWeight: 700 }}>
            <span>Cycling</span>
            <Bike size={16} className="text-amber-500" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#d97706', marginTop: '0.35rem' }}>
            {summary.cyclingJourneys?.toLocaleString() || 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)', marginTop: '2px' }}>
            Active Cycling Trips
          </div>
        </div>

        {/* EV Journeys */}
        <div className="card" style={{ padding: '1rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-500)', fontSize: '0.74rem', fontWeight: 700 }}>
            <span>EV Rides</span>
            <Zap size={16} className="text-emerald-500" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#047857', marginTop: '0.35rem' }}>
            {summary.evJourneys?.toLocaleString() || 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)', marginTop: '2px' }}>
            Zero-Tailpipe EV
          </div>
        </div>

        {/* Public Transport Journeys */}
        <div className="card" style={{ padding: '1rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-500)', fontSize: '0.74rem', fontWeight: 700 }}>
            <span>Public Transit</span>
            <Bus size={16} className="text-blue-600" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#2563eb', marginTop: '0.35rem' }}>
            {summary.publicTransportJourneys?.toLocaleString() || 0}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--slate-400)', marginTop: '2px' }}>
            Bus & Metro Commutes
          </div>
        </div>

        {/* Estimated CO2 Saved */}
        <div className="card" style={{ padding: '1rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#065f46', fontSize: '0.74rem', fontWeight: 700 }}>
            <span title="Estimated from verified mobility journeys and configured emission factors.">
              Estimated CO₂ Saved
            </span>
            <Flame size={16} className="text-emerald-700" />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#065f46', marginTop: '0.35rem' }}>
            {summary.estimatedCo2SavedKg?.toLocaleString() || 0}
            <span style={{ fontSize: '0.82rem', fontWeight: 600, marginLeft: '3px' }}>kg</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#047857', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Info size={11} />
            <span>Configured Emission Factors</span>
          </div>
        </div>
      </div>

      {/* ─── 2. FILTERS ───────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--slate-200)',
        borderRadius: '14px',
        padding: '0.85rem 1.25rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              DATE:
            </span>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--slate-100)', padding: '3px', borderRadius: '8px' }}>
              {[
                { id: 'TODAY', label: 'Today' },
                { id: 'LAST_7_DAYS', label: 'Last 7 Days' },
                { id: 'LAST_30_DAYS', label: 'Last 30 Days' },
                { id: 'ALL_TIME', label: 'Custom / All' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDateFilter(d.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: dateFilter === d.id ? '#ffffff' : 'transparent',
                    color: dateFilter === d.id ? 'var(--slate-900)' : 'var(--slate-500)',
                    boxShadow: dateFilter === d.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
              MODE:
            </span>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--slate-100)', padding: '3px', borderRadius: '8px' }}>
              {[
                { id: 'ALL', label: 'All' },
                { id: 'WALKING', label: 'Walking' },
                { id: 'CYCLING', label: 'Cycling' },
                { id: 'EV', label: 'EV' },
                { id: 'PUBLIC_TRANSPORT', label: 'Public Transport' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModeFilter(m.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: modeFilter === m.id ? '#ffffff' : 'transparent',
                    color: modeFilter === m.id ? 'var(--slate-900)' : 'var(--slate-500)',
                    boxShadow: modeFilter === m.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mode indication label */}
        <div style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>
          Showing {modeFilter === 'ALL' ? 'all 4 mobility modes' : `${modeFilter} records`}
        </div>
      </div>

      {/* Empty State Banner when LIVE DATA has no records */}
      {!isDemo && overviewData?.hasData === false && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fef3c7',
          borderRadius: '14px',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          marginBottom: '2rem',
        }}>
          <AlertCircle size={32} className="text-amber-500" style={{ margin: '0 auto 0.75rem' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#92400e', marginBottom: '0.35rem' }}>
            No verified mobility data available for this period.
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#b45309', maxWidth: '480px', margin: '0 auto 1.25rem' }}>
            Complete and verify journeys via the Mobility Tracker to see real live stats, or switch to Demo Analytics to view full presentation data.
          </p>
          <button
            onClick={() => setIsDemo(true)}
            style={{
              padding: '0.6rem 1.2rem',
              background: '#d97706',
              color: '#ffffff',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
            }}
          >
            Switch to Demo Analytics
          </button>
        </div>
      )}

      {/* ─── 3. WALKING ANALYSIS ─────────────────────────────────────────────────── */}
      {(modeFilter === 'ALL' || modeFilter === 'WALKING') && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Footprints size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                Walking Analysis
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                {walking.totalJourneys || 0} verified walking trips recorded
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {/* A. Walking Activity by Time */}
            <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--slate-900)', marginBottom: '0.2rem' }}>
                Walking Activity by Time
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                Hourly breakdown (6 AM – 9 PM)
              </div>
              <TimeActivityBarChart data={walking.activityByTime} barColor="#10b981" emptyText="No walking activity recorded for this period" />
            </div>

            {/* B. Most Active Walking Locations */}
            <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--slate-900)', marginBottom: '0.2rem' }}>
                Most Active Walking Locations
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                Top zones with highest pedestrian volume
              </div>
              <HorizontalBarChart items={walking.mostActiveLocations} barColor="#10b981" emptyText="No active walking locations recorded" />
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. CYCLING ANALYSIS ─────────────────────────────────────────────────── */}
      {(modeFilter === 'ALL' || modeFilter === 'CYCLING') && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bike size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                Cycling Analysis
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                {cycling.totalJourneys || 0} verified cycling trips recorded
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {/* A. Cycling Activity by Time */}
            <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--slate-900)', marginBottom: '0.2rem' }}>
                Cycling Activity by Time
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                Hourly breakdown (6 AM – 9 PM)
              </div>
              <TimeActivityBarChart data={cycling.activityByTime} barColor="#f59e0b" emptyText="No cycling activity recorded for this period" />
            </div>

            {/* B. Most Active Cycling Locations */}
            <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--slate-900)', marginBottom: '0.2rem' }}>
                Most Active Cycling Locations
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                Top zones with highest cycling density
              </div>
              <HorizontalBarChart items={cycling.mostActiveLocations} barColor="#f59e0b" emptyText="No active cycling locations recorded" />
            </div>
          </div>
        </div>
      )}

      {/* ─── 5. EV MOBILITY ANALYSIS ─────────────────────────────────────────────── */}
      {(modeFilter === 'ALL' || modeFilter === 'EV') && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                EV Mobility Analysis
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                {ev.totalJourneys || 0} verified EV trips recorded
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {/* A. EV Activity by Time */}
            <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--slate-900)', marginBottom: '0.2rem' }}>
                EV Activity by Time
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                Hourly breakdown (6 AM – 9 PM)
              </div>
              <TimeActivityBarChart data={ev.activityByTime} barColor="#059669" emptyText="No EV activity recorded for this period" />
            </div>

            {/* B. Most Active EV Locations */}
            <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--slate-900)', marginBottom: '0.2rem' }}>
                Most Active EV Locations
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                Top zones with highest EV travel volume
              </div>
              <HorizontalBarChart items={ev.mostActiveLocations} barColor="#059669" emptyText="No active EV locations recorded" />
            </div>
          </div>
        </div>
      )}

      {/* ─── 6. PUBLIC TRANSPORT ANALYSIS ────────────────────────────────────────── */}
      {(modeFilter === 'ALL' || modeFilter === 'PUBLIC_TRANSPORT') && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bus size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                Public Transport Analysis
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                {publicTransport.totalJourneys || 0} verified transit commutes
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {/* A. Public Transport Activity by Time */}
            <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--slate-900)', marginBottom: '0.2rem' }}>
                Public Transport Activity by Time
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                Hourly breakdown (6 AM – 9 PM)
              </div>
              <TimeActivityBarChart data={publicTransport.activityByTime} barColor="#3b82f6" emptyText="No transit journeys recorded for this period" />
            </div>

            {/* B. Most Used Origins */}
            <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--slate-900)', marginBottom: '0.2rem' }}>
                Most Used Origins
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                Most frequently recorded departure terminals
              </div>
              <HorizontalBarChart items={publicTransport.mostUsedOrigins} labelKey="origin" barColor="#3b82f6" emptyText="No origin data recorded" />
            </div>

            {/* C. Most Used Destinations */}
            <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--slate-900)', marginBottom: '0.2rem' }}>
                Most Used Destinations
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                Most frequently recorded arrival terminals
              </div>
              <HorizontalBarChart items={publicTransport.mostUsedDestinations} labelKey="destination" barColor="#2563eb" emptyText="No destination data recorded" />
            </div>
          </div>
        </div>
      )}

      {/* ─── 7. ENVIRONMENTAL IMPACT (CO2 ANALYSIS) ──────────────────────────────── */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ecfdf5', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Flame size={16} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
              Environmental Impact
            </h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
              Estimated CO₂ emissions avoided through sustainable mobility
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {/* B. CO2 Saved by Mobility Mode */}
          <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--slate-900)' }}>
                  CO₂ Saved by Mobility Mode
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                  Avoidance breakdown across modes
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#065f46' }}>
                  {envImpact.totalCo2SavedKg || 0} kg
                </span>
              </div>
            </div>

            <HorizontalBarChart
              items={envImpact.co2ByMode}
              labelKey="mode"
              valueKey="co2SavedKg"
              barColor="#059669"
              emptyText="No CO2 savings data recorded"
            />
          </div>

          {/* C. CO2 Saved Over Time */}
          <div className="card" style={{ padding: '1.25rem', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '16px' }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--slate-900)', marginBottom: '0.2rem' }}>
              CO₂ Saved Over Time
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginBottom: '0.75rem' }}>
              {dateFilter === 'TODAY' ? 'Hourly accumulation today' : 'Daily timeline across selected date range'}
            </div>
            <Co2OverTimeChart data={envImpact.co2OverTime} />
          </div>
        </div>
      </div>
    </div>
  );
}
