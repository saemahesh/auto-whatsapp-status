# 🎯 PHP Integration Checklist

## ✅ Completed Items

### PHP/Laravel Integration
- [x] **Webhook route redirected to Node.js**
  - File: `Source/routes/web.php` (line ~1350)
  - GET requests: Forwarded synchronously for verification
  - POST requests: Forwarded asynchronously, immediate 200 response
  - Fallback: If Node.js disabled, uses original PHP controller

- [x] **Configuration added for Node.js service**
  - File: `Source/config/services.php`
  - Added: `nodejs.url` and `nodejs.enabled` settings
  - Environment variables: `NODEJS_SERVICE_URL`, `NODEJS_SERVICE_ENABLED`

- [x] **Node.js service helper created**
  - File: `Source/app/Services/NodeJsService.php`
  - Methods: isEnabled(), processCampaign(), healthCheck(), forwardWebhook()
  - Handles HTTP communication and error logging

- [x] **Cron jobs updated**
  - File: `Source/app/Console/Kernel.php`
  - Campaign cron: Now triggers Node.js service
  - Webhook cron: REMOVED (now real-time processing)
  - Smart fallback: Uses PHP if Node.js disabled

- [x] **New console command created**
  - File: `Source/app/Console/Commands/ProcessCampaignViaNodeJs.php`
  - Command: `whatsapp:campaign:nodejs`
  - Purpose: Trigger Node.js campaign processing from cron

### Node.js Service (Complete)
- [x] **Project structure created**
  - Directory: `nodeapp/`
  - package.json with all dependencies
  - Organized folder structure (config, services, workers, routes)

- [x] **Main application server**
  - File: `nodeapp/src/index.js`
  - Express server on port 3000
  - Middleware: helmet, cors, compression
  - Routes: webhook, campaign, health

- [x] **Configuration files**
  - Database config with connection pooling
  - Redis config for BullMQ
  - WhatsApp API wrapper
  - Winston logger setup

- [x] **Service implementations**
  - webhook-service.js: Process incoming webhooks
  - campaign-service.js: Fetch and queue messages
  - bot-service.js: Pattern matching and bot replies

- [x] **Queue workers**
  - webhook-worker.js: Process 50 concurrent webhooks
  - campaign-worker.js: Send 5 concurrent messages (rate limited)

- [x] **API routes**
  - GET/POST /webhook/:vendorUid - Webhook endpoints
  - POST /campaign/process - Trigger campaign processing
  - GET /health - Service health check

- [x] **Process management**
  - PM2 configuration (ecosystem.config.js)
  - Cluster mode with 2 instances
  - Auto-restart on crashes
  - Memory limit: 500MB per instance

- [x] **Installation script**
  - File: `nodeapp/install.sh`
  - Checks prerequisites
  - Installs dependencies
  - Sets up PM2

### Documentation
- [x] **Performance analysis** (analysis.md)
- [x] **Implementation plan** (implementation.md)
- [x] **PHP integration guide** (PHP-INTEGRATION.md)
- [x] **Setup guide** (SETUP-GUIDE.md)
- [x] **Integration summary** (PHP-INTEGRATION-SUMMARY.md)
- [x] **Node.js README** (nodeapp/README.md)
- [x] **This checklist** (PHP-INTEGRATION-CHECKLIST.md)

## 📋 User Action Required

### 1. Configure Laravel Environment
Add to `Source/.env`:
```env
NODEJS_SERVICE_URL=http://localhost:3000
NODEJS_SERVICE_ENABLED=true
```

Then run:
```bash
cd Source
php artisan config:clear
php artisan cache:clear
```

### 2. Configure Node.js Environment
Create `nodeapp/.env`:
```bash
cd nodeapp
cp .env.example .env
nano .env  # Edit with your values
```

Required values:
- Database credentials (same as Laravel)
- Redis host and port
- WhatsApp API settings
- Webhook verify token

### 3. Install Node.js Dependencies
```bash
cd nodeapp
npm install
```

### 4. Start Node.js Service
```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs
```

### 5. Verify Integration
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test from Laravel
cd ../Source
php artisan tinker
> $service = app(\App\Services\NodeJsService::class);
> $health = $service->healthCheck();
> var_dump($health);

# Test campaign trigger
php artisan whatsapp:campaign:nodejs
```

### 6. Test Webhook Flow
Send a test WhatsApp message and monitor:
- Laravel logs: `tail -f Source/storage/logs/laravel.log`
- Node.js logs: `pm2 logs whatsapp-service`
- Redis queue: `redis-cli` → `KEYS bull:*`

### 7. Monitor Performance
Watch for:
- Webhook response times (should be < 10ms)
- CPU usage during campaigns (should be 30-40%)
- Memory usage in PM2 (`pm2 monit`)
- Queue processing in Redis

## 🔍 Verification Steps

### PHP Verification
```bash
cd Source

# 1. Check if routes are configured
php artisan route:list | grep webhook

# 2. Check if config is loaded
php artisan tinker
> config('services.nodejs')
# Should show: ["url" => "http://localhost:3000", "enabled" => true]

# 3. Check if service class exists
> class_exists(\App\Services\NodeJsService::class)
# Should return: true

# 4. Check if command exists
php artisan list | grep nodejs
# Should show: whatsapp:campaign:nodejs

# 5. Check cron schedule
php artisan schedule:list
# Should show: whatsapp:campaign:nodejs running every 5 seconds
```

### Node.js Verification
```bash
cd nodeapp

# 1. Check if Node.js is running
pm2 status
# Should show: whatsapp-service, webhook-worker, campaign-worker all online

# 2. Check logs
pm2 logs --lines 50

