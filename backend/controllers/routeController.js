const smartRoutingService = require('../services/smartRoutingService');

// @desc    Calculate fitness-aware and eco-friendly smart multimodal routes
// @route   POST /api/routes/smart-plan
// @access  Public / Private
exports.planRoute = async (req, res) => {
  try {
    const { origin, destination } = req.body;
    const plan = smartRoutingService.planSmartRoute({
      origin: origin || 'Student Hostel / Sector A',
      destination: destination || 'Main Engineering Campus / IT Hub',
    });

    return res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    console.error('[RouteController.planRoute] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to plan smart route.',
    });
  }
};
