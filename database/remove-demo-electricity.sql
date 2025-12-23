-- Remove demo data: "3 Phase, 250 kVA" from master_electricity
-- Run this on your database

-- Note: If any property is using this value, you may want to update them first
-- Check for properties using this electricity system:
-- SELECT * FROM properties WHERE electricity_system LIKE '%250 kVA%';

-- Delete the demo electricity option
DELETE FROM master_electricity 
WHERE name->>'en' = '3 Phase, 250 kVA';

-- Confirm deletion
SELECT * FROM master_electricity ORDER BY sort_order;
