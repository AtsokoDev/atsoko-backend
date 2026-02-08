-- Add is_system column to note_types table (if not exists)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'note_types' AND column_name = 'is_system') THEN
        ALTER TABLE note_types ADD COLUMN is_system BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Ensure all system types exist
INSERT INTO note_types (code, name, allowed_roles, sort_order) VALUES 
('fix_request', 'Fix Request', ARRAY['admin'], 2),
('fix_response', 'Fix Response', ARRAY['agent'], 3),
('edit_request', 'Edit Request', ARRAY['admin', 'agent'], 4),
('delete_request', 'Delete Request', ARRAY['admin', 'agent'], 5)
ON CONFLICT (code) DO NOTHING;

-- Mark workflow automation types as system types
UPDATE note_types 
SET is_system = TRUE 
WHERE code IN ('fix_request', 'fix_response', 'edit_request', 'delete_request');

-- Add comment for documentation
COMMENT ON COLUMN note_types.is_system IS 'System note types cannot be deleted. Used by workflow automation and request system.';
