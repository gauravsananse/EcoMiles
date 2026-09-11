const express = require('express');
const router = express.Router();
const rewardController = require('../controllers/rewardController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', rewardController.getRewards);
router.post('/redeem', protect, rewardController.redeemReward);
router.get('/my-redemptions', protect, rewardController.getMyRedemptions);
router.get('/history', protect, rewardController.getRewardHistory);
router.post('/track-click', rewardController.trackPartnerClick);

module.exports = router;
