-- =====================================================
-- Check New Status Model (publication_status + moderation_status)
-- Run this to verify the new 2-layer status model is correctly applied.
-- =====================================================

-- 1. Overview: count properties by publication_status
SELECT 
    COALESCE(publication_status, '(NULL)') as publication_status,
    COUNT(*) as count
FROM properties
GROUP BY publication_status
ORDER BY count DESC;

-- 2. Overview: count properties by moderation_status
SELECT 
    COALESCE(moderation_status, '(NULL)') as moderation_status,
    COUNT(*) as count
FROM properties
GROUP BY moderation_status
ORDER BY count DESC;

-- 3. Cross-tab: publication_status × moderation_status
SELECT 
    COALESCE(publication_status, '(NULL)') as pub_status,
    COALESCE(moderation_status, '(NULL)') as mod_status,
    COUNT(*) as count
FROM properties
GROUP BY publication_status, moderation_status
ORDER BY publication_status, moderation_status;

-- 4. Properties with NULL new-model fields (need migration)
SELECT 
    id, property_id, title,
    approve_status, workflow_status,
    publication_status, moderation_status,
    created_at
FROM properties
WHERE publication_status IS NULL OR moderation_status IS NULL
ORDER BY created_at DESC
LIMIT 50;

-- 5. Consistency check: legacy vs new fields mismatch
SELECT 
    id, property_id,
    approve_status, publication_status,
    workflow_status, moderation_status,
    CASE 
        WHEN approve_status = 'published' AND publication_status != 'published' THEN 'MISMATCH'
        WHEN approve_status = 'pending' AND publication_status NOT IN ('draft', 'unpublished') THEN 'MISMATCH'
        WHEN approve_status = 'deleted' AND publication_status != 'deleted' THEN 'MISMATCH'
        ELSE 'OK'
    END as consistency
FROM properties
WHERE (
    (approve_status = 'published' AND COALESCE(publication_status, 'draft') != 'published')
    OR (approve_status = 'pending' AND COALESCE(publication_status, 'draft') NOT IN ('draft', 'unpublished'))
    OR (approve_status = 'deleted' AND COALESCE(publication_status, 'draft') != 'deleted')
)
LIMIT 50;

-- 6. Pending moderation items (what admin needs to review)
SELECT 
    id, property_id, title, agent_team,
    publication_status, moderation_status,
    updated_at
FROM properties
WHERE COALESCE(moderation_status, 'none') != 'none'
  AND COALESCE(publication_status, 'draft') != 'deleted'
ORDER BY updated_at ASC;
