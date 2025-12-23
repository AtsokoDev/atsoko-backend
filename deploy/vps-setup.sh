#!/bin/bash

# Quick VPS Setup Script
# Run this after cloning the repository

set -e  # Exit on error

echo "================================"
echo "🚀 Atsoko Backend VPS Setup"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    echo "❌ Error: Please run this script from the atsoko-backend directory"
    exit 1
fi

# Step 1: Install dependencies
echo "📦 Step 1: Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Step 2: Setup .env file
echo "📝 Step 2: Setting up .env file..."
if [ ! -f ".env" ]; then
    if [ -f "deploy/.env.production" ]; then
        cp deploy/.env.production .env
        echo "✅ Created .env from template"
        echo "⚠️  IMPORTANT: Edit .env file with your database credentials!"
        echo "   Run: nano .env"
    else
        echo "❌ Error: deploy/.env.production not found"
        exit 1
    fi
else
    echo "✅ .env file already exists"
fi
echo ""

# Step 3: Create logs directory
echo "📁 Step 3: Creating logs directory..."
mkdir -p logs
echo "✅ Logs directory created"
echo ""

# Step 4: Database setup
echo "🗄️  Step 4: Database setup"
echo "   You have two options:"
echo ""
echo "   Option A (Recommended): Run automated setup"
echo "   $ cd deploy && chmod +x setup-database.sh && ./setup-database.sh"
echo ""
echo "   Option B: Manual setup"
echo "   1. Create database and user in PostgreSQL"
echo "   2. Update .env with credentials"
echo "   3. Run: npm run migrate"
echo ""
read -p "Do you want to run automated database setup now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd deploy
    chmod +x setup-database.sh
    ./setup-database.sh
    cd ..
    echo "✅ Database setup completed"
    echo "⚠️  Copy the credentials above to your .env file!"
    echo ""
fi

# Step 5: Run migrations
echo "🔄 Step 5: Running database migrations..."
read -p "Have you updated .env with database credentials? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run migrate
    echo "✅ Migrations completed"
else
    echo "⚠️  Skipping migrations. Run 'npm run migrate' after updating .env"
fi
echo ""

# Step 6: Create admin user
echo "👤 Step 6: Create admin user"
read -p "Do you want to create an admin user now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run create-admin
else
    echo "⚠️  Skipping admin creation. Run 'npm run create-admin' later"
fi
echo ""

# Step 7: Choose process manager
echo "🚀 Step 7: Choose how to run the application"
echo ""
echo "   Option 1: PM2 (Recommended for production)"
echo "   Option 2: Systemd"
echo "   Option 3: Manual (npm start)"
echo ""
read -p "Choose option (1/2/3): " -n 1 -r
echo ""

case $REPLY in
    1)
        echo "Installing PM2..."
        if ! command -v pm2 &> /dev/null; then
            npm install -g pm2
        fi
        echo "Starting application with PM2..."
        pm2 start ecosystem.config.js
        pm2 save
        echo ""
        echo "✅ Application started with PM2"
        echo "   View status: pm2 status"
        echo "   View logs: pm2 logs atsoko-backend"
        echo "   Setup auto-start: pm2 startup (then follow instructions)"
        ;;
    2)
        echo "Setting up Systemd service..."
        sudo cp deploy/atsoko-backend.service /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl start atsoko-backend
        sudo systemctl enable atsoko-backend
        echo "✅ Application started with Systemd"
        echo "   View status: sudo systemctl status atsoko-backend"
        echo "   View logs: sudo journalctl -u atsoko-backend -f"
        ;;
    3)
        echo "⚠️  Manual mode selected"
        echo "   Run: npm start"
        echo "   Note: This won't auto-restart on crash or reboot"
        ;;
    *)
        echo "⚠️  Invalid option. You can start the app manually later."
        ;;
esac

echo ""
echo "================================"
echo "✅ Setup Complete!"
echo "================================"
echo ""
echo "📋 Next Steps:"
echo "1. Test the API: curl http://localhost:3000/"
echo "2. Check logs to ensure everything is working"
echo "3. Setup Nginx reverse proxy (optional)"
echo "4. Setup SSL certificate (optional)"
echo ""
echo "📚 For more details, see:"
echo "   - deploy/DEPLOYMENT-TH.md (Thai)"
echo "   - deploy/DEPLOYMENT.md (English)"
echo ""
echo "🎉 Happy deploying!"
