import React from 'react';
import { Bus, Train, ArrowRight, ShieldCheck, Sparkles, X, ChevronRight } from 'lucide-react';

export default function PublicTransportModeSelector({ onSelectMode, onClose }) {
  return (
    <div style={{
      maxWidth: '680px',
      margin: '0 auto',
      animation: 'fadeIn 0.25s ease-out',
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '1.75rem',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#ecfdf5',
          color: '#059669',
          border: '1px solid #a7f3d0',
          padding: '4px 12px',
          borderRadius: '9999px',
          fontSize: '0.76rem',
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
        }}>
          <ShieldCheck size={14} />
          <span>Real-World Verification</span>
        </div>

        <h2 style={{
          fontSize: '1.6rem',
          fontWeight: 800,
          color: 'var(--slate-900)',
          margin: '0 0 0.4rem',
        }}>
          PUBLIC TRANSPORT
        </h2>
        <p style={{
          fontSize: '0.88rem',
          color: 'var(--slate-600)',
          maxWidth: '460px',
          margin: '0 auto',
          lineHeight: 1.45,
        }}>
          Select your transit mode for genuine ticket verification, station geofencing, and automated Green Credit awards.
        </p>
      </div>

      {/* Two Options Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        {/* OPTION A: BUS */}
        <div
          onClick={() => onSelectMode('BUS')}
          className="card-hover-lift"
          style={{
            background: '#ffffff',
            border: '2px solid #e2e8f0',
            borderRadius: '18px',
            padding: '1.5rem',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#059669';
            e.currentTarget.style.boxShadow = '0 12px 28px rgba(5, 150, 105, 0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }}
        >
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.15)',
          }}>
            <Bus size={28} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
              🚌 Bus
            </h3>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#059669',
              background: '#ecfdf5',
              padding: '2px 8px',
              borderRadius: '6px',
            }}>
              +6–8 GP/km
            </span>
          </div>

          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#047857', marginBottom: '0.5rem' }}>
            Verify Bus Ticket
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--slate-500)', lineHeight: 1.45, margin: '0 0 1.25rem' }}>
            Scan or upload your municipal bus ticket (PMPML / BEST). Automated OCR extraction with anti-replay hash checks.
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            fontWeight: 800,
            color: '#059669',
          }}>
            <span>Continue with Bus</span>
            <ArrowRight size={15} />
          </div>
        </div>

        {/* OPTION B: METRO */}
        <div
          onClick={() => onSelectMode('METRO')}
          className="card-hover-lift"
          style={{
            background: '#ffffff',
            border: '2px solid #e2e8f0',
            borderRadius: '18px',
            padding: '1.5rem',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#4f46e5';
            e.currentTarget.style.boxShadow = '0 12px 28px rgba(79, 70, 229, 0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }}
        >
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
            color: '#4f46e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)',
          }}>
            <Train size={28} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
              🚇 Metro
            </h3>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#4f46e5',
              background: '#eef2ff',
              padding: '2px 8px',
              borderRadius: '6px',
            }}>
              +8–10 GP/km
            </span>
          </div>

          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#4338ca', marginBottom: '0.5rem' }}>
            Verify Metro Journey
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--slate-500)', lineHeight: 1.45, margin: '0 0 1.25rem' }}>
            Live Camera QR scan or screenshot upload. Backed by station geofencing, multi-factor evidence, and tunnel grace periods.
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            fontWeight: 800,
            color: '#4f46e5',
          }}>
            <span>Continue with Metro</span>
            <ArrowRight size={15} />
          </div>
        </div>
      </div>

      {/* Back button */}
      {onClose && (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '0.45rem 1.25rem' }}
          >
            Cancel & Return to Modes
          </button>
        </div>
      )}
    </div>
  );
}
