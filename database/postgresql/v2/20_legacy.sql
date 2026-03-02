-- Auto-generated from database/omnex.db on 2026-02-26 12:38:47
-- Module: legacy

-- Table: settings_backup
CREATE TABLE IF NOT EXISTS "legacy"."settings_backup" (
  "id" text,
  "company_id" text,
  "user_id" text,
  "category" text,
  "key" text,
  "value" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "data" text
);

