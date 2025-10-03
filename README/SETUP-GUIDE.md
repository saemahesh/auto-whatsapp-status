# Quick Setup Guide

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js 18+ installed: `node --version`
- ✅ npm installed: `npm --version`
- ✅ Redis installed and running: `redis-cli ping` (should return "PONG")
- ✅ MySQL/MariaDB running
- ✅ PM2 installed globally: `npm install -g pm2`

## Step-by-Step Setup

### Step 1: Configure Laravel (.env)

Add these lines to your main `.Source/.env` file:

```env
# Node.js Service Configuration
NODEJS_SERVICE_URL=http://localhost:3000
NODEJS_SERVICE_ENABLED=true
```

Then clear Laravel config cache:
```bash
cd Source
php artisan config:clear
php artisan cache:clear
```

### Step 2: Configure Node.js Service

Create `.env` file in `nodeapp/` directory:

```bash
cd nodeapp
cp .env.example .env
nano .env  # or use your favorite editor
```

Update the following variables:
```env
# Application
NODE_ENV=production
PORT=3000

# Database (use same credentials as Laravel)
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_DATABASE=your_database_name

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# WhatsApp API (copy from Laravel .env)
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_API_VERSION=v17.0

# Webhook Verification (copy from WhatsApp Dashboard)
WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Queue Settings
MAX_CONCURRENT_WEBHOOKS=50
MAX_WEBHOOK_RATE=100
MAX_CONCURRENT_MESSAGES=5
MAX_MESSAGE_RATE=5

# Cache TTL (in seconds)
CACHE_TTL=1800
```

### Step 3: Install Dependencies

```bash
cd nodeapp
npm install
```

This will install:
- express
- bullmq
- ioredis
- mysql2
- axios
- winston
- helmet, cors, compression

### Step 4: Start Node.js Service

```bash
# Start with PM2 (recommended for production)
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs whatsapp-service
```

Or start without PM2 (for testing):
```bash
npm start
```

### Step 5: Verify Node.js Service

```bash
# Health check
curl http://localhost:3000/health

# Should return:
# {
#   "status": "healthy",
#   "uptime": 123,
#   "database": "connected",
#   "redis": "connected",
#   "memory": {...}
# }
```

### Step 6: Test From Laravel

```bash
cd ../Source
php artisan tinker
```

In tinker:
```php
// Test Node.js service
$service = app(\App\Services\NodeJsService::class);
$health = $service->healthCheck();
var_dump($health);

// Trigger campaign processing
$service->processCampaign();
```

### Step 7: Update Cron (if not already running)

Make sure Laravel cron is running:

```bash
# Add to crontab (run: crontab -e)
* * * * * cd /path/to/Source && php artisan schedule:run >> /dev/null 2>&1
```

### Step 8: Monitor Everything

Open 4 terminal windows:

**Terminal 1 - Node.js main logs:**
```bash
pm2 logs whatsapp-service
```

**Terminal 2 - Webhook worker logs:**
```bash
pm2 logs webhook-worker
```

**Terminal 3 - Campaign worker logs:**
```bash
pm2 logs campaign-worker
```

**Terminal 4 - Laravel logs:**
```bash
cd Source
tail -f storage/logs/laravel.log
```

## Testing the Setup

### Test 1: Webhook Verification (GET)

```bash
curl "http://localhost:3000/webhook/test-vendor-uid?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=your_verify_token"

# Should return: test123
```

### Test 2: Webhook Processing (POST)

```bash
curl -X POST http://localhost:3000/webhook/test-vendor-uid \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "statuses": [{
            "id": "wamid.test123",
            "status": "delivered",
            "timestamp": "1234567890"
          }]
        }
      }]
    }]
  }'

# Should return: {"status":"success"}
```

Check logs to see if webhook was queued and processed.

### Test 3: Campaign Processing

```bash
cd Source
php artisan whatsapp:campaign:nodejs

# Should output: ✓ Campaign processing triggered successfully
```

Check Node.js logs to see how many messages were queued.

### Test 4: End-to-End Test

1. Log into your WhatsApp admin panel
2. Create a test campaign with 5-10 messages
3. Set status to "pending" in database
4. Wait for cron to trigger (max 5 seconds)
5. Watch Node.js logs to see messages being sent
6. Verify in WhatsApp that messages are received

