const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3006;

// Middleware
app.use(helmet());  // Security headers
app.use(cors());    // Enable CORS
app.use(compression());  // Gzip compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));  // Request logging

// Debug middleware - log ALL incoming requests
app.use((req, res, next) => {
    console.log(`[EXPRESS] ${req.method} ${req.path} - ${new Date().toISOString()}`);
    // console.log(`[EXPRESS] Headers:`, JSON.stringify(req.headers, null, 2));
    // if (req.body && Object.keys(req.body).length > 0) {
        // console.log(`[EXPRESS] Body:`, JSON.stringify(req.body, null, 2));
    // }
    next();
});

// Routes
const webhookRoutes = require('./routes/webhook');
const campaignRoutes = require('./routes/campaign');
const healthRoutes = require('./routes/health');

// Simple test endpoint
app.get('/test', (req, res) => {
    console.log('[TEST] Test endpoint hit!');
    res.json({ 
        status: 'ok', 
        message: 'Node.js service is running',
        timestamp: new Date().toISOString() 
    });
});

app.use('/webhook', webhookRoutes);
app.use('/campaign', campaignRoutes);
app.use('/health', healthRoutes);

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: err.message
    });
});

// Start server - bind to 127.0.0.1 for production
const HOST = '127.0.0.1';
const server = app.listen(PORT, HOST, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║  WhatsJet Node.js Service Started    ║
    ║  Host: ${HOST}                        ║
    ║  Port: ${PORT}                        ║
    ║  Environment: ${process.env.NODE_ENV || 'development'} ║
    ╚═══════════════════════════════════════╝
    `);
    console.log(`[SERVER] Listening on http://${HOST}:${PORT}`);
    console.log('[SERVER] Test endpoint: http://${HOST}:${PORT}/test');
});

server.on('error', (err) => {
    console.error('[SERVER] ✗ Failed to start server:', err);
    process.exit(1);
});

// Start workers with error handling
try {
    console.log('[WORKERS] Loading webhook-worker...');
    require('./workers/webhook-worker');
    console.log('[WORKERS] ✓ Webhook worker loaded');
    
    console.log('[WORKERS] Loading campaign-worker...');
    require('./workers/campaign-worker');
    console.log('[WORKERS] ✓ Campaign worker loaded');
    
    console.log('[WORKERS] ✓ All workers started successfully');
} catch (err) {
    console.error('[WORKERS] ✗ Failed to start workers:', err);
    // Continue running the server even if workers fail
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
