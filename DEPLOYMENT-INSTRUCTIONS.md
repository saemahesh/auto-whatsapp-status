# Deployment Instructions - Iteration 2

## Issues Fixed in This Iteration:

### 1. PHP Not Forwarding Webhooks to Node.js
**Problem:** PHP webhook forwarding was configured with wrong port (3000 instead of 3006)

**Fix Applied:**
- Updated `Source/config/services.php` to use port 3006
- Changed default from `http://localhost:3000` to `http://localhost:3006`
- Added comprehensive logging to PHP webhook forwarding

### 2. Added Extensive Logging
**Added logging to:**
- PHP webhook route in `Source/routes/web.php`
- All Node.js files (completed in iteration 1)

## Required Steps to Deploy:

### Step 1: Restart PM2 Process
```bash
cd /path/to/your/project/nodeapp
pm2 stop whatsjet-nodejs
pm2 delete whatsjet-nodejs
pm2 start ecosystem.config.js
pm2 save
```

### Step 2: Check PM2 Status
```bash
pm2 list
```
**Expected Output:** Should show only 1 process named `whatsjet-nodejs`

### Step 3: Verify Node.js Service is Running
```bash
pm2 logs whatsjet-nodejs --lines 50
```
**Expected Output:** You should see:
```
[STARTUP] Loading environment variables...
[STARTUP] Initializing Express app...
[SERVER] HTTP server is listening on port 3006
[WORKERS] ✓ Webhook worker loaded
[WORKERS] ✓ Campaign worker loaded
```

### Step 4: Test Webhook Endpoint
```bash
curl http://localhost:3006/webhook/test123?hub.mode=subscribe&hub.verify_token=$(echo -n "test123" | shasum | cut -d' ' -f1)&hub.challenge=test_challenge
```
**Expected Output:** Should return `test_challenge`

### Step 5: Check Environment Variables (Laravel/PHP)
Make sure your `.env` file in the `Source` directory has:
```bash
NODEJS_SERVICE_URL=http://localhost:3006
NODEJS_SERVICE_ENABLED=true
```

If these are not set, add them to your `.env` file.

### Step 6: Clear Laravel Config Cache
```bash
cd /path/to/your/project/Source
php artisan config:clear
php artisan cache:clear
```

### Step 7: Test Complete Flow
1. Send a message to your WhatsApp business number
2. Check logs:
   ```bash
   # Check Node.js logs
   pm2 logs whatsjet-nodejs --lines 100
   
   # Check PHP logs (Laravel)
   tail -f /path/to/your/project/Source/storage/logs/laravel.log
   ```

## Expected Log Flow:

### When webhook is received:

**PHP Logs (in Laravel log):**
```
[PHP WEBHOOK] Received webhook request
[PHP WEBHOOK] POST request - forwarding to Node.js asynchronously
[PHP WEBHOOK] Successfully forwarded to Node.js
```

**Node.js Logs (in PM2):**
```
[WEBHOOK POST] Received webhook data
[WEBHOOK POST] vendorUid: your-vendor-uid
[WEBHOOK POST] ✓ Response sent to WhatsApp
[WEBHOOK POST] ✓ Webhook queued with job ID: 1
[WEBHOOK WORKER] Processing job: 1
[WEBHOOK SERVICE] processWebhook called
[WEBHOOK SERVICE] ✓ Vendor ID found: 123
[WEBHOOK SERVICE] Routing to handleMessageWebhook...
[WEBHOOK SERVICE] Processing incoming message...
```

## Troubleshooting:

### If PM2 shows 4 processes:
```bash
pm2 delete all
cd /path/to/your/project/nodeapp
pm2 start ecosystem.config.js
pm2 save
```

### If Node.js logs are empty:
- Check if Node.js service is actually running: `pm2 list`
- Check if it's listening on port 3006: `netstat -an | grep 3006`
- Check for startup errors: `pm2 logs whatsjet-nodejs --err`

### If PHP logs show "Node.js disabled":
- Make sure `.env` has `NODEJS_SERVICE_ENABLED=true`
- Run `php artisan config:clear`

### If PHP can't connect to Node.js:
- Check firewall: `sudo ufw status`
- Check if port 3006 is listening: `netstat -tulpn | grep 3006`
- Try manual curl: `curl http://localhost:3006/health`

### If webhooks still not working:
- Verify WhatsApp webhook URL is set correctly in Meta dashboard
- Should be: `https://yourdomain.com/whatsapp-webhook/{vendorUid}`
- Not: `https://yourdomain.com:3006/webhook/{vendorUid}` (PHP handles forwarding)

## Summary of Changes:

**Files Modified:**
1. `nodeapp/ecosystem.config.js` - Reduced to 1 process
2. `nodeapp/src/index.js` - Added startup logs
3. `nodeapp/src/routes/webhook.js` - Added comprehensive logs + fixed queue
4. `nodeapp/src/services/webhook-service.js` - Added processing logs
5. `nodeapp/src/workers/webhook-worker.js` - Added worker logs
6. `nodeapp/src/workers/campaign-worker.js` - Added campaign logs
7. `Source/config/services.php` - Changed port 3000 → 3006
8. `Source/routes/web.php` - Added PHP forwarding logs

## Next Steps:
After deployment, send a test message and provide feedback in `issue-details.txt`
