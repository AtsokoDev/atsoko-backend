-- Migration: Add display_order to tips table
-- Run this script to add display_order column for custom sorting

-- Add display_order column
ALTER TABLE tips ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Set initial order based on published_at (newest = 1)
UPDATE tips SET display_order = sub.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY published_at DESC NULLS LAST) as row_num
  FROM tips
) sub
WHERE tips.id = sub.id;

-- Create index for faster sorting
CREATE INDEX IF NOT EXISTS idx_tips_display_order ON tips(display_order);

-- Verify
SELECT id, title, display_order, published_at 
FROM tips 
ORDER BY display_order ASC 
LIMIT 10;
