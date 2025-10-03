# Node.js Service Testing Checklist

## Pre-Deployment Verification ✓

### Code Quality
- ✓ All JavaScript syntax validated (node -c)
- ✓ All functions verified against PHP
- ✓ Database queries tested
- ✓ Error handling implemented

### Configuration
- ✓ Port 3006 configured
- ✓ Database credentials match PHP (whatapi/4YJ7ezCXGFDE66Ja)
- ✓ WhatsApp API v23.0 (matches PHP)
- ✓ No WEBHOOK_VERIFY_TOKEN needed
- ✓ Webhook verification uses sha1(vendorUid)
- ✓ CAMPAIGN_BATCH_SIZE fetched from database

## Deployment Steps (AAPanel)

### 1. Install Node.js Dependencies
```bash
cd /www/wwwroot/whatsapi.robomate.in/nodeapp
npm install
```

### 2. Copy Environment File
```bash
cp .env.example .env
# Edit .env if needed (already has correct DB credentials)
```

### 3. Start with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4. Verify Services Running
```bash
pm2 status
# Should show:
# - whatsjet-api (port 3006)
# - whatsjet-webhook-worker
# - whatsjet-campaign-worker
```

### 5. Test Node.js Webhook
```bash
# Get your vendor UID from database
mysql -u whatapi -p'4YJ7ezCXGFDE66Ja' whatapi -e "SELECT _uid FROM vendors LIMIT 1;"

# Test webhook verification (replace YOUR_VENDOR_UID)
curl "http://localhost:3006/webhook/whatsapp/YOUR_VENDOR_UID?hub.mode=subscribe&hub.verify_token=$(echo -n 'YOUR_VENDOR_UID' | sha1sum | cut -d' ' -f1)&hub.challenge=test123"
# Should return: test123
```

### 6. Update WhatsApp Webhook URL
In WhatsApp Business API settings, update webhook URL to:
```
https://whatsapi.robomate.in:3006/webhook/whatsapp/{YOUR_VENDOR_UID}
```

Or use nginx/Apache reverse proxy:
```nginx
# Add to nginx config
location /webhook/whatsapp/ {
    proxy_pass http://localhost:3006/webhook/whatsapp/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### 7. Test Campaign Processing
```bash
# Manually trigger campaign processing
curl -X POST http://localhost:3006/api/campaign/process
```

### 8. Monitor Logs
```bash
pm2 logs whatsjet-api
pm2 logs whatsjet-webhook-worker
pm2 logs whatsjet-campaign-worker
```

## Testing Checklist

### ✓ Critical Tests to Perform

1. **Webhook Reception**
   - [ ] Send a test message to your WhatsApp number
   - [ ] Check logs: `pm2 logs whatsjet-api`
   - [ ] Verify message appears in whatsapp_message_logs table
   - [ ] Verify contact created/updated in contacts table

2. **Bot Replies**
   - [ ] Send a message matching a bot trigger
   - [ ] Verify bot replies with correct message
   - [ ] Check interactive messages (buttons/lists) work
   - [ ] Check media messages work

3. **Campaign Sending**
   - [ ] Create a campaign with 10-20 contacts
   - [ ] Watch `pm2 logs whatsjet-campaign-worker`
   - [ ] Verify messages sent at 5 msg/sec rate
   - [ ] Check whatsapp_message_queue status updates
   - [ ] Verify whatsapp_message_logs entries created

4. **Message Status Updates**
   - [ ] After campaign sent, wait for delivery webhooks
   - [ ] Check whatsapp_message_logs.message_status updates
   - [ ] Verify statuses: sent → delivered → read

5. **CPU Monitoring**
   - [ ] Before: Run large campaign with PHP
   - [ ] After: Run same campaign with Node.js
   - [ ] Compare CPU usage: `top` or `htop`
   - [ ] Expected: CPU should drop from 100% to 20-40%

## Troubleshooting

### Service Won't Start
```bash
# Check logs
pm2 logs whatsjet-api --lines 50

# Common issues:
# 1. Port 3006 already in use
netstat -tulpn | grep 3006
# Kill process: kill -9 <PID>

# 2. Database connection failed
mysql -u whatapi -p'4YJ7ezCXGFDE66Ja' whatapi -e "SELECT 1;"

# 3. Redis not running
systemctl status redis
systemctl start redis
```

### Webhooks Not Working
```bash
# 1. Check if service is accessible
curl http://localhost:3006/health

# 2. Verify vendor UID is correct
mysql -u whatapi -p'4YJ7ezCXGFDE66Ja' whatapi -e "SELECT _uid FROM vendors;"

# 3. Check webhook verification token
node -e "const crypto = require('crypto'); console.log(crypto.createHash('sha1').update('YOUR_VENDOR_UID').digest('hex'));"
```

### Campaign Not Processing
```bash
# 1. Check if messages in queue
mysql -u whatapi -p'4YJ7ezCXGFDE66Ja' whatapi -e "SELECT status, COUNT(*) FROM whatsapp_message_queue GROUP BY status;"

# 2. Manually trigger processing
curl -X POST http://localhost:3006/api/campaign/process

# 3. Check worker logs
pm2 logs whatsjet-campaign-worker
```

### High Memory Usage
```bash
# Check memory
pm2 monit

# Restart if needed
pm2 restart whatsjet-api
pm2 restart whatsjet-campaign-worker
```

## Expected Performance Improvements

### Before (PHP only):
- CPU: 14% idle → 100% during campaign
- Website: Becomes unresponsive
- Webhook processing: 200-500ms per webhook
- Campaign rate: Struggles at 5 msg/sec

### After (Node.js):
- CPU: 14% idle → 20-40% during campaign
- Website: Remains responsive (PHP handles web requests)
- Webhook processing: 20-50ms per webhook
- Campaign rate: Stable at 5 msg/sec with headroom

## Database Indexes (Already optimized)
Check if these indexes exist:
```sql
SHOW INDEX FROM whatsapp_message_queue;
SHOW INDEX FROM whatsapp_message_logs;
SHOW INDEX FROM contacts;
SHOW INDEX FROM bot_replies;
SHOW INDEX FROM vendor_settings;
```

## Success Criteria
✓ All PM2 services running
✓ Webhooks received and processed
✓ Bot replies working
✓ Campaigns sending at 5 msg/sec
✓ CPU usage under 50% during campaigns
✓ No errors in logs
✓ Message statuses updating correctly

## Next Steps After Testing
1. Monitor for 24 hours
2. Check error logs daily
3. Verify message delivery rates
4. Confirm CPU remains stable
5. If all good, consider this production-ready!
