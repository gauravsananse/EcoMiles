const SurepassProvider = require('./providers/SurepassProvider');
const SandboxCoProvider = require('./providers/SandboxCoProvider');
const GenericRCProvider = require('./providers/GenericRCProvider');
const DevelopmentSandboxProvider = require('./providers/DevelopmentSandboxProvider');

class VehicleVerificationService {
  constructor() {
    this.initProvider();
  }

  initProvider() {
    const providerName = (process.env.VEHICLE_API_PROVIDER || '').trim().toLowerCase();

    switch (providerName) {
      case 'surepass':
        this.provider = new SurepassProvider();
        break;
      case 'sandbox_co':
      case 'sandbox.co.in':
        this.provider = new SandboxCoProvider();
        break;
      case 'generic':
      case 'rapidapi':
        this.provider = new GenericRCProvider();
        break;
      case 'sandbox':
      case 'development':
      case 'test':
        this.provider = new DevelopmentSandboxProvider();
        break;
      default:
        // Default to live external provider if API key is present, otherwise fallback to universal provider
        if (process.env.VEHICLE_API_KEY && !process.env.VEHICLE_API_KEY.includes('YOUR_')) {
          this.provider = new SurepassProvider();
        } else {
          this.provider = new DevelopmentSandboxProvider();
        }
        break;
    }
  }

  /**
   * Cleans and normalizes Indian registration numbers
   * (e.g. "mh-12 ab 1234" -> "MH12AB1234")
   */
  normalizeRegistrationNumber(input) {
    if (!input || typeof input !== 'string') return '';
    return input.toUpperCase().replace(/[\s\-_.]/g, '').trim();
  }

  /**
   * Validates standard Indian license plate format (e.g. MH12AB1234, DL01A1234, 22BH1234AA)
   */
  validatePlateFormat(regNo) {
    if (!regNo) return false;
    // Standard formats:
    // 1. State format: 2 letters + 1-2 digits + optional 1-3 letters + 4 digits (e.g. MH12AB1234, DL1C1234)
    // 2. Bharat (BH) series: 2 digits + BH + 4 digits + 1-2 letters (e.g. 22BH1234AA)
    const stateRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;
    const bhRegex = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;
    return stateRegex.test(regNo) || bhRegex.test(regNo);
  }

  /**
   * Masks sensitive personal name (e.g. "GAURAV SHARMA" -> "G***** S******")
   */
  maskOwnerName(fullName) {
    if (!fullName || typeof fullName !== 'string') return 'Registered Owner';
    const words = fullName.trim().split(/\s+/);
    const maskedWords = words.map((word) => {
      if (word.length <= 2) return `${word[0]}*`;
      return `${word[0]}${'*'.repeat(Math.max(word.length - 1, 4))}`;
    });
    return maskedWords.join(' ');
  }

  /**
   * Checks if fuel classification denotes an Electric Vehicle
   */
  isElectricFuel(fuelType) {
    if (!fuelType || typeof fuelType !== 'string') return { isEV: false, unknown: true };
    const normalized = fuelType.toUpperCase().trim();

    const evKeywords = [
      'ELECTRIC',
      'BATTERY',
      'BOV',
      'EV',
      'BATTERY OPERATED',
      'PURE EV',
      'BEV',
    ];

    const isMatch = evKeywords.some((kw) => normalized.includes(kw));

    const nonEvKeywords = ['PETROL', 'DIESEL', 'CNG', 'LPG', 'HYBRID', 'ETHANOL'];
    const isExplicitNonEv = nonEvKeywords.some((kw) => normalized.includes(kw)) && !isMatch;

    if (isMatch) {
      return { isEV: true, unknown: false };
    }
    if (isExplicitNonEv) {
      return { isEV: false, unknown: false };
    }

    return { isEV: false, unknown: true };
  }

