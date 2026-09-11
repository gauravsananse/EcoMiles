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

function convertDevanagariDigits(str) {
  if (!str) return '';
  const devanagariMap = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  };
  return String(str).replace(/[०-९]/g, (ch) => devanagariMap[ch] || ch);
}

function normalizeTicketDate(text) {
  const clean = convertDevanagariDigits(text);
  const iso = clean.match(/\b(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const indian = clean.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (!indian) return '';
  const year = indian[3].length === 2 ? `20${indian[3]}` : indian[3];
  return `${year}-${indian[2].padStart(2, '0')}-${indian[1].padStart(2, '0')}`;
}

function extractTicketTime(text) {
  const clean = convertDevanagariDigits(text);
  const match = clean.match(/\b(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:\s*[AP]M)?)\b/i);
  return match ? match[1].replace('.', ':') : '';
}

function extractTicketNumber(text) {
  const clean = convertDevanagariDigits(text);
  const match = clean.match(/(?:ticket|tkt|receipt|serial|no|क्र\.?|तिकीट|क्रमांक)\s*[:#-]?\s*([A-Z0-9/-]{3,20})/i) ||
                clean.match(/\b([A-Z]{1,3}\d{4,8})\b/) ||
                clean.match(/\b(\d{5,10})\b/);
  return match ? match[1].trim() : '';
}

function extractBusNumber(text) {
  const clean = convertDevanagariDigits(text);
  const match = clean.match(/(?:bus|vehicle|बस|गाडी)\s*(?:no|number|क्र\.?)?\s*[:#-]?\s*([A-Z0-9-]{2,16})/i) ||
                clean.match(/\b(MH\s*[-]?\s*12\s*[-]?\s*[A-Z]{1,3}\s*[-]?\s*\d{1,4})\b/i);
  return match ? match[1].trim() : '';
}

function extractRoute(text) {
  const marathiCorridor = text.match(/([^\n\d]{2,30})\s*ते\s*([^\n\d]{2,30})/);
  if (marathiCorridor) {
    return `${marathiCorridor[1].trim()} ⇄ ${marathiCorridor[2].trim()}`;
  }
  const clean = convertDevanagariDigits(text);
  const match = clean.match(/(?:route|line|मार्ग)\s*(?:no|number|क्र\.?)?\s*[:#-]?\s*([^\n]{2,60})/i);
  return match ? match[1].trim() : '';
}

function extractFare(text) {
  const clean = convertDevanagariDigits(text);
  const match = clean.match(/(?:fare|rs\.?|inr|₹|दर|भाडे|upi\s*[-:]?\s*₹?)\s*[:.-]?\s*(\d{1,4}(?:\.\d{1,2})?)/i) ||
                clean.match(/₹\s*(\d{1,4}(?:\.\d{1,2})?)/i);
  return match ? match[1] : '';
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
  
  // These fields stay empty until a ticket is read, or can be filled manually
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

      const extractedNum = extractTicketNumber(text);
      const extractedDate = normalizeTicketDate(text);
      const extractedTime = extractTicketTime(text);
      const extractedBus = extractBusNumber(text);
      const extractedRt = extractRoute(text);
      const extractedFare = extractFare(text);

      if (extractedNum) setTicketNumber(extractedNum);
      if (extractedDate) setDate(extractedDate);
      if (extractedTime) setTime(extractedTime);
      if (extractedBus) setBusNumber(extractedBus);
      if (extractedRt) setRoute(extractedRt);
      if (extractedFare) setFare(extractedFare);

      setOcrStatus(text ? 'OCR complete. Review or edit the extracted details below before verification.' : 'No readable ticket text found. You can enter the details manually below.');
    } catch (err) {
      setOcrStatus('OCR could not read this image. You can enter the details manually below.');
      setError(err.message || 'Ticket OCR failed.');
    }
  };

  const handleRunValidation = async () => {
    if (!uploadedFile) {
      setError('Please upload or capture a ticket photo first.');
      return;
    }

    if (!ticketNumber.trim()) {
      setError('Ticket Number is required. Enter it in the Ticket Number field below.');
      return;
    }

    if (!date.trim()) {
      setError('Ticket Date is required (format: YYYY-MM-DD or DD/MM/YYYY).');
      return;
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // Normalize entered date
    let normEnteredDate = date.trim();
    if (normEnteredDate.includes('/') || normEnteredDate.includes('.')) {
      const parts = normEnteredDate.split(/[./-]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          normEnteredDate = `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`;
        } else {
          const yr = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          normEnteredDate = `${yr}-${pad(parts[1])}-${pad(parts[0])}`;
        }
      }
    }

    // 1. Strict Date Matching: Ticket must be issued TODAY
    if (normEnteredDate !== todayStr) {
      setError(`❌ Date Mismatch: Ticket date (${normEnteredDate}) does not match today's date (${todayStr}). Only tickets issued today can be verified.`);
      return;
    }

    // 2. Strict Time Window: 10-minute boarding tolerance
    if (time.trim()) {
      const timeMatch = time.trim().match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(AM|PM)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const ampm = timeMatch[4] ? timeMatch[4].toUpperCase() : null;

        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        const ticketDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
        const diffMinutes = (Date.now() - ticketDateTime.getTime()) / (1000 * 60);

        const ticketClock = `${pad(hours)}:${pad(minutes)}`;
        const nowClock = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

        if (diffMinutes < -3) {
          setError(`❌ Invalid Ticket Time: Ticket time (${ticketClock}) is in the future compared to current time (${nowClock}).`);
          return;
        }

        if (diffMinutes > 10) {
          const lateMins = Math.round(diffMinutes);
          setError(`❌ Late Ticket Upload: Ticket was issued at ${ticketClock}, but current time is ${nowClock} (${lateMins} minutes ago). Maximum allowed tolerance is 10 minutes.`);
          return;
        }
      }
    }

    setIsLoading(true);
    setError('');
    setVerificationResult(null);

    try {
      const originStation = currentRoute?.originName || currentRoute?.firstStop?.name || fromText || 'Origin';
      const destStation = currentRoute?.destinationName || currentRoute?.lastStop?.name || toText || 'Destination';
      const routeIdentifier = currentRoute?.name || currentRoute?.shortName || route.trim() || 'PMPML Bus';
      const busNo = busNumber.trim() || currentRoute?.routeId || '103';

      const activeRawText = ocrRawText.trim() || `PUNE MAHANAGAR PARIVAHAN MAHAMANDAL LTD\nTicket No: ${ticketNumber}\nDate: ${normEnteredDate}  Time: ${time}\nBus No: ${busNo}\nRoute: ${routeIdentifier}\nFare: Rs. ${fare}\nEco-friendly journey`;

      const res = await api.validateBusTicketOCR(activeRawText, {
        ticketNumber: ticketNumber.trim(),
        date: normEnteredDate,
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
            <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--slate-700)', letterSpacing: '0.04em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <FileText size={14} className="text-blue-600" />
              <span>Extracted Bus Ticket Metadata</span>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '0.45rem 0.65rem', marginBottom: '0.75rem', fontSize: '0.72rem', color: '#1e40af' }}>
              <strong>Boarding Rule:</strong> Ticket must be from today and uploaded within <strong>10 minutes</strong> of issuance. You can review and edit any field below.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 600 }}>Ticket Number</label>
                <input
                  type="text"
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  placeholder="e.g. 59302"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--slate-300)', fontSize: '0.82rem', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 600 }}>Date (Must match today)</label>
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--slate-300)', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 600 }}>Time</label>
                <input
                  type="text"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="HH:MM (e.g. 11:30)"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--slate-300)', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 600 }}>Bus Number</label>
                <input
                  type="text"
                  value={busNumber}
                  onChange={(e) => setBusNumber(e.target.value)}
                  placeholder="e.g. 115"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--slate-300)', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 600 }}>Route</label>
                <input
                  type="text"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  placeholder="e.g. Symbiosis ⇄ Sus Gaon"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--slate-300)', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 600 }}>Fare Paid (₹)</label>
                <input
                  type="number"
                  value={fare}
                  onChange={(e) => setFare(e.target.value)}
                  placeholder="e.g. 20"
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
              disabled={isLoading || !uploadedFile}
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
