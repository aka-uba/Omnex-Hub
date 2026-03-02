-- Auto-generated from database/omnex.db on 2026-02-26 12:38:47
-- Module: license

-- Table: license_device_pricing
CREATE TABLE IF NOT EXISTS "license"."license_device_pricing" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "license_id" uuid NOT NULL,
  "device_category" text NOT NULL,
  "device_count" integer DEFAULT 0,
  "unit_price" double precision DEFAULT 0,
  "currency" text DEFAULT 'USD',
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "pk_license_device_pricing" PRIMARY KEY ("id")
);

-- Table: license_plans
CREATE TABLE IF NOT EXISTS "license"."license_plans" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "slug" text,
  "description" text,
  "plan_type" text DEFAULT 'subscription' NOT NULL,
  "duration_months" integer DEFAULT 12,
  "price" double precision NOT NULL,
  "currency" text DEFAULT 'TRY',
  "max_users" integer DEFAULT 5,
  "max_devices" integer DEFAULT 10,
  "max_products" integer DEFAULT 1000,
  "max_templates" integer DEFAULT 50,
  "features" text,
  "is_popular" boolean DEFAULT false,
  "is_enterprise" boolean DEFAULT false,
  "sort_order" integer DEFAULT 0,
  "status" text DEFAULT 'active',
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "is_active" boolean DEFAULT true,
  "max_branches" integer DEFAULT -1,
  "max_storage" integer DEFAULT -1,
  "is_unlimited" boolean DEFAULT false,
  "device_categories" text,
  "default_device_pricing" text,
  CONSTRAINT "pk_license_plans" PRIMARY KEY ("id")
);

-- Table: licenses
CREATE TABLE IF NOT EXISTS "license"."licenses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "license_key" text NOT NULL,
  "plan_id" text,
  "valid_from" timestamptz NOT NULL,
  "valid_until" timestamptz,
  "auto_renew" integer DEFAULT 0,
  "status" text DEFAULT 'active',
  "features" text,
  "external_id" text,
  "last_validated" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "pricing_mode" text DEFAULT 'flat',
  "exchange_rate" double precision DEFAULT 1.0,
  "base_currency" text DEFAULT 'TRY',
  "total_monthly_price" double precision DEFAULT 0,
  CONSTRAINT "pk_licenses" PRIMARY KEY ("id")
);

-- Table: payment_settings
CREATE TABLE IF NOT EXISTS "license"."payment_settings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid,
  "provider" text DEFAULT 'iyzico' NOT NULL,
  "environment" text DEFAULT 'sandbox' NOT NULL,
  "api_key" text,
  "secret_key" text,
  "merchant_id" text,
  "callback_url" text,
  "success_url" text,
  "failure_url" text,
  "currency" text DEFAULT 'TRY',
  "installment_enabled" integer DEFAULT 1,
  "max_installments" integer DEFAULT 12,
  "commission_rate" double precision DEFAULT 0,
  "status" text DEFAULT 'active',
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "is_active" boolean DEFAULT false,
  "is_test_mode" boolean DEFAULT true,
  "publishable_key" text,
  "api_url" text,
  "settings_json" text,
  CONSTRAINT "pk_payment_settings" PRIMARY KEY ("id")
);

-- Table: payment_transactions
CREATE TABLE IF NOT EXISTS "license"."payment_transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "user_id" uuid,
  "license_id" uuid,
  "transaction_type" text DEFAULT 'license_purchase' NOT NULL,
  "amount" double precision NOT NULL,
  "currency" text DEFAULT 'TRY',
  "status" text DEFAULT 'pending',
  "provider" text DEFAULT 'iyzico' NOT NULL,
  "provider_transaction_id" text,
  "provider_payment_id" text,
  "basket_id" text,
  "conversation_id" text,
  "card_type" text,
  "card_association" text,
  "card_family" text,
  "card_last_four" text,
  "installment" integer DEFAULT 1,
  "paid_price" double precision,
  "merchant_commission" double precision DEFAULT 0,
  "iyzico_commission" double precision DEFAULT 0,
  "buyer_email" text,
  "buyer_name" text,
  "buyer_phone" text,
  "buyer_address" text,
  "buyer_city" text,
  "buyer_country" text DEFAULT 'Turkey',
  "buyer_ip" text,
  "billing_address" text,
  "billing_city" text,
  "billing_country" text DEFAULT 'Turkey',
  "error_code" text,
  "error_message" text,
  "error_group" text,
  "raw_request" text,
  "raw_response" text,
  "callback_data" text,
  "metadata" text,
  "paid_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "reference_no" text,
  "plan_id" text,
  CONSTRAINT "pk_payment_transactions" PRIMARY KEY ("id")
);

