-- Auto-generated from database/omnex.db on 2026-02-26 12:38:47
-- Module: media

-- Table: company_storage_usage
CREATE TABLE IF NOT EXISTS "media"."company_storage_usage" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "media_bytes" integer DEFAULT 0,
  "templates_bytes" integer DEFAULT 0,
  "renders_bytes" integer DEFAULT 0,
  "total_bytes" integer DEFAULT 0,
  "last_calculated_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_company_storage_usage" PRIMARY KEY ("id")
);

-- Table: media
CREATE TABLE IF NOT EXISTS "media"."media" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "folder_id" uuid,
  "name" text NOT NULL,
  "original_name" text NOT NULL,
  "file_path" text NOT NULL,
  "file_type" text NOT NULL,
  "mime_type" text NOT NULL,
  "file_size" integer NOT NULL,
  "width" integer,
  "height" integer,
  "duration" integer,
  "thumbnail" text,
  "alt_text" text,
  "description" text,
  "tags" text,
  "metadata" text,
  "source" text DEFAULT 'upload',
  "source_url" text,
  "status" text DEFAULT 'active',
  "uploaded_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "is_public" boolean DEFAULT false,
  "scope" text DEFAULT 'company',
  "media_type" text DEFAULT 'image',
  CONSTRAINT "pk_media" PRIMARY KEY ("id")
);

-- Table: media_folders
CREATE TABLE IF NOT EXISTS "media"."media_folders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "parent_id" uuid,
  "name" text NOT NULL,
  "path" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_media_folders" PRIMARY KEY ("id")
);

