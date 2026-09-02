const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

const path = require('path');
const app = express();

// Security & CORS middleware (allow cross-origin assets for Leaflet map tiles and mobile sensor tunnels)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: true,
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

const os = require('os');
const tunnelService = require('./services/tunnelService');

// Helper to get local Wi-Fi / LAN IP address
function getLocalNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('127.') && !iface.address.startsWith('169.254.')) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

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

// Network LAN IP & Public HTTPS Tunnel endpoint for mobile scanning
app.get('/api/network-ip', (req, res) => {
  const ip = getLocalNetworkIP();
  const port = process.env.VITE_PORT || 5173;
  const tunnelUrl = tunnelService.getTunnelUrl();
  const localUrl = `http://${ip}:${port}`;

  res.status(200).json({
    success: true,
    ip,
    port,
    localUrl,
    tunnelUrl,
    mobileUrl: tunnelUrl || localUrl,
    isSecureTunnel: Boolean(tunnelUrl),
  });
});

// Serve static production build of frontend if available
const distPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(distPath));

// Frontend SPA HTML Fallback
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      next();
    }
  });
});

// Fallback 404 handler for unmatched API routes
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
      server = app.listen(PORT, '0.0.0.0', () => {
        const lanIp = getLocalNetworkIP();
        console.log(`====================================================`);
        console.log(`  GREEN CREDITS — SMART MOBILITY PLATFORM`);
        console.log(`  Server running on http://localhost:${PORT}`);
        console.log(`  Local Network:    http://${lanIp}:${PORT}`);
        console.log(`  Environment:      ${process.env.NODE_ENV || 'development'}`);
        console.log(`  Provider:         ${process.env.VEHICLE_API_PROVIDER || 'Unconfigured'}`);
        console.log(`====================================================`);

        // Start public HTTPS tunnel for mobile connectivity
        tunnelService.startTunnel(5173);
      });
    })
    .catch((err) => {
      console.error('[Fatal DB Error] Server start aborted:', err.message);
    });
}

module.exports = app;
