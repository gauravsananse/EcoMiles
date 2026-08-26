import React, { useState } from 'react';
import {
  QrCode,
  Download,
  Printer,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Scan,
  ShieldCheck,
  Loader2,
  X,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { api } from '../services/api';

export default function QRVehicleBinding({
  vehicle,
  onClose,
  onRegenerate,
  isRegenerating,
}) {
  const [activeTab, setActiveTab] = useState('display'); // 'display' | 'scanner'
  const [scanInputToken, setScanInputToken] = useState('');
  const [isVerifyingQR, setIsVerifyingQR] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!vehicle) return null;

  // Handle Download QR PNG
  const handleDownload = () => {
    if (!vehicle.qrDataURL) return;
    const link = document.createElement('a');
    link.href = vehicle.qrDataURL;
    link.download = `GreenCredits-QR-${vehicle.registrationNumber}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Print QR
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Green Credits EV QR Pass - ${vehicle.registrationNumber}</title>
          <style>
            body { font-family: 'Plus Jakarta Sans', sans-serif; text-align: center; padding: 40px; color: #0f172a; }
            .card { border: 2px solid #059669; border-radius: 16px; padding: 30px; max-width: 400px; margin: 0 auto; }
            h2 { color: #059669; margin-bottom: 5px; }
            .plate { font-size: 24px; font-weight: 800; font-family: monospace; letter-spacing: 2px; margin: 15px 0; }
            img { width: 240px; height: 240px; }
            .note { font-size: 12px; color: #64748b; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Green Credits EV Pass</h2>
            <div>Physical Binding Verification QR</div>
            <div class="plate">${vehicle.registrationNumber}</div>
            <img src="${vehicle.qrDataURL}" alt="Vehicle QR" />
            <div class="note">Affix this QR code to your EV. Scan during check-ins to verify physical access.</div>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Copy raw token
  const handleCopyToken = () => {
    if (!vehicle.qrToken) return;
    navigator.clipboard.writeText(vehicle.qrToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simulate scanning token
  const handleTestScan = async (tokenToTest) => {
    const targetToken = tokenToTest || scanInputToken || vehicle.qrToken;
    if (!targetToken) return;

    setIsVerifyingQR(true);
    setScanResult(null);

    try {
      const res = await api.verifyQR(targetToken.trim());
      setScanResult({
        success: true,
        message: res.message || '✓ Vehicle Binding Confirmed',
        vehicle: res.vehicle,
      });
    } catch (err) {
      setScanResult({
        success: false,
        message: err.data?.error || err.message || '✕ This vehicle is not associated with your account.',
      });
    } finally {
      setIsVerifyingQR(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '1.5rem',
    }}>
      <div className="card" style={{
        maxWidth: '520px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        animation: 'fadeIn 0.2s ease-out',
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
        >
          <X size={20} />
        </button>

        {/* Tab Selector */}
        <div style={{
          display: 'flex',
          background: 'var(--slate-100)',
          padding: '4px',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          marginTop: '0.5rem',
        }}>
          <button
            onClick={() => { setActiveTab('display'); setScanResult(null); }}
            style={{
              flex: 1,
              padding: '0.45rem',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              background: activeTab === 'display' ? '#ffffff' : 'transparent',
              color: activeTab === 'display' ? 'var(--slate-900)' : 'var(--slate-500)',
              boxShadow: activeTab === 'display' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Your Vehicle QR
          </button>
          <button
            onClick={() => { setActiveTab('scanner'); setScanResult(null); }}
            style={{
              flex: 1,
              padding: '0.45rem',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              background: activeTab === 'scanner' ? '#ffffff' : 'transparent',
              color: activeTab === 'scanner' ? 'var(--slate-900)' : 'var(--slate-500)',
              boxShadow: activeTab === 'scanner' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Scan & Verify Access
          </button>
        </div>

        {activeTab === 'display' ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                Your Vehicle QR Code
              </h3>
              <div style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--primary-700)',
                fontWeight: 700,
                fontSize: '1rem',
                marginTop: '0.2rem',
              }}>
                {vehicle.registrationNumber}
              </div>
            </div>

            <div className="qr-container">
              <div className="qr-image-wrapper">
                {vehicle.qrDataURL ? (
                  <img
                    src={vehicle.qrDataURL}
                    alt={`QR Code for ${vehicle.registrationNumber}`}
                    className="qr-image"
                  />
                ) : (
                  <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Loader2 className="animate-spin text-emerald-600" size={32} />
                  </div>
                )}
              </div>

              <p style={{
                fontSize: '0.85rem',
                color: 'var(--slate-600)',
                maxWidth: '340px',
                lineHeight: 1.4,
                marginBottom: '1rem',
              }}>
                Place this QR code on your EV. It can later be scanned to confirm physical access to the registered vehicle.
              </p>

              {/* Secure Token display */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--slate-50)',
                border: '1px solid var(--slate-200)',
                borderRadius: '8px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                color: 'var(--slate-600)',
                fontFamily: 'var(--font-mono)',
                maxWidth: '360px',
                width: '100%',
                justifyContent: 'space-between',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Token: {vehicle.qrToken?.slice(0, 16)}...
                </span>
                <button
                  onClick={handleCopyToken}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: copied ? 'var(--primary-600)' : 'var(--slate-500)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                  title="Copy full cryptographic token"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.6rem',
              marginTop: '1.25rem',
              justifyContent: 'center',
            }}>
              <button
                onClick={handleDownload}
                className="btn btn-primary"
                style={{ flex: '1 1 140px', padding: '0.6rem 1rem', fontSize: '0.875rem' }}
              >
                <Download size={16} />
                <span>Download QR</span>
              </button>

              <button
                onClick={handlePrint}
                className="btn btn-secondary"
                style={{ flex: '1 1 140px', padding: '0.6rem 1rem', fontSize: '0.875rem' }}
              >
                <Printer size={16} />
                <span>Print QR</span>
              </button>

              <button
                onClick={onRegenerate}
                className="btn btn-secondary"
                style={{ flex: '1 1 140px', padding: '0.6rem 1rem', fontSize: '0.875rem' }}
                disabled={isRegenerating}
              >
                {isRegenerating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                <span>Generate New QR</span>
              </button>
            </div>
          </div>
        ) : (
          /* Scanner / Verification Testbed Tab */
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                display: 'inline-flex',
                padding: '10px',
                background: 'var(--primary-50)',
                color: 'var(--primary-600)',
                borderRadius: '50%',
                marginBottom: '0.5rem',
              }}>
                <Scan size={26} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                Physical QR Binding Verification
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--slate-500)' }}>
                Simulate scanning this EV's QR token to test physical ownership verification.
              </p>
            </div>

            <div style={{
              background: 'var(--slate-50)',
              border: '1px solid var(--slate-200)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1rem',
            }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-600)', marginBottom: '0.4rem' }}>
                Secure QR Token
              </label>
              <input
                type="text"
                placeholder="Enter or paste QR token"
                value={scanInputToken || vehicle.qrToken || ''}
                onChange={(e) => setScanInputToken(e.target.value)}
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '8px',
                  border: '1px solid var(--slate-300)',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                onClick={() => handleTestScan(vehicle.qrToken)}
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={isVerifyingQR}
              >
                {isVerifyingQR ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Verify My Vehicle Binding</span>
                  </>
                )}
              </button>
            </div>

            {scanResult && (
              <div style={{
                borderRadius: '12px',
                padding: '1rem',
                background: scanResult.success ? 'var(--primary-50)' : 'var(--rose-50)',
                border: `1px solid ${scanResult.success ? 'var(--primary-200)' : '#fecdd3'}`,
                color: scanResult.success ? 'var(--primary-800)' : 'var(--rose-700)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                animation: 'fadeIn 0.2s ease',
              }}>
                <div style={{ flexShrink: 0, marginTop: '2px' }}>
                  {scanResult.success ? (
                    <CheckCircle2 size={20} className="text-emerald-600" />
                  ) : (
                    <XCircle size={20} className="text-rose-600" />
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {scanResult.message}
                  </div>
                  {scanResult.vehicle && (
                    <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', opacity: 0.9 }}>
                      Vehicle: {scanResult.vehicle.registrationNumber} ({scanResult.vehicle.manufacturer} {scanResult.vehicle.model})
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
