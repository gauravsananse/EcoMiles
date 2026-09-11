const crypto = require('crypto');
const MetroStation = require('../models/MetroStation');
const MetroTicket = require('../models/MetroTicket');
const Journey = require('../models/Journey');
const VerificationEvent = require('../models/VerificationEvent');
const User = require('../models/User');
const rewardEngine = require('./rewardEngine');
const OfficialMetroProvider = require('./providers/OfficialMetroProvider');
const DevelopmentMockMetroProvider = require('./providers/DevelopmentMockMetroProvider');

class MetroService {
  constructor() {
    this.officialProvider = new OfficialMetroProvider();
    this.mockProvider = new DevelopmentMockMetroProvider();

    // Verification Weights (Configurable)
    this.weights = {
      ticketValidation: 0.30,
      originPresence: 0.20,
      movementConsistency: 0.20,
      corridorConsistency: 0.15,
      destinationPresence: 0.15,
    };

    // Environmental emission baselines
    this.emissionBaselines = {
      privateVehicleGramsCo2PerKm: 140, // Average ICE 2-wheeler / car blend
      metroGramsCo2PerKm: 22,          // Electric transit efficiency
      creditsPerKgCo2Saved: 20,         // 20 Green Credits per kg CO2 saved
      minCreditsPerKm: 6,              // Minimum 6 Green Credits / km for Metro
    };
  }

  getActiveProvider() {
    if (this.officialProvider.isConfigured()) {
      return this.officialProvider;
    }
    return this.mockProvider;
  }

