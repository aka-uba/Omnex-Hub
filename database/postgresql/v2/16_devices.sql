-- Auto-generated from database/omnex.db on 2026-02-26 12:38:47
-- Module: devices

-- Table: device_alerts
CREATE TABLE IF NOT EXISTS "devices"."device_alerts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "device_id" uuid NOT NULL,
  "alert_type" text NOT NULL,
  "severity" text DEFAULT 'medium',
  "title" text NOT NULL,
  "message" text,
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_device_alerts" PRIMARY KEY ("id")
);

-- Table: device_commands
CREATE TABLE IF NOT EXISTS "devices"."device_commands" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "device_id" uuid NOT NULL,
  "command" text NOT NULL,
  "parameters" text,
  "status" text DEFAULT 'pending',
  "priority" integer DEFAULT 0,
  "created_by" text,
  "executed_at" timestamptz,
  "result" text,
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_device_commands" PRIMARY KEY ("id")
);

-- Table: device_content_assignments
CREATE TABLE IF NOT EXISTS "devices"."device_content_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "device_id" uuid NOT NULL,
  "content_type" text NOT NULL,
  "content_id" text NOT NULL,
  "status" text DEFAULT 'active',
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_device_content_assignments" PRIMARY KEY ("id")
);

-- Table: device_group_members
CREATE TABLE IF NOT EXISTS "devices"."device_group_members" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "device_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_device_group_members" PRIMARY KEY ("id")
);

-- Table: device_groups
CREATE TABLE IF NOT EXISTS "devices"."device_groups" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "parent_id" uuid,
  "name" text NOT NULL,
  "description" text,
  "store_name" text,
  "store_code" text,
  "device_count" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_device_groups" PRIMARY KEY ("id")
);

-- Table: device_heartbeats
CREATE TABLE IF NOT EXISTS "devices"."device_heartbeats" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "device_id" uuid NOT NULL,
  "status" text,
  "current_item" text,
  "battery_level" integer,
  "signal_strength" integer,
  "ip_address" text,
  "created_at" timestamptz DEFAULT now(),
  "memory_usage" integer,
  "cpu_usage" integer,
  "storage_free" integer,
  "temperature" double precision,
  "uptime" integer,
  "errors" text,
  "metadata" text,
  CONSTRAINT "pk_device_heartbeats" PRIMARY KEY ("id")
);

-- Table: device_logs
CREATE TABLE IF NOT EXISTS "devices"."device_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "device_id" uuid NOT NULL,
  "action" text NOT NULL,
  "content_type" text,
  "content_id" text,
  "status" text NOT NULL,
  "request_data" text,
  "response_data" text,
  "error_message" text,
  "duration_ms" integer,
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_device_logs" PRIMARY KEY ("id")
);

-- Table: device_sync_requests
CREATE TABLE IF NOT EXISTS "devices"."device_sync_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "sync_code" text,
  "serial_number" text,
  "firmware" text,
  "screen_type" text,
  "resolution" text,
  "manufacturer" text,
  "store_code" text,
  "mac_address" text,
  "fingerprint" text,
  "os" text,
  "browser" text,
  "timezone" text,
  "language" text,
  "screen_resolution" text,
  "ip_address" text,
  "user_agent" text,
  "status" text DEFAULT 'pending',
  "request_count" integer DEFAULT 1,
  "last_request_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "expires_at" timestamptz,
  "approved_by" text,
  "approved_at" timestamptz,
  "rejection_reason" text,
  "device_id" text,
  "device_type" text,
  "brand" text,
  "model" text,
  "os_version" text,
  "browser_version" text,
  "screen_diagonal" double precision,
  "screen_width" integer,
  "screen_height" integer,
  "pixel_ratio" double precision,
  "color_depth" integer,
  "cpu_cores" integer,
  "device_memory" double precision,
  "touch_support" boolean DEFAULT false,
  "connection_type" text,
  CONSTRAINT "pk_device_sync_requests" PRIMARY KEY ("id")
);

-- Table: device_tokens
CREATE TABLE IF NOT EXISTS "devices"."device_tokens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "device_id" uuid NOT NULL,
  "token" text NOT NULL,
  "token_type" text DEFAULT 'device',
  "created_at" timestamptz DEFAULT now(),
  "expires_at" timestamptz,
  "last_used_at" timestamptz,
  "is_revoked" boolean DEFAULT false,
  "revoked_at" timestamptz,
  "revoked_reason" text,
  "ip_address" text,
  "user_agent" text,
  "token_hash" text,
  CONSTRAINT "pk_device_tokens" PRIMARY KEY ("id")
);