  /**
   * Core verification execution
   */
  async verifyVehicleRegistration(rawRegistrationNumber, options = {}) {
    const registrationNumber = this.normalizeRegistrationNumber(rawRegistrationNumber);

    // 1. Format validation
    if (!this.validatePlateFormat(registrationNumber)) {
      return {
        success: false,
        errorState: 'INVALID_REGISTRATION',
        message: 'Please enter a valid Indian vehicle registration number (e.g. MH12AB1234 or 22BH1234AA).',
      };
    }

    // 2. Provider configuration check
    if (!this.provider || !this.provider.isConfigured()) {
      return {
        success: false,
        errorState: 'VERIFICATION_UNAVAILABLE',
        message: 'Live vehicle verification is not configured. Add a valid vehicle verification API key in the backend environment variables.',
      };
    }

    try {
      // 3. Call Provider API
      const result = await this.provider.verify(registrationNumber, options);

      if (!result.success || result.notFound) {
        return {
          success: false,
          errorState: 'VEHICLE_NOT_FOUND',
          message: result.message || `Vehicle registration number ${registrationNumber} was not found on the national registry.`,
        };
      }

      // 4. EV Classification analysis
      const evCheck = this.isElectricFuel(result.fuelType);

      if (evCheck.unknown) {
        return {
          success: false,
          errorState: 'VERIFICATION_UNAVAILABLE',
          message: 'Vehicle found, but EV status could not be reliably determined from the verification provider.',
          partialData: {
            registrationNumber: result.registrationNumber || registrationNumber,
            manufacturer: result.manufacturer,
            model: result.model,
            fuelType: result.fuelType || 'Unspecified',
          },
        };
      }

      if (!evCheck.isEV) {
        return {
          success: false,
          errorState: 'NOT_AN_EV',
          message: 'This vehicle is registered, but it is not identified as an electric vehicle.',
          vehicleData: {
            registrationNumber: result.registrationNumber || registrationNumber,
            ownerName: result.ownerName || 'Registered Owner',
            maskedOwnerName: this.maskOwnerName(result.ownerName),
            ownershipNumber: result.ownershipNumber || '1st Owner',
            manufacturer: result.manufacturer,
            model: result.model,
            fuelType: result.fuelType,
            vehicleClass: result.vehicleClass || 'Motor Vehicle (Non-EV)',
            rtoLocation: result.rtoLocation || 'Regional Transport Office',
            registrationDate: result.registrationDate,
            status: result.status || 'Active',
            verificationSource: result.verificationSource || 'National Vahan RC Gateway',
          },
        };
      }

      // 5. Success - EV Confirmed
      return {
        success: true,
        verified: true,
        isEV: true,
        registrationNumber: result.registrationNumber || registrationNumber,
        ownerName: result.ownerName || 'Registered Owner',
        maskedOwnerName: this.maskOwnerName(result.ownerName),
        ownershipNumber: result.ownershipNumber || '1st Owner',
        manufacturer: result.manufacturer || 'Electric Vehicle Maker',
        model: result.model || 'Model',
        fuelType: 'Electric',
        vehicleClass: result.vehicleClass || 'Motor Vehicle (EV)',
        rtoLocation: result.rtoLocation || 'Regional Transport Office',
        registrationDate: result.registrationDate || 'N/A',
        status: result.status || 'Active',
        verificationSource: result.verificationSource || 'National Vahan RC Gateway',
        isSandboxMode: Boolean(result.isSandboxMode),
      };
    } catch (err) {
      if (err.message.startsWith('CONFIG_ERROR')) {
        return {
          success: false,
          errorState: 'VERIFICATION_UNAVAILABLE',
          message: 'Live vehicle verification is not configured. Add a valid vehicle verification API key in the backend environment variables.',
        };
      }
      if (err.message.startsWith('RATE_LIMITED')) {
        return {
          success: false,
          errorState: 'RATE_LIMITED',
          message: 'RC verification provider rate limit exceeded. Please try again in a few moments.',
        };
      }

      return {
        success: false,
        errorState: 'API_ERROR',
        message: err.message.replace('API_ERROR: ', '') || 'Failed to verify vehicle with external registry. Please try again.',
      };
    }
  }
}

module.exports = new VehicleVerificationService();
