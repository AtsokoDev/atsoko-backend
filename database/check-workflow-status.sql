-- Check properties with NULL workflow_status
-- This query helps identify properties that were created before workflow_status was properly set

SELECT 
    id,
    property_id,
    title,
    approve_status,
    workflow_status,
    agent_team,
    created_at,
    updated_at
FROM properties
WHERE workflow_status IS NULL
ORDER BY created_at DESC;

-- Count by approve_status for properties with NULL workflow_status
SELECT 
    approve_status,
    COUNT(*) as count
FROM properties
WHERE workflow_status IS NULL
GROUP BY approve_status;

-- Fix: Update all properties with NULL workflow_status to 'pending'
-- Run this AFTER reviewing the above queries
-- UPDATE properties 
-- SET workflow_status = 'pending' 
-- WHERE workflow_status IS NULL;
