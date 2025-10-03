# WhatsJet Node.js Service

High-performance Node.js service for handling WhatsApp message sending and webhook processing.

## Features

- ⚡ Fast webhook processing (< 10ms response time)
- 🚀 Scalable message sending with rate limiting
- 🤖 Intelligent bot reply system
- 📊 Redis-backed job queues with BullMQ
- 🔄 Automatic retries and error handling
- 📈 Built-in monitoring and logging

## Requirements

- Node.js >= 18.0.0
- MySQL 8.0+
- Redis 6.0+
- PM2 (for production)

## Installation

1. **Navigate to the nodeapp directory:**
   ```bash
   cd nodeapp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Install PM2 globally (for production):**
   ```bash
   npm install -g pm2
   ```

## Configuration

Edit the `.env` file with your settings:

```env
# Node Environment
NODE_ENV=production
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=whatsjet

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# WhatsApp
WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Logging
LOG_LEVEL=info
```

## Running the Service

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

## PM2 Commands

```bash
# View logs
pm2 logs whatsjet-nodejs

# Monitor resources
pm2 monit

# Restart service
pm2 restart whatsjet-nodejs

# Stop service
pm2 stop whatsjet-nodejs

# View status
pm2 status
```

## API Endpoints

### Health Check
```
GET /health
```

### Webhook Verification
```
GET /webhook/:vendorUid
```

### Webhook Receiver
```
POST /webhook/:vendorUid
```

### Campaign Processing
```
POST /campaign/process
```

## Architecture

```
┌─────────────────┐
│  PHP Laravel    │ ← Admin Panel
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MySQL Database │ ← Shared data
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Redis Server   │ ← Queue & Cache
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Node.js API    │ ← This Service
│  (Port 3000)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  WhatsApp API   │
└─────────────────┘
```

## Performance

- **Webhook Response**: < 10ms
- **Concurrent Webhooks**: 50
- **Message Rate**: 5/second (respecting WhatsApp limits)
- **Concurrent Messages**: 5
- **Memory Usage**: ~200MB per instance

## Monitoring

Logs are stored in:
- `logs/error.log` - Error logs
- `logs/combined.log` - All logs
- `logs/pm2-error.log` - PM2 error logs
- `logs/pm2-out.log` - PM2 output logs

## Troubleshooting

### Check service status
```bash
pm2 status
pm2 logs whatsjet-nodejs
```

### Test database connection
```bash
npm run dev
```

### Test Redis connection
```bash
redis-cli ping
```

### Check health endpoint
```bash
curl http://localhost:3000/health
```

## License

Proprietary - WhatsJet

## Support

For support, contact: contact@livelyworks.net
