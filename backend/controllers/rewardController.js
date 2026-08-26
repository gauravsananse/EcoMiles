const Reward = require('../models/Reward');
const RewardRedemption = require('../models/RewardRedemption');
const User = require('../models/User');
const crypto = require('crypto');

// Initial seed catalog for immediate production-ready experience
const initialRewards = [
  // Fitness Category
  {
    title: 'Cult.fit 1-Month All-Access Gym Pass',
    category: 'FITNESS',
    partner: 'Cult.fit',
    discountValue: '₹750 OFF',
    pointsRequired: 80,
    pointsType: 'FITNESS_POINTS',
    description: 'Valid across 300+ Cult centers for strength, cardio, and yoga sessions.',
    badgeText: 'Trending',
    iconType: 'gym',
  },
  {
    title: 'Decathlon Sportswear & Cycling Accessories',
    category: 'FITNESS',
    partner: 'Decathlon',
    discountValue: '25% OFF',
    pointsRequired: 60,
    pointsType: 'FITNESS_POINTS',
    description: 'Get flat 25% off on all activewear, running shoes, and cycling helmets.',
    badgeText: 'Popular',
    iconType: 'cycling',
  },
  {
    title: 'Fast&Up Plant Protein & Hydration Electrolytes',
    category: 'FITNESS',
    partner: 'Fast&Up',
    discountValue: 'Flat ₹300 OFF',
    pointsRequired: 50,
    pointsType: 'FITNESS_POINTS',
    description: 'Premium vegan protein powders and effervescent daily electrolytes.',
    badgeText: 'Nutrition',
    iconType: 'bottle',
  },
  // Green Category
  {
    title: 'Beco 100% Bamboo Eco-Stationery & Living Kit',
    category: 'GREEN',
    partner: 'Beco Living',
    discountValue: '40% OFF',
    pointsRequired: 50,
    pointsType: 'GREEN_CREDITS',
    description: 'Zero-plastic bamboo notebooks, plantable seed pens, and reusable bottles.',
    badgeText: 'Eco-Hero',
    iconType: 'plant',
  },
  {
    title: 'Myntra Sustainable Cotton & Eco-Apparel',
    category: 'GREEN',
    partner: 'Myntra Earth',
    discountValue: '₹500 OFF',
    pointsRequired: 75,
    pointsType: 'GREEN_CREDITS',
    description: 'Organic certified cotton apparel and recycled fiber sustainable clothing.',
    badgeText: 'Sustainable',
    iconType: 'fashion',
  },
  {
    title: 'SankalpTaru - Plant a Tree in Your Name with Geo-Tag',
    category: 'GREEN',
    partner: 'SankalpTaru Foundation',
    discountValue: '1 Free Tree',
    pointsRequired: 90,
    pointsType: 'GREEN_CREDITS',
    description: 'Sponsor a live fruit-bearing tree planted in rural India with GPS tracking and certificate.',
    badgeText: 'Climate Action',
    iconType: 'plant',
  },
];

// @desc    Get all rewards catalog
// @route   GET /api/rewards
// @access  Public / Private
exports.getRewards = async (req, res) => {
  try {
    let rewards = await Reward.find({ isActive: true }).sort({ pointsRequired: 1 });

    // Seed if empty
    if (rewards.length === 0) {
      rewards = await Reward.insertMany(initialRewards);
    }

    const category = req.query.category;
    if (category) {
      rewards = rewards.filter((r) => r.category === category.toUpperCase());
    }

    return res.status(200).json({
      success: true,
      count: rewards.length,
      rewards,
    });
  } catch (error) {
    console.error('[RewardController.getRewards] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch rewards catalog.',
    });
  }
};

// @desc    Redeem a reward with Fitness Points or Green Credits
// @route   POST /api/rewards/redeem
// @access  Private
exports.redeemReward = async (req, res) => {
  try {
    const { rewardId } = req.body;

    if (!rewardId) {
      return res.status(400).json({
        success: false,
        error: 'Reward ID is required for redemption.',
      });
    }

    const reward = await Reward.findById(rewardId);
    if (!reward) {
      return res.status(404).json({
        success: false,
        error: 'Reward not found or no longer available.',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // Check balance
    const isFitness = reward.pointsType === 'FITNESS_POINTS';
    const userBalance = isFitness ? (user.fitnessPoints || 0) : (user.greenCredits || 0);

    if (userBalance < reward.pointsRequired) {
      return res.status(400).json({
        success: false,
        error: `Insufficient ${isFitness ? 'Fitness Points' : 'Green Credits'}. You have ${userBalance}, but need ${reward.pointsRequired}.`,
      });
    }

    // Deduct points
    if (isFitness) {
      user.fitnessPoints -= reward.pointsRequired;
    } else {
      user.greenCredits -= reward.pointsRequired;
    }
    await user.save();

    // Generate unique promo voucher code
    const prefix = isFitness ? 'FIT' : 'GRN';
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const voucherCode = `${prefix}-${reward.partner.substring(0, 4).toUpperCase()}-${randomHex}`;

    // Create redemption record
    const redemption = await RewardRedemption.create({
      userId: user._id,
      rewardId: reward._id,
      rewardTitle: reward.title,
      partner: reward.partner,
      discountValue: reward.discountValue,
      category: reward.category,
      voucherCode,
      pointsSpent: reward.pointsRequired,
      pointsType: reward.pointsType,
      redeemedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: `Successfully redeemed ${reward.title}!`,
      redemption,
      updatedBalances: {
        fitnessPoints: user.fitnessPoints,
        greenCredits: user.greenCredits,
      },
    });
  } catch (error) {
    console.error('[RewardController.redeemReward] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to process reward redemption.',
    });
  }
};

// @desc    Get current user's redeemed vouchers
// @route   GET /api/rewards/my-redemptions
// @access  Private
exports.getMyRedemptions = async (req, res) => {
  try {
    const redemptions = await RewardRedemption.find({ userId: req.user._id })
      .sort({ redeemedAt: -1 });

    return res.status(200).json({
      success: true,
      count: redemptions.length,
      redemptions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch redeemed vouchers.',
    });
  }
};
