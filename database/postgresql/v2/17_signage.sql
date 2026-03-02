-- Auto-generated from database/omnex.db on 2026-02-26 12:38:47
-- Module: signage

-- Table: playlist_items
CREATE TABLE IF NOT EXISTS "signage"."playlist_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "playlist_id" uuid NOT NULL,
  "media_id" text,
  "template_id" text,
  "sort_order" integer DEFAULT 0,
  "duration" integer DEFAULT 10,
  "transition" text DEFAULT 'fade',
  "created_at" timestamptz DEFAULT now(),
  "muted" boolean DEFAULT true,
  CONSTRAINT "pk_playlist_items" PRIMARY KEY ("id")
);

-- Table: playlists
CREATE TABLE IF NOT EXISTS "signage"."playlists" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'active',
  "duration" integer DEFAULT 0,
  "item_count" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "orientation" text DEFAULT 'landscape',
  "template_id" text,
  "layout_type" text,
  "items" text DEFAULT '[]',
  "default_duration" integer DEFAULT 10,
  "created_by" text,
  "transition" text DEFAULT 'none',
  "transition_duration" integer DEFAULT 500,
  CONSTRAINT "pk_playlists" PRIMARY KEY ("id")
);

-- Table: schedule_devices
CREATE TABLE IF NOT EXISTS "signage"."schedule_devices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "schedule_id" uuid NOT NULL,
  "device_id" text NOT NULL,
  CONSTRAINT "pk_schedule_devices" PRIMARY KEY ("id")
);

-- Table: schedules
CREATE TABLE IF NOT EXISTS "signage"."schedules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "playlist_id" text,
  "start_date" timestamptz,
  "end_date" timestamptz,
  "start_time" text,
  "end_time" text,
  "days_of_week" text,
  "status" text DEFAULT 'active',
  "priority" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_schedules" PRIMARY KEY ("id")
);

-- Table: stream_access_logs
CREATE TABLE IF NOT EXISTS "signage"."stream_access_logs" (
  "id" bigint generated always as identity NOT NULL,
  "device_id" text,
  "stream_token" text,
  "request_type" text,
  "request_path" text,
  "media_id" text,
  "profile" text,
  "ip_address" text,
  "user_agent" text,
  "response_status" integer,
  "response_bytes" integer,
  "latency_ms" integer,
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_stream_access_logs" PRIMARY KEY ("id")
);

-- Table: transcode_queue
CREATE TABLE IF NOT EXISTS "signage"."transcode_queue" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" text NOT NULL,
  "media_id" text NOT NULL,
  "status" text DEFAULT 'pending',
  "priority" integer DEFAULT 0,
  "input_path" text NOT NULL,
  "output_dir" text,
  "profiles" text DEFAULT '["720p"]',
  "progress" integer DEFAULT 0,
  "duration_seconds" double precision,
  "file_size_bytes" integer,
  "error_message" text,
  "retry_count" integer DEFAULT 0,
  "max_retries" integer DEFAULT 3,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_transcode_queue" PRIMARY KEY ("id")
);

-- Table: transcode_variants
CREATE TABLE IF NOT EXISTS "signage"."transcode_variants" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "media_id" text NOT NULL,
  "company_id" text NOT NULL,
  "profile" text NOT NULL,
  "resolution" text,
  "bitrate" integer,
  "codec" text DEFAULT 'h264',
  "segment_duration" integer DEFAULT 6,
  "playlist_path" text,
  "segment_count" integer DEFAULT 0,
  "total_size_bytes" integer DEFAULT 0,
  "status" text DEFAULT 'pending',
  "error_message" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_transcode_variants" PRIMARY KEY ("id")
);

-- Table: web_template_assignments
CREATE TABLE IF NOT EXISTS "signage"."web_template_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "device_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "priority" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "start_date" timestamptz,
  "end_date" timestamptz,
  "schedule_config" text,
  "data_overrides" text,
  "last_synced_at" timestamptz,
  "sync_status" text DEFAULT 'pending',
  "assigned_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_web_template_assignments" PRIMARY KEY ("id")
);

-- Table: web_template_versions
CREATE TABLE IF NOT EXISTS "signage"."web_template_versions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "template_id" uuid NOT NULL,
  "version_number" integer NOT NULL,
  "version_name" text,
  "change_notes" text,
  "html_content" text,
  "css_content" text,
  "js_content" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_web_template_versions" PRIMARY KEY ("id")
);

-- Table: web_template_widgets
CREATE TABLE IF NOT EXISTS "signage"."web_template_widgets" (
  "id" text NOT NULL,
  "company_id" uuid,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "category" text DEFAULT 'custom',
  "icon" text,
  "html_template" text NOT NULL,
  "css_styles" text,
  "js_code" text,
  "properties" text,
  "default_values" text,
  "is_system" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "sort_order" integer DEFAULT 0,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_web_template_widgets" PRIMARY KEY ("id")
);

-- Table: web_templates
CREATE TABLE IF NOT EXISTS "signage"."web_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text,
  "description" text,
  "html_content" text,
  "css_content" text,
  "js_content" text,
  "template_type" text DEFAULT 'signage',
  "category" text,
  "tags" text,
  "thumbnail" text,
  "width" integer,
  "height" integer,
  "orientation" text DEFAULT 'landscape',
  "responsive_breakpoints" text,
  "data_sources" text,
  "dynamic_fields" text,
  "status" text DEFAULT 'draft',
  "version" integer DEFAULT 1,
  "published_at" timestamptz,
  "scope" text DEFAULT 'company',
  "is_forked" boolean DEFAULT false,
  "parent_template_id" uuid,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "deleted_at" timestamptz,
  CONSTRAINT "pk_web_templates" PRIMARY KEY ("id")
);

