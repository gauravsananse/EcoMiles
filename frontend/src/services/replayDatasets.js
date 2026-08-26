/**
 * Developer Test Mode Replay Datasets
 * Real recorded kinematic profiles and transition streams feeding the exact same ML inference pipeline.
 */

export const REPLAY_PROFILES = {
  walking: {
    id: 'walking',
    name: '🚶 Pedestrian Walking Profile',
    description: '4.8 km/h human walking pace with active cadence (112 spm) and distinct vertical impact jerk.',
    expectedMode: 'WALKING',
    frames: [
      { speed: 4.2, speeds: [3.8, 4.2, 4.5], accelerationsX: [0.4, -0.3, 0.5], accelerationsY: [0.3, 0.8, -0.4], accelerationsZ: [11.2, 8.4, 11.5], cadence: 110, transitCorridorOverlap: 0.1, stopFrequency: 0.05 },
      { speed: 4.8, speeds: [4.6, 4.8, 5.0], accelerationsX: [0.6, -0.5, 0.4], accelerationsY: [0.5, 0.9, -0.3], accelerationsZ: [11.6, 8.1, 11.8], cadence: 114, transitCorridorOverlap: 0.1, stopFrequency: 0.0 },
      { speed: 5.1, speeds: [4.9, 5.1, 5.2], accelerationsX: [0.5, -0.4, 0.6], accelerationsY: [0.4, 0.7, -0.5], accelerationsZ: [11.4, 8.3, 11.5], cadence: 116, transitCorridorOverlap: 0.1, stopFrequency: 0.0 },
    ],
  },

  cycling: {
    id: 'cycling',
    name: '🚴 Active Cycling Profile',
    description: '18.2 km/h bicycle ride with 78 rpm pedal cadence and handlebar balance sway.',
    expectedMode: 'CYCLING',
    frames: [
      { speed: 16.5, speeds: [15.2, 16.5, 17.8], accelerationsX: [0.8, -0.7, 0.9], accelerationsY: [0.5, -0.4, 0.6], accelerationsZ: [10.6, 9.1, 10.4], gyrosAlpha: [15.2, -14.1, 16.0], cadence: 72, transitCorridorOverlap: 0.2, stopFrequency: 0.05 },
      { speed: 18.4, speeds: [17.8, 18.4, 19.1], accelerationsX: [1.1, -0.9, 1.0], accelerationsY: [0.6, -0.5, 0.7], accelerationsZ: [10.8, 8.9, 10.7], gyrosAlpha: [18.4, -16.2, 17.5], cadence: 78, transitCorridorOverlap: 0.25, stopFrequency: 0.0 },
      { speed: 19.2, speeds: [18.8, 19.2, 19.8], accelerationsX: [1.0, -0.8, 0.9], accelerationsY: [0.5, -0.4, 0.6], accelerationsZ: [10.7, 9.0, 10.5], gyrosAlpha: [16.8, -15.0, 16.2], cadence: 82, transitCorridorOverlap: 0.2, stopFrequency: 0.0 },
    ],
  },

  scooter_fraud_attack: {
    id: 'scooter_fraud_attack',
    name: '🛵 Scooter vs Cycling Attack (Anti-Fraud Test)',
    description: 'Petrol scooter driving at 16 km/h (bicycle speed) with 0 cadence and engine vibration. Should detect SCOOTER and reject cycling rewards.',
    expectedMode: 'SCOOTER',
    isFraudAttempt: true,
    frames: [
      { speed: 15.2, speeds: [14.8, 15.2, 15.5], accelerationsX: [0.1, 0.12, 0.09], accelerationsY: [0.08, 0.1, 0.07], accelerationsZ: [9.9, 9.75, 9.85], cadence: 0, accelPeakFreq: 0.1, transitCorridorOverlap: 0.15, stopFrequency: 0.05 },
      { speed: 16.8, speeds: [16.2, 16.8, 17.1], accelerationsX: [0.12, 0.15, 0.11], accelerationsY: [0.09, 0.11, 0.08], accelerationsZ: [9.92, 9.7, 9.88], cadence: 0, accelPeakFreq: 0.1, transitCorridorOverlap: 0.2, stopFrequency: 0.0 },
      { speed: 18.0, speeds: [17.5, 18.0, 18.4], accelerationsX: [0.11, 0.14, 0.1], accelerationsY: [0.08, 0.1, 0.07], accelerationsZ: [9.91, 9.72, 9.86], cadence: 0, accelPeakFreq: 0.1, transitCorridorOverlap: 0.15, stopFrequency: 0.0 },
    ],
  },

  bus: {
    id: 'bus',
    name: '🚌 Public Transit Bus Ride',
    description: '28 km/h along bus corridor with station dwell stop patterns and verified transit BLE beacon.',
    expectedMode: 'BUS',
    frames: [
      { speed: 22.0, speeds: [0.0, 12.0, 26.0], accelerationsX: [0.3, 0.4, 0.2], accelerationsY: [0.6, -0.8, 0.4], accelerationsZ: [9.9, 9.6, 10.1], cadence: 0, transitCorridorOverlap: 0.92, stopFrequency: 0.35, dwellTimeRatio: 0.3, bleSignals: [{ beaconId: 'BEACON-BUS-104', transportType: 'BUS', name: 'MUTA Smart Bus 104' }] },
      { speed: 32.0, speeds: [28.0, 32.0, 35.0], accelerationsX: [0.2, 0.3, 0.1], accelerationsY: [0.4, -0.5, 0.3], accelerationsZ: [9.85, 9.7, 10.0], cadence: 0, transitCorridorOverlap: 0.94, stopFrequency: 0.25, dwellTimeRatio: 0.25, bleSignals: [{ beaconId: 'BEACON-BUS-104', transportType: 'BUS', name: 'MUTA Smart Bus 104' }] },
      { speed: 18.0, speeds: [25.0, 15.0, 0.0], accelerationsX: [0.2, -0.4, -0.8], accelerationsY: [0.3, 0.5, 0.2], accelerationsZ: [9.9, 9.7, 10.0], cadence: 0, transitCorridorOverlap: 0.95, stopFrequency: 0.4, dwellTimeRatio: 0.4, bleSignals: [{ beaconId: 'BEACON-BUS-104', transportType: 'BUS', name: 'MUTA Smart Bus 104' }] },
    ],
  },

  metro: {
    id: 'metro',
    name: '🚇 Metro / Rail Guideway Profile',
    description: '62 km/h dedicated linear track acceleration with subterranean GPS degradation handling.',
    expectedMode: 'METRO',
    frames: [
      { speed: 45.0, speeds: [35.0, 45.0, 52.0], accelerationsX: [0.15, 0.2, 0.1], accelerationsY: [0.8, 0.9, 0.7], accelerationsZ: [9.85, 9.8, 9.9], cadence: 0, transitCorridorOverlap: 0.98, headingChangeRate: 0.5, gpsAccuracy: 45, gpsDegraded: true, bleSignals: [{ beaconId: 'BEACON-METRO-09', transportType: 'METRO', name: 'Central Metro Station' }] },
      { speed: 68.0, speeds: [62.0, 68.0, 72.0], accelerationsX: [0.1, 0.15, 0.1], accelerationsY: [0.3, 0.2, 0.3], accelerationsZ: [9.82, 9.8, 9.85], cadence: 0, transitCorridorOverlap: 0.99, headingChangeRate: 0.2, gpsAccuracy: 60, gpsDegraded: true, bleSignals: [{ beaconId: 'BEACON-METRO-09', transportType: 'METRO', name: 'Central Metro Station' }] },
    ],
  },

  car: {
    id: 'car',
    name: '🚗 Private Motor Vehicle Profile',
    description: '55 km/h arterial road commute. Rewards = 0, no public transit credits.',
    expectedMode: 'CAR',
    frames: [
      { speed: 48.0, speeds: [42.0, 48.0, 55.0], accelerationsX: [0.2, -0.3, 0.2], accelerationsY: [0.4, -0.6, 0.5], accelerationsZ: [9.85, 9.75, 9.9], cadence: 0, transitCorridorOverlap: 0.15, stopFrequency: 0.05, dwellTimeRatio: 0.05 },
      { speed: 62.0, speeds: [58.0, 62.0, 66.0], accelerationsX: [0.15, -0.2, 0.18], accelerationsY: [0.3, 0.4, 0.2], accelerationsZ: [9.82, 9.78, 9.88], cadence: 0, transitCorridorOverlap: 0.1, stopFrequency: 0.0, dwellTimeRatio: 0.0 },
    ],
  },

  bus_to_car_transition: {
    id: 'bus_to_car_transition',
    name: '🔄 Prompt Demo Scenario: Walking → Bus → Walking → Car',
    description: 'Demonstrates multi-leg segmentation where bus credits lock upon exit and immediately shut off upon entering a car.',
    isMultiLeg: true,
    legs: [
      {
        legName: 'Leg 1: Walking to Bus Stop',
        mode: 'WALKING',
        durationSec: 10,
        frame: { speed: 4.8, speeds: [4.5, 4.8, 5.0], accelerationsX: [0.5, -0.4, 0.6], accelerationsY: [0.4, 0.8, -0.4], accelerationsZ: [11.4, 8.3, 11.6], cadence: 114, transitCorridorOverlap: 0.2, stopFrequency: 0.05 },
      },
      {
        legName: 'Leg 2: Boarding Bus 104 (Transit Rewards ACTIVE)',
        mode: 'BUS',
        durationSec: 15,
        frame: { speed: 28.0, speeds: [0.0, 18.0, 32.0], accelerationsX: [0.3, 0.4, 0.2], accelerationsY: [0.7, -0.8, 0.5], accelerationsZ: [9.9, 9.6, 10.1], cadence: 0, transitCorridorOverlap: 0.94, stopFrequency: 0.35, dwellTimeRatio: 0.3, bleSignals: [{ beaconId: 'BEACON-BUS-104', transportType: 'BUS', name: 'MUTA Smart Bus 104' }] },
      },
      {
        legName: 'Leg 3: Walking from Bus Stop (Bus Segment Closed & Verified)',
        mode: 'WALKING',
        durationSec: 8,
        frame: { speed: 4.2, speeds: [3.9, 4.2, 4.4], accelerationsX: [0.4, -0.3, 0.5], accelerationsY: [0.3, 0.7, -0.4], accelerationsZ: [11.2, 8.5, 11.4], cadence: 108, transitCorridorOverlap: 0.1, stopFrequency: 0.0 },
      },
      {
        legName: 'Leg 4: Entering Private Car (Transit Rewards STOPPED, Car Credits = 0)',
        mode: 'CAR',
        durationSec: 15,
        frame: { speed: 56.0, speeds: [45.0, 56.0, 64.0], accelerationsX: [0.2, -0.25, 0.2], accelerationsY: [0.5, -0.5, 0.4], accelerationsZ: [9.84, 9.76, 9.9], cadence: 0, transitCorridorOverlap: 0.15, stopFrequency: 0.05, dwellTimeRatio: 0.05 },
      },
    ],
  },
};
