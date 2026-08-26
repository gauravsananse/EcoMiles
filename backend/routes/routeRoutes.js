const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');

router.post('/smart-plan', routeController.planRoute);

module.exports = router;
