-- Master Schema for Multi-language Support
-- Run this BEFORE modifying the properties table
-- Created: 2025-12-10

-- ============================================
-- MASTER TYPES TABLE
-- Stores property types with multi-language names
-- ============================================
CREATE TABLE IF NOT EXISTS master_types (
  id SERIAL PRIMARY KEY,
  name JSONB NOT NULL, -- {"en": "Factory", "th": "โรงงาน", "zh": "工厂"}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default types
INSERT INTO master_types (name) VALUES
  ('{"en": "Factory", "th": "โรงงาน", "zh": "工厂"}'),
  ('{"en": "Warehouse", "th": "โกดัง", "zh": "仓库"}')
ON CONFLICT DO NOTHING;

-- ============================================
-- MASTER STATUSES TABLE
-- Stores property statuses with multi-language names
-- ============================================
CREATE TABLE IF NOT EXISTS master_statuses (
  id SERIAL PRIMARY KEY,
  name JSONB NOT NULL, -- {"en": "For Rent", "th": "ให้เช่า", "zh": "出租"}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default statuses
INSERT INTO master_statuses (name) VALUES
  ('{"en": "For Rent", "th": "ให้เช่า", "zh": "出租"}'),
  ('{"en": "For Sale", "th": "ขาย", "zh": "出售"}'),
  ('{"en": "For Rent & Sale", "th": "ให้เช่าและขาย", "zh": "出租和出售"}')
ON CONFLICT DO NOTHING;

-- ============================================
-- MASTER LOCATIONS TABLE
-- Hierarchical storage: Province -> District -> Subdistrict
-- ============================================
CREATE TABLE IF NOT EXISTS master_locations (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES master_locations(id) ON DELETE CASCADE,
  level VARCHAR(20) NOT NULL CHECK (level IN ('province', 'district', 'subdistrict')),
  name JSONB NOT NULL, -- {"en": "Bangkok", "th": "กรุงเทพมหานคร", "zh": "曼谷"}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_locations_parent ON master_locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_locations_level ON master_locations(level);
CREATE INDEX IF NOT EXISTS idx_locations_name_en ON master_locations((name->>'en'));
CREATE INDEX IF NOT EXISTS idx_locations_name_th ON master_locations((name->>'th'));

-- Create indexes for master_types and master_statuses
CREATE INDEX IF NOT EXISTS idx_types_name_en ON master_types((name->>'en'));
CREATE INDEX IF NOT EXISTS idx_statuses_name_en ON master_statuses((name->>'en'));
