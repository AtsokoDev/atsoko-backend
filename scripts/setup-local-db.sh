#!/bin/bash

# Script to setup local PostgreSQL database
# This replaces the Docker-based database setup

DB_NAME="thaiindustrialproperty_db"
DB_USER="postgres"

echo "Setting up local PostgreSQL database..."

# Check if database exists
DB_EXISTS=$(sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -w $DB_NAME | wc -l)

if [ $DB_EXISTS -eq 0 ]; then
    echo "Creating database: $DB_NAME"
    sudo -u postgres createdb $DB_NAME
    echo "Database created successfully!"
else
    echo "Database $DB_NAME already exists"
fi

# Run schema
echo "Running schema.sql..."
sudo -u postgres psql -d $DB_NAME -f database/schema.sql

echo "Database setup complete!"
echo ""
echo "Database details:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
