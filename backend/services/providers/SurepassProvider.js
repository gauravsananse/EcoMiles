const BaseVehicleVerificationProvider = require('./BaseProvider');

class SurepassProvider extends BaseVehicleVerificationProvider {
  constructor(apiKey, apiUrl) {
    super('Surepass');
    this.apiKey = apiKey || process.env.VEHICLE_API_KEY;
    this.apiUrl = apiUrl || process.env.VEHICLE_API_URL || 'https://kyc-api.surepass.io/api/v1/rc/rc-full';
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim() !== '' && !this.apiKey.includes('YOUR_'));
  }

  async verify(registrationNumber) {
    if (!this.isConfigured()) {
      throw new Error('CONFIG_ERROR: Surepass API Key is not configured');
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ id_number: registrationNumber }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 404 || data.message?.toLowerCase().includes('not found')) {
          return {
            success: false,
            notFound: true,
            message: `Vehicle registration ${registrationNumber} was not found in the national Vahan database.`,
          };
        }
        if (response.status === 429) {
          throw new Error('RATE_LIMITED: RC verification rate limit reached for the provider.');
        }
        throw new Error(data.message || `Provider returned HTTP ${response.status}`);
      }

      const rc = data.data || {};
      return {
        success: true,
        verified: true,
        registrationNumber: rc.rc_number || registrationNumber,
        ownerName: rc.owner_name || rc.owner_name_masked || 'Registered Owner',
        manufacturer: rc.maker_description || rc.maker_model || 'Electric Vehicle Maker',
        model: rc.maker_model || 'Model',
        fuelType: rc.fuel_type || rc.fuel_descr || 'Unknown',
        vehicleClass: rc.vehicle_category || rc.vh_class_desc || 'Motor Vehicle',
        registrationDate: rc.registration_date || rc.regn_dt || 'N/A',
        verificationSource: 'Surepass Vahan Gateway',
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

module.exports = SurepassProvider;
