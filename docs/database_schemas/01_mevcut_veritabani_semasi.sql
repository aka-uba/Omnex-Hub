-- Mevcut Veritabanı Şeması
-- Oluşturulma Tarihi: 2026-01-24 22:56:17

CREATE TABLE audit_logs (
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
        created_at TEXT DEFAULT (datetime('now'))
    , archived_at TEXT DEFAULT NULL, archived_by TEXT DEFAULT NULL);

CREATE INDEX idx_audit_logs_action_created ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_company_created ON audit_logs(company_id, created_at DESC);
CREATE INDEX idx_audit_logs_archived ON audit_logs(archived_at);
CREATE INDEX idx_audit_logs_company_archived ON audit_logs(company_id, archived_at);
CREATE INDEX idx_audit_logs_active ON audit_logs(company_id, archived_at, created_at DESC);

CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        parent_id TEXT,
        name TEXT NOT NULL,
        slug TEXT,
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

CREATE TABLE companies (
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
, code TEXT, email TEXT, phone TEXT, address TEXT);

CREATE INDEX idx_companies_slug ON companies(slug);
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_code ON companies(code);

CREATE TABLE device_alerts (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        severity TEXT DEFAULT 'medium',
        title TEXT NOT NULL,
        message TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

CREATE INDEX idx_device_alerts_device ON device_alerts(device_id);

CREATE TABLE device_commands (
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

CREATE INDEX idx_device_commands_device ON device_commands(device_id);
CREATE INDEX idx_device_commands_status ON device_commands(status);

CREATE TABLE device_content_assignments (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_id TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

CREATE TABLE device_group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES device_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    UNIQUE(group_id, device_id)
);

CREATE INDEX idx_device_group_members_group ON device_group_members(group_id);
CREATE INDEX idx_device_group_members_device ON device_group_members(device_id);

CREATE TABLE device_groups (
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

CREATE INDEX idx_device_groups_company ON device_groups(company_id);
CREATE INDEX idx_device_groups_parent ON device_groups(parent_id);

CREATE TABLE device_heartbeats (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        status TEXT,
        current_item TEXT,
        battery_level INTEGER,
        signal_strength INTEGER,
        ip_address TEXT,
        created_at TEXT DEFAULT (datetime('now')), memory_usage INTEGER, cpu_usage INTEGER, storage_free INTEGER, temperature REAL, uptime INTEGER, errors TEXT, metadata TEXT,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

CREATE INDEX idx_device_heartbeats_device ON device_heartbeats(device_id);
CREATE INDEX idx_device_heartbeats_created ON device_heartbeats(created_at DESC);
CREATE INDEX idx_device_heartbeats_device_status ON device_heartbeats(device_id, status);

CREATE TABLE device_logs (
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

CREATE INDEX idx_device_logs_device ON device_logs(device_id);
CREATE INDEX idx_device_logs_status ON device_logs(status);
CREATE INDEX idx_device_logs_created ON device_logs(created_at);

CREATE TABLE device_sync_requests (
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
        device_id TEXT, device_type TEXT, brand TEXT, model TEXT, os_version TEXT, browser_version TEXT, screen_diagonal REAL, screen_width INTEGER, screen_height INTEGER, pixel_ratio REAL, color_depth INTEGER, cpu_cores INTEGER, device_memory REAL, touch_support INTEGER DEFAULT 0, connection_type TEXT,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

CREATE INDEX idx_sync_requests_sync_code ON device_sync_requests(sync_code);
CREATE INDEX idx_sync_requests_status ON device_sync_requests(status);
CREATE INDEX idx_sync_requests_device_type ON device_sync_requests(device_type);
CREATE INDEX idx_sync_requests_brand ON device_sync_requests(brand);

CREATE TABLE device_tokens (
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
        user_agent TEXT, token_hash TEXT,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

CREATE INDEX idx_device_tokens_device ON device_tokens(device_id);
CREATE INDEX idx_device_tokens_token ON device_tokens(token);
CREATE INDEX idx_device_tokens_hash ON device_tokens(token_hash);

CREATE TABLE devices (
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
    updated_at TEXT DEFAULT (datetime('now')), device_token TEXT, token_expires_at TEXT, sync_code TEXT, sync_code_expires_at TEXT, fingerprint TEXT, os_info TEXT, browser_info TEXT, screen_resolution TEXT, timezone TEXT, language TEXT, last_heartbeat TEXT, approval_status TEXT DEFAULT 'approved', approved_by TEXT, approved_at TEXT, location TEXT, device_type_detail TEXT, brand TEXT, model_name TEXT, os_version TEXT, screen_diagonal REAL, cpu_cores INTEGER, device_memory REAL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES device_groups(id) ON DELETE SET NULL,
    FOREIGN KEY (current_template_id) REFERENCES templates(id) ON DELETE SET NULL
);

CREATE INDEX idx_devices_company ON devices(company_id);
CREATE INDEX idx_devices_group ON devices(group_id);
CREATE INDEX idx_devices_type ON devices(type);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_sync_code ON devices(sync_code);
CREATE INDEX idx_devices_device_token ON devices(device_token);
CREATE INDEX idx_devices_fingerprint ON devices(fingerprint);
CREATE INDEX idx_devices_approval_status ON devices(approval_status);

CREATE TABLE firmware_updates (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    device_type TEXT NOT NULL DEFAULT "esl",
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_firmware_updates_device_type ON firmware_updates(device_type);
CREATE INDEX idx_firmware_updates_version ON firmware_updates(version);
CREATE INDEX idx_firmware_updates_active ON firmware_updates(is_active);
CREATE INDEX idx_firmware_updates_released ON firmware_updates(released_at DESC);

CREATE TABLE gateway_commands (
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

CREATE INDEX idx_gateway_commands_gateway ON gateway_commands(gateway_id);
CREATE INDEX idx_gateway_commands_status ON gateway_commands(status);
CREATE INDEX idx_gateway_commands_pending ON gateway_commands(gateway_id, status) WHERE status = 'pending';

CREATE TABLE gateway_devices (
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

CREATE INDEX idx_gateway_devices_gateway ON gateway_devices(gateway_id);
CREATE INDEX idx_gateway_devices_device ON gateway_devices(device_id);

CREATE TABLE gateways (
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

CREATE INDEX idx_gateways_company ON gateways(company_id);
CREATE INDEX idx_gateways_status ON gateways(status);
CREATE INDEX idx_gateways_api_key ON gateways(api_key);

CREATE TABLE hanshow_aps (
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

CREATE INDEX idx_hanshow_aps_company ON hanshow_aps(company_id);
CREATE INDEX idx_hanshow_aps_mac ON hanshow_aps(mac_address);

CREATE TABLE hanshow_esls (
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

CREATE INDEX idx_hanshow_esls_company ON hanshow_esls(company_id);
CREATE INDEX idx_hanshow_esls_esl_id ON hanshow_esls(esl_id);
CREATE INDEX idx_hanshow_esls_status ON hanshow_esls(status);
CREATE INDEX idx_hanshow_esls_product ON hanshow_esls(current_product_id);

CREATE TABLE hanshow_firmwares (
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

CREATE TABLE hanshow_queue (
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

CREATE INDEX idx_hanshow_queue_company ON hanshow_queue(company_id);
CREATE INDEX idx_hanshow_queue_status ON hanshow_queue(status);
CREATE INDEX idx_hanshow_queue_esl ON hanshow_queue(esl_id);
CREATE INDEX idx_hanshow_queue_session ON hanshow_queue(session_id);
CREATE INDEX idx_hanshow_queue_created ON hanshow_queue(created_at);

CREATE TABLE hanshow_settings (
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

CREATE TABLE import_mappings (
            id TEXT PRIMARY KEY,
            company_id TEXT,
            name TEXT,
            description TEXT,
            format TEXT DEFAULT 'auto',
            is_default INTEGER DEFAULT 0,
            config TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

CREATE TABLE integrations (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config TEXT,
        status TEXT DEFAULT 'inactive',
        last_sync TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

CREATE TABLE label_sizes (
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

CREATE INDEX idx_label_sizes_company ON label_sizes(company_id);
CREATE INDEX idx_label_sizes_active ON label_sizes(is_active);
CREATE INDEX idx_label_sizes_sort ON label_sizes(sort_order);

CREATE TABLE layout_configs (
            id TEXT PRIMARY KEY,
            scope TEXT NOT NULL DEFAULT 'default',
            scope_id TEXT,
            config TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

CREATE TABLE license_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT,
    plan_type TEXT NOT NULL DEFAULT 'subscription',
    duration_months INTEGER DEFAULT 12,
    price REAL NOT NULL,
    currency TEXT DEFAULT 'TRY',
    max_users INTEGER DEFAULT 5,
    max_devices INTEGER DEFAULT 10,
    max_products INTEGER DEFAULT 1000,
    max_templates INTEGER DEFAULT 50,
    features TEXT,
    is_popular INTEGER DEFAULT 0,
    is_enterprise INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
, is_active INTEGER DEFAULT 1);

CREATE INDEX idx_license_plans_slug ON license_plans(slug);
CREATE INDEX idx_license_plans_status ON license_plans(status);
CREATE INDEX idx_license_plans_type ON license_plans(plan_type);

CREATE TABLE licenses (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        license_key TEXT UNIQUE,
        type TEXT DEFAULT 'standard',
        max_devices INTEGER DEFAULT 10,
        features TEXT,
        valid_from TEXT,
        valid_until TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

CREATE TABLE media (
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

CREATE INDEX idx_media_company ON media(company_id);
CREATE INDEX idx_media_folder ON media(folder_id);
CREATE INDEX idx_media_type ON media(file_type);
CREATE INDEX idx_media_status ON media(status);

CREATE TABLE media_folders (
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

CREATE INDEX idx_media_folders_company ON media_folders(company_id);
CREATE INDEX idx_media_folders_parent ON media_folders(parent_id);

CREATE TABLE menu_items (
            id TEXT PRIMARY KEY,
            company_id TEXT,
            location TEXT DEFAULT 'sidebar',
            parent_id TEXT,
            label TEXT,
            href TEXT,
            icon TEXT,
            order_index INTEGER DEFAULT 0,
            roles TEXT DEFAULT '["SuperAdmin","Admin","Editor","Viewer"]',
            visible INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        );

CREATE TABLE migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                executed_at TEXT DEFAULT (datetime('now'))
            );

CREATE TABLE notification_recipients (
        id TEXT PRIMARY KEY,
        notification_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT DEFAULT 'sent',
        read_at TEXT,
        archived_at TEXT,
        deleted_at TEXT,
        FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
    );

CREATE INDEX idx_notification_recipients_user ON notification_recipients(user_id);
CREATE INDEX idx_notification_recipients_status ON notification_recipients(status);

CREATE TABLE notification_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE,
        enabled INTEGER DEFAULT 1,
        sound INTEGER DEFAULT 1,
        desktop INTEGER DEFAULT 0,
        types TEXT,
        email_digest TEXT DEFAULT 'none',
        dnd_enabled INTEGER DEFAULT 0,
        dnd_start TEXT,
        dnd_end TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );

CREATE TABLE notifications (
        id TEXT PRIMARY KEY,
        company_id TEXT,
        title TEXT NOT NULL,
        message TEXT,
        type TEXT DEFAULT 'info',
        target_type TEXT DEFAULT 'all',
        target_id TEXT,
        action_url TEXT,
        priority TEXT DEFAULT 'normal',
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    , icon TEXT, link TEXT, channels TEXT DEFAULT '["web"]', expires_at TEXT);

CREATE INDEX idx_notifications_expires ON notifications(expires_at);
CREATE INDEX idx_notifications_type ON notifications(type);

CREATE TABLE payment_settings (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    provider TEXT NOT NULL DEFAULT 'iyzico',
    environment TEXT NOT NULL DEFAULT 'sandbox',
    api_key TEXT,
    secret_key TEXT,
    merchant_id TEXT,
    callback_url TEXT,
    success_url TEXT,
    failure_url TEXT,
    currency TEXT DEFAULT 'TRY',
    installment_enabled INTEGER DEFAULT 1,
    max_installments INTEGER DEFAULT 12,
    commission_rate REAL DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')), is_active INTEGER DEFAULT 0, is_test_mode INTEGER DEFAULT 1, publishable_key TEXT, api_url TEXT, settings_json TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX idx_payment_settings_company ON payment_settings(company_id);
CREATE INDEX idx_payment_settings_provider ON payment_settings(provider);

CREATE TABLE payment_transactions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    user_id TEXT,
    license_id TEXT,
    transaction_type TEXT NOT NULL DEFAULT 'license_purchase',
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'TRY',
    status TEXT DEFAULT 'pending',
    provider TEXT NOT NULL DEFAULT 'iyzico',
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
    buyer_country TEXT DEFAULT 'Turkey',
    buyer_ip TEXT,
    billing_address TEXT,
    billing_city TEXT,
    billing_country TEXT DEFAULT 'Turkey',
    error_code TEXT,
    error_message TEXT,
    error_group TEXT,
    raw_request TEXT,
    raw_response TEXT,
    callback_data TEXT,
    metadata TEXT,
    paid_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE SET NULL
);

CREATE INDEX idx_payment_trans_company ON payment_transactions(company_id);
CREATE INDEX idx_payment_trans_user ON payment_transactions(user_id);
CREATE INDEX idx_payment_trans_license ON payment_transactions(license_id);
CREATE INDEX idx_payment_trans_status ON payment_transactions(status);
CREATE INDEX idx_payment_trans_provider_id ON payment_transactions(provider_transaction_id);
CREATE INDEX idx_payment_trans_basket ON payment_transactions(basket_id);
CREATE INDEX idx_payment_trans_created ON payment_transactions(created_at);
CREATE INDEX idx_payment_transactions_license ON payment_transactions(license_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);

CREATE TABLE permissions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    resource TEXT NOT NULL,
    actions TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_permissions_role_resource ON permissions(role, resource);

CREATE TABLE playlist_items (
        id TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        media_id TEXT,
        template_id TEXT,
        sort_order INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 10,
        transition TEXT DEFAULT 'fade',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
    );

CREATE TABLE playlists (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        duration INTEGER DEFAULT 0,
        item_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')), orientation TEXT DEFAULT 'landscape', template_id TEXT, layout_type TEXT, items TEXT DEFAULT '[]', default_duration INTEGER DEFAULT 10, created_by TEXT,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

CREATE INDEX idx_playlists_template ON playlists(template_id);
CREATE INDEX idx_playlists_orientation ON playlists(orientation);
CREATE INDEX idx_playlists_company ON playlists(company_id);

CREATE TABLE price_history (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    old_price REAL,
    new_price REAL NOT NULL,
    changed_at TEXT NOT NULL DEFAULT (datetime('now')),
    source TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_price_history_product ON price_history(product_id);
CREATE INDEX idx_price_history_changed ON price_history(changed_at);

CREATE TABLE production_types (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT,
        description TEXT,
        color TEXT DEFAULT '#228be6',
        sort_order INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

CREATE TABLE products (
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
    updated_at TEXT DEFAULT (datetime('now')), images TEXT, videos TEXT, cover_image_index INTEGER DEFAULT 0, video_url TEXT, assigned_device_id TEXT, assigned_template_id TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX idx_products_company ON products(company_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_status ON products(status);
CREATE UNIQUE INDEX idx_products_company_sku ON products(company_id, sku);
CREATE INDEX idx_products_assigned_device ON products(assigned_device_id);
CREATE INDEX idx_products_assigned_template ON products(assigned_template_id);

CREATE TABLE render_priority_weights (
    priority TEXT PRIMARY KEY,
    weight INTEGER NOT NULL,
    max_concurrent INTEGER DEFAULT 10,
    timeout_seconds INTEGER DEFAULT 300,
    description TEXT
);

CREATE TABLE render_queue (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    job_type TEXT NOT NULL DEFAULT 'render_send',  -- render_send, bulk_send, scheduled_send
    priority TEXT NOT NULL DEFAULT 'normal',        -- urgent, high, normal, low
    template_id TEXT,
    product_id TEXT,
    device_ids TEXT,           -- JSON array of device IDs
    device_count INTEGER DEFAULT 0,
    render_params TEXT,        -- JSON: width, height, locale, etc.
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed, cancelled
    progress INTEGER DEFAULT 0,              -- 0-100 yüzde
    devices_total INTEGER DEFAULT 0,
    devices_completed INTEGER DEFAULT 0,
    devices_failed INTEGER DEFAULT 0,
    devices_skipped INTEGER DEFAULT 0,       -- Delta update ile atlanan
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_retry_at TEXT,
    next_retry_at TEXT,
    result TEXT,               -- JSON: başarılı cihazlar, süreler vs.
    error_message TEXT,
    failed_devices TEXT,       -- JSON array of failed device details
    scheduled_at TEXT,         -- NULL = hemen, değilse zamanlanmış
    started_at TEXT,
    completed_at TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')), rendered_image_path TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (template_id) REFERENCES templates(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_render_queue_status ON render_queue(status);
CREATE INDEX idx_render_queue_priority ON render_queue(priority, created_at);
CREATE INDEX idx_render_queue_company ON render_queue(company_id, status);
CREATE INDEX idx_render_queue_scheduled ON render_queue(scheduled_at, status);
CREATE INDEX idx_render_queue_retry ON render_queue(next_retry_at, status);
CREATE INDEX idx_render_queue_worker ON render_queue(status, priority, scheduled_at, created_at);
CREATE INDEX idx_render_queue_rendered_image ON render_queue(rendered_image_path);

CREATE TABLE render_queue_items (
    id TEXT PRIMARY KEY,
    queue_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed, skipped
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    skipped_reason TEXT,       -- 'same_content', 'device_offline', etc.
    file_md5 TEXT,             -- Gönderilen dosyanın MD5'i
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER,       -- İşlem süresi (milisaniye)
    created_at TEXT DEFAULT (datetime('now')), error_type TEXT, next_retry_at TEXT, rendered_image_path TEXT,
    FOREIGN KEY (queue_id) REFERENCES render_queue(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE INDEX idx_queue_items_queue ON render_queue_items(queue_id, status);
CREATE INDEX idx_queue_items_device ON render_queue_items(device_id);

CREATE TABLE render_retry_policies (
    id TEXT PRIMARY KEY,
    error_type TEXT NOT NULL,           -- 'timeout', 'connection', 'device_offline', 'upload_failed'
    max_retries INTEGER DEFAULT 3,
    base_delay_seconds INTEGER DEFAULT 5,
    max_delay_seconds INTEGER DEFAULT 300,
    backoff_multiplier REAL DEFAULT 2.0,
    description TEXT
);

CREATE TABLE schedule_devices (
        id TEXT PRIMARY KEY,
        schedule_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
    );

CREATE TABLE schedules (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        name TEXT NOT NULL,
        playlist_id TEXT,
        start_date TEXT,
        end_date TEXT,
        start_time TEXT,
        end_time TEXT,
        days_of_week TEXT,
        status TEXT DEFAULT 'active',
        priority INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

CREATE INDEX idx_schedules_company ON schedules(company_id);

CREATE TABLE sessions (
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

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE settings (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    user_id TEXT,
    data TEXT NOT NULL DEFAULT "{}",
    created_at TEXT,
    updated_at TEXT
);

CREATE INDEX idx_settings_company ON settings(company_id);
CREATE INDEX idx_settings_user ON settings(user_id);

CREATE TABLE settings_backup(
  id TEXT,
  company_id TEXT,
  user_id TEXT,
  category TEXT,
  "key" TEXT,
  value TEXT,
  created_at TEXT,
  updated_at TEXT,
  data TEXT
);

CREATE TABLE templates (
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
    updated_at TEXT DEFAULT (datetime('now')), layout_type TEXT DEFAULT 'full', template_file TEXT, slots TEXT, device_types TEXT, target_device_type TEXT, grid_layout TEXT DEFAULT 'single', regions_config TEXT, background_type TEXT DEFAULT 'color', background_value TEXT DEFAULT '#FFFFFF', render_image TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES templates(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_templates_company ON templates(company_id);
CREATE INDEX idx_templates_type ON templates(type);
CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_status ON templates(status);
CREATE INDEX idx_templates_public ON templates(is_public);
CREATE INDEX idx_templates_layout_type ON templates(layout_type);
CREATE INDEX idx_templates_target_device ON templates(target_device_type);
CREATE INDEX idx_templates_grid_layout ON templates(grid_layout);

CREATE TABLE user_notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    email_enabled INTEGER DEFAULT 1,
    push_enabled INTEGER DEFAULT 1,
    toast_enabled INTEGER DEFAULT 1,
    web_enabled INTEGER DEFAULT 1,
    sound_enabled INTEGER DEFAULT 1,
    type_preferences TEXT DEFAULT '{}',
    quiet_start TEXT,
    quiet_end TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_notif_prefs_user ON user_notification_preferences(user_id);

CREATE TABLE users (
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
    updated_at TEXT DEFAULT (datetime('now')), reset_token TEXT, reset_token_expires TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

