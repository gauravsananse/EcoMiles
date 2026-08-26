import React from 'react';
import { Sparkles, Check, X, ShieldAlert, Info } from 'lucide-react';

export default function AIExplanationPanel({
  currentMode = 'STATIONARY',
  confidence = 0.95,
  evidenceList = [],
  fraudScore = 0,
  fraudRiskLevel = 'LOW',
}) {
  const getRiskBadgeColor = (level) => {
    switch (level) {
      case 'CRITICAL':
        return { bg: '#fee2e2', text: '#991b1b', border: '#f87171' };
      case 'HIGH':
        return { bg: '#ffedd5', text: '#9a3412', border: '#fb923c' };
      case 'MEDIUM':
        return { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' };
      default:
        return { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' };
    }
  };

  const riskBadge = getRiskBadgeColor(fraudRiskLevel);

  return (
    <div className="card" style={{ marginBottom: '1.5rem', background: '#ffffff', border: '1px solid var(--slate-200)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
          }}>
            <Sparkles size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--slate-900)' }}>
              Explainable AI Decision Audit
            </h3>
            <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
              Multi-signal sensor fusion transparent reasoning
            </div>
          </div>
        </div>

        {/* Fraud Risk Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: riskBadge.bg,
          color: riskBadge.text,
          border: `1px solid ${riskBadge.border}`,
          borderRadius: '9999px',
          padding: '3px 9px',
          fontSize: '0.72rem',
          fontWeight: 800,
        }}>
          <ShieldAlert size={13} />
          <span>Fraud Risk: {fraudRiskLevel} ({fraudScore}/100)</span>
        </div>
      </div>

      {/* Decision Summary Card */}
      <div style={{
        background: 'var(--slate-50)',
        borderRadius: '12px',
        padding: '0.85rem 1rem',
        marginBottom: '1rem',
        borderLeft: '4px solid var(--primary-600)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--slate-600)' }}>
            Primary Classification: <strong style={{ color: 'var(--slate-900)', fontSize: '0.95rem' }}>{currentMode}</strong>
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-700)' }}>
            Confidence: {Math.round(confidence * 100)}%
          </div>
        </div>
      </div>

      {/* Evidence Checklist */}
      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-400)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
        Verified Evidence & Signal Checklist
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {evidenceList.length > 0 ? (
          evidenceList.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--slate-700)' }}>
              <Check size={15} className="text-emerald-600" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{item}</span>
            </div>
          ))
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--slate-400)', fontStyle: 'italic' }}>
            Awaiting streaming sensor telemetry to compute dynamic evidence.
          </div>
        )}

        {/* Negative Evidence Rejections (Explainability) */}
        {currentMode === 'BUS' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--slate-500)' }}>
            <X size={15} className="text-rose-500" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>Pedestrian cadence and bicycle handlebar balance signatures absent.</span>
          </div>
        )}
        {currentMode === 'SCOOTER' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: '#ea580c', fontWeight: 600 }}>
            <X size={15} className="text-rose-500" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>Active human pedaling cadence is 0.0 rpm &rarr; Cycling rewards rejected.</span>
          </div>
        )}
      </div>
    </div>
  );
}
