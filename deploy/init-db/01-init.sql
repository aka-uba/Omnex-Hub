-- ========================================
-- Omnex Display Hub - Database Bootstrap
-- Runs on first container creation
-- ========================================
-- NOTE: This script is parametric - it uses current_database()
-- and current_user instead of hardcoded values, so it works
-- with any POSTGRES_DB and POSTGRES_USER setting.
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

-- Set default search path (dynamic database name)
DO $$
BEGIN
    EXECUTE format(
        'ALTER DATABASE %I SET search_path TO core, license, catalog, branch, labels, media, devices, signage, integration, audit, legacy, public',
        current_database()
    );
END $$;

-- Grant schema usage to the application user (dynamic user name)
DO $$
DECLARE
    schema_name TEXT;
    db_user TEXT := current_user;
BEGIN
    FOR schema_name IN SELECT unnest(ARRAY['core', 'license', 'catalog', 'branch', 'labels', 'media', 'devices', 'signage', 'integration', 'audit', 'legacy'])
    LOOP
        EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA %I TO %I', schema_name, db_user);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO %I', schema_name, db_user);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO %I', schema_name, db_user);
    END LOOP;
END $$;
