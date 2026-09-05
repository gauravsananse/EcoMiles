/**
 * Base Abstract Provider for Metro Ticket Verification
 * Subclasses implement real operator API integration or development simulation.
 */
class MetroTicketVerificationProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Verify ticket authenticity with the operator or provider
   * @param {Object} params
   * @param {string} params.qrData - Decoded QR string or token
   * @param {string} params.originStationId - Station ID or name selected by user
   * @param {string} params.destinationStationId - Destination ID or name
   * @returns {Promise<Object>} Verification result
   */
  async verifyTicket(params) {
    throw new Error('Method verifyTicket() must be implemented by subclass');
  }

  /**
   * Get ticket status directly from operator
   * @param {string} ticketIdOrHash
   * @returns {Promise<Object>} Status details
   */
  async getTicketStatus(ticketIdOrHash) {
    throw new Error('Method getTicketStatus() must be implemented by subclass');
  }
}

module.exports = MetroTicketVerificationProvider;
