-- Auto-generated from database/omnex.db on 2026-02-26 12:38:47
-- Module: labels

-- Table: label_sizes
CREATE TABLE IF NOT EXISTS "labels"."label_sizes" (
  "id" text NOT NULL,
  "company_id" uuid,
  "name" text NOT NULL,
  "width" double precision NOT NULL,
  "height" double precision NOT NULL,
  "unit" text DEFAULT 'mm',
  "is_default" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_label_sizes" PRIMARY KEY ("id")
);

-- Table: product_renders
CREATE TABLE IF NOT EXISTS "labels"."product_renders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "template_id" uuid NOT NULL,
  "device_type" text DEFAULT 'default',
  "locale" text DEFAULT 'tr',
  "file_path" text NOT NULL,
  "file_size" integer DEFAULT 0,
  "product_version" integer DEFAULT 1,
  "template_version" integer DEFAULT 1,
  "render_hash" text,
  "created_at" timestamptz DEFAULT now(),
  "status" text DEFAULT 'pending',
  "error_message" text,
  "completed_at" timestamptz,
  CONSTRAINT "pk_product_renders" PRIMARY KEY ("id")
);

-- Table: render_cache
CREATE TABLE IF NOT EXISTS "labels"."render_cache" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" text NOT NULL,
  "product_id" text NOT NULL,
  "template_id" text NOT NULL,
  "cache_key" text NOT NULL,
  "product_version" integer DEFAULT 1,
  "template_version" integer DEFAULT 1,
  "image_path" text,
  "image_md5" text,
  "image_size" integer,
  "status" text DEFAULT 'pending',
  "error_message" text,
  "rendered_at" timestamptz,
  "expires_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_render_cache" PRIMARY KEY ("id")
);

-- Table: render_jobs
CREATE TABLE IF NOT EXISTS "labels"."render_jobs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" text NOT NULL,
  "product_id" text NOT NULL,
  "template_id" text,
  "job_type" text DEFAULT 'product_update',
  "priority" text DEFAULT 'normal',
  "source" text,
  "status" text DEFAULT 'pending',
  "retry_count" integer DEFAULT 0,
  "max_retries" integer DEFAULT 3,
  "error_message" text,
  "batch_id" text,
  "batch_total" integer,
  "batch_index" integer,
  "scheduled_at" timestamptz,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "created_by" text,
  CONSTRAINT "pk_render_jobs" PRIMARY KEY ("id")
);

-- Table: render_priority_weights
CREATE TABLE IF NOT EXISTS "labels"."render_priority_weights" (
  "priority" text NOT NULL,
  "weight" integer NOT NULL,
  "max_concurrent" integer DEFAULT 10,
  "timeout_seconds" integer DEFAULT 300,
  "description" text,
  CONSTRAINT "pk_render_priority_weights" PRIMARY KEY ("priority")
);

-- Table: render_queue
CREATE TABLE IF NOT EXISTS "labels"."render_queue" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "job_type" text DEFAULT 'render_send' NOT NULL,
  "priority" text DEFAULT 'normal' NOT NULL,
  "template_id" uuid,
  "product_id" uuid,
  "device_ids" text,
  "device_count" integer DEFAULT 0,
  "render_params" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "progress" integer DEFAULT 0,
  "devices_total" integer DEFAULT 0,
  "devices_completed" integer DEFAULT 0,
  "devices_failed" integer DEFAULT 0,
  "devices_skipped" integer DEFAULT 0,
  "retry_count" integer DEFAULT 0,
  "max_retries" integer DEFAULT 3,
  "last_retry_at" timestamptz,
  "next_retry_at" timestamptz,
  "result" text,
  "error_message" text,
  "failed_devices" text,
  "scheduled_at" timestamptz,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "rendered_image_path" text,
  "batch_id" text,
  "product_name" text,
  CONSTRAINT "pk_render_queue" PRIMARY KEY ("id")
);

-- Table: render_queue_items
CREATE TABLE IF NOT EXISTS "labels"."render_queue_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "queue_id" uuid NOT NULL,
  "device_id" uuid NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "retry_count" integer DEFAULT 0,
  "last_error" text,
  "skipped_reason" text,
  "file_md5" text,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "duration_ms" integer,
  "created_at" timestamptz DEFAULT now(),
  "error_type" text,
  "next_retry_at" timestamptz,
  "rendered_image_path" text,
  CONSTRAINT "pk_render_queue_items" PRIMARY KEY ("id")
);

-- Table: render_retry_policies
CREATE TABLE IF NOT EXISTS "labels"."render_retry_policies" (
  "id" text NOT NULL,
  "error_type" text NOT NULL,
  "max_retries" integer DEFAULT 3,
  "base_delay_seconds" integer DEFAULT 5,
  "max_delay_seconds" integer DEFAULT 300,
  "backoff_multiplier" double precision DEFAULT 2.0,
  "description" text,
  CONSTRAINT "pk_render_retry_policies" PRIMARY KEY ("id")
);

-- Table: templates
CREATE TABLE IF NOT EXISTS "labels"."templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "name" text NOT NULL,
  "description" text,
  "type" text NOT NULL,
  "category" text,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "orientation" text DEFAULT 'landscape',
  "design_data" text NOT NULL,
  "preview_image" text,
  "version" integer DEFAULT 1,
  "parent_id" uuid,
  "is_default" boolean DEFAULT false,
  "is_public" boolean DEFAULT false,
  "status" text DEFAULT 'active',
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "layout_type" text DEFAULT 'full',
  "template_file" text,
  "slots" text,
  "device_types" text,
  "target_device_type" text,
  "grid_layout" text DEFAULT 'single',
  "regions_config" text,
  "background_type" text DEFAULT 'color',
  "background_value" text DEFAULT '#FFFFFF',
  "render_image" text,
  "scope" text DEFAULT 'company',
  "is_forked" boolean DEFAULT false,
  "is_demo" boolean DEFAULT false,
  "key" text,
  "grid_visible" integer DEFAULT 1,
  "responsive_mode" text DEFAULT 'off',
  "scale_policy" text DEFAULT 'contain',
  "design_width" integer,
  "design_height" integer,
  CONSTRAINT "pk_templates" PRIMARY KEY ("id")
);

-- Table: templates_backup
CREATE TABLE IF NOT EXISTS "labels"."templates_backup" (
  "id" text,
  "company_id" text,
  "name" text,
  "description" text,
  "type" text,
  "category" text,
  "width" integer,
  "height" integer,
  "orientation" text,
  "design_data" text,
  "preview_image" text,
  "version" integer,
  "parent_id" text,
  "is_default" boolean,
  "is_public" boolean,
  "status" text,
  "created_by" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "layout_type" text,
  "template_file" text,
  "slots" text,
  "device_types" text,
  "target_device_type" text,
  "grid_layout" text,
  "regions_config" text,
  "background_type" text,
  "background_value" text,
  "render_image" text,
  "scope" text,
  "is_forked" boolean,
  "is_demo" boolean,
  "key" text
);

