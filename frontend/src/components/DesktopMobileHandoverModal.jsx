import React, { useState } from 'react';
import {
  Smartphone,
  QrCode,
  Copy,
  Check,
  X,
  ShieldAlert,
  Compass,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

export default function DesktopMobileHandoverModal({ isOpen, onClose, onProceedDesktopMapOnly }) {
  const [copied, setCopied] = useState(false);
  const mobileUrl = typeof window !== 'undefined' ? window.location.href : 'https://greencredits.app';

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(mobileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Generate QR image via high-resolution SVG or dynamic data URL
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=064e3b&data=${encodeURIComponent(mobileUrl)}`;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 110,
      padding: '1.25rem',
      animation: 'fadeIn 0.2s ease-out',
    }}>
      <div className="card" style={{
        maxWidth: '520px',
        width: '100%',
        position: 'relative',
        padding: '2rem',
        borderRadius: '20px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--slate-400)',
            padding: '4px',
          }}
          title="Close"
        >
          <X size={20} />
        </button>

        {/* Header Icon */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            color: '#059669',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem',
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.15)',
          }}>
            <Smartphone size={30} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.4rem' }}>
            📱 Mobile Device Required
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--slate-600)', lineHeight: 1.5, margin: 0 }}>
            Walking verification uses mobile sensors such as the <strong>step counter</strong>, <strong>accelerometer</strong>, and <strong>gyroscope</strong>.
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', marginTop: '0.35rem', fontWeight: 600 }}>
            Please open GreenCredits on your smartphone to start a verified walking journey.
          </p>
        </div>

        {/* QR Code Card */}
        <div style={{
          background: 'var(--slate-50)',
          border: '1px solid var(--slate-200)',
          borderRadius: '16px',
          padding: '1.25rem',
          textAlign: 'center',
          marginBottom: '1.25rem',
        }}>
          <div style={{
            display: 'inline-block',
            padding: '10px',
            background: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            border: '1px solid var(--slate-200)',
          }}>
            <img
              src={qrImageSrc}
              alt="Scan to open GreenCredits Mobile"
              style={{ width: '180px', height: '180px', display: 'block' }}
              onError={(e) => {
                // Fallback placeholder if offline
                e.target.style.display = 'none';
              }}
            />
          </div>

          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--slate-700)', marginTop: '0.75rem' }}>
            Scan with smartphone camera to open Mobile Journey Mode
          </div>

          {/* Copy Link Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: '#ffffff',
            border: '1px solid var(--slate-200)',
            borderRadius: '8px',
            padding: '0.35rem 0.6rem',
            marginTop: '0.75rem',
            fontSize: '0.78rem',
            color: 'var(--slate-600)',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left', fontFamily: 'var(--font-mono)' }}>
              {mobileUrl}
            </span>
            <button
              onClick={handleCopyLink}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: copied ? '#ecfdf5' : 'var(--slate-100)',
                color: copied ? '#059669' : 'var(--slate-700)',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.72rem',
                cursor: 'pointer',
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Laptop GPS Disclaimer Notice */}
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fef3c7',
          color: '#92400e',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          fontSize: '0.78rem',
          lineHeight: 1.4,
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-start',
        }}>
          <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#b45309' }} />
          <div>
            <strong>Desktop Policy:</strong> Laptop geolocation alone is not proof of walking. Walking GreenCredits cannot be awarded based only on laptop interaction without verified mobile movement signals.
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <button
            onClick={() => {
              if (window.open) {
                window.open(mobileUrl, '_blank');
              }
            }}
            className="btn btn-primary btn-full"
            style={{ padding: '0.75rem', fontSize: '0.95rem', justifyContent: 'center' }}
          >
            <Smartphone size={18} />
            <span>📱 Continue on Mobile</span>
          </button>

          {onProceedDesktopMapOnly && (
            <button
              onClick={() => {
                onClose();
                onProceedDesktopMapOnly();
              }}
              className="btn btn-secondary btn-full"
              style={{ padding: '0.55rem', fontSize: '0.8rem', justifyContent: 'center' }}
            >
              <Compass size={15} />
              <span>Inspect Map Only (Unverified / 0 Credits)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
