class SmartRoutingService {
  /**
   * Plans fitness-aware and sustainability-aware multimodal routes
   */
  planSmartRoute({ origin = 'Student Hostel / Sector A', destination = 'Engineering Campus / IT Hub' }) {
    // Generate realistic urban multimodal route comparison
    const activeMultimodal = {
      id: 'route-active-smart',
      name: 'Recommended Active Multimodal Route',
      tag: 'Best Health & Green Balance',
      isRecommended: true,
      totalDurationMinutes: 29,
      totalDistanceKm: 7.2,
      fitnessPoints: 34,
      greenCredits: 28,
      co2AvoidedKg: 0.95,
      caloriesBurned: 135,
      segments: [
        {
          mode: 'WALKING',
          instruction: `Walk from ${origin} to Sector 4 Transit Hub`,
          distanceKm: 0.9,
          durationMin: 10,
          fitnessPoints: 14,
          icon: 'walk',
        },
        {
          mode: 'BUS',
          instruction: 'Take Electric Rapid Bus 204 (Green Corridor)',
          distanceKm: 5.5,
          durationMin: 12,
          greenCredits: 22,
          icon: 'bus',
        },
        {
          mode: 'WALKING',
          instruction: `Walk from Station Gate 2 to ${destination}`,
          distanceKm: 0.8,
          durationMin: 7,
          fitnessPoints: 20,
          icon: 'walk',
        },
      ],
      healthHighlight: '1.7 km walking burns 135 kcal and provides 45% of daily cardio activity target.',
    };

    const pureCycling = {
      id: 'route-pure-cycling',
      name: '100% Active Cycling Route',
      tag: 'Maximum Fitness Points',
      isRecommended: false,
      totalDurationMinutes: 22,
      totalDistanceKm: 6.4,
      fitnessPoints: 72,
      greenCredits: 45,
      co2AvoidedKg: 1.23,
      caloriesBurned: 260,
      segments: [
        {
          mode: 'CYCLING',
          instruction: `Cycle via Dedicated Greenway & Protected Bike Lane to ${destination}`,
          distanceKm: 6.4,
          durationMin: 22,
          fitnessPoints: 72,
          icon: 'bike',
        },
      ],
      healthHighlight: 'Burns 260 kcal, builds lower-body endurance, and saves 1.23 kg of CO2.',
    };

    const conventionalCar = {
      id: 'route-car-baseline',
      name: 'Conventional Private Car Route',
      tag: 'High Carbon Footprint',
      isRecommended: false,
      totalDurationMinutes: 24, // traffic delay included
      totalDistanceKm: 8.1,
      fitnessPoints: 0,
      greenCredits: 0,
      co2AvoidedKg: 0,
      co2EmittedKg: 1.55,
      caloriesBurned: 10,
      segments: [
        {
          mode: 'CAR',
          instruction: 'Drive through Ring Road (Moderate Congestion)',
          distanceKm: 8.1,
          durationMin: 24,
          icon: 'car',
        },
      ],
      healthHighlight: 'Zero physical activity. Contributes 1.55 kg of CO2 emissions and urban congestion.',
    };

    return {
      origin,
      destination,
      timestamp: new Date().toISOString(),
      routes: [activeMultimodal, pureCycling, conventionalCar],
      summaryNotice: 'Active route saves 0.95 kg CO2 and gives you +34 Fitness Points vs driving.',
    };
  }
}

module.exports = new SmartRoutingService();
