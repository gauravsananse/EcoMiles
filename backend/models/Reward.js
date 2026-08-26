const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    enum: ['FITNESS', 'GREEN'],
    required: true,
    index: true,
  },
  partner: {
    type: String,
    required: true,
    trim: true,
  },
  discountValue: {
    type: String,
    required: true,
  },
  pointsRequired: {
    type: Number,
    required: true,
    min: 1,
  },
  pointsType: {
    type: String,
    enum: ['FITNESS_POINTS', 'GREEN_CREDITS'],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  badgeText: {
    type: String,
    default: 'Popular',
  },
  iconType: {
    type: String,
    default: 'zap',
  },
  stock: {
    type: Number,
    default: 100,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Reward = mongoose.model('Reward', rewardSchema);

module.exports = Reward;
