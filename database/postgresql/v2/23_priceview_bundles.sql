-- =========================================================
-- PriceView: Hard delete tracking for bundle delta sync
-- =========================================================

CREATE TABLE IF NOT EXISTS audit.bundle_deletions (
    id          uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
    bundle_id   uuid          NOT NULL,
    company_id  uuid          NOT NULL,
    sku         text,
    barcode     text,
    deleted_at  timestamptz   DEFAULT now() NOT NULL,
    deleted_by  uuid
);

CREATE INDEX IF NOT EXISTS idx_bundle_deletions_company_deleted_at
    ON audit.bundle_deletions(company_id, deleted_at DESC);

ALTER TABLE audit.bundle_deletions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'bundle_deletions' AND policyname = 'bundle_deletions_isolation'
    ) THEN
        EXECUTE 'CREATE POLICY bundle_deletions_isolation
            ON audit.bundle_deletions
            USING (
                current_setting(''app.role'', true) = ''superadmin''
                OR company_id::text = current_setting(''app.company_id'', true)
            )';
    END IF;
END $$;
