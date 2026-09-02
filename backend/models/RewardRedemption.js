const mongoose = require('mongoose');

const rewardRedemptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  rewardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reward',
    required: true,
  },
  rewardTitle: {
    type: String,
    required: true,
  },
  partner: {
    type: String,
    required: true,
  },
  partnerUrl: {
    type: String,
    default: 'https://in.fastandup.com/',
  },
  buttonText: {
    type: String,
    default: 'Shop Now',
  },
  discountValue: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['FITNESS', 'GREEN'],
    required: true,
  },
  voucherCode: {
    type: String,
    required: true,
    unique: true,
  },
  pointsSpent: {
    type: Number,
    required: true,
  },
  pointsType: {
    type: String,
    enum: ['FITNESS_POINTS', 'GREEN_CREDITS'],
    required: true,
  },
  redeemedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000), // 30 days validity
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
});

const RewardRedemption = mongoose.model('RewardRedemption', rewardRedemptionSchema);

module.exports = RewardRedemption;
