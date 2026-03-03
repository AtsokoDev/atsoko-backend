-- =====================================================
-- Versioning & Workflow Migration
-- Adds publication_status, moderation_status, property_versions
-- Run AFTER access-control-migration.sql
-- =====================================================

-- =====================================================
-- 1. Add new status columns to properties table
-- =====================================================
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS publication_status VARCHAR(20) DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'published', 'unpublished', 'deleted'));

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'none'
    CHECK (moderation_status IN (
        'none',
        'pending_add',
        'pending_edit',
        'pending_delete',
        'rejected_add',
        'rejected_edit',
        'rejected_delete'
    ));

ALTER TABLE properties ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);

-- =====================================================
-- 2. Migrate existing data: approve_status → publication_status
-- =====================================================
UPDATE properties SET publication_status = 'published'
WHERE approve_status = 'published' AND publication_status = 'draft';

UPDATE properties SET publication_status = 'deleted'
WHERE approve_status = 'deleted' AND publication_status = 'draft';

-- Pending properties that were never published → they are drafts
-- Pending properties with workflow_status 'ready_to_publish' are submitted drafts
UPDATE properties SET publication_status = 'draft', moderation_status = 'pending_add'
WHERE approve_status = 'pending'
  AND publication_status = 'draft'
  AND workflow_status IN ('pending', 'wait_to_fix', 'fixed', 'ready_to_publish');

-- Published properties are in normal state
UPDATE properties SET moderation_status = 'none'
WHERE publication_status = 'published';

-- Deleted properties are in normal state
UPDATE properties SET moderation_status = 'none'
WHERE publication_status = 'deleted';

-- =====================================================
-- 3. Create property_versions table
-- =====================================================
CREATE TABLE IF NOT EXISTS property_versions (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_data JSONB NOT NULL,
    is_live BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'archived', 'discarded')),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_by_role VARCHAR(20),
    reason TEXT,
    admin_note TEXT,
    reverted_from_version INTEGER REFERENCES property_versions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(property_id, version_number)
);

-- Indexes for property_versions
CREATE INDEX IF NOT EXISTS idx_pv_property_id ON property_versions(property_id);
CREATE INDEX IF NOT EXISTS idx_pv_status ON property_versions(status);
CREATE INDEX IF NOT EXISTS idx_pv_is_live ON property_versions(is_live);
CREATE INDEX IF NOT EXISTS idx_pv_created_at ON property_versions(created_at);
CREATE INDEX IF NOT EXISTS idx_pv_created_by ON property_versions(created_by);

-- =====================================================
-- 4. Add stale tracking to property_requests
-- =====================================================
ALTER TABLE property_requests ADD COLUMN IF NOT EXISTS stale_since TIMESTAMP;
ALTER TABLE property_requests ADD COLUMN IF NOT EXISTS live_snapshot_at_request JSONB;

-- =====================================================
-- 5. Add indexes for new status columns
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_properties_publication_status ON properties(publication_status);
CREATE INDEX IF NOT EXISTS idx_properties_moderation_status ON properties(moderation_status);
CREATE INDEX IF NOT EXISTS idx_properties_deleted_at ON properties(deleted_at);

-- =====================================================
-- 6. Create initial version snapshots for existing published properties
-- This creates a v0 "baseline" version for every published property
-- =====================================================
-- NOTE: Run this only once after migration. It creates a snapshot of
-- the current live data as version 0 for tracking purposes.
-- Uncomment and run manually:

-- INSERT INTO property_versions (property_id, version_number, version_data, is_live, status, created_by, created_by_role, reason)
-- SELECT
--     p.id,
--     0,
--     row_to_json(p.*)::jsonb - 'id' - 'created_at' - 'updated_at',
--     true,
--     'approved',
--     (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
--     'admin',
--     'Initial version created during migration'
-- FROM properties p
-- WHERE p.publication_status = 'published';

-- =====================================================
-- 7. Update triggers for updated_at on property_versions
-- =====================================================
CREATE OR REPLACE FUNCTION update_property_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_property_versions_updated_at ON property_versions;
CREATE TRIGGER trigger_update_property_versions_updated_at
    BEFORE UPDATE ON property_versions
    FOR EACH ROW
    EXECUTE FUNCTION update_property_versions_updated_at();

-- =====================================================
-- Summary
-- =====================================================
-- New columns on properties:
--   publication_status: 'draft' | 'published' | 'unpublished' | 'deleted'
--   moderation_status:  'none' | 'pending_add' | 'pending_edit' | 'pending_delete'
--                       | 'rejected_add' | 'rejected_edit' | 'rejected_delete'
--   deleted_at:         TIMESTAMP (for soft delete audit)
--   deleted_by:         INTEGER (who deleted)
--
-- New table: property_versions
--   Stores full JSONB snapshots of property data per version
--   is_live = true means this version is currently displayed on the website
--
-- Updated table: property_requests
--   stale_since:              marks when live data changed after request was created
--   live_snapshot_at_request:  snapshot of live data when request was made