-- Table: devices
CREATE TABLE IF NOT EXISTS "devices"."devices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "group_id" uuid,
  "store_id" text,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "mac_address" text,
  "ip_address" text,
  "device_id" text,
  "model" text,
  "manufacturer" text,
  "firmware_version" text,
  "screen_width" integer,
  "screen_height" integer,
  "orientation" text DEFAULT 'landscape',
  "current_template_id" uuid,
  "current_content" text,
  "last_sync" timestamptz,
  "last_online" timestamptz,
  "last_seen" timestamptz,
  "status" text DEFAULT 'offline',
  "battery_level" integer,
  "signal_strength" integer,
  "error_message" text,
  "metadata" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "device_token" text,
  "token_expires_at" timestamptz,
  "sync_code" text,
  "sync_code_expires_at" timestamptz,
  "fingerprint" text,
  "os_info" text,
  "browser_info" text,
  "screen_resolution" text,
  "timezone" text,
  "language" text,
  "last_heartbeat" timestamptz,
  "approval_status" text DEFAULT 'approved',
  "approved_by" text,
  "approved_at" timestamptz,
  "location" text,
  "device_type_detail" text,
  "brand" text,
  "model_name" text,
  "os_version" text,
  "screen_diagonal" double precision,
  "cpu_cores" integer,
  "device_memory" double precision,
  "branch_id" uuid,
  "playlist_cache" text,
  "current_playlist_id" text,
  "current_playlist_index" integer,
  "playlist_total_items" integer,
  "communication_mode" text DEFAULT 'http-server',
  "mqtt_client_id" text,
  "mqtt_topic" text,
  "stream_mode" boolean DEFAULT false,
  "stream_token" text,
  "device_profile" text,
  "last_stream_request_at" timestamptz,
  "stream_started_at" timestamptz,
  "adapter_id" text,
  "capabilities" text,
  "device_brand" text,
  CONSTRAINT "pk_devices" PRIMARY KEY ("id")
);

-- Table: firmware_updates
CREATE TABLE IF NOT EXISTS "devices"."firmware_updates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "device_type" text DEFAULT 'esl' NOT NULL,
  "version" text NOT NULL,
  "url" text NOT NULL,
  "notes" text,
  "min_version" text,
  "max_version" text,
  "file_size" integer,
  "checksum" text,
  "is_mandatory" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "released_at" timestamptz,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_firmware_updates" PRIMARY KEY ("id")
);

-- Table: gateway_commands
CREATE TABLE IF NOT EXISTS "devices"."gateway_commands" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "gateway_id" uuid NOT NULL,
  "device_id" uuid,
  "command" text NOT NULL,
  "parameters" text,
  "priority" integer DEFAULT 0,
  "status" text DEFAULT 'pending',
  "result" text,
  "error_message" text,
  "created_at" timestamptz DEFAULT now(),
  "sent_at" timestamptz,
  "completed_at" timestamptz,
  "expires_at" timestamptz,
  CONSTRAINT "pk_gateway_commands" PRIMARY KEY ("id")
);

-- Table: gateway_devices
CREATE TABLE IF NOT EXISTS "devices"."gateway_devices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "gateway_id" uuid NOT NULL,
  "device_id" uuid NOT NULL,
  "local_ip" text NOT NULL,
  "status" text DEFAULT 'active',
  "last_seen" timestamptz,
  "last_error" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_gateway_devices" PRIMARY KEY ("id")
);

-- Table: gateways
CREATE TABLE IF NOT EXISTS "devices"."gateways" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "api_key" text NOT NULL,
  "api_secret" text NOT NULL,
  "local_ip" text,
  "public_ip" text,
  "hostname" text,
  "status" text DEFAULT 'offline',
  "last_heartbeat" timestamptz,
  "last_error" text,
  "config" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_gateways" PRIMARY KEY ("id")
);

-- Table: hanshow_aps
CREATE TABLE IF NOT EXISTS "devices"."hanshow_aps" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "ap_id" integer NOT NULL,
  "mac_address" text NOT NULL,
  "sequence" integer,
  "name" text,
  "location" text,
  "allow_bind_v1esl" boolean DEFAULT false,
  "status" text DEFAULT 'unknown',
  "last_seen_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz,
  CONSTRAINT "pk_hanshow_aps" PRIMARY KEY ("id")
);

