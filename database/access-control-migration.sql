-- =====================================================
-- Access Control Migration
-- Adds workflow system for property management
-- =====================================================

-- 1. Add workflow_status column to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(50) DEFAULT 'pending';

-- Update existing properties:
-- - published properties -> workflow_status = 'ready_to_publish'
-- - pending properties -> workflow_status = 'pending'
UPDATE properties 
SET workflow_status = 'ready_to_publish' 
WHERE approve_status = 'published' AND workflow_status IS NULL;

UPDATE properties 
SET workflow_status = 'pending' 
WHERE approve_status = 'pending' AND workflow_status IS NULL;

-- 2. Create property_requests table for edit/delete requests
CREATE TABLE IF NOT EXISTS property_requests (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('edit', 'delete')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by INTEGER NOT NULL REFERENCES users(id),
    reason TEXT, -- Why the agent wants to edit/delete
    requested_changes JSONB, -- For edit requests: { field: newValue, ... }
    admin_response TEXT, -- Admin's reason for approve/reject
    processed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Create indexes for property_requests
CREATE INDEX IF NOT EXISTS idx_property_requests_property_id ON property_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_property_requests_status ON property_requests(status);
CREATE INDEX IF NOT EXISTS idx_property_requests_requested_by ON property_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_property_requests_type ON property_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_property_requests_created_at ON property_requests(created_at);

-- 3. Create property_notes table for communication between admin and agent
CREATE TABLE IF NOT EXISTS property_notes (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    request_id INTEGER REFERENCES property_requests(id) ON DELETE CASCADE, -- Optional link to request
    author_id INTEGER NOT NULL REFERENCES users(id),
    note_type VARCHAR(30) NOT NULL DEFAULT 'general' CHECK (note_type IN ('general', 'fix_request', 'fix_response', 'approval', 'rejection')),
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- If true, only admins can see
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for property_notes
CREATE INDEX IF NOT EXISTS idx_property_notes_property_id ON property_notes(property_id);
CREATE INDEX IF NOT EXISTS idx_property_notes_request_id ON property_notes(request_id);
CREATE INDEX IF NOT EXISTS idx_property_notes_author_id ON property_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_property_notes_created_at ON property_notes(created_at);

-- 4. Create workflow_history table to track status changes
CREATE TABLE IF NOT EXISTS workflow_history (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    previous_workflow_status VARCHAR(50),
    new_workflow_status VARCHAR(50),
    previous_approval_status VARCHAR(50),
    new_approval_status VARCHAR(50),
    changed_by INTEGER NOT NULL REFERENCES users(id),
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for workflow_history
CREATE INDEX IF NOT EXISTS idx_workflow_history_property_id ON workflow_history(property_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_created_at ON workflow_history(created_at);

-- 5. Add index on workflow_status in properties table
CREATE INDEX IF NOT EXISTS idx_properties_workflow_status ON properties(workflow_status);
CREATE INDEX IF NOT EXISTS idx_properties_approve_status ON properties(approve_status);

-- Summary of new statuses:
-- approval_status: 'pending', 'published'
-- workflow_status: 'pending', 'wait_to_fix', 'fixed', 'ready_to_publish'
