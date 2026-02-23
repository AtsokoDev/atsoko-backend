-- ============================================================
-- Migration: Fix property_id suffix to match actual status
-- ============================================================
-- Fixes existing records where:
--   status = 'Rent & Sale' but property_id ends in  R or S (should be SR)
--   status = 'Sale'        but property_id ends in  R or SR (should be S)
--   status = 'Rent'        but property_id ends in  S or SR (should be R)
--
-- Run dry-run first (SELECT), then apply (UPDATE inside transaction).
-- ============================================================

-- ── STEP 1: DRY RUN — preview what will change ──────────────
SELECT
    id,
    property_id                                         AS old_property_id,
    status,

    -- Determine correct suffix
    CASE
        WHEN LOWER(status) LIKE '%rent%' AND LOWER(status) LIKE '%sale%' THEN 'SR'
        WHEN LOWER(status) LIKE '%sale%'                                  THEN 'S'
        ELSE                                                                   'R'
    END                                                 AS correct_suffix,

    -- Current suffix
    SUBSTRING(property_id FROM '(SR|S|R)$')            AS current_suffix,

    -- What property_id should become
    REGEXP_REPLACE(
        property_id,
        '(SR|S|R)$',
        CASE
            WHEN LOWER(status) LIKE '%rent%' AND LOWER(status) LIKE '%sale%' THEN 'SR'
            WHEN LOWER(status) LIKE '%sale%'                                  THEN 'S'
            ELSE                                                                   'R'
        END
    )                                                   AS new_property_id

FROM properties
WHERE
    -- Only rows that follow the AT{number}{suffix} format
    property_id ~* '^AT[0-9]+(SR|S|R)$'

    -- Only rows where the suffix DOES NOT match the status
    AND SUBSTRING(property_id FROM '(SR|S|R)$') IS DISTINCT FROM
        CASE
            WHEN LOWER(status) LIKE '%rent%' AND LOWER(status) LIKE '%sale%' THEN 'SR'
            WHEN LOWER(status) LIKE '%sale%'                                  THEN 'S'
            ELSE                                                                   'R'
        END

ORDER BY id;


-- ── STEP 2: ACTUAL UPDATE (run after confirming dry-run) ─────
-- Uncomment to execute:

/*
BEGIN;

WITH corrections AS (
    SELECT
        id,
        property_id AS old_property_id,
        slug        AS old_slug,

        REGEXP_REPLACE(
            property_id,
            '(SR|S|R)$',
            CASE
                WHEN LOWER(status) LIKE '%rent%' AND LOWER(status) LIKE '%sale%' THEN 'SR'
                WHEN LOWER(status) LIKE '%sale%'                                  THEN 'S'
                ELSE                                                                   'R'
            END
        ) AS new_property_id,

        -- Update slug too (replace old property_id portion with new one, case-insensitive)
        REGEXP_REPLACE(
            slug,
            LOWER(property_id),
            LOWER(REGEXP_REPLACE(
                property_id,
                '(SR|S|R)$',
                CASE
                    WHEN LOWER(status) LIKE '%rent%' AND LOWER(status) LIKE '%sale%' THEN 'SR'
                    WHEN LOWER(status) LIKE '%sale%'                                  THEN 'S'
                    ELSE                                                                   'R'
                END
            )),
            'i'
        ) AS new_slug

    FROM properties
    WHERE
        property_id ~* '^AT[0-9]+(SR|S|R)$'
        AND SUBSTRING(property_id FROM '(SR|S|R)$') IS DISTINCT FROM
            CASE
                WHEN LOWER(status) LIKE '%rent%' AND LOWER(status) LIKE '%sale%' THEN 'SR'
                WHEN LOWER(status) LIKE '%sale%'                                  THEN 'S'
                ELSE                                                                   'R'
            END
)
UPDATE properties p
SET
    property_id = c.new_property_id,
    slug        = c.new_slug,
    updated_at  = NOW()
FROM corrections c
WHERE p.id = c.id
RETURNING
    p.id,
    c.old_property_id,
    p.property_id  AS new_property_id,
    c.old_slug,
    p.slug         AS new_slug,
    p.status;

-- Review the RETURNING output above before committing!
COMMIT;
-- Or ROLLBACK; if something looks wrong
*/
