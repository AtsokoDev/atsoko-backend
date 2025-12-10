-- Master Features and Electricity Schema
-- Add additional master tables for multi-language support

-- ==============================================================
-- master_features: Features with multi-language names
-- ==============================================================
CREATE TABLE IF NOT EXISTS master_features (
    id SERIAL PRIMARY KEY,
    name JSONB NOT NULL,  -- {"en": "...", "th": "...", "zh": "..."}
    category VARCHAR(50) DEFAULT 'feature', -- 'feature' or 'zone'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert standard features with translations
INSERT INTO master_features (name, category) VALUES
('{"en": "Detached building", "th": "อาคารเดี่ยว", "zh": "独立建筑"}', 'feature'),
('{"en": "Security guard", "th": "พนักงานรักษาความปลอดภัย", "zh": "警卫"}', 'feature'),
('{"en": "With Office area", "th": "พร้อมพื้นที่สำนักงาน", "zh": "办公区域"}', 'feature'),
('{"en": "Raised-floor loading bay", "th": "พื้นที่ขนถ่ายสินค้าแบบยกพื้น", "zh": "高架装卸平台"}', 'feature'),
('{"en": "On main road", "th": "บนถนนสายหลัก", "zh": "主路旁"}', 'feature'),
('{"en": "Overhead crane", "th": "เครนเหนือศีรษะ", "zh": "桥式起重机"}', 'feature'),
('{"en": "Purple zone", "th": "โซนสีม่วง", "zh": "紫色区域"}', 'zone'),
('{"en": "Industrial estate zone", "th": "เขตนิคมอุตสาหกรรม", "zh": "工业园区"}', 'zone'),
('{"en": "Free-trade zone", "th": "เขตการค้าเสรี", "zh": "自由贸易区"}', 'zone')
ON CONFLICT DO NOTHING;

-- ==============================================================
-- master_electricity: Electricity systems with multi-language names
-- ==============================================================
CREATE TABLE IF NOT EXISTS master_electricity (
    id SERIAL PRIMARY KEY,
    name JSONB NOT NULL,  -- {"en": "...", "th": "...", "zh": "..."}
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert electricity system options with translations
INSERT INTO master_electricity (name, sort_order) VALUES
('{"en": "Single Phase (Upgradable)", "th": "เฟสเดียว (อัปเกรดได้)", "zh": "单相 (可升级)"}', 1),
('{"en": "3 Phase 15/45 Amp (Upgradable)", "th": "3 เฟส 15/45 แอมป์ (อัปเกรดได้)", "zh": "三相 15/45 安培 (可升级)"}', 2),
('{"en": "3 Phase 30/100 Amp (Upgradable)", "th": "3 เฟส 30/100 แอมป์ (อัปเกรดได้)", "zh": "三相 30/100 安培 (可升级)"}', 3),
('{"en": "3 Phase 50/150 Amp (Upgradable)", "th": "3 เฟส 50/150 แอมป์ (อัปเกรดได้)", "zh": "三相 50/150 安培 (可升级)"}', 4),
('{"en": "3 Phase, 250 kVA", "th": "3 เฟส 250 kVA", "zh": "三相 250 千伏安"}', 5)
ON CONFLICT DO NOTHING;

-- ==============================================================
-- master_clear_height: Clear height options (optional, for dropdowns)
-- ==============================================================
CREATE TABLE IF NOT EXISTS master_clear_height (
    id SERIAL PRIMARY KEY,
    value VARCHAR(10) NOT NULL, -- "6m", "7m", etc.
    name JSONB NOT NULL,  -- {"en": "6 meters", "th": "6 เมตร", "zh": "6米"}
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert clear height options with translations
INSERT INTO master_clear_height (value, name, sort_order) VALUES
('3m', '{"en": "3 meters", "th": "3 เมตร", "zh": "3米"}', 1),
('4m', '{"en": "4 meters", "th": "4 เมตร", "zh": "4米"}', 2),
('5m', '{"en": "5 meters", "th": "5 เมตร", "zh": "5米"}', 3),
('6m', '{"en": "6 meters", "th": "6 เมตร", "zh": "6米"}', 4),
('7m', '{"en": "7 meters", "th": "7 เมตร", "zh": "7米"}', 5),
('8m', '{"en": "8 meters", "th": "8 เมตร", "zh": "8米"}', 6),
('9m', '{"en": "9 meters", "th": "9 เมตร", "zh": "9米"}', 7),
('10m', '{"en": "10 meters", "th": "10 เมตร", "zh": "10米"}', 8),
('11m', '{"en": "11 meters", "th": "11 เมตร", "zh": "11米"}', 9),
('12m', '{"en": "12 meters", "th": "12 เมตร", "zh": "12米"}', 10),
('13m', '{"en": "13 meters", "th": "13 เมตร", "zh": "13米"}', 11),
('14m', '{"en": "14 meters", "th": "14 เมตร", "zh": "14米"}', 12),
('15m', '{"en": "15 meters", "th": "15 เมตร", "zh": "15米"}', 13)
ON CONFLICT DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_master_features_category ON master_features(category);
CREATE INDEX IF NOT EXISTS idx_master_electricity_sort ON master_electricity(sort_order);
CREATE INDEX IF NOT EXISTS idx_master_clear_height_sort ON master_clear_height(sort_order);
