const cityNetworkService = require('../services/cityNetworkService');

/**
 * Controller for City Mobility Overview Dashboard
 */
class CityNetworkController {
  /**
   * Main unified overview endpoint
   * GET /api/city-network/overview
   */
  async getOverview(req, res) {
    try {
      const { dateFilter, modeFilter, isDemo, timeRange, mode } = req.query;
      const data = await cityNetworkService.getCityMobilityOverview({
        dateFilter: dateFilter || timeRange || 'ALL_TIME',
        modeFilter: modeFilter || mode || 'ALL',
        isDemo,
      });

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('[CityNetworkController.getOverview] Error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch City Mobility Overview data.',
      });
    }
  }

  /**
   * Summary Cards only
   * GET /api/city-network/summary
   */
  async getSummary(req, res) {
    try {
      const { dateFilter, modeFilter, isDemo } = req.query;
      const data = await cityNetworkService.getCityMobilityOverview({ dateFilter, modeFilter, isDemo });
      return res.status(200).json({
        success: true,
        data: data.summary,
        isDemo: data.isDemo,
        hasData: data.hasData,
      });
    } catch (error) {
      console.error('[CityNetworkController.getSummary] Error:', error.message);
      return res.status(500).json({ success: false, error: 'Failed to fetch summary.' });
    }
  }

  /**
   * Walking Analysis only
   * GET /api/city-network/walking
   */
  async getWalking(req, res) {
    try {
      const { dateFilter, isDemo } = req.query;
      const data = await cityNetworkService.getCityMobilityOverview({ dateFilter, modeFilter: 'WALKING', isDemo });
      return res.status(200).json({
        success: true,
        data: data.walking,
        isDemo: data.isDemo,
      });
    } catch (error) {
      console.error('[CityNetworkController.getWalking] Error:', error.message);
      return res.status(500).json({ success: false, error: 'Failed to fetch walking analysis.' });
    }
  }

  /**
   * Cycling Analysis only
   * GET /api/city-network/cycling
   */
  async getCycling(req, res) {
    try {
      const { dateFilter, isDemo } = req.query;
      const data = await cityNetworkService.getCityMobilityOverview({ dateFilter, modeFilter: 'CYCLING', isDemo });
      return res.status(200).json({
        success: true,
        data: data.cycling,
        isDemo: data.isDemo,
      });
    } catch (error) {
      console.error('[CityNetworkController.getCycling] Error:', error.message);
      return res.status(500).json({ success: false, error: 'Failed to fetch cycling analysis.' });
    }
  }

  /**
   * EV Mobility Analysis only
   * GET /api/city-network/ev
   */
  async getEv(req, res) {
    try {
      const { dateFilter, isDemo } = req.query;
      const data = await cityNetworkService.getCityMobilityOverview({ dateFilter, modeFilter: 'EV', isDemo });
      return res.status(200).json({
        success: true,
        data: data.ev,
        isDemo: data.isDemo,
      });
    } catch (error) {
      console.error('[CityNetworkController.getEv] Error:', error.message);
      return res.status(500).json({ success: false, error: 'Failed to fetch EV mobility analysis.' });
    }
  }

  /**
   * Public Transport Analysis only
   * GET /api/city-network/public-transport
   */
  async getPublicTransport(req, res) {
    try {
      const { dateFilter, isDemo } = req.query;
      const data = await cityNetworkService.getCityMobilityOverview({ dateFilter, modeFilter: 'PUBLIC_TRANSPORT', isDemo });
      return res.status(200).json({
        success: true,
        data: data.publicTransport,
        isDemo: data.isDemo,
      });
    } catch (error) {
      console.error('[CityNetworkController.getPublicTransport] Error:', error.message);
      return res.status(500).json({ success: false, error: 'Failed to fetch public transport analysis.' });
    }
  }

  /**
   * Environmental Impact (CO2) only
   * GET /api/city-network/co2
   */
  async getCo2(req, res) {
    try {
      const { dateFilter, modeFilter, isDemo } = req.query;
      const data = await cityNetworkService.getCityMobilityOverview({ dateFilter, modeFilter, isDemo });
      return res.status(200).json({
        success: true,
        data: data.environmentalImpact,
        isDemo: data.isDemo,
      });
    } catch (error) {
      console.error('[CityNetworkController.getCo2] Error:', error.message);
      return res.status(500).json({ success: false, error: 'Failed to fetch CO2 environmental impact.' });
    }
  }
}

module.exports = new CityNetworkController();
