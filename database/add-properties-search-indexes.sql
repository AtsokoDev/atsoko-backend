-- Level 1 + Level 2 Search Performance Upgrade
-- Adds PostgreSQL full-text and trigram indexes for property keyword search

-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Weighted full-text search index (property_id > title > remarks)
CREATE INDEX IF NOT EXISTS idx_properties_search_vector
ON properties
USING GIN (
    (
        setweight(to_tsvector('simple', COALESCE(property_id, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(title, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(remarks, '')), 'D')
    )
);

-- Trigram indexes for typo-tolerant matching
CREATE INDEX IF NOT EXISTS idx_properties_property_id_trgm
ON properties
USING GIN (property_id gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_properties_title_trgm
ON properties
USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_properties_remarks_trgm
ON properties
USING GIN (remarks gin_trgm_ops);
