BEGIN;

DELETE FROM property_requests
WHERE request_type = 'edit';

DO $$
DECLARE
    existing_constraint TEXT;
BEGIN
    SELECT con.conname
    INTO existing_constraint
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'property_requests'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%request_type%';

    IF existing_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE property_requests DROP CONSTRAINT %I', existing_constraint);
    END IF;
END $$;

ALTER TABLE property_requests
ADD CONSTRAINT property_requests_request_type_check
CHECK (request_type = 'delete');

COMMIT;
