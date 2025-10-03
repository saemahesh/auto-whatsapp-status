#!/bin/bash

echo "========================================="
echo " WhatsJet Node.js Service Installation  "
echo "========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✓ npm version: $(npm --version)"

# Navigate to nodeapp directory
cd "$(dirname "$0")"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed successfully"

# Create logs directory
echo ""
echo "📁 Creating logs directory..."
mkdir -p logs
echo "✓ Logs directory created"

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📄 Creating .env file..."
    cp .env.example .env
    echo "✓ Created .env file from .env.example"
    echo ""
    echo "⚠️  IMPORTANT: Please configure the .env file with your settings before starting the service"
    echo ""
else
    echo ""
    echo "✓ .env file already exists"
fi

# Install PM2 globally
echo ""
echo "🔧 Installing PM2..."
npm install -g pm2

if [ $? -ne 0 ]; then
    echo "❌ Failed to install PM2"
    exit 1
fi

echo "✓ PM2 installed successfully"

# Check if Redis is running
echo ""
echo "🔍 Checking Redis..."
if command -v redis-cli &> /dev/null; then
    redis-cli ping &> /dev/null
    if [ $? -eq 0 ]; then
        echo "✓ Redis is running"
    else
        echo "⚠️  Redis is not running. Please start Redis before running the service."
    fi
else
    echo "⚠️  Redis CLI not found. Please install Redis before running the service."
fi

echo ""
echo "========================================="
echo " Installation Complete!                 "
echo "========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Configure the .env file:"
echo "   nano .env"
echo ""
echo "2. Start the service:"
echo "   pm2 start ecosystem.config.js"
echo ""
echo "3. Save PM2 configuration:"
echo "   pm2 save"
echo ""
echo "4. Monitor the service:"
echo "   pm2 monit"
echo ""
echo "5. View logs:"
echo "   pm2 logs whatsjet-nodejs"
echo ""
echo "========================================="
