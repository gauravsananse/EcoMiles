const express = require('express');
const router = express.Router();
const fraudDetectionService = require('../services/fraudDetectionService');
const sensorFusionService = require('../services/sensorFusionService');

// Analyze fraud for a sensor window
router.post('/analyze', async (req, res) => {
  try {
    const { sensorWindow } = req.body;
    if (!sensorWindow) {
      return res.status(400).json({ success: false, error: 'sensorWindow is required' });
    }
    const classification = sensorFusionService.classifyWindow(sensorWindow);
    const fraudResult = await fraudDetectionService.evaluateWindow(sensorWindow, classification);
    return res.status(200).json({
      success: true,
      fraudScore: fraudResult.fraudScore,
      riskLevel: fraudResult.riskLevel,
      fraudEvents: fraudResult.fraudEvents,
      isFlagged: fraudResult.isFlagged,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
