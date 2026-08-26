const BaseVehicleVerificationProvider = require('./BaseProvider');

class GenericRCProvider extends BaseVehicleVerificationProvider {
  constructor(apiKey, apiUrl) {
    super('Generic RC Provider');
    this.apiKey = apiKey || process.env.VEHICLE_API_KEY;
    this.apiUrl = apiUrl || process.env.VEHICLE_API_URL;
  }

  isConfigured() {
    return Boolean(this.apiUrl && this.apiKey && !this.apiKey.includes('YOUR_'));
  }

  async verify(registrationNumber) {
    if (!this.isConfigured()) {
      throw new Error('CONFIG_ERROR: Generic RC API URL/Key is not configured');
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ registrationNumber, rc_number: registrationNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            notFound: true,
            message: `Vehicle ${registrationNumber} was not found on remote registry.`,
          };
        }
        if (response.status === 429) {
          throw new Error('RATE_LIMITED: External RC verification rate limit reached.');
        }
        throw new Error(data.message || `Provider returned HTTP ${response.status}`);
      }

      const rc = data.data || data.result || data.vehicle || data;
      return {
        success: true,
        verified: true,
        registrationNumber: rc.registrationNumber || rc.rc_number || registrationNumber,
        ownerName: rc.ownerName || rc.owner_name || 'Vehicle Owner',
        manufacturer: rc.manufacturer || rc.maker || rc.maker_description || 'EV Manufacturer',
        model: rc.model || rc.maker_model || 'Model',
        fuelType: rc.fuelType || rc.fuel_type || rc.fuel || 'Unknown',
        vehicleClass: rc.vehicleClass || rc.vehicle_class || rc.category || 'Vehicle',
        registrationDate: rc.registrationDate || rc.reg_date || rc.registration_date || 'N/A',
        verificationSource: 'National RC Gateway (Generic)',
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

module.exports = GenericRCProvider;
