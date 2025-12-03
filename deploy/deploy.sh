#!/bin/bash

# Deployment Script for Atsoko Backend
# This script automates the deployment process

set -e  # Exit on error

APP_DIR="/var/www/atsoko-backend"
APP_NAME="atsoko-backend"

echo "================================"
echo "Deploying Atsoko Backend"
echo "================================"
echo ""

# Navigate to app directory
cd $APP_DIR

# Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Run database migrations if needed
echo "🗄️  Checking database..."
if [ -f "database/schema.sql" ]; then
    echo "   Database schema found. Run migrations manually if needed."
fi

# Restart the service (choose one method)
echo "🔄 Restarting application..."

# Method 1: Using systemd
if systemctl is-active --quiet $APP_NAME; then
    sudo systemctl restart $APP_NAME
    echo "✅ Service restarted via systemd"
fi

# Method 2: Using PM2 (if systemd restart failed)
if command -v pm2 &> /dev/null; then
    pm2 restart $APP_NAME || pm2 start ecosystem.config.js
    echo "✅ Service restarted via PM2"
fi

# Health check
echo ""
echo "🏥 Running health check..."
sleep 3

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)
if [ "$RESPONSE" = "200" ]; then
    echo "✅ Health check passed! API is running."
else
    echo "⚠️  Health check failed! Status code: $RESPONSE"
    echo "   Check logs: sudo journalctl -u $APP_NAME -n 50"
fi

echo ""
echo "================================"
echo "Deployment Complete!"
echo "================================"
