-- Auto-generated from database/omnex.db on 2026-02-26 12:38:47
-- Module: integration

-- Table: hal_distribution_logs
CREATE TABLE IF NOT EXISTS "integration"."hal_distribution_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "kunye_no" text NOT NULL,
  "product_id" uuid NOT NULL,
  "belge_no" text,
  "distribution_type" text DEFAULT 'full',
  "assigned_miktar" double precision,
  "kalan_miktar" double precision,
  "sifat_id" integer,
  "bildirim_tarihi" text,
  "malin_adi" text,
  "malin_cinsi" text,
  "distributed_by" text,
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_hal_distribution_logs" PRIMARY KEY ("id")
);

-- Table: import_mappings
CREATE TABLE IF NOT EXISTS "integration"."import_mappings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" text,
  "name" text,
  "description" text,
  "format" text DEFAULT 'auto',
  "is_default" boolean DEFAULT false,
  "config" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_import_mappings" PRIMARY KEY ("id")
);

-- Table: integration_settings
CREATE TABLE IF NOT EXISTS "integration"."integration_settings" (
  "id" text NOT NULL,
  "company_id" text,
  "integration_type" text NOT NULL,
  "scope" text DEFAULT 'company' NOT NULL,
  "config_json" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" text,
  "updated_by" text,
  CONSTRAINT "pk_integration_settings" PRIMARY KEY ("id")
);

-- Table: integration_settings_audit
CREATE TABLE IF NOT EXISTS "integration"."integration_settings_audit" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "integration_settings_id" text NOT NULL,
  "integration_type" text NOT NULL,
  "scope" text NOT NULL,
  "company_id" text,
  "action" text NOT NULL,
  "old_config" text,
  "new_config" text,
  "old_is_active" integer,
  "new_is_active" integer,
  "changed_fields" text,
  "change_reason" text,
  "changed_by" text NOT NULL,
  "changed_by_name" text,
  "changed_by_role" text,
  "changed_at" timestamptz DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  CONSTRAINT "pk_integration_settings_audit" PRIMARY KEY ("id")
);

-- Table: integrations
CREATE TABLE IF NOT EXISTS "integration"."integrations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "config" text,
  "status" text DEFAULT 'inactive',
  "last_sync" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_integrations" PRIMARY KEY ("id")
);

-- Table: product_branch_hal_overrides
CREATE TABLE IF NOT EXISTS "integration"."product_branch_hal_overrides" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "hal_data_id" uuid NOT NULL,
  "branch_id" text NOT NULL,
  "kunye_no" text,
  "malin_sahibi" text,
  "tuketim_yeri" text,
  "tuketim_bildirim_tarihi" text,
  "alis_fiyati" double precision,
  "miktar" text,
  "source" text DEFAULT 'manual',
  "source_reference" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "created_by" text,
  "updated_by" text,
  "deleted_at" timestamptz,
  "deleted_by" text,
  "uretim_sekli" text,
  "uretim_sekli_source" text,
  "kalan_miktar" text,
  "birim" text,
  "bildirim_turu" text,
  "uretici_tc_vergi_no" text,
  "belge_no" text,
  "analiz_status" text,
  CONSTRAINT "pk_product_branch_hal_overrides" PRIMARY KEY ("id")
);

-- Table: product_hal_data
CREATE TABLE IF NOT EXISTS "integration"."product_hal_data" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "company_id" uuid NOT NULL,
  "kunye_no" text NOT NULL,
  "uretici_adi" text,
  "malin_adi" text,
  "malin_cinsi" text,
  "malin_turu" text,
  "ilk_bildirim_tarihi" text,
  "uretim_yeri" text,
  "malin_sahibi" text,
  "tuketim_bildirim_tarihi" text,
  "tuketim_yeri" text,
  "gumruk_kapisi" text,
  "uretim_ithal_tarihi" text,
  "miktar" text,
  "alis_fiyati" double precision,
  "isletme_adi" text,
  "diger_bilgiler" text,
  "sertifikasyon_kurulusu" text,
  "sertifika_no" text,
  "gecmis_bildirimler" text,
  "hal_sorgu_tarihi" text,
  "hal_raw_data" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "uretim_sekli" text,
  "uretim_sekli_source" text DEFAULT 'user_selected',
  "kalan_miktar" text,
  "birim" text,
  "birim_id" text,
  "bildirim_turu" text,
  "uretici_tc_vergi_no" text,
  "malin_sahibi_tc_vergi_no" text,
  "bildirimci_tc_vergi_no" text,
  "arac_plaka_no" text,
  "belge_no" text,
  "belge_tipi" text,
  "malin_cins_kod_no" text,
  "malin_kod_no" text,
  "malin_turu_kod_no" text,
  "gidecek_isyeri_id" text,
  "gidecek_yer_turu_id" text,
  "analiz_status" text,
  CONSTRAINT "pk_product_hal_data" PRIMARY KEY ("id")
);

-- Table: tamsoft_depo_mapping
CREATE TABLE IF NOT EXISTS "integration"."tamsoft_depo_mapping" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "tamsoft_depo_id" integer NOT NULL,
  "tamsoft_depo_kod" text,
  "tamsoft_depo_adi" text,
  "branch_id" uuid NOT NULL,
  "is_default_region" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_tamsoft_depo_mapping" PRIMARY KEY ("id")
);

-- Table: tamsoft_settings
CREATE TABLE IF NOT EXISTS "integration"."tamsoft_settings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "api_url" text DEFAULT 'http://tamsoftintegration.camlica.com.tr',
  "username" text,
  "password" text,
  "default_depo_id" integer DEFAULT 1,
  "sync_interval" integer DEFAULT 30,
  "last_sync_date" timestamptz,
  "auto_sync_enabled" integer DEFAULT 0,
  "only_stock_positive" boolean DEFAULT false,
  "only_ecommerce" boolean DEFAULT false,
  "single_barcode" boolean DEFAULT true,
  "enabled" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_tamsoft_settings" PRIMARY KEY ("id")
);

-- Table: tamsoft_sync_logs
CREATE TABLE IF NOT EXISTS "integration"."tamsoft_sync_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "sync_type" text NOT NULL,
  "status" text NOT NULL,
  "total_items" integer DEFAULT 0,
  "inserted" integer DEFAULT 0,
  "updated" integer DEFAULT 0,
  "failed" integer DEFAULT 0,
  "error_message" text,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_tamsoft_sync_logs" PRIMARY KEY ("id")
);

-- Table: tamsoft_tokens
CREATE TABLE IF NOT EXISTS "integration"."tamsoft_tokens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "access_token" text NOT NULL,
  "token_type" text DEFAULT 'bearer',
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_tamsoft_tokens" PRIMARY KEY ("id")
);

