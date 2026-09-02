/**
 * Centralized Journey State Manager / State Machine
 * Single authoritative source of truth for journey state and mode transitions.
 */

import { notificationService } from './notificationService';
import { stepCountingEngine } from './stepCountingEngine';
import { bluetoothEVService } from './bluetoothEVService';

export const JOURNEY_STATES = {
  READY: 'READY',
  STARTING: 'STARTING',
  WALKING: 'WALKING',
  CYCLING: 'CYCLING',
  VEHICLE_DETECTED: 'VEHICLE_DETECTED',
  EV_VERIFICATION_REQUIRED: 'EV_VERIFICATION_REQUIRED',
  EV_VERIFIED: 'EV_VERIFIED',
  PUBLIC_TRANSPORT_CANDIDATE: 'PUBLIC_TRANSPORT_CANDIDATE',
  PUBLIC_TRANSPORT_ROUTE_SELECTION: 'PUBLIC_TRANSPORT_ROUTE_SELECTION',
  PUBLIC_TRANSPORT_VERIFYING: 'PUBLIC_TRANSPORT_VERIFYING',
  PUBLIC_TRANSPORT_VERIFIED: 'PUBLIC_TRANSPORT_VERIFIED',
  VERIFICATION_WARNING: 'VERIFICATION_WARNING',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
};

class JourneyStateMachine {
  constructor() {
    this.state = {
      journeyId: null,
      status: JOURNEY_STATES.READY,
      detectedMode: 'STATIONARY',
      verifiedMode: 'STATIONARY',
      confidence: 0.95,
      verificationStatus: 'UNVERIFIED', // 'UNVERIFIED' | 'VERIFYING' | 'VERIFIED' | 'WARNING' | 'FAILED'
      activeSegmentId: null,
      stepCountingEnabled: true,
      greenCreditEligible: true,
      lastVerificationTime: Date.now(),
      registeredVehicle: null,
      activeTransitRoute: null,
      candidateRoutes: [],
      warningMessage: '',
      eventsTimeline: [],
    };

    this.subscribers = new Set();
  }

  /**
   * Subscribe to state updates
   */
  subscribe(fn) {
    this.subscribers.add(fn);
    fn(this.state);
    return () => this.subscribers.delete(fn);
  }

  notify() {
    this.subscribers.forEach((fn) => fn({ ...this.state }));
  }

  getState() {
    return { ...this.state };
  }

  /**
   * Initialize a new journey session
   */
  startJourney(journeyId, initialMode = 'WALKING', registeredVehicle = null) {
    const isCycling = initialMode === 'CYCLING';
    const startState = isCycling ? JOURNEY_STATES.CYCLING : JOURNEY_STATES.WALKING;

    this.state = {
      ...this.state,
      journeyId,
      status: startState,
      detectedMode: initialMode,
      verifiedMode: initialMode,
      confidence: 0.95,
      verificationStatus: 'VERIFIED',
      stepCountingEnabled: !isCycling,
      greenCreditEligible: true,
      lastVerificationTime: Date.now(),
      registeredVehicle,
      activeTransitRoute: null,
      candidateRoutes: [],
      warningMessage: '',
      eventsTimeline: [
        {
          timestamp: new Date(),
          state: startState,
          text: `Journey initiated in ${initialMode} mode.`,
          severity: 'INFO',
        },
      ],
    };

    stepCountingEngine.setTransportMode(initialMode, 0.95);
    this.notify();
  }

  /**
   * Trigger Vehicle Detected Transition (plays beep & opens prompt)
   */
  triggerVehicleDetected(candidateRoutes = []) {
    const prevStatus = this.state.status;
    if (prevStatus === JOURNEY_STATES.VEHICLE_DETECTED || prevStatus === JOURNEY_STATES.EV_VERIFIED || prevStatus === JOURNEY_STATES.PUBLIC_TRANSPORT_VERIFIED) {
      return;
    }

    const regVehicle = this.state.registeredVehicle;
    const isEV = regVehicle && (regVehicle.fuelType === 'ELECTRIC' || regVehicle.vehicleType === 'EV');
    const isFossilFuel = regVehicle && ['PETROL', 'DIESEL', 'CNG'].includes((regVehicle.fuelType || '').toUpperCase());

    let nextState = JOURNEY_STATES.VEHICLE_DETECTED;
    if (isEV) {
      nextState = JOURNEY_STATES.EV_VERIFICATION_REQUIRED;
    } else if (candidateRoutes && candidateRoutes.length > 0) {
      nextState = JOURNEY_STATES.PUBLIC_TRANSPORT_CANDIDATE;
    }

    this.state = {
      ...this.state,
      status: nextState,
      detectedMode: 'VEHICLE_LIKE',
      stepCountingEnabled: false,
      greenCreditEligible: isEV,
      candidateRoutes,
    };

    stepCountingEngine.setTransportMode('VEHICLE', 0.9);

    // Audio Cue
    if (isEV) {
      notificationService.playVerificationRequiredBeep();
    } else {
      notificationService.playVehicleDetectedBeep();
    }

    this.logEvent(`Vehicle movement detected. Transitioned to ${nextState}.`, 'WARNING');
    this.notify();
  }

  /**
   * Set EV Verified state
   */
  setEVVerified(bluetoothIdentifier) {
    this.state = {
      ...this.state,
      status: JOURNEY_STATES.EV_VERIFIED,
      detectedMode: 'EV',
      verifiedMode: 'EV',
      verificationStatus: 'VERIFIED',
      confidence: 0.98,
      stepCountingEnabled: false,
      greenCreditEligible: true,
      lastVerificationTime: Date.now(),
      warningMessage: '',
    };

    stepCountingEngine.setTransportMode('EV', 0.98);
    notificationService.playVerificationSuccess();
    this.logEvent(`EV Verified via Bluetooth (${bluetoothIdentifier || 'GC-EV'}). Green Credits active.`, 'SUCCESS');
    this.notify();
  }

