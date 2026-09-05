const metroService = require('../services/metroService');
const busTicketService = require('../services/busTicketService');
const MetroStation = require('../models/MetroStation');

/**
 * 1. Verify Metro Ticket / QR Code
 * POST /api/metro/verify-ticket
 */
exports.verifyTicket = async (req, res) => {
  try {
    const { qrData, originStationId, destinationStationId, verificationMethod } = req.body;
    if (!qrData) {
      return res.status(400).json({ success: false, error: 'QR data is required' });
    }

    const result = await metroService.verifyAndClaimTicket({
      qrData,
      originStationId,
      destinationStationId,
      user: req.user,
      verificationMethod,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('[MetroController.verifyTicket] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 2. Verify Origin Station Geofence Presence
 * POST /api/metro/verify-origin
 */
exports.verifyOrigin = async (req, res) => {
  try {
    const { stationId, latitude, longitude, accuracy } = req.body;
    if (!stationId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, error: 'stationId, latitude, and longitude are required' });
    }

    const result = await metroService.verifyOriginGeofence({
      stationId,
      userLatitude: Number(latitude),
      userLongitude: Number(longitude),
      userAccuracy: Number(accuracy) || 10,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('[MetroController.verifyOrigin] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 3. Start Metro Journey
 * POST /api/metro/start-journey
 */
exports.startJourney = async (req, res) => {
  try {
    const { ticketId, originStationId, destinationStationId, userLocation } = req.body;
    if (!ticketId || !originStationId || !destinationStationId) {
      return res.status(400).json({ success: false, error: 'ticketId, originStationId, and destinationStationId are required' });
    }

    const result = await metroService.startMetroJourney({
      ticketId,
      originStationId,
      destinationStationId,
      userLocation,
      user: req.user,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('[MetroController.startJourney] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 4. Record Location / Telemetry
 * POST /api/metro/location
 */
exports.recordLocation = async (req, res) => {
  try {
    const { journeyId, latitude, longitude, accuracy, speed, timestamp } = req.body;
    if (!journeyId) {
      return res.status(400).json({ success: false, error: 'journeyId is required' });
    }

    const result = await metroService.recordLocationObservation({
      journeyId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: Number(accuracy) || 10,
      speed: Number(speed) || 0,
      timestamp,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('[MetroController.recordLocation] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 5. End Journey & Run Multi-Factor Verification
 * POST /api/metro/end-journey
 */
exports.endJourney = async (req, res) => {
  try {
    const { journeyId, userLatitude, userLongitude, userAccuracy } = req.body;
    if (!journeyId) {
      return res.status(400).json({ success: false, error: 'journeyId is required' });
    }

    const result = await metroService.endAndVerifyMetroJourney({
      journeyId,
      userLatitude: Number(userLatitude),
      userLongitude: Number(userLongitude),
      userAccuracy: Number(userAccuracy) || 15,
      user: req.user,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('[MetroController.endJourney] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 6. Get Metro Stations List
 * GET /api/metro/stations
 */
exports.getStations = async (req, res) => {
  try {
    await metroService.ensureStationsSeeded();
    const { city = 'Pune', query } = req.query;

    let filter = { city };
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { localName: { $regex: query, $options: 'i' } },
        { stationId: { $regex: query, $options: 'i' } },
      ];
    }

    const stations = await MetroStation.find(filter).sort({ line: 1, name: 1 });
    return res.status(200).json({ success: true, count: stations.length, stations });
  } catch (error) {
    console.error('[MetroController.getStations] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 7. Get Journey Audit Log & Verification Details
 * GET /api/metro/journey/:id
 */
exports.getJourneyDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const details = await metroService.getJourneyAuditLog(id);
    return res.status(200).json(details);
  } catch (error) {
    console.error('[MetroController.getJourneyDetails] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 8. Validate Bus Ticket OCR
 * POST /api/metro/bus/verify-ticket
 */
exports.validateBusTicket = async (req, res) => {
  try {
    const { rawText, parsedData, selectedRoute, originName, destName } = req.body;
    if (!rawText && !parsedData) {
      return res.status(400).json({ success: false, error: 'rawText or parsedData is required for ticket validation' });
    }

    const result = await busTicketService.validateBusTicket({
      rawText,
      parsedData,
      selectedRoute,
      originName,
      destName,
      user: req.user,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('[MetroController.validateBusTicket] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};
