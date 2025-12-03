#!/bin/bash

# Health Check Script
# Checks if the application and database are running properly

set -e

APP_URL="${APP_URL:-http://localhost:3000}"
LOG_FILE="/var/log/atsoko-health.log"

echo "================================"
echo "Atsoko Backend Health Check"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check service
check_service() {
    local service_name=$1
    if systemctl is-active --quiet $service_name; then
        echo -e "${GREEN}✅ $service_name is running${NC}"
        return 0
    else
        echo -e "${RED}❌ $service_name is NOT running${NC}"
        return 1
    fi
}

# Function to check HTTP endpoint
check_http() {
    local url=$1
    local expected_code=${2:-200}
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $url)
    
    if [ "$HTTP_CODE" = "$expected_code" ]; then
        echo -e "${GREEN}✅ API endpoint responding ($HTTP_CODE)${NC}"
        return 0
    else
        echo -e "${RED}❌ API endpoint failed ($HTTP_CODE)${NC}"
        return 1
    fi
}

# Function to check database
check_database() {
    if [ -f "/var/www/atsoko-backend/.env" ]; then
        source /var/www/atsoko-backend/.env
        
        PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -d $DB_NAME -c "SELECT COUNT(*) FROM properties;" > /dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            PROPERTY_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -d $DB_NAME -t -c "SELECT COUNT(*) FROM properties;" | tr -d ' ')
            echo -e "${GREEN}✅ Database connected ($PROPERTY_COUNT properties)${NC}"
            return 0
        else
            echo -e "${RED}❌ Database connection failed${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  .env file not found, skipping database check${NC}"
        return 0
    fi
}

# Function to check disk space
check_disk() {
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ $DISK_USAGE -lt 80 ]; then
        echo -e "${GREEN}✅ Disk usage: ${DISK_USAGE}%${NC}"
        return 0
    elif [ $DISK_USAGE -lt 90 ]; then
        echo -e "${YELLOW}⚠️  Disk usage: ${DISK_USAGE}% (warning)${NC}"
        return 0
    else
        echo -e "${RED}❌ Disk usage: ${DISK_USAGE}% (critical)${NC}"
        return 1
    fi
}

# Function to check memory
check_memory() {
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
    
    if [ $MEM_USAGE -lt 90 ]; then
        echo -e "${GREEN}✅ Memory usage: ${MEM_USAGE}%${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Memory usage: ${MEM_USAGE}%${NC}"
        return 0
    fi
}

# Run all checks
FAILED=0

echo "1. Checking services..."
check_service "nginx" || FAILED=$((FAILED+1))
check_service "postgresql" || FAILED=$((FAILED+1))
check_service "atsoko-backend" 2>/dev/null || echo -e "${YELLOW}⚠️  atsoko-backend service not found (might be using PM2)${NC}"

echo ""
echo "2. Checking API endpoint..."
check_http "$APP_URL/" || FAILED=$((FAILED+1))

echo ""
echo "3. Checking database..."
check_database || FAILED=$((FAILED+1))

echo ""
echo "4. Checking system resources..."
check_disk || FAILED=$((FAILED+1))
check_memory

echo ""
echo "================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo "[$(date)] Health check: PASSED" >> $LOG_FILE
    exit 0
else
    echo -e "${RED}❌ $FAILED check(s) failed${NC}"
    echo "[$(date)] Health check: FAILED ($FAILED failures)" >> $LOG_FILE
    exit 1
fi
