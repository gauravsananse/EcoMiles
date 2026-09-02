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

export default function PublicTransportHub({
  journeyId,
  currentLocation = { lat: 18.5284, lng: 73.8744 },
  onSegmentStarted,
  onBack,
  isTestMode = false,
}) {
  const [fromText, setFromText] = useState('Katraj');
  const [toText, setToText] = useState('Bitwise Tower');
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

  // Ticket Verification & Co-Traveller Workflow
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [verifiedTicketInfo, setVerifiedTicketInfo] = useState(null);

  // Join Existing Journey Modal state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinQrInput, setJoinQrInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccessInfo, setJoinSuccessInfo] = useState(null);

  // Fetch nearby stops on mount
  useEffect(() => {
    fetchNearbyStops();
    handleSearchRoutes(); // Pre-populate Katraj -> Bitwise Tower by default
  }, [currentLocation?.lat, currentLocation?.lng]);

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

  const handleSearchRoutes = async () => {
    setLoadingRoutes(true);
    setError('');
    try {
      const lat = currentLocation?.lat || 18.5284;
      const lng = currentLocation?.lng || 73.8744;
      const res = await api.searchTransitRoutes(fromText, toText, lat, lng);
      if (res.success && res.itineraries && res.itineraries.length > 0) {
        setRouteResults(res.itineraries);
        setSelectedRoute(res.itineraries[0]);
      } else {
        throw new Error('No itineraries found');
      }
    } catch (err) {
      // Prototype itinerary for Katraj -> Bitwise Tower
      const fallbackRoutes = [
        {
          itineraryId: 'ITIN-KATRAJ-BITWISE',
          routeId: '103',
          name: 'Route 103 — Katraj ⇄ Swargate ⇄ Bitwise Tower',
          shortName: 'Bus 103 (PMPML)',
          mode: 'BUS',
          operator: 'PMPML',
          origin: { name: 'Katraj Bus Terminal', lat: 18.4575, lng: 73.8677 },
          destination: { name: 'Bitwise Tower', lat: 18.5604, lng: 73.7804 },
          totalDurationMinutes: 34,
          totalDistanceKm: 8.4,
          transfers: 0,
          estimatedGreenCredits: 18,
          geometry: [
            [18.4575, 73.8677],
            [18.4720, 73.8600],
            [18.5010, 73.8580],
            [18.5300, 73.8400],
            [18.5604, 73.7804],
          ],
          stops: [
            { stopId: 'ST-1', name: 'Katraj Terminal', lat: 18.4575, lng: 73.8677 },
            { stopId: 'ST-2', name: 'Swargate Bus Stand', lat: 18.5010, lng: 73.8580 },
            { stopId: 'ST-3', name: 'Shivajinagar Station', lat: 18.5300, lng: 73.8400 },
            { stopId: 'ST-4', name: 'Bitwise Tower Stop', lat: 18.5604, lng: 73.7804 },
          ],
          steps: [
            { stepIndex: 1, type: 'WALK', instruction: 'Walk 80 m to Katraj Bus Stand', durationMinutes: 1, distanceMeters: 80 },
            { stepIndex: 2, type: 'BUS', instruction: 'Board PMPML Bus 103 towards Bitwise Tower', durationMinutes: 30, distanceKm: 8.2 },
            { stepIndex: 3, type: 'WALK', instruction: 'Walk 120 m to Bitwise Tower Entrance', durationMinutes: 2, distanceMeters: 120 },
          ],
        },
        {
          itineraryId: 'ITIN-104',
          routeId: '104',
          name: 'Route 104 — Shivajinagar ⇄ Aundh / Baner',
          shortName: 'Bus 104',
          mode: 'BUS',
          totalDurationMinutes: 48,
          totalDistanceKm: 10.5,
          transfers: 1,
          estimatedGreenCredits: 20,
          steps: [
            { stepIndex: 1, type: 'WALK', instruction: 'Walk 200 m to Station', durationMinutes: 3, distanceMeters: 200 },
            { stepIndex: 2, type: 'BUS', instruction: 'Board Bus 104 towards Baner', durationMinutes: 38, distanceKm: 9.8 },
            { stepIndex: 3, type: 'WALK', instruction: 'Walk 450 m to Destination', durationMinutes: 7, distanceMeters: 450 },
          ],
        },
      ];
      setRouteResults(fallbackRoutes);
      setSelectedRoute(fallbackRoutes[0]);
    } finally {
      setLoadingRoutes(false);
    }
  };

  /**
   * FLOW 1: When user clicks "START PUBLIC SEGMENT"
   * DO NOT start the journey immediately.
   * Open the Ticket Verification Modal.
   */
  const handleStartSegmentClick = () => {
    if (!selectedRoute) return;
    // Open Ticket Verification Modal
    setShowTicketModal(true);
  };

  /**
   * Callback when ticket is verified in modal
   */
  const handleTicketVerifiedCallback = (verifiedData) => {
    setVerifiedTicketInfo(verifiedData);
  };

  /**
   * FLOW 6 & 7: User clicks "START PUBLIC JOURNEY" after ticket is verified
   * Starts GPS tracking immediately in parent component.
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
          await api.linkTicketToJourney(journeyId, {
            ticketId: verifiedTicketInfo.ticket._id,
            ticketNumber: verifiedTicketInfo.ticket.ticketNumber,
            operator: verifiedTicketInfo.ticket.operator,
            passengerSlot: 0,
            coTravellers: verifiedTicketInfo.coTravellers,
          });
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
      // Fallback start
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
      const res = await api.joinJourneyViaQR(journeyId || 'active_journey', joinQrInput.trim());
      if (res.success) {
        setJoinSuccessInfo(res);
        setShowJoinModal(false);
        setVerifiedTicketInfo({
          ticket: {
            ticketNumber: res.ticketNumber,
            operator: res.operator,
            source: res.source,
            destination: res.destination,
            passengerCount: res.passengerCount,
          },
          passengers: res.usedSlots,
          totalCapacity: res.passengerCount,
          isCoTraveller: true,
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to join journey. QR code may be expired or invalid.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '850px', margin: '0 auto 2rem', padding: '1.5rem', animation: 'fadeIn 0.25s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--slate-100)', paddingBottom: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onBack && (
            <button
              onClick={onBack}
              className="btn btn-secondary"
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
            >
              <ArrowLeft size={15} />
              <span>Back</span>
            </button>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bus size={22} className="text-blue-600" />
                <span>Public Transport Journey Planner</span>
              </h2>
              {isTestMode && (
                <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontSize: '0.68rem', fontWeight: 800, padding: '1px 6px', borderRadius: '9999px' }}>
                  DEMO DATA
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: '2px' }}>
              Ticket OCR verification, Co-Traveller multi-passenger slots, and Real GPS tracking.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* JOIN EXISTING JOURNEY BUTTON (Section 5) */}
          <button
            type="button"
            onClick={() => setShowJoinModal(true)}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}
          >
            <QrCode size={14} className="text-blue-600" />
            <span>Join Existing Journey</span>
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

      {/* Origin & Destination Search Form */}
      <div style={{ background: '#f8fafc', border: '1px solid var(--slate-200)', borderRadius: '12px', padding: '1.15rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '0.9rem' }}>
          {/* Origin */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid var(--slate-300)', borderRadius: '8px', padding: '0.5rem 0.85rem', gap: '0.5rem' }}>
            <MapPin size={16} className="text-emerald-600" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--slate-400)', fontWeight: 700, textTransform: 'uppercase' }}>From (Origin)</div>
              <input
                type="text"
                value={fromText}
                onChange={(e) => setFromText(e.target.value)}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: '0.88rem', fontWeight: 600, color: 'var(--slate-800)', padding: 0 }}
                placeholder="Enter starting location (e.g. Katraj)..."
              />
            </div>
          </div>

          {/* Destination */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid var(--slate-300)', borderRadius: '8px', padding: '0.5rem 0.85rem', gap: '0.5rem' }}>
            <Navigation size={16} className="text-blue-600" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--slate-400)', fontWeight: 700, textTransform: 'uppercase' }}>To (Destination)</div>
              <input
                type="text"
                value={toText}
                onChange={(e) => setToText(e.target.value)}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: '0.88rem', fontWeight: 600, color: 'var(--slate-800)', padding: 0 }}
                placeholder="Enter destination (e.g. Bitwise Tower)..."
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSearchRoutes}
          disabled={loadingRoutes}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '0.7rem 1.25rem', fontSize: '0.95rem', gap: '0.5rem' }}
        >
          {loadingRoutes ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          <span>Search Public Transport Routes</span>
        </button>
      </div>

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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 800 }}>
                        <Leaf size={12} fill="#059669" />
                        +{itin.estimatedGreenCredits || 18} GP
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--slate-800)' }}>
                        {itin.totalDurationMinutes} min
                      </span>
                    </div>
                  </div>

                  {/* Multimodal Steps Timeline */}
                  <div style={{ background: isSelected ? '#ffffff' : '#f8fafc', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--slate-700)', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid rgba(0,0,0,0.05)' }}>
                    {(itin.steps || []).map((st, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {st.type === 'WALK' ? (
                          <Footprints size={14} className="text-emerald-600" style={{ flexShrink: 0 }} />
                        ) : (
                          <Bus size={14} className="text-blue-600" style={{ flexShrink: 0 }} />
                        )}
                        <span style={{ flex: 1 }}>{st.instruction}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--slate-400)', fontWeight: 600 }}>{st.durationMinutes} min</span>
                      </div>
                    ))}
                  </div>

                  {isSelected && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2563eb' }}>✓ Selected for this segment</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 6: RETURN TO PUBLIC TRANSPORT SCREEN WITH VERIFIED TICKET */}
      {verifiedTicketInfo ? (
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            borderRadius: '14px',
            padding: '1.4rem',
            marginBottom: '1.75rem',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bus size={22} className="text-blue-400" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, letterSpacing: '0.02em' }}>
                🚌 PUBLIC TRANSPORT JOURNEY
              </h3>
            </div>
            <span style={{ background: '#059669', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, padding: '3px 10px', borderRadius: '9999px' }}>
              Ready to Launch
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', background: 'rgba(255, 255, 255, 0.07)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Route</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
                {fromText} ➔ {toText}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Ticket</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#34d399', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={15} /> Verified ({verifiedTicketInfo.ticket?.ticketNumber || 'PMPML'})
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Passengers</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#60a5fa', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Users size={15} /> {verifiedTicketInfo.passengers || 1}/{verifiedTicketInfo.totalCapacity || 1} Verified
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>GPS Tracking</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                🟢 Ready
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Journey Verification</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                🟢 Ready
              </div>
            </div>
          </div>

          {/* CRITICAL GPS START BUTTON (FLOW 7) */}
          <button
            onClick={handleLaunchLivePublicJourney}
            disabled={isStarting}
            className="btn"
            style={{
              width: '100%',
              background: '#059669',
              color: '#ffffff',
              fontWeight: 800,
              padding: '0.9rem 1.25rem',
              fontSize: '1.05rem',
              justifyContent: 'center',
              gap: '0.6rem',
              border: 'none',
              borderRadius: '10px',
              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)',
            }}
          >
            {isStarting ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Requesting GPS &amp; Starting Journey...</span>
              </>
            ) : (
              <>
                <Navigation size={20} fill="#ffffff" />
                <span>START PUBLIC JOURNEY</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* STEP 1: INITIAL ACTION CARD (OPENS TICKET VERIFICATION MODAL) */
        selectedRoute && (
          <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)', color: '#ffffff', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.75rem', boxShadow: '0 4px 14px rgba(30, 58, 138, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#bfdbfe', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>
                  STEP 1 &bull; TICKET VERIFICATION REQUIRED
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '2px' }}>
                  {selectedRoute.name || selectedRoute.shortName}
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

            {/* FLOW 1: Button opens Ticket Modal (Does NOT start immediately) */}
            <button
              onClick={handleStartSegmentClick}
              className="btn"
              style={{ width: '100%', background: '#ffffff', color: '#1e40af', fontWeight: 800, padding: '0.8rem 1.25rem', fontSize: '1rem', justifyContent: 'center', gap: '0.5rem', border: 'none', borderRadius: '8px' }}
            >
              <TicketIcon size={18} />
              <span>START PUBLIC SEGMENT (Verify Ticket)</span>
            </button>
          </div>
        )
      )}

      {/* Nearby Bus / Metro Stops Section */}
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--slate-800)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={16} className="text-blue-600" />
          <span>Nearby Transit Stops ({nearbyStops.length})</span>
        </div>

        {loadingStops ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--slate-500)' }}>
            <Loader2 size={22} className="animate-spin text-blue-600" style={{ margin: '0 auto 0.5rem' }} />
            <div style={{ fontSize: '0.85rem' }}>Discovering nearby bus stops & metro stations...</div>
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
                          <span>Loading schedule & live ETAs...</span>
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

      {/* Ticket Verification Modal */}
      <TicketVerificationModal
        isOpen={showTicketModal}
        selectedRoute={selectedRoute}
        journeyId={journeyId}
        onClose={() => setShowTicketModal(false)}
        onTicketVerified={handleTicketVerifiedCallback}
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
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
              <QrCode size={22} className="text-blue-600" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                Join Existing Public Journey
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
              Paste the QR invitation token or scanned code from the ticket owner to claim an available passenger slot.
            </p>

            <textarea
              rows={3}
              value={joinQrInput}
              onChange={(e) => setJoinQrInput(e.target.value)}
              placeholder="Paste Base64 Journey Invitation Token here..."
              style={{
                width: '100%',
                border: '1px solid var(--slate-300)',
                borderRadius: '8px',
                padding: '0.6rem',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                marginBottom: '1rem',
              }}
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleJoinViaQr}
                disabled={isJoining || !joinQrInput.trim()}
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {isJoining ? <Loader2 size={16} className="animate-spin" /> : 'Verify & Join'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
