# Node.js Setup Guide for aaPanel

## Overview
This guide explains how to set up the Node.js WhatsApp service on aaPanel hosting.

---

## Prerequisites

### 1. Install Node.js on aaPanel

#### Method A: Using aaPanel App Store (Recommended)
1. Log into aaPanel dashboard
2. Click **"App Store"** in the left sidebar
3. Search for **"Node.js"** or **"PM2"**
4. Click **"Install"**
5. Select Node.js version: **18.x or higher**
6. Wait for installation to complete

#### Method B: Manual Installation via Terminal
```bash
# SSH into your server
ssh root@your-server-ip

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

### 2. Install Redis on aaPanel

#### Method A: Using aaPanel App Store
1. Go to **App Store**
2. Search for **"Redis"**
3. Click **"Install"**
4. Wait for installation to complete
5. Start Redis service

#### Method B: Manual Installation
```bash
# Install Redis
apt-get update
apt-get install redis-server -y

# Start Redis
systemctl start redis-server
systemctl enable redis-server

# Verify Redis is running
redis-cli ping  # Should return: PONG
```

### 3. Install PM2 Globally
```bash
npm install -g pm2
pm2 --version  # Verify installation
```

---

## Step 1: Upload Node.js Service Files

### Option A: Using aaPanel File Manager
1. Go to **"Files"** in aaPanel
2. Navigate to your project directory: `/www/wwwroot/your-domain.com/`
3. Verify the `nodeapp/` folder exists with all files
4. If not, upload the entire `nodeapp` folder

### Option B: Using SFTP
1. Use FileZilla or any SFTP client
2. Connect to your server
3. Upload the `nodeapp/` folder to `/www/wwwroot/your-domain.com/nodeapp/`

### Option C: Using Git (If you have repository)
```bash
cd /www/wwwroot/your-domain.com/
git pull origin main  # Pull latest changes including nodeapp/
```

---

## Step 2: Configure Node.js Environment

### Navigate to nodeapp directory
```bash
cd /www/wwwroot/your-domain.com/nodeapp
```

### Create .env file
```bash
cp .env.example .env
nano .env
```

### Update .env with your credentials
```env
# Application
NODE_ENV=production
PORT=3000

# Database (same as Laravel)
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_DATABASE=your_database_name
DB_CONNECTION_LIMIT=20

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# WhatsApp Cloud API
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_API_VERSION=v17.0

# Webhook Verification Token (from WhatsApp Dashboard)
WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Queue Settings
MAX_CONCURRENT_WEBHOOKS=50
MAX_WEBHOOK_RATE=100
MAX_CONCURRENT_MESSAGES=5
MAX_MESSAGE_RATE=5

# Cache
CACHE_TTL=1800
```

**To find your database credentials:**
```bash
cd /www/wwwroot/your-domain.com/Source
cat .env | grep DB_
```

Save the file: Press `Ctrl + X`, then `Y`, then `Enter`

---

## Step 3: Install Node.js Dependencies

```bash
cd /www/wwwroot/your-domain.com/nodeapp
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

**Expected output:**
```
added 245 packages in 30s
```

If you see any errors, check:
- Node.js version: `node --version` (should be 18+)
- npm version: `npm --version`
- Internet connectivity

---

## Step 4: Create Logs Directory

```bash
cd /www/wwwroot/your-domain.com/nodeapp
mkdir -p logs
chmod 755 logs
```

---

## Step 5: Test Node.js Service

### Quick test before starting with PM2:
```bash
cd /www/wwwroot/your-domain.com/nodeapp
npm start
```

You should see:
```
Server started on port 3000
Database connected successfully
Redis connected successfully
```

Press `Ctrl + C` to stop the test.

If you see errors:
- Check database credentials in .env
- Verify Redis is running: `redis-cli ping`
- Check MySQL is running: `systemctl status mysql`

---

## Step 6: Start with PM2

### Start the service
```bash
cd /www/wwwroot/your-domain.com/nodeapp
pm2 start ecosystem.config.js
```

### Check status
```bash
pm2 status
```