## PM2 Useful Commands

```bash
# Start service
pm2 start ecosystem.config.js

# Stop service
pm2 stop whatsapp-service

# Restart service
pm2 restart whatsapp-service

# View logs
pm2 logs whatsapp-service

# View all processes
pm2 status

# Monitor resources
pm2 monit

# Save PM2 configuration
pm2 save

# Auto-start on server reboot
pm2 startup
```

## Troubleshooting Common Issues

### Issue: Port 3000 already in use
```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>

# Or change PORT in nodeapp/.env
```

### Issue: Redis connection refused
```bash
# Check if Redis is running
redis-cli ping

# If not, start Redis
# macOS
brew services start redis

# Linux
sudo systemctl start redis

# Or install Redis if missing
# macOS: brew install redis
# Ubuntu: sudo apt install redis-server
```

### Issue: MySQL connection error
```bash
# Verify credentials in nodeapp/.env match Source/.env
# Test MySQL connection
mysql -h localhost -u your_user -p your_database

# Check if MySQL is running
# macOS
brew services list

# Linux
sudo systemctl status mysql
```

### Issue: Webhook not being processed
```bash
# Check if Node.js is running
pm2 status

# Check if route is configured
cd Source
php artisan route:list | grep webhook

# Check Laravel config
php artisan tinker
> config('services.nodejs')

# Should show: ["url" => "http://localhost:3000", "enabled" => true]
```

### Issue: Campaign messages not sending
```bash
# Check if messages are in queue
redis-cli
> KEYS bull:campaign*
> LLEN bull:campaign:wait

# Check database for pending messages
mysql -u user -p
> USE your_database;
> SELECT COUNT(*) FROM campaign_logs WHERE status = 'pending';

# Check if vendor has valid WhatsApp credentials
> SELECT * FROM vendors WHERE status = 'active';
```

## Performance Monitoring

### Check Queue Stats
```bash
redis-cli
> INFO stats
> KEYS bull:*
> LLEN bull:webhook:wait
> LLEN bull:campaign:wait
```

### Check Node.js Memory Usage
```bash
pm2 monit
# Or
pm2 status
```

### Check Database Connections
```bash
mysql -u user -p -e "SHOW PROCESSLIST;"
```

### Check System Resources
```bash
# CPU and Memory
top

# Or install htop for better view
htop
```

## Production Recommendations

1. **Use PM2 Cluster Mode** (already configured in ecosystem.config.js)
   - Runs 2 instances by default
   - Automatic load balancing
   - Zero-downtime restarts

2. **Set Up Log Rotation**
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

3. **Enable PM2 Monitoring** (optional)
   ```bash
   pm2 plus
   ```

4. **Set Up Alerts** (optional)
   - Monitor PM2 status
   - Alert on crashes
   - Alert on high CPU/memory

5. **Backup Strategy**
   - Regular database backups
   - Redis persistence enabled (RDB + AOF)
   - Log rotation configured

6. **Security**
   - Change default WEBHOOK_VERIFY_TOKEN
   - Use strong Redis password in production
   - Keep Node.js service internal (not exposed to internet)
   - Only expose Laravel webhook endpoint publicly

## Next Steps

1. ✅ Complete this setup guide
2. ✅ Test all functionality
3. 📊 Monitor performance for 24-48 hours
4. 📝 Document any issues or improvements
5. 🚀 Deploy to production
6. 📈 Monitor and optimize based on real usage

## Support

If you encounter any issues:
1. Check logs first: `pm2 logs`
2. Check Laravel logs: `tail -f storage/logs/laravel.log`
3. Check Redis: `redis-cli monitor`
4. Review documentation: `PHP-INTEGRATION.md`, `implementation.md`, `analysis.md`

## Summary

After completing this setup:
- ✅ Node.js service running on port 3000
- ✅ Laravel forwarding webhooks to Node.js
- ✅ Cron triggering Node.js for campaigns
- ✅ Redis queues processing webhooks and messages
- ✅ PM2 managing Node.js processes
- ✅ Proper rate limiting (5 msg/sec)
- ✅ Fast webhook response (< 10ms)
- ✅ 60-70% CPU reduction expected

You're all set! 🎉
