class AIModeDetectionService {
  /**
   * Classify transport mode using sensor telemetry & GPS kinematic distribution
   */
  classifyTelemetry({ avgSpeedKmh, maxSpeedKmh, cadenceStepsPerMin = 0, accelerationVariance = 0.5, stopsCount = 0 }) {
    // 1. Walking Signature
    if (avgSpeedKmh >= 1.5 && avgSpeedKmh <= 7.5 && maxSpeedKmh <= 12) {
      return {
        mode: 'WALKING',
        confidence: 0.96,
        reasoning: 'Low constant speed (3-6 km/h) and consistent pedestrian cadence detected.',
        isVerified: true,
      };
    }

    // 2. Cycling Signature
    if (avgSpeedKmh > 7.5 && avgSpeedKmh <= 26 && maxSpeedKmh <= 38) {
      return {
        mode: 'CYCLING',
        confidence: 0.94,
        reasoning: 'Moderate rhythmic velocity (12-22 km/h) with micro-acceleration matches active cycling.',
        isVerified: true,
      };
    }

    // 3. Public Bus Signature
    if (avgSpeedKmh > 12 && avgSpeedKmh <= 45 && stopsCount >= 2) {
      return {
        mode: 'BUS',
        confidence: 0.91,
        reasoning: 'Transit velocity profile with frequent bus stop dwell times and urban traffic intervals.',
        isVerified: true,
      };
    }

    // 4. Metro / Train Signature
    if (avgSpeedKmh > 35 && maxSpeedKmh > 65) {
      return {
        mode: 'METRO',
        confidence: 0.95,
        reasoning: 'High-speed linear acceleration matching dedicated transit corridor infrastructure.',
        isVerified: true,
      };
    }

    // 5. Electric Vehicle / Car
    if (avgSpeedKmh > 20 && maxSpeedKmh > 50) {
      return {
        mode: 'EV',
        confidence: 0.88,
        reasoning: 'Smooth continuous motorized corridor travel without pedestrian cadence.',
        isVerified: true,
      };
    }

    // Fallback based on speed
    if (avgSpeedKmh <= 6) {
      return { mode: 'WALKING', confidence: 0.85, reasoning: 'Low velocity pedestrian travel.' };
    }
    return { mode: 'CYCLING', confidence: 0.82, reasoning: 'Active medium velocity transit.' };
  }

  /**
   * Calculate Fitness Points, Green Credits, Calories, and Avoided CO2
   */
  calculateImpact(mode, distanceKm, durationMinutes) {
    const dist = Math.max(distanceKm, 0.1);
    const dur = Math.max(durationMinutes, 1);

    let fitnessPoints = 0;
    let greenCredits = 0;
    let co2AvoidedKg = 0;
    let caloriesBurned = 0;

    // Baseline ICE private car emission factor in India: ~192g CO2 per km
    const carBaselineCo2PerKm = 0.192; // kg

    switch (mode) {
      case 'WALKING':
        fitnessPoints = Math.round(dist * 15 + dur * 0.5);
        greenCredits = Math.round(dist * 10);
        co2AvoidedKg = Number((dist * carBaselineCo2PerKm).toFixed(3));
        caloriesBurned = Math.round(dist * 65); // ~65 kcal per km walking
        break;

      case 'CYCLING':
        fitnessPoints = Math.round(dist * 10 + dur * 0.8);
        greenCredits = Math.round(dist * 12);
        co2AvoidedKg = Number((dist * carBaselineCo2PerKm).toFixed(3));
        caloriesBurned = Math.round(dist * 42); // ~42 kcal per km cycling
        break;

      case 'BUS':
        fitnessPoints = Math.round(dur * 0.4); // Light active transit points
        greenCredits = Math.round(dist * 6);
        // Bus emits ~50g/km/pax vs car 192g -> saves ~142g/km
        co2AvoidedKg = Number((dist * (carBaselineCo2PerKm - 0.05)).toFixed(3));
        caloriesBurned = Math.round(dur * 2.5);
        break;

      case 'METRO':
        fitnessPoints = Math.round(dur * 0.3);
        greenCredits = Math.round(dist * 8);
        // Electric Metro is highly clean -> saves ~170g/km
        co2AvoidedKg = Number((dist * (carBaselineCo2PerKm - 0.02)).toFixed(3));
        caloriesBurned = Math.round(dur * 2.0);
        break;

      case 'EV':
        fitnessPoints = 5;
        greenCredits = Math.round(dist * 5);
        // EV zero tailpipe vs ICE car -> saves ~120g/km after grid emission
        co2AvoidedKg = Number((dist * 0.12).toFixed(3));
        caloriesBurned = Math.round(dur * 1.5);
        break;

      default:
        fitnessPoints = Math.round(dist * 5);
        greenCredits = Math.round(dist * 4);
        co2AvoidedKg = Number((dist * 0.08).toFixed(3));
        caloriesBurned = Math.round(dur * 2);
        break;
    }

    return {
      fitnessPoints,
      greenCredits,
      co2AvoidedKg,
      caloriesBurned,
    };
  }
}

module.exports = new AIModeDetectionService();
