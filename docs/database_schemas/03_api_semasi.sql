-- API Dosyalarından Çıkarılan Şema
-- Oluşturulma Tarihi: 2026-01-24 22:56:17
-- Analiz Edilen API Dosyası: 189

-- API Dosyalarında Kullanılan Tablolar:
-- - audit_logs
-- - categories
-- - companies
-- - device_alerts
-- - device_commands
-- - device_content_assignments
-- - device_group_members
-- - device_groups
-- - device_heartbeats
-- - device_logs
-- - device_sync_requests
-- - device_tokens
-- - devices
-- - firmware_updates
-- - gateway_commands
-- - gateway_devices
-- - gateways
-- - hanshow_esls
-- - hanshow_firmwares
-- - hanshow_settings
-- - label_sizes
-- - layout_configs
-- - license_plans
-- - licenses
-- - media
-- - media_folders
-- - menu_items
-- - notification_recipients
-- - notifications
-- - payment_transactions
-- - permissions
-- - playlist_items
-- - playlists
-- - price_history
-- - production_types
-- - products
-- - render_priority_weights
-- - render_queue
-- - render_queue_items
-- - render_retry_policies
-- - schedule_devices
-- - schedules
-- - sessions
-- - settings
-- - templates
-- - users

-- ============================================
-- Tablo: audit_logs
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    archived_at TEXT DEFAULT NULL,
    archived_by TEXT DEFAULT NULL
);

-- API'de kullanılan kolonlar:
--   ✓ action
--   ✓ entity_type
--   ✓ last_name
--   ✓ user_id

-- ============================================
-- Tablo: categories
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    slug TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ company_id
--   ✓ created_at
--   ✓ description
--   ✓ id
--   ✓ name
--   ✓ parent_id
--   ✓ slug
--   ✓ sort_order
--   ✓ updated_at

-- ============================================
-- Tablo: companies
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    domain TEXT,
    subdomain TEXT,
    logo TEXT,
    pwa_icon TEXT,
    favicon TEXT,
    primary_color TEXT DEFAULT '''#228be6''',
    secondary_color TEXT DEFAULT '''#495057''',
    status TEXT DEFAULT '''active''',
    settings TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')',
    code TEXT,
    email TEXT,
    phone TEXT,
    address TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ address
--   ✓ code
--   ✓ created_at
--   ✓ domain
--   ✓ email
--   ✓ favicon
--   ✓ id
--   ✓ logo
--   ✓ name
--   ✓ phone
--   ✓ primary_color
--   ✓ pwa_icon
--   ✓ secondary_color
--   ✓ settings
--   ✓ slug
--   ✓ status
--   ✓ subdomain
--   ✓ updated_at

