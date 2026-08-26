const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/green_credits_ev';
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    // If not in production or tests, we log the help notice
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[MongoDB] Please ensure MongoDB is running or configure MONGO_URI in backend/.env');
    }
    throw error;
  }
};

module.exports = connectDB;
