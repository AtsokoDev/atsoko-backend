#!/bin/bash

# =====================================================
# Complete Deployment Script
# =====================================================
# Automated deployment workflow:
# 1. Backup database
# 2. Pull latest code
# 3. Install dependencies
# 4. Run migrations
# 5. Restart application
# =====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "  🚀 Deployment Started"
echo "======================================"
echo "Time: $(date)"
echo ""

# Function to print step
print_step() {
    echo ""
    echo "======================================"
    echo "  $1"
    echo "======================================"
    echo ""
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the project root?"
    exit 1
fi

# Step 1: Backup database
print_step "Step 1/5: Backing up database"
if [ -f "scripts/backup-db.sh" ]; then
    chmod +x scripts/backup-db.sh
    ./scripts/backup-db.sh
    print_success "Database backup completed"
else
    print_warning "Backup script not found, skipping backup"
fi

# Step 2: Pull latest code
print_step "Step 2/5: Pulling latest code from Git"
git fetch origin
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: $CURRENT_BRANCH"

# Check if there are changes
if git diff --quiet origin/$CURRENT_BRANCH; then
    print_warning "No new changes to pull"
else
    echo "Pulling changes..."
    git pull origin $CURRENT_BRANCH
    print_success "Code updated successfully"
fi

# Step 3: Install dependencies
print_step "Step 3/5: Installing dependencies"
if [ -f "package-lock.json" ]; then
    npm ci  # Clean install (faster and more reliable)
else
    npm install
fi
print_success "Dependencies installed"

# Step 4: Run migrations
print_step "Step 4/5: Running database migrations"
if [ -f "scripts/migrate.sh" ]; then
    chmod +x scripts/migrate.sh
    ./scripts/migrate.sh
    print_success "Migrations completed"
else
    print_warning "Migration script not found, skipping migrations"
fi

# Step 5: Restart application
print_step "Step 5/5: Restarting application"

# Check if PM2 is being used
if command -v pm2 &> /dev/null; then
    if [ -f "ecosystem.config.js" ]; then
        echo "Restarting with PM2..."
        pm2 restart ecosystem.config.js
        print_success "Application restarted with PM2"
        echo ""
        echo "Application status:"
        pm2 status
    else
        print_warning "ecosystem.config.js not found, restarting all PM2 processes"
        pm2 restart all
    fi
else
    print_warning "PM2 not found. Please restart your application manually."
    echo "If using systemd: sudo systemctl restart atsoko-backend"
    echo "If using PM2: pm2 restart all"
fi

# Final summary
echo ""
echo "======================================"
echo "  ✅ Deployment Complete"
echo "======================================"
echo "Time: $(date)"
echo ""
echo "📋 Next steps:"
echo "1. Verify application is running:"
echo "   pm2 status"
echo ""
echo "2. Check application logs:"
echo "   pm2 logs"
echo ""
echo "3. Test critical features:"
echo "   - Login"
echo "   - Create property"
echo "   - Submit for review"
echo "   - Approve/Reject"
echo ""
echo "4. If issues occur, rollback:"
echo "   git reset --hard HEAD~1"
echo "   npm install"
echo "   pm2 restart all"
echo ""
print_success "Deployment completed successfully! 🎉"
