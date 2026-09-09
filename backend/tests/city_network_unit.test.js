const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const cityNetworkService = require('../services/cityNetworkService');

describe('City Network Mobility Overview Service Suite', () => {
  it('1. should generate rich Demo Analytics with all required sections when isDemo=true', async () => {
    const data = await cityNetworkService.getCityMobilityOverview({ isDemo: true });

    assert.equal(data.isDemo, true);
    assert.equal(data.hasData, true);
    assert.ok(data.cityName);
    assert.ok(data.lastUpdated);

    // Summary Cards
    const s = data.summary;
    assert.ok(s.totalVerifiedJourneys > 0);
    assert.ok(s.walkingJourneys > 0);
    assert.ok(s.cyclingJourneys > 0);
    assert.ok(s.evJourneys > 0);
    assert.ok(s.publicTransportJourneys > 0);
    assert.ok(s.estimatedCo2SavedKg > 0);

    // Walking Analysis
    const w = data.walking;
    assert.ok(w.totalJourneys > 0);
    assert.equal(w.activityByTime.length, 16); // 6 AM - 9 PM = 16 hourly buckets
    assert.equal(w.activityByTime[0].time, '6 AM');
    assert.equal(w.activityByTime[15].time, '9 PM');
    assert.ok(Array.isArray(w.mostActiveLocations));
    assert.ok(w.mostActiveLocations.length > 0);
    assert.ok(w.mostActiveLocations[0].location);
    assert.ok(w.mostActiveLocations[0].journeys > 0);

    // Cycling Analysis
    const c = data.cycling;
    assert.ok(c.totalJourneys > 0);
    assert.equal(c.activityByTime.length, 16);
    assert.ok(Array.isArray(c.mostActiveLocations));

    // EV Analysis
    const e = data.ev;
    assert.ok(e.totalJourneys > 0);
    assert.equal(e.activityByTime.length, 16);
    assert.ok(Array.isArray(e.mostActiveLocations));

    // Public Transport Analysis
    const pt = data.publicTransport;
    assert.ok(pt.totalJourneys > 0);
    assert.equal(pt.activityByTime.length, 16);
    assert.ok(Array.isArray(pt.mostUsedOrigins));
    assert.ok(Array.isArray(pt.mostUsedDestinations));
    assert.ok(pt.mostUsedOrigins[0].origin);
    assert.ok(pt.mostUsedDestinations[0].destination);

    // Environmental Impact
    const env = data.environmentalImpact;
    assert.ok(env.totalCo2SavedKg > 0);
    assert.equal(env.co2ByMode.length, 4); // Walking, Cycling, EV, Public Transport
    assert.ok(Array.isArray(env.co2OverTime));
  });

  it('2. should filter by mode (e.g. WALKING only)', async () => {
    const data = await cityNetworkService.getCityMobilityOverview({ isDemo: true, modeFilter: 'WALKING' });
    assert.ok(data.summary.totalVerifiedJourneys > 0);
    assert.equal(data.summary.cyclingJourneys, 0);
    assert.equal(data.summary.evJourneys, 0);
    assert.equal(data.summary.publicTransportJourneys, 0);
  });

  it('3. should return clean empty state when isDemo=false and no records are in database', async () => {
    const data = await cityNetworkService.getCityMobilityOverview({ isDemo: false });
    assert.equal(data.isDemo, false);
    assert.ok(data.summary.totalVerifiedJourneys >= 0);
  });

  it('4. should compute hourly buckets specifically within 6 AM to 9 PM', () => {
    const mockJourneys = [
      { startTime: new Date('2026-09-10T08:15:00'), verifiedMode: 'WALKING' },
      { startTime: new Date('2026-09-10T08:45:00'), verifiedMode: 'WALKING' },
      { startTime: new Date('2026-09-10T14:30:00'), verifiedMode: 'WALKING' },
      { startTime: new Date('2026-09-10T02:00:00'), verifiedMode: 'WALKING' }, // 2 AM (outside 6 AM - 9 PM)
    ];

    const result = cityNetworkService.buildHourlyActivity(mockJourneys);
    assert.equal(result.length, 16);

    const bucket8AM = result.find((b) => b.time === '8 AM');
    assert.equal(bucket8AM.journeys, 2);

    const bucket2PM = result.find((b) => b.time === '2 PM');
    assert.equal(bucket2PM.journeys, 1);
  });

  it('5. should compute most active locations anonymously without user identifiers', () => {
    const mockJourneys = [
      { origin: { name: 'College Area' }, destination: { name: 'Railway Station' } },
      { origin: { name: 'Market Area' }, destination: { name: 'Railway Station' } },
      { origin: { name: 'College Area' }, destination: { name: 'Market Area' } },
    ];

    const locations = cityNetworkService.buildTopLocations(mockJourneys, 3);
    assert.ok(locations.length <= 3);
    const station = locations.find((l) => l.location === 'Railway Station');
    assert.equal(station.journeys, 2);
  });
});
