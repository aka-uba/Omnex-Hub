-- Migration Dosyalarından Oluşturulan Şema
-- Oluşturulma Tarihi: 2026-01-24 22:56:17
-- Toplam Migration Dosyası: 44

-- ============================================
-- Migration: 001_create_companies.sql
-- ============================================

-- Omnex Display Hub - Companies Table
-- Multi-tenant firma yönetimi

CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT,
    subdomain TEXT,
    logo TEXT,
    pwa_icon TEXT,
    favicon TEXT,
    primary_color TEXT DEFAULT '#228be6',
    secondary_color TEXT DEFAULT '#495057',
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'pending')),
    settings TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);


-- ============================================
-- Migration: 002_create_users.sql
-- ============================================

-- Omnex Display Hub - Users Table
-- Kullanıcı yönetimi

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    avatar TEXT,
    role TEXT NOT NULL CHECK(role IN ('SuperAdmin', 'Admin', 'Editor', 'Viewer')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('active', 'pending', 'suspended', 'deleted')),
    activation_token TEXT,
    activation_expires TEXT,
    password_reset_token TEXT,
    password_reset_expires TEXT,
    last_login TEXT,
    last_ip TEXT,
    last_user_agent TEXT,
    preferences TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    resource TEXT NOT NULL,
    actions TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_role_resource ON permissions(role, resource);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    refresh_token_hash TEXT UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    last_activity TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);


-- ============================================
-- Migration: 003_create_products.sql
-- ============================================

-- Omnex Display Hub - Products Table
-- Ürün yönetimi

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    barcode TEXT,
    name TEXT NOT NULL,
    slug TEXT,
    description TEXT,
    category TEXT,
    subcategory TEXT,
    brand TEXT,
    origin TEXT,
    unit TEXT DEFAULT 'adet',
    current_price REAL NOT NULL DEFAULT 0,
    previous_price REAL,
    price_valid_until TEXT,
    vat_rate REAL DEFAULT 20,
    discount_percent REAL,
    campaign_text TEXT,
    weight REAL,
    stock INTEGER DEFAULT 0,
    image_url TEXT,
    kunye_no TEXT,
    kunye_data TEXT,
    shelf_location TEXT,
    supplier_code TEXT,
    default_image_id TEXT,
    default_video_id TEXT,
    erp_id TEXT,
    erp_data TEXT,
    extra_data TEXT,
    is_featured INTEGER DEFAULT 0,
    valid_from TEXT,
    valid_until TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'deleted')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_company_sku ON products(company_id, sku);

-- Price History
CREATE TABLE IF NOT EXISTS price_history (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    old_price REAL,
    new_price REAL NOT NULL,
    changed_at TEXT NOT NULL DEFAULT (datetime('now')),
    source TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_changed ON price_history(changed_at);


-- ============================================
-- Migration: 004_create_templates.sql
-- ============================================

-- Omnex Display Hub - Templates Table
-- Etiket ve signage şablonları

CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK(type IN ('label', 'signage', 'tv')),
    category TEXT,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    orientation TEXT DEFAULT 'landscape' CHECK(orientation IN ('landscape', 'portrait')),
    design_data TEXT NOT NULL,
    preview_image TEXT,
    version INTEGER DEFAULT 1,
    parent_id TEXT,
    is_default INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'draft', 'archived')),
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES templates(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_templates_company ON templates(company_id);
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_public ON templates(is_public);


-- ============================================
-- Migration: 005_create_media.sql
-- ============================================

-- Omnex Display Hub - Media Tables
-- Medya kütüphanesi

-- Media Folders
CREATE TABLE IF NOT EXISTS media_folders (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    parent_id TEXT,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES media_folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_folders_company ON media_folders(company_id);
CREATE INDEX IF NOT EXISTS idx_media_folders_parent ON media_folders(parent_id);

-- Media Files
CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    folder_id TEXT,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK(file_type IN ('image', 'video', 'document')),
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    duration INTEGER,
    thumbnail TEXT,
    alt_text TEXT,
    description TEXT,
    tags TEXT,
    metadata TEXT,
    source TEXT DEFAULT 'upload' CHECK(source IN ('upload', 'url', 'ftp', 'api')),
    source_url TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'processing', 'deleted')),
    uploaded_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES media_folders(id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_media_company ON media(company_id);
CREATE INDEX IF NOT EXISTS idx_media_folder ON media(folder_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON media(file_type);
CREATE INDEX IF NOT EXISTS idx_media_status ON media(status);


-- ============================================
-- Migration: 006_create_devices.sql
-- ============================================

-- Omnex Display Hub - Devices Tables
-- Cihaz yönetimi (ESL, TV, Panel)

-- Device Groups
CREATE TABLE IF NOT EXISTS device_groups (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    store_name TEXT,
    store_code TEXT,
    device_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES device_groups(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_device_groups_company ON device_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_device_groups_parent ON device_groups(parent_id);

-- Devices
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    group_id TEXT,
    store_id TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('esl', 'android_tv', 'panel', 'web_display')),
    mac_address TEXT,
    ip_address TEXT,
    device_id TEXT,
    model TEXT,
    manufacturer TEXT,
    firmware_version TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    orientation TEXT DEFAULT 'landscape' CHECK(orientation IN ('landscape', 'portrait')),
    current_template_id TEXT,
    current_content TEXT,
    last_sync TEXT,
    last_online TEXT,
    last_seen TEXT,
    status TEXT DEFAULT 'offline' CHECK(status IN ('online', 'offline', 'error', 'maintenance')),
    battery_level INTEGER,
    signal_strength INTEGER,
    error_message TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES device_groups(id) ON DELETE SET NULL,
    FOREIGN KEY (current_template_id) REFERENCES templates(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_company ON devices(company_id);
CREATE INDEX IF NOT EXISTS idx_devices_group ON devices(group_id);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);

-- Device Logs
CREATE TABLE IF NOT EXISTS device_logs (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('send', 'update', 'sync', 'reboot', 'error')),
    content_type TEXT,
    content_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('pending', 'sending', 'success', 'failed', 'timeout')),
    request_data TEXT,
    response_data TEXT,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_device_logs_device ON device_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_device_logs_status ON device_logs(status);
CREATE INDEX IF NOT EXISTS idx_device_logs_created ON device_logs(created_at);

-- Note: Triggers moved to separate migration file 022_device_triggers.sql


-- ============================================
-- Migration: 007_create_signage.sql
-- ============================================

-- Omnex Display Hub - Signage Tables
-- Digital Signage (Playlists, Schedules)

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    duration INTEGER,
    loop_count INTEGER DEFAULT 0,
    items TEXT NOT NULL,
    transition TEXT DEFAULT 'fade',
    transition_duration INTEGER DEFAULT 500,
    status TEXT DEFAULT 'draft' CHECK(status IN ('active', 'draft', 'archived')),
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_playlists_company ON playlists(company_id);
CREATE INDEX IF NOT EXISTS idx_playlists_status ON playlists(status);

-- Schedules
CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    target_type TEXT NOT NULL CHECK(target_type IN ('device', 'group', 'all')),
    target_id TEXT,
    content_type TEXT NOT NULL CHECK(content_type IN ('template', 'playlist', 'media')),
    content_id TEXT NOT NULL,
    schedule_type TEXT NOT NULL CHECK(schedule_type IN ('once', 'daily', 'weekly', 'monthly', 'custom')),
    start_date TEXT NOT NULL,
    end_date TEXT,
    start_time TEXT,
    end_time TEXT,
    days_of_week TEXT,
    cron_expression TEXT,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'paused', 'completed', 'failed')),
    last_run TEXT,
    next_run TEXT,
    run_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_schedules_company ON schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run);
CREATE INDEX IF NOT EXISTS idx_schedules_target ON schedules(target_type, target_id);


-- ============================================
-- Migration: 008_create_integrations.sql
-- ============================================

-- Omnex Display Hub - Integrations & Import Tables
-- ERP entegrasyonları ve veri import

-- Integrations
CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('erp', 'api', 'ftp', 'webhook')),
    provider TEXT,
    config TEXT NOT NULL,
    sync_interval INTEGER DEFAULT 60,
    last_sync TEXT,
    last_sync_status TEXT CHECK(last_sync_status IN ('success', 'failed', 'partial')),
    last_sync_message TEXT,
    next_sync TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'error')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_integrations_company ON integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);

