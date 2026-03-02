-- ========================================
-- Omnex Display Hub - Database Bootstrap
-- Runs on first container creation
-- ========================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Schemas
CREATE SCHEMA IF NOT EXISTS "core";
CREATE SCHEMA IF NOT EXISTS "license";
CREATE SCHEMA IF NOT EXISTS "catalog";
CREATE SCHEMA IF NOT EXISTS "branch";
CREATE SCHEMA IF NOT EXISTS "labels";
CREATE SCHEMA IF NOT EXISTS "media";
CREATE SCHEMA IF NOT EXISTS "devices";
CREATE SCHEMA IF NOT EXISTS "signage";
CREATE SCHEMA IF NOT EXISTS "integration";
CREATE SCHEMA IF NOT EXISTS "audit";
CREATE SCHEMA IF NOT EXISTS "legacy";

-- Set default search path
ALTER DATABASE omnex_hub SET search_path TO core, license, catalog, branch, labels, media, devices, signage, integration, audit, legacy, public;

-- Grant schema usage to the application user
DO $$
DECLARE
    schema_name TEXT;
BEGIN
    FOR schema_name IN SELECT unnest(ARRAY['core', 'license', 'catalog', 'branch', 'labels', 'media', 'devices', 'signage', 'integration', 'audit', 'legacy'])
    LOOP
        EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA %I TO omnex', schema_name);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO omnex', schema_name);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO omnex', schema_name);
    END LOOP;
END $$;
