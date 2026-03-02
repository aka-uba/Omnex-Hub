-- Auto-generated from database/omnex.db on 2026-02-26 12:38:47
-- Module: core

-- Table: companies
CREATE TABLE IF NOT EXISTS "core"."companies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "domain" text,
  "subdomain" text,
  "logo" text,
  "pwa_icon" text,
  "favicon" text,
  "primary_color" text DEFAULT '#228be6',
  "secondary_color" text DEFAULT '#495057',
  "status" text DEFAULT 'active',
  "settings" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "code" text,
  "email" text,
  "phone" text,
  "address" text,
  "storage_limit" integer DEFAULT 1073741824,
  CONSTRAINT "pk_companies" PRIMARY KEY ("id")
);

-- Table: layout_configs
CREATE TABLE IF NOT EXISTS "core"."layout_configs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "scope" text DEFAULT 'default' NOT NULL,
  "scope_id" text,
  "config" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_layout_configs" PRIMARY KEY ("id")
);

-- Table: menu_items
CREATE TABLE IF NOT EXISTS "core"."menu_items" (
  "id" text NOT NULL,
  "company_id" text,
  "location" text DEFAULT 'sidebar',
  "parent_id" text,
  "label" text,
  "href" text,
  "icon" text,
  "order_index" integer DEFAULT 0,
  "roles" text DEFAULT '["SuperAdmin","Admin","Editor","Viewer"]',
  "visible" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz,
  CONSTRAINT "pk_menu_items" PRIMARY KEY ("id")
);

-- Table: migrations
CREATE TABLE IF NOT EXISTS "core"."migrations" (
  "id" bigint generated always as identity NOT NULL,
  "name" text NOT NULL,
  "executed_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_migrations" PRIMARY KEY ("id")
);

-- Table: permissions
CREATE TABLE IF NOT EXISTS "core"."permissions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "role" text NOT NULL,
  "resource" text NOT NULL,
  "actions" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_permissions" PRIMARY KEY ("id")
);

-- Table: rate_limits
CREATE TABLE IF NOT EXISTS "core"."rate_limits" (
  "key_name" text NOT NULL,
  "count" integer DEFAULT 1,
  "window_start" timestamptz NOT NULL,
  CONSTRAINT "pk_rate_limits" PRIMARY KEY ("key_name", "window_start")
);

-- Table: sessions
CREATE TABLE IF NOT EXISTS "core"."sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "refresh_token_hash" text,
  "ip_address" text,
  "user_agent" text,
  "last_activity" text,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_sessions" PRIMARY KEY ("id")
);

-- Table: settings
CREATE TABLE IF NOT EXISTS "core"."settings" (
  "id" text NOT NULL,
  "company_id" text,
  "user_id" text,
  "data" text DEFAULT '{}' NOT NULL,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  CONSTRAINT "pk_settings" PRIMARY KEY ("id")
);

-- Table: users
CREATE TABLE IF NOT EXISTS "core"."users" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "phone" text,
  "avatar" text,
  "role" text NOT NULL,
  "status" text DEFAULT 'pending',
  "activation_token" text,
  "activation_expires" text,
  "password_reset_token" text,
  "password_reset_expires" timestamptz,
  "last_login" timestamptz,
  "last_ip" text,
  "last_user_agent" text,
  "preferences" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "reset_token" text,
  "reset_token_expires" text,
  CONSTRAINT "pk_users" PRIMARY KEY ("id")
);