-- Import Mappings
CREATE TABLE IF NOT EXISTS import_mappings (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    format TEXT NOT NULL DEFAULT 'auto',
    config TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    last_used TEXT,
    use_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_import_mappings_company ON import_mappings(company_id);
CREATE INDEX IF NOT EXISTS idx_import_mappings_default ON import_mappings(is_default);

-- Import Logs
CREATE TABLE IF NOT EXISTS import_logs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    mapping_id TEXT,
    filename TEXT,
    file_size INTEGER,
    total_rows INTEGER,
    valid_rows INTEGER,
    inserted INTEGER DEFAULT 0,
    updated INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    errors TEXT,
    duration_ms INTEGER,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (mapping_id) REFERENCES import_mappings(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_import_logs_company ON import_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_status ON import_logs(status);
CREATE INDEX IF NOT EXISTS idx_import_logs_created ON import_logs(created_at);


-- ============================================
-- Migration: 009_create_system.sql
-- ============================================

-- Omnex Display Hub - System Tables
-- Lisans, Audit, Layout, Menu
-- Updated: 2026-01-15 - Removed old notifications tables (replaced by 018_create_notifications.sql)

-- Licenses
CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL UNIQUE,
    license_key TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('trial', 'starter', 'business', 'enterprise', 'ultimate')),
    period TEXT NOT NULL CHECK(period IN ('monthly', 'yearly', 'lifetime')),
    esl_limit INTEGER DEFAULT 0,
    tv_limit INTEGER DEFAULT 0,
    user_limit INTEGER DEFAULT 0,
    storage_limit INTEGER DEFAULT 0,
    points_used INTEGER DEFAULT 0,
    points_limit INTEGER DEFAULT 0,
    features TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    auto_renew INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expired', 'suspended', 'cancelled')),
    external_id TEXT,
    last_validated TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_licenses_company ON licenses(company_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_end_date ON licenses(end_date);

-- =====================================================
-- DEPRECATED: Old notification tables
-- These have been replaced by:
-- - 018_create_notifications.sql (new notifications table)
-- - 019_create_notification_recipients.sql
-- - 020_create_notification_settings.sql (user_notification_preferences)
-- - 023_notifications_updates.sql
-- =====================================================
-- The old notifications and notification_settings tables below are
-- commented out as they conflict with the new notification system.
-- DO NOT UNCOMMENT - kept for reference only.
-- =====================================================

/*
-- OLD Notifications (replaced by 018_create_notifications.sql)
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    user_id TEXT,
    type TEXT NOT NULL CHECK(type IN ('info', 'warning', 'error', 'success')),
    channel TEXT NOT NULL CHECK(channel IN ('app', 'email', 'whatsapp', 'telegram')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    read_at TEXT,
    sent_at TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed', 'read')),
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- OLD Notification Settings (replaced by 020_create_notification_settings.sql)
-- Now uses user_notification_preferences table for user-level settings
-- Company-level SMTP/WhatsApp/Telegram settings moved to settings table
CREATE TABLE IF NOT EXISTS notification_settings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL UNIQUE,
    smtp_host TEXT,
    smtp_port INTEGER DEFAULT 587,
    smtp_user TEXT,
    smtp_password TEXT,
    smtp_encryption TEXT DEFAULT 'tls',
    smtp_from_email TEXT,
    smtp_from_name TEXT,
    whatsapp_api_url TEXT,
    whatsapp_api_key TEXT,
    whatsapp_phone TEXT,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    notification_rules TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
*/

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    user_id TEXT,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    old_data TEXT,
    new_data TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'success' CHECK(status IN ('success', 'failed')),
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Layout Configs
CREATE TABLE IF NOT EXISTS layout_configs (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL CHECK(scope IN ('user', 'role', 'company', 'default')),
    scope_id TEXT,
    config TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_layout_configs_scope ON layout_configs(scope, scope_id);

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    parent_id TEXT,
    location TEXT NOT NULL CHECK(location IN ('sidebar', 'top', 'mobile')),
    label TEXT NOT NULL,
    href TEXT NOT NULL,
    icon TEXT,
    menu_group TEXT,
    order_index INTEGER DEFAULT 0,
    roles TEXT,
    visible INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_menu_items_company ON menu_items(company_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_parent ON menu_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_location ON menu_items(location);

-- User/Company Settings
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    user_id TEXT,
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_settings_company ON settings(company_id);
CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id);


-- ============================================
-- Migration: 010_add_slug_to_products.sql
-- ============================================

-- Add slug column to products table
-- Run this migration to add slug support

-- SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we use a workaround
-- This will fail silently if column already exists in the migration system

ALTER TABLE products ADD COLUMN slug TEXT;
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);


-- ============================================
-- Migration: 010_create_playlist_items.sql
-- ============================================

-- Omnex Display Hub - Playlist Items Table

-- Playlist Items (for normalized playlist content)
CREATE TABLE IF NOT EXISTS playlist_items (
    id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL,
    media_id TEXT,
    content_type TEXT NOT NULL CHECK(content_type IN ('image', 'video', 'template', 'url', 'html')),
    content_url TEXT,
    content_data TEXT,
    duration INTEGER DEFAULT 5000,
    order_index INTEGER DEFAULT 0,
    transition TEXT DEFAULT 'fade',
    transition_duration INTEGER DEFAULT 500,
    settings TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_order ON playlist_items(playlist_id, order_index);


-- ============================================
-- Migration: 011_create_categories.sql
-- ============================================

-- Omnex Display Hub - Categories Table
-- Ürün kategorileri yönetimi

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    slug TEXT,
    description TEXT,
    color TEXT DEFAULT '#228be6',
    icon TEXT,
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    product_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_company ON categories(company_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_company_slug ON categories(company_id, slug);


-- ============================================
-- Migration: 012_create_device_groups.sql
-- ============================================

-- Device Groups table
CREATE TABLE IF NOT EXISTS device_groups (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#228be6',
    device_type TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Device Group Members table
CREATE TABLE IF NOT EXISTS device_group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES device_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    UNIQUE(group_id, device_id)
);

-- Device Commands table (for bulk actions)
CREATE TABLE IF NOT EXISTS device_commands (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    command TEXT NOT NULL,
    payload TEXT,
    status TEXT DEFAULT 'pending',
    result TEXT,
    executed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_device_groups_company ON device_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_device_group_members_group ON device_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_device_group_members_device ON device_group_members(device_id);
CREATE INDEX IF NOT EXISTS idx_device_commands_device ON device_commands(device_id);
CREATE INDEX IF NOT EXISTS idx_device_commands_status ON device_commands(status);


-- ============================================
-- Migration: 013_create_audit_logs.sql
-- ============================================

-- Audit Logs table is already created in 009_create_system.sql
-- This migration is kept for backwards compatibility but does nothing
-- The schema in 009 uses: resource, resource_id, old_data, new_data
-- Indexes are already created in 009


-- ============================================
-- Migration: 014_alter_companies_add_fields.sql
-- ============================================

-- Add missing fields to companies table for API compatibility
-- These fields are used by the API but were not in the original schema

-- Add code field (company code for identification)
ALTER TABLE companies ADD COLUMN code TEXT;

-- Add email field (contact email)
ALTER TABLE companies ADD COLUMN email TEXT;

-- Add phone field (contact phone)
ALTER TABLE companies ADD COLUMN phone TEXT;

-- Add address field (company address)
ALTER TABLE companies ADD COLUMN address TEXT;

-- Create index on code for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(code);


-- ============================================
-- Migration: 015_fix_schema_issues.sql
-- ============================================

-- Migration 015: Fix Schema Issues
-- - Update schedule_devices table with missing columns
-- - Add missing performance indexes

-- 1. Drop and recreate schedule_devices with proper structure
DROP TABLE IF EXISTS schedule_devices;

CREATE TABLE schedule_devices (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
    sent_at TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_devices_unique ON schedule_devices(schedule_id, device_id);
CREATE INDEX IF NOT EXISTS idx_schedule_devices_schedule ON schedule_devices(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_devices_device ON schedule_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_schedule_devices_status ON schedule_devices(status);

-- 2. Add missing performance indexes (IF NOT EXISTS ensures no errors)
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen);
CREATE INDEX IF NOT EXISTS idx_media_company_created ON media(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON templates(created_by);
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON media(uploaded_by);


-- ============================================
-- Migration: 016_add_avatar_to_users.sql
-- ============================================

-- Add avatar column to users table
-- Migration: 016_add_avatar_to_users.sql

ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT NULL;


-- ============================================
-- Migration: 017_add_production_type_and_price_dates.sql
-- ============================================

-- Omnex Display Hub - Production Types and Price Dates
-- Uretim sekli kategorileri ve fiyat degisiklik tarihleri

-- Production Types Table (kategori gibi yonetilebilir)
CREATE TABLE IF NOT EXISTS production_types (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT,
    description TEXT,
    color TEXT DEFAULT '#228be6',
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_production_types_company ON production_types(company_id);
CREATE INDEX IF NOT EXISTS idx_production_types_status ON production_types(status);

-- Add new fields to products table
-- production_type: Uretim sekli (Konvansiyonel, Naturel, Geleneksel Tarim vb.)
-- price_updated_at: Mevcut fiyatin degisiklik tarihi
-- previous_price_updated_at: Eski fiyatin degisiklik tarihi

ALTER TABLE products ADD COLUMN production_type TEXT;
ALTER TABLE products ADD COLUMN price_updated_at TEXT;
ALTER TABLE products ADD COLUMN previous_price_updated_at TEXT;

-- Index for production_type
CREATE INDEX IF NOT EXISTS idx_products_production_type ON products(production_type);


-- ============================================
-- Migration: 018_create_notifications.sql
-- ============================================

-- Notifications table
-- Migration: 018_create_notifications.sql
-- Description: Main notifications table for system-wide notification management

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info', -- info, success, warning, error
    icon TEXT,
    link TEXT, -- Optional link to navigate
    target_type TEXT DEFAULT 'user', -- user, role, company, all
    target_id TEXT, -- user_id, role name, or NULL for all
    channels TEXT DEFAULT 'web', -- JSON array: ["web", "push", "toast"]
    priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
    expires_at TEXT, -- Optional expiration
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at);


-- ============================================
-- Migration: 019_create_notification_recipients.sql
-- ============================================

-- Notification recipients table
-- Migration: 019_create_notification_recipients.sql
-- Description: Tracks which users received notifications and their read/archived status

CREATE TABLE IF NOT EXISTS notification_recipients (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'unread', -- unread, read, archived, deleted
    read_at TEXT,
    archived_at TEXT,
    deleted_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_recipients_user ON notification_recipients(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notif_recipients_notification ON notification_recipients(notification_id);
CREATE INDEX IF NOT EXISTS idx_notif_recipients_status ON notification_recipients(status);
CREATE INDEX IF NOT EXISTS idx_notif_recipients_read_at ON notification_recipients(read_at);


-- ============================================
-- Migration: 020_create_notification_settings.sql
-- ============================================

-- User notification preferences table
-- Migration: 020_create_notification_settings.sql
-- Description: Stores per-user notification preferences and quiet hours settings
-- Note: Using user_notification_preferences to avoid conflict with company notification_settings

CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    email_enabled INTEGER DEFAULT 1,
    push_enabled INTEGER DEFAULT 1,
    toast_enabled INTEGER DEFAULT 1,
    web_enabled INTEGER DEFAULT 1,
    sound_enabled INTEGER DEFAULT 1,
    -- Per-type settings (JSON object)
    -- Example: {"info": {"email": false}, "warning": {"sound": true}}
    type_preferences TEXT DEFAULT '{}',
    -- Quiet hours (no notifications during this period)
    quiet_start TEXT, -- e.g., "22:00"
    quiet_end TEXT, -- e.g., "08:00"
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_notif_prefs_user ON user_notification_preferences(user_id);


-- ============================================
-- Migration: 021_esl_pwa_updates.sql
-- ============================================

-- Omnex Display Hub - ESL PWA Updates
-- Migration 021: Device authentication, sync codes, PWA support
-- Created: 2026-01-13

-- =====================================================
-- 1. DEVICES TABLE UPDATES
-- =====================================================

ALTER TABLE devices ADD COLUMN device_token TEXT;
ALTER TABLE devices ADD COLUMN token_expires_at TEXT;
ALTER TABLE devices ADD COLUMN sync_code TEXT;
ALTER TABLE devices ADD COLUMN sync_code_expires_at TEXT;
ALTER TABLE devices ADD COLUMN fingerprint TEXT;
ALTER TABLE devices ADD COLUMN os_info TEXT;
ALTER TABLE devices ADD COLUMN browser_info TEXT;
ALTER TABLE devices ADD COLUMN screen_resolution TEXT;
ALTER TABLE devices ADD COLUMN timezone TEXT;
ALTER TABLE devices ADD COLUMN language TEXT;
ALTER TABLE devices ADD COLUMN last_heartbeat TEXT;
ALTER TABLE devices ADD COLUMN approval_status TEXT DEFAULT 'approved';
ALTER TABLE devices ADD COLUMN approved_by TEXT;
ALTER TABLE devices ADD COLUMN approved_at TEXT;

CREATE INDEX IF NOT EXISTS idx_devices_sync_code ON devices(sync_code);
CREATE INDEX IF NOT EXISTS idx_devices_device_token ON devices(device_token);
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON devices(fingerprint);
CREATE INDEX IF NOT EXISTS idx_devices_approval_status ON devices(approval_status);

-- =====================================================
-- 2. TEMPLATES TABLE UPDATES
-- =====================================================

ALTER TABLE templates ADD COLUMN layout_type TEXT DEFAULT 'full';
ALTER TABLE templates ADD COLUMN template_file TEXT;
ALTER TABLE templates ADD COLUMN slots TEXT;

CREATE INDEX IF NOT EXISTS idx_templates_layout_type ON templates(layout_type);

-- =====================================================
-- 3. PLAYLISTS TABLE UPDATES
-- =====================================================

ALTER TABLE playlists ADD COLUMN orientation TEXT DEFAULT 'landscape';
ALTER TABLE playlists ADD COLUMN template_id TEXT;
ALTER TABLE playlists ADD COLUMN layout_type TEXT;

CREATE INDEX IF NOT EXISTS idx_playlists_template ON playlists(template_id);
CREATE INDEX IF NOT EXISTS idx_playlists_orientation ON playlists(orientation);

-- =====================================================
-- 4. DEVICE_TOKENS TABLE (NEW)
-- =====================================================

CREATE TABLE IF NOT EXISTS device_tokens (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    token_type TEXT DEFAULT 'device',
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    last_used_at TEXT,
    is_revoked INTEGER DEFAULT 0,
    revoked_at TEXT,
    revoked_reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_device ON device_tokens(device_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_expires ON device_tokens(expires_at);

-- =====================================================
-- 5. DEVICE_SYNC_REQUESTS TABLE (NEW)
-- =====================================================

CREATE TABLE IF NOT EXISTS device_sync_requests (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    sync_code TEXT UNIQUE,
    serial_number TEXT,
    firmware TEXT,
    screen_type TEXT,
    resolution TEXT,
    manufacturer TEXT,
    store_code TEXT,
    mac_address TEXT,
    fingerprint TEXT,
    os TEXT,
    browser TEXT,
    timezone TEXT,
    language TEXT,
    screen_resolution TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'pending',
    request_count INTEGER DEFAULT 1,
    last_request_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    approved_by TEXT,
    approved_at TEXT,
    rejection_reason TEXT,
    device_id TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_requests_sync_code ON device_sync_requests(sync_code);
CREATE INDEX IF NOT EXISTS idx_sync_requests_status ON device_sync_requests(status);
CREATE INDEX IF NOT EXISTS idx_sync_requests_serial ON device_sync_requests(serial_number);

-- =====================================================
-- 6. DEVICE_COMMANDS TABLE (NEW)
-- =====================================================

CREATE TABLE IF NOT EXISTS device_commands (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    command TEXT NOT NULL,
    parameters TEXT,
    status TEXT DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    created_by TEXT,
    executed_at TEXT,
    result TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_device_commands_device ON device_commands(device_id);
CREATE INDEX IF NOT EXISTS idx_device_commands_status ON device_commands(status);

-- =====================================================
-- 7. DEVICE_HEARTBEATS TABLE (NEW)
-- =====================================================

CREATE TABLE IF NOT EXISTS device_heartbeats (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    status TEXT,
    current_item TEXT,
    battery_level INTEGER,
    signal_strength INTEGER,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_device_heartbeats_device ON device_heartbeats(device_id);

-- =====================================================
-- 8. DEVICE_ALERTS TABLE (NEW)
-- =====================================================

CREATE TABLE IF NOT EXISTS device_alerts (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    title TEXT NOT NULL,
    message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_device_alerts_device ON device_alerts(device_id);

-- =====================================================
-- 9. DEVICE_CONTENT_ASSIGNMENTS TABLE (NEW)
-- =====================================================

CREATE TABLE IF NOT EXISTS device_content_assignments (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_device_content_device ON device_content_assignments(device_id);


-- ============================================
-- Migration: 023_notifications_updates.sql
-- ============================================

-- Omnex Display Hub - Notifications Updates
-- Migration 023: Add missing columns to notifications table
-- Created: 2026-01-13

-- Add missing columns to notifications table
ALTER TABLE notifications ADD COLUMN icon TEXT;
ALTER TABLE notifications ADD COLUMN link TEXT;
ALTER TABLE notifications ADD COLUMN channels TEXT DEFAULT '["web"]';
ALTER TABLE notifications ADD COLUMN expires_at TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);


-- ============================================
-- Migration: 024_add_esl_device_types.sql
-- ============================================

-- Add new device types for ESL devices
-- SQLite doesn't support ALTER TABLE CHECK constraint modification
-- So we recreate the devices table with updated type constraint

-- Note: SQLite's CHECK constraint doesn't prevent insertion via application level
-- The constraint is only enforced at table creation. Application should handle validation.

-- Add screen dimensions columns if not exist
ALTER TABLE devices ADD COLUMN screen_width INTEGER DEFAULT 800;
ALTER TABLE devices ADD COLUMN screen_height INTEGER DEFAULT 1280;

-- Add location column if not exist
ALTER TABLE devices ADD COLUMN location TEXT;

-- Update existing 'esl' types to be more specific if needed
-- (This is a no-op if types are already correct)
UPDATE devices SET type = 'esl' WHERE type = 'esl';


-- ============================================
-- Migration: 025_template_editor_updates.sql
-- ============================================

-- Omnex Display Hub - Template Editor Updates
-- Şablon editörü için yeni alanlar

-- Cihaz türleri (JSON array) - şablonun hangi cihaz türlerinde kullanılabileceği
ALTER TABLE templates ADD COLUMN device_types TEXT;

-- Hedef cihaz türü - ana hedef cihaz
ALTER TABLE templates ADD COLUMN target_device_type TEXT;

-- Grid düzeni ID'si (single, split-vertical, split-horizontal, vb.)
ALTER TABLE templates ADD COLUMN grid_layout TEXT DEFAULT 'single';

-- Bölge yapılandırması (JSON) - her bölgenin arkaplan ayarları vb.
ALTER TABLE templates ADD COLUMN regions_config TEXT;

-- Arkaplan tipi (color, gradient, image, video)
ALTER TABLE templates ADD COLUMN background_type TEXT DEFAULT 'color';

-- Arkaplan değeri (renk kodu, gradient JSON, veya dosya yolu)
ALTER TABLE templates ADD COLUMN background_value TEXT DEFAULT '#FFFFFF';

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_templates_target_device ON templates(target_device_type);
CREATE INDEX IF NOT EXISTS idx_templates_grid_layout ON templates(grid_layout);


-- ============================================
-- Migration: 026_add_product_media_fields.sql
-- ============================================

-- Migration 026: Add images and videos fields to products table
-- Date: 2026-01-14
-- Note: Consolidated from duplicate 026_add_video_to_products.sql (deleted)

-- Add images column (JSON array of image objects)
ALTER TABLE products ADD COLUMN images TEXT;

-- Add videos column (JSON array of video objects)
ALTER TABLE products ADD COLUMN videos TEXT;

-- Add video_url for single video (backward compatibility)
ALTER TABLE products ADD COLUMN video_url TEXT;

-- Add storage_info for product storage instructions
ALTER TABLE products ADD COLUMN storage_info TEXT;


-- ============================================
-- Migration: 027_add_cover_image_index.sql
-- ============================================

-- Migration: Add cover_image_index field to products table
-- Date: 2026-01-14
-- Description: Allows selecting which image is the cover/main image

-- Add cover_image_index column (0-based index into images array)
ALTER TABLE products ADD COLUMN cover_image_index INTEGER DEFAULT 0;


-- ============================================
-- Migration: 028_add_template_render_image.sql
-- ============================================

-- Migration 028: Add render_image to templates table
-- Full-resolution render image path for device sending

ALTER TABLE templates ADD COLUMN render_image TEXT;


-- ============================================
-- Migration: 029_create_firmware_updates.sql
-- ============================================

-- Omnex Display Hub - Firmware Updates Table
-- Migration 029: Create firmware_updates table for ESL device firmware management
-- Created: 2026-01-15

-- =====================================================
-- FIRMWARE_UPDATES TABLE
-- =====================================================
-- Used by: api/esl/config.php for delivering firmware updates to ESL devices

CREATE TABLE IF NOT EXISTS firmware_updates (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    device_type TEXT NOT NULL DEFAULT 'esl', -- esl, android_tv, panel, web_display
    version TEXT NOT NULL,
    url TEXT NOT NULL, -- Download URL for firmware file
    notes TEXT, -- Release notes
    min_version TEXT, -- Minimum required version to upgrade from
    max_version TEXT, -- Maximum version this update applies to
    file_size INTEGER, -- File size in bytes
    checksum TEXT, -- MD5 or SHA256 checksum
    is_mandatory INTEGER DEFAULT 0, -- Force update
    is_active INTEGER DEFAULT 1, -- Enable/disable update
    released_at TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_firmware_updates_device_type ON firmware_updates(device_type);
CREATE INDEX IF NOT EXISTS idx_firmware_updates_version ON firmware_updates(version);
CREATE INDEX IF NOT EXISTS idx_firmware_updates_active ON firmware_updates(is_active);
CREATE INDEX IF NOT EXISTS idx_firmware_updates_released ON firmware_updates(released_at DESC);


-- ============================================
-- Migration: 030_extend_device_heartbeats.sql
-- ============================================

-- Omnex Display Hub - Device Heartbeats Extended Columns
-- Migration 030: Add missing columns to device_heartbeats table
-- Created: 2026-01-16
--
-- This migration adds columns that are used by api/player/heartbeat.php
-- but were missing from the original schema in migration 021

-- =====================================================
-- 1. DEVICE_HEARTBEATS TABLE EXTENSIONS
-- =====================================================

-- Memory usage (percentage 0-100 or bytes)
ALTER TABLE device_heartbeats ADD COLUMN memory_usage INTEGER;

-- CPU usage (percentage 0-100)
ALTER TABLE device_heartbeats ADD COLUMN cpu_usage INTEGER;

-- Storage free space (bytes)
ALTER TABLE device_heartbeats ADD COLUMN storage_free INTEGER;

-- Device temperature (Celsius)
ALTER TABLE device_heartbeats ADD COLUMN temperature REAL;

-- Device uptime (seconds)
ALTER TABLE device_heartbeats ADD COLUMN uptime INTEGER;

-- Error list (JSON array)
ALTER TABLE device_heartbeats ADD COLUMN errors TEXT;

-- Additional metadata (JSON object)
ALTER TABLE device_heartbeats ADD COLUMN metadata TEXT;

-- =====================================================
-- 2. PERFORMANCE INDEXES
-- =====================================================

-- Index for recent heartbeats query optimization
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_created ON device_heartbeats(created_at DESC);

-- Index for device status monitoring
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_device_status ON device_heartbeats(device_id, status);

-- =====================================================
-- 3. CLEANUP OLD HEARTBEATS (Optional - run manually)
-- =====================================================

-- Heartbeat kayitlari zamanla buyuyebilir
-- 30 gunluk kayitlari otomatik temizlemek icin:
-- DELETE FROM device_heartbeats WHERE created_at < datetime('now', '-30 days');


-- ============================================
-- Migration: 031_add_token_hash_column.sql
-- ============================================

-- Omnex Display Hub - Add token_hash column to device_tokens
-- Migration 031: Add missing token_hash column for device authentication
-- Created: 2026-01-16

-- Add token_hash column to device_tokens table
ALTER TABLE device_tokens ADD COLUMN token_hash TEXT;

-- Create index for token_hash lookups
CREATE INDEX IF NOT EXISTS idx_device_tokens_hash ON device_tokens(token_hash);


-- ============================================
-- Migration: 032_add_device_details_fields.sql
-- ============================================

-- Omnex Display Hub - Device Details Fields
-- Migration 032: Add detailed device information fields
-- Created: 2026-01-16

-- =====================================================
-- 1. DEVICE_SYNC_REQUESTS TABLE UPDATES
-- =====================================================

-- Device type (mobile, tablet, tv, desktop)
ALTER TABLE device_sync_requests ADD COLUMN device_type TEXT;

-- Device brand (Samsung, Apple, Xiaomi, etc.)
ALTER TABLE device_sync_requests ADD COLUMN brand TEXT;

-- Device model (Galaxy S21, iPhone 13, etc.)
ALTER TABLE device_sync_requests ADD COLUMN model TEXT;

-- OS version (Android 13, iOS 16.5, etc.)
ALTER TABLE device_sync_requests ADD COLUMN os_version TEXT;

-- Browser version
ALTER TABLE device_sync_requests ADD COLUMN browser_version TEXT;

-- Screen diagonal in inches (approximate)
ALTER TABLE device_sync_requests ADD COLUMN screen_diagonal REAL;

-- Screen width in pixels
ALTER TABLE device_sync_requests ADD COLUMN screen_width INTEGER;

-- Screen height in pixels
ALTER TABLE device_sync_requests ADD COLUMN screen_height INTEGER;

-- Device pixel ratio
ALTER TABLE device_sync_requests ADD COLUMN pixel_ratio REAL;

-- Color depth
ALTER TABLE device_sync_requests ADD COLUMN color_depth INTEGER;

-- CPU cores
ALTER TABLE device_sync_requests ADD COLUMN cpu_cores INTEGER;

-- Device memory in GB
ALTER TABLE device_sync_requests ADD COLUMN device_memory REAL;

-- Touch support
ALTER TABLE device_sync_requests ADD COLUMN touch_support INTEGER DEFAULT 0;

-- Connection type (4g, wifi, etc.)
ALTER TABLE device_sync_requests ADD COLUMN connection_type TEXT;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sync_requests_device_type ON device_sync_requests(device_type);
CREATE INDEX IF NOT EXISTS idx_sync_requests_brand ON device_sync_requests(brand);

-- =====================================================
-- 2. DEVICES TABLE UPDATES
-- =====================================================

-- Device type (mobile, tablet, tv, desktop, esl)
ALTER TABLE devices ADD COLUMN device_type_detail TEXT;

-- Device brand
ALTER TABLE devices ADD COLUMN brand TEXT;

-- Device model
ALTER TABLE devices ADD COLUMN model_name TEXT;

-- OS version
ALTER TABLE devices ADD COLUMN os_version TEXT;

-- Screen diagonal in inches
ALTER TABLE devices ADD COLUMN screen_diagonal REAL;

-- CPU cores
ALTER TABLE devices ADD COLUMN cpu_cores INTEGER;

-- Device memory in GB
ALTER TABLE devices ADD COLUMN device_memory REAL;


-- ============================================
-- Migration: 032_create_gateways.sql
-- ============================================

-- Gateway tablosu: Local ağ gateway'lerini yönetir
-- Her gateway bir local ağı temsil eder ve o ağdaki cihazlara komut iletir

CREATE TABLE IF NOT EXISTS gateways (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    -- Kimlik doğrulama
    api_key TEXT UNIQUE NOT NULL,
    api_secret TEXT NOT NULL,

    -- Gateway bilgileri
    local_ip TEXT,
    public_ip TEXT,
    hostname TEXT,

    -- Durum
    status TEXT DEFAULT 'offline' CHECK(status IN ('online', 'offline', 'error')),
    last_heartbeat TEXT,
    last_error TEXT,

    -- Yapılandırma
    config TEXT, -- JSON: polling_interval, timeout, etc.

    -- Meta
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Gateway-Device ilişkisi: Hangi cihaz hangi gateway üzerinden erişilebilir
CREATE TABLE IF NOT EXISTS gateway_devices (
    id TEXT PRIMARY KEY,
    gateway_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    local_ip TEXT NOT NULL, -- Cihazın local ağdaki IP'si

    -- Durum
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'unreachable')),
    last_seen TEXT,
    last_error TEXT,

    -- Meta
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (gateway_id) REFERENCES gateways(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    UNIQUE(gateway_id, device_id)
);

-- Gateway komut kuyruğu: Sunucudan gateway'e gönderilecek komutlar
CREATE TABLE IF NOT EXISTS gateway_commands (
    id TEXT PRIMARY KEY,
    gateway_id TEXT NOT NULL,
    device_id TEXT, -- NULL ise gateway'in kendisine komut

    -- Komut detayları
    command TEXT NOT NULL, -- ping, send_content, refresh, reboot, scan_network, etc.
    parameters TEXT, -- JSON parametreler
    priority INTEGER DEFAULT 0, -- Yüksek = öncelikli

    -- Durum
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'executing', 'completed', 'failed', 'timeout')),
    result TEXT, -- JSON sonuç
    error_message TEXT,

    -- Zamanlar
    created_at TEXT DEFAULT (datetime('now')),
    sent_at TEXT,
    completed_at TEXT,
    expires_at TEXT, -- Bu süreden sonra timeout

    FOREIGN KEY (gateway_id) REFERENCES gateways(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_gateways_company ON gateways(company_id);
CREATE INDEX IF NOT EXISTS idx_gateways_status ON gateways(status);
CREATE INDEX IF NOT EXISTS idx_gateways_api_key ON gateways(api_key);

CREATE INDEX IF NOT EXISTS idx_gateway_devices_gateway ON gateway_devices(gateway_id);
CREATE INDEX IF NOT EXISTS idx_gateway_devices_device ON gateway_devices(device_id);

CREATE INDEX IF NOT EXISTS idx_gateway_commands_gateway ON gateway_commands(gateway_id);
CREATE INDEX IF NOT EXISTS idx_gateway_commands_status ON gateway_commands(status);
CREATE INDEX IF NOT EXISTS idx_gateway_commands_pending ON gateway_commands(gateway_id, status) WHERE status = 'pending';


-- ============================================
-- Migration: 032_fix_playlists_columns.sql
-- ============================================

-- Omnex Display Hub - Fix playlists table missing columns
-- Migration 032: Add missing columns to playlists table
-- Created: 2026-01-16

-- Add items column (JSON array of playlist items)
ALTER TABLE playlists ADD COLUMN items TEXT DEFAULT '[]';

-- Add default_duration column (seconds per item)
ALTER TABLE playlists ADD COLUMN default_duration INTEGER DEFAULT 10;

-- Add created_by column (user ID who created the playlist)
ALTER TABLE playlists ADD COLUMN created_by TEXT;

-- Add orientation column
ALTER TABLE playlists ADD COLUMN orientation TEXT DEFAULT 'landscape';

-- Add template_id column
ALTER TABLE playlists ADD COLUMN template_id TEXT;

-- Add layout_type column
ALTER TABLE playlists ADD COLUMN layout_type TEXT DEFAULT 'full';


-- ============================================
-- Migration: 033_fix_settings_table.sql
-- ============================================

-- Fix settings table - add missing data column
-- This column stores JSON settings data

-- Add data column if it doesn't exist
ALTER TABLE settings ADD COLUMN data TEXT NOT NULL DEFAULT '{}';

-- Add indexes if not exists
CREATE INDEX IF NOT EXISTS idx_settings_company ON settings(company_id);
CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id);


-- ============================================
-- Migration: 040_hanshow_esl_integration.sql
-- ============================================

-- Hanshow ESL Entegrasyonu Migration
-- Tarih: 2026-01-18

-- Hanshow ESL cihazlari tablosu
CREATE TABLE IF NOT EXISTS hanshow_esls (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    esl_id TEXT NOT NULL UNIQUE,      -- Hanshow ESL ID (XX-XX-XX-XX format)
    firmware_id INTEGER,               -- Hanshow firmware ID
    model_name TEXT,                   -- Cihaz modeli (Stellar-SLR, Skyline-M@ vb.)
    screen_width INTEGER,              -- Ekran genisligi (piksel)
    screen_height INTEGER,             -- Ekran yuksekligi (piksel)
    screen_color TEXT,                 -- BW, BWR, BWRY
    screen_type TEXT,                  -- EPD (e-paper), LCD
    max_pages INTEGER DEFAULT 1,       -- Maksimum sayfa sayisi
    has_led BOOLEAN DEFAULT 0,         -- LED destegi
    has_magnet BOOLEAN DEFAULT 0,      -- Miknatisli (reed switch) destegi
    current_template_id TEXT,          -- Mevcut template
    current_product_id TEXT,           -- Mevcut urun
    last_sync_at TEXT,                 -- Son senkronizasyon
    last_heartbeat_at TEXT,            -- Son heartbeat
    status TEXT DEFAULT 'unknown',     -- online, offline, updating, unknown
    battery_level INTEGER,             -- Pil seviyesi (%)
    ap_mac TEXT,                       -- Bagli oldugu AP MAC adresi
    sales_no TEXT,                     -- Bagli oldugu urun/raf numarasi
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (current_template_id) REFERENCES templates(id) ON DELETE SET NULL,
    FOREIGN KEY (current_product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Hanshow gonderim kuyrugu
CREATE TABLE IF NOT EXISTS hanshow_queue (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    esl_id TEXT NOT NULL,              -- Hanshow ESL ID
    session_id TEXT NOT NULL UNIQUE,   -- Hanshow sid (asenkron takip icin)
    product_id TEXT,                   -- Gonderilen urun
    template_id TEXT,                  -- Kullanilan template
    content_type TEXT,                 -- 'template', 'image', 'control'
    content_data TEXT,                 -- JSON template veya Base64 image
    priority INTEGER DEFAULT 10,       -- 0: en dusuk, 1: en yuksek
    status TEXT DEFAULT 'pending',     -- pending, processing, completed, failed, cancelled
    attempts INTEGER DEFAULT 0,        -- Deneme sayisi
    max_attempts INTEGER DEFAULT 3,    -- Maksimum deneme
    error_message TEXT,                -- Hata mesaji
    callback_data TEXT,                -- Async callback response (JSON)
    rf_power INTEGER,                  -- Iletim gucu
    retry_count INTEGER,               -- Tekrar sayisi
    ap_id INTEGER,                     -- Kullanulan AP ID
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT,                 -- Isleme alinma zamani
    completed_at TEXT,                 -- Tamamlanma zamani
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
);

-- Hanshow ayarlari (firma bazli)
CREATE TABLE IF NOT EXISTS hanshow_settings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL UNIQUE,
    eslworking_url TEXT DEFAULT 'http://127.0.0.1:9000',
    user_id TEXT DEFAULT 'default',    -- Hanshow user identifier
    callback_url TEXT,                  -- Async callback URL
    default_priority INTEGER DEFAULT 10,
    sync_interval INTEGER DEFAULT 60,   -- Saniye
    auto_retry BOOLEAN DEFAULT 1,
    max_retry_attempts INTEGER DEFAULT 3,
    led_flash_on_update BOOLEAN DEFAULT 1,
    led_color TEXT DEFAULT 'green',
    enabled BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Hanshow AP (Base Station) tablosu
CREATE TABLE IF NOT EXISTS hanshow_aps (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    ap_id INTEGER NOT NULL,            -- Hanshow AP ID
    mac_address TEXT NOT NULL,         -- AP MAC adresi
    sequence INTEGER,                  -- Siralama numarasi
    name TEXT,                         -- Kullanici tanimli isim
    location TEXT,                     -- Konum bilgisi
    allow_bind_v1esl BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'unknown',     -- online, offline
    last_seen_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE(company_id, ap_id),
    UNIQUE(company_id, mac_address)
);

-- Hanshow firmware/cihaz tipleri (cache)
CREATE TABLE IF NOT EXISTS hanshow_firmwares (
    id INTEGER PRIMARY KEY,            -- Hanshow firmware ID
    name TEXT NOT NULL,                -- Model adi
    description TEXT,
    magnet BOOLEAN DEFAULT 0,
    led BOOLEAN DEFAULT 0,
    mpd BOOLEAN DEFAULT 0,             -- Multi-page display
    generation INTEGER,
    heartbeat BOOLEAN DEFAULT 1,
    direction INTEGER DEFAULT 0,
    battery TEXT,
    freezer BOOLEAN DEFAULT 0,
    dpi INTEGER,
    ic TEXT,
    display_mode TEXT,                 -- DOT_MATRIX, SEGMENT_CODE
    screen_type TEXT,                  -- EPD, LCD
    resolution_x INTEGER,
    resolution_y INTEGER,
    screen_color TEXT,                 -- BW, BWR, BWRY
    screen_size TEXT,
    refresh_time INTEGER,
    flash_size INTEGER,
    max_package INTEGER,
    osd_version INTEGER,
    max_page_num INTEGER,
    esl_model TEXT,
    mix_mode BOOLEAN DEFAULT 0,
    screen_model TEXT,
    cached_at TEXT DEFAULT (datetime('now'))
);

-- Indeksler
CREATE INDEX IF NOT EXISTS idx_hanshow_esls_company ON hanshow_esls(company_id);
CREATE INDEX IF NOT EXISTS idx_hanshow_esls_esl_id ON hanshow_esls(esl_id);
CREATE INDEX IF NOT EXISTS idx_hanshow_esls_status ON hanshow_esls(status);
CREATE INDEX IF NOT EXISTS idx_hanshow_esls_product ON hanshow_esls(current_product_id);

CREATE INDEX IF NOT EXISTS idx_hanshow_queue_company ON hanshow_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_hanshow_queue_status ON hanshow_queue(status);
CREATE INDEX IF NOT EXISTS idx_hanshow_queue_esl ON hanshow_queue(esl_id);
CREATE INDEX IF NOT EXISTS idx_hanshow_queue_session ON hanshow_queue(session_id);
CREATE INDEX IF NOT EXISTS idx_hanshow_queue_created ON hanshow_queue(created_at);

CREATE INDEX IF NOT EXISTS idx_hanshow_aps_company ON hanshow_aps(company_id);
CREATE INDEX IF NOT EXISTS idx_hanshow_aps_mac ON hanshow_aps(mac_address);

-- Varsayilan ayarlari ekle (ilk firma icin)
INSERT OR IGNORE INTO hanshow_settings (id, company_id, eslworking_url, user_id)
SELECT
    lower(hex(randomblob(16))),
    id,
    'http://127.0.0.1:9000',
    'default'
FROM companies
LIMIT 1;


-- ============================================
-- Migration: 041_add_integrations_menu.sql
-- ============================================

-- Add Integrations menu item
-- This adds the Integrations menu to the sidebar
-- Note: The actual menu is rendered from LayoutManager.js getMenuItems() method
-- This is kept for reference and future database-driven menu support

INSERT OR IGNORE INTO menu_items (id, company_id, parent_id, location, label, href, icon, order_index, roles, visible, created_at, updated_at)
SELECT
    lower(hex(randomblob(16))),
    NULL,
    NULL,
    'sidebar',
    '{"tr":"Entegrasyonlar","en":"Integrations"}',
    '/settings/integrations',
    'plug-connected',
    9,
    '["SuperAdmin","Admin"]',
    1,
    datetime('now'),
    datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM menu_items WHERE href = '/settings/integrations');


-- ============================================
-- Migration: 042_create_payment_system.sql
-- ============================================

-- Payment System Tables
-- Migration: 042_create_payment_system.sql
-- Description: Paynet ve diger odeme araclari icin tablolar

-- Odeme Ayarlari Tablosu (SuperAdmin only)
CREATE TABLE IF NOT EXISTS payment_settings (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL DEFAULT 'paynet',         -- paynet, iyzico, stripe vb.
    is_active INTEGER DEFAULT 0,                      -- 1 = aktif, 0 = pasif
    is_test_mode INTEGER DEFAULT 1,                   -- 1 = test, 0 = live
    secret_key TEXT,                                  -- Sifrelenmis secret key
    publishable_key TEXT,                             -- Public key (frontend icin)
    merchant_id TEXT,                                 -- Bayi ID (bazi providerlar icin)
    api_url TEXT,                                     -- API base URL
    callback_url TEXT,                                -- Webhook/callback URL
    settings_json TEXT,                               -- Ek ayarlar (JSON)
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(provider)
);

-- Odeme Islemleri Tablosu
CREATE TABLE IF NOT EXISTS payment_transactions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    user_id TEXT,                                     -- Odemeyi yapan kullanici
    license_id TEXT,                                  -- Iliskili lisans (varsa)
    provider TEXT NOT NULL DEFAULT 'paynet',

    -- Islem Bilgileri
    transaction_id TEXT,                              -- Provider tarafindaki islem ID
    reference_no TEXT,                                -- Bizim referans numaram
    session_id TEXT,                                  -- Paynet session ID
    token_id TEXT,                                    -- Paynet token ID

    -- Tutar Bilgileri
    amount REAL NOT NULL,                             -- Tutar (kurus cinsinden)
    currency TEXT DEFAULT 'TRY',
    installment INTEGER DEFAULT 1,                    -- Taksit sayisi

    -- Durum
    status TEXT DEFAULT 'pending',                    -- pending, processing, completed, failed, refunded, cancelled
    transaction_type TEXT DEFAULT 'sale',             -- sale, pre_auth, refund

    -- 3D Secure
    is_3d INTEGER DEFAULT 0,
    tds_status TEXT,                                  -- 3D dogrulama durumu

    -- Kart Bilgileri (maskelenmis)
    card_holder_name TEXT,
    card_masked_pan TEXT,                             -- **** **** **** 1234
    card_brand TEXT,                                  -- visa, mastercard, troy vb.
    card_bank_name TEXT,

    -- Hata Bilgileri
    error_code TEXT,
    error_message TEXT,

    -- Lisans Yenileme Bilgileri
    license_plan TEXT,                                -- Yenilenecek plan
    license_period TEXT,                              -- monthly, yearly, lifetime
    license_extension_days INTEGER,                   -- Uzatilacak gun sayisi

    -- Ek Veriler
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT,                                    -- JSON: Ek bilgiler

    -- Provider Response
    provider_response TEXT,                           -- JSON: Ham provider yaniti

    -- Zaman Damgalari
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,

    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (license_id) REFERENCES licenses(id)
);

-- Lisans Fiyat Planlari Tablosu
CREATE TABLE IF NOT EXISTS license_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                               -- Plan adi (Free, Standard, Professional, Enterprise)
    slug TEXT UNIQUE,                                 -- URL-friendly isim
    description TEXT,

    -- Fiyatlandirma
    price_monthly REAL DEFAULT 0,                     -- Aylik fiyat (kurus)
    price_yearly REAL DEFAULT 0,                      -- Yillik fiyat (kurus)
    price_lifetime REAL DEFAULT 0,                    -- Omur boyu fiyat (kurus)
    currency TEXT DEFAULT 'TRY',

    -- Limitler
    esl_limit INTEGER DEFAULT 0,                      -- 0 = sinirsiz
    tv_limit INTEGER DEFAULT 0,
    user_limit INTEGER DEFAULT 0,
    storage_limit INTEGER DEFAULT 0,                  -- MB cinsinden

    -- Ozellikler
    features TEXT,                                    -- JSON: Ozellik listesi

    -- Durum
    is_active INTEGER DEFAULT 1,
    is_featured INTEGER DEFAULT 0,                    -- One cikan plan
    sort_order INTEGER DEFAULT 0,

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indeksler
CREATE INDEX IF NOT EXISTS idx_payment_transactions_company ON payment_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_license ON payment_transactions(license_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(reference_no);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_txn ON payment_transactions(provider, transaction_id);

-- Varsayilan Odeme Ayarlari (Paynet)
INSERT OR IGNORE INTO payment_settings (id, provider, is_active, is_test_mode, api_url)
VALUES (
    lower(hex(randomblob(16))),
    'paynet',
    0,
    1,
    'https://pts-api.paynet.com.tr'
);

-- Varsayilan Lisans Planlari
INSERT OR IGNORE INTO license_plans (id, name, slug, description, price_monthly, price_yearly, esl_limit, tv_limit, user_limit, storage_limit, features, sort_order)
VALUES
(lower(hex(randomblob(16))), 'Free', 'free', 'Baslangic paketi', 0, 0, 10, 1, 2, 100, '["basic_support"]', 1),
(lower(hex(randomblob(16))), 'Standard', 'standard', 'Kucuk isletmeler icin', 29900, 299000, 100, 5, 5, 1024, '["email_support","api_access"]', 2),
(lower(hex(randomblob(16))), 'Professional', 'professional', 'Buyuyen isletmeler icin', 79900, 799000, 500, 20, 20, 5120, '["priority_support","api_access","advanced_analytics"]', 3),
(lower(hex(randomblob(16))), 'Enterprise', 'enterprise', 'Kurumsal cozumler', 199900, 1999000, 0, 0, 0, 0, '["dedicated_support","api_access","advanced_analytics","custom_integrations","sla"]', 4);


-- ============================================
-- Migration: 043_audit_logs_archive_indexes.sql
-- ============================================

-- Audit Logs - Archive Support and Index Optimization
-- 2026-01-21

-- Add archived_at column for archiving support
ALTER TABLE audit_logs ADD COLUMN archived_at TEXT DEFAULT NULL;

-- Add archived_by column to track who archived
ALTER TABLE audit_logs ADD COLUMN archived_by TEXT DEFAULT NULL;

-- Ensure entity_type column exists (may be aliased from resource)
-- SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we handle via try-catch in PHP

-- Add composite indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created ON audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_archived ON audit_logs(archived_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_archived ON audit_logs(company_id, archived_at);

-- Index for filtering non-archived logs (most common query)
CREATE INDEX IF NOT EXISTS idx_audit_logs_active ON audit_logs(company_id, archived_at, created_at DESC);


-- ============================================
-- Migration: 044_render_queue_system.sql
-- ============================================

-- Migration 044: Render Queue System (Phase 2)
-- Multi-device render için queue, priority ve retry mekanizması

-- ============================================
-- 1. RENDER QUEUE TABLOSU
-- ============================================
CREATE TABLE IF NOT EXISTS render_queue (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,

    -- Job tanımı
    job_type TEXT NOT NULL DEFAULT 'render_send',  -- render_send, bulk_send, scheduled_send
    priority TEXT NOT NULL DEFAULT 'normal',        -- urgent, high, normal, low

    -- Hedef bilgileri
    template_id TEXT,
    product_id TEXT,
    device_ids TEXT,           -- JSON array of device IDs
    device_count INTEGER DEFAULT 0,

    -- Render parametreleri
    render_params TEXT,        -- JSON: width, height, locale, etc.

    -- Durum takibi
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed, cancelled
    progress INTEGER DEFAULT 0,              -- 0-100 yüzde

    -- İşlenen cihaz sayıları
    devices_total INTEGER DEFAULT 0,
    devices_completed INTEGER DEFAULT 0,
    devices_failed INTEGER DEFAULT 0,
    devices_skipped INTEGER DEFAULT 0,       -- Delta update ile atlanan

    -- Retry mekanizması
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_retry_at TEXT,
    next_retry_at TEXT,

    -- Sonuç ve hata
    result TEXT,               -- JSON: başarılı cihazlar, süreler vs.
    error_message TEXT,
    failed_devices TEXT,       -- JSON array of failed device details

    -- Zamanlama
    scheduled_at TEXT,         -- NULL = hemen, değilse zamanlanmış
    started_at TEXT,
    completed_at TEXT,

    -- Meta
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (template_id) REFERENCES templates(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- 2. QUEUE ITEM DETAYLARI (Her cihaz için)
-- ============================================
CREATE TABLE IF NOT EXISTS render_queue_items (
    id TEXT PRIMARY KEY,
    queue_id TEXT NOT NULL,
    device_id TEXT NOT NULL,

    -- Durum
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed, skipped

    -- Retry
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    error_type TEXT,           -- 'timeout', 'connection', 'device_offline', 'upload_failed', 'unknown'
    next_retry_at TEXT,        -- Sonraki retry zamanı

    -- Delta update
    skipped_reason TEXT,       -- 'same_content', 'device_offline', etc.
    file_md5 TEXT,             -- Gönderilen dosyanın MD5'i

    -- Zamanlama
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,       -- İşlem süresi (milisaniye)

    created_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (queue_id) REFERENCES render_queue(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- ============================================
-- 3. PERFORMANS İNDEKSLERİ
-- ============================================

-- Queue ana sorguları için
CREATE INDEX IF NOT EXISTS idx_render_queue_status ON render_queue(status);
CREATE INDEX IF NOT EXISTS idx_render_queue_priority ON render_queue(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_render_queue_company ON render_queue(company_id, status);
CREATE INDEX IF NOT EXISTS idx_render_queue_scheduled ON render_queue(scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_render_queue_retry ON render_queue(next_retry_at, status);

-- Worker için: pending jobs by priority
CREATE INDEX IF NOT EXISTS idx_render_queue_worker ON render_queue(status, priority, scheduled_at, created_at);

-- Queue items için
CREATE INDEX IF NOT EXISTS idx_queue_items_queue ON render_queue_items(queue_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_items_device ON render_queue_items(device_id);

-- ============================================
-- 4. PRİORİTY WEIGHT TABLOSU (Opsiyonel)
-- ============================================
CREATE TABLE IF NOT EXISTS render_priority_weights (
    priority TEXT PRIMARY KEY,
    weight INTEGER NOT NULL,
    max_concurrent INTEGER DEFAULT 10,
    timeout_seconds INTEGER DEFAULT 300,
    description TEXT
);

-- Varsayılan priority değerleri
INSERT OR IGNORE INTO render_priority_weights (priority, weight, max_concurrent, timeout_seconds, description) VALUES
    ('urgent', 100, 20, 120, 'Acil işler - anında işlenir'),
    ('high', 75, 15, 180, 'Yüksek öncelik - hızlı işlenir'),
    ('normal', 50, 10, 300, 'Normal öncelik - standart işlem'),
    ('low', 25, 5, 600, 'Düşük öncelik - boşta işlenir');

-- ============================================
-- 5. RETRY POLICY TABLOSU
-- ============================================
CREATE TABLE IF NOT EXISTS render_retry_policies (
    id TEXT PRIMARY KEY,
    error_type TEXT NOT NULL,           -- 'timeout', 'connection', 'device_offline', 'upload_failed'
    max_retries INTEGER DEFAULT 3,
    base_delay_seconds INTEGER DEFAULT 5,
    max_delay_seconds INTEGER DEFAULT 300,
    backoff_multiplier REAL DEFAULT 2.0,
    description TEXT
);

-- Varsayılan retry policy'ler
INSERT OR IGNORE INTO render_retry_policies (id, error_type, max_retries, base_delay_seconds, max_delay_seconds, backoff_multiplier, description) VALUES
    ('timeout', 'timeout', 3, 10, 120, 2.0, 'Zaman aşımı - hızlı retry'),
    ('connection', 'connection', 5, 5, 300, 2.0, 'Bağlantı hatası - orta retry'),
    ('device_offline', 'device_offline', 10, 30, 3600, 2.0, 'Cihaz çevrimdışı - yavaş retry'),
    ('upload_failed', 'upload_failed', 3, 5, 60, 1.5, 'Yükleme hatası - hızlı retry'),
    ('unknown', 'unknown', 2, 15, 120, 2.0, 'Bilinmeyen hata - temkinli retry');


-- ============================================
-- Migration: 045_add_product_assignments.sql
-- ============================================

-- Omnex Display Hub - Product Device/Template Assignments
-- Ürünlere cihaz ve şablon atama alanları

-- Ürüne atanmış cihaz
ALTER TABLE products ADD COLUMN assigned_device_id TEXT REFERENCES devices(id) ON DELETE SET NULL;

-- Ürüne atanmış şablon
ALTER TABLE products ADD COLUMN assigned_template_id TEXT REFERENCES templates(id) ON DELETE SET NULL;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_products_assigned_device ON products(assigned_device_id);
CREATE INDEX IF NOT EXISTS idx_products_assigned_template ON products(assigned_template_id);


-- ============================================
-- Migration: 045_add_rendered_image_to_queue.sql
-- ============================================

-- Migration 045: Add rendered_image_path to render_queue
-- Toplu gönderimde frontend pre-render desteği için

-- render_queue tablosuna rendered_image_path alanı ekle
ALTER TABLE render_queue ADD COLUMN rendered_image_path TEXT;

-- render_queue_items tablosuna da individual rendered image desteği
ALTER TABLE render_queue_items ADD COLUMN rendered_image_path TEXT;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_render_queue_rendered_image ON render_queue(rendered_image_path);


-- ============================================
-- Migration: 045_create_label_sizes.sql
-- ============================================

-- Migration: 045_create_label_sizes.sql
-- Etiket boyutları tablosu

CREATE TABLE IF NOT EXISTS label_sizes (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    name TEXT NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    unit TEXT DEFAULT 'mm' CHECK(unit IN ('mm', 'inch')),
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_label_sizes_company ON label_sizes(company_id);
CREATE INDEX IF NOT EXISTS idx_label_sizes_active ON label_sizes(is_active);
CREATE INDEX IF NOT EXISTS idx_label_sizes_sort ON label_sizes(sort_order);

-- Varsayılan etiket boyutları (mm cinsinden)
-- company_id NULL olanlar global/varsayılan boyutlardır
INSERT OR IGNORE INTO label_sizes (id, company_id, name, width, height, unit, is_default, sort_order) VALUES
('ls-001', NULL, '94x14 mm', 94, 14, 'mm', 0, 1),
('ls-002', NULL, '100x100 mm', 100, 100, 'mm', 0, 2),
('ls-003', NULL, '50x30 mm', 50, 30, 'mm', 0, 3),
('ls-004', NULL, '80x40 mm', 80, 40, 'mm', 0, 4),
('ls-005', NULL, '40x80 mm', 40, 80, 'mm', 0, 5),
('ls-006', NULL, '20x100 mm', 20, 100, 'mm', 0, 6),
('ls-007', NULL, '80x58 mm', 80, 58, 'mm', 0, 7),
('ls-008', NULL, '35x75 mm', 35, 75, 'mm', 0, 8),
('ls-009', NULL, '75x35 mm', 75, 35, 'mm', 0, 9),
('ls-010', NULL, '60x30 mm', 60, 30, 'mm', 0, 10),
('ls-011', NULL, '60x150 mm', 60, 150, 'mm', 0, 11),
('ls-012', NULL, '35x55 mm', 35, 55, 'mm', 0, 12),
('ls-013', NULL, '150x150 mm', 150, 150, 'mm', 0, 13),
('ls-014', NULL, '120x160 mm', 120, 160, 'mm', 0, 14),
('ls-015', NULL, '80x130 mm', 80, 130, 'mm', 0, 15),
('ls-016', NULL, '35x45 mm', 35, 45, 'mm', 0, 16),
('ls-017', NULL, '50x100 mm', 50, 100, 'mm', 0, 17),
('ls-018', NULL, '38x100 mm', 38, 100, 'mm', 0, 18),
('ls-019', NULL, '38x70 mm', 38, 70, 'mm', 0, 19),
('ls-020', NULL, '30x20 mm', 30, 20, 'mm', 0, 20),
('ls-021', NULL, '30x50 mm', 30, 50, 'mm', 0, 21),
('ls-022', NULL, '34x54 mm', 34, 54, 'mm', 0, 22),
('ls-023', NULL, '60x327 mm', 60, 327, 'mm', 0, 23),
('ls-024', NULL, '150x210 mm', 150, 210, 'mm', 0, 24),
('ls-025', NULL, '39x60 mm', 39, 60, 'mm', 0, 25),
('ls-026', NULL, '12x45 mm', 12, 45, 'mm', 0, 26),
('ls-027', NULL, '70x90 mm', 70, 90, 'mm', 0, 27),
('ls-028', NULL, '72x25 mm', 72, 25, 'mm', 0, 28),
('ls-029', NULL, '100x37 mm', 100, 37, 'mm', 0, 29),
('ls-030', NULL, '58x40 mm', 58, 40, 'mm', 0, 30),
('ls-031', NULL, '20x40 mm', 20, 40, 'mm', 0, 31),
('ls-032', NULL, '40x15 mm', 40, 15, 'mm', 0, 32),
('ls-033', NULL, '40x20 mm', 40, 20, 'mm', 0, 33),
('ls-034', NULL, '90x153 mm', 90, 153, 'mm', 0, 34),
('ls-035', NULL, '58x65 mm', 58, 65, 'mm', 0, 35),
('ls-036', NULL, '70x55 mm', 70, 55, 'mm', 0, 36),
('ls-037', NULL, '40x66 mm', 40, 66, 'mm', 0, 37),
('ls-038', NULL, '60x15 mm', 60, 15, 'mm', 0, 38),
('ls-039', NULL, '40x30 mm', 40, 30, 'mm', 0, 39),
('ls-040', NULL, '30x15 mm', 30, 15, 'mm', 0, 40),
('ls-041', NULL, '100x140 mm', 100, 140, 'mm', 0, 41),
('ls-042', NULL, '50x75 mm', 50, 75, 'mm', 0, 42),
('ls-043', NULL, '100x75 mm', 100, 75, 'mm', 0, 43),
('ls-044', NULL, '100x120 mm', 100, 120, 'mm', 0, 44),
('ls-045', NULL, '35x70 mm', 35, 70, 'mm', 0, 45),
('ls-046', NULL, '80x100 mm', 80, 100, 'mm', 0, 46),
('ls-047', NULL, '60x80 mm', 60, 80, 'mm', 0, 47),
('ls-048', NULL, '133x100 mm', 133, 100, 'mm', 0, 48),
('ls-049', NULL, '100x150 mm', 100, 150, 'mm', 0, 49),
('ls-050', NULL, '57x70 mm', 57, 70, 'mm', 0, 50),
('ls-051', NULL, '38x65 mm', 38, 65, 'mm', 0, 51),
('ls-052', NULL, '30x30 mm', 30, 30, 'mm', 0, 52),
('ls-053', NULL, '55x300 mm', 55, 300, 'mm', 0, 53),
('ls-054', NULL, '100x76 mm', 100, 76, 'mm', 0, 54),
('ls-055', NULL, '30x70 mm', 30, 70, 'mm', 0, 55),
('ls-056', NULL, '84x12 mm', 84, 12, 'mm', 0, 56),
('ls-057', NULL, '75x50 mm', 75, 50, 'mm', 0, 57),
('ls-058', NULL, '99x139 mm', 99, 139, 'mm', 0, 58),
('ls-059', NULL, '25x50 mm', 25, 50, 'mm', 0, 59),
('ls-060', NULL, '57x90 mm', 57, 90, 'mm', 0, 60),
('ls-061', NULL, '45x57 mm', 45, 57, 'mm', 0, 61);


-- ============================================
-- Migration: 046_render_cache_system.sql
-- ============================================

-- Migration 046: Render Cache System
-- Ürün değişikliklerinde arka planda render ve cache sistemi

-- 1. render_cache tablosu - Hazır renderları saklar
CREATE TABLE IF NOT EXISTS render_cache (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    template_id TEXT NOT NULL,

    -- Cache key bileşenleri
    cache_key TEXT NOT NULL,              -- MD5(product_id + template_id + product_version)
    product_version INTEGER DEFAULT 1,     -- Ürün versiyon numarası
    template_version INTEGER DEFAULT 1,    -- Şablon versiyon numarası

    -- Render sonucu
    image_path TEXT,                       -- storage/renders/cache/{company}/{hash}.png
    image_md5 TEXT,                        -- Görsel MD5 hash
    image_size INTEGER,                    -- Dosya boyutu (bytes)

    -- Durum
    status TEXT DEFAULT 'pending',         -- pending, rendering, ready, failed, stale
    error_message TEXT,

    -- Zamanlar
    rendered_at TEXT,                      -- Son render zamanı
    expires_at TEXT,                       -- Cache geçerlilik süresi
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    UNIQUE(company_id, product_id, template_id)
);

-- 2. render_jobs tablosu - Bekleyen render işleri
CREATE TABLE IF NOT EXISTS render_jobs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    template_id TEXT,                      -- NULL ise tüm şablonlar için

    -- İş bilgileri
    job_type TEXT DEFAULT 'product_update', -- product_update, template_update, import, manual, bulk
    priority TEXT DEFAULT 'normal',         -- urgent, high, normal, low
    source TEXT,                            -- api, import, erp, manual

    -- Durum
    status TEXT DEFAULT 'pending',          -- pending, processing, completed, failed
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,

    -- Batch bilgisi (toplu işlemler için)
    batch_id TEXT,                          -- Aynı batch'teki işleri gruplar
    batch_total INTEGER,                    -- Batch'teki toplam iş
    batch_index INTEGER,                    -- Bu işin sırası

    -- Zamanlar
    scheduled_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),

    -- İşi oluşturan
    created_by TEXT
);

-- 3. products tablosuna version alanı ekle
ALTER TABLE products ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN last_rendered_at TEXT;
ALTER TABLE products ADD COLUMN render_status TEXT DEFAULT 'pending'; -- pending, rendering, ready, failed

-- 4. templates tablosuna version alanı ekle
ALTER TABLE templates ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE templates ADD COLUMN last_modified_at TEXT;

-- 5. İndeksler
CREATE INDEX IF NOT EXISTS idx_render_cache_company ON render_cache(company_id);
CREATE INDEX IF NOT EXISTS idx_render_cache_product ON render_cache(product_id);
CREATE INDEX IF NOT EXISTS idx_render_cache_template ON render_cache(template_id);
CREATE INDEX IF NOT EXISTS idx_render_cache_status ON render_cache(status);
CREATE INDEX IF NOT EXISTS idx_render_cache_key ON render_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_render_cache_lookup ON render_cache(company_id, product_id, template_id);

CREATE INDEX IF NOT EXISTS idx_render_jobs_company ON render_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs(status);
CREATE INDEX IF NOT EXISTS idx_render_jobs_priority ON render_jobs(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_render_jobs_batch ON render_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_pending ON render_jobs(status, priority, created_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_products_version ON products(version);
CREATE INDEX IF NOT EXISTS idx_products_render_status ON products(render_status);


