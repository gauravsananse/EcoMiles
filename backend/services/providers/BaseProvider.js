/**
 * Base abstract class for Vehicle RC Verification Providers.
 * Any new provider (Surepass, Sandbox.co.in, Cashfree, Quicko, RapidAPI, etc.)
 * must implement this contract.
 */
class BaseVehicleVerificationProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Verify an Indian RC plate
   * @param {string} registrationNumber - Clean uppercase registration number (e.g. MH12AB1234)
   * @returns {Promise<{
   *   success: boolean,
   *   verified: boolean,
   *   registrationNumber: string,
   *   ownerName?: string,
   *   manufacturer?: string,
   *   model?: string,
   *   fuelType?: string,
   *   vehicleClass?: string,
   *   registrationDate?: string,
   *   verificationSource: string,
   *   raw?: any
   * }>}
   */
  async verify(registrationNumber) {
    throw new Error(`verify() must be implemented by ${this.name} provider`);
  }

  /**
   * Helper to check if credentials are validly set
   */
  isConfigured() {
    return true;
  }
}

module.exports = BaseVehicleVerificationProvider;
