-- Properties Table Migration for Multi-language Support
-- Run this AFTER master-schema.sql
-- Created: 2025-12-10

-- ============================================
-- ADD NEW COLUMNS TO PROPERTIES TABLE
-- ============================================

-- Add foreign key columns for master tables
ALTER TABLE properties ADD COLUMN IF NOT EXISTS type_id INTEGER REFERENCES master_types(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS status_id INTEGER REFERENCES master_statuses(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS subdistrict_id INTEGER REFERENCES master_locations(id);

-- Add multi-language title fields
ALTER TABLE properties ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS title_th TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS title_zh TEXT;

-- Create indexes for the new foreign keys
CREATE INDEX IF NOT EXISTS idx_properties_type_id ON properties(type_id);
CREATE INDEX IF NOT EXISTS idx_properties_status_id ON properties(status_id);
CREATE INDEX IF NOT EXISTS idx_properties_subdistrict_id ON properties(subdistrict_id);

-- ============================================
-- HELPER FUNCTION: Get Location Hierarchy
-- Returns province, district, subdistrict names for a given subdistrict_id
-- ============================================
CREATE OR REPLACE FUNCTION get_location_hierarchy(p_subdistrict_id INTEGER)
RETURNS TABLE (
  subdistrict_name JSONB,
  district_name JSONB,
  province_name JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE location_tree AS (
    -- Start with the subdistrict
    SELECT id, parent_id, level, name, 1 as depth
    FROM master_locations
    WHERE id = p_subdistrict_id
    
    UNION ALL
    
    -- Recursively get parent locations
    SELECT ml.id, ml.parent_id, ml.level, ml.name, lt.depth + 1
    FROM master_locations ml
    INNER JOIN location_tree lt ON ml.id = lt.parent_id
  )
  SELECT 
    (SELECT name FROM location_tree WHERE level = 'subdistrict') as subdistrict_name,
    (SELECT name FROM location_tree WHERE level = 'district') as district_name,
    (SELECT name FROM location_tree WHERE level = 'province') as province_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to master tables
DROP TRIGGER IF EXISTS update_master_types_updated_at ON master_types;
CREATE TRIGGER update_master_types_updated_at
  BEFORE UPDATE ON master_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_master_statuses_updated_at ON master_statuses;
CREATE TRIGGER update_master_statuses_updated_at
  BEFORE UPDATE ON master_statuses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_master_locations_updated_at ON master_locations;
CREATE TRIGGER update_master_locations_updated_at
  BEFORE UPDATE ON master_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
