const API_BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') : '') + '/api';
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Helper to fetch stored JWT auth token
 */
export const getToken = () => localStorage.getItem('gc_auth_token');

export const setToken = (token) => {
  if (token) {
    localStorage.setItem('gc_auth_token', token);
  } else {
    localStorage.removeItem('gc_auth_token');
  }
};

export const getStoredUser = () => {
  const user = localStorage.getItem('gc_user');
  try {
    return user ? JSON.parse(user) : null;
  } catch (e) {
    return null;
  }
};

export const setStoredUser = (user) => {
  if (user) {
    localStorage.setItem('gc_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('gc_user');
  }
};

/**
 * Core HTTP Request Wrapper
 */
async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const config = {
    ...options,
    headers,
    signal: controller.signal,
  };

  let response;
  let data;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, config);
    data = await response.json().catch(() => ({
      success: false,
      error: 'Invalid response from server',
    }));
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The server took too long to respond. Please check your connection and try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const error = new Error(data.error || 'API Request Failed');
    error.status = response.status;
    error.errorState = data.errorState;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Authentication
  login: async (email, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      setToken(data.token);
      setStoredUser(data.user);
    }
    return data;
  },

  register: async (name, email, password) => {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    if (data.token) {
      setToken(data.token);
      setStoredUser(data.user);
    }
    return data;
  },

  getMe: async () => {
    return request('/auth/me', { method: 'GET' });
  },

  logout: () => {
    setToken(null);
    setStoredUser(null);
  },

  // Vehicle RC Verification
  verifyVehicle: async (registrationNumber) => {
    return request('/vehicles/verify', {
      method: 'POST',
      body: JSON.stringify({ registrationNumber }),
    });
  },

  // Vehicle Binding / Registration
  registerVehicle: async (vehicleData) => {
    return request('/vehicles/register', {
      method: 'POST',
      body: JSON.stringify(vehicleData),
    });
  },

  // Get Bound Vehicle
  getMyVehicle: async () => {
    return request('/vehicles/my-vehicle', { method: 'GET' });
  },

  // Verify QR Access / Physical Binding
  verifyQR: async (qrToken) => {
    return request('/vehicles/qr/verify', {
      method: 'POST',
      body: JSON.stringify({ qrToken }),
    });
  },

  // Regenerate QR Code
  regenerateQR: async (vehicleId) => {
    return request('/vehicles/qr/regenerate', {
      method: 'POST',
      body: JSON.stringify({ vehicleId }),
    });
  },

  // Unlink Vehicle
  unlinkVehicle: async (vehicleId) => {
    return request(`/vehicles/${vehicleId}`, {
      method: 'DELETE',
    });
  },

  // Journeys & AI Mode Detection
  recordJourney: async (journeyData) => {
    return request('/journeys/record', {
      method: 'POST',
      body: JSON.stringify(journeyData),
    });
  },

  getJourneyHistory: async () => {
    return request('/journeys/history', { method: 'GET' });
  },

  // Google Places Autocomplete & Details
  autocompletePlaces: async (input, sessionToken, lat, lng) => {
    let q = `?input=${encodeURIComponent(input)}`;
    if (sessionToken) q += `&sessionToken=${encodeURIComponent(sessionToken)}`;
    if (lat && lng) q += `&lat=${lat}&lng=${lng}`;
    return request(`/routes/places/autocomplete${q}`, { method: 'GET' });
  },

  getPlaceDetails: async (placeId, sessionToken, fallbackName) => {
    let q = `?placeId=${encodeURIComponent(placeId)}`;
    if (sessionToken) q += `&sessionToken=${encodeURIComponent(sessionToken)}`;
    if (fallbackName) q += `&fallbackName=${encodeURIComponent(fallbackName)}`;
    return request(`/routes/places/details${q}`, { method: 'GET' });
  },

  reverseGeocode: async (lat, lng) => {
    return request(`/routes/places/reverse-geocode?lat=${lat}&lng=${lng}`, { method: 'GET' });
  },

  // Smart Multimodal Route Planner
  planSmartRoute: async (origin, destination) => {
    return request('/routes/smart-plan', {
      method: 'POST',
      body: JSON.stringify({ origin, destination }),
    });
  },

  rerouteJourney: async (currentLocation, destination, mode) => {
    return request('/routes/reroute', {
      method: 'POST',
      body: JSON.stringify({ currentLocation, destination, mode }),
    });
  },

  // City Transport Network Intelligence
  getCityIntelligence: async () => {
    return request('/city/transport-intelligence', { method: 'GET' });
  },

  // City Mobility Overview (City Network Module)
  getCityMobilityOverview: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.dateFilter) params.append('dateFilter', filters.dateFilter);
    if (filters.modeFilter) params.append('modeFilter', filters.modeFilter);
    if (filters.isDemo !== undefined) params.append('isDemo', filters.isDemo);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return request(`/city-network/overview${qs}`, { method: 'GET' });
  },

  getCityNetworkDashboard: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return request(`/city-network/overview${params ? `?${params}` : ''}`, { method: 'GET' });
  },

  getCityNetworkSummary: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return request(`/city-network/summary${params ? `?${params}` : ''}`, { method: 'GET' });
  },

  getWalkingAnalysis: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return request(`/city-network/walking${params ? `?${params}` : ''}`, { method: 'GET' });
  },

  getCyclingAnalysis: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return request(`/city-network/cycling${params ? `?${params}` : ''}`, { method: 'GET' });
  },

  getEvAnalysis: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return request(`/city-network/ev${params ? `?${params}` : ''}`, { method: 'GET' });
  },

  getPublicTransportAnalysis: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return request(`/city-network/public-transport${params ? `?${params}` : ''}`, { method: 'GET' });
  },

  getCo2Analysis: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return request(`/city-network/co2${params ? `?${params}` : ''}`, { method: 'GET' });
  },

  // Rewards Marketplace
  getRewards: async (category) => {
    const query = category ? `?category=${category}` : '';
    return request(`/rewards${query}`, { method: 'GET' });
  },

  redeemReward: async (rewardId) => {
    return request('/rewards/redeem', {
      method: 'POST',
      body: JSON.stringify({ rewardId }),
    });
  },

  getMyRedemptions: async () => {
    return request('/rewards/my-redemptions', { method: 'GET' });
  },

  trackPartnerClick: async (clickData) => {
    try {
      return await request('/rewards/track-click', {
        method: 'POST',
        body: JSON.stringify(clickData),
      });
    } catch (e) {
      console.warn('[TrackPartnerClick] Fail-safe ignored:', e);
      return { success: true };
    }
  },

  // Multimodal Mobility AI Verification Endpoints
  startMultimodalJourney: async (payload = {}) => {
    return request('/journey/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  sendSensorData: async (journeyId, sensorWindow) => {
    return request('/journey/sensor-data', {
      method: 'POST',
      body: JSON.stringify({ journeyId, sensorWindow }),
    });
  },

  verifyEV: async (journeyId, payload) => {
    return request(`/journey/${journeyId}/verify-ev`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  confirmPublicTransport: async (journeyId, payload) => {
    return request(`/journey/${journeyId}/public-transport-confirm`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getNearbyRoutes: async (lat, lng, radius = 2000) => {
    const q = lat && lng ? `?lat=${lat}&lng=${lng}&radius=${radius}` : '';
    return request(`/journey/nearby-routes${q}`, { method: 'GET' });
  },

  logVerificationEvent: async (journeyId, eventData) => {
    return request(`/journey/${journeyId}/verification-event`, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  },

  getVerificationEvents: async (journeyId) => {
    return request(`/journey/${journeyId}/events`, { method: 'GET' });
  },

  updateJourneySteps: async (journeyId, rawStepsDelta) => {
    return request(`/journey/${journeyId}/steps`, {
      method: 'POST',
      body: JSON.stringify({ rawStepsDelta }),
    });
  },

  runMLInference: async (sensorWindow) => {
    return request('/journey/inference', {
      method: 'POST',
      body: JSON.stringify({ sensorWindow }),
    });
  },

  verifyJourneyStatus: async (journeyId) => {
    return request('/journey/verify', {
      method: 'POST',
      body: JSON.stringify({ journeyId }),
    });
  },

  endMultimodalJourney: async (journeyId) => {
    return request('/journey/end', {
      method: 'POST',
      body: JSON.stringify({ journeyId }),
    });
  },

  getJourneyDetails: async (journeyId) => {
    return request(`/journey/${journeyId}`, { method: 'GET' });
  },

  getJourneySegments: async (journeyId) => {
    return request(`/journey/${journeyId}/segments`, { method: 'GET' });
  },

  getJourneyRewards: async (journeyId) => {
    return request(`/journey/${journeyId}/rewards`, { method: 'GET' });
  },

  deleteJourneyData: async (journeyId) => {
    return request(`/journey/${journeyId}`, { method: 'DELETE' });
  },

  getTransitContext: async (lat, lng) => {
    const q = lat && lng ? `?lat=${lat}&lng=${lng}` : '';
    return request(`/transit/context${q}`, { method: 'GET' });
  },

  getTransitBeacons: async () => {
    return request('/transit/beacons', { method: 'GET' });
  },

  analyzeFraud: async (sensorWindow) => {
    return request('/fraud/analyze', {
      method: 'POST',
      body: JSON.stringify({ sensorWindow }),
    });
  },

  // Network LAN IP for mobile handover QR
  getNetworkIp: async () => {
    return request('/network-ip', { method: 'GET' });
  },

  // Health check
  getHealth: async () => {
    return request('/health', { method: 'GET' });
  },

  // Transit — Nearby Stops
  getNearbyTransitStops: async (lat, lng, radius = 3000) => {
    return request(`/transit/stops/nearby?lat=${lat}&lng=${lng}&radius=${radius}`, { method: 'GET' });
  },

  // Transit — Search Routes
  searchTransitRoutes: async (origin, destination, lat, lng) => {
    let q = `?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (lat && lng) q += `&lat=${lat}&lng=${lng}`;
    return request(`/transit/routes/search${q}`, { method: 'GET' });
  },

  // Transit — Upcoming Arrivals at a Stop
  getUpcomingArrivals: async (stopId) => {
    return request(`/transit/arrivals/${encodeURIComponent(stopId)}`, { method: 'GET' });
  },

  // Transit — Route Details
  getTransitRouteDetails: async (routeId) => {
    return request(`/transit/routes/${encodeURIComponent(routeId)}`, { method: 'GET' });
  },

  // Journey Segments — Start a Segment
  startJourneySegment: async (journeyId, selectedMode, origin, destination, selectedRouteId, selectedRouteName, currentLocation) => {
    return request(`/journey/${journeyId}/segments/start`, {
      method: 'POST',
      body: JSON.stringify({ selectedMode, origin, destination, selectedRouteId, selectedRouteName, currentLocation }),
    });
  },

  // Journey Segments — Complete a Segment
  completeJourneySegment: async (journeyId, segmentIndex, endLocation, finalSteps) => {
    return request(`/journey/${journeyId}/segments/${segmentIndex}/complete`, {
      method: 'POST',
      body: JSON.stringify({ endLocation, finalSteps }),
    });
  },

  // Journey — Summary
  getJourneySummary: async (journeyId) => {
    return request(`/journey/${journeyId}/summary`, { method: 'GET' });
  },

  // Public Transport — Ticket Verification
  verifyTicket: async (payload) => {
    return request('/tickets/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  claimPassengerSlot: async (ticketId, journeyId, isOwner = false) => {
    return request(`/tickets/${ticketId}/claim-slot`, {
      method: 'POST',
      body: JSON.stringify({ journeyId, isOwner }),
    });
  },

  getTicketDetails: async (ticketId) => {
    return request(`/tickets/${ticketId}`, { method: 'GET' });
  },

  getTicketMockScenarios: async () => {
    return request('/tickets/mock-scenarios', { method: 'GET' });
  },

  // Public Transport — Co-Traveller QR Handover
  generateJourneyInvitationQR: async (journeyId, ticketId, slotIndex) => {
    return request(`/journey/${journeyId}/generate-invitation-qr`, {
      method: 'POST',
      body: JSON.stringify({ ticketId, slotIndex }),
    });
  },

  joinJourneyViaQR: async (journeyId, token) => {
    return request(`/journey/${journeyId}/join-via-qr`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  // Public Transport — Real GPS Point Streaming
  appendGpsPoint: async (journeyId, gpsPoint) => {
    return request(`/journey/${journeyId}/location`, {
      method: 'POST',
      body: JSON.stringify(gpsPoint),
    });
  },

  // Public Transport — Link Ticket to Journey
  linkTicketToJourney: async (journeyId, payload) => {
    return request(`/journey/${journeyId}/link-ticket`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Real-World Metro Verification System
  verifyMetroTicket: async (payload) => {
    return request('/metro/verify-ticket', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  verifyMetroOrigin: async (payload) => {
    return request('/metro/verify-origin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  startMetroJourney: async (payload) => {
    return request('/metro/start-journey', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  recordMetroLocation: async (payload) => {
    return request('/metro/location', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  endMetroJourney: async (payload) => {
    return request('/metro/end-journey', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMetroStations: async (city = 'Pune', query = '') => {
    const q = new URLSearchParams({ city, ...(query ? { query } : {}) });
    return request(`/metro/stations?${q.toString()}`, { method: 'GET' });
  },

  getMetroJourneyAudit: async (journeyId) => {
    return request(`/metro/journey/${journeyId}`, { method: 'GET' });
  },

  // Bus Ticket OCR & Anti-Replay Validation
  validateBusTicketOCR: async (payload) => {
    return request('/metro/bus/verify-ticket', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};