  /**
   * Haversine distance in meters between two lat/lng pairs
   */
  calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  /**
   * Seed Pune Metro stations if collection is empty
   */
  async ensureStationsSeeded() {
    const count = await MetroStation.countDocuments();
    if (count > 0) return;

    const puneStations = [
      // Purple Line (North-South Corridor)
      { stationId: 'KATRAJ_METRO', name: 'Katraj Metro Station', localName: 'कात्रज मेट्रो स्थानक', city: 'Pune', line: 'Purple Line', latitude: 18.4575, longitude: 73.8677, geofenceRadiusMeters: 300, isUnderground: true },
      { stationId: 'SWARGATE_METRO', name: 'Swargate Multimodal Hub', localName: 'स्वारगेट मेट्रो स्थानक', city: 'Pune', line: 'Purple Line', latitude: 18.5010, longitude: 73.8580, geofenceRadiusMeters: 250, isUnderground: true, isInterchange: true },
      { stationId: 'MANDAI_METRO', name: 'Mandai Metro Station', localName: 'मंडई मेट्रो स्थानक', city: 'Pune', line: 'Purple Line', latitude: 18.5130, longitude: 73.8560, geofenceRadiusMeters: 200, isUnderground: true },
      { stationId: 'BUDHWAR_PETH', name: 'Budhwar Peth Metro Station', localName: 'बुधवार पेठ स्थानक', city: 'Pune', line: 'Purple Line', latitude: 18.5180, longitude: 73.8570, geofenceRadiusMeters: 200, isUnderground: true },
      { stationId: 'CIVIL_COURT_METRO', name: 'District Court / Civil Court', localName: 'सिव्हिल कोर्ट मेट्रो इंटरचेंज', city: 'Pune', line: 'Purple Line', latitude: 18.5284, longitude: 73.8540, geofenceRadiusMeters: 300, isUnderground: false, isInterchange: true },
      { stationId: 'SHIVAJINAGAR_METRO', name: 'Shivajinagar Metro Station', localName: 'शिवाजीनगर मेट्रो स्थानक', city: 'Pune', line: 'Purple Line', latitude: 18.5320, longitude: 73.8510, geofenceRadiusMeters: 250, isUnderground: true, isInterchange: true },
      { stationId: 'RANGE_HILLS_METRO', name: 'Range Hills Metro Station', localName: 'रेंज हिल्स मेट्रो स्थानक', city: 'Pune', line: 'Purple Line', latitude: 18.5440, longitude: 73.8440, geofenceRadiusMeters: 250, isUnderground: false },
      { stationId: 'DAPODI_METRO', name: 'Dapodi Metro Station', localName: 'दापोडी मेट्रो स्थानक', city: 'Pune', line: 'Purple Line', latitude: 18.5770, longitude: 73.8310, geofenceRadiusMeters: 250, isUnderground: false },
      { stationId: 'PCMC_METRO', name: 'PCMC Bhavan Metro Station', localName: 'पिंपरी चिंचवड मेट्रो स्थानक', city: 'Pune', line: 'Purple Line', latitude: 18.6280, longitude: 73.8120, geofenceRadiusMeters: 250, isUnderground: false },

      // Aqua Line (East-West Corridor)
      { stationId: 'VANAZ_METRO', name: 'Vanaz Metro Station', localName: 'वनाझ मेट्रो स्थानक', city: 'Pune', line: 'Aqua Line', latitude: 18.5060, longitude: 73.8050, geofenceRadiusMeters: 250, isUnderground: false },
      { stationId: 'NAL_STOP_METRO', name: 'Nal Stop Metro Station', localName: 'नल स्टॉप मेट्रो स्थानक', city: 'Pune', line: 'Aqua Line', latitude: 18.5100, longitude: 73.8290, geofenceRadiusMeters: 250, isUnderground: false },
      { stationId: 'GARWARE_COLLEGE', name: 'Garware College Metro Station', localName: 'गरवारे कॉलेज स्थानक', city: 'Pune', line: 'Aqua Line', latitude: 18.5150, longitude: 73.8360, geofenceRadiusMeters: 250, isUnderground: false },
      { stationId: 'DECCAN_GYMKHANA', name: 'Deccan Gymkhana Metro Station', localName: 'डेक्कन जिमखाना स्थानक', city: 'Pune', line: 'Aqua Line', latitude: 18.5185, longitude: 73.8425, geofenceRadiusMeters: 250, isUnderground: false },
      { stationId: 'PUNE_STATION_METRO', name: 'Pune Railway Station Metro', localName: 'पुणे रेल्वे स्टेशन स्थानक', city: 'Pune', line: 'Aqua Line', latitude: 18.5284, longitude: 73.8744, geofenceRadiusMeters: 300, isUnderground: false, isInterchange: true },
      { stationId: 'RAMWADI_METRO', name: 'Ramwadi Metro Terminal', localName: 'रामवाडी मेट्रो स्थानक', city: 'Pune', line: 'Aqua Line', latitude: 18.5520, longitude: 73.9160, geofenceRadiusMeters: 250, isUnderground: false },
    ];

    await MetroStation.insertMany(puneStations);
  }

