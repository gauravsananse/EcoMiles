const mongoose = require('mongoose');
const Journey = require('../models/Journey');

// Standard 6 AM – 9 PM time buckets required by specification
const HOURLY_BUCKETS = [
  { hour: 6, label: '6 AM' },
  { hour: 7, label: '7 AM' },
  { hour: 8, label: '8 AM' },
  { hour: 9, label: '9 AM' },
  { hour: 10, label: '10 AM' },
  { hour: 11, label: '11 AM' },
  { hour: 12, label: '12 PM' },
  { hour: 13, label: '1 PM' },
  { hour: 14, label: '2 PM' },
  { hour: 15, label: '3 PM' },
  { hour: 16, label: '4 PM' },
  { hour: 17, label: '5 PM' },
  { hour: 18, label: '6 PM' },
  { hour: 19, label: '7 PM' },
  { hour: 20, label: '8 PM' },
  { hour: 21, label: '9 PM' },
];

/**
 * Normalizes travel mode into standard category
 */
function normalizeMode(mode) {
  if (!mode) return 'UNKNOWN';
  const m = mode.toUpperCase();
  if (m === 'WALK' || m === 'WALKING') return 'WALKING';
  if (m === 'CYCLING' || m === 'BICYCLE') return 'CYCLING';
  if (m === 'EV' || m === 'ELECTRIC_VEHICLE') return 'EV';
  if (m === 'BUS' || m === 'METRO' || m === 'PUBLIC_TRANSPORT' || m === 'TRAIN') return 'PUBLIC_TRANSPORT';
  return m;
}

class CityNetworkService {
  /**
   * Main aggregation dispatcher
   */
  async getCityMobilityOverview({
    dateFilter = 'ALL_TIME',
    modeFilter = 'ALL',
    isDemo = false,
  } = {}) {
    const useDemo = Boolean(isDemo && isDemo !== 'false');

    let rawRecords = [];
    if (!useDemo) {
      rawRecords = await this.fetchLiveVerifiedJourneys({ dateFilter, modeFilter });
    }

    const hasLiveRecords = rawRecords.length > 0;
    const isLiveActive = !useDemo && hasLiveRecords;

    // If live data was requested but no verified journeys exist, return clean empty state
    if (!useDemo && !hasLiveRecords) {
      return {
        isDemo: false,
        hasData: false,
        message: 'No verified mobility data available for this period.',
        lastUpdated: new Date().toISOString(),
        filtersApplied: { dateFilter, modeFilter },
        summary: this.getZeroSummary(),
        walking: { activityByTime: this.getEmptyHourlyBuckets(), mostActiveLocations: [] },
        cycling: { activityByTime: this.getEmptyHourlyBuckets(), mostActiveLocations: [] },
        ev: { activityByTime: this.getEmptyHourlyBuckets(), mostActiveLocations: [] },
        publicTransport: { activityByTime: this.getEmptyHourlyBuckets(), mostUsedOrigins: [], mostUsedDestinations: [] },
        environmentalImpact: { totalCo2SavedKg: 0, co2ByMode: [], co2OverTime: [] },
      };
    }

    const journeys = isLiveActive ? rawRecords : this.generateDemoJourneys({ dateFilter, modeFilter });

    const summary = this.computeSummaryCards(journeys);
    const walking = this.computeWalkingAnalysis(journeys);
    const cycling = this.computeCyclingAnalysis(journeys);
    const ev = this.computeEvAnalysis(journeys);
    const publicTransport = this.computePublicTransportAnalysis(journeys);
    const environmentalImpact = this.computeEnvironmentalImpact(journeys, dateFilter);

    return {
      isDemo: !isLiveActive,
      hasData: true,
      cityName: 'Pune Metropolitan Smart Mobility Grid',
      lastUpdated: new Date().toISOString(),
      filtersApplied: { dateFilter, modeFilter },
      summary,
      walking,
      cycling,
      ev,
      publicTransport,
      environmentalImpact,
    };
  }

