/**
 * Transit Service
 * Manages public transport stops, routes, arrival schedules, and multimodal transit search.
 * Supports real transit feeds and realistic prototype Indian transit data.
 */

const TransitStop = require('../models/TransitStop');
const PublicTransportRoute = require('../models/PublicTransportRoute');
const publicTransportRouteService = require('./publicTransportRouteService');

class TransitService {
  constructor() {
    this.hasSeededStops = false;
  }

  /**
   * Calculate Haversine distance in meters
   */
  haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Seed default prototype Indian transit stops
   */
  async ensureTransitStopsSeeded() {
    if (this.hasSeededStops) return;

    try {
      const count = await TransitStop.countDocuments();
      if (count === 0) {
        await TransitStop.create([
          {
            stopId: 'STN-PUNE-01',
            name: 'Pune Station Terminal',
            city: 'Pune',
            operator: 'PMPML City Transport',
            latitude: 18.5284,
            longitude: 73.8744,
            routes: [
              { routeId: '103', routeName: 'Route 103 — Pune Station ⇄ Hinjewadi Phase 3', mode: 'BUS', direction: 'Hinjewadi IT Park', intervalMinutes: 8 },
              { routeId: '104', routeName: 'Route 104 — Shivajinagar ⇄ Aundh / Baner', mode: 'BUS', direction: 'Baner Balewadi', intervalMinutes: 12 },
              { routeId: '125', routeName: 'Route 125 — Pune Station ⇄ Katraj', mode: 'BUS', direction: 'Katraj Snake Park', intervalMinutes: 10 },
            ],
            isSampleData: true,
          },
          {
            stopId: 'STN-SHIV-02',
            name: 'Shivajinagar Bus Stand',
            city: 'Pune',
            operator: 'PMPML City Transport',
            latitude: 18.5312,
            longitude: 73.8567,
            routes: [
              { routeId: '103', routeName: 'Route 103 — Pune Station ⇄ Hinjewadi Phase 3', mode: 'BUS', direction: 'Hinjewadi IT Park', intervalMinutes: 8 },
              { routeId: '104', routeName: 'Route 104 — Shivajinagar ⇄ Aundh / Baner', mode: 'BUS', direction: 'Baner Balewadi', intervalMinutes: 10 },
              { routeId: 'METRO-LINE-1', routeName: 'Purple Line — PCMC ⇄ Swargate Metro', mode: 'METRO', direction: 'Swargate', intervalMinutes: 6 },
            ],
            isSampleData: true,
          },
          {
            stopId: 'STN-UNIV-03',
            name: 'Savitribai Phule University Gate',
            city: 'Pune',
            operator: 'PMPML City Transport',
            latitude: 18.5415,
            longitude: 73.8340,
            routes: [
              { routeId: '103', routeName: 'Route 103 — Pune Station ⇄ Hinjewadi Phase 3', mode: 'BUS', direction: 'Hinjewadi IT Park', intervalMinutes: 8 },
              { routeId: '104', routeName: 'Route 104 — Shivajinagar ⇄ Aundh / Baner', mode: 'BUS', direction: 'Baner Balewadi', intervalMinutes: 12 },
            ],
            isSampleData: true,
          },
          {
            stopId: 'STN-AUNDH-04',
            name: 'Aundh Gaon Stop',
            city: 'Pune',
            operator: 'PMPML City Transport',
            latitude: 18.5601,
            longitude: 73.8055,
            routes: [
              { routeId: '103', routeName: 'Route 103 — Pune Station ⇄ Hinjewadi Phase 3', mode: 'BUS', direction: 'Hinjewadi IT Park', intervalMinutes: 8 },
            ],
            isSampleData: true,
          },
          {
            stopId: 'STN-WAKAD-05',
            name: 'Wakad Highway Bridge',
            city: 'Pune',
            operator: 'PMPML City Transport',
            latitude: 18.5812,
            longitude: 73.7645,
            routes: [
              { routeId: '103', routeName: 'Route 103 — Pune Station ⇄ Hinjewadi Phase 3', mode: 'BUS', direction: 'Hinjewadi IT Park', intervalMinutes: 8 },
            ],
            isSampleData: true,
          },
          {
            stopId: 'STN-HINJ-06',
            name: 'Hinjewadi Shivaji Chowk Phase 1',
            city: 'Pune',
            operator: 'PMPML City Transport',
            latitude: 18.5915,
            longitude: 73.7380,
            routes: [
              { routeId: '103', routeName: 'Route 103 — Pune Station ⇄ Hinjewadi Phase 3', mode: 'BUS', direction: 'Hinjewadi IT Park', intervalMinutes: 8 },
            ],
            isSampleData: true,
          },
          {
            stopId: 'STN-HINJ-07',
            name: 'Megapolis Phase 3 Terminal',
            city: 'Pune',
            operator: 'PMPML City Transport',
            latitude: 18.5985,
            longitude: 73.7120,
            routes: [
              { routeId: '103', routeName: 'Route 103 — Pune Station ⇄ Hinjewadi Phase 3', mode: 'BUS', direction: 'Hinjewadi IT Park', intervalMinutes: 8 },
            ],
            isSampleData: true,
          },
        ]);
        console.log('[TransitService] Seeded Indian prototype transit stops.');
      }
      this.hasSeededStops = true;
    } catch (err) {
      console.warn('[TransitService] Stop seed check skipped:', err.message);
    }
  }