-- Table: hanshow_esls
CREATE TABLE IF NOT EXISTS "devices"."hanshow_esls" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "esl_id" text NOT NULL,
  "firmware_id" integer,
  "model_name" text,
  "screen_width" integer,
  "screen_height" integer,
  "screen_color" text,
  "screen_type" text,
  "max_pages" integer DEFAULT 1,
  "has_led" boolean DEFAULT false,
  "has_magnet" boolean DEFAULT false,
  "current_template_id" uuid,
  "current_product_id" uuid,
  "last_sync_at" timestamptz,
  "last_heartbeat_at" timestamptz,
  "status" text DEFAULT 'unknown',
  "battery_level" integer,
  "ap_mac" text,
  "sales_no" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz,
  CONSTRAINT "pk_hanshow_esls" PRIMARY KEY ("id")
);

-- Table: hanshow_firmwares
CREATE TABLE IF NOT EXISTS "devices"."hanshow_firmwares" (
  "id" integer NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "magnet" boolean DEFAULT false,
  "led" boolean DEFAULT false,
  "mpd" boolean DEFAULT false,
  "generation" integer,
  "heartbeat" boolean DEFAULT true,
  "direction" integer DEFAULT 0,
  "battery" text,
  "freezer" boolean DEFAULT false,
  "dpi" integer,
  "ic" text,
  "display_mode" text,
  "screen_type" text,
  "resolution_x" integer,
  "resolution_y" integer,
  "screen_color" text,
  "screen_size" text,
  "refresh_time" integer,
  "flash_size" integer,
  "max_package" integer,
  "osd_version" integer,
  "max_page_num" integer,
  "esl_model" text,
  "mix_mode" boolean DEFAULT false,
  "screen_model" text,
  "cached_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_hanshow_firmwares" PRIMARY KEY ("id")
);

-- Table: hanshow_queue
CREATE TABLE IF NOT EXISTS "devices"."hanshow_queue" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "esl_id" text NOT NULL,
  "session_id" text NOT NULL,
  "product_id" uuid,
  "template_id" uuid,
  "content_type" text,
  "content_data" text,
  "priority" integer DEFAULT 10,
  "status" text DEFAULT 'pending',
  "attempts" integer DEFAULT 0,
  "max_attempts" integer DEFAULT 3,
  "error_message" text,
  "callback_data" text,
  "rf_power" integer,
  "retry_count" integer,
  "ap_id" integer,
  "created_at" timestamptz DEFAULT now(),
  "processed_at" timestamptz,
  "completed_at" timestamptz,
  CONSTRAINT "pk_hanshow_queue" PRIMARY KEY ("id")
);

-- Table: hanshow_settings
CREATE TABLE IF NOT EXISTS "devices"."hanshow_settings" (
  "id" text NOT NULL,
  "company_id" uuid NOT NULL,
  "eslworking_url" text DEFAULT 'http://127.0.0.1:9000',
  "user_id" text DEFAULT 'default',
  "callback_url" text,
  "default_priority" integer DEFAULT 10,
  "sync_interval" integer DEFAULT 60,
  "auto_retry" boolean DEFAULT true,
  "max_retry_attempts" integer DEFAULT 3,
  "led_flash_on_update" boolean DEFAULT true,
  "led_color" text DEFAULT 'green',
  "enabled" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz,
  "scope" text DEFAULT 'company',
  CONSTRAINT "pk_hanshow_settings" PRIMARY KEY ("id")
);

-- Table: mqtt_settings
CREATE TABLE IF NOT EXISTS "devices"."mqtt_settings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "broker_url" text DEFAULT '' NOT NULL,
  "broker_port" integer DEFAULT 1883,
  "use_tls" boolean DEFAULT false,
  "username" text DEFAULT '',
  "password" text DEFAULT '',
  "topic_prefix" text DEFAULT 'omnex/esl',
  "provider" text DEFAULT 'mosquitto',
  "app_id" text DEFAULT '',
  "app_secret" text DEFAULT '',
  "content_server_url" text DEFAULT '',
  "report_server_url" text DEFAULT '',
  "status" text DEFAULT 'active',
  "last_connected" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_mqtt_settings" PRIMARY KEY ("id")
);

