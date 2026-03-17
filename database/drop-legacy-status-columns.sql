-- ============================================================
-- Drop legacy status columns from properties table
-- These columns are replaced by the new 2-layer model:
-- - approve_status (legacy) → publication_status (new)
-- - workflow_status (legacy) → moderation_status (new)
-- ============================================================
-- This migration should only be run after verifying that no code
-- references these columns anymore.

BEGIN;

-- Check if columns exist before dropping (for safety)
ALTER TABLE properties
DROP COLUMN IF EXISTS approve_status,
DROP COLUMN IF EXISTS workflow_status;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Successfully dropped legacy status columns from properties table';
END $$;

COMMIT;

-- ============================================================
-- Verification query (run after migration):
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'properties' 
-- ORDER BY column_name;
-- ============================================================
