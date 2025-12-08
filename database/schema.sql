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
  price_alternative DECIMAL(12, 2),
  approve_status VARCHAR(50),
  post_modified_date TIMESTAMP,
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

-- Create tips table for articles/blog posts
CREATE TABLE IF NOT EXISTS tips (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image VARCHAR(500),
  author VARCHAR(255),
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for tips
CREATE INDEX idx_tips_slug ON tips(slug);
CREATE INDEX idx_tips_published_at ON tips(published_at);

-- Create faq table for frequently asked questions
CREATE TABLE IF NOT EXISTS faq (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(100),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faq
CREATE INDEX idx_faq_category ON faq(category);
CREATE INDEX idx_faq_is_active ON faq(is_active);
CREATE INDEX idx_faq_display_order ON faq(display_order);

-- Create contact_messages table for contact form submissions
CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  subject VARCHAR(500),
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'new',
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for contact_messages
CREATE INDEX idx_contact_status ON contact_messages(status);
CREATE INDEX idx_contact_created_at ON contact_messages(created_at);
CREATE INDEX idx_contact_email ON contact_messages(email);