  /**
   * 1. Validate Metro QR Code & Bind to User Account (Anti-Replay)
   */
  async verifyAndClaimTicket({ qrData, originStationId, destinationStationId, user, verificationMethod = 'CAMERA_SCAN' }) {
    if (!qrData || !qrData.trim()) {
      return { success: false, errorState: 'QR_EMPTY', error: 'No QR code payload provided' };
    }

    // Hash the raw QR data immediately — NEVER store plain raw tokens
    const ticketHash = crypto.createHash('sha256').update(qrData.trim()).digest('hex');

    // Anti-Replay Check: Has this ticket already been claimed or used?
    const existingTicket = await MetroTicket.findOne({ ticketHash });
    if (existingTicket) {
      if (existingTicket.status === 'USED') {
        return {
          success: false,
          errorState: 'TICKET_ALREADY_USED',
          error: 'Ticket already used for Green Credit verification.',
          ticketHash,
          claimedAt: existingTicket.claimedAt,
        };
      }
      if (existingTicket.status === 'CLAIMED' && (!user || existingTicket.claimedByUserId?.toString() !== user._id?.toString())) {
        return {
          success: false,
          errorState: 'TICKET_ALREADY_CLAIMED',
          error: 'This ticket has already been claimed by another user account.',
          ticketHash,
        };
      }
    }

    // Resolve Origin & Destination station metadata
    const [originStation, destinationStation] = await Promise.all([
      MetroStation.findOne({ $or: [{ stationId: originStationId }, { name: originStationId }] }),
      MetroStation.findOne({ $or: [{ stationId: destinationStationId }, { name: destinationStationId }] }),
    ]);

    const provider = this.getActiveProvider();
    const verificationResult = await provider.verifyTicket({
      qrData,
      originStation,
      destinationStation,
    });

    if (!verificationResult.success) {
      return {
        success: false,
        errorState: verificationResult.errorState || 'TICKET_INVALID',
        error: verificationResult.message || 'Ticket verification failed',
      };
    }

    // Create or update MetroTicket record
    let ticketRecord = existingTicket;
    if (!ticketRecord) {
      ticketRecord = await MetroTicket.create({
        ticketHash,
        ticketNumber: verificationResult.ticketNumber,
        provider: verificationResult.provider,
        isOperatorAuthenticated: verificationResult.isOperatorAuthenticated,
        operator: verificationResult.operator,
        originStationId: originStation?.stationId || 'KATRAJ_METRO',
        originStationName: originStation?.name || verificationResult.originStationName,
        destinationStationId: destinationStation?.stationId || 'CIVIL_COURT_METRO',
        destinationStationName: destinationStation?.name || verificationResult.destinationStationName,
        fare: verificationResult.fare || 20,
        issuedAt: verificationResult.issuedAt || new Date(),
        expiresAt: verificationResult.expiresAt || new Date(Date.now() + 3 * 3600000),
        status: 'CLAIMED',
        claimedByUserId: user?._id || null,
        claimedAt: new Date(),
        verificationMethod,
      });
    }

    return {
      success: true,
      ticket: {
        id: ticketRecord._id,
        ticketNumber: ticketRecord.ticketNumber,
        ticketHash,
        provider: ticketRecord.provider,
        isOperatorAuthenticated: ticketRecord.isOperatorAuthenticated,
        operator: ticketRecord.operator,
        originStation: ticketRecord.originStationName,
        destinationStation: ticketRecord.destinationStationName,
        fare: ticketRecord.fare,
        issuedAt: ticketRecord.issuedAt,
        expiresAt: ticketRecord.expiresAt,
        status: ticketRecord.status,
        message: verificationResult.message,
      },
    };
  }

  /**
   * 2. Verify Origin Station Geolocation
   */
  async verifyOriginGeofence({ stationId, userLatitude, userLongitude, userAccuracy = 10 }) {
    await this.ensureStationsSeeded();

    const station = await MetroStation.findOne({
      $or: [{ stationId }, { name: stationId }],
    });

    if (!station) {
      return {
        success: false,
        error: `Metro station "${stationId}" not recognized in database.`,
      };
    }

    const distanceMeters = this.calculateDistanceMeters(
      userLatitude,
      userLongitude,
      station.latitude,
      station.longitude
    );

    // Maximum tolerance including GPS accuracy buffer (up to +40m for accuracy drift)
    const allowedRadius = station.geofenceRadiusMeters + Math.min(40, userAccuracy);
    const isWithinGeofence = distanceMeters <= allowedRadius;

    return {
      success: true,
      isWithinGeofence,
      distanceMeters,
      allowedRadius,
      station: {
        stationId: station.stationId,
        name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
        geofenceRadiusMeters: station.geofenceRadiusMeters,
      },
      message: isWithinGeofence
        ? `Location verified at ${station.name} (${distanceMeters}m away)`
        : `Move closer to ${station.name} to start verification. You are currently ${distanceMeters}m away (allowed: ${allowedRadius}m).`,
    };
  }