  /**
   * Set EV Verification Warning (BLE connection temporarily lost)
   */
  setEVVerificationWarning(message = '⚠️ EV verification temporarily lost. Reconnecting...') {
    this.state = {
      ...this.state,
      status: JOURNEY_STATES.VERIFICATION_WARNING,
      verificationStatus: 'WARNING',
      warningMessage: message,
    };

    notificationService.playVerificationWarning();
    this.logEvent(message, 'WARNING');
    this.notify();
  }

  /**
   * Set EV Verification Failed (Grace period expired or BLE lost while in motion)
   */
  setEVVerificationFailed(reason = 'EV verification lost.') {
    this.state = {
      ...this.state,
      status: JOURNEY_STATES.VERIFICATION_FAILED,
      verifiedMode: 'UNKNOWN',
      verificationStatus: 'FAILED',
      greenCreditEligible: false,
      warningMessage: reason,
    };

    notificationService.playVerificationWarning();
    this.logEvent(`EV Verification failed: ${reason}. Green Credits paused.`, 'ERROR');
    this.notify();
  }

  /**
   * Set Public Transport Candidate / Route Selection
   */
  setPublicTransportCandidates(routes) {
    this.state = {
      ...this.state,
      status: JOURNEY_STATES.PUBLIC_TRANSPORT_CANDIDATE,
      candidateRoutes: routes,
    };
    notificationService.playVerificationRequiredBeep();
    this.logEvent(`Public transport corridor detected with ${routes.length} candidate route(s).`, 'INFO');
    this.notify();
  }

  /**
   * User Confirms Public Transport Route
   */
  confirmPublicTransportRoute(route) {
    this.state = {
      ...this.state,
      status: JOURNEY_STATES.PUBLIC_TRANSPORT_VERIFYING,
      activeTransitRoute: route,
      detectedMode: route.mode || 'BUS',
      verifiedMode: route.mode || 'BUS',
      verificationStatus: 'VERIFYING',
      confidence: 0.75,
      stepCountingEnabled: false,
      greenCreditEligible: true,
    };

    stepCountingEngine.setTransportMode(route.mode || 'BUS', 0.85);
    this.logEvent(`Route ${route.name || route.routeId} selected. Verifying trajectory...`, 'INFO');
    this.notify();
  }

  /**
   * Public Transport Confirmed & Verified
   */
  setPublicTransportVerified(confidence = 0.9, routeName = 'Bus Route') {
    this.state = {
      ...this.state,
      status: JOURNEY_STATES.PUBLIC_TRANSPORT_VERIFIED,
      verificationStatus: 'VERIFIED',
      confidence,
      stepCountingEnabled: false,
      greenCreditEligible: true,
      lastVerificationTime: Date.now(),
    };

    notificationService.playVerificationSuccess();
    this.logEvent(`Public transport verified (${routeName}) with ${Math.round(confidence * 100)}% confidence.`, 'SUCCESS');
    this.notify();
  }

  /**
   * Transition back to Walking (user got off bus / vehicle)
   */
  resumeWalking() {
    this.state = {
      ...this.state,
      status: JOURNEY_STATES.WALKING,
      detectedMode: 'WALKING',
      verifiedMode: 'WALKING',
      verificationStatus: 'VERIFIED',
      confidence: 0.94,
      stepCountingEnabled: true,
      greenCreditEligible: true,
      activeTransitRoute: null,
      warningMessage: '',
    };

    stepCountingEngine.setTransportMode('WALKING', 0.94);
    this.logEvent('Pedestrian walking motion verified. Step counter resumed.', 'SUCCESS');
    this.notify();
  }

  /**
   * Pause / Resume Journey
   */
  pauseJourney() {
    this.state = {
      ...this.state,
      status: JOURNEY_STATES.PAUSED,
    };
    this.logEvent('Journey paused.', 'INFO');
    this.notify();
  }

  resumeJourney() {
    const prevMode = this.state.verifiedMode || 'WALKING';
    const nextState = prevMode === 'CYCLING' ? JOURNEY_STATES.CYCLING : JOURNEY_STATES.WALKING;
    this.state = {
      ...this.state,
      status: nextState,
    };
    this.logEvent('Journey resumed.', 'INFO');
    this.notify();
  }

  /**
   * Complete Journey
   */
  completeJourney() {
    this.state = {
      ...this.state,
      status: JOURNEY_STATES.COMPLETED,
    };
    bluetoothEVService.disconnect();
    this.logEvent('Journey finalized and verified.', 'SUCCESS');
    this.notify();
  }

  logEvent(text, severity = 'INFO') {
    const ev = {
      timestamp: new Date(),
      state: this.state.status,
      text,
      severity,
    };
    this.state.eventsTimeline = [...this.state.eventsTimeline.slice(-30), ev];
  }

  reset() {
    bluetoothEVService.disconnect();
    stepCountingEngine.reset();
    this.state = {
      journeyId: null,
      status: JOURNEY_STATES.READY,
      detectedMode: 'STATIONARY',
      verifiedMode: 'STATIONARY',
      confidence: 0.95,
      verificationStatus: 'UNVERIFIED',
      activeSegmentId: null,
      stepCountingEnabled: true,
      greenCreditEligible: true,
      lastVerificationTime: Date.now(),
      registeredVehicle: null,
      activeTransitRoute: null,
      candidateRoutes: [],
      warningMessage: '',
      eventsTimeline: [],
    };
    this.notify();
  }
}

export const journeyStateMachine = new JourneyStateMachine();
export default journeyStateMachine;
