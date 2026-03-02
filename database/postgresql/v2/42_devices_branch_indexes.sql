-- Optional branch-filtered device listing index

CREATE INDEX IF NOT EXISTS "idx_devices_company_branch_created_at"
    ON "devices"."devices" ("company_id", "branch_id", "created_at" DESC);