  /**
   * Find nearby transit stops sorted by walking distance
   */
  async getNearbyStops(latitude, longitude, radiusMeters = 3000) {
    await this.ensureTransitStopsSeeded();

    const stops = await TransitStop.find({ isActive: true });
    const nearby = [];

    for (const stop of stops) {
      const dist = this.haversineMeters(latitude, longitude, stop.latitude, stop.longitude);
      if (dist <= radiusMeters) {
        const walkMin = Math.max(1, Math.round(dist / 80)); // ~80m per minute walking speed
        nearby.push({
          stopId: stop.stopId,
          name: stop.name,
          city: stop.city,
          operator: stop.operator,
          latitude: stop.latitude,
          longitude: stop.longitude,
          distanceMeters: Math.round(dist),
          walkTimeMinutes: walkMin,
          routes: stop.routes || [],
        });
      }
    }

    nearby.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return nearby;
  }

  /**
   * Get upcoming arrivals for a stop with scheduled/estimated status
   */
  async getUpcomingArrivals(stopId) {
    await this.ensureTransitStopsSeeded();

    const stop = await TransitStop.findOne({ stopId, isActive: true });
    if (!stop) return [];

    const now = new Date();
    const arrivals = [];

    for (const rt of stop.routes || []) {
      const interval = rt.intervalMinutes || 10;
      // Generate upcoming arrival times based on interval
      const nextMins1 = (Math.floor(now.getMinutes() / interval) + 1) * interval - now.getMinutes();
      const nextMins2 = nextMins1 + interval;

      arrivals.push({
        routeId: rt.routeId,
        busNumber: rt.routeId.replace('ROUTE-', ''),
        routeName: rt.routeName,
        direction: rt.direction || 'City Transit',
        mode: rt.mode || 'BUS',
        operator: stop.operator,
        etaMinutes: nextMins1 <= 0 ? interval : nextMins1,
        nextEtaMinutes: nextMins2,
        status: 'SCHEDULED', // Clearly labeled: SCHEDULED | ESTIMATED | LIVE | DEMO
        statusLabel: 'Scheduled — Prototype Transit Data',
        isAccessible: true,
      });
    }

    arrivals.sort((a, b) => a.etaMinutes - b.etaMinutes);
    return arrivals;
  }

