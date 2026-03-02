-- Auto-generated from database/omnex.db on 2026-02-26 12:38:47
-- Module: branch

-- Table: branch_import_logs
CREATE TABLE IF NOT EXISTS "branch"."branch_import_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "branch_id" uuid,
  "import_type" text NOT NULL,
  "import_mode" text NOT NULL,
  "source_type" text,
  "source_name" text,
  "status" text DEFAULT 'pending',
  "total_rows" integer DEFAULT 0,
  "processed_rows" integer DEFAULT 0,
  "inserted_rows" integer DEFAULT 0,
  "updated_rows" integer DEFAULT 0,
  "skipped_rows" integer DEFAULT 0,
  "failed_rows" integer DEFAULT 0,
  "changes_log" text,
  "errors_log" text,
  "warnings_log" text,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  CONSTRAINT "pk_branch_import_logs" PRIMARY KEY ("id")
);

-- Table: branch_price_history
CREATE TABLE IF NOT EXISTS "branch"."branch_price_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "old_price" double precision,
  "new_price" double precision,
  "price_type" text DEFAULT 'current',
  "change_reason" text,
  "change_source" text,
  "change_percent" double precision,
  "changed_at" timestamptz DEFAULT now(),
  "changed_by" uuid,
  "metadata" text,
  CONSTRAINT "pk_branch_price_history" PRIMARY KEY ("id")
);

-- Table: branches
CREATE TABLE IF NOT EXISTS "branch"."branches" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "parent_id" uuid,
  "code" text NOT NULL,
  "external_code" text,
  "name" text NOT NULL,
  "type" text DEFAULT 'store',
  "address" text,
  "city" text,
  "district" text,
  "postal_code" text,
  "country" text DEFAULT 'TR',
  "phone" text,
  "email" text,
  "latitude" double precision,
  "longitude" double precision,
  "manager_user_id" uuid,
  "timezone" text DEFAULT 'Europe/Istanbul',
  "currency" text DEFAULT 'TRY',
  "is_active" boolean DEFAULT true,
  "is_virtual" boolean DEFAULT false,
  "settings" text,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_branches" PRIMARY KEY ("id")
);

-- Table: bundle_branch_overrides
CREATE TABLE IF NOT EXISTS "branch"."bundle_branch_overrides" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "bundle_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "final_price" double precision,
  "previous_final_price" double precision,
  "discount_percent" double precision,
  "total_price" double precision,
  "price_override" boolean DEFAULT false,
  "price_updated_at" timestamptz,
  "previous_price_updated_at" timestamptz,
  "price_valid_from" timestamptz,
  "price_valid_until" timestamptz,
  "is_available" boolean DEFAULT true,
  "availability_reason" text,
  "source" text DEFAULT 'manual',
  "source_reference" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "deleted_at" timestamptz,
  "deleted_by" uuid,
  CONSTRAINT "pk_bundle_branch_overrides" PRIMARY KEY ("id")
);

-- Table: bundle_branch_price_history
CREATE TABLE IF NOT EXISTS "branch"."bundle_branch_price_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "bundle_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "old_price" double precision,
  "new_price" double precision,
  "old_total_price" double precision,
  "new_total_price" double precision,
  "old_discount_percent" double precision,
  "new_discount_percent" double precision,
  "change_reason" text,
  "change_percent" double precision,
  "changed_at" timestamptz DEFAULT now(),
  "changed_by" uuid,
  CONSTRAINT "pk_bundle_branch_price_history" PRIMARY KEY ("id")
);

-- Table: product_branch_overrides
CREATE TABLE IF NOT EXISTS "branch"."product_branch_overrides" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "override_scope" text DEFAULT 'price',
  "current_price" double precision,
  "previous_price" double precision,
  "price_updated_at" timestamptz,
  "price_valid_until" timestamptz,
  "discount_percent" double precision,
  "discount_amount" double precision,
  "campaign_text" text,
  "campaign_start" timestamptz,
  "campaign_end" timestamptz,
  "kunye_no" text,
  "kunye_data" text,
  "stock_quantity" integer,
  "min_stock_level" integer,
  "max_stock_level" integer,
  "reorder_point" integer,
  "shelf_location" text,
  "aisle" text,
  "shelf_number" text,
  "is_available" boolean DEFAULT true,
  "availability_reason" text,
  "source" text DEFAULT 'manual',
  "source_reference" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  "updated_by" uuid,
  "deleted_at" timestamptz,
  "deleted_by" uuid,
  CONSTRAINT "pk_product_branch_overrides" PRIMARY KEY ("id")
);

-- Table: user_branch_access
CREATE TABLE IF NOT EXISTS "branch"."user_branch_access" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  "access_level" text DEFAULT 'full',
  "is_default" boolean DEFAULT false,
  "permissions" text,
  "granted_at" timestamptz DEFAULT now(),
  "granted_by" uuid,
  "expires_at" timestamptz,
  CONSTRAINT "pk_user_branch_access" PRIMARY KEY ("id")
);

