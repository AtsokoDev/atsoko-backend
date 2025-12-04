#!/bin/bash

# Script to reset database and import new data
# This will drop all tables, recreate schema, and import data from CSV

DB_NAME="thaiindustrialproperty_db"
DB_USER="postgres"

echo "================================"
echo "Database Reset and Import Script"
echo "================================"
echo ""
echo "⚠️  WARNING: This will delete all existing data!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo ""
echo "Step 1/3: Dropping existing tables..."
sudo -u postgres psql -d $DB_NAME -c "DROP TABLE IF EXISTS properties CASCADE;"
echo "✓ Tables dropped"

echo ""
echo "Step 2/3: Creating new schema..."
sudo -u postgres psql -d $DB_NAME -f database/schema.sql
echo "✓ Schema created"

echo ""
echo "Step 3/3: Importing data from File (19).csv..."
node scripts/import-data.js

echo ""
echo "================================"
echo "✓ Process complete!"
echo "================================"
