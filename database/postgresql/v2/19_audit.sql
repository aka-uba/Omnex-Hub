-- Auto-generated from database/omnex.db on 2026-02-26 12:38:47
-- Module: audit

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS "audit"."audit_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" text,
  "user_id" text,
  "action" text NOT NULL,
  "entity_type" text,
  "entity_id" text,
  "old_values" text,
  "new_values" text,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamptz DEFAULT now(),
  "archived_at" timestamptz,
  "archived_by" text,
  CONSTRAINT "pk_audit_logs" PRIMARY KEY ("id")
);

-- Table: notification_recipients
CREATE TABLE IF NOT EXISTS "audit"."notification_recipients" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "notification_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "status" text DEFAULT 'sent',
  "read_at" timestamptz,
  "archived_at" timestamptz,
  "deleted_at" timestamptz,
  CONSTRAINT "pk_notification_recipients" PRIMARY KEY ("id")
);

-- Table: notification_settings
CREATE TABLE IF NOT EXISTS "audit"."notification_settings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text,
  "enabled" boolean DEFAULT true,
  "sound" integer DEFAULT 1,
  "desktop" integer DEFAULT 0,
  "types" text,
  "email_digest" text DEFAULT 'none',
  "dnd_enabled" integer DEFAULT 0,
  "dnd_start" text,
  "dnd_end" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_notification_settings" PRIMARY KEY ("id")
);

-- Table: notifications
CREATE TABLE IF NOT EXISTS "audit"."notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" text,
  "title" text NOT NULL,
  "message" text,
  "type" text DEFAULT 'info',
  "target_type" text DEFAULT 'all',
  "target_id" text,
  "action_url" text,
  "priority" text DEFAULT 'normal',
  "created_by" text,
  "created_at" timestamptz DEFAULT now(),
  "icon" text,
  "link" text,
  "channels" text DEFAULT '["web"]',
  "expires_at" timestamptz,
  CONSTRAINT "pk_notifications" PRIMARY KEY ("id")
);

-- Table: user_notification_preferences
CREATE TABLE IF NOT EXISTS "audit"."user_notification_preferences" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "email_enabled" integer DEFAULT 1,
  "push_enabled" integer DEFAULT 1,
  "toast_enabled" integer DEFAULT 1,
  "web_enabled" integer DEFAULT 1,
  "sound_enabled" integer DEFAULT 1,
  "type_preferences" text DEFAULT '{}',
  "quiet_start" text,
  "quiet_end" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_user_notification_preferences" PRIMARY KEY ("id")
);

