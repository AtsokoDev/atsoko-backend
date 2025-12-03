-- Drop old tables
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  property_id VARCHAR(50) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  date DATE,
  type VARCHAR(100),
  status VARCHAR(50),
  labels TEXT,
  country VARCHAR(100),
  province VARCHAR(100),
  district VARCHAR(100),
  sub_district VARCHAR(100),
  location TEXT,
  price DECIMAL(12, 2),
  price_postfix VARCHAR(50),
  size DECIMAL(10, 2),
  size_prefix VARCHAR(50),
  terms_conditions TEXT,
  warehouse_length TEXT,
  electricity_system TEXT,
  clear_height VARCHAR(50),
  features TEXT,
  landlord_name VARCHAR(255),
  landlord_contact VARCHAR(255),
  agent_team VARCHAR(100),
  coordinates TEXT,
  floor_load VARCHAR(50),
  land_size DECIMAL(10, 2),
  land_postfix VARCHAR(50),
  remarks TEXT,
  slug TEXT,
  images JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_properties_property_id ON properties(property_id);
CREATE INDEX idx_properties_type ON properties(type);
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_properties_province ON properties(province);
CREATE INDEX idx_properties_district ON properties(district);
CREATE INDEX idx_properties_price ON properties(price);
CREATE INDEX idx_properties_size ON properties(size);
