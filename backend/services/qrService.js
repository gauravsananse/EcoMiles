const crypto = require('crypto');
const QRCode = require('qrcode');

class QRService {
  /**
   * Generates a cryptographically secure random token
   */
  generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generates a QR Code image DataURL from a secure token & metadata
   */
  async generateQRCodeDataURL(qrToken, registrationNumber) {
    const payload = JSON.stringify({
      type: 'GREEN_CREDITS_EV_BINDING',
      token: qrToken,
      reg: registrationNumber,
      timestamp: Date.now(),
    });

    try {
      const qrDataURL = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        margin: 2,
        width: 320,
        color: {
          dark: '#064e3b', // Deep emerald green
          light: '#ffffff',
        },
      });
      return qrDataURL;
    } catch (err) {
      console.error('[QRService] Failed to generate QR code:', err);
      throw new Error('Failed to generate vehicle QR code');
    }
  }
}

module.exports = new QRService();
