-- ============================================================
-- Migrate features and labels columns from TEXT to JSONB
-- This migration safely converts existing JSON strings to JSONB
-- ============================================================
-- Run before this migration:
-- ALTER TABLE properties DISABLE TRIGGER ALL;

BEGIN;

-- Drop existing indexes that might use these columns
DROP INDEX IF EXISTS idx_properties_features;
DROP INDEX IF EXISTS idx_properties_labels;

-- Add temporary columns for new JSONB data
ALTER TABLE properties
ADD COLUMN features_jsonb JSONB DEFAULT '[]'::jsonb,
ADD COLUMN labels_jsonb JSONB DEFAULT '[]'::jsonb;

-- Migrate data from TEXT to JSONB
-- Handle NULL, empty strings, and valid JSON
UPDATE properties SET 
    features_jsonb = CASE
        WHEN features IS NULL THEN '[]'::jsonb
        WHEN features = '' THEN '[]'::jsonb
        WHEN features = '[]' THEN '[]'::jsonb
        ELSE features::jsonb
    END,
    labels_jsonb = CASE
        WHEN labels IS NULL THEN '[]'::jsonb
        WHEN labels = '' THEN '[]'::jsonb
        WHEN labels = '[]' THEN '[]'::jsonb
        ELSE labels::jsonb
    END
WHERE TRUE;

-- Drop old columns
ALTER TABLE properties
DROP COLUMN features,
DROP COLUMN labels;

-- Rename new JSONB columns to original names
ALTER TABLE properties
RENAME COLUMN features_jsonb TO features;

ALTER TABLE properties
RENAME COLUMN labels_jsonb TO labels;

-- Create indexes on new JSONB columns for better query performance
CREATE INDEX idx_properties_features_gin ON properties USING GIN(features);
CREATE INDEX idx_properties_labels_gin ON properties USING GIN(labels);

COMMIT;

-- ============================================================
-- After this migration runs successfully:
-- - Code already uses ::jsonb cast, so no backend changes needed
-- - Queries will be faster with native JSONB storage
-- - Data integrity is maintained during the conversion
-- ============================================================
