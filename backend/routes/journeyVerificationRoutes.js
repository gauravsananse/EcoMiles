const express = require('express');
const router = express.Router();
const {
  startJourney,
  processSensorData,
  runInferenceOnly,
  endJourney,
  getJourney,
  getJourneySegments,
  deleteJourney,
} = require('../controllers/journeyVerificationController');
const { optionalAuth } = require('../middleware/authMiddleware');
const fraudDetectionService = require('../services/fraudDetectionService');

// Start new journey
router.post('/start', optionalAuth, startJourney);

// Stream and process sensor data window
router.post('/sensor-data', optionalAuth, processSensorData);

// Stateless ML inference endpoint
router.post('/inference', optionalAuth, runInferenceOnly);

// Verify journey segment / state
router.post('/verify', optionalAuth, async (req, res) => {
  try {
    const { journeyId } = req.body;
    if (!journeyId) {
      return res.status(400).json({ success: false, error: 'journeyId is required' });
    }
    const Journey = require('../models/Journey');
    const journey = await Journey.findById(journeyId);
    if (!journey) {
      return res.status(404).json({ success: false, error: 'Journey not found' });
    }
    return res.status(200).json({
      success: true,
      verificationStatus: journey.overallFraudScore > 50 ? 'HELD' : 'VERIFIED',
      fraudScore: journey.overallFraudScore,
      segments: journey.segments,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// End journey and finalize rewards
router.post('/end', optionalAuth, endJourney);

// Get journey details
router.get('/:id', optionalAuth, getJourney);

// Get journey segments
router.get('/:id/segments', optionalAuth, getJourneySegments);

// Get journey rewards status
router.get('/:id/rewards', optionalAuth, async (req, res) => {
  try {
    const RewardTransaction = require('../models/RewardTransaction');
    const transactions = await RewardTransaction.find({ journeyId: req.params.id });
    return res.status(200).json({ success: true, count: transactions.length, transactions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Delete journey (Privacy requirement)
router.delete('/:id', optionalAuth, deleteJourney);

module.exports = router;
