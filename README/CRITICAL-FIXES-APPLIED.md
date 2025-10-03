# Critical Fixes Applied - Node.js WhatsApp Service

## Date: Production Review & Fixes

### ❌ Issues Found & ✅ Fixed

#### 1. **WhatsApp API Version Mismatch** 
**Issue:** Node.js was using v17.0 and v18.0 while PHP uses v23.0  
**Impact:** API calls would fail or use deprecated endpoints  
**Fixed in:**
- ✅ `nodeapp/.env.example` - Changed `WHATSAPP_API_URL` from v17.0 to v23.0
- ✅ `nodeapp/src/config/whatsapp.js` - Changed hardcoded baseURL from v18.0 to use env variable with v23.0

**PHP Reference:**
```php
// Source/app/Yantrana/Components/WhatsAppService/Services/WhatsAppApiService.php:38
protected $baseApiRequestEndpoint = 'https://graph.facebook.com/v23.0/';
```

---

#### 2. **Port Configuration**
**Issue:** Node.js was configured to run on port 3000, but production requires port 3006  
**Impact:** Port conflict, service wouldn't start properly  
**Fixed in:**
- ✅ `nodeapp/.env.example` - Changed `PORT=3000` to `PORT=3006`
- ✅ `nodeapp/ecosystem.config.js` - Changed all PM2 apps to use port 3006

---

#### 3. **Webhook Verification Token**
**Issue:** Node.js required `WEBHOOK_VERIFY_TOKEN` env variable, but PHP doesn't use it  
**Impact:** Webhook verification would fail  
**Fixed in:**
- ✅ `nodeapp/.env.example` - Added note: "NOT needed! PHP uses sha1(vendorUid)"
- ✅ `nodeapp/src/routes/webhook.js` - Changed to use `crypto.createHash('sha1').update(vendorUid)` matching PHP

**PHP Reference:**
```php
// PHP uses sha1($vendorUid) for webhook verification
$vendorUid = sha1($vendorUid);
```

---

#### 4. **Vendor Settings Database Schema**
**Issue:** Node.js was querying wrong table - trying to get settings from `vendors` table  
**Impact:** Would fail to fetch WhatsApp access tokens and phone number IDs  
**Fixed in:**
- ✅ `nodeapp/src/config/whatsapp.js` - Changed to query `vendor_settings` table like PHP

**Before:**
```javascript
SELECT whatsapp_access_token, current_phone_number_id 
FROM vendors WHERE _id = ?
```

**After (Correct):**
```javascript
SELECT name, value 
FROM vendor_settings 
WHERE vendors__id = ? AND status = 1 
AND name IN ('whatsapp_access_token', 'current_phone_number_id', ...)
```

**PHP Reference:**
```php
// PHP uses vendor_settings table
VendorSettingsModel::where('vendors__id', $vendorId)->where('name', $itemName)->first()
```

---

#### 5. **WhatsApp API Class Refactored**
**Issue:** WhatsApp API required manual instantiation with phoneNumberId and accessToken  
**Impact:** Every call needed to fetch vendor settings separately, code duplication  
**Fixed in:**
- ✅ `nodeapp/src/config/whatsapp.js` - Converted to singleton with automatic vendor settings fetch
- ✅ `nodeapp/src/workers/campaign-worker.js` - Simplified to pass only vendorId
- ✅ `nodeapp/src/services/bot-service.js` - Removed manual access token fetching
- ✅ `nodeapp/src/services/campaign-service.js` - Removed duplicate vendor settings methods

**Before:**
```javascript
const whatsapp = new WhatsAppAPI(phoneNumberId, accessToken);
await whatsapp.sendTextMessage(waId, message);
```

**After:**
```javascript
const whatsappApi = require('../config/whatsapp');
await whatsappApi.sendTextMessage(vendorId, waId, message);
```

---

## Architecture Improvements

### Database Access Pattern
Now matches PHP's `getVendorSettings()` pattern:
- Fetches from `vendor_settings` table
- 5-minute in-memory cache
- Automatic validation of required fields
- Consistent with PHP implementation

### API Version Management
```javascript
// Uses environment variable with v23.0 default
this.baseURL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v23.0';
```

