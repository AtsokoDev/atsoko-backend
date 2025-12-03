#!/bin/bash

# Database Setup Script for Atsoko Backend
# This script sets up PostgreSQL database, user, and schema

set -e  # Exit on error

echo "================================"
echo "PostgreSQL Database Setup"
echo "================================"
echo ""

# Configuration
DB_NAME="thaiindustrialproperty_db"
DB_USER="atsoko_user"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 32)}"  # Generate random password if not provided

echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Password: $DB_PASSWORD"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "Error: PostgreSQL is not installed!"
    echo "Install it with: sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi

# Switch to postgres user and create database and user
sudo -u postgres psql << EOF
-- Create database
CREATE DATABASE $DB_NAME;

-- Create user
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Connect to database and grant schema privileges
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;

\q
EOF

echo ""
echo "✅ Database and user created successfully!"
echo ""

# Run schema migration
echo "Running schema migration..."
SCHEMA_FILE="../database/schema.sql"

if [ -f "$SCHEMA_FILE" ]; then
    PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -d $DB_NAME -f $SCHEMA_FILE
    echo "✅ Schema created successfully!"
else
    echo "⚠️  Schema file not found at $SCHEMA_FILE"
    echo "   You'll need to run it manually later."
fi

echo ""
echo "================================"
echo "Setup Complete!"
echo "================================"
echo ""
echo "Add these to your .env file:"
echo "DB_HOST=localhost"
echo "DB_PORT=5432"
echo "DB_NAME=$DB_NAME"
echo "DB_USER=$DB_USER"
echo "DB_PASSWORD=$DB_PASSWORD"
echo ""