**Expected output:**
```
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ whatsapp-service   │ cluster  │ 0    │ online    │ 0%       │ 45.2mb   │
│ 1  │ whatsapp-service   │ cluster  │ 0    │ online    │ 0%       │ 42.8mb   │
│ 2  │ webhook-worker     │ fork     │ 0    │ online    │ 0%       │ 38.5mb   │
│ 3  │ campaign-worker    │ fork     │ 0    │ online    │ 0%       │ 36.2mb   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

All should show **"online"** status.

---

## Step 7: Configure PM2 Auto-Start

### Save PM2 configuration
```bash
pm2 save
```

### Generate startup script
```bash
pm2 startup
```

This will show a command like:
```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
```

**Copy and run that command.** This ensures PM2 starts automatically when server reboots.

### Verify auto-start is configured
```bash
systemctl status pm2-root  # or pm2-www-data
```

---

## Step 8: Configure Laravel to Use Node.js

### Update Laravel .env
```bash
cd /www/wwwroot/your-domain.com/Source
nano .env
```

Add these lines:
```env
NODEJS_SERVICE_URL=http://localhost:3000
NODEJS_SERVICE_ENABLED=true
```

Save: `Ctrl + X`, `Y`, `Enter`

### Clear Laravel cache
```bash
php artisan config:clear
php artisan cache:clear
php artisan route:clear
```

---

## Step 9: Test the Integration

### Test 1: Health Check
```bash
curl http://localhost:3000/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "uptime": 123,
  "database": "connected",
  "redis": "connected",
  "memory": {"heapUsed": 45000000, "heapTotal": 67000000}
}
```

### Test 2: Laravel to Node.js Communication
```bash
cd /www/wwwroot/your-domain.com/Source
php artisan tinker
```

In tinker:
```php
$service = app(\App\Services\NodeJsService::class);
$health = $service->healthCheck();
var_dump($health);
```

Should show: `array("status" => "healthy", "healthy" => true, ...)`

### Test 3: Campaign Trigger
```bash
php artisan whatsapp:campaign:nodejs
```

Should output: `✓ Campaign processing triggered successfully`

---

## Step 10: Configure aaPanel Firewall (If Needed)

If Node.js is running but can't be accessed:

1. Go to **Security** in aaPanel
2. Click **"Add Rule"**
3. Add port **3000**
4. Protocol: **TCP**
5. Source: **127.0.0.1** (localhost only - for security)
6. Click **"Submit"**

**Note:** Port 3000 should only be accessible from localhost (127.0.0.1), not from the internet, since Laravel will communicate with it internally.

---

## Monitoring and Logs

### View Logs
```bash
# View all logs
pm2 logs

# View specific process logs
pm2 logs whatsapp-service
pm2 logs webhook-worker
pm2 logs campaign-worker

# View last 100 lines
pm2 logs --lines 100

# View only errors
pm2 logs --err
```

### Monitor Resources
```bash
pm2 monit
```

This shows real-time CPU and memory usage.

### Check Process Status
```bash
pm2 status
```

---

## Common PM2 Commands

```bash
# Start services
pm2 start ecosystem.config.js

# Stop all services
pm2 stop all

# Restart all services
pm2 restart all

# Stop specific service
pm2 stop whatsapp-service

# Restart specific service
pm2 restart whatsapp-service

# Delete all services
pm2 delete all

# View logs
pm2 logs

# Clear logs
pm2 flush

# Save current PM2 configuration
pm2 save

# Resurrect saved configuration
pm2 resurrect
```

---

## Troubleshooting

### Issue 1: PM2 command not found
**Solution:**
```bash
npm install -g pm2
# Or add to PATH
export PATH=$PATH:/usr/bin
```

### Issue 2: Port 3000 already in use
**Solution:**
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in nodeapp/.env
PORT=3001
```

Then restart PM2.

### Issue 3: Redis connection error
**Solution:**
```bash
# Check if Redis is running
redis-cli ping

# If not, start it
systemctl start redis-server

# Check Redis status
systemctl status redis-server
```

### Issue 4: Database connection error
**Solution:**
- Verify credentials in `nodeapp/.env`
- Test MySQL connection:
  ```bash
  mysql -h localhost -u your_user -p your_database
  ```
- Check if MySQL is running:
  ```bash
  systemctl status mysql
  ```

