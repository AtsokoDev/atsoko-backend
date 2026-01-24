-- Migration: Add category and tags columns to properties table
-- Run this script to add the new fields to existing database

-- Add category column (VARCHAR for single category)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Add tags column (TEXT for JSON array of tags)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tags TEXT;

-- Create index for category for faster filtering
CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category);

-- Verify columns were added
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'properties' 
AND column_name IN ('category', 'tags');
