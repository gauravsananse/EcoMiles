const express = require('express');
const router = express.Router();
const journeyController = require('../controllers/journeyController');
const { protect } = require('../middleware/authMiddleware');

router.post('/record', protect, journeyController.recordJourney);
router.get('/history', protect, journeyController.getJourneyHistory);

module.exports = router;
