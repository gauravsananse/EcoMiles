const MetroTicketVerificationProvider = require('./MetroTicketVerificationProvider');
const crypto = require('crypto');

/**
 * Official Production Metro Ticket Verification Provider
 * Connects directly to MahaMetro / DMRC / BMRCL official ticketing API gateways
 * using secure server-to-server credentials.
 */
class OfficialMetroProvider extends MetroTicketVerificationProvider {
  constructor() {
    super('OFFICIAL_METRO_API');
    this.baseUrl = process.env.METRO_API_BASE_URL || '';
    this.apiKey = process.env.METRO_API_KEY || '';
    this.apiSecret = process.env.METRO_API_SECRET || '';
  }

  isConfigured() {
    return Boolean(
      this.baseUrl &&
      this.apiKey &&
      !this.apiKey.includes('YOUR_') &&
      this.apiSecret &&
      !this.apiSecret.includes('YOUR_')
    );
  }

  async verifyTicket({ qrData, originStationId, destinationStationId }) {
    if (!this.isConfigured()) {
      return {
        success: false,
        errorState: 'OPERATOR_API_NOT_CONFIGURED',
        message: 'Official Metro operator API credentials are not configured on this server.',
      };
    }

    try {
      // Cryptographic signature of request payload
      const timestamp = Date.now().toString();
      const payload = JSON.stringify({ qrData, originStationId, destinationStationId, timestamp });
      const signature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(payload)
        .digest('hex');

      const response = await fetch(`${this.baseUrl.replace(/\/+$/, '')}/v1/tickets/validate-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Metro-Api-Key': this.apiKey,
          'X-Metro-Timestamp': timestamp,
          'X-Metro-Signature': signature,
        },
        body: payload,
        signal: AbortSignal.timeout(6000),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        return {
          success: false,
          errorState: data.errorState || 'TICKET_INVALID',
          message: data.message || 'Ticket rejected by official Metro operator.',
        };
      }

      return {
        success: true,
        isOperatorAuthenticated: true,
        provider: this.name,
        operator: data.operator || 'Official Metro Authority',
        ticketNumber: data.ticketNumber || `TKT-${Date.now()}`,
        originStationId: data.originStationId,
        originStationName: data.originStationName,
        destinationStationId: data.destinationStationId,
        destinationStationName: data.destinationStationName,
        issuedAt: new Date(data.issuedAt || Date.now()),
        expiresAt: new Date(data.expiresAt || (Date.now() + 4 * 3600000)),
        fare: Number(data.fare || 20),
        status: 'VALID',
        message: 'Officially authenticated by Metro operator.',
      };
    } catch (err) {
      console.error('[OfficialMetroProvider] Network or server error:', err.message);
      return {
        success: false,
        errorState: 'OPERATOR_API_UNAVAILABLE',
        message: `Official Metro API unreachable: ${err.message}`,
      };
    }
  }

  async getTicketStatus(ticketIdOrHash) {
    if (!this.isConfigured()) {
      return { success: false, error: 'Operator API not configured' };
    }
    // Fetch live gate pass status from operator
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/+$/, '')}/v1/tickets/${encodeURIComponent(ticketIdOrHash)}/status`, {
        headers: { 'X-Metro-Api-Key': this.apiKey },
        signal: AbortSignal.timeout(4000),
      });
      return await response.json();
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = OfficialMetroProvider;
