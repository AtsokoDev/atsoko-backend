-- Note Types Dynamic Table
-- For managing note categories dynamically

-- Create note_types table
CREATE TABLE IF NOT EXISTS note_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,  -- e.g., 'general', 'fix_request'
    name_th VARCHAR(100) NOT NULL,      -- Thai display name
    name_en VARCHAR(100),               -- English display name
    description TEXT,                   -- Description of when to use
    color VARCHAR(20),                  -- Optional: UI color code
    icon VARCHAR(50),                   -- Optional: Icon name
    allowed_roles TEXT[] DEFAULT ARRAY['admin', 'agent'],  -- Who can use this type
    is_active BOOLEAN DEFAULT true,     -- Soft delete
    sort_order INTEGER DEFAULT 0,       -- Display order
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default note types
INSERT INTO note_types (code, name_th, name_en, description, allowed_roles, sort_order) VALUES
    ('general', 'ทั่วไป', 'General', 'หมายเหตุทั่วไป', ARRAY['admin', 'agent'], 1),
    ('fix_request', 'ขอให้แก้ไข', 'Fix Request', 'Admin ขอให้ Agent แก้ไข property', ARRAY['admin'], 2),
    ('fix_response', 'ตอบกลับการแก้ไข', 'Fix Response', 'Agent ตอบกลับการแก้ไข', ARRAY['agent'], 3),
    ('approval', 'อนุมัติ', 'Approval', 'หมายเหตุการอนุมัติ', ARRAY['admin'], 4),
    ('rejection', 'ปฏิเสธ', 'Rejection', 'หมายเหตุการปฏิเสธ', ARRAY['admin'], 5)
ON CONFLICT (code) DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_note_types_code ON note_types(code);
CREATE INDEX IF NOT EXISTS idx_note_types_active ON note_types(is_active);
