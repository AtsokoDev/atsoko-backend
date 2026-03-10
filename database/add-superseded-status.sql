-- Migration: Add 'superseded' status to property_requests table
-- Purpose: Allow archiving old rejected requests when agent creates new request
-- Date: 2026-03-10

BEGIN;

-- Drop the existing constraint
ALTER TABLE property_requests DROP CONSTRAINT IF EXISTS property_requests_status_check;

-- Add new constraint with 'superseded' included
ALTER TABLE property_requests 
ADD CONSTRAINT property_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'superseded'));

COMMIT;
