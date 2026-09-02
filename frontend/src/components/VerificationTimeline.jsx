import React, { useState } from 'react';
import {
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Footprints,
  Bike,
  Zap,
  Bus,
  Train,
  Car,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Info
} from 'lucide-react';

export default function VerificationTimeline({ events = [], segments = [] }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!events || events.length === 0) return null;

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getEventIcon = (type, severity) => {
    if (type?.includes('WALKING')) return <Footprints size={14} className="text-emerald-600" />;
    if (type?.includes('CYCLING')) return <Bike size={14} className="text-emerald-600" />;
    if (type?.includes('EV')) return <Zap size={14} className="text-amber-500" />;
    if (type?.includes('BUS')) return <Bus size={14} className="text-blue-600" />;
    if (type?.includes('METRO') || type?.includes('TRAIN')) return <Train size={14} className="text-purple-600" />;
    if (type?.includes('REJECTED') || severity === 'ERROR') return <XCircle size={14} className="text-rose-600" />;
    if (severity === 'WARNING') return <AlertTriangle size={14} className="text-amber-500" />;
    if (severity === 'SUCCESS') return <CheckCircle2 size={14} className="text-emerald-600" />;
    return <Info size={14} className="text-slate-500" />;
  };

  return (
    <div className="card" style={{ padding: '0.85rem 1rem', marginTop: '1rem' }}>
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={16} className="text-slate-500" />
          <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--slate-800)', margin: 0 }}>
            Journey Verification Audit Log
          </h4>
          <span style={{
            background: 'var(--slate-100)',
            color: 'var(--slate-600)',
            padding: '1px 6px',
            borderRadius: '9999px',
            fontSize: '0.7rem',
            fontWeight: 700,
          }}>
            {events.length} events
          </span>
        </div>

        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)' }}>
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {isExpanded && (
        <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
          {events.map((ev, idx) => {
            const isError = ev.severity === 'ERROR' || ev.type?.includes('REJECTED');
            const isWarning = ev.severity === 'WARNING';
            const isSuccess = ev.severity === 'SUCCESS';

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  fontSize: '0.78rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  background: isError ? '#fff1f2' : (isWarning ? '#fffbeb' : (isSuccess ? '#f0fdf4' : 'var(--slate-50)')),
                  border: `1px solid ${isError ? '#fecdd3' : (isWarning ? '#fde68a' : (isSuccess ? '#bbf7d0' : 'var(--slate-200)'))}`,
                }}
              >
                <div style={{ marginTop: '2px' }}>
                  {getEventIcon(ev.type, ev.severity)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--slate-900)' }}>
                      {ev.text || ev.description}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--slate-400)', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                      {formatTime(ev.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