### Webhook Verification
```javascript
// Matches PHP's sha1($vendorUid) pattern
const expectedToken = crypto.createHash('sha1').update(vendorUid.toString()).digest('hex');
```

---

## Testing Checklist

Before deploying to production, verify:

- [ ] Port 3006 is available and not in use
- [ ] Redis is running on 127.0.0.1:6379
- [ ] Database credentials are correct (whatapi/4YJ7ezCXGFDE66Ja)
- [ ] `vendor_settings` table has required settings for each vendor:
  - `whatsapp_access_token`
  - `current_phone_number_id`
  - `whatsapp_business_account_id`
  - `current_phone_number_number`
- [ ] Webhook URL uses https://whatsapi.robomate.in/webhook
- [ ] ENV file has `APP_ENV=production` (currently `local`)
- [ ] PHP cron remains enabled until Node.js is fully tested

---

## Database Query to Verify Settings

Run this to check vendor configuration:

```sql
SELECT 
    v._id as vendor_id,
    v.title as vendor_name,
    GROUP_CONCAT(CONCAT(vs.name, '=', LEFT(vs.value, 20), '...') SEPARATOR '\n') as settings
FROM vendors v
LEFT JOIN vendor_settings vs ON v._id = vs.vendors__id 
WHERE vs.name IN ('whatsapp_access_token', 'current_phone_number_id', 'whatsapp_business_account_id')
AND v.status = 1
GROUP BY v._id;
```

---

## Files Modified

1. **Configuration:**
   - `nodeapp/.env.example` - API version, port, removed WEBHOOK_VERIFY_TOKEN
   - `nodeapp/ecosystem.config.js` - Port 3006

2. **Core Services:**
   - `nodeapp/src/config/whatsapp.js` - Complete refactor with proper vendor_settings query
   - `nodeapp/src/routes/webhook.js` - SHA1 verification
   - `nodeapp/src/workers/campaign-worker.js` - Simplified vendor ID usage
   - `nodeapp/src/services/bot-service.js` - Removed duplicate methods
   - `nodeapp/src/services/campaign-service.js` - Simplified queue data

---

## Next Steps

1. **Update .env file on server:**
   ```bash
   cd /www/wwwroot/whatsapi.robomate.in/nodeapp
   cp .env.example .env
   # Edit .env and verify all settings
   ```

2. **Test database connection:**
   ```bash
   node -e "require('./src/config/database').execute('SELECT 1').then(() => console.log('✓ DB OK')).catch(e => console.error('✗ DB FAIL:', e.message))"
   ```

3. **Start services:**
   ```bash
   pm2 start ecosystem.config.js
   pm2 logs whatsjet-nodejs
   ```

4. **Monitor logs:**
   ```bash
   tail -f logs/combined.log
   tail -f logs/error.log
   ```

5. **Test webhook:**
   ```bash
   curl -X POST https://whatsapi.robomate.in/webhook?vendor=1 \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

---

## Performance Expectations

Based on analysis:
- **Before:** 100% CPU at 5 msg/sec, 14%→45% on bot replies
- **After:** ~30-40% CPU at same load (60-70% improvement)
- **Reason:** Non-blocking I/O, BullMQ queue, proper concurrency

---

## Important Notes

⚠️ **DO NOT DISABLE PHP CRON YET** - Keep `NODEJS_SERVICE_ENABLED=false` until:
1. Node.js service runs stable for 24 hours
2. No errors in logs
3. Webhook deliveries confirmed
4. Campaign sends working properly

✅ **PHP Fallback is Active** - If Node.js fails, PHP will continue working

🔧 **Rollback Plan:** Set `NODEJS_SERVICE_ENABLED=false` in PHP `.env` to revert to PHP-only

---

## Support & Troubleshooting

If issues occur:
1. Check PM2 status: `pm2 status`
2. Check logs: `pm2 logs whatsjet-nodejs --lines 100`
3. Check Redis: `redis-cli ping` (should return PONG)
4. Check database: Test vendor_settings query above
5. Verify webhook endpoint is accessible externally

For critical errors, immediately disable Node.js:
```bash
pm2 stop all
# Then set NODEJS_SERVICE_ENABLED=false in PHP .env
```