# 3. Test health endpoint
curl http://localhost:3000/health
# Should return JSON with status: "healthy"

# 4. Test webhook verification (GET)
curl "http://localhost:3000/webhook/test?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=your_token"
# Should return: test123

# 5. Test webhook processing (POST)
curl -X POST http://localhost:3000/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"changes":[{"value":{"statuses":[{"id":"test","status":"delivered"}]}}]}]}'
# Should return: {"status":"success"}
```

### Redis Verification
```bash
# 1. Check if Redis is running
redis-cli ping
# Should return: PONG

# 2. Check queues
redis-cli
> KEYS bull:*
# Should show: bull:webhook:*, bull:campaign:* keys

# 3. Check queue lengths
> LLEN bull:webhook:wait
> LLEN bull:campaign:wait

# 4. Monitor real-time
> MONITOR
# Then trigger webhook/campaign and watch Redis activity
```

### Database Verification
```bash
mysql -u user -p

# 1. Check if tables exist
USE your_database;
SHOW TABLES LIKE '%webhook%';
SHOW TABLES LIKE '%campaign%';

# 2. Check for pending messages
SELECT COUNT(*) FROM campaign_logs WHERE status = 'pending';

# 3. Check vendors
SELECT id, name, status FROM vendors WHERE status = 'active';

# 4. Check bot replies
SELECT COUNT(*) FROM bot_replies;
```

## 🚨 Troubleshooting

### If Node.js won't start:
1. Check if port 3000 is available: `lsof -i :3000`
2. Check .env file exists: `ls -la nodeapp/.env`
3. Check Redis is running: `redis-cli ping`
4. Check database connection: Test credentials in .env
5. View detailed errors: `pm2 logs --err`

### If webhooks not processing:
1. Check Laravel route: `php artisan route:list | grep webhook`
2. Check if forwarding to Node.js: `tail -f Source/storage/logs/laravel.log`
3. Check Node.js receiving: `pm2 logs whatsapp-service`
4. Check Redis queue: `redis-cli LLEN bull:webhook:wait`
5. Check worker processing: `pm2 logs webhook-worker`

### If campaigns not sending:
1. Check cron is running: `php artisan schedule:list`
2. Check if triggering Node.js: `php artisan whatsapp:campaign:nodejs`
3. Check Node.js logs: `pm2 logs whatsapp-service`
4. Check messages queued: `redis-cli LLEN bull:campaign:wait`
5. Check worker sending: `pm2 logs campaign-worker`

### If high CPU usage:
1. Check PM2 resource usage: `pm2 monit`
2. Check number of queued jobs: `redis-cli LLEN bull:*:wait`
3. Adjust concurrent processing in .env
4. Check for database slow queries
5. Verify connection pooling is working

## 📊 Expected Results

After successful integration:

| Metric | Before | After | Status |
|--------|--------|-------|--------|
| Webhook Response | 200-500ms | < 10ms | ⏱️ Test |
| Campaign CPU | 100% | 30-40% | 📊 Monitor |
| Webhook CPU | 45% spike | < 5% spike | 📊 Monitor |
| Message Rate | Unlimited | 5/sec | ✅ Rate limited |
| Concurrent Webhooks | 1 | 50 | ✅ Scaled |
| Database Connections | Per request | Pooled (20) | ✅ Efficient |
| Bot Reply Lookup | Database | Cached (30min) | ✅ Fast |

## 🎯 Success Criteria

Integration is successful when:

- ✅ Node.js service is running and healthy
- ✅ Webhooks return 200 in < 10ms
- ✅ Webhooks are processed in background
- ✅ Campaigns triggered by cron every 5 seconds
- ✅ Messages sent at 5 per second rate
- ✅ CPU usage reduced by 60-70%
- ✅ No webhook timeouts from WhatsApp
- ✅ All messages delivered successfully
- ✅ Bot replies working correctly
- ✅ Database updates happening properly
- ✅ Logs showing no errors
- ✅ PM2 showing all processes online

## 📚 Reference Documents

1. **SETUP-GUIDE.md** - Step-by-step setup instructions
2. **PHP-INTEGRATION.md** - Detailed technical explanation
3. **PHP-INTEGRATION-SUMMARY.md** - Quick overview
4. **analysis.md** - Performance analysis
5. **implementation.md** - Implementation roadmap
6. **nodeapp/README.md** - Node.js service documentation

## 🔄 Next Steps After Integration

1. **Monitor for 24-48 hours**
   - Watch CPU usage trends
   - Monitor error logs
   - Check webhook success rates
   - Verify message delivery rates

2. **Optimize if needed**
   - Adjust concurrent processing limits
   - Tune cache TTL values
   - Optimize database queries
   - Scale workers if needed

3. **Production hardening**
   - Set up log rotation
   - Configure monitoring alerts
   - Implement backup strategies
   - Document operational procedures

4. **Performance tuning**
   - A/B test different settings
   - Benchmark against old system
   - Fine-tune based on actual usage
   - Document optimal configurations

## ✅ Final Checklist

Before marking integration complete:

- [ ] Laravel .env configured
- [ ] Node.js .env configured
- [ ] Dependencies installed
- [ ] Redis running
- [ ] Node.js service started
- [ ] Health check passes
- [ ] Webhook test successful
- [ ] Campaign test successful
- [ ] Cron job verified
- [ ] Logs showing activity
- [ ] No errors in logs
- [ ] CPU usage monitored
- [ ] Documentation reviewed
- [ ] Team trained on new system
- [ ] Rollback plan documented

---

**Status: READY FOR TESTING** ✅

All code changes are complete. PHP integration is done. Node.js service is ready to start.

Follow SETUP-GUIDE.md to configure and launch the system!
