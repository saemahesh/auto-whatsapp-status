# Laravel APP_KEY Setup for Node.js Service

## Issue
The Node.js service needs to decrypt Laravel encrypted values from the database (WhatsApp access tokens, phone number IDs, etc.). Without the correct APP_KEY, you'll see errors like:
- `Failed to decrypt Laravel value, returning raw string`
- `Invalid OAuth access token - Cannot parse access token`

## Solution

### Step 1: Get the APP_KEY from Laravel

1. Open the Laravel `.env` file:
   ```bash
   cat /path/to/Source/.env | grep APP_KEY
   ```

2. Copy the entire APP_KEY value, including the `base64:` prefix. It should look like:
   ```
   APP_KEY=base64:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Step 2: Add APP_KEY to Node.js Service

1. Open the Node.js `.env` file (or create it from .env.example):
   ```bash
   cd /path/to/nodeapp
   nano .env
   ```

2. Add the APP_KEY line (paste the exact value from Laravel):
   ```env
   APP_KEY=base64:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. Save and exit (Ctrl+X, Y, Enter in nano)

### Step 3: Restart the Node.js Service

```bash
pm2 restart whatsjet-nodejs
pm2 logs whatsjet-nodejs --lines 50
```

### Step 4: Verify

Check the logs for:
- `Laravel crypto initialized successfully` - Good!
- No more "Failed to decrypt" warnings
- No more "Invalid OAuth access token" errors

## Example Commands

### Quick Setup Script
```bash
# Get APP_KEY from Laravel
cd /path/to/project
LARAVEL_KEY=$(grep "^APP_KEY=" Source/.env | cut -d'=' -f2)

# Add to Node.js .env
cd nodeapp
if [ -f .env ]; then
    # Update existing .env
    sed -i.bak "s|^APP_KEY=.*|APP_KEY=$LARAVEL_KEY|" .env
else
    # Create from example
    cp .env.example .env
    sed -i.bak "s|^APP_KEY=.*|APP_KEY=$LARAVEL_KEY|" .env
fi

echo "APP_KEY configured successfully"
pm2 restart whatsjet-nodejs
```

## Troubleshooting

### Still seeing decryption errors?
1. Verify the APP_KEY is exactly the same in both files (including `base64:` prefix)
2. Check that there are no extra spaces or quotes around the APP_KEY
3. Restart the Node.js service after making changes

### APP_KEY not found in Laravel .env?
Generate a new one:
```bash
cd Source
php artisan key:generate
```
Then follow steps above to copy it to Node.js.

## Security Notes
- Never commit .env files to version control
- The APP_KEY is critical for security - keep it secret
- Both Laravel and Node.js must use the SAME APP_KEY to share encrypted data
