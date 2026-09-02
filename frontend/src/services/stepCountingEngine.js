/**
 * Mode-Aware Step Counting Engine
 * Strictly prevents vehicular vibration from accumulating verified steps.
 * Maintains rawSteps (hardware count) and verifiedWalkingSteps (verified pedestrian activity).
 */

import { JOURNEY_CONFIG } from './journeyConfig';

class StepCountingEngine {
  constructor() {
    this.rawSteps = 0;
    this.verifiedWalkingSteps = 0;
    this.stepCountingEnabled = true;
    this.currentMode = 'STATIONARY';
    this.walkingConfidence = 0.95;

    // Temporal consistency window for mode transitions
    this.consecutiveWalkingTicks = 0;
    this.TICKS_REQUIRED_TO_RESUME_WALKING = 3; // ~3-4 seconds of steady walking pattern
    this.unconfirmedStepBuffer = [];

    this.onStepUpdateCallback = null;
  }

  setUpdateCallback(cb) {
    this.onStepUpdateCallback = cb;
  }

  /**
   * Mode-Aware State Lockout
   * WALKING -> step counting ON
   * CYCLING, EV, BUS, METRO, PETROL, DIESEL, CNG, STATIONARY, UNKNOWN -> OFF
   */
  setTransportMode(mode, confidence = 0.9) {
    const normMode = (mode || '').toUpperCase();
    this.currentMode = normMode;
    this.walkingConfidence = confidence;

    const isWalking =
      normMode === 'WALKING' &&
      confidence >= JOURNEY_CONFIG.WALKING_CONFIDENCE_THRESHOLD;

    if (isWalking) {
      this.consecutiveWalkingTicks++;
      if (this.consecutiveWalkingTicks >= this.TICKS_REQUIRED_TO_RESUME_WALKING) {
        this.stepCountingEnabled = true;
        // Flush any valid buffered candidate steps
        if (this.unconfirmedStepBuffer.length > 0) {
          const flushed = this.unconfirmedStepBuffer.length;
          this.verifiedWalkingSteps += flushed;
          this.unconfirmedStepBuffer = [];
        }
      }
    } else {
      // Immediately disable verified step accumulation during vehicular travel or cycling
      this.stepCountingEnabled = false;
      this.consecutiveWalkingTicks = 0;
      this.unconfirmedStepBuffer = []; // Drop non-walking vibration artifacts
    }

    this.notifyUpdate();
  }

  /**
   * Process raw hardware step increment
   */
  registerStep(timestamp = Date.now(), delta = 1) {
    this.rawSteps += delta;

    if (this.stepCountingEnabled && this.currentMode === 'WALKING') {
      this.verifiedWalkingSteps += delta;
    } else if (this.currentMode === 'WALKING') {
      // In transition buffer
      for (let i = 0; i < delta; i++) {
        this.unconfirmedStepBuffer.push(timestamp);
      }
    }

    this.notifyUpdate();
  }

  notifyUpdate() {
    if (this.onStepUpdateCallback) {
      this.onStepUpdateCallback({
        rawSteps: this.rawSteps,
        verifiedWalkingSteps: this.verifiedWalkingSteps,
        stepCountingEnabled: this.stepCountingEnabled,
        currentMode: this.currentMode,
      });
    }
  }

  reset() {
    this.rawSteps = 0;
    this.verifiedWalkingSteps = 0;
    this.stepCountingEnabled = true;
    this.currentMode = 'STATIONARY';
    this.consecutiveWalkingTicks = 0;
    this.unconfirmedStepBuffer = [];
    this.notifyUpdate();
  }

  getCounts() {
    return {
      rawSteps: this.rawSteps,
      verifiedWalkingSteps: this.verifiedWalkingSteps,
      stepCountingEnabled: this.stepCountingEnabled,
    };
  }
}

export const stepCountingEngine = new StepCountingEngine();
export default stepCountingEngine;
