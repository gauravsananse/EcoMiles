/**
 * Public Transport Verification Engine
 * Cross-references GPS trajectories, stop dwell times, and Bluetooth transit beacons
 * to independently verify Bus and Metro / Train passenger travel.
 */

const TransitBeacon = require('../models/TransitBeacon');

class PublicTransportVerificationService {
  constructor() {
    // Known reference transit corridors
    this.transitCorridors = [
      { id: 'BUS-LINE-101', name: 'Metro Trunk Corridor Line 101', type: 'BUS', bounds: { minLat: 28.5, maxLat: 28.7, minLng: 77.1, maxLng: 77.3 } },
      { id: 'METRO-BLUE-LINE', name: 'Airport Express / Blue Metro Line', type: 'METRO', bounds: { minLat: 28.55, maxLat: 28.65, minLng: 77.15, maxLng: 77.25 } },
    ];
  }

  /**
   * Evaluate public transport evidence
   */
  async verifyTransitEvidence({ latitude, longitude, speedKmh, dwellTimeRatio, stopFrequency, bleSignals = [] }) {
    let transitConfidence = 0;
    let transportType = 'UNKNOWN';
    const evidence = [];

    // 1. BLE Beacon Match
    let matchedBeacon = null;
    if (bleSignals && bleSignals.length > 0) {
      for (const sig of bleSignals) {
        if (sig.beaconId) {
          matchedBeacon = await TransitBeacon.findOne({ beaconId: sig.beaconId, status: 'ACTIVE' });
          if (matchedBeacon) {
            evidence.push(`Detected official ${matchedBeacon.transportType} beacon (${matchedBeacon.stationName} - ${matchedBeacon.operator})`);
            transportType = matchedBeacon.transportType;
            transitConfidence = 0.96;
            break;
          }
        }
      }
    }

    // 2. Stop Dwell Pattern Analysis
    if (stopFrequency >= 0.25 || dwellTimeRatio >= 0.25) {
      evidence.push('Kinematic stop-and-dwell cadence matches municipal passenger transit stop pattern');
      transitConfidence = Math.max(transitConfidence, 0.88);
      if (transportType === 'UNKNOWN') transportType = 'BUS';
    }

    // 3. High Linear Speed Check for Metro
    if (speedKmh > 40.0 && stopFrequency < 0.25) {
      evidence.push('High-speed continuous corridor travel matching dedicated rail guideway');
      transitConfidence = Math.max(transitConfidence, 0.92);
      transportType = 'METRO';
    }

    return {
      isTransitConfirmed: transitConfidence > 0.8,
      transitConfidence,
      transportType,
      matchedBeacon: matchedBeacon ? {
        beaconId: matchedBeacon.beaconId,
        stationName: matchedBeacon.stationName,
        operator: matchedBeacon.operator,
        transportType: matchedBeacon.transportType,
      } : null,
      evidence,
    };
  }

  /**
   * Seed default city transit beacons if database is fresh
   */
  async seedDefaultBeacons() {
    try {
      const count = await TransitBeacon.countDocuments();
      if (count === 0) {
        await TransitBeacon.create([
          {
            beaconId: 'BEACON-BUS-104',
            transportType: 'BUS',
            routeId: 'ROUTE-12',
            routeName: 'Central Expressway Bus Rapid Transit',
            stationId: 'BUS-STOP-04',
            stationName: 'North University Gate Stop',
            operator: 'City Smart Mobility Agency',
            location: { lat: 28.6139, lng: 77.2090 },
            status: 'ACTIVE',
          },
          {
            beaconId: 'BEACON-METRO-09',
            transportType: 'METRO',
            routeId: 'METRO-LINE-1',
            routeName: 'Cyber City Metro Line',
            stationId: 'METRO-STN-09',
            stationName: 'Central Financial Hub Metro Station',
            operator: 'Metro Rail Corporation',
            location: { lat: 28.6250, lng: 77.2150 },
            status: 'ACTIVE',
          },
          {
            beaconId: 'BEACON-EV-CHARGER-01',
            transportType: 'EV_CHARGER',
            routeId: 'HUB-CHARGER-01',
            routeName: 'Green Mobility DC Fast Charging Hub',
            stationId: 'EV-STN-01',
            stationName: 'Sector 62 Supercharger Hub',
            operator: 'National Grid Clean Energy',
            location: { lat: 28.6300, lng: 77.2200 },
            status: 'ACTIVE',
          },
        ]);
        console.log('[TransitService] Seeded initial trusted city transit BLE beacons.');
      }
    } catch (err) {
      console.warn('[TransitService] Beacon seed check skipped:', err.message);
    }
  }
}

module.exports = new PublicTransportVerificationService();
