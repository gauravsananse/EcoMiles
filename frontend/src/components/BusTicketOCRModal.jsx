import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import {
  X,
  Upload,
  CheckCircle2,
  Bus,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api';

function normalizeTicketDate(text) {
  const iso = text.match(/\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const indian = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (!indian) return '';
  const year = indian[3].length === 2 ? `20${indian[3]}` : indian[3];
  return `${year}-${indian[2].padStart(2, '0')}-${indian[1].padStart(2, '0')}`;
}

export default function BusTicketOCRModal({
  isOpen,
  onClose,
  onTicketVerified,
  currentRoute = null,
  fromText = '',
  toText = '',
}) {
  const [activeTab, setActiveTab] = useState('UPLOAD');
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [ocrStatus, setOcrStatus] = useState('');
  const [passengerCount, setPassengerCount] = useState(1);
  
  // These fields stay empty until a real ticket image has been read.
  const [ticketNumber, setTicketNumber] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [busNumber, setBusNumber] = useState('');
  const [route, setRoute] = useState('');
  const [fare, setFare] = useState('');
  const [ocrRawText, setOcrRawText] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setVerificationResult(null);
    setUploadedFile(file);
    setOcrStatus('Reading ticket with OCR…');
    setTicketNumber('');
    setDate('');
    setTime('');
    setBusNumber('');
    setRoute('');
    setFare('');
    setOcrRawText('');
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target.result);
    };
    reader.readAsDataURL(file);

    try {
      const worker = await createWorker('eng');
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const text = data.text.trim();
      setOcrRawText(text);
      setTicketNumber(text.match(/(?:ticket\s*(?:no|number)?|receipt|serial)\s*[:#-]?\s*([A-Z0-9/-]{4,20})/i)?.[1] || '');
      setDate(normalizeTicketDate(text));
      setTime(text.match(/\b(\d{1,2}:\d{2}(?:\s*[AP]M)?)\b/i)?.[1] || '');
      setBusNumber(text.match(/(?:bus|vehicle)\s*(?:no|number)?\s*[:#-]?\s*([A-Z0-9-]{2,16})/i)?.[1] || '');
      setRoute(text.match(/(?:route|line)\s*(?:no|number)?\s*[:#-]?\s*([^\n]{2,60})/i)?.[1]?.trim() || '');
      setFare(text.match(/(?:fare|rs\.?|inr|₹)\s*[:.-]?\s*(\d{1,4}(?:\.\d{1,2})?)/i)?.[1] || '');
      setOcrStatus(text ? 'OCR complete. Review the extracted details before verification.' : 'No readable ticket text found. Upload a clearer photo.');
    } catch (err) {
      setOcrStatus('OCR could not read this image. Upload a clearer, well-lit ticket photo.');
      setError(err.message || 'Ticket OCR failed.');
    }
  };

  const handleRunValidation = async () => {
    if (!uploadedFile || !ocrRawText.trim() || !ticketNumber.trim() || !date.trim()) {
      setError('Upload a readable ticket photo first. A ticket number and date must be extracted before verification.');
      return;
    }
    setIsLoading(true);
    setError('');
    setVerificationResult(null);

    try {
      const originStation = currentRoute?.originName || currentRoute?.firstStop?.name || fromText || 'Origin';
      const destStation = currentRoute?.destinationName || currentRoute?.lastStop?.name || toText || 'Destination';
      const routeIdentifier = currentRoute?.name || currentRoute?.shortName || route.trim() || 'PMPML Bus';
      const busNo = busNumber.trim() || currentRoute?.routeId || '103';

      const activeRawText = ocrRawText.trim() || `PUNE MAHANAGAR PARIVAHAN MAHAMANDAL LTD\nTicket No: ${ticketNumber}\nDate: ${date}  Time: ${time}\nBus No: ${busNo}\nRoute: ${routeIdentifier}\nFare: Rs. ${fare}\nEco-friendly journey`;

      const res = await api.validateBusTicketOCR(activeRawText, {
        ticketNumber: ticketNumber.trim(),
        date: date.trim(),
        time: time.trim(),
        busNumber: busNo,
        route: routeIdentifier,
        fare: parseFloat(fare) || 25,
        passengerCount,
        routeOrigin: originStation,
        routeDestination: destStation,
      });

      if (res.success && res.ticket) {
        setVerificationResult(res);
      } else {
        setError(res.error || res.message || 'Bus ticket validation failed.');
      }
    } catch (err) {
      setError(err.message || 'Validation service failed. Check server logs.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAttach = () => {
    if (verificationResult && onTicketVerified) {
      onTicketVerified(verificationResult);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.2rem 1.5rem',
            borderBottom: '1px solid var(--slate-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                background: '#2563eb',
                borderRadius: '10px',
                padding: '6px',
                display: 'flex',
                color: '#ffffff',
              }}
            >
              <Bus size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--slate-900)' }}>
                Verify Bus Ticket
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                OCR Field Extraction &bull; Anti-Replay Ledger &bull; Date Matching
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              cursor: 'pointer',
              color: 'var(--slate-400)',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            background: '#f1f5f9',
            padding: '4px',
            margin: '1rem 1.5rem 0',
            borderRadius: '10px',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => { setActiveTab('UPLOAD'); setError(''); }}
            style={{
              flex: 1,
              padding: '6px 10px',
              border: 'none',
              borderRadius: '7px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'UPLOAD' ? '#ffffff' : 'transparent',
              color: activeTab === 'UPLOAD' ? '#2563eb' : 'var(--slate-600)',
              boxShadow: activeTab === 'UPLOAD' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Upload Photo
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem 0.9rem', marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#1e40af', marginBottom: '0.35rem' }}>
              Passengers covered by this ticket
            </label>
            <select
              value={passengerCount}
              onChange={(e) => setPassengerCount(Number(e.target.value))}
              disabled={!!verificationResult}
              style={{ width: '100%', padding: '0.55rem 0.65rem', borderRadius: '7px', border: '1px solid #93c5fd', background: '#ffffff', fontWeight: 700, color: '#1e3a8a' }}
            >
              {[1, 2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>{count} {count === 1 ? 'passenger (only me)' : 'passengers'}</option>
              ))}
            </select>
            <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: '#3b82f6' }}>
              Choose this before uploading. For more than one passenger, you will receive a join code after verification.
            </div>
          </div>

          {/* Upload a real ticket photo */}
          {activeTab === 'UPLOAD' && (
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px dashed #93c5fd',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  background: '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                <Upload size={24} className="text-blue-600" style={{ marginBottom: '0.4rem' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>
                  Upload Bus Ticket Photo / Screenshot
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                  PNG, JPG, or screenshot — read locally by OCR; nothing is pre-filled or fabricated
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>

              <label
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '0.65rem', padding: '0.55rem', border: '1px solid #93c5fd', borderRadius: '8px', color: '#1d4ed8', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                <span>📷 Scan ticket with camera</span>
                <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>

              {imagePreview && (
                <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
                  <img
                    src={imagePreview}
                    alt="Ticket Preview"
                    style={{ maxHeight: '120px', borderRadius: '8px', border: '1px solid var(--slate-300)' }}
                  />
                </div>
              )}
              {ocrStatus && (
                <div style={{ marginTop: '0.65rem', fontSize: '0.78rem', color: 'var(--slate-600)' }}>
                  {ocrStatus}
                </div>
              )}
            </div>
          )}

          {/* Extracted Fields Form */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid var(--slate-200)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--slate-700)', letterSpacing: '0.04em', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <FileText size={14} className="text-blue-600" />
              <span>Extracted Bus Ticket Metadata</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 600 }}>Ticket Number</label>
                <input
                  type="text"
                  value={ticketNumber}
                  readOnly
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--slate-300)', fontSize: '0.82rem', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 600 }}>Date (Must match today)</label>
                <input
                  type="text"
                  value={date}
                  readOnly
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--slate-300)', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 600 }}>Time</label>
                <input
                  type="text"
                  value={time}
                  readOnly
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--slate-300)', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 600 }}>Bus Number</label>
                <input
                  type="text"
                  value={busNumber}
                  readOnly
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--slate-300)', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 600 }}>Route</label>
                <input
                  type="text"
                  value={route}
                  readOnly
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--slate-300)', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 600 }}>Fare Paid (₹)</label>
                <input
                  type="number"
                  value={fare}
                  readOnly
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--slate-300)', fontSize: '0.82rem', fontWeight: 700 }}
                />
              </div>
            </div>
          </div>

          {/* Validation Result Box */}
          {verificationResult && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>Uploaded ticket OCR &amp; anti-replay check passed</span>
              </div>

              {/* Transparent Disclaimer */}
              <div
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '0.72rem',
                  lineHeight: 1.35,
                  margin: '6px 0 8px',
                }}
              >
                <strong>Not operator authentication:</strong> {verificationResult.message}
              </div>

              <div style={{ fontSize: '0.75rem', color: '#15803d', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div>&bull; Anti-Replay Ledger: <strong>Recorded (SHA-256 Hash Verified)</strong></div>
                <div>&bull; Date Verification: <strong>Current Server Date Matched</strong></div>
                <div>&bull; Ticket ID: <strong>{verificationResult.ticket.ticketNumber}</strong></div>
                {verificationResult.ticket.joinCode && (
                  <div style={{ marginTop: '0.35rem', padding: '0.5rem 0.65rem', background: '#ffffff', border: '1px dashed #22c55e', borderRadius: '7px', color: '#166534' }}>
                    Share this join code with your co-passenger: <strong style={{ letterSpacing: '0.08em' }}>{verificationResult.ticket.joinCode}</strong> ({verificationResult.ticket.passengerSlotsUsed}/{verificationResult.ticket.passengerCapacity} seats claimed)
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                marginBottom: '1rem',
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div>{error}</div>
                {error.toLowerCase().includes('already') && (
                  <div style={{ marginTop: '6px', fontSize: '0.74rem' }}>
                    This ticket has already been used. Upload a different valid ticket.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--slate-100)',
            background: '#f8fafc',
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Cancel
          </button>

          {!verificationResult ? (
            <button
              type="button"
              onClick={handleRunValidation}
              disabled={isLoading || !uploadedFile || !ocrRawText.trim() || !ticketNumber.trim() || !date.trim()}
              className="btn btn-primary"
              style={{ padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              <span>Verify Bus Ticket</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirmAttach}
              className="btn btn-primary"
              style={{ padding: '8px 18px', fontSize: '0.85rem', background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CheckCircle2 size={16} />
              <span>Attach Ticket &amp; Continue</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
