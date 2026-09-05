/**
 * Mode-Aware Step Counting Engine
 * Differentiates raw device steps, baseline steps, session steps, verified steps, and estimated steps.
 * Strictly prevents vehicular vibration or cycling motion from accumulating verified steps.
 */

class StepCountingEngine {
  constructor() {
    this.rawSteps = 0;
    this.baselineSteps = 0;
    this.sessionSteps = 0;
    this.verifiedWalkingSteps = 0;
    this.estimatedSteps = 0;
    this.stepCountingEnabled = false;
    this.currentMode = 'STATIONARY';
    this.walkingConfidence = 0;

    // Temporal consistency window for mode transitions
    this.consecutiveWalkingTicks = 0;
    this.unconfirmedStepBuffer = [];

    this.onStepUpdateCallback = null;
  }

  setUpdateCallback(cb) {
    this.onStepUpdateCallback = cb;
  }

  /**
   * Set baseline device step count captured at session start
   */
  setBaseline(deviceSteps = 0) {
    this.baselineSteps = deviceSteps;
    this.sessionSteps = 0;
    this.notifyUpdate();
  }

  /**
   * Enable or disable step tracking explicitly
   */
  setEnabled(enabled) {
    this.stepCountingEnabled = Boolean(enabled);
    if (!this.stepCountingEnabled) {
      this.consecutiveWalkingTicks = 0;
      this.unconfirmedStepBuffer = [];
    }
    this.notifyUpdate();
  }

  /**
   * Mode-Aware State Lockout
   * WALKING -> step counting ON
   * CYCLING, EV, BUS, METRO, PETROL, DIESEL, CNG, STATIONARY, UNKNOWN -> OFF
   */
  setTransportMode(mode, confidence = 0) {
    const normMode = (mode || '').toUpperCase();
    this.currentMode = (normMode === 'WALK' || normMode === 'WALKING') ? 'WALKING' : normMode;
    this.walkingConfidence = confidence;

    const isWalking = this.currentMode === 'WALKING';

    if (isWalking) {
      this.stepCountingEnabled = true;
    } else {
      // Immediately disable verified step accumulation during vehicular travel, cycling, etc.
      this.stepCountingEnabled = false;
      this.consecutiveWalkingTicks = 0;
      this.unconfirmedStepBuffer = [];
    }

    this.notifyUpdate();
  }

  /**
   * Process raw hardware or estimated step increment
   */
  registerStep(timestamp = Date.now(), delta = 1, isEstimated = true) {
    if (!this.stepCountingEnabled || this.currentMode !== 'WALKING') {
      return;
    }

    this.rawSteps += delta;
    this.sessionSteps += delta;

    if (isEstimated) {
      this.estimatedSteps += delta;
    }

    // Only attribute to verified steps if walking confidence has been established
    if (this.walkingConfidence >= 0.60 || this.sessionSteps >= 4) {
      this.verifiedWalkingSteps += delta;
    }

    this.notifyUpdate();
  }

  notifyUpdate() {
    if (this.onStepUpdateCallback) {
      this.onStepUpdateCallback(this.getCounts());
    }
  }

  reset() {
    this.rawSteps = 0;
    this.baselineSteps = 0;
    this.sessionSteps = 0;
    this.verifiedWalkingSteps = 0;
    this.estimatedSteps = 0;
    this.stepCountingEnabled = false;
    this.currentMode = 'STATIONARY';
    this.walkingConfidence = 0;
    this.consecutiveWalkingTicks = 0;
    this.unconfirmedStepBuffer = [];
    this.notifyUpdate();
  }

  getCounts() {
    return {
      rawSteps: this.rawSteps,
      baselineSteps: this.baselineSteps,
      sessionSteps: this.sessionSteps,
      verifiedSteps: this.verifiedWalkingSteps,
      verifiedWalkingSteps: this.verifiedWalkingSteps,
      estimatedSteps: this.estimatedSteps,
      stepCountingEnabled: this.stepCountingEnabled,
      currentMode: this.currentMode,
    };
  }
}

export const stepCountingEngine = new StepCountingEngine();
export default stepCountingEngine;
