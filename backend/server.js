const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Body parser with expanded limit for multi-axis sensor telemetry
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Route Imports
const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const journeyRoutes = require('./routes/journeyRoutes');
const journeyVerificationRoutes = require('./routes/journeyVerificationRoutes');
const routeRoutes = require('./routes/routeRoutes');
const transportIntelligenceRoutes = require('./routes/transportIntelligenceRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const transitRoutes = require('./routes/transitRoutes');
const fraudRoutes = require('./routes/fraudRoutes');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/journeys', journeyRoutes);
app.use('/api/journey', journeyVerificationRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/city', transportIntelligenceRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/transit', transitRoutes);
app.use('/api/fraud', fraudRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Green Credits — Smart Mobility & Transport Intelligence Platform',
    timestamp: new Date().toISOString(),
    providerConfigured: Boolean(
      process.env.VEHICLE_API_KEY &&
      !process.env.VEHICLE_API_KEY.includes('YOUR_')
    ) || process.env.VEHICLE_API_PROVIDER === 'sandbox',
    providerName: process.env.VEHICLE_API_PROVIDER || 'none',
  });
});

// Fallback 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint ${req.originalUrl} not found on this server`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

let server;

// If started directly
if (process.env.NODE_ENV !== 'test') {
  connectDB()
    .then(() => {
      server = app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`  GREEN CREDITS — SMART MOBILITY PLATFORM`);
        console.log(`  Server running on http://localhost:${PORT}`);
        console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`  Provider: ${process.env.VEHICLE_API_PROVIDER || 'Unconfigured'}`);
        console.log(`====================================================`);
      });
    })
    .catch((err) => {
      console.error('[Fatal DB Error] Server start aborted:', err.message);
    });
}

module.exports = app;
