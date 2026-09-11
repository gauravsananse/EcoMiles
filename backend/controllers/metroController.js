const mongoose = require('mongoose');
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
    const { rawText, parsedData, selectedRoute, originName, destName, passengerCount } = req.body;
    if (!rawText && !parsedData) {
      return res.status(400).json({ success: false, error: 'rawText or parsedData is required for ticket validation' });
    }

    const result = await busTicketService.validateBusTicket({
      rawText,
      parsedData,
      selectedRoute,
      originName,
      destName,
      passengerCount,
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

/**
 * 9. Claim a remaining passenger slot on a shared bus ticket.
 * The primary ticket holder shares the generated code; each signed-in friend
 * can claim one slot and then start their own verified public journey.
 */
exports.joinSharedBusTicket = async (req, res) => {
  try {
    const { joinCode } = req.body;
    if (!req.user?._id) {
      return res.status(401).json({ success: false, error: 'Sign in to join a shared bus ticket.' });
    }
    if (!joinCode || !String(joinCode).trim()) {
      return res.status(400).json({ success: false, error: 'A valid join code is required.' });
    }

    const MetroTicket = require('../models/MetroTicket');
    const code = String(joinCode).trim().toUpperCase();
    const userId = req.user._id;
    const ticket = await MetroTicket.findOneAndUpdate(
      {
        joinCode: code,
        expiresAt: { $gt: new Date() },
        joinedPassengerUserIds: { $ne: userId },
        $expr: { $lt: ['$passengerSlotsUsed', '$passengerCapacity'] },
      },
      {
        $inc: { passengerSlotsUsed: 1 },
        $addToSet: { joinedPassengerUserIds: userId },
      },
      { new: true }
    );

    if (!ticket) {
      const existing = await MetroTicket.findOne({ joinCode: code });
      const error = !existing
        ? 'This join code is invalid.'
        : existing.joinedPassengerUserIds?.some((id) => id.equals(userId))
          ? 'You have already joined this ticket.'
          : existing.passengerSlotsUsed >= existing.passengerCapacity
            ? 'All passenger slots for this ticket have been claimed.'
            : 'This ticket has expired.';
      return res.status(400).json({ success: false, error });
    }

    return res.status(200).json({
      success: true,
      message: 'Passenger slot claimed. You can now start your verified bus journey.',
      ticket: {
        _id: ticket._id,
        ticketNumber: ticket.ticketNumber,
        operator: ticket.operator,
        busNumber: ticket.verificationMetadata?.busNumber || '',
        fare: ticket.fare,
        passengerCapacity: ticket.passengerCapacity,
        passengerSlotsUsed: ticket.passengerSlotsUsed,
      },
    });
  } catch (error) {
    console.error('[MetroController.joinSharedBusTicket] Error:', error.message);
    return res.status(500).json({ success: false, error: 'Unable to join this shared ticket.' });
  }
};

/**
 * 9. Link verified ticket to active journey
 * POST /api/metro/link-ticket
 */
exports.linkTicketToJourney = async (req, res) => {
  try {
    const { journeyId, ticketId, ticketNumber, operator } = req.body;
    if (!journeyId) {
      return res.status(200).json({ success: true, message: 'Ticket noted' });
    }

    const Journey = require('../models/Journey');
    const MetroTicket = require('../models/MetroTicket');

    const journey = await Journey.findById(journeyId);
    if (journey) {
      if (journey.segments && journey.segments.length > 0) {
        const seg = journey.segments[journey.segments.length - 1];
        seg.verificationStatus = 'VERIFIED';
        seg.greenCreditEligible = true;
        if (!seg.evidence) seg.evidence = [];
        seg.evidence.push(`Bus ticket verified: #${ticketNumber || ticketId} (${operator || 'PMPML'})`);
      }
      journey.journeyState = 'PUBLIC_TRANSPORT_VERIFIED';
      await journey.save();
    }

    if (ticketId && mongoose.isValidObjectId(ticketId)) {
      await MetroTicket.findByIdAndUpdate(ticketId, {
        journeyId,
        status: 'CLAIMED',
        claimedAt: new Date(),
      }).catch(() => {});
    }

    return res.status(200).json({ success: true, message: 'Ticket successfully attached to journey' });
  } catch (error) {
    console.error('[MetroController.linkTicketToJourney] Error:', error.message);
    return res.status(200).json({ success: true, message: 'Logged' });
  }
};
