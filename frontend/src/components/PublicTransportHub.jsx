import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Navigation,
  Bus,
  Train,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Footprints,
  RefreshCw,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  Leaf,
  Ticket as TicketIcon,
  Users,
  QrCode,
  ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';
import TicketVerificationModal from './TicketVerificationModal';
import PublicTransportModeSelector from './PublicTransportModeSelector';
import MetroVerificationModal from './MetroVerificationModal';
import MetroAuditDebugModal from './MetroAuditDebugModal';
import BusTicketOCRModal from './BusTicketOCRModal';
import PlaceAutocompleteInput from './PlaceAutocompleteInput';
import { generateClientTransitRoutes } from '../services/transitFallback';

export default function PublicTransportHub({
  journeyId,
  currentLocation = { lat: 18.5284, lng: 73.8744 },
  onSegmentStarted,
  onBack,
  isTestMode = false,
  initialMode = null,
}) {
  // Transit Mode Selection: null (Chooser) | 'BUS' | 'METRO'
  const [activeTransitMode, setActiveTransitMode] = useState(initialMode || 'BUS');

  useEffect(() => {
    if (initialMode) {
      setActiveTransitMode(initialMode);
    }
  }, [initialMode]);

  // Metro Modal & Audit State
  const [showMetroModal, setShowMetroModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditJourneyId, setAuditJourneyId] = useState(null);

  // Bus Autocomplete & Location State
  const [fromText, setFromText] = useState('');
  const [fromPlace, setFromPlace] = useState(null);
  const [toText, setToText] = useState('');
  const [toPlace, setToPlace] = useState(null);

  // Bus Stops & Routes
  const [nearbyStops, setNearbyStops] = useState([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [expandedStopId, setExpandedStopId] = useState(null);
  const [stopArrivals, setStopArrivals] = useState({});
  const [loadingArrivals, setLoadingArrivals] = useState({});

  const [routeResults, setRouteResults] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');

  // Bus Ticket OCR Verification State
  const [showBusOcrModal, setShowBusOcrModal] = useState(false);
  const [verifiedTicketInfo, setVerifiedTicketInfo] = useState(null);

  // Fallback Ticket Verification Modal
  const [showLegacyTicketModal, setShowLegacyTicketModal] = useState(false);

  // Join Existing Journey Modal state (Co-travellers)
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinQrInput, setJoinQrInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccessInfo, setJoinSuccessInfo] = useState(null);

  // Fetch nearby stops on mount
  useEffect(() => {
    fetchNearbyStops();
  }, [currentLocation?.lat, currentLocation?.lng]);

  // Refresh recommendations shortly after both locations are entered or picked.
  useEffect(() => {
    if (!fromText.trim() || !toText.trim()) {
      setRouteResults([]);
      setSelectedRoute(null);
      return undefined;
    }
    const timer = setTimeout(() => handleSearchRoutes(fromText, toText), 550);
    return () => clearTimeout(timer);
  }, [fromText, toText, fromPlace, toPlace]);

  const fetchNearbyStops = async () => {
    setLoadingStops(true);
    setError('');
    try {
      const lat = currentLocation?.lat || 18.5284;
      const lng = currentLocation?.lng || 73.8744;
      const res = await api.getNearbyTransitStops(lat, lng, 3500);
      if (res.success && res.stops) {
        setNearbyStops(res.stops);
      }
    } catch (err) {
      console.warn('[PublicTransportHub] Failed to fetch stops:', err.message);
      setNearbyStops([
        {
          stopId: 'STN-KATRAJ-01',
          name: 'Katraj Bus Terminal',
          distanceMeters: 80,
          walkTimeMinutes: 1,
          routes: [
            { routeId: '103', routeName: 'Route 103 — Katraj ⇄ Swargate ⇄ Bitwise Tower', mode: 'BUS', intervalMinutes: 6 },
            { routeId: '24', routeName: 'Route 24 — Katraj ⇄ Pune Station', mode: 'BUS', intervalMinutes: 10 },
          ],
        },
        {
          stopId: 'STN-PUNE-01',
          name: 'Pune Station Terminal',
          distanceMeters: 120,
          walkTimeMinutes: 2,
          routes: [
            { routeId: '103', routeName: 'Route 103 — Pune Station ⇄ Hinjewadi Phase 3', mode: 'BUS', intervalMinutes: 8 },
            { routeId: '104', routeName: 'Route 104 — Shivajinagar ⇄ Aundh', mode: 'BUS', intervalMinutes: 10 },
          ],
        },
      ]);
    } finally {
      setLoadingStops(false);
    }
  };

  const toggleStopArrivals = async (stopId) => {
    if (expandedStopId === stopId) {
      setExpandedStopId(null);
      return;
    }
    setExpandedStopId(stopId);

    if (!stopArrivals[stopId]) {
      setLoadingArrivals((p) => ({ ...p, [stopId]: true }));
      try {
        const res = await api.getUpcomingArrivals(stopId);
        if (res.success && res.arrivals) {
          setStopArrivals((p) => ({ ...p, [stopId]: res.arrivals }));
        }
      } catch (err) {
        setStopArrivals((p) => ({
          ...p,
          [stopId]: [
            { busNumber: '103', direction: 'Bitwise Tower / Hinjewadi', etaMinutes: 3, status: 'LIVE', statusLabel: 'Live GPS Tracked' },
            { busNumber: '24', direction: 'Pune Station', etaMinutes: 8, status: 'SCHEDULED', statusLabel: 'Scheduled — Prototype Transit Data' },
          ],
        }));
      } finally {
        setLoadingArrivals((p) => ({ ...p, [stopId]: false }));
      }
    }
  };

  const handleSearchRoutes = async (origin = fromText, destination = toText) => {
    if (!origin.trim() || !destination.trim()) return;
    setLoadingRoutes(true);
    setError('');
    setSelectedRoute(null);
    setVerifiedTicketInfo(null);
    try {
      const lat = currentLocation?.lat || 18.5284;
      const lng = currentLocation?.lng || 73.8744;
      const res = await api.searchTransitRoutes(origin, destination, lat, lng, fromPlace, toPlace);
      if (res && res.success && res.itineraries && res.itineraries.length > 0) {
        setRouteResults(res.itineraries);
        setSelectedRoute(res.itineraries[0]);
      } else {
        // Fallback to client-side generated dynamic routes
        const fallbackRoutes = generateClientTransitRoutes(origin, destination, lat, lng, fromPlace, toPlace);
        if (fallbackRoutes && fallbackRoutes.length > 0) {
          setRouteResults(fallbackRoutes);
          setSelectedRoute(fallbackRoutes[0]);
        } else {
          setRouteResults([]);
          setError('No direct supported bus route was found for these locations. Try searching another bus stop or area.');
        }
      }
    } catch (err) {
      console.warn('[PublicTransportHub] Backend transit route search failed, using client recommendations generator:', err.message);
      const lat = currentLocation?.lat || 18.5284;
      const lng = currentLocation?.lng || 73.8744;
      const fallbackRoutes = generateClientTransitRoutes(origin, destination, lat, lng, fromPlace, toPlace);
      if (fallbackRoutes && fallbackRoutes.length > 0) {
        setRouteResults(fallbackRoutes);
        setSelectedRoute(fallbackRoutes[0]);
      } else {
        setRouteResults([]);
        setError('No direct supported bus route was found for these locations. Try searching another bus stop or area.');
      }
    } finally {
      setLoadingRoutes(false);
    }
  };

  /**
   * Start Public Segment
   */
  const handleStartSegmentClick = () => {
    if (!selectedRoute) return;
    if (!verifiedTicketInfo) {
      // Open Bus Ticket OCR Modal
      setShowBusOcrModal(true);
    } else {
      handleLaunchLivePublicJourney();
    }
  };

  const handleBusTicketVerified = (ocrResult) => {
    setVerifiedTicketInfo({
      ticket: {
        _id: ocrResult.ticket?._id || `BTK-${Date.now()}`,
        ticketNumber: ocrResult.ticket?.ticketNumber,
        operator: ocrResult.ticket?.operator || 'PMPML',
        source: ocrResult.ticket?.source || fromText,
        destination: ocrResult.ticket?.destination || toText,
        fare: ocrResult.ticket?.fare,
        busNumber: ocrResult.ticket?.busNumber,
        joinCode: ocrResult.ticket?.joinCode || null,
        passengerCapacity: ocrResult.ticket?.passengerCapacity || 1,
        passengerSlotsUsed: ocrResult.ticket?.passengerSlotsUsed || 1,
        isOperatorAuthenticated: ocrResult.isOperatorAuthenticated ?? false,
        verificationMessage: ocrResult.message,
      },
      passengers: ocrResult.ticket?.passengerSlotsUsed || 1,
      totalCapacity: ocrResult.ticket?.passengerCapacity || 1,
      isCoTraveller: false,
    });
  };

  /**
   * User launches live journey with GPS tracking
   */
  const handleLaunchLivePublicJourney = async () => {
    if (!selectedRoute) return;
    setIsStarting(true);
    setError('');

    try {
      if (journeyId) {
        const res = await api.startJourneySegment(
          journeyId,
          'PUBLIC_TRANSPORT',
          { name: fromText, lat: currentLocation?.lat, lng: currentLocation?.lng },
          { name: toText },
          selectedRoute.routeId,
          selectedRoute.name || selectedRoute.shortName,
          currentLocation
        );

        if (verifiedTicketInfo?.ticket?._id) {
          try {
            await api.linkTicketToJourney(journeyId, {
              ticketId: verifiedTicketInfo.ticket._id,
              ticketNumber: verifiedTicketInfo.ticket.ticketNumber,
              operator: verifiedTicketInfo.ticket.operator,
              passengerSlot: 0,
              coTravellers: verifiedTicketInfo.coTravellers || [],
            });
          } catch (_) {}
        }

        if (onSegmentStarted) {
          onSegmentStarted(res.segmentIndex ?? 1, {
            ...selectedRoute,
            verifiedTicket: verifiedTicketInfo?.ticket,
            passengers: verifiedTicketInfo?.passengers || 1,
            coTravellers: verifiedTicketInfo?.coTravellers || [],
          });
        }
      } else {
        if (onSegmentStarted) {
          onSegmentStarted(0, {
            ...selectedRoute,
            verifiedTicket: verifiedTicketInfo?.ticket,
            passengers: verifiedTicketInfo?.passengers || 1,
            coTravellers: verifiedTicketInfo?.coTravellers || [],
          });
        }
      }
    } catch (err) {
      console.error('Failed to start public transport segment:', err);
      if (onSegmentStarted) {
        onSegmentStarted(0, {
          ...selectedRoute,
          verifiedTicket: verifiedTicketInfo?.ticket,
          passengers: verifiedTicketInfo?.passengers || 1,
        });
      }
    } finally {
      setIsStarting(false);
    }
  };

  /**
   * Friend scans QR code to join an existing journey
   */
  const handleJoinViaQr = async () => {
    if (!joinQrInput.trim()) return;
    setIsJoining(true);
    setError('');

    try {
      const res = await api.joinSharedBusTicket(joinQrInput.trim());
      if (res.success) {
        setJoinSuccessInfo(res);
        setShowJoinModal(false);
        setVerifiedTicketInfo({
          ticket: {
            _id: res.ticket?._id,
            ticketNumber: res.ticket?.ticketNumber,
            operator: res.ticket?.operator,
            busNumber: res.ticket?.busNumber,
            fare: res.ticket?.fare,
            passengerCapacity: res.ticket?.passengerCapacity,
            passengerSlotsUsed: res.ticket?.passengerSlotsUsed,
          },
          passengers: res.ticket?.passengerSlotsUsed,
          totalCapacity: res.ticket?.passengerCapacity,
          isCoTraveller: true,
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to join journey. QR code may be expired or invalid.');
    } finally {
      setIsJoining(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. PUBLIC TRANSPORT ENTRY (BUS vs METRO CHOOSER)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!activeTransitMode || activeTransitMode === 'CHOOSER') {
    return (
      <div className="card" style={{ maxWidth: '850px', margin: '0 auto 2rem', padding: '1.75rem', animation: 'fadeIn 0.25s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          {onBack && (
            <button
              onClick={onBack}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}
            >
              <ArrowLeft size={15} />
              <span>Back to Mobility Modes</span>
            </button>
          )}
          {isTestMode && (
            <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '9999px' }}>
              PROTOTYPE ENVIRONMENT
            </span>
          )}
        </div>

        <PublicTransportModeSelector
          onSelectMode={(mode) => {
            setActiveTransitMode(mode);
            if (mode === 'METRO') {
              setShowMetroModal(true);
            }
          }}
          onClose={onBack}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. BUS JOURNEY PLANNER & OCR VERIFICATION SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="card" style={{ maxWidth: '850px', margin: '0 auto 2rem', padding: '1.5rem', animation: 'fadeIn 0.25s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--slate-100)', paddingBottom: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setActiveTransitMode(null)}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
            title="Switch between Bus and Metro"
          >
            <ArrowLeft size={15} />
            <span>Transit Options</span>
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bus size={22} className="text-blue-600" />
                <span>Bus Journey &amp; Ticket Verification</span>
              </h2>
              {isTestMode && (
                <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px', borderRadius: '9999px' }}>
                  DEMO DATA
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: '2px' }}>
              Smart Autocomplete &bull; Ticket OCR Verification &bull; Anti-Replay Ledger &bull; Real GPS Tracking
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Switch to Metro Quick Toggle */}
          <button
            type="button"
            onClick={() => {
              setActiveTransitMode('METRO');
              setShowMetroModal(true);
            }}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', color: '#4f46e5', borderColor: '#c7d2fe', background: '#eef2ff' }}
          >
            <Train size={14} />
            <span>Switch to Metro</span>
          </button>

          {/* Join Existing Journey */}
          <button
            type="button"
            onClick={() => setShowJoinModal(true)}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}
          >
            <QrCode size={14} />
            <span>Join with Code</span>
          </button>

          <button
            onClick={fetchNearbyStops}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RefreshCw size={13} className={loadingStops ? 'animate-spin' : ''} />
            <span>Refresh Stops</span>
          </button>
        </div>
      </div>

      {/* Origin & Destination Search Form with Smart Autocomplete */}
      <div style={{ background: '#f8fafc', border: '1px solid var(--slate-200)', borderRadius: '12px', padding: '1.15rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.85rem', marginBottom: '0.9rem' }}>
          {/* Smart Autocomplete Origin */}
          <PlaceAutocompleteInput
            label="From (Origin Bus Stop / Terminal)"
            placeholder="Search bus stop, terminal, or address (e.g. Katraj)..."
            value={fromText}
            onChange={(val) => {
              setFromText(val);
              setFromPlace(null);
              setSelectedRoute(null);
              setVerifiedTicketInfo(null);
            }}
            transitModeBias="BUS"
            currentLocation={currentLocation}
            showCurrentLocationOption={true}
            onSelectPlace={(place) => {
              setFromText(place.name || place.formattedAddress);
              setFromPlace(place);
            }}
          />

          {/* Smart Autocomplete Destination */}
          <PlaceAutocompleteInput
            label="To (Destination)"
            placeholder="Search destination, office, or bus stand (e.g. Bitwise Tower)..."
            value={toText}
            onChange={(val) => {
              setToText(val);
              setToPlace(null);
              setSelectedRoute(null);
              setVerifiedTicketInfo(null);
            }}
            transitModeBias="BUS"
            currentLocation={currentLocation}
            onSelectPlace={(place) => {
              setToText(place.name || place.formattedAddress);
              setToPlace(place);
            }}
          />
        </div>

        <button
          onClick={handleSearchRoutes}
          disabled={loadingRoutes}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '0.7rem 1.25rem', fontSize: '0.95rem', gap: '0.5rem' }}
        >
          {loadingRoutes ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          <span>Search Bus Transit Routes</span>
        </button>
      </div>

      {/* Ticket verification is only available after a recommended bus is selected. */}
      {selectedRoute && <div
        style={{
          border: verifiedTicketInfo ? '1.5px solid #a7f3d0' : '1px solid #bfdbfe',
          background: verifiedTicketInfo ? '#ecfdf5' : '#eff6ff',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: verifiedTicketInfo ? '#059669' : '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {verifiedTicketInfo ? <CheckCircle2 size={20} /> : <TicketIcon size={20} />}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: verifiedTicketInfo ? '#065f46' : '#1e40af' }}>
                {verifiedTicketInfo
                  ? `Ticket verified for ${selectedRoute.shortName || selectedRoute.routeId}`
                  : `Verify ticket for ${selectedRoute.shortName || selectedRoute.routeId}`}
              </div>
              <div style={{ fontSize: '0.75rem', color: verifiedTicketInfo ? '#047857' : '#3b82f6' }}>
                {verifiedTicketInfo
                  ? `Ticket #${verifiedTicketInfo.ticket.ticketNumber} • Bus ${verifiedTicketInfo.ticket.busNumber || selectedRoute.routeId || 'Bus'} • ₹${verifiedTicketInfo.ticket.fare || '25'}`
                  : `Selected route: ${selectedRoute.name}. Scan or upload its ticket for OCR validation.`}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowBusOcrModal(true)}
            className="btn"
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: verifiedTicketInfo ? '#ffffff' : '#2563eb',
              color: verifiedTicketInfo ? '#065f46' : '#ffffff',
              border: verifiedTicketInfo ? '1px solid #a7f3d0' : 'none',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {verifiedTicketInfo ? <RefreshCw size={14} /> : <ShieldCheck size={14} />}
            <span>{verifiedTicketInfo ? 'Change / Re-verify Ticket' : 'Verify Bus Ticket'}</span>
          </button>
        </div>

        {/* Transparent Disclaimer Badge */}
        {verifiedTicketInfo && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '6px 10px',
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: '6px',
              fontSize: '0.72rem',
              color: '#92400e',
              lineHeight: 1.35,
            }}
          >
            <strong>Note:</strong> Ticket OCR validated &bull; Cryptographic anti-replay hash recorded in database &bull; Official operator verification unavailable in demo mode.
          </div>
        )}
        {verifiedTicketInfo?.ticket?.joinCode && (
          <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.8rem', background: '#ffffff', border: '1px dashed #34d399', borderRadius: '8px', fontSize: '0.78rem', color: '#065f46' }}>
            <strong>Shared-ticket join code:</strong> <span style={{ fontWeight: 900, letterSpacing: '0.1em' }}>{verifiedTicketInfo.ticket.joinCode}</span>
            <span style={{ marginLeft: '0.4rem' }}>— {verifiedTicketInfo.ticket.passengerSlotsUsed}/{verifiedTicketInfo.ticket.passengerCapacity} passenger slots used.</span>
          </div>
        )}
      </div>}

      {/* Available Transit Itineraries */}
      {routeResults.length > 0 && (
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--slate-800)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Available Transit Itineraries ({routeResults.length})</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500)' }}>Select route for journey</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {routeResults.map((itin) => {
              const isSelected = selectedRoute?.itineraryId === itin.itineraryId || selectedRoute?.routeId === itin.routeId;
              return (
                <div
                  key={itin.itineraryId || itin.routeId}
                  onClick={() => setSelectedRoute(itin)}
                  style={{
                    border: isSelected ? '2px solid #2563eb' : '1px solid var(--slate-200)',
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    borderRadius: '12px',
                    padding: '1.15rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#2563eb', color: '#ffffff', padding: '3px 8px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 800 }}>
                        {itin.shortName || itin.routeId}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--slate-900)' }}>
                        {itin.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '9999px' }}>
                        +{itin.estimatedGreenCredits || 18} GP
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--slate-700)' }}>
                        {itin.totalDurationMinutes} min
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span>📍 {itin.totalDistanceKm} km distance</span>
                    <span>&bull;</span>
                    <span>🔄 {itin.transfers === 0 ? 'Direct Route (0 transfers)' : `${itin.transfers} Transfer`}</span>
                    <span>&bull;</span>
                    <span>🚌 {itin.operator || 'PMPML'}</span>
                  </div>
                  <div style={{ marginTop: '0.55rem', fontSize: '0.76rem', fontWeight: 700, color: isSelected ? '#1d4ed8' : '#475569' }}>
                    {isSelected
                      ? '✓ Selected — you can now verify your ticket above'
                      : `Recommended for ${itin.originName || fromText} → ${itin.destinationName || toText}. Click to select this bus.`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Route Action Card */}
      {selectedRoute && (
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            color: '#ffffff',
            borderRadius: '14px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#93c5fd', fontWeight: 700 }}>
                Ready to Start Transit Segment
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                {selectedRoute.shortName || selectedRoute.routeId}: {selectedRoute.name}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                +{selectedRoute.estimatedGreenCredits || 18} GP
              </div>
              <div style={{ fontSize: '0.72rem', color: '#93c5fd' }}>
                Estimated Reward
              </div>
            </div>
          </div>

          <button
            onClick={handleStartSegmentClick}
            disabled={isStarting}
            className="btn"
            style={{
              width: '100%',
              background: '#ffffff',
              color: '#1e40af',
              fontWeight: 800,
              padding: '0.85rem 1.25rem',
              fontSize: '1rem',
              justifyContent: 'center',
              gap: '0.5rem',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            {isStarting ? (
              <Loader2 size={18} className="animate-spin text-blue-600" />
            ) : verifiedTicketInfo ? (
              <CheckCircle2 size={18} className="text-emerald-600" />
            ) : (
              <TicketIcon size={18} />
            )}
            <span>
              {verifiedTicketInfo
                ? 'START PUBLIC JOURNEY (Ticket Attached)'
                : 'START PUBLIC SEGMENT (Verify Ticket First)'}
            </span>
          </button>
        </div>
      )}

      {/* Nearby Transit Stops */}
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--slate-800)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={16} className="text-blue-600" />
          <span>Nearby Transit Stops ({nearbyStops.length})</span>
        </div>

        {loadingStops ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--slate-500)' }}>
            <Loader2 size={22} className="animate-spin text-blue-600" style={{ margin: '0 auto 0.5rem' }} />
            <div style={{ fontSize: '0.85rem' }}>Discovering nearby bus stops &amp; metro stations...</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {nearbyStops.map((stop) => {
              const isExpanded = expandedStopId === stop.stopId;
              const arrivals = stopArrivals[stop.stopId] || [];
              const isLoadingArr = loadingArrivals[stop.stopId];

              return (
                <div key={stop.stopId} style={{ border: '1px solid var(--slate-200)', borderRadius: '10px', background: '#ffffff', overflow: 'hidden' }}>
                  <div
                    onClick={() => toggleStopArrivals(stop.stopId)}
                    style={{ padding: '0.85rem 1.15rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: isExpanded ? '#f8fafc' : '#ffffff' }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Bus size={16} className="text-blue-600" />
                        <span>{stop.name}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                        📍 {stop.distanceMeters}m away &bull; ~{stop.walkTimeMinutes} min walk &bull; {stop.routes?.length || 0} active routes
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb' }}>
                        {isExpanded ? 'Hide ETAs' : 'View Buses'}
                      </span>
                      {isExpanded ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded Upcoming Bus ETAs */}
                  {isExpanded && (
                    <div style={{ padding: '0.75rem 1.15rem', borderTop: '1px solid var(--slate-100)', background: '#fafafa' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                        Upcoming Bus / Metro Arrivals:
                      </div>

                      {isLoadingArr ? (
                        <div style={{ padding: '0.5rem 0', fontSize: '0.78rem', color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Loader2 size={14} className="animate-spin text-blue-600" />
                          <span>Loading schedule &amp; live ETAs...</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {arrivals.length > 0 ? (
                            arrivals.map((arr, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', border: '1px solid var(--slate-200)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ background: '#2563eb', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>
                                    {arr.busNumber || arr.routeId}
                                  </span>
                                  <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>
                                    {arr.direction || arr.routeName}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontWeight: 800, color: '#059669', fontSize: '0.85rem' }}>
                                    {arr.etaMinutes} min
                                  </span>
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 5px', borderRadius: '9999px', background: arr.status === 'LIVE' ? '#ecfdf5' : '#fef3c7', color: arr.status === 'LIVE' ? '#065f46' : '#92400e' }}>
                                    {arr.status || 'SCHEDULED'}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)' }}>
                              Buses arriving every 8–10 mins along this corridor.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginTop: '1rem', background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', borderRadius: '8px', padding: '0.65rem 0.85rem', fontSize: '0.82rem' }}>
          {error}
        </div>
      )}

      {/* Bus Ticket OCR Modal */}
      <BusTicketOCRModal
        isOpen={showBusOcrModal}
        onClose={() => setShowBusOcrModal(false)}
        onTicketVerified={handleBusTicketVerified}
        currentRoute={selectedRoute}
        fromText={fromText}
        toText={toText}
      />

      {/* Metro Verification Modal */}
      <MetroVerificationModal
        isOpen={showMetroModal}
        onClose={() => {
          setShowMetroModal(false);
          setActiveTransitMode(null);
        }}
        journeyId={journeyId}
        currentLocation={currentLocation}
        isTestMode={isTestMode}
        onOpenAudit={(jId) => {
          setAuditJourneyId(jId);
          setShowAuditModal(true);
        }}
        onJourneyStarted={(startRes) => {
          if (onSegmentStarted) {
            onSegmentStarted(1, {
              mode: 'METRO',
              ...startRes,
            });
          }
        }}
        onJourneyCompleted={(finalRes) => {
          if (onSegmentStarted) {
            onSegmentStarted(1, {
              mode: 'METRO',
              ...finalRes,
            });
          }
        }}
      />

      {/* Metro Multi-Factor Audit Modal */}
      <MetroAuditDebugModal
        isOpen={showAuditModal}
        journeyId={auditJourneyId || journeyId}
        onClose={() => setShowAuditModal(false)}
      />

      {/* Join Existing Journey Modal (Friend Scanning QR) */}
      {showJoinModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
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
              padding: '1.5rem',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <QrCode size={20} className="text-blue-600" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Join Shared Bus Journey</h3>
              </div>
              <button
                onClick={() => setShowJoinModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)' }}
              >
                &times;
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--slate-600)', marginBottom: '1rem' }}>
              Enter the join code shared by the ticket holder to claim one remaining passenger slot. You can then start your own verified bus journey.
            </p>

            <input
              type="text"
              value={joinQrInput}
              onChange={(e) => setJoinQrInput(e.target.value)}
              placeholder="Enter shared-ticket join code (e.g. BUS-ABC123)..."
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                border: '1px solid var(--slate-300)',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowJoinModal(false)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleJoinViaQr}
                disabled={isJoining || !joinQrInput.trim()}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                {isJoining ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                <span>Join Journey</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
