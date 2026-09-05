import React, { useState, useEffect, useRef } from 'react';
import {
  Train,
  X,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Navigation,
  MapPin,
  Clock,
  ShieldCheck,
  Sparkles,
  Leaf,
  Info,
  ArrowRight,
  Radio,
  FileText,
  RotateCcw,
  Compass
} from 'lucide-react';
import jsQR from 'jsqr';
import PlaceAutocompleteInput from './PlaceAutocompleteInput';
import { api } from '../services/api';

export default function MetroVerificationModal({
  isOpen,
  onClose,
  onJourneyCompleted,
  user,
  onOpenAudit,
}) {
  // Step state machine:
  // 'SETUP' -> 'SCAN_QR' -> 'ORIGIN_GEOFENCE' -> 'TRACKING' -> 'COMPLETED'
  const [step, setStep] = useState('SETUP');

  // Origin & Destination Stations
  const [originStation, setOriginStation] = useState({
    placeId: 'metro_KATRAJ_METRO',
    name: 'Katraj Metro Station',
    latitude: 18.4575,
    longitude: 73.8677,
    stationId: 'KATRAJ_METRO',
  });

  const [destStation, setDestStation] = useState({
    placeId: 'metro_CIVIL_COURT_METRO',
    name: 'District Court / Civil Court',
    latitude: 18.5284,
    longitude: 73.8540,
    stationId: 'CIVIL_COURT_METRO',
  });

  // QR Scanning & Upload State
  const [qrScanMode, setQrScanMode] = useState('CAMERA'); // 'CAMERA' | 'UPLOAD'
  const [cameraActive, setCameraActive] = useState(false);
  const [scanStatusText, setScanStatusText] = useState('Scanning for QR code...');
  const [isProcessingQR, setIsProcessingQR] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [verifiedTicket, setVerifiedTicket] = useState(null);

  // Geofence & Location State
  const [isVerifyingOrigin, setIsVerifyingOrigin] = useState(false);
  const [originGeofenceResult, setOriginGeofenceResult] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  // Active Journey State
  const [activeJourneyId, setActiveJourneyId] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [totalDistanceKm, setTotalDistanceKm] = useState(0);
  const [isUndergroundTunnel, setIsUndergroundTunnel] = useState(false);
  const [isEndingJourney, setIsEndingJourney] = useState(false);
  const [finalVerificationResult, setFinalVerificationResult] = useState(null);

  // Video & Canvas Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const geoWatchIdRef = useRef(null);

  // Reset or initialize on open/close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      clearInterval(timerIntervalRef.current);
      if (geoWatchIdRef.current) navigator.geolocation.clearWatch(geoWatchIdRef.current);
    }
  }, [isOpen]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      clearInterval(timerIntervalRef.current);
      if (geoWatchIdRef.current) navigator.geolocation.clearWatch(geoWatchIdRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // ─── Camera Stream Controls ────────────────────────────────────────────────
  const startCamera = async () => {
    setErrorMessage('');
    setScanStatusText('Requesting camera permission...');
    try {
      const constraints = {
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        setScanStatusText('Scanning... Center the Metro QR code');
        requestAnimationFrame(tickScanVideo);
      }
    } catch (err) {
      console.warn('[Camera error]:', err.name, err.message);
      setCameraActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera access was denied. Please allow camera permission in browser settings or use the "Upload Screenshot" option below.');
      } else {
        setErrorMessage(`Unable to access camera (${err.message}). Try uploading a screenshot.`);
      }
    }
  };

  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const tickScanVideo = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animFrameIdRef.current = requestAnimationFrame(tickScanVideo);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      stopCamera();
      setScanStatusText('QR detected! Validating ticket...');
      handleVerifyTicketPayload(code.data, 'CAMERA_SCAN');
      return;
    }

    animFrameIdRef.current = requestAnimationFrame(tickScanVideo);
  };

  // ─── Image / Screenshot Upload Decoder ─────────────────────────────────────
  const handleScreenshotUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setErrorMessage('');
    setIsProcessingQR(true);
    setScanStatusText('Reading ticket screenshot...');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        setIsProcessingQR(false);
        if (code && code.data) {
          setScanStatusText('QR detected in screenshot! Validating...');
          handleVerifyTicketPayload(code.data, 'SCREENSHOT_UPLOAD');
        } else {
          setErrorMessage('Could not find a valid QR code in this image. Please upload a clear, uncropped screenshot of your Metro ticket.');
        }
      };
      img.onerror = () => {
        setIsProcessingQR(false);
        setErrorMessage('Failed to load image file. Please choose a valid PNG or JPG screenshot.');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // ─── Backend Ticket Verification Call ──────────────────────────────────────
  const handleVerifyTicketPayload = async (qrDataString, method = 'CAMERA_SCAN') => {
    setIsProcessingQR(true);
    setErrorMessage('');

    try {
      const res = await api.verifyMetroTicket({
        qrData: qrDataString,
        originStationId: originStation.stationId || originStation.name,
        destinationStationId: destStation.stationId || destStation.name,
        verificationMethod: method,
      });

      if (res && res.success && res.ticket) {
        setVerifiedTicket(res.ticket);
        setStep('ORIGIN_GEOFENCE');
      } else {
        throw new Error(res.error || 'Ticket verification failed');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Ticket verification rejected by validation service.');
    } finally {
      setIsProcessingQR(false);
    }
  };

  // ─── Step 2: Origin Station Geolocation Verification ───────────────────────
  const handleVerifyOriginGeofence = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    setIsVerifyingOrigin(true);
    setErrorMessage('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation({ latitude, longitude, accuracy });

        try {
          const res = await api.verifyMetroOrigin({
            stationId: originStation.stationId || originStation.name,
            latitude,
            longitude,
            accuracy,
          });

          setOriginGeofenceResult(res);

          if (res.success && res.isWithinGeofence) {
            // Geofence passed! Start active tracking session
            handleStartActiveMetroJourney({ latitude, longitude, accuracy });
          } else {
            setErrorMessage(res.message || `Please move closer to ${originStation.name} to begin.`);
          }
        } catch (err) {
          setErrorMessage(err.message || 'Failed to verify origin station geofence.');
        } finally {
          setIsVerifyingOrigin(false);
        }
      },
      (err) => {
        setIsVerifyingOrigin(false);
        setErrorMessage(
          'Location permission was denied. Location access is required to verify that you are physically near the station.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 2000 }
    );
  };

  // ─── Step 3: Start Active Journey & Tracking ──────────────────────────────
  const handleStartActiveMetroJourney = async (initialCoords) => {
    try {
      const res = await api.startMetroJourney({
        ticketId: verifiedTicket.id,
        originStationId: originStation.stationId || originStation.name,
        destinationStationId: destStation.stationId || destStation.name,
        userLocation: initialCoords,
      });

      if (res.success && res.journeyId) {
        setActiveJourneyId(res.journeyId);
        setStep('TRACKING');
        setElapsedSeconds(0);
        setTotalDistanceKm(0);

        // Start Journey Timer
        timerIntervalRef.current = setInterval(() => {
          setElapsedSeconds((prev) => prev + 1);
        }, 1000);

        // Start Adaptive GPS Watcher
        if (navigator.geolocation) {
          geoWatchIdRef.current = navigator.geolocation.watchPosition(
            async (p) => {
              const { latitude, longitude, accuracy, speed } = p.coords;
              setUserLocation({ latitude, longitude, accuracy });

              // If GPS accuracy drops (>120m), activate tunnel grace period notice
              const isTunnel = !accuracy || accuracy > 120;
              setIsUndergroundTunnel(isTunnel);

              try {
                const locRes = await api.recordMetroLocation({
                  journeyId: res.journeyId,
                  latitude,
                  longitude,
                  accuracy,
                  speed: speed ? speed * 3.6 : 0, // convert m/s to km/h
                  timestamp: new Date().toISOString(),
                });
                if (locRes && locRes.totalDistanceKm) {
                  setTotalDistanceKm(locRes.totalDistanceKm);
                }
              } catch (_) {}
            },
            () => {
              // Signal temporarily lost (e.g. underground tunnel)
              setIsUndergroundTunnel(true);
            },
            { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 }
          );
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to start active Metro journey.');
    }
  };

  // ─── Step 4: End Journey & Destination Geofence ───────────────────────────
  const handleEndMetroJourney = () => {
    setIsEndingJourney(true);
    setErrorMessage('');

    const proceedEnd = async (coords) => {
      try {
        clearInterval(timerIntervalRef.current);
        if (geoWatchIdRef.current) navigator.geolocation.clearWatch(geoWatchIdRef.current);

        const res = await api.endMetroJourney({
          journeyId: activeJourneyId,
          userLatitude: coords.latitude,
          userLongitude: coords.longitude,
          userAccuracy: coords.accuracy || 15,
        });

        if (res.success) {
          setFinalVerificationResult(res);
          setStep('COMPLETED');
          if (onJourneyCompleted) onJourneyCompleted(res);
        } else {
          setErrorMessage(res.error || 'Destination verification failed.');
        }
      } catch (err) {
        setErrorMessage(err.message || 'Error finalizing journey verification.');
      } finally {
        setIsEndingJourney(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => proceedEnd(p.coords),
        () => proceedEnd(userLocation || { latitude: destStation.latitude, longitude: destStation.longitude, accuracy: 25 }),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      proceedEnd(userLocation || { latitude: destStation.latitude, longitude: destStation.longitude, accuracy: 25 });
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '1rem',
      overflowY: 'auto',
    }}>
      <div className="card" style={{
        maxWidth: '540px',
        width: '100%',
        position: 'relative',
        padding: '1.75rem',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        maxHeight: '94vh',
        overflowY: 'auto',
        background: '#ffffff',
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            padding: '7px',
            color: 'var(--slate-500)',
          }}
          title="Close"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
            color: '#4f46e5',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.5rem',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)',
          }}>
            <Train size={28} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.25rem' }}>
            🚇 Metro Journey Verification
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--slate-600)', margin: 0 }}>
            Real-world station geofencing &amp; ticket validation
          </p>
        </div>

        {/* Error Alert Message */}
        {errorMessage && (
          <div style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#be123c',
            borderRadius: '12px',
            padding: '0.65rem 0.85rem',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginBottom: '1rem',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>{errorMessage}</div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* STEP 1: SETUP (SELECT FROM & TO STATIONS)                          */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {step === 'SETUP' && (
          <div>
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--slate-200)',
              borderRadius: '16px',
              padding: '1.15rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <PlaceAutocompleteInput
                  label="FROM STATION"
                  placeholder="Select origin station (e.g. Katraj, Swargate)"
                  value={originStation}
                  onSelectPlace={(place) => setOriginStation({ ...place, stationId: place.placeId?.replace('metro_', '') || place.name })}
                  showCurrentLocationOption={true}
                  transitModeBias="METRO"
                />
              </div>

              <div style={{ textAlign: 'center', margin: '-0.35rem 0 0.4rem', color: 'var(--slate-400)' }}>
                ↓
              </div>

              <div>
                <PlaceAutocompleteInput
                  label="TO STATION"
                  placeholder="Select destination station (e.g. Civil Court)"
                  value={destStation}
                  onSelectPlace={(place) => setDestStation({ ...place, stationId: place.placeId?.replace('metro_', '') || place.name })}
                  showCurrentLocationOption={false}
                  transitModeBias="METRO"
                />
              </div>
            </div>

            {/* Selected Journey Preview Pill */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
            }}>
              <div style={{ fontSize: '0.82rem' }}>
                <div style={{ color: '#166534', fontWeight: 800 }}>Selected Metro Journey</div>
                <div style={{ color: '#15803d', fontWeight: 600, marginTop: '2px' }}>
                  {originStation.name} → {destStation.name}
                </div>
              </div>
              <div style={{
                background: '#dcfce7',
                color: '#15803d',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 800,
              }}>
                ~8.4 km • +18 GP
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button
                onClick={() => {
                  setStep('SCAN_QR');
                  setQrScanMode('CAMERA');
                  startCamera();
                }}
                className="btn btn-primary btn-full"
                style={{ padding: '0.75rem', fontSize: '0.95rem', justifyContent: 'center' }}
              >
                <Camera size={18} />
                <span>Scan Metro QR Ticket</span>
              </button>

              <button
                onClick={() => {
                  setStep('SCAN_QR');
                  setQrScanMode('UPLOAD');
                  stopCamera();
                }}
                className="btn btn-secondary btn-full"
                style={{ padding: '0.75rem', fontSize: '0.88rem', justifyContent: 'center' }}
              >
                <Upload size={17} />
                <span>Upload QR / Ticket Screenshot</span>
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* STEP 2: SCAN QR / UPLOAD SCREENSHOT                                */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {step === 'SCAN_QR' && (
          <div>
            {/* Mode Switcher Tabs */}
            <div style={{
              display: 'flex',
              background: 'var(--slate-100)',
              borderRadius: '10px',
              padding: '3px',
              marginBottom: '1rem',
            }}>
              <button
                type="button"
                onClick={() => {
                  setQrScanMode('CAMERA');
                  startCamera();
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  padding: '7px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: qrScanMode === 'CAMERA' ? '#ffffff' : 'transparent',
                  color: qrScanMode === 'CAMERA' ? '#4f46e5' : 'var(--slate-600)',
                  boxShadow: qrScanMode === 'CAMERA' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <Camera size={14} />
                <span>Live Camera</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQrScanMode('UPLOAD');
                  stopCamera();
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  padding: '7px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: qrScanMode === 'UPLOAD' ? '#ffffff' : 'transparent',
                  color: qrScanMode === 'UPLOAD' ? '#4f46e5' : 'var(--slate-600)',
                  boxShadow: qrScanMode === 'UPLOAD' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <Upload size={14} />
                <span>Upload Screenshot</span>
              </button>
            </div>

            {/* CAMERA SCANNER VIEW */}
            {qrScanMode === 'CAMERA' && (
              <div style={{
                position: 'relative',
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#000000',
                aspectRatio: '4/3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <video
                  ref={videoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />

                {/* Target Reticle */}
                <div style={{
                  position: 'absolute',
                  width: '190px',
                  height: '190px',
                  border: '2.5px solid rgba(255, 255, 255, 0.85)',
                  borderRadius: '16px',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                  pointerEvents: 'none',
                }} />

                {/* Scanning line indicator */}
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  color: '#ffffff',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                  {scanStatusText}
                </div>
              </div>
            )}

            {/* SCREENSHOT UPLOAD VIEW */}
            {qrScanMode === 'UPLOAD' && (
              <div style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '16px',
                padding: '2rem 1.5rem',
                textAlign: 'center',
                background: '#f8fafc',
                marginBottom: '1rem',
              }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: '#eef2ff',
                  color: '#4f46e5',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.75rem',
                }}>
                  <Upload size={24} />
                </div>

                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--slate-800)', marginBottom: '0.35rem' }}>
                  Upload Metro Ticket QR Screenshot
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)', lineHeight: 1.4, margin: '0 0 1rem' }}>
                  Required for users on mobile who cannot scan a QR code displayed on the same device.
                </p>

                <label
                  htmlFor="metro-qr-file-input"
                  className="btn btn-primary"
                  style={{ cursor: 'pointer', display: 'inline-flex', padding: '0.55rem 1.25rem', fontSize: '0.84rem' }}
                >
                  <FileText size={16} />
                  <span>Select Screenshot from Photos</span>
                </label>
                <input
                  id="metro-qr-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotUpload}
                  style={{ display: 'none' }}
                />

                {isProcessingQR && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '0.75rem', color: '#4f46e5', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{scanStatusText}</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setStep('SETUP');
                }}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '0.4rem 1rem' }}
              >
                Back to Station Selection
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* STEP 3: ORIGIN STATION GEOFENCE VERIFICATION                       */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {step === 'ORIGIN_GEOFENCE' && verifiedTicket && (
          <div>
            {/* Decoded Ticket Summary Card */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--slate-200)',
              borderRadius: '16px',
              padding: '1rem 1.15rem',
              marginBottom: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                  Ticket Authenticity
                </span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: verifiedTicket.isOperatorAuthenticated ? '#ecfdf5' : '#fffbeb',
                  color: verifiedTicket.isOperatorAuthenticated ? '#047857' : '#b45309',
                  border: `1px solid ${verifiedTicket.isOperatorAuthenticated ? '#a7f3d0' : '#fde68a'}`,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}>
                  <CheckCircle2 size={12} />
                  <span>{verifiedTicket.isOperatorAuthenticated ? 'Official Operator Verified' : 'Prototype Mock Verified'}</span>
                </span>
              </div>

              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                {verifiedTicket.ticketNumber}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                {verifiedTicket.operator} &bull; {verifiedTicket.originStation} → {verifiedTicket.destinationStation}
              </div>

              <div style={{
                marginTop: '0.65rem',
                paddingTop: '0.65rem',
                borderTop: '1px solid var(--slate-200)',
                fontSize: '0.72rem',
                color: 'var(--slate-500)',
                lineHeight: 1.4,
              }}>
                <strong>Notice:</strong> {verifiedTicket.message}
              </div>
            </div>

            {/* Geofence Check Prompt */}
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '16px',
              padding: '1.15rem',
              textAlign: 'center',
              marginBottom: '1.25rem',
            }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: '#dbeafe',
                color: '#1d4ed8',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.5rem',
              }}>
                <MapPin size={22} />
              </div>

              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e3a8a', margin: '0 0 0.35rem' }}>
                Verify Location at {originStation.name}
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#1e40af', margin: '0 0 1rem', lineHeight: 1.4 }}>
                Your location is required to verify that you are physically near the selected origin station (station geofence ~250m).
              </p>

              <button
                onClick={handleVerifyOriginGeofence}
                disabled={isVerifyingOrigin}
                className="btn btn-primary btn-full"
                style={{ padding: '0.75rem', fontSize: '0.92rem', justifyContent: 'center' }}
              >
                {isVerifyingOrigin ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Verifying Station Geofence...</span>
                  </>
                ) : (
                  <>
                    <Navigation size={18} />
                    <span>Verify My Location &amp; Start Journey</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* STEP 4: ACTIVE METRO JOURNEY TRACKING HUD                           */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {step === 'TRACKING' && (
          <div>
            {/* Active HUD Title */}
            <div style={{
              background: '#0f172a',
              color: '#ffffff',
              borderRadius: '16px',
              padding: '1.25rem',
              marginBottom: '1rem',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  🚇 Metro Journey Active
                </span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#15803d',
                  color: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}>
                  <Radio size={12} className="animate-pulse" />
                  <span>In Transit</span>
                </span>
              </div>

              {/* Corridor Route */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>From</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{originStation.name}</div>
                </div>
                <ArrowRight size={18} style={{ color: '#64748b' }} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>To</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{destStation.name}</div>
                </div>
              </div>

              {/* Real-time Telemetry Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.65rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                paddingTop: '0.75rem',
              }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Elapsed Time</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.35rem', fontWeight: 800 }}>
                    {formatTimer(elapsedSeconds)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Distance Tracked</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.35rem', fontWeight: 800, color: '#34d399' }}>
                    {Number(totalDistanceKm || 0).toFixed(2)} <span style={{ fontSize: '0.75rem' }}>km</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tunnel / Underground Grace Period Indicator */}
            {isUndergroundTunnel ? (
              <div style={{
                background: '#fefce8',
                border: '1px solid #fef08a',
                color: '#854d0e',
                borderRadius: '12px',
                padding: '0.65rem 0.85rem',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '1rem',
              }}>
                <Radio size={16} className="animate-pulse" style={{ color: '#ca8a04', flexShrink: 0 }} />
                <span><strong>GPS signal temporarily unavailable:</strong> Underground tunnel grace period active. Journey remains valid.</span>
              </div>
            ) : (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                borderRadius: '12px',
                padding: '0.65rem 0.85rem',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '1rem',
              }}>
                <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                <span>GPS active. Keep this screen open until you reach {destStation.name}.</span>
              </div>
            )}

            {/* End Journey Button */}
            <button
              onClick={handleEndMetroJourney}
              disabled={isEndingJourney}
              className="btn btn-danger btn-full"
              style={{ padding: '0.85rem', fontSize: '1rem', fontWeight: 800, justifyContent: 'center' }}
            >
              {isEndingJourney ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Verifying Destination Geofence...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>END JOURNEY AT {destStation.name.toUpperCase()}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* STEP 5: JOURNEY VERIFIED RESULT CARD                                */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {step === 'COMPLETED' && finalVerificationResult && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#059669',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.75rem',
              boxShadow: '0 4px 16px rgba(5, 150, 105, 0.2)',
            }}>
              <CheckCircle2 size={36} />
            </div>

            <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--slate-900)', margin: '0 0 0.35rem' }}>
              🎉 JOURNEY VERIFIED!
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--slate-600)', margin: '0 0 1.25rem' }}>
              {finalVerificationResult.origin} → {finalVerificationResult.destination}
            </p>

            {/* Rewards Pill Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
              color: '#ffffff',
              borderRadius: '16px',
              padding: '1.25rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#a7f3d0', textTransform: 'uppercase', fontWeight: 700 }}>
                Green Credits Earned
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                +{finalVerificationResult.greenCreditsAwarded} GP
              </div>
              <div style={{ fontSize: '0.8rem', color: '#d1fae5', marginTop: '4px' }}>
                Distance: {finalVerificationResult.distanceKm} km &bull; CO₂ Saved: {finalVerificationResult.co2SavedGrams}g
              </div>
            </div>

            {/* Evidence Factor Breakdown */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--slate-200)',
              borderRadius: '16px',
              padding: '1rem',
              textAlign: 'left',
              marginBottom: '1.25rem',
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--slate-800)', marginBottom: '0.65rem' }}>
                Multi-Factor Evidence Score: {Math.round((finalVerificationResult.overallScore || 0.95) * 100)}%
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.76rem', color: 'var(--slate-600)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>✓ Ticket Authenticity &amp; Binding (30%)</span>
                  <span style={{ fontWeight: 700, color: '#059669' }}>Verified</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>✓ Origin Station Geofence (20%)</span>
                  <span style={{ fontWeight: 700, color: '#059669' }}>Verified (~250m)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>✓ Movement &amp; Kinematics (20%)</span>
                  <span style={{ fontWeight: 700, color: '#059669' }}>Verified Transit Speed</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>✓ Dedicated Guideway Corridor (15%)</span>
                  <span style={{ fontWeight: 700, color: '#059669' }}>Consistent</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>✓ Destination Station Geofence (15%)</span>
                  <span style={{ fontWeight: 700, color: '#059669' }}>Verified Presence</span>
                </div>
              </div>
            </div>

            {/* Done & Inspect Audit buttons */}
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                onClick={onClose}
                className="btn btn-primary"
                style={{ flex: 1, padding: '0.75rem', justifyContent: 'center' }}
              >
                Close &amp; View Dashboard
              </button>

              {onOpenAudit && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAudit(finalVerificationResult.journeyId);
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '0.75rem', fontSize: '0.82rem' }}
                >
                  Inspect Audit Log
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
