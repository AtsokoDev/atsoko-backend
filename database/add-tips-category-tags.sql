-- Migration: Add category and tags to tips table

-- Add category column (single category)
ALTER TABLE tips ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Add tags column (JSON array of tags)
ALTER TABLE tips ADD COLUMN IF NOT EXISTS tags TEXT;

-- Create index for category
CREATE INDEX IF NOT EXISTS idx_tips_category ON tips(category);

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tips' 
ORDER BY ordinal_position;
