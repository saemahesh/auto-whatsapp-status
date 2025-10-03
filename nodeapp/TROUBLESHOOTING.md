# ⚠️ IMPORTANT: APP_KEY Configuration Required

## Current Issue: "Invalid OAuth access token"

If you're seeing this error in your logs:
```
error: Failed to send interactive message {"error":{"error":{"code":190...
```

**This means the APP_KEY is not configured in your Node.js .env file.**

## Quick Fix (3 Steps)

### Step 1: Copy APP_KEY from Laravel

```bash
cd /Users/rambhasa/projects/scripts/auto-whatsapp-status
grep "^APP_KEY=" Source/.env
```

Copy the entire line, it looks like:
```
APP_KEY=base64:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 2: Add APP_KEY to Node.js .env

```bash
cd nodeapp
nano .env
```

Add or update this line (paste the exact value from Step 1):
```
APP_KEY=base64:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Save and exit (Ctrl+X, Y, Enter)

### Step 3: Restart Node.js Service

```bash
pm2 restart whatsjet-nodejs
pm2 logs whatsjet-nodejs --lines 20
```

## Automated Fix

Or use the troubleshooting script which will do this automatically:

```bash
cd /Users/rambhasa/projects/scripts/auto-whatsapp-status/nodeapp
./troubleshoot.sh
```

## Verify the Fix

After restart, check logs for:
- ✅ `Laravel crypto initialized successfully` 
- ✅ No "Failed to decrypt" warnings
- ✅ No "Invalid OAuth access token" errors
- ✅ Bot replies should work

## Still Not Working?

1. **Check if APP_KEYs match:**
   ```bash
   diff <(grep "^APP_KEY=" ../Source/.env) <(grep "^APP_KEY=" .env)
   ```
   If there's output, they don't match!

2. **Check if values are encrypted in database:**
   ```bash
   mysql -u whatapi -p whatapi -e "SELECT name, LEFT(value, 50) FROM vendor_settings WHERE name IN ('whatsapp_access_token', 'current_phone_number_id') LIMIT 2;"
   ```
   Values should start with `{"iv":` if encrypted.

3. **Enable debug logging:**
   - Edit `.env` and set `LOG_LEVEL=debug`
   - Restart: `pm2 restart whatsjet-nodejs`
   - Check logs: `pm2 logs whatsjet-nodejs`

## Why This is Important

Laravel stores sensitive WhatsApp credentials (access tokens, phone number IDs) in **encrypted** format in the database for security. The Node.js service needs the same `APP_KEY` to decrypt these values.

Without the correct APP_KEY:
- ❌ Can't decrypt access tokens
- ❌ Can't send WhatsApp messages
- ❌ Bots won't reply
- ❌ Campaigns won't work

## Files Modified

I've created/updated these files to fix the issue:
1. `nodeapp/src/utils/laravel-crypto.js` - Laravel decryption utility
2. `nodeapp/src/config/whatsapp.js` - Added decryption support
3. `nodeapp/.env.example` - Added APP_KEY documentation
4. `nodeapp/LARAVEL-APPKEY-SETUP.md` - Detailed setup guide
5. `nodeapp/troubleshoot.sh` - Automated troubleshooting script
6. `nodeapp/TROUBLESHOOTING.md` - This file

## Next Steps

After configuring APP_KEY:
1. Test by sending a message to your WhatsApp number
2. Check if bot replies work
3. Check if campaigns send successfully
4. Monitor CPU usage to ensure it stays normal

---

**Need help?** Run `./troubleshoot.sh` for automated diagnostics.
