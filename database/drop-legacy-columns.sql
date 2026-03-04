-- ============================================================================
-- Migration: Drop Legacy Status Columns
-- Date: 2026-03-03
-- Purpose: Remove deprecated approve_status + workflow_status from properties
--          and requested_changes from property_requests.
--          These columns are no longer written to or read by any code.
--
-- Prerequisites:
--   - All backend code must use publication_status + moderation_status only
--   - All frontend code must not reference approve_status / workflow_status
--   - B1 (stop sync) and F1-F3 (frontend cleanup) must be completed
--
-- IMPORTANT: Run this on a database backup first. This is irreversible.
-- ============================================================================

BEGIN;

-- -------------------------------------------------------
-- 1. Drop legacy status columns from properties table
-- -------------------------------------------------------
-- Safety check: ensure publication_status is populated for all rows
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count
    FROM properties
    WHERE publication_status IS NULL;

    IF null_count > 0 THEN
        RAISE EXCEPTION 'Cannot drop columns: % rows still have NULL publication_status. Backfill first.', null_count;
    END IF;
END $$;

-- Drop the columns
ALTER TABLE properties DROP COLUMN IF EXISTS approve_status;
ALTER TABLE properties DROP COLUMN IF EXISTS workflow_status;

-- -------------------------------------------------------
-- 2. Drop requested_changes from property_requests table
--    (edit requests are deprecated → 410; column is unused)
-- -------------------------------------------------------
ALTER TABLE property_requests DROP COLUMN IF EXISTS requested_changes;

-- -------------------------------------------------------
-- 3. Add NOT NULL constraint to publication_status
--    (now that it's the sole source of truth)
-- -------------------------------------------------------
ALTER TABLE properties
    ALTER COLUMN publication_status SET NOT NULL,
    ALTER COLUMN publication_status SET DEFAULT 'draft';

-- Ensure moderation_status also has a default
ALTER TABLE properties
    ALTER COLUMN moderation_status SET DEFAULT 'none';

-- -------------------------------------------------------
-- 4. Verify
-- -------------------------------------------------------
DO $$
BEGIN
    -- Verify columns are gone
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'properties' AND column_name = 'approve_status'
    ) THEN
        RAISE EXCEPTION 'approve_status column still exists!';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'properties' AND column_name = 'workflow_status'
    ) THEN
        RAISE EXCEPTION 'workflow_status column still exists!';
    END IF;

    RAISE NOTICE 'Migration complete: legacy columns dropped successfully.';
END $$;

COMMIT;
