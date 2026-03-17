BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'workflow_history'
          AND column_name = 'previous_workflow_status'
    ) THEN
        ALTER TABLE workflow_history RENAME COLUMN previous_workflow_status TO previous_moderation_status;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'workflow_history'
          AND column_name = 'new_workflow_status'
    ) THEN
        ALTER TABLE workflow_history RENAME COLUMN new_workflow_status TO new_moderation_status;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'workflow_history'
          AND column_name = 'previous_approval_status'
    ) THEN
        ALTER TABLE workflow_history RENAME COLUMN previous_approval_status TO previous_publication_status;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'workflow_history'
          AND column_name = 'new_approval_status'
    ) THEN
        ALTER TABLE workflow_history RENAME COLUMN new_approval_status TO new_publication_status;
    END IF;
END $$;

COMMIT;