### Issue 5: PM2 processes crash immediately
**Solution:**
```bash
# View error logs
pm2 logs --err --lines 50

# Common causes:
# - Wrong database credentials
# - Redis not running
# - Missing .env file
# - Wrong file permissions

# Check .env file exists
ls -la /www/wwwroot/your-domain.com/nodeapp/.env

# Check file permissions
chmod 644 /www/wwwroot/your-domain.com/nodeapp/.env
```

### Issue 6: High memory usage
**Solution:**
- The ecosystem.config.js is configured with 500MB limit per instance
- If you need to adjust:
  ```bash
  nano /www/wwwroot/your-domain.com/nodeapp/ecosystem.config.js
  ```
  
  Change:
  ```javascript
  max_memory_restart: '500M',  // Adjust to 750M or 1G if needed
  ```

### Issue 7: PM2 not starting on reboot
**Solution:**
```bash
# Re-configure startup
pm2 startup

# Save configuration
pm2 save

# Test by rebooting
reboot

# After reboot, check status
pm2 status
```

---

## Performance Monitoring

### Check CPU and Memory Usage
```bash
pm2 monit
```

### Check Queue Status
```bash
redis-cli
> KEYS bull:*
> LLEN bull:webhook:wait
> LLEN bull:campaign:wait
```

### Check Database Performance
```bash
mysql -u user -p -e "SHOW PROCESSLIST;" database_name
```

---

## Testing Campaign and Webhooks

### Test Campaign Processing
1. Log into your WhatsApp admin panel
2. Create a test campaign with 5 messages
3. Monitor Node.js logs:
   ```bash
   pm2 logs campaign-worker
   ```
4. You should see messages being sent at 5/second rate

### Test Webhook Processing
1. Send a message to your WhatsApp number
2. Monitor webhook logs:
   ```bash
   pm2 logs webhook-worker
   ```
3. You should see webhook received and processed

### Monitor System Resources
```bash
# Check CPU usage
top

# Or use htop (install if needed)
apt-get install htop
htop
```

**Expected Results:**
- CPU usage during campaign: 30-40% (was 100%)
- CPU during webhook: < 5% spike (was 45%)
- No website freezing
- All messages delivered successfully

---

## Security Best Practices

1. **Keep Node.js on localhost only** (already configured)
   - Don't expose port 3000 to the internet
   - Only Laravel should communicate with it

2. **Use strong database passwords**
   - Update in both Laravel and Node.js .env files

3. **Keep Node.js and PM2 updated**
   ```bash
   npm install -g npm@latest
   npm install -g pm2@latest
   pm2 update
   ```

4. **Monitor logs regularly**
   ```bash
   pm2 logs --lines 100
   ```

5. **Set up log rotation** (prevent log files from growing too large)
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

---

## Backup Strategy

### Backup PM2 Configuration
```bash
pm2 save
cp ~/.pm2/dump.pm2 ~/pm2-backup-$(date +%Y%m%d).pm2
```

### Backup Node.js Application
```bash
cd /www/wwwroot/your-domain.com/
tar -czf nodeapp-backup-$(date +%Y%m%d).tar.gz nodeapp/
```

---

## Summary

After completing this setup:

✅ **Node.js service running** on port 3000
✅ **PM2 managing** 4 processes (2 main + 2 workers)
✅ **Auto-start configured** on server reboot
✅ **Laravel integrated** with Node.js
✅ **Redis queues** processing webhooks and campaigns
✅ **Monitoring** via PM2 logs and monit
✅ **Expected performance:**
   - Webhook response: < 10ms
   - Campaign CPU: 30-40% (down from 100%)
   - Webhook CPU: < 5% spike (down from 45%)
   - No website freezing

---

## Next Steps

1. ✅ Complete database optimization (see AAPANEL-DATABASE-OPTIMIZATION-GUIDE.md)
2. ✅ Set up Node.js service (this guide)
3. 📊 Monitor performance for 24-48 hours
4. 🔍 Check logs for any errors
5. 🚀 Run full campaign test
6. ✅ Verify system stability

---

## Support

If you need help:
1. Check PM2 logs: `pm2 logs`
2. Check Laravel logs: `tail -f /www/wwwroot/your-domain.com/Source/storage/logs/laravel.log`
3. Check Redis: `redis-cli monitor`
4. Check system resources: `htop`

Everything should be working smoothly now! 🎉
