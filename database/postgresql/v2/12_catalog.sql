-- Auto-generated from database/omnex.db on 2026-02-26 12:38:47
-- Module: catalog

-- Table: bundle_items
CREATE TABLE IF NOT EXISTS "catalog"."bundle_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "bundle_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "quantity" integer DEFAULT 1,
  "unit_price" double precision DEFAULT 0,
  "custom_price" double precision,
  "sort_order" integer DEFAULT 0,
  "notes" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_bundle_items" PRIMARY KEY ("id")
);

-- Table: bundle_price_history
CREATE TABLE IF NOT EXISTS "catalog"."bundle_price_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "bundle_id" uuid NOT NULL,
  "old_price" double precision,
  "new_price" double precision NOT NULL,
  "old_total_price" double precision,
  "new_total_price" double precision,
  "old_discount_percent" double precision,
  "new_discount_percent" double precision,
  "changed_at" timestamptz DEFAULT now(),
  "source" text DEFAULT 'manual',
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_bundle_price_history" PRIMARY KEY ("id")
);

-- Table: bundles
CREATE TABLE IF NOT EXISTS "catalog"."bundles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text,
  "description" text,
  "type" text DEFAULT 'package' NOT NULL,
  "image_url" text,
  "images" text,
  "videos" text,
  "video_url" text,
  "cover_image_index" integer DEFAULT 0,
  "barcode" text,
  "sku" text,
  "total_price" double precision DEFAULT 0,
  "discount_percent" double precision DEFAULT 0,
  "final_price" double precision DEFAULT 0,
  "price_override" boolean DEFAULT false,
  "currency" text DEFAULT 'TRY',
  "price_valid_from" timestamptz,
  "price_valid_until" timestamptz,
  "valid_from" timestamptz,
  "valid_until" timestamptz,
  "item_count" integer DEFAULT 0,
  "category" text,
  "tags" text,
  "extra_data" text,
  "status" text DEFAULT 'active',
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "previous_final_price" double precision,
  "price_updated_at" timestamptz,
  "previous_price_updated_at" timestamptz,
  CONSTRAINT "pk_bundles" PRIMARY KEY ("id")
);

-- Table: categories
CREATE TABLE IF NOT EXISTS "catalog"."categories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "parent_id" text,
  "name" text NOT NULL,
  "slug" text,
  "description" text,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "color" text DEFAULT '#228be6',
  "icon" text,
  "image_url" text,
  "product_count" integer DEFAULT 0,
  "status" text DEFAULT 'active',
  "is_demo" boolean DEFAULT false,
  "is_default" boolean DEFAULT false,
  "key" text,
  CONSTRAINT "pk_categories" PRIMARY KEY ("id")
);

-- Table: price_history
CREATE TABLE IF NOT EXISTS "catalog"."price_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "old_price" double precision,
  "new_price" double precision NOT NULL,
  "changed_at" timestamptz DEFAULT now() NOT NULL,
  "source" text DEFAULT 'manual',
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_price_history" PRIMARY KEY ("id")
);

-- Table: production_types
CREATE TABLE IF NOT EXISTS "catalog"."production_types" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text,
  "description" text,
  "color" text DEFAULT '#228be6',
  "sort_order" integer DEFAULT 0,
  "status" text DEFAULT 'active',
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "is_demo" boolean DEFAULT false,
  "is_default" boolean DEFAULT false,
  "key" text,
  CONSTRAINT "pk_production_types" PRIMARY KEY ("id")
);

-- Table: products
CREATE TABLE IF NOT EXISTS "catalog"."products" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "sku" text NOT NULL,
  "barcode" text,
  "name" text NOT NULL,
  "slug" text,
  "description" text,
  "category" text,
  "subcategory" text,
  "brand" text,
  "origin" text,
  "unit" text DEFAULT 'adet',
  "current_price" double precision DEFAULT 0 NOT NULL,
  "previous_price" double precision,
  "price_valid_until" timestamptz,
  "vat_rate" double precision DEFAULT 20,
  "discount_percent" double precision,
  "campaign_text" text,
  "weight" double precision,
  "stock" integer DEFAULT 0,
  "image_url" text,
  "kunye_no" text,
  "kunye_data" text,
  "shelf_location" text,
  "supplier_code" text,
  "default_image_id" text,
  "default_video_id" text,
  "erp_id" text,
  "erp_data" text,
  "extra_data" text,
  "is_featured" boolean DEFAULT false,
  "valid_from" timestamptz,
  "valid_until" timestamptz,
  "status" text DEFAULT 'active',
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "images" text,
  "videos" text,
  "cover_image_index" integer DEFAULT 0,
  "video_url" text,
  "assigned_device_id" text,
  "assigned_template_id" text,
  "version" integer DEFAULT 1,
  "last_rendered_at" timestamptz,
  "render_status" text DEFAULT 'pending',
  "group" text,
  "production_type" text,
  "is_demo" boolean DEFAULT false,
  "is_default" boolean DEFAULT false,
  "key" text,
  "price_updated_at" timestamptz,
  "previous_price_updated_at" timestamptz,
  "storage_info" text,
  "erp_image_url" text,
  "erp_product_id" text,
  "erp_updated_at" timestamptz,
  "vat_updated_at" timestamptz,
  CONSTRAINT "pk_products" PRIMARY KEY ("id")
);