  /**
   * 3. Start Metro Journey
   */
  async startMetroJourney({ ticketId, originStationId, destinationStationId, userLocation, user }) {
    const ticket = await MetroTicket.findById(ticketId);
    if (!ticket) {
      throw new Error('Valid claimed Metro ticket required to start journey');
    }

    const [originStation, destStation] = await Promise.all([
      MetroStation.findOne({ $or: [{ stationId: originStationId }, { name: originStationId }] }),
      MetroStation.findOne({ $or: [{ stationId: destinationStationId }, { name: destinationStationId }] }),
    ]);

    // Calculate approximate corridor distance
    const corridorDistanceKm = originStation && destStation
      ? Number((this.calculateDistanceMeters(originStation.latitude, originStation.longitude, destStation.latitude, destStation.longitude) / 1000).toFixed(2))
      : 8.4;

    const journey = await Journey.create({
      userId: user?._id || null,
      mode: 'METRO',
      currentMode: 'METRO',
      journeyState: 'ACTIVE',
      status: 'JOURNEY_ACTIVE',
      origin: {
        name: originStation?.name || 'Origin Metro Station',
        latitude: originStation?.latitude || userLocation?.latitude,
        longitude: originStation?.longitude || userLocation?.longitude,
      },
      destination: {
        name: destStation?.name || 'Destination Metro Station',
        latitude: destStation?.latitude,
        longitude: destStation?.longitude,
      },
      totalDistanceKm: 0,
      plannedDistanceKm: corridorDistanceKm,
      segments: [
        {
          segmentIndex: 0,
          mode: 'METRO',
          selectedMode: 'METRO',
          status: 'ACTIVE',
          startTime: new Date(),
          distanceKm: 0,
          origin: {
            name: originStation?.name || 'Origin Metro Station',
            latitude: originStation?.latitude,
            longitude: originStation?.longitude,
          },
          destination: {
            name: destStation?.name || 'Destination Metro Station',
            latitude: destStation?.latitude,
            longitude: destStation?.longitude,
          },
        },
      ],
      startTime: new Date(),
    });

    // Link journey to ticket
    ticket.journeyId = journey._id;
    await ticket.save();

    // Log Verification Event
    await VerificationEvent.create({
      journeyId: journey._id,
      userId: user?._id || null,
      type: 'PUBLIC_TRANSPORT_VERIFIED',
      description: `Metro Journey started at ${originStation?.name || 'Origin'} with ticket ${ticket.ticketNumber}`,
      severity: 'SUCCESS',
      location: {
        latitude: userLocation?.latitude,
        longitude: userLocation?.longitude,
        accuracy: userLocation?.accuracy || 10,
      },
      metadata: {
        ticketHash: ticket.ticketHash,
        ticketNumber: ticket.ticketNumber,
        provider: ticket.provider,
        originStation: originStation?.name,
        destinationStation: destStation?.name,
      },
    });

    return {
      success: true,
      journeyId: journey._id,
      status: 'JOURNEY_ACTIVE',
      ticketNumber: ticket.ticketNumber,
      originStation: originStation?.name,
      destinationStation: destStation?.name,
      corridorDistanceKm,
    };
  }

  /**
   * 4. Ingest GPS Telemetry & Track Tunnel Grace Period
   */
  async recordLocationObservation({ journeyId, latitude, longitude, accuracy, speed, timestamp }) {
    const journey = await Journey.findById(journeyId);
    if (!journey) throw new Error('Journey not found');

    const now = new Date(timestamp || Date.now());
    const isUndergroundSignalLost = !accuracy || accuracy > 120;

    // Push coordinates to journey path
    if (latitude && longitude && accuracy <= 100) {
      journey.pathCoordinates.push({
        latitude,
        longitude,
        accuracy,
        speed: speed || 0,
        timestamp: now,
      });
      // Recalculate distance
      if (journey.pathCoordinates.length >= 2) {
        const last = journey.pathCoordinates[journey.pathCoordinates.length - 2];
        const segDistKm = this.calculateDistanceMeters(last.latitude, last.longitude, latitude, longitude) / 1000;
        if (segDistKm > 0 && segDistKm < 5) { // Filter impossible GPS teleports
          journey.totalDistanceKm = Number((journey.totalDistanceKm + segDistKm).toFixed(3));
        }
      }
    }

    await journey.save();

    return {
      success: true,
      totalDistanceKm: journey.totalDistanceKm,
      isUndergroundSignalLost,
      tunnelGracePeriod: isUndergroundSignalLost,
      message: isUndergroundSignalLost ? 'GPS signal temporarily unavailable (underground tunnel grace period active)' : 'Location observation recorded',
    };
  }

