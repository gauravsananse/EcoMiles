const API_BASE = '/api';

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

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json().catch(() => ({
    success: false,
    error: 'Invalid response from server',
  }));

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

  // Smart Multimodal Route Planner
  planSmartRoute: async (origin, destination) => {
    return request('/routes/smart-plan', {
      method: 'POST',
      body: JSON.stringify({ origin, destination }),
    });
  },

  // City Transport Network Intelligence
  getCityIntelligence: async () => {
    return request('/city/transport-intelligence', { method: 'GET' });
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

  // Health check
  getHealth: async () => {
    return request('/health', { method: 'GET' });
  },
};
