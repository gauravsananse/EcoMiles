const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Please provide an email address'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address',
    ],
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    select: false,
  },
  // Dual-Economy Points Balances
  fitnessPoints: {
    type: Number,
    default: 150, // Starting bonus points for new users
    min: 0,
  },
  greenCredits: {
    type: Number,
    default: 100, // Starting bonus credits for new users
    min: 0,
  },
  // Cumulative Impact Metrics
  totalCo2SavedKg: {
    type: Number,
    default: 4.8,
    min: 0,
  },
  totalDistanceKm: {
    type: Number,
    default: 24.5,
    min: 0,
  },
  totalActiveMinutes: {
    type: Number,
    default: 95,
    min: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static helper to hash password
userSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(plainPassword, salt);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
