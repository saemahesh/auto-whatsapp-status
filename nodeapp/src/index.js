const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const dotenv = require('dotenv');

console.log('========================================');
console.log('[STARTUP] Loading environment variables...');
// Load environment variables
dotenv.config();

console.log('[STARTUP] Initializing Express app...');
// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3006;

console.log('[STARTUP] Configuring middleware...');
// Middleware
app.use(helmet());  // Security headers
app.use(cors());    // Enable CORS
app.use(compression());  // Gzip compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));  // Request logging

console.log('[STARTUP] Loading routes...');
// Routes
const webhookRoutes = require('./routes/webhook');
const campaignRoutes = require('./routes/campaign');
const healthRoutes = require('./routes/health');

console.log('[STARTUP] Registering route handlers...');
app.use('/webhook', webhookRoutes);
app.use('/campaign', campaignRoutes);
app.use('/health', healthRoutes);
console.log('[ROUTES] Registered: /webhook, /campaign, /health');

// Error handler
app.use((err, req, res, next) => {
    console.error('[ERROR HANDLER] Error caught:', err);
    res.status(500).json({
        success: false,
        error: err.message
    });
});

console.log('[STARTUP] Starting server on port', PORT);
// Start server
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║  WhatsJet Node.js Service Started    ║
    ║  Port: ${PORT}                        ║
    ║  Environment: ${process.env.NODE_ENV || 'development'} ║
    ╚═══════════════════════════════════════╝
    `);
    console.log('[SERVER] HTTP server is listening on port', PORT);
    console.log('[SERVER] Webhook endpoint: http://localhost:' + PORT + '/webhook/:vendorUid');
});

console.log('[STARTUP] Starting workers...');
// Start workers
require('./workers/webhook-worker');
require('./workers/campaign-worker');

console.log('[WORKERS] ✓ Webhook worker loaded');
console.log('[WORKERS] ✓ Campaign worker loaded');
console.log('[STARTUP] ✓ All workers started successfully');
console.log('========================================');

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[SHUTDOWN] SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

