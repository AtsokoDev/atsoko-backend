-- Migration: Normalize features and labels to JSON Array format
-- Run this ONCE to clean up existing data

-- ============================================
-- STEP 1: Create mapping for features normalization
-- ============================================
CREATE TEMP TABLE feature_mapping (old_value TEXT, new_value TEXT);
INSERT INTO feature_mapping VALUES
('With Office Area', 'With Office area'),
('Security Guard', 'Security guard'),
('Detached Building', 'Detached building'),
('Raised-Floor Loading Bay', 'Raised-floor loading bay'),
('Overhead Crane', 'Overhead crane'),
('On Main Road', 'On main road');

-- ============================================
-- STEP 2: Create mapping for zone normalization
-- ============================================
CREATE TEMP TABLE zone_mapping (old_value TEXT, new_value TEXT);
INSERT INTO zone_mapping VALUES
('Purple zone', 'Purple Zone'),
('Purple Zone', 'Purple Zone'),
('Industrial estate zone', 'Industrial Estate Zone (IEAT)'),
('Industrial Estate Zone', 'Industrial Estate Zone (IEAT)'),
('Free-trade zone', 'Free Trade Zone'),
('Free-Trade Zone', 'Free Trade Zone');

-- ============================================
-- STEP 3: Normalize features and extract zones
-- ============================================
DO $$
DECLARE
    prop RECORD;
    features_arr JSONB;
    new_features JSONB;
    new_labels JSONB;
    existing_labels JSONB;
    item TEXT;
    mapped_value TEXT;
    zone_values TEXT[] := ARRAY['Purple Zone', 'Purple zone', 'Industrial Estate Zone', 'Industrial estate zone', 'Free-Trade Zone', 'Free-trade zone'];
BEGIN
    FOR prop IN SELECT id, features, labels FROM properties WHERE features IS NOT NULL AND features != '' AND features != '[]'
    LOOP
        -- Parse features JSON
        BEGIN
            features_arr := prop.features::jsonb;
        EXCEPTION WHEN OTHERS THEN
            CONTINUE;
        END;
        
        new_features := '[]'::jsonb;
        new_labels := '[]'::jsonb;
        
        -- Parse existing labels (pipe-separated or JSON)
        IF prop.labels IS NOT NULL AND prop.labels != '' THEN
            IF prop.labels LIKE '[%' THEN
                BEGIN
                    existing_labels := prop.labels::jsonb;
                EXCEPTION WHEN OTHERS THEN
                    existing_labels := '[]'::jsonb;
                END;
            ELSE
                -- Convert pipe-separated to array
                existing_labels := '[]'::jsonb;
                FOR item IN SELECT unnest(string_to_array(prop.labels, '|'))
                LOOP
                    item := trim(item);
                    IF item != '' THEN
                        -- Normalize zone value
                        SELECT new_value INTO mapped_value FROM zone_mapping WHERE old_value = item;
                        IF mapped_value IS NOT NULL THEN
                            item := mapped_value;
                        END IF;
                        IF NOT existing_labels ? item THEN
                            existing_labels := existing_labels || to_jsonb(item);
                        END IF;
                    END IF;
                END LOOP;
            END IF;
        ELSE
            existing_labels := '[]'::jsonb;
        END IF;
        
        new_labels := existing_labels;
        
        -- Process each feature
        FOR item IN SELECT jsonb_array_elements_text(features_arr)
        LOOP
            -- Check if it's a zone
            IF item = ANY(zone_values) THEN
                -- Normalize and add to labels
                SELECT new_value INTO mapped_value FROM zone_mapping WHERE old_value = item;
                IF mapped_value IS NOT NULL THEN
                    item := mapped_value;
                END IF;
                IF NOT new_labels ? item THEN
                    new_labels := new_labels || to_jsonb(item);
                END IF;
            ELSE
                -- Normalize feature
                SELECT new_value INTO mapped_value FROM feature_mapping WHERE old_value = item;
                IF mapped_value IS NOT NULL THEN
                    item := mapped_value;
                END IF;
                IF NOT new_features ? item THEN
                    new_features := new_features || to_jsonb(item);
                END IF;
            END IF;
        END LOOP;
        
        -- Update the property
        UPDATE properties 
        SET features = new_features::text,
            labels = new_labels::text
        WHERE id = prop.id;
        
    END LOOP;
END $$;

-- ============================================
-- STEP 4: Convert remaining pipe-separated labels to JSON Array
-- ============================================
UPDATE properties
SET labels = (
    SELECT jsonb_agg(
        COALESCE(
            (SELECT new_value FROM zone_mapping WHERE old_value = trim(label)),
            trim(label)
        )
    )::text
    FROM unnest(string_to_array(labels, '|')) AS label
    WHERE trim(label) != ''
)
WHERE labels IS NOT NULL 
  AND labels != '' 
  AND labels NOT LIKE '[%';

-- ============================================
-- STEP 5: Set empty arrays for NULL values
-- ============================================
UPDATE properties SET features = '[]' WHERE features IS NULL OR features = '';
UPDATE properties SET labels = '[]' WHERE labels IS NULL OR labels = '';

-- Clean up
DROP TABLE IF EXISTS feature_mapping;
DROP TABLE IF EXISTS zone_mapping;
