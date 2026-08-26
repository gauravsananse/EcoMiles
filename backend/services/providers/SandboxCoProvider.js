const BaseVehicleVerificationProvider = require('./BaseProvider');

class SandboxCoProvider extends BaseVehicleVerificationProvider {
  constructor(apiKey, apiUrl, apiSecret) {
    super('Sandbox.co.in');
    this.apiKey = apiKey || process.env.VEHICLE_API_KEY;
    this.apiUrl = apiUrl || process.env.VEHICLE_API_URL || 'https://api.sandbox.co.in/gsa/vahan/rc-search';
    this.apiSecret = apiSecret || process.env.VEHICLE_API_SECRET;
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim() !== '' && !this.apiKey.includes('YOUR_'));
  }

  /**
   * Generates or retrieves a cached Sandbox.co.in JWT Access Token
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.apiSecret) {
      return null;
    }

    try {
      const authRes = await fetch('https://api.sandbox.co.in/authenticate', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'x-api-secret': this.apiSecret,
          'x-api-version': '1.0',
        },
      });

      const authData = await authRes.json();
      if (authRes.ok && (authData.access_token || authData.data?.access_token)) {
        this.accessToken = authData.access_token || authData.data?.access_token;
        // Cache token for 23 hours
        this.tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;
        return this.accessToken;
      }
    } catch (authErr) {
      console.warn('[SandboxCoProvider] Authenticate endpoint fallback:', authErr.message);
    }

    return this.apiSecret;
  }

  async verify(registrationNumber) {
    if (!this.isConfigured()) {
      throw new Error('CONFIG_ERROR: Sandbox.co.in API Key is not configured');
    }

    try {
      const token = await this.getAccessToken();

      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'x-api-version': '1.0',
      };
      if (token) {
        headers['Authorization'] = token;
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rc_number: registrationNumber,
          vehicle_number: registrationNumber,
          registration_number: registrationNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok || (data.status && data.status !== 'success' && data.status !== 200)) {
        if (response.status === 404 || data.message?.toLowerCase().includes('not found')) {
          return {
            success: false,
            notFound: true,
            message: `Vehicle registration ${registrationNumber} was not found in the national Vahan database.`,
          };
        }
        if (response.status === 429) {
          throw new Error('RATE_LIMITED: Sandbox.co.in RC search rate limit reached.');
        }
        throw new Error(data.message || `Provider returned HTTP ${response.status}`);
      }

      const rc = data.data || data.result || data;
      return {
        success: true,
        verified: true,
        registrationNumber: rc.rc_number || rc.registration_number || registrationNumber,
        ownerName: rc.owner_name || rc.name || rc.registered_owner || 'Vehicle Owner',
        manufacturer: rc.maker_description || rc.maker || rc.manufacturer || 'Vehicle Maker',
        model: rc.maker_model || rc.model || 'Model',
        fuelType: rc.fuel_type || rc.fuel_descr || rc.fuel || 'Unknown',
        vehicleClass: rc.vehicle_class || rc.category || rc.vh_class_desc || 'Vehicle',
        registrationDate: rc.registration_date || rc.reg_date || rc.regn_dt || 'N/A',
        verificationSource: 'Sandbox.co.in Vahan Gateway',
        raw: rc,
      };
    } catch (err) {
      if (err.message.startsWith('CONFIG_ERROR') || err.message.startsWith('RATE_LIMITED')) {
        throw err;
      }
      throw new Error(`API_ERROR: ${err.message}`);
    }
  }
}

module.exports = SandboxCoProvider;
