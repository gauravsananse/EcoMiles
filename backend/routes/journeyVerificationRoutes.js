const express = require('express');
const router = express.Router();
const {
  startJourney,
  processSensorData,
  runInferenceOnly,
  verifyEV,
  confirmPublicTransport,
  getNearbyRoutes,
  logVerificationEvent,
  getVerificationEvents,
  updateSteps,
  endJourney,
  getJourney,
  getJourneySegments,
  deleteJourney,
  startSegment,
  completeSegment,
  getJourneySummary,
} = require('../controllers/journeyVerificationController');
const { optionalAuth } = require('../middleware/authMiddleware');

// ─── Journey lifecycle ────────────────────────────────────────────────────────
router.post('/start', optionalAuth, startJourney);
router.post('/end', optionalAuth, endJourney);

// ─── Sensor data & ML inference ──────────────────────────────────────────────
router.post('/sensor-data', optionalAuth, processSensorData);
router.post('/inference', optionalAuth, runInferenceOnly);

// ─── Nearby routes lookup ─────────────────────────────────────────────────────
router.get('/nearby-routes', optionalAuth, getNearbyRoutes);

// ─── Quick verify state ───────────────────────────────────────────────────────
router.post('/verify', optionalAuth, async (req, res) => {
  try {
    const { journeyId } = req.body;
    if (!journeyId) return res.status(400).json({ success: false, error: 'journeyId is required' });
    const Journey = require('../models/Journey');
    const journey = await Journey.findById(journeyId);
    if (!journey) return res.status(404).json({ success: false, error: 'Journey not found' });
    return res.status(200).json({
      success: true,
      journeyState: journey.journeyState,
      verificationStatus: journey.overallFraudScore > 50 ? 'HELD' : 'VERIFIED',
      fraudScore: journey.overallFraudScore,
      segments: journey.segments,
      verifiedWalkingSteps: journey.verifiedWalkingSteps,
      rawSteps: journey.rawSteps,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Per-journey: must come after static routes ───────────────────────────────

// EV Bluetooth Verification & Fossil Fuel Rejection
router.post('/:id/verify-ev', optionalAuth, verifyEV);

// Public Transport Candidate Confirmation & Verification
router.post('/:id/public-transport-confirm', optionalAuth, confirmPublicTransport);

// Verification Event Audit Logging & Retrieval
router.post('/:id/verification-event', optionalAuth, logVerificationEvent);
router.get('/:id/events', optionalAuth, getVerificationEvents);

// Mode-aware step update
router.post('/:id/steps', optionalAuth, updateSteps);

// ─── Multi-Segment Lifecycle (NEW) ────────────────────────────────────────────
// Start a new segment under same journey (Continue Journey)
router.post('/:id/segments/start', optionalAuth, startSegment);

// Complete an active segment and lock rewards
router.post('/:id/segments/:segmentIndex/complete', optionalAuth, completeSegment);

// ─── Journey detail views ─────────────────────────────────────────────────────
// Aggregated journey summary with combined points
router.get('/:id/summary', optionalAuth, getJourneySummary);

// All segments
router.get('/:id/segments', optionalAuth, getJourneySegments);

// Reward transactions
router.get('/:id/rewards', optionalAuth, async (req, res) => {
  try {
    const RewardTransaction = require('../models/RewardTransaction');
    const transactions = await RewardTransaction.find({ journeyId: req.params.id });
    return res.status(200).json({ success: true, count: transactions.length, transactions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Full journey document
router.get('/:id', optionalAuth, getJourney);

// Privacy: Delete journey & sensor records
router.delete('/:id', optionalAuth, deleteJourney);

module.exports = router;
