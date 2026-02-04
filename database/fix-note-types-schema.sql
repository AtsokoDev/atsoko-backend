-- Fix Note Types Schema Migration
-- Change from name_th/name_en to single name field
-- This is required for API compatibility

-- Step 1: Add name column if not exists
ALTER TABLE note_types 
ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- Step 2: Copy data from name_en (prefer English, fallback to Thai, then code)
UPDATE note_types 
SET name = COALESCE(name_en, name_th, code) 
WHERE name IS NULL OR name = '';

-- Step 3: Make name NOT NULL
ALTER TABLE note_types 
ALTER COLUMN name SET NOT NULL;

-- Step 4: (Optional) Drop old columns
-- Uncomment these if you want to completely remove multi-language support
-- ALTER TABLE note_types DROP COLUMN IF EXISTS name_th;
-- ALTER TABLE note_types DROP COLUMN IF EXISTS name_en;

-- Verify the changes
SELECT code, name, allowed_roles, is_active 
FROM note_types 
ORDER BY sort_order;