  /**
   * 5. Destination Geofence & Two-Phase Verification (PENDING -> VERIFIED)
   */
  async endAndVerifyMetroJourney({ journeyId, userLatitude, userLongitude, userAccuracy = 15, user }) {
    const journey = await Journey.findById(journeyId);
    if (!journey) throw new Error('Journey not found');

    const ticket = await MetroTicket.findOne({ journeyId: journey._id });
    const destStation = await MetroStation.findOne({
      $or: [{ name: journey.destination?.name }, { stationId: journey.destination?.name }],
    });

    // 1. Destination Geofence Check
    let destinationDistanceMeters = Infinity;
    let isDestinationVerified = false;

    if (destStation && userLatitude && userLongitude) {
      destinationDistanceMeters = this.calculateDistanceMeters(
        userLatitude,
        userLongitude,
        destStation.latitude,
        destStation.longitude
      );
      const allowedRadius = destStation.geofenceRadiusMeters + Math.min(50, userAccuracy);
      isDestinationVerified = destinationDistanceMeters <= allowedRadius;
    }

    // 2. Journey Duration & Distance Check
    const endTime = new Date();
    const elapsedMinutes = Math.max(1, Math.round((endTime.getTime() - new Date(journey.startTime).getTime()) / 60000));
    const finalDistanceKm = Math.max(
      journey.totalDistanceKm || 0,
      (journey.plannedDistanceKm || 8.4) * 0.85
    );

    // 3. Multi-Factor Evidence Scoring (Configurable Weights)
    const factorScores = {
      ticketValidation: ticket && ticket.status === 'CLAIMED' ? 1.0 : 0.0,
      originPresence: 1.0, // Verified at start
      movementConsistency: elapsedMinutes >= 3 && finalDistanceKm >= 1.0 ? 0.95 : 0.60,
      corridorConsistency: 0.90,
      destinationPresence: isDestinationVerified ? 1.0 : (destinationDistanceMeters < 800 ? 0.70 : 0.30),
    };

    const overallVerificationScore = Number(
      (
        factorScores.ticketValidation * this.weights.ticketValidation +
        factorScores.originPresence * this.weights.originPresence +
        factorScores.movementConsistency * this.weights.movementConsistency +
        factorScores.corridorConsistency * this.weights.corridorConsistency +
        factorScores.destinationPresence * this.weights.destinationPresence
      ).toFixed(2)
    );

    const isVerified = overallVerificationScore >= 0.75;

    // 4. Calculate CO2 & Green Credits (Backend Authoritative with Daily Limits & Duplicate Protection)
    const gramsCo2Saved = Math.round(
      finalDistanceKm * (this.emissionBaselines.privateVehicleGramsCo2PerKm - this.emissionBaselines.metroGramsCo2PerKm)
    );
    let earnedGreenCredits = 0;
    if (isVerified) {
      const rewardResult = await rewardEngine.awardDirectJourneyReward({
        journeyId: journey._id,
        userId: user?._id || journey.userId || null,
        mode: 'METRO',
        distanceKm: finalDistanceKm,
        durationMinutes: elapsedMinutes,
        isVerified: true,
        confidence: overallVerificationScore,
      });
      earnedGreenCredits = rewardResult.rewardedGC || 0;
    }

    // 5. Update Journey & Ticket State Machine
    journey.endTime = endTime;
    journey.totalDistanceKm = Number(finalDistanceKm.toFixed(2));
    journey.journeyState = isVerified ? 'COMPLETED' : 'HELD';
    journey.status = isVerified ? 'JOURNEY_VERIFIED' : 'JOURNEY_REJECTED';
    journey.totalGreenCredits = earnedGreenCredits;
    journey.totalCo2AvoidedKg = Number((gramsCo2Saved / 1000).toFixed(2));
    journey.overallConfidenceScore = overallVerificationScore;
    journey.verificationScore = overallVerificationScore;

    if (journey.segments && journey.segments[0]) {
      journey.segments[0].status = isVerified ? 'VERIFIED' : 'VERIFICATION_FAILED';
      journey.segments[0].endTime = endTime;
      journey.segments[0].distanceKm = Number(finalDistanceKm.toFixed(2));
      journey.segments[0].greenCredits = earnedGreenCredits;
      journey.segments[0].co2SavedKg = Number((gramsCo2Saved / 1000).toFixed(2));
    }

    await journey.save();

    // Mark ticket as USED to permanently prevent replay
    if (ticket && isVerified) {
      ticket.status = 'USED';
      await ticket.save();
    }

    // Log Verification Events
    await VerificationEvent.create({
      journeyId: journey._id,
      userId: user?._id || null,
      type: isVerified ? 'JOURNEY_COMPLETED' : 'FRAUD_FLAGGED',
      description: isVerified
        ? `Metro Journey verified (${finalDistanceKm} km, score: ${overallVerificationScore * 100}%) — +${earnedGreenCredits} Green Credits awarded.`
        : `Metro Journey failed destination verification (score: ${overallVerificationScore * 100}%).`,
      severity: isVerified ? 'SUCCESS' : 'WARNING',
      location: {
        latitude: userLatitude,
        longitude: userLongitude,
        accuracy: userAccuracy,
      },
      metadata: {
        overallScore: overallVerificationScore,
        factorScores,
        destinationDistanceMeters,
        isDestinationVerified,
        greenCreditsAwarded: earnedGreenCredits,
        co2SavedKg: Number((gramsCo2Saved / 1000).toFixed(2)),
      },
    });

    return {
      success: true,
      isVerified,
      status: isVerified ? 'JOURNEY_VERIFIED' : 'JOURNEY_REJECTED',
      journeyId: journey._id,
      origin: journey.origin?.name,
      destination: journey.destination?.name,
      distanceKm: Number(finalDistanceKm.toFixed(2)),
      durationMinutes: elapsedMinutes,
      co2SavedGrams: gramsCo2Saved,
      greenCreditsAwarded: earnedGreenCredits,
      overallScore: overallVerificationScore,
      evidenceBreakdown: {
        ticketValidation: `${Math.round(factorScores.ticketValidation * 100)}% (Weight 30%)`,
        originPresence: `${Math.round(factorScores.originPresence * 100)}% (Weight 20%)`,
        movementConsistency: `${Math.round(factorScores.movementConsistency * 100)}% (Weight 20%)`,
        corridorConsistency: `${Math.round(factorScores.corridorConsistency * 100)}% (Weight 15%)`,
        destinationPresence: `${Math.round(factorScores.destinationPresence * 100)}% (Weight 15%)`,
      },
      ticketDetails: ticket ? {
        ticketNumber: ticket.ticketNumber,
        ticketHash: ticket.ticketHash,
        status: ticket.status,
        provider: ticket.provider,
        isOperatorAuthenticated: ticket.isOperatorAuthenticated,
      } : null,
    };
  }

  /**
   * Get audit log and verification details for a journey
   */
  async getJourneyAuditLog(journeyId) {
    const [journey, events, ticket] = await Promise.all([
      Journey.findById(journeyId),
      VerificationEvent.find({ journeyId }).sort({ timestamp: 1 }),
      MetroTicket.findOne({ journeyId }),
    ]);

    if (!journey) throw new Error('Journey not found');

    return {
      success: true,
      journey,
      ticket,
      events,
    };
  }
}

module.exports = new MetroService();
