-- Update Note Types to Standard Codes
-- This changes the old single-letter codes (a,b,c,d,e) to descriptive codes

BEGIN;

-- Update existing note types to standard codes and names
UPDATE note_types SET 
    code = 'general',
    name = 'General',
    allowed_roles = ARRAY['admin', 'agent'],
    sort_order = 1
WHERE code = 'c';

UPDATE note_types SET 
    code = 'fix_request',
    name = 'Fix Request',
    allowed_roles = ARRAY['admin'],
    sort_order = 2
WHERE code = 'd';

UPDATE note_types SET 
    code = 'fix_response',
    name = 'Fix Response',
    allowed_roles = ARRAY['agent'],
    sort_order = 3
WHERE code = 'e';

UPDATE note_types SET 
    code = 'approval',
    name = 'Approval',
    allowed_roles = ARRAY['admin'],
    sort_order = 4
WHERE code = 'a';

UPDATE note_types SET 
    code = 'rejection',
    name = 'Rejection',
    allowed_roles = ARRAY['admin'],
    sort_order = 5
WHERE code = 'b';

-- Update property_notes to use new codes
UPDATE property_notes SET note_type = 'general' WHERE note_type = 'c';
UPDATE property_notes SET note_type = 'fix_request' WHERE note_type = 'd';
UPDATE property_notes SET note_type = 'fix_response' WHERE note_type = 'e';
UPDATE property_notes SET note_type = 'approval' WHERE note_type = 'a';
UPDATE property_notes SET note_type = 'rejection' WHERE note_type = 'b';

COMMIT;

-- Verify
SELECT code, name, allowed_roles, is_active, sort_order
FROM note_types
ORDER BY sort_order;
