#!/bin/bash

# WhatsJet Node.js Service - Troubleshooting Script
# This script helps diagnose and fix common issues

echo "========================================="
echo "WhatsJet Node.js Troubleshooting"
echo "========================================="
echo ""

# Check if Laravel APP_KEY exists
echo "1. Checking Laravel APP_KEY..."
if [ -f "../Source/.env" ]; then
    LARAVEL_KEY=$(grep "^APP_KEY=" ../Source/.env | cut -d'=' -f2)
    if [ -z "$LARAVEL_KEY" ]; then
        echo "   ❌ APP_KEY not found in Source/.env"
        echo "   Fix: Run 'php artisan key:generate' in Source directory"
    else
        echo "   ✅ Laravel APP_KEY found: ${LARAVEL_KEY:0:20}..."
    fi
else
    echo "   ❌ Source/.env file not found"
fi

echo ""

# Check if Node.js .env exists
echo "2. Checking Node.js .env file..."
if [ -f ".env" ]; then
    echo "   ✅ nodeapp/.env exists"
    
    # Check if APP_KEY is set
    NODE_KEY=$(grep "^APP_KEY=" .env | cut -d'=' -f2)
    if [ -z "$NODE_KEY" ]; then
        echo "   ❌ APP_KEY not set in nodeapp/.env"
        echo "   Fix: Add APP_KEY to nodeapp/.env"
        
        # Offer to fix automatically
        if [ ! -z "$LARAVEL_KEY" ]; then
            echo ""
            read -p "   Would you like to add it now? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                # Backup existing .env
                cp .env .env.backup
                # Add or update APP_KEY
                if grep -q "^APP_KEY=" .env; then
                    sed -i.tmp "s|^APP_KEY=.*|APP_KEY=$LARAVEL_KEY|" .env
                else
                    echo "APP_KEY=$LARAVEL_KEY" >> .env
                fi
                rm -f .env.tmp
                echo "   ✅ APP_KEY added to nodeapp/.env"
                echo "   📋 Backup saved as .env.backup"
            fi
        fi
    else
        echo "   ✅ APP_KEY is set: ${NODE_KEY:0:20}..."
        
        # Compare if they match
        if [ "$LARAVEL_KEY" = "$NODE_KEY" ]; then
            echo "   ✅ APP_KEYs match between Laravel and Node.js"
        else
            echo "   ❌ APP_KEYs DO NOT MATCH!"
            echo "   This will cause decryption errors"
            echo "   Fix: Update nodeapp/.env with the correct APP_KEY"
        fi
    fi
else
    echo "   ❌ nodeapp/.env not found"
    echo "   Fix: Copy .env.example to .env and configure it"
    
    if [ -f ".env.example" ]; then
        echo ""
        read -p "   Would you like to create .env from .env.example now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cp .env.example .env
            if [ ! -z "$LARAVEL_KEY" ]; then
                sed -i.tmp "s|^APP_KEY=.*|APP_KEY=$LARAVEL_KEY|" .env
                rm -f .env.tmp
            fi
            echo "   ✅ .env created from .env.example"
            [ ! -z "$LARAVEL_KEY" ] && echo "   ✅ APP_KEY added"
        fi
    fi
fi

echo ""

# Check database configuration
echo "3. Checking database configuration..."
if [ -f ".env" ]; then
    DB_HOST=$(grep "^DB_HOST=" .env | cut -d'=' -f2)
    DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2)
    DB_NAME=$(grep "^DB_DATABASE=" .env | cut -d'=' -f2)
    
    if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
        echo "   ⚠️  Database configuration incomplete"
    else
        echo "   ✅ Database configured: $DB_USER@$DB_HOST/$DB_NAME"
    fi
fi

echo ""

# Check if PM2 process is running
echo "4. Checking PM2 process..."
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "whatsjet-nodejs"; then
        echo "   ✅ PM2 process 'whatsjet-nodejs' is running"
        echo ""
        echo "   📋 Recent logs:"
        pm2 logs whatsjet-nodejs --lines 10 --nostream
    else
        echo "   ❌ PM2 process 'whatsjet-nodejs' not found"
        echo "   Fix: Start with 'pm2 start ecosystem.config.js'"
    fi
else
    echo "   ⚠️  PM2 not installed or not in PATH"
fi

echo ""
echo "========================================="
echo "Summary"
echo "========================================="
echo ""
echo "If you made changes:"
echo "  1. Restart Node.js service: pm2 restart whatsjet-nodejs"
echo "  2. Check logs: pm2 logs whatsjet-nodejs --lines 50"
echo ""
echo "For more help, see: LARAVEL-APPKEY-SETUP.md"
echo "========================================="
