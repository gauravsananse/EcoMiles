const Reward = require('../models/Reward');
const RewardRedemption = require('../models/RewardRedemption');
const User = require('../models/User');
const crypto = require('crypto');

// Initial seed catalog for immediate production-ready experience
const initialRewards = [
  // 1. Fast&Up (Fitness / Nutrition)
  {
    title: 'Fast&Up Plant Protein & Hydration Electrolytes',
    category: 'FITNESS',
    subcategory: 'Nutrition',
    partner: 'Fast&Up',
    discountValue: 'Flat ₹300 OFF',
    pointsRequired: 50,
    pointsType: 'FITNESS_POINTS',
    description: 'Premium vegan protein powders and effervescent daily electrolytes.',
    voucherCode: 'GREENFAST300',
    partnerUrl: 'https://in.fastandup.com/',
    buttonText: 'Shop at Fast&Up',
    badgeText: 'Nutrition',
    iconType: 'bottle',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
  // 2. Decathlon (Fitness / Sports & Cycling)
  {
    title: 'Decathlon Sportswear & Cycling Accessories',
    category: 'FITNESS',
    subcategory: 'Sports & Cycling',
    partner: 'Decathlon',
    discountValue: '25% OFF',
    pointsRequired: 60,
    pointsType: 'FITNESS_POINTS',
    description: 'Get flat 25% off on activewear, running shoes, and cycling helmets.',
    voucherCode: 'GREENDECATH25',
    partnerUrl: 'https://www.decathlon.in/',
    buttonText: 'Shop at Decathlon',
    badgeText: 'Sports & Cycling',
    iconType: 'cycling',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
  // 3. Cult.fit (Fitness / Gym Pass)
  {
    title: 'Cult.fit 1-Month All-Access Gym Pass',
    category: 'FITNESS',
    subcategory: 'Fitness Perks',
    partner: 'cult.fit',
    discountValue: '₹750 OFF',
    pointsRequired: 80,
    pointsType: 'FITNESS_POINTS',
    description: 'Valid across 300+ Cult centers for strength, cardio, and yoga sessions.',
    voucherCode: 'GREENCULT750',
    partnerUrl: 'https://www.cult.fit/',
    buttonText: 'Get Cult.fit Pass',
    badgeText: 'Fitness Perks',
    iconType: 'gym',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
  // 4. Amazon India (Fitness / Shopping)
  {
    title: 'Amazon India – Eco & Fitness Essentials',
    category: 'FITNESS',
    subcategory: 'Fitness Perks',
    partner: 'Amazon India',
    discountValue: '₹200 Amazon Gift Voucher',
    pointsRequired: 70,
    pointsType: 'FITNESS_POINTS',
    description: 'Redeem for sports gear, gym accessories, yoga mats, and organic fitness foods.',
    voucherCode: 'GREENAMAZON200',
    partnerUrl: 'https://www.amazon.in/',
    buttonText: 'Shop on Amazon',
    badgeText: 'Fitness Perks',
    iconType: 'shopping',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
  // 5. Myntra (Green / Sustainable Fashion)
  {
    title: 'Myntra Sustainable Cotton & Eco-Apparel',
    category: 'GREEN',
    subcategory: 'Sustainable Fashion',
    partner: 'Myntra',
    discountValue: '₹500 OFF',
    pointsRequired: 75,
    pointsType: 'GREEN_CREDITS',
    description: 'Organic certified cotton apparel and recycled fiber sustainable clothing.',
    voucherCode: 'GREENMYNTRA500',
    partnerUrl: 'https://www.myntra.com/',
    buttonText: 'Shop at Myntra',
    badgeText: 'Sustainable Fashion',
    iconType: 'fashion',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
  // 6. SankalpTaru (Green / Climate Action)
  {
    title: 'SankalpTaru – Plant a Tree in Your Name with Geo-Tag',
    category: 'GREEN',
    subcategory: 'Climate Action',
    partner: 'SankalpTaru Foundation',
    discountValue: '1 Free Geo-Tagged Tree',
    pointsRequired: 90,
    pointsType: 'GREEN_CREDITS',
    description: 'Sponsor a live fruit-bearing tree planted in rural India with GPS tracking and certificate.',
    voucherCode: 'GREENSANKALP',
    partnerUrl: 'https://sankalptaru.org/',
    buttonText: 'Plant My Tree',
    badgeText: 'Climate Action',
    iconType: 'plant',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
  // 7. BECO (Green / Eco Products)
  {
    title: 'Beco 100% Bamboo Eco-Stationery & Living Kit',
    category: 'GREEN',
    subcategory: 'Eco Products',
    partner: 'BECO',
    discountValue: '40% OFF',
    pointsRequired: 50,
    pointsType: 'GREEN_CREDITS',
    description: 'Zero-plastic bamboo home essentials, eco-stationery, and reusable living kits.',
    voucherCode: 'GREENBECO40',
    partnerUrl: 'https://www.letsbeco.com/',
    buttonText: 'Shop at BECO',
    badgeText: 'Eco Products',
    iconType: 'plant',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
  // 8. Flipkart (Green / Eco Products)
  {
    title: 'Flipkart Sports, Fitness & Eco-Living Store',
    category: 'GREEN',
    subcategory: 'Eco Products',
    partner: 'Flipkart',
    discountValue: '₹150 OFF Voucher',
    pointsRequired: 50,
    pointsType: 'GREEN_CREDITS',
    description: 'Redeem across Sports & Fitness, Food & Health, and eco-friendly household goods.',
    voucherCode: 'GREENFLIP150',
    partnerUrl: 'https://www.flipkart.com/',
    buttonText: 'Shop on Flipkart',
    badgeText: 'Eco Products',
    iconType: 'shopping',
    expiryDate: '30 Sep 2026',
    isActive: true,
  },
];

// @desc    Get all rewards catalog
// @route   GET /api/rewards
// @access  Public / Private
exports.getRewards = async (req, res) => {
  try {
    let rewards = await Reward.find({ isActive: true }).sort({ pointsRequired: 1 });

    // Seed if empty or incomplete
    if (rewards.length < initialRewards.length) {
      for (const item of initialRewards) {
        const existing = await Reward.findOne({ partner: item.partner, title: item.title });
        if (!existing) {
          await Reward.create(item);
        } else {
          // Update existing with partnerUrl, buttonText, etc.
          existing.partnerUrl = item.partnerUrl;
          existing.buttonText = item.buttonText;
          existing.voucherCode = item.voucherCode;
          existing.expiryDate = item.expiryDate;
          existing.subcategory = item.subcategory;
          await existing.save();
        }
      }
      rewards = await Reward.find({ isActive: true }).sort({ pointsRequired: 1 });
    }

    const category = req.query.category;
    if (category && category !== 'ALL') {
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

    // Check if user has already redeemed this specific reward
    const existingRedemption = await RewardRedemption.findOne({
      userId: user._id,
      rewardId: reward._id,
    });

    if (existingRedemption) {
      return res.status(200).json({
        success: true,
        alreadyRedeemed: true,
        message: 'You have already unlocked this voucher.',
        redemption: existingRedemption,
        updatedBalances: {
          fitnessPoints: user.fitnessPoints || 0,
          greenCredits: user.greenCredits || 0,
        },
      });
    }

    // Check balance
    const isFitness = reward.pointsType === 'FITNESS_POINTS';
    const userBalance = isFitness ? (user.fitnessPoints || 0) : (user.greenCredits || 0);

    if (userBalance < reward.pointsRequired) {
      return res.status(400).json({
        success: false,
        error: `Insufficient ${isFitness ? 'Fitness Points' : 'Green Credits'}. You have ${userBalance}, but need ${reward.pointsRequired}.`,
        required: reward.pointsRequired,
        currentBalance: userBalance,
        pointsType: reward.pointsType,
      });
    }

    // Deduct points
    if (isFitness) {
      user.fitnessPoints = Math.max(0, (user.fitnessPoints || 0) - reward.pointsRequired);
    } else {
      user.greenCredits = Math.max(0, (user.greenCredits || 0) - reward.pointsRequired);
    }
    await user.save();

    // Use partner voucher code template
    const voucherCode = reward.voucherCode || `GREEN-${reward.partner.substring(0, 4).toUpperCase()}`;

    // Create redemption record
    const redemption = await RewardRedemption.create({
      userId: user._id,
      rewardId: reward._id,
      rewardTitle: reward.title,
      partner: reward.partner,
      partnerUrl: reward.partnerUrl || 'https://in.fastandup.com/',
      buttonText: reward.buttonText || 'Shop Now',
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

// @desc    Track partner "Shop Now" click for admin analytics
// @route   POST /api/rewards/track-click
// @access  Public / Private
exports.trackPartnerClick = async (req, res) => {
  try {
    const { rewardId, partner, voucherCode, action } = req.body;
    const userId = req.user ? req.user._id : 'anonymous';

    if (rewardId) {
      await Reward.findByIdAndUpdate(rewardId, { $inc: { partnerClicksCount: 1 } });
    }

    console.log(`[PartnerTracking] Click: user=${userId}, partner=${partner}, rewardId=${rewardId}, voucher=${voucherCode}, action=${action || 'partner_redirect'}`);

    return res.status(200).json({
      success: true,
      message: 'Click tracked successfully.',
      loggedEvent: {
        userId,
        rewardId,
        partner,
        voucherCode,
        clickedAt: new Date().toISOString(),
        action: action || 'partner_redirect',
      },
    });
  } catch (error) {
    console.error('[RewardController.trackPartnerClick] Error:', error.message);
    return res.status(200).json({ success: true }); // Fail-safe
  }
};
