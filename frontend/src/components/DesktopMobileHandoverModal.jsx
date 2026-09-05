import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  QrCode,
  Copy,
  Check,
  X,
  ShieldAlert,
  Compass,
  ArrowRight,
  ExternalLink,
  Wifi,
  Globe,
  Edit3,
  RefreshCw,
  Sparkles,
  Lock,
  Radio
} from 'lucide-react';
import { api } from '../services/api';

export default function DesktopMobileHandoverModal({
  isOpen,
  onClose,
  onProceedDesktopMapOnly,
  journeyId,
  userToken
}) {
  const [copied, setCopied] = useState(false);
  const [connectionMode, setConnectionMode] = useState('TUNNEL'); // 'TUNNEL' | 'WIFI'
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [localWifiUrl, setLocalWifiUrl] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isOpen) {
      fetchNetworkEndpoints();
      // Poll every 3 seconds while open to catch newly established tunnels
      interval = setInterval(fetchNetworkEndpoints, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen]);

  const fetchNetworkEndpoints = async () => {
    try {
      const res = await api.getNetworkIp();
      if (res && res.success) {
        if (res.tunnelUrl) {
          setTunnelUrl(res.tunnelUrl);
        }
        if (res.localUrl) {
          setLocalWifiUrl(res.localUrl);
        }
        if (!customUrl) {
          setCustomUrl(res.tunnelUrl || res.localUrl || window.location.origin);
        }
      }
    } catch (err) {
      console.warn('Network IP lookup:', err.message);
    }
  };

  if (!isOpen) return null;

  // Resolve base URL
  let baseUrl = window.location.origin;
  if (isEditingUrl && customUrl) {
    baseUrl = customUrl.trim();
  } else if (connectionMode === 'TUNNEL' && tunnelUrl) {
    baseUrl = tunnelUrl;
  } else if (connectionMode === 'WIFI' && localWifiUrl) {
    baseUrl = localWifiUrl;
  } else if (customUrl) {
    baseUrl = customUrl;
  }

  // Ensure trailing slash is removed before appending query parameters
  baseUrl = baseUrl.replace(/\/+$/, '');

  // Build target URL with journeyId and pairing params
  const queryParams = new URLSearchParams();
  queryParams.set('tab', 'tracker');
  queryParams.set('pair', 'true');
  if (journeyId) {
    queryParams.set('journeyId', journeyId);
  }
  const fullMobileUrl = `${baseUrl}/?${queryParams.toString()}`;

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullMobileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Generate QR image from qrserver API
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=064e3b&data=${encodeURIComponent(fullMobileUrl)}`;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.82)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 110,
      padding: '1rem',
      animation: 'fadeIn 0.2s ease-out',
      overflowY: 'auto',
    }}>
      <div className="card" style={{
        maxWidth: '520px',
        width: '100%',
        position: 'relative',
        padding: '1.75rem',
        borderRadius: '22px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        maxHeight: '94vh',
        overflowY: 'auto',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--slate-400)',
            padding: '6px',
          }}
          title="Close"
        >
          <X size={20} />
        </button>

        {/* Header Icon */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            color: '#059669',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.5rem',
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.15)',
          }}>
            <Smartphone size={28} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.35rem' }}>
            📱 Connect Mobile Device
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--slate-600)', lineHeight: 1.45, margin: 0 }}>
            Live sensor tracking uses real hardware sensors: <strong>3D Accelerometer</strong>, <strong>Gyroscope</strong>, and <strong>Pedometer Step Counter</strong>.
          </p>
          <p style={{ fontSize: '0.82rem', color: '#047857', marginTop: '0.3rem', fontWeight: 700 }}>
            Scan with your phone to start streaming live steps & speed in real time.
          </p>
        </div>

        {/* Connection Mode Switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--slate-100)',
          borderRadius: '10px',
          padding: '3px',
          marginBottom: '0.85rem',
        }}>
          <button
            onClick={() => { setConnectionMode('TUNNEL'); setIsEditingUrl(false); }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '6px',
              border: 'none',
              borderRadius: '7px',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: connectionMode === 'TUNNEL' ? '#ffffff' : 'transparent',
              color: connectionMode === 'TUNNEL' ? '#047857' : 'var(--slate-600)',
              boxShadow: connectionMode === 'TUNNEL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <Globe size={13} />
            <span>🌐 Secure HTTPS (Tunnel / 4G / 5G)</span>
          </button>

          <button
            onClick={() => { setConnectionMode('WIFI'); setIsEditingUrl(false); }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '6px',
              border: 'none',
              borderRadius: '7px',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: connectionMode === 'WIFI' ? '#ffffff' : 'transparent',
              color: connectionMode === 'WIFI' ? '#047857' : 'var(--slate-600)',
              boxShadow: connectionMode === 'WIFI' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <Wifi size={13} />
            <span>📶 Local Wi-Fi / LAN</span>
          </button>
        </div>

        {/* QR Code Card */}
        <div style={{
          background: 'var(--slate-50)',
          border: '1px solid var(--slate-200)',
          borderRadius: '16px',
          padding: '1.15rem',
          textAlign: 'center',
          marginBottom: '1rem',
        }}>
          {/* Security & Access Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: connectionMode === 'TUNNEL' && tunnelUrl ? '#ecfdf5' : '#eff6ff',
            color: connectionMode === 'TUNNEL' && tunnelUrl ? '#065f46' : '#1e40af',
            border: `1px solid ${connectionMode === 'TUNNEL' && tunnelUrl ? '#a7f3d0' : '#bfdbfe'}`,
            padding: '3px 10px',
            borderRadius: '9999px',
            fontSize: '0.74rem',
            fontWeight: 700,
            marginBottom: '0.85rem',
          }}>
            {connectionMode === 'TUNNEL' ? <Lock size={12} /> : <Wifi size={12} />}
            <span>
              {connectionMode === 'TUNNEL'
                ? (tunnelUrl ? '🔒 Secure HTTPS — Full Mobile Sensor & GPS Access' : '⏳ Tunnel Initializing...')
                : 'Connect phone to same Wi-Fi network'
              }
            </span>
          </div>

          <div style={{
            display: 'inline-block',
            padding: '12px',
            background: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
            border: '1px solid var(--slate-200)',
          }}>
            <img
              src={qrImageSrc}
              alt="Scan to open GreenCredits on mobile"
              style={{ width: '190px', height: '190px', display: 'block' }}
            />
          </div>

          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--slate-800)', marginTop: '0.65rem' }}>
            Scan with phone camera to launch live tracking
          </div>

          {/* Dynamic Mobile URL with Edit option */}
          <div style={{ marginTop: '0.75rem' }}>
            {!isEditingUrl ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#ffffff',
                border: '1px solid var(--slate-200)',
                borderRadius: '8px',
                padding: '0.35rem 0.6rem',
                fontSize: '0.78rem',
                color: 'var(--slate-700)',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {fullMobileUrl}
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
                  title="Copy URL"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={() => {
                    setCustomUrl(baseUrl);
                    setIsEditingUrl(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--slate-400)',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                  title="Change IP or Tunnel URL"
                >
                  <Edit3 size={13} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://..."
                  style={{
                    flex: 1,
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-mono)',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--primary-500)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => setIsEditingUrl(false)}
                  className="btn btn-primary"
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live sync indicator notice */}
        <div style={{
          background: '#eff6ff',
          border: '1px solid #dbeafe',
          color: '#1e40af',
          borderRadius: '12px',
          padding: '0.65rem 0.85rem',
          fontSize: '0.76rem',
          lineHeight: 1.4,
          marginBottom: '1.25rem',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-start',
        }}>
          <Radio size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#2563eb' }} className="animate-pulse-subtle" />
          <div>
            <strong>Live Sync Active:</strong> Once your phone connects and starts moving, the dashboard will update with your real-time step count, exact speed (km/h), and sensor telemetry.
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            onClick={() => {
              if (window.open) {
                window.open(fullMobileUrl, '_blank');
              }
            }}
            className="btn btn-primary btn-full"
            style={{ padding: '0.7rem', fontSize: '0.92rem', justifyContent: 'center' }}
          >
            <Smartphone size={17} />
            <span>📱 Open Mobile URL in Browser</span>
          </button>

          {onProceedDesktopMapOnly && (
            <button
              onClick={() => {
                onClose();
                onProceedDesktopMapOnly();
              }}
              className="btn btn-secondary btn-full"
              style={{ padding: '0.5rem', fontSize: '0.78rem', justifyContent: 'center' }}
            >
              <Compass size={14} />
              <span>Inspect Map Only (Unverified / 0 Credits)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