  /**
   * Search Multimodal Transit Itineraries (Walk -> Bus/Metro -> Walk)
   */
  async searchRoutes(originQuery, destinationQuery, userLat = 18.5284, userLng = 73.8744) {
    await this.ensureTransitStopsSeeded();
    await publicTransportRouteService.ensureSampleRoutesSeeded();

    const allRoutes = await PublicTransportRoute.find({ isActive: true });
    const nearbyStops = await this.getNearbyStops(userLat, userLng, 4000);

    const itineraries = [];

    for (const route of allRoutes) {
      const stops = route.stops || [];
      if (stops.length < 2) continue;

      const firstStop = stops[0];
      const lastStop = stops[stops.length - 1];

      // Calculate walking distances
      const walkToFirstStopMeters = Math.round(this.haversineMeters(userLat, userLng, firstStop.latitude, firstStop.longitude));
      const walkToFirstStopMin = Math.max(2, Math.round(walkToFirstStopMeters / 80));

      const transitDistanceKm = Number((route.geometry.length * 1.4).toFixed(1));
      const transitDurationMin = Math.max(15, Math.round(transitDistanceKm * 3.2));
      const walkFromFinalStopMeters = 400;
      const walkFromFinalStopMin = 5;

      const totalDurationMin = walkToFirstStopMin + transitDurationMin + walkFromFinalStopMin;
      const totalDistanceKm = Number((walkToFirstStopMeters / 1000 + transitDistanceKm + walkFromFinalStopMeters / 1000).toFixed(1));

      // Calculate Green Credits for this transit route
      const estimatedGreenCredits = Math.round(transitDistanceKm * 2.2);

      const now = new Date();
      const formatClock = (minsToAdd) => {
        const d = new Date(now.getTime() + minsToAdd * 60000);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      };

      itineraries.push({
        itineraryId: `ITIN-${route.routeId}`,
        routeId: route.routeId,
        mode: route.mode || 'BUS',
        name: route.name,
        shortName: route.shortName || route.routeId,
        operator: route.operator,
        originName: originQuery || 'Current Location',
        destinationName: destinationQuery || lastStop.name,
        totalDurationMinutes: totalDurationMin,
        totalDistanceKm,
        transfers: 0,
        estimatedGreenCredits,
        firstStop: {
          stopId: firstStop.stopId,
          name: firstStop.name,
          distanceMeters: walkToFirstStopMeters,
          walkTimeMinutes: walkToFirstStopMin,
        },
        lastStop: {
          stopId: lastStop.stopId,
          name: lastStop.name,
        },
        steps: [
          {
            stepIndex: 1,
            type: 'WALK',
            instruction: `Walk ${walkToFirstStopMeters}m to ${firstStop.name}`,
            distanceMeters: walkToFirstStopMeters,
            durationMinutes: walkToFirstStopMin,
            startTimeText: formatClock(0),
            endTimeText: formatClock(walkToFirstStopMin),
          },
          {
            stepIndex: 2,
            type: route.mode || 'BUS',
            instruction: `Board ${route.shortName || route.name} towards ${route.direction}`,
            routeId: route.routeId,
            routeName: route.name,
            fromStop: firstStop.name,
            toStop: lastStop.name,
            distanceKm: transitDistanceKm,
            durationMinutes: transitDurationMin,
            startTimeText: formatClock(walkToFirstStopMin + 3),
            endTimeText: formatClock(walkToFirstStopMin + 3 + transitDurationMin),
          },
          {
            stepIndex: 3,
            type: 'WALK',
            instruction: `Walk ${walkFromFinalStopMeters}m to ${destinationQuery || 'Destination'}`,
            distanceMeters: walkFromFinalStopMeters,
            durationMinutes: walkFromFinalStopMin,
            startTimeText: formatClock(walkToFirstStopMin + 3 + transitDurationMin),
            endTimeText: formatClock(totalDurationMin),
          },
        ],
        geometry: route.geometry,
      });
    }

    return itineraries;
  }
}

module.exports = new TransitService();
