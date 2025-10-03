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
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());  // Security headers
app.use(cors());    // Enable CORS
app.use(compression());  // Gzip compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));  // Request logging

// Routes
const webhookRoutes = require('./routes/webhook');
const campaignRoutes = require('./routes/campaign');
const healthRoutes = require('./routes/health');

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

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║  WhatsJet Node.js Service Started    ║
    ║  Port: ${PORT}                        ║
    ║  Environment: ${process.env.NODE_ENV || 'development'} ║
    ╚═══════════════════════════════════════╝
    `);
});

// Start workers
require('./workers/webhook-worker');
require('./workers/campaign-worker');

console.log('✓ Workers started');

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