  /**
   * Fetch verified completed journeys from database
   */
  async fetchLiveVerifiedJourneys({ dateFilter, modeFilter }) {
    try {
      if (mongoose.connection.readyState !== 1) {
        return [];
      }

      const filter = {
        status: 'COMPLETED',
        $or: [
          { overallVerificationStatus: 'VERIFIED' },
          { overallFraudScore: { $lte: 50 }, validationOutcome: { $regex: /VALID/i } },
        ],
      };

      // Date filtering
      const now = new Date();
      if (dateFilter === 'TODAY') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        filter.startTime = { $gte: startOfDay };
      } else if (dateFilter === 'LAST_7_DAYS') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filter.startTime = { $gte: sevenDaysAgo };
      } else if (dateFilter === 'LAST_30_DAYS') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filter.startTime = { $gte: thirtyDaysAgo };
      }

      // Mode filtering
      if (modeFilter && modeFilter !== 'ALL') {
        const norm = modeFilter.toUpperCase();
        if (norm === 'PUBLIC_TRANSPORT') {
          filter.$and = [
            {
              $or: [
                { verifiedMode: { $in: ['PUBLIC_TRANSPORT', 'BUS', 'METRO'] } },
                { currentMode: { $in: ['PUBLIC_TRANSPORT', 'BUS', 'METRO'] } },
                { plannedMode: { $in: ['PUBLIC_TRANSPORT', 'BUS', 'METRO'] } },
              ],
            },
          ];
        } else {
          filter.$and = [
            {
              $or: [
                { verifiedMode: norm },
                { currentMode: norm },
                { plannedMode: norm },
              ],
            },
          ];
        }
      }

      const journeys = await Journey.find(filter)
        .select('userId startTime endTime totalDistanceKm totalCO2Saved totalCo2AvoidedKg plannedMode currentMode verifiedMode origin destination segments')
        .lean()
        .limit(3000);

      return journeys;
    } catch (err) {
      console.error('[CityNetworkService.fetchLiveVerifiedJourneys] Error:', err.message);
      return [];
    }
  }

  getZeroSummary() {
    return {
      totalVerifiedJourneys: 0,
      walkingJourneys: 0,
      cyclingJourneys: 0,
      evJourneys: 0,
      publicTransportJourneys: 0,
      estimatedCo2SavedKg: 0,
    };
  }

  getEmptyHourlyBuckets() {
    return HOURLY_BUCKETS.map((b) => ({
      hour: b.hour,
      time: b.label,
      journeys: 0,
    }));
  }

  /**
   * Generates realistic demo journeys representing Pune Smart City verified movements
   */
  generateDemoJourneys({ dateFilter, modeFilter }) {
    const list = [];
    const baseDate = new Date();

    const sampleODs = [
      { from: 'College Area (COEP/Fergusson)', to: 'Shivajinagar Station Hub', dist: 2.1, mode: 'WALKING' },
      { from: 'University Area Campus', to: 'Model Colony Walkway', dist: 1.6, mode: 'WALKING' },
      { from: 'Market Area (Mandai)', to: 'Pune Railway Station', dist: 1.8, mode: 'WALKING' },
      { from: 'Kothrud Stand', to: 'Deccan Gymkhana', dist: 2.4, mode: 'WALKING' },
      { from: 'Viman Nagar Phoenix', to: 'Kalyani Nagar Joggers Park', dist: 1.5, mode: 'WALKING' },

      { from: 'Aundh Commercial Strip', to: 'Pashan Lake Cycle Track', dist: 3.8, mode: 'CYCLING' },
      { from: 'University Circle', to: 'Senapati Bapat Road', dist: 2.6, mode: 'CYCLING' },
      { from: 'Baner High Street', to: 'Balewadi Stadium Way', dist: 3.2, mode: 'CYCLING' },
      { from: 'Kothrud Vanaz Corner', to: 'Karve Road Canal Path', dist: 2.9, mode: 'CYCLING' },

      { from: 'Hinjewadi Phase 1 Tech Hub', to: 'Hinjewadi Phase 3 SEZ', dist: 5.4, mode: 'EV' },
      { from: 'PCMC Chinchwad Station', to: 'Bhosari MIDC Industrial Hub', dist: 6.2, mode: 'EV' },
      { from: 'Baner Commercial Zone', to: 'Aundh IT Belt', dist: 4.5, mode: 'EV' },
      { from: 'Koregaon Park North Main Rd', to: 'Viman Nagar Airport Road', dist: 5.1, mode: 'EV' },

      { from: 'Swargate Multimodal Terminal', to: 'Pune Railway Station Hub', dist: 5.2, mode: 'PUBLIC_TRANSPORT' },
      { from: 'Katraj Bus Terminal', to: 'Swargate Multimodal Terminal', dist: 6.8, mode: 'PUBLIC_TRANSPORT' },
      { from: 'Hadapsar Magarpatta Hub', to: 'Shivajinagar Station Hub', dist: 8.5, mode: 'PUBLIC_TRANSPORT' },
      { from: 'Kothrud Vanaz Metro Hub', to: 'Civil Court Metro Interchange', dist: 7.1, mode: 'PUBLIC_TRANSPORT' },
      { from: 'PCMC Metro Station', to: 'Shivajinagar Station Hub', dist: 11.2, mode: 'PUBLIC_TRANSPORT' },
    ];

    // Distribute journeys across the 6 AM - 9 PM hours
    const activeHours = [6, 7, 8, 8, 9, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 18, 19, 20, 21];

    let counter = 1;
    // Determine days back according to dateFilter
    let maxDays = 7;
    if (dateFilter === 'TODAY') maxDays = 1;
    else if (dateFilter === 'LAST_30_DAYS') maxDays = 30;

    for (let day = 0; day < maxDays; day++) {
      for (const sample of sampleODs) {
        // Pick 2-3 random hours per sample per day
        for (const hr of activeHours.slice(0, 2)) {
          const startTime = new Date(baseDate.getTime() - day * 24 * 3600 * 1000);
          startTime.setHours(hr, Math.floor(Math.random() * 55), 0, 0);

          // Reusing existing CO2 calculation logic:
          // Walking & Cycling avoid ~180g/km; EV avoids ~110g/km; Transit avoids ~140g/km
          let co2Saved = 0;
          if (sample.mode === 'WALKING' || sample.mode === 'CYCLING') {
            co2Saved = sample.dist * 0.18;
          } else if (sample.mode === 'EV') {
            co2Saved = sample.dist * 0.11;
          } else {
            co2Saved = sample.dist * 0.14;
          }

          list.push({
            _id: `demo_${counter++}`,
            userId: `user_demo_${(counter % 30) + 1}`,
            startTime,
            endTime: new Date(startTime.getTime() + 25 * 60000),
            totalDistanceKm: sample.dist,
            totalCO2Saved: co2Saved,
            totalCo2AvoidedKg: co2Saved,
            verifiedMode: sample.mode,
            currentMode: sample.mode,
            origin: { name: sample.from },
            destination: { name: sample.to },
          });
        }
      }
    }

    // Apply mode filter if not ALL
    return list.filter((j) => {
      if (modeFilter && modeFilter !== 'ALL') {
        const norm = normalizeMode(j.verifiedMode);
        const reqNorm = normalizeMode(modeFilter);
        if (norm !== reqNorm) return false;
      }
      return true;
    });
  }

  /**
   * Computes top summary KPI cards
   */
  computeSummaryCards(journeys) {
    let walkCount = 0;
    let cycleCount = 0;
    let evCount = 0;
    let ptCount = 0;
    let totalCo2 = 0;

    for (const j of journeys) {
      const mode = normalizeMode(j.verifiedMode || j.currentMode || j.plannedMode);
      if (mode === 'WALKING') walkCount++;
      else if (mode === 'CYCLING') cycleCount++;
      else if (mode === 'EV') evCount++;
      else if (mode === 'PUBLIC_TRANSPORT') ptCount++;

      totalCo2 += Number(j.totalCO2Saved || j.totalCo2AvoidedKg) || 0;
    }

    return {
      totalVerifiedJourneys: journeys.length,
      walkingJourneys: walkCount,
      cyclingJourneys: cycleCount,
      evJourneys: evCount,
      publicTransportJourneys: ptCount,
      estimatedCo2SavedKg: Number(totalCo2.toFixed(1)),
    };
  }

  /**
   * Helper: Builds 6 AM – 9 PM hourly buckets for given subset of journeys
   */
  buildHourlyActivity(modeJourneys) {
    const hourlyCounts = {};
    for (const b of HOURLY_BUCKETS) {
      hourlyCounts[b.hour] = 0;
    }

    for (const j of modeJourneys) {
      const date = new Date(j.startTime || j.createdAt);
      const hr = date.getHours();
      if (hourlyCounts[hr] !== undefined) {
        hourlyCounts[hr] += 1;
      }
    }

    return HOURLY_BUCKETS.map((b) => ({
      hour: b.hour,
      time: b.label,
      journeys: hourlyCounts[b.hour],
    }));
  }

  /**
   * Helper: Counts top active locations from origin and destination names
   */
  buildTopLocations(modeJourneys, limit = 5) {
    const locationCounts = new Map();

    for (const j of modeJourneys) {
      const orig = j.origin?.name?.trim();
      const dest = j.destination?.name?.trim();

      if (orig) locationCounts.set(orig, (locationCounts.get(orig) || 0) + 1);
      if (dest) locationCounts.set(dest, (locationCounts.get(dest) || 0) + 1);
    }

    return Array.from(locationCounts.entries())
      .map(([location, journeys]) => ({ location, journeys }))
      .sort((a, b) => b.journeys - a.journeys)
      .slice(0, limit);
  }

  /**
   * Section 3: Walking Analysis
   */
  computeWalkingAnalysis(journeys) {
    const walkingJourneys = journeys.filter(
      (j) => normalizeMode(j.verifiedMode || j.currentMode || j.plannedMode) === 'WALKING'
    );

    return {
      totalJourneys: walkingJourneys.length,
      activityByTime: this.buildHourlyActivity(walkingJourneys),
      mostActiveLocations: this.buildTopLocations(walkingJourneys, 5),
    };
  }

  /**
   * Section 4: Cycling Analysis
   */
  computeCyclingAnalysis(journeys) {
    const cyclingJourneys = journeys.filter(
      (j) => normalizeMode(j.verifiedMode || j.currentMode || j.plannedMode) === 'CYCLING'
    );

    return {
      totalJourneys: cyclingJourneys.length,
      activityByTime: this.buildHourlyActivity(cyclingJourneys),
      mostActiveLocations: this.buildTopLocations(cyclingJourneys, 5),
    };
  }

  /**
   * Section 5: EV Mobility Analysis
   */
  computeEvAnalysis(journeys) {
    const evJourneys = journeys.filter(
      (j) => normalizeMode(j.verifiedMode || j.currentMode || j.plannedMode) === 'EV'
    );

    return {
      totalJourneys: evJourneys.length,
      activityByTime: this.buildHourlyActivity(evJourneys),
      mostActiveLocations: this.buildTopLocations(evJourneys, 5),
    };
  }

  /**
   * Section 6: Public Transport Analysis
   */
  computePublicTransportAnalysis(journeys) {
    const ptJourneys = journeys.filter(
      (j) => normalizeMode(j.verifiedMode || j.currentMode || j.plannedMode) === 'PUBLIC_TRANSPORT'
    );

    const originsMap = new Map();
    const destMap = new Map();

    for (const j of ptJourneys) {
      const o = j.origin?.name?.trim();
      const d = j.destination?.name?.trim();
      if (o) originsMap.set(o, (originsMap.get(o) || 0) + 1);
      if (d) destMap.set(d, (destMap.get(d) || 0) + 1);
    }

    const mostUsedOrigins = Array.from(originsMap.entries())
      .map(([origin, journeys]) => ({ origin, journeys }))
      .sort((a, b) => b.journeys - a.journeys)
      .slice(0, 5);

    const mostUsedDestinations = Array.from(destMap.entries())
      .map(([destination, journeys]) => ({ destination, journeys }))
      .sort((a, b) => b.journeys - a.journeys)
      .slice(0, 5);

    return {
      totalJourneys: ptJourneys.length,
      activityByTime: this.buildHourlyActivity(ptJourneys),
      mostUsedOrigins,
      mostUsedDestinations,
    };
  }

  /**
   * Section 7: Environmental Impact (CO2)
   */
  computeEnvironmentalImpact(journeys, dateFilter = 'ALL_TIME') {
    let walkCo2 = 0;
    let cycleCo2 = 0;
    let evCo2 = 0;
    let ptCo2 = 0;

    const timeSeriesMap = new Map();

    for (const j of journeys) {
      const co2 = Number(j.totalCO2Saved || j.totalCo2AvoidedKg) || 0;
      const mode = normalizeMode(j.verifiedMode || j.currentMode || j.plannedMode);

      if (mode === 'WALKING') walkCo2 += co2;
      else if (mode === 'CYCLING') cycleCo2 += co2;
      else if (mode === 'EV') evCo2 += co2;
      else if (mode === 'PUBLIC_TRANSPORT') ptCo2 += co2;

      // Group over time based on dateFilter
      const date = new Date(j.startTime || j.createdAt);
      let timeKey;

      if (dateFilter === 'TODAY') {
        const hr = date.getHours();
        timeKey = `${hr.toString().padStart(2, '0')}:00`;
      } else {
        // YYYY-MM-DD format
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        timeKey = `${m}/${d}`;
      }

      timeSeriesMap.set(timeKey, (timeSeriesMap.get(timeKey) || 0) + co2);
    }

    const co2ByMode = [
      { mode: 'Walking', co2SavedKg: Number(walkCo2.toFixed(1)), color: '#10b981' },
      { mode: 'Cycling', co2SavedKg: Number(cycleCo2.toFixed(1)), color: '#f59e0b' },
      { mode: 'EV', co2SavedKg: Number(evCo2.toFixed(1)), color: '#059669' },
      { mode: 'Public Transport', co2SavedKg: Number(ptCo2.toFixed(1)), color: '#3b82f6' },
    ];

    const co2OverTime = Array.from(timeSeriesMap.entries())
      .map(([timeLabel, co2SavedKg]) => ({
        timeLabel,
        co2SavedKg: Number(co2SavedKg.toFixed(1)),
      }))
      .sort((a, b) => a.timeLabel.localeCompare(b.timeLabel));

    const totalCo2 = walkCo2 + cycleCo2 + evCo2 + ptCo2;

    return {
      totalCo2SavedKg: Number(totalCo2.toFixed(1)),
      co2ByMode,
      co2OverTime,
    };
  }
}

module.exports = new CityNetworkService();
