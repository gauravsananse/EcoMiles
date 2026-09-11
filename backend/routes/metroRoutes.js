const express = require('express');
const router = express.Router();
const metroController = require('../controllers/metroController');
const { optionalAuth } = require('../middleware/authMiddleware');

// 1. Ticket validation (QR Code decode & Anti-Replay check)
router.post('/verify-ticket', optionalAuth, metroController.verifyTicket);

// 2. Origin station geofencing verification
router.post('/verify-origin', optionalAuth, metroController.verifyOrigin);

// 3. Start active Metro journey
router.post('/start-journey', optionalAuth, metroController.startJourney);

// 4. Ingest GPS telemetry / tunnel grace period
router.post('/location', optionalAuth, metroController.recordLocation);

// 5. End journey & run multi-factor destination verification
router.post('/end-journey', optionalAuth, metroController.endJourney);

// 6. Metro stations list
router.get('/stations', metroController.getStations);

// 7. Full journey audit log & verification decision
router.get('/journey/:id', optionalAuth, metroController.getJourneyDetails);

// 8. Bus Ticket OCR validation & anti-replay
router.post('/bus/verify-ticket', optionalAuth, metroController.validateBusTicket);

// 9. Link ticket to active journey
router.post('/bus/join', optionalAuth, metroController.joinSharedBusTicket);
router.post('/link-ticket', optionalAuth, metroController.linkTicketToJourney);

module.exports = router;
