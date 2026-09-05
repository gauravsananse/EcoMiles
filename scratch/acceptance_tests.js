/**
 * Comprehensive Acceptance Test Suite for Walking & Cycling Multi-Sensor Verification
 * Verifies Tests A through I as specified in Section 23.
 */

const { WalkingVerificationEngine } = require('../frontend/src/services/walkingVerificationService');
const { CyclingVerificationEngine } = require('../frontend/src/services/cyclingVerificationEngine');
const { default: stepCountingEngine } = require('../frontend/src/services/stepCountingEngine');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('\n======================================================');
  console.log('RUNNING ACCEPTANCE TESTS (Section 23: Tests A - I)');
  console.log('======================================================\n');

  // --------------------------------------------------------
  // TEST A: WALKING START (Stationary at Start)
  // --------------------------------------------------------
  console.log('--- TEST A: WALKING START (Stationary at Start) ---');
  const walkingEngine = new WalkingVerificationEngine();
  walkingEngine.resetJourney();
  stepCountingEngine.reset();
  stepCountingEngine.setTransportMode('WALKING', 0);

  assert(walkingEngine.stepCount === 0, 'Initial steps must be strictly 0');
  assert(walkingEngine.currentGpsSpeed === 0, 'Initial speed must be strictly 0 km/h');
  assert(walkingEngine.totalDistanceKm === 0, 'Initial distance must be strictly 0 km');
  assert(walkingEngine.currentWalkingConfidence === 0, 'Initial confidence must be strictly 0%');

  const initialConf = walkingEngine.calculateWalkingConfidence({
    gpsSpeedKmh: 0,
    distanceKm: 0,
    stepCount: 0,
    hasGpsFix: true,
  });
  assert(initialConf.confidenceScore <= 20, `Initial walking confidence is low/zero (${initialConf.confidenceScore}%)`);
  assert(initialConf.isVerified === false, 'Walking is NOT verified at start');
  assert(initialConf.statusLabel === 'Not enough walking evidence', `Status label is "${initialConf.statusLabel}"`);

  // --------------------------------------------------------
  // TEST B: NORMAL WALKING
  // --------------------------------------------------------
  console.log('\n--- TEST B: NORMAL WALKING ---');
  // Simulate 12 genuine pedestrian strides at ~1.8 Hz cadence (550ms intervals)
  let simulatedTime = Date.now() + 2000;
  let stepsDetectedCount = 0;

  for (let i = 0; i < 15; i++) {
    // Rising peak phase (~150ms): heel strike impact z = 12.8 m/s²
    for (let sample = 0; sample < 5; sample++) {
      simulatedTime += 30;
      walkingEngine.processAccelerometerReading({ x: 0.3, y: 0.6, z: 12.8, isLinear: false }, simulatedTime);
    }
    // Falling valley phase (~150ms): toe-off descent z = 7.5 m/s²
    let detected = false;
    for (let sample = 0; sample < 5; sample++) {
      simulatedTime += 30;
      const res = walkingEngine.processAccelerometerReading({ x: 0.1, y: 0.2, z: 7.5, isLinear: false }, simulatedTime);
      if (res.stepDetected) detected = true;
    }
    if (detected) {
      stepsDetectedCount++;
      stepCountingEngine.registerStep(simulatedTime, 1);
    }
    // Stance phase (~250ms): baseline 9.81 m/s²
    for (let sample = 0; sample < 8; sample++) {
      simulatedTime += 30;
      walkingEngine.processAccelerometerReading({ x: 0.0, y: 0.1, z: 9.81, isLinear: false }, simulatedTime);
    }
  }

  // Simulate walking GPS movement at 4.5 km/h
  const baseLat = 18.5204;
  const baseLng = 73.8567;
  walkingEngine.processGpsPosition({ latitude: baseLat, longitude: baseLng, accuracy: 6, speed: 1.25, timestamp: simulatedTime });
  simulatedTime += 2000;
  // 2.5 meters displacement in 2s
  walkingEngine.processGpsPosition({ latitude: baseLat + 0.00003, longitude: baseLng + 0.00003, accuracy: 5, speed: 1.3, timestamp: simulatedTime });

  assert(walkingEngine.stepCount > 0, `Steps incremented realistically (steps = ${walkingEngine.stepCount})`);
  assert(walkingEngine.currentGpsSpeed >= 3.0 && walkingEngine.currentGpsSpeed <= 6.0, `Speed is realistic pedestrian speed (${walkingEngine.currentGpsSpeed} km/h)`);

  // Run multiple confidence evaluations over a 10-second walk (simulating 1 second per step)
  let confResult;
  for (let t = 0; t < 10; t++) {
    walkingEngine.lastConfidenceUpdateTime -= 1000;
    confResult = walkingEngine.calculateWalkingConfidence({
      gpsSpeedKmh: walkingEngine.currentGpsSpeed,
      distanceKm: walkingEngine.totalDistanceKm,
      stepCount: walkingEngine.stepCount,
      hasStepCounter: true,
      accelMagnitude: 0.85,
      gyroMagnitude: 1.2,
      hasGpsFix: true,
    });
  }

  assert(confResult.confidenceScore >= 60, `Walking confidence rises with verified evidence (${confResult.confidenceScore}%)`);
  assert(walkingEngine.stepCount >= 4, `Confirmed continuous cadence (>4 steps)`);

  // --------------------------------------------------------
  // TEST C: PHONE SHAKING (Stationary Shake/Tap)
  // --------------------------------------------------------
  console.log('\n--- TEST C: PHONE SHAKING (Stationary with No GPS Movement) ---');
  const shakeEngine = new WalkingVerificationEngine();
  shakeEngine.resetJourney();

  // Stationary GPS fix (0 km/h, no coordinate change)
  shakeEngine.processGpsPosition({ latitude: 18.5204, longitude: 73.8567, accuracy: 5, speed: 0, timestamp: Date.now() });

  // Rapid artificial shaking: high frequency (100ms interval = 10Hz)
  let shakeTime = Date.now();
  let fakeSteps = 0;
  for (let s = 0; s < 20; s++) {
    shakeTime += 80;
    const res = shakeEngine.processAccelerometerReading({ x: 3.5, y: -4.0, z: 12.0, isLinear: false }, shakeTime);
    if (res.stepDetected) fakeSteps++;
  }

  const shakeConf = shakeEngine.calculateWalkingConfidence({
    gpsSpeedKmh: 0,
    distanceKm: 0,
    stepCount: fakeSteps,
    hasGpsFix: true,
    accelMagnitude: 3.5,
  });

  assert(shakeConf.isVerified === false, 'Stationary shaking is NOT verified as walking');
  assert(shakeConf.confidenceScore <= 35, `Shaking without GPS displacement has low confidence (${shakeConf.confidenceScore}%)`);

  // --------------------------------------------------------
  // TEST D: CAR / BUS VEHICLE LOCKOUT FOR WALKING
  // --------------------------------------------------------
  console.log('\n--- TEST D: CAR / BUS VEHICULAR LOCKOUT ---');
  const vehicleEngine = new WalkingVerificationEngine();
  vehicleEngine.resetJourney();

  // Speed = 25 km/h (vehicular)
  vehicleEngine.processGpsPosition({ latitude: 18.5204, longitude: 73.8567, accuracy: 8, speed: 6.94, timestamp: Date.now() }); // 25 km/h

  assert(vehicleEngine.isVehicularLocked() === true, 'Vehicular speed (> 7.5 km/h) activates lockout');

  // Attempt to generate steps while moving at vehicular speed
  const vehStepRes = vehicleEngine.processAccelerometerReading({ x: 0.5, y: 1.8, z: 9.81, isLinear: false }, Date.now() + 1000);
  assert(vehStepRes.stepDetected === false, 'Steps are strictly locked out during vehicular movement');

  const vehConf = vehicleEngine.calculateWalkingConfidence({
    gpsSpeedKmh: vehicleEngine.currentGpsSpeed,
    distanceKm: 0.5,
    stepCount: 0,
    hasGpsFix: true,
  });
  assert(vehConf.confidenceScore === 0, `Vehicular speed forces walking confidence to 0% (${vehConf.confidenceScore}%)`);

  // --------------------------------------------------------
  // TEST E: CYCLING (Separation & Strict NULL Walking Checks)
  // --------------------------------------------------------
  console.log('\n--- TEST E: CYCLING VERIFICATION & STRICT SEPARATION ---');
  const cyclingEngine = new CyclingVerificationEngine();
  cyclingEngine.resetJourney();

  assert(cyclingEngine.cyclingConfidence === 0, 'Cycling confidence starts strictly at 0%');
  assert(cyclingEngine.totalDistanceKm === 0, 'Cycling distance starts strictly at 0');

  // Cycling GPS progression at 18 km/h (5.0 m/s)
  let bikeTime = Date.now();
  let cLat = 18.5300;
  let cLng = 73.8500;
  cyclingEngine.processGpsPosition({ latitude: cLat, longitude: cLng, accuracy: 8, speed: 5.0, timestamp: bikeTime });

  for (let b = 0; b < 6; b++) {
    bikeTime += 2000;
    cLat += 0.00009; // ~10 meters displacement
    cLng += 0.00009;
    cyclingEngine.processGpsPosition({ latitude: cLat, longitude: cLng, accuracy: 7, speed: 5.0, timestamp: bikeTime });
    // Smooth road roll vibration
    cyclingEngine.processSensorReading({
      acceleration: { x: 0.1, y: 0.3, z: 9.9 },
      rotationRate: { alpha: 0.5, beta: 0.8, gamma: 0.2 },
      timestamp: bikeTime,
    });
  }

  assert(cyclingEngine.totalDistanceKm > 0, `Cycling distance increases (${cyclingEngine.totalDistanceKm.toFixed(3)} km)`);
  assert(cyclingEngine.currentGpsSpeed >= 15 && cyclingEngine.currentGpsSpeed <= 22, `Cycling speed is realistic (${cyclingEngine.currentGpsSpeed} km/h)`);

  let cycleEval;
  for (let ce = 0; ce < 10; ce++) {
    cyclingEngine.lastConfidenceUpdateTime -= 1000;
    cycleEval = cyclingEngine.calculateCyclingConfidence({
      gpsSpeedKmh: cyclingEngine.currentGpsSpeed,
      gpsAccuracy: 7,
    });
  }

  assert(cycleEval.confidenceScore >= 70, `Cycling confidence rises on verified bike kinematics (${cycleEval.confidenceScore}%)`);
  assert(cycleEval.walkingConfidence === null, 'STRICT REQUIREMENT: cyclingEngine.walkingConfidence is strictly NULL');

  const debugMetrics = cyclingEngine.getDebugMetrics();
  assert(debugMetrics.walkingConfidence === null, 'DebugPanel: Cycling debug metrics walkingConfidence is NULL');
  assert(debugMetrics.sessionSteps === 'DISABLED', 'DebugPanel: Cycling sessionSteps is strictly DISABLED');

  // --------------------------------------------------------
  // TEST F: CYCLING -> WALKING TRANSITION
  // --------------------------------------------------------
  console.log('\n--- TEST F: CYCLING -> WALKING TRANSITION ---');
  // Transition: Stop cycling, switch to walking
  cyclingEngine.resetJourney();
  const newWalkingEngine = new WalkingVerificationEngine();
  newWalkingEngine.resetJourney();
  stepCountingEngine.reset();
  stepCountingEngine.setTransportMode('WALKING', 0);

  assert(newWalkingEngine.stepCount === 0, 'New walking session starts at 0 steps (no cycling inheritance)');
  assert(newWalkingEngine.currentWalkingConfidence === 0, 'Walking confidence initializes independently at 0%');
  assert(stepCountingEngine.getCounts().sessionSteps === 0, 'StepCountingEngine session steps is 0');

  // --------------------------------------------------------
  // TEST G: WALKING -> CYCLING TRANSITION
  // --------------------------------------------------------
  console.log('\n--- TEST G: WALKING -> CYCLING TRANSITION ---');
  // Transition: Stop walking, switch to cycling
  newWalkingEngine.resetJourney();
  stepCountingEngine.setEnabled(false);
  stepCountingEngine.setTransportMode('CYCLING', 0);
  const newCyclingEngine = new CyclingVerificationEngine();
  newCyclingEngine.resetJourney();

  assert(stepCountingEngine.getCounts().stepCountingEnabled === false, 'Step counting is disabled in cycling');
  assert(newCyclingEngine.cyclingConfidence === 0, 'Cycling confidence initializes at 0%');

  // --------------------------------------------------------
  // TEST H: GPS NOISE & IMPOSSIBLE JUMP REJECTION
  // --------------------------------------------------------
  console.log('\n--- TEST H: GPS NOISE & TELEPORTATION REJECTION ---');
  const noiseEngine = new CyclingVerificationEngine();
  noiseEngine.resetJourney();
  const startTime = Date.now();

  // Valid initial fix
  noiseEngine.processGpsPosition({ latitude: 18.5200, longitude: 73.8500, accuracy: 8, speed: 4.0, timestamp: startTime });

  // Impossible jump: 20 km away in 1 second (> 70,000 km/h)
  const jumpResult = noiseEngine.processGpsPosition({
    latitude: 18.7000,
    longitude: 74.0000,
    accuracy: 8,
    speed: null,
    timestamp: startTime + 1000,
  });

  assert(noiseEngine.cyclingFlags.includes('GPS_SPEED_SPIKE_REJECTED'), 'Impossible GPS speed spike is flagged and rejected');
  assert(jumpResult.distanceKm === 0, 'No distance jump attributed on impossible speed spike');

  // Poor accuracy fix (> 45m)
  noiseEngine.processGpsPosition({ latitude: 18.5200, longitude: 73.8500, accuracy: 65, speed: 4.0, timestamp: startTime + 2000 });
  assert(noiseEngine.cyclingFlags.includes('POOR_GPS_ACCURACY'), 'Poor accuracy (>45m) is flagged');

  // --------------------------------------------------------
  // TEST I: START / STOP / START IDEMPOTENCY
  // --------------------------------------------------------
  console.log('\n--- TEST I: START / STOP / START IDEMPOTENCY ---');
  stepCountingEngine.reset();
  for (let iter = 0; iter < 5; iter++) {
    stepCountingEngine.setTransportMode('WALKING', 0);
    stepCountingEngine.registerStep(Date.now(), 2);
    stepCountingEngine.reset();
  }
  assert(stepCountingEngine.getCounts().sessionSteps === 0, 'After repeated resets, session steps stays clean at 0');

  console.log('\n======================================================');
  console.log('🎉 ALL ACCEPTANCE TESTS (A THROUGH I) PASSED PERFECTLY!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