-- ============================================
-- Tablo: device_alerts
-- ============================================
CREATE TABLE IF NOT EXISTS device_alerts (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT '''medium''',
    title TEXT NOT NULL,
    message TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ alert_type
--   ✓ created_at
--   ✓ device_id
--   ✓ id
--   ✓ message
--   ✓ metadata
--   ✓ severity
--   ✓ title

-- ============================================
-- Tablo: device_commands
-- ============================================
CREATE TABLE IF NOT EXISTS device_commands (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    command TEXT NOT NULL,
    parameters TEXT,
    status TEXT DEFAULT '''pending''',
    priority INTEGER DEFAULT 0,
    created_by TEXT,
    executed_at TEXT,
    result TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ command
--   ✓ created_at
--   ✓ created_by
--   ✓ device_id
--   ✓ id
--   ✓ parameters
--   ✓ priority
--   ✓ status

-- ============================================
-- Tablo: device_content_assignments
-- ============================================
CREATE TABLE IF NOT EXISTS device_content_assignments (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    status TEXT DEFAULT '''active''',
    created_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ content_id
--   ✓ content_type
--   ✓ created_at
--   ✓ device_id
--   ✓ id
--   ✓ ip_address
--   ✓ name
--   ✓ status
--   ✓ updated_at

-- ============================================
-- Tablo: device_group_members
-- ============================================
CREATE TABLE IF NOT EXISTS device_group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    created_at DATETIME DEFAULT 'CURRENT_TIMESTAMP'
);

-- API'de kullanılan kolonlar:
--   ✓ device_id

-- ============================================
-- Tablo: device_groups
-- ============================================
CREATE TABLE IF NOT EXISTS device_groups (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    store_name TEXT,
    store_code TEXT,
    device_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ company_id
--   ✓ created_at
--   ✓ description
--   ✓ device_count
--   ✓ id
--   ✓ metadata
--   ✓ name
--   ✓ parent_id
--   ✓ store_code
--   ✓ store_name
--   ✓ updated_at

-- ============================================
-- Tablo: device_heartbeats
-- ============================================
CREATE TABLE IF NOT EXISTS device_heartbeats (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    status TEXT,
    current_item TEXT,
    battery_level INTEGER,
    signal_strength INTEGER,
    ip_address TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    memory_usage INTEGER,
    cpu_usage INTEGER,
    storage_free INTEGER,
    temperature REAL,
    uptime INTEGER,
    errors TEXT,
    metadata TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ battery_level
--   ✓ cpu_usage
--   ✓ created_at
--   ✓ current_item
--   ✓ device_id
--   ✓ errors
--   ✓ id
--   ✓ ip_address
--   ✓ memory_usage
--   ✓ metadata
--   ✓ signal_strength
--   ✓ status
--   ✓ storage_free
--   ✓ temperature
--   ✓ uptime

-- ============================================
-- Tablo: device_logs
-- ============================================
CREATE TABLE IF NOT EXISTS device_logs (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    action TEXT NOT NULL,
    content_type TEXT,
    content_id TEXT,
    status TEXT NOT NULL,
    request_data TEXT,
    response_data TEXT,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ action
--   ✓ content_id
--   ✓ content_type
--   ✓ created_at
--   ✓ device_id
--   ✓ duration_ms
--   ✓ error_message
--   ✓ id
--   ✓ request_data
--   ✓ response_data
--   ✓ status

-- ============================================
-- Tablo: device_sync_requests
-- ============================================
CREATE TABLE IF NOT EXISTS device_sync_requests (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    sync_code TEXT,
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
    status TEXT DEFAULT '''pending''',
    request_count INTEGER DEFAULT 1,
    last_request_at TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')',
    expires_at TEXT,
    approved_by TEXT,
    approved_at TEXT,
    rejection_reason TEXT,
    device_id TEXT,
    device_type TEXT,
    brand TEXT,
    model TEXT,
    os_version TEXT,
    browser_version TEXT,
    screen_diagonal REAL,
    screen_width INTEGER,
    screen_height INTEGER,
    pixel_ratio REAL,
    color_depth INTEGER,
    cpu_cores INTEGER,
    device_memory REAL,
    touch_support INTEGER DEFAULT 0,
    connection_type TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ approved_at
--   ✓ approved_by
--   ✓ brand
--   ✓ browser
--   ✓ browser_version
--   ✓ color_depth
--   ✓ company_id
--   ✓ connection_type
--   ✓ cpu_cores
--   ✓ created_at
--   ✓ device_id
--   ✓ device_memory
--   ✓ device_type
--   ✓ expires_at
--   ✓ fingerprint
--   ✓ firmware
--   ✓ id
--   ✓ ip_address
--   ✓ language
--   ✓ last_request_at
--   ✓ mac_address
--   ✓ manufacturer
--   ✓ model
--   ✓ os
--   ✓ os_version
--   ✓ pixel_ratio
--   ✓ rejection_reason
--   ✓ request_count
--   ✓ resolution
--   ✓ screen_diagonal
--   ✓ screen_height
--   ✓ screen_resolution
--   ✓ screen_type
--   ✓ screen_width
--   ✓ serial_number
--   ✓ status
--   ✓ store_code
--   ✓ sync_code
--   ✓ timezone
--   ✓ touch_support
--   ✓ updated_at
--   ✓ user_agent

-- ============================================
-- Tablo: device_tokens
-- ============================================
CREATE TABLE IF NOT EXISTS device_tokens (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    token TEXT NOT NULL,
    token_type TEXT DEFAULT '''device''',
    created_at TEXT DEFAULT 'datetime(''now'')',
    expires_at TEXT,
    last_used_at TEXT,
    is_revoked INTEGER DEFAULT 0,
    revoked_at TEXT,
    revoked_reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    token_hash TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ token

-- ============================================
-- Tablo: devices
-- ============================================
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    group_id TEXT,
    store_id TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    mac_address TEXT,
    ip_address TEXT,
    device_id TEXT,
    model TEXT,
    manufacturer TEXT,
    firmware_version TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    orientation TEXT DEFAULT '''landscape''',
    current_template_id TEXT,
    current_content TEXT,
    last_sync TEXT,
    last_online TEXT,
    last_seen TEXT,
    status TEXT DEFAULT '''offline''',
    battery_level INTEGER,
    signal_strength INTEGER,
    error_message TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')',
    device_token TEXT,
    token_expires_at TEXT,
    sync_code TEXT,
    sync_code_expires_at TEXT,
    fingerprint TEXT,
    os_info TEXT,
    browser_info TEXT,
    screen_resolution TEXT,
    timezone TEXT,
    language TEXT,
    last_heartbeat TEXT,
    approval_status TEXT DEFAULT '''approved''',
    approved_by TEXT,
    approved_at TEXT,
    location TEXT,
    device_type_detail TEXT,
    brand TEXT,
    model_name TEXT,
    os_version TEXT,
    screen_diagonal REAL,
    cpu_cores INTEGER,
    device_memory REAL
);

-- API'de kullanılan kolonlar:
--   ✓ approval_status
--   ✓ approved_at
--   ✓ approved_by
--   ✓ battery_level
--   ✓ brand
--   ✓ browser_info
--   ✓ company_id
--   ✓ cpu_cores
--   ✓ created_at
--   ✓ current_content
--   ✓ current_template_id
--   ✓ device_id
--   ✓ device_memory
--   ✓ device_token
--   ✓ device_type_detail
--   ✓ error_message
--   ✓ fingerprint
--   ✓ firmware_version
--   ✓ group_id
--   ✓ id
--   ✓ ip_address
--   ✓ language
--   ✓ last_heartbeat
--   ✓ last_online
--   ✓ last_seen
--   ✓ last_sync
--   ✓ location
--   ✓ mac_address
--   ✓ manufacturer
--   ✓ metadata
--   ✓ model
--   ✓ model_name
--   ✓ name
--   ✓ orientation
--   ✓ os_info
--   ✓ os_version
--   ✓ screen_diagonal
--   ✓ screen_height
--   ✓ screen_resolution
--   ✓ screen_width
--   ✓ signal_strength
--   ✓ status
--   ✓ store_code
--   ✓ store_id
--   ✓ store_name
--   ✓ sync_code
--   ✓ sync_code_expires_at
--   ✓ timezone
--   ✓ token_expires_at
--   ✓ type
--   ✓ updated_at

-- ============================================
-- Tablo: firmware_updates
-- ============================================
CREATE TABLE IF NOT EXISTS firmware_updates (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    device_type TEXT NOT NULL DEFAULT '"esl"',
    version TEXT NOT NULL,
    url TEXT NOT NULL,
    notes TEXT,
    min_version TEXT,
    max_version TEXT,
    file_size INTEGER,
    checksum TEXT,
    is_mandatory INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    released_at TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT 'CURRENT_TIMESTAMP',
    updated_at TEXT DEFAULT 'CURRENT_TIMESTAMP'
);

-- API'de kullanılan kolonlar:
--   ✓ notes
--   ✓ url
--   ✓ version

-- ============================================
-- Tablo: gateway_commands
-- ============================================
CREATE TABLE IF NOT EXISTS gateway_commands (
    id TEXT PRIMARY KEY,
    gateway_id TEXT NOT NULL,
    device_id TEXT,
    command TEXT NOT NULL,
    parameters TEXT,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT '''pending''',
    result TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    sent_at TEXT,
    completed_at TEXT,
    expires_at TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ command
--   ✓ completed_at
--   ✓ created_at
--   ✓ device_id
--   ✓ error_message
--   ✓ expires_at
--   ✓ gateway_id
--   ✓ id
--   ✓ parameters
--   ✓ priority
--   ✓ result
--   ✓ sent_at
--   ✓ status

-- ============================================
-- Tablo: gateway_devices
-- ============================================
CREATE TABLE IF NOT EXISTS gateway_devices (
    id TEXT PRIMARY KEY,
    gateway_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    local_ip TEXT NOT NULL,
    status TEXT DEFAULT '''active''',
    last_seen TEXT,
    last_error TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ created_at
--   ✓ device_id
--   ✓ gateway_id
--   ✓ id
--   ✓ last_error
--   ✓ last_seen
--   ✓ local_ip
--   ✓ status
--   ✓ updated_at

-- ============================================
-- Tablo: gateways
-- ============================================
CREATE TABLE IF NOT EXISTS gateways (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    api_key TEXT NOT NULL,
    api_secret TEXT NOT NULL,
    local_ip TEXT,
    public_ip TEXT,
    hostname TEXT,
    status TEXT DEFAULT '''offline''',
    last_heartbeat TEXT,
    last_error TEXT,
    config TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ api_key
--   ✓ api_secret
--   ✓ company_id
--   ✓ config
--   ✓ created_at
--   ✓ description
--   ✓ hostname
--   ✓ id
--   ✓ last_error
--   ✓ last_heartbeat
--   ✓ local_ip
--   ✓ name
--   ✓ public_ip
--   ✓ status
--   ✓ updated_at

-- ============================================
-- Tablo: hanshow_esls
-- ============================================
CREATE TABLE IF NOT EXISTS hanshow_esls (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    esl_id TEXT NOT NULL,
    firmware_id INTEGER,
    model_name TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    screen_color TEXT,
    screen_type TEXT,
    max_pages INTEGER DEFAULT 1,
    has_led BOOLEAN DEFAULT 0,
    has_magnet BOOLEAN DEFAULT 0,
    current_template_id TEXT,
    current_product_id TEXT,
    last_sync_at TEXT,
    last_heartbeat_at TEXT,
    status TEXT DEFAULT '''unknown''',
    battery_level INTEGER,
    ap_mac TEXT,
    sales_no TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ ap_mac
--   ✓ battery_level
--   ✓ company_id
--   ✓ created_at
--   ✓ current_product_id
--   ✓ current_template_id
--   ✓ esl_id
--   ✓ firmware_id
--   ✓ has_led
--   ✓ has_magnet
--   ✓ id
--   ✓ last_heartbeat_at
--   ✓ last_sync_at
--   ✓ max_pages
--   ✓ model_name
--   ✓ sales_no
--   ✓ screen_color
--   ✓ screen_height
--   ✓ screen_type
--   ✓ screen_width
--   ✓ status
--   ✓ updated_at

-- ============================================
-- Tablo: hanshow_firmwares
-- ============================================
CREATE TABLE IF NOT EXISTS hanshow_firmwares (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    magnet BOOLEAN DEFAULT 0,
    led BOOLEAN DEFAULT 0,
    mpd BOOLEAN DEFAULT 0,
    generation INTEGER,
    heartbeat BOOLEAN DEFAULT 1,
    direction INTEGER DEFAULT 0,
    battery TEXT,
    freezer BOOLEAN DEFAULT 0,
    dpi INTEGER,
    ic TEXT,
    display_mode TEXT,
    screen_type TEXT,
    resolution_x INTEGER,
    resolution_y INTEGER,
    screen_color TEXT,
    screen_size TEXT,
    refresh_time INTEGER,
    flash_size INTEGER,
    max_package INTEGER,
    osd_version INTEGER,
    max_page_num INTEGER,
    esl_model TEXT,
    mix_mode BOOLEAN DEFAULT 0,
    screen_model TEXT,
    cached_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ battery
--   ✓ cached_at
--   ✓ description
--   ✓ direction
--   ✓ display_mode
--   ✓ dpi
--   ✓ esl_model
--   ✓ flash_size
--   ✓ freezer
--   ✓ generation
--   ✓ heartbeat
--   ✓ ic
--   ✓ id
--   ✓ led
--   ✓ magnet
--   ✓ max_package
--   ✓ max_page_num
--   ✓ mix_mode
--   ✓ mpd
--   ✓ name
--   ✓ osd_version
--   ✓ refresh_time
--   ✓ resolution_x
--   ✓ resolution_y
--   ✓ screen_color
--   ✓ screen_model
--   ✓ screen_size
--   ✓ screen_type

-- ============================================
-- Tablo: hanshow_settings
-- ============================================
CREATE TABLE IF NOT EXISTS hanshow_settings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    eslworking_url TEXT DEFAULT '''http://127.0.0.1:9000''',
    user_id TEXT DEFAULT '''default''',
    callback_url TEXT,
    default_priority INTEGER DEFAULT 10,
    sync_interval INTEGER DEFAULT 60,
    auto_retry BOOLEAN DEFAULT 1,
    max_retry_attempts INTEGER DEFAULT 3,
    led_flash_on_update BOOLEAN DEFAULT 1,
    led_color TEXT DEFAULT '''green''',
    enabled BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ auto_retry
--   ✓ callback_url
--   ✓ company_id
--   ✓ created_at
--   ✓ default_priority
--   ✓ enabled
--   ✓ eslworking_url
--   ✓ id
--   ✓ led_color
--   ✓ led_flash_on_update
--   ✓ max_retry_attempts
--   ✓ sync_interval
--   ✓ updated_at
--   ✓ user_id

-- ============================================
-- Tablo: label_sizes
-- ============================================
CREATE TABLE IF NOT EXISTS label_sizes (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    name TEXT NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    unit TEXT DEFAULT '''mm''',
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ company_id
--   ✓ created_at
--   ✓ height
--   ✓ id
--   ✓ is_active
--   ✓ is_default
--   ✓ name
--   ✓ sort_order
--   ✓ unit
--   ✓ updated_at
--   ✓ width

-- ============================================
-- Tablo: layout_configs
-- ============================================
CREATE TABLE IF NOT EXISTS layout_configs (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL DEFAULT '''default''',
    scope_id TEXT,
    config TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ config
--   ✓ created_at
--   ✓ id
--   ✓ scope
--   ✓ scope_id
--   ✓ updated_at

-- ============================================
-- Tablo: license_plans
-- ============================================
CREATE TABLE IF NOT EXISTS license_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT,
    description TEXT,
    plan_type TEXT NOT NULL DEFAULT '''subscription''',
    duration_months INTEGER DEFAULT 12,
    price REAL NOT NULL,
    currency TEXT DEFAULT '''TRY''',
    max_users INTEGER DEFAULT 5,
    max_devices INTEGER DEFAULT 10,
    max_products INTEGER DEFAULT 1000,
    max_templates INTEGER DEFAULT 50,
    features TEXT,
    is_popular INTEGER DEFAULT 0,
    is_enterprise INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT '''active''',
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')',
    is_active INTEGER DEFAULT 1
);

-- API'de kullanılan kolonlar:
--   ✓ created_at
--   ✓ currency
--   ✓ description
--   ✓ duration_months
--   ✓ features
--   ✓ id
--   ✓ is_active
--   ✓ is_enterprise
--   ✓ is_popular
--   ✓ max_devices
--   ✓ max_products
--   ✓ max_templates
--   ✓ max_users
--   ✓ name
--   ✓ plan_type
--   ✓ price
--   ✓ slug
--   ✓ sort_order
--   ✓ status
--   ✓ updated_at

-- ============================================
-- Tablo: licenses
-- ============================================
CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    license_key TEXT,
    type TEXT DEFAULT '''standard''',
    max_devices INTEGER DEFAULT 10,
    features TEXT,
    valid_from TEXT,
    valid_until TEXT,
    status TEXT DEFAULT '''active''',
    created_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ company_id
--   ✓ created_at
--   ✓ features
--   ✓ id
--   ✓ license_key
--   ✓ max_devices
--   ✓ name
--   ✓ status
--   ✓ type
--   ✓ valid_from
--   ✓ valid_until

-- ============================================
-- Tablo: media
-- ============================================
CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    folder_id TEXT,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
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
    source TEXT DEFAULT '''upload''',
    source_url TEXT,
    status TEXT DEFAULT '''active''',
    uploaded_by TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ alt_text
--   ✓ company_id
--   ✓ created_at
--   ✓ description
--   ✓ duration
--   ✓ file_path
--   ✓ file_size
--   ✓ file_type
--   ✓ filename
--   ✓ folder_id
--   ✓ height
--   ✓ id
--   ✓ metadata
--   ✓ mime_type
--   ✓ name
--   ✓ original_name
--   ✓ path
--   ✓ source
--   ✓ source_url
--   ✓ status
--   ✓ tags
--   ✓ thumbnail
--   ✓ updated_at
--   ✓ uploaded_by
--   ✓ width

-- ============================================
-- Tablo: media_folders
-- ============================================
CREATE TABLE IF NOT EXISTS media_folders (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    parent_id TEXT,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ company_id
--   ✓ created_at
--   ✓ id
--   ✓ name
--   ✓ parent_id
--   ✓ path
--   ✓ updated_at

-- ============================================
-- Tablo: menu_items
-- ============================================
CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    location TEXT DEFAULT '''sidebar''',
    parent_id TEXT,
    label TEXT,
    href TEXT,
    icon TEXT,
    order_index INTEGER DEFAULT 0,
    roles TEXT DEFAULT '''["SuperAdmin","Admin","Editor","Viewer"]''',
    visible INTEGER DEFAULT 1,
    created_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ company_id
--   ✓ created_at
--   ✓ href
--   ✓ icon
--   ✓ id
--   ✓ label
--   ✓ location
--   ✓ order_index
--   ✓ parent_id
--   ✓ roles
--   ✓ visible

-- ============================================
-- Tablo: notification_recipients
-- ============================================
CREATE TABLE IF NOT EXISTS notification_recipients (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT '''sent''',
    read_at TEXT,
    archived_at TEXT,
    deleted_at TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ id
--   ✓ status

-- ============================================
-- Tablo: notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT '''info''',
    target_type TEXT DEFAULT '''all''',
    target_id TEXT,
    action_url TEXT,
    priority TEXT DEFAULT '''normal''',
    created_by TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    icon TEXT,
    link TEXT,
    channels TEXT DEFAULT '''["web"]''',
    expires_at TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ action_url
--   ✓ channels
--   ✓ company_id
--   ✓ created_at
--   ✓ created_by
--   ✓ expires_at
--   ✓ icon
--   ✓ id
--   ✓ link
--   ✓ message
--   ✓ priority
--   ✓ target_id
--   ✓ target_type
--   ✓ title
--   ✓ type

-- ============================================
-- Tablo: payment_transactions
-- ============================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    user_id TEXT,
    license_id TEXT,
    transaction_type TEXT NOT NULL DEFAULT '''license_purchase''',
    amount REAL NOT NULL,
    currency TEXT DEFAULT '''TRY''',
    status TEXT DEFAULT '''pending''',
    provider TEXT NOT NULL DEFAULT '''iyzico''',
    provider_transaction_id TEXT,
    provider_payment_id TEXT,
    basket_id TEXT,
    conversation_id TEXT,
    card_type TEXT,
    card_association TEXT,
    card_family TEXT,
    card_last_four TEXT,
    installment INTEGER DEFAULT 1,
    paid_price REAL,
    merchant_commission REAL DEFAULT 0,
    iyzico_commission REAL DEFAULT 0,
    buyer_email TEXT,
    buyer_name TEXT,
    buyer_phone TEXT,
    buyer_address TEXT,
    buyer_city TEXT,
    buyer_country TEXT DEFAULT '''Turkey''',
    buyer_ip TEXT,
    billing_address TEXT,
    billing_city TEXT,
    billing_country TEXT DEFAULT '''Turkey''',
    error_code TEXT,
    error_message TEXT,
    error_group TEXT,
    raw_request TEXT,
    raw_response TEXT,
    callback_data TEXT,
    metadata TEXT,
    paid_at TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ amount
--   ✓ basket_id
--   ✓ billing_address
--   ✓ billing_city
--   ✓ billing_country
--   ✓ buyer_address
--   ✓ buyer_city
--   ✓ buyer_country
--   ✓ buyer_email
--   ✓ buyer_ip
--   ✓ buyer_name
--   ✓ buyer_phone
--   ✓ callback_data
--   ✓ card_association
--   ✓ card_family
--   ✓ card_last_four
--   ✓ card_type
--   ✓ company_id
--   ✓ conversation_id
--   ✓ created_at
--   ✓ currency
--   ✓ error_code
--   ✓ error_group
--   ✓ error_message
--   ✓ id
--   ✓ installment
--   ✓ iyzico_commission
--   ✓ license_id
--   ✓ merchant_commission
--   ✓ metadata
--   ✓ name
--   ✓ paid_at
--   ✓ paid_price
--   ✓ provider
--   ✓ provider_payment_id
--   ✓ provider_transaction_id
--   ✓ raw_request
--   ✓ raw_response
--   ✓ status
--   ✓ transaction_type
--   ✓ updated_at
--   ✓ user_id

-- ============================================
-- Tablo: permissions
-- ============================================
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    resource TEXT NOT NULL,
    actions TEXT NOT NULL,
    created_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ actions
--   ✓ resource

-- ============================================
-- Tablo: playlist_items
-- ============================================
CREATE TABLE IF NOT EXISTS playlist_items (
    id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL,
    media_id TEXT,
    template_id TEXT,
    sort_order INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 10,
    transition TEXT DEFAULT '''fade''',
    created_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ filename
--   ✓ mime_type
--   ✓ path

-- ============================================
-- Tablo: playlists
-- ============================================
CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT '''active''',
    duration INTEGER DEFAULT 0,
    item_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')',
    orientation TEXT DEFAULT '''landscape''',
    template_id TEXT,
    layout_type TEXT,
    items TEXT DEFAULT '''[]''',
    default_duration INTEGER DEFAULT 10,
    created_by TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ company_id
--   ✓ created_at
--   ✓ created_by
--   ✓ default_duration
--   ✓ description
--   ✓ duration
--   ✓ id
--   ✓ item_count
--   ✓ items
--   ✓ layout_type
--   ✓ name
--   ✓ orientation
--   ✓ preview_image
--   ✓ status
--   ✓ template_id
--   ✓ updated_at

-- ============================================
-- Tablo: price_history
-- ============================================
CREATE TABLE IF NOT EXISTS price_history (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    old_price REAL,
    new_price REAL NOT NULL,
    changed_at TEXT NOT NULL DEFAULT 'datetime(''now'')',
    source TEXT DEFAULT '''manual''',
    created_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ changed_at
--   ✓ new_price
--   ✓ old_price
--   ✓ source

-- ============================================
-- Tablo: production_types
-- ============================================
CREATE TABLE IF NOT EXISTS production_types (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT,
    description TEXT,
    color TEXT DEFAULT '''#228be6''',
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT '''active''',
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ color
--   ✓ company_id
--   ✓ created_at
--   ✓ description
--   ✓ id
--   ✓ name
--   ✓ slug
--   ✓ sort_order
--   ✓ status
--   ✓ updated_at

-- ============================================
-- Tablo: products
-- ============================================
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
    unit TEXT DEFAULT '''adet''',
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
    status TEXT DEFAULT '''active''',
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')',
    images TEXT,
    videos TEXT,
    cover_image_index INTEGER DEFAULT 0,
    video_url TEXT,
    assigned_device_id TEXT,
    assigned_template_id TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ assigned_device_id
--   ✓ assigned_template_id
--   ✓ barcode
--   ✓ brand
--   ✓ campaign_text
--   ✓ category
--   ✓ company_id
--   ✓ cover_image_index
--   ✓ created_at
--   ✓ current_price
--   ✓ default_image_id
--   ✓ default_video_id
--   ✓ description
--   ✓ discount_percent
--   ✓ erp_data
--   ✓ erp_id
--   ✓ extra_data
--   ✓ id
--   ✓ image_url
--   ✓ images
--   ✓ is_featured
--   ✓ kunye_data
--   ✓ kunye_no
--   ✓ name
--   ✓ origin
--   ✓ previous_price
--   ✓ price_valid_until
--   ✓ shelf_location
--   ✓ sku
--   ✓ slug
--   ✓ status
--   ✓ stock
--   ✓ subcategory
--   ✓ supplier_code
--   ✓ unit
--   ✓ updated_at
--   ✓ valid_from
--   ✓ valid_until
--   ✓ vat_rate
--   ✓ video_url
--   ✓ videos
--   ✓ weight

-- ============================================
-- Tablo: render_priority_weights
-- ============================================
CREATE TABLE IF NOT EXISTS render_priority_weights (
    priority TEXT PRIMARY KEY,
    weight INTEGER NOT NULL,
    max_concurrent INTEGER DEFAULT 10,
    timeout_seconds INTEGER DEFAULT 300,
    description TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ description
--   ✓ max_concurrent
--   ✓ priority
--   ✓ timeout_seconds
--   ✓ weight

-- ============================================
-- Tablo: render_queue
-- ============================================
CREATE TABLE IF NOT EXISTS render_queue (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    job_type TEXT NOT NULL DEFAULT '''render_send''',
    priority TEXT NOT NULL DEFAULT '''normal''',
    template_id TEXT,
    product_id TEXT,
    device_ids TEXT,
    device_count INTEGER DEFAULT 0,
    render_params TEXT,
    status TEXT NOT NULL DEFAULT '''pending''',
    progress INTEGER DEFAULT 0,
    devices_total INTEGER DEFAULT 0,
    devices_completed INTEGER DEFAULT 0,
    devices_failed INTEGER DEFAULT 0,
    devices_skipped INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_retry_at TEXT,
    next_retry_at TEXT,
    result TEXT,
    error_message TEXT,
    failed_devices TEXT,
    scheduled_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')',
    rendered_image_path TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ company_id
--   ✓ completed_at
--   ✓ created_at
--   ✓ created_by
--   ✓ device_count
--   ✓ device_ids
--   ✓ devices_completed
--   ✓ devices_failed
--   ✓ devices_skipped
--   ✓ devices_total
--   ✓ error_message
--   ✓ failed_devices
--   ✓ id
--   ✓ job_type
--   ✓ last_retry_at
--   ✓ max_retries
--   ✓ next_retry_at
--   ✓ priority
--   ✓ product_id
--   ✓ progress
--   ✓ render_params
--   ✓ rendered_image_path
--   ✓ result
--   ✓ retry_count
--   ✓ scheduled_at
--   ✓ started_at
--   ✓ status
--   ✓ template_id
--   ✓ updated_at

-- ============================================
-- Tablo: render_queue_items
-- ============================================
CREATE TABLE IF NOT EXISTS render_queue_items (
    id TEXT PRIMARY KEY,
    queue_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '''pending''',
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    skipped_reason TEXT,
    file_md5 TEXT,
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,
    created_at TEXT DEFAULT 'datetime(''now'')',
    error_type TEXT,
    next_retry_at TEXT,
    rendered_image_path TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ completed_at
--   ✓ created_at
--   ✓ device_id
--   ✓ duration_ms
--   ✓ error_type
--   ✓ file_md5
--   ✓ id
--   ✓ last_error
--   ✓ next_retry_at
--   ✓ queue_id
--   ✓ rendered_image_path
--   ✓ retry_count
--   ✓ skipped_reason
--   ✓ started_at
--   ✓ status

-- ============================================
-- Tablo: render_retry_policies
-- ============================================
CREATE TABLE IF NOT EXISTS render_retry_policies (
    id TEXT PRIMARY KEY,
    error_type TEXT NOT NULL,
    max_retries INTEGER DEFAULT 3,
    base_delay_seconds INTEGER DEFAULT 5,
    max_delay_seconds INTEGER DEFAULT 300,
    backoff_multiplier REAL DEFAULT 2.0,
    description TEXT
);

-- ============================================
-- Tablo: schedule_devices
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_devices (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    device_id TEXT NOT NULL
);

-- API'de kullanılan kolonlar:
--   ✓ device_id

-- ============================================
-- Tablo: schedules
-- ============================================
CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    playlist_id TEXT,
    start_date TEXT,
    end_date TEXT,
    start_time TEXT,
    end_time TEXT,
    days_of_week TEXT,
    status TEXT DEFAULT '''active''',
    priority INTEGER DEFAULT 0,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')'
);

-- API'de kullanılan kolonlar:
--   ✓ company_id
--   ✓ created_at
--   ✓ days_of_week
--   ✓ end_date
--   ✓ end_time
--   ✓ id
--   ✓ name
--   ✓ playlist_id
--   ✓ priority
--   ✓ start_date
--   ✓ start_time
--   ✓ status
--   ✓ updated_at

-- ============================================
-- Tablo: sessions
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    refresh_token_hash TEXT,
    ip_address TEXT,
    user_agent TEXT,
    last_activity TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT 'datetime(''now'')'
);

-- ============================================
-- Tablo: settings
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    user_id TEXT,
    data TEXT NOT NULL DEFAULT '"{}"',
    created_at TEXT,
    updated_at TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ company_id
--   ✓ created_at
--   ✓ data
--   ✓ id
--   ✓ updated_at
--   ✓ user_id
--   ✓ value

-- ============================================
-- Tablo: templates
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    category TEXT,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    orientation TEXT DEFAULT '''landscape''',
    design_data TEXT NOT NULL,
    preview_image TEXT,
    version INTEGER DEFAULT 1,
    parent_id TEXT,
    is_default INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 0,
    status TEXT DEFAULT '''active''',
    created_by TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')',
    layout_type TEXT DEFAULT '''full''',
    template_file TEXT,
    slots TEXT,
    device_types TEXT,
    target_device_type TEXT,
    grid_layout TEXT DEFAULT '''single''',
    regions_config TEXT,
    background_type TEXT DEFAULT '''color''',
    background_value TEXT DEFAULT '''#FFFFFF''',
    render_image TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ background_type
--   ✓ background_value
--   ✓ category
--   ✓ company_id
--   ✓ created_at
--   ✓ created_by
--   ✓ description
--   ✓ design_data
--   ✓ device_types
--   ✓ grid_layout
--   ✓ height
--   ✓ id
--   ✓ is_default
--   ✓ is_public
--   ✓ layout_type
--   ✓ name
--   ✓ orientation
--   ✓ parent_id
--   ✓ preview_image
--   ✓ regions_config
--   ✓ render_image
--   ✓ slots
--   ✓ status
--   ✓ target_device_type
--   ✓ template_file
--   ✓ thumbnail
--   ✓ type
--   ✓ updated_at
--   ✓ version
--   ✓ width

-- ============================================
-- Tablo: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    avatar TEXT,
    role TEXT NOT NULL,
    status TEXT DEFAULT '''pending''',
    activation_token TEXT,
    activation_expires TEXT,
    password_reset_token TEXT,
    password_reset_expires TEXT,
    last_login TEXT,
    last_ip TEXT,
    last_user_agent TEXT,
    preferences TEXT,
    created_at TEXT DEFAULT 'datetime(''now'')',
    updated_at TEXT DEFAULT 'datetime(''now'')',
    reset_token TEXT,
    reset_token_expires TEXT
);

-- API'de kullanılan kolonlar:
--   ✓ activation_expires
--   ✓ activation_token
--   ✓ avatar
--   ✓ company_id
--   ✓ created_at
--   ✓ email
--   ✓ first_name
--   ✓ id
--   ✓ last_ip
--   ✓ last_login
--   ✓ last_login_at
--   ✓ last_name
--   ✓ last_user_agent
--   ✓ name
--   ✓ password_hash
--   ✓ password_reset_expires
--   ✓ password_reset_token
--   ✓ phone
--   ✓ preferences
--   ✓ reset_token
--   ✓ reset_token_expires
--   ✓ role
--   ✓ status
--   ✓ updated_at

