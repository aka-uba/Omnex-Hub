<?php
/**
 * Default seed data
 */

require_once dirname(__DIR__, 2) . '/config.php';
require_once BASE_PATH . '/services/CompanyStorageService.php';

$db = Database::getInstance();

// Check if already seeded
$adminExists = $db->fetch("SELECT 1 FROM users WHERE email = ?", [DEFAULT_ADMIN_EMAIL]);
if ($adminExists) {
    return;
}

// Create default company
$companyId = $db->generateUuid();
$db->insert('companies', [
    'id' => $companyId,
    'name' => 'Omnex Default',
    'slug' => 'default',
    'primary_color' => '#228be6',
    'secondary_color' => '#495057',
    'status' => 'active',
    'settings' => json_encode([
        'timezone' => 'Europe/Istanbul',
        'currency' => 'TRY',
        'language' => 'tr'
    ])
]);

// Ensure storage directories for seeded default company
try {
    CompanyStorageService::ensureForCompany($companyId);
} catch (Throwable $e) {
    Logger::warning('Default company storage ensure failed', [
        'company_id' => $companyId,
        'error' => $e->getMessage()
    ]);
}

// Create SuperAdmin user
$adminId = $db->generateUuid();
$db->insert('users', [
    'id' => $adminId,
    'company_id' => null, // SuperAdmin has no company
    'email' => DEFAULT_ADMIN_EMAIL,
    'password_hash' => Auth::hashPassword(DEFAULT_ADMIN_PASSWORD),
    'first_name' => 'Super',
    'last_name' => 'Admin',
    'role' => 'SuperAdmin',
    'status' => 'active',
    'preferences' => json_encode([
        'language' => 'tr',
        'theme' => 'light',
        'notifications' => true
    ])
]);

// Create default Admin user for the company
$companyAdminId = $db->generateUuid();
$db->insert('users', [
    'id' => $companyAdminId,
    'company_id' => $companyId,
    'email' => 'company@omnexcore.com',
    'password_hash' => Auth::hashPassword('CompanyAdmin2024!'),
    'first_name' => 'Company',
    'last_name' => 'Admin',
    'role' => 'Admin',
    'status' => 'active',
    'preferences' => json_encode([
        'language' => 'tr',
        'theme' => 'light'
    ])
]);

// Default permissions
$permissions = [
    ['role' => 'SuperAdmin', 'resource' => '*', 'actions' => '["*"]'],
    ['role' => 'Admin', 'resource' => 'users', 'actions' => '["create","read","update","delete"]'],
    ['role' => 'Admin', 'resource' => 'products', 'actions' => '["create","read","update","delete"]'],
    ['role' => 'Admin', 'resource' => 'templates', 'actions' => '["create","read","update","delete"]'],
    ['role' => 'Admin', 'resource' => 'media', 'actions' => '["create","read","update","delete"]'],
    ['role' => 'Admin', 'resource' => 'devices', 'actions' => '["create","read","update","delete"]'],
    ['role' => 'Admin', 'resource' => 'signage', 'actions' => '["create","read","update","delete"]'],
    ['role' => 'Admin', 'resource' => 'reports', 'actions' => '["read"]'],
    ['role' => 'Admin', 'resource' => 'settings', 'actions' => '["read","update"]'],
    ['role' => 'Editor', 'resource' => 'products', 'actions' => '["create","read","update"]'],
    ['role' => 'Editor', 'resource' => 'templates', 'actions' => '["create","read","update"]'],
    ['role' => 'Editor', 'resource' => 'media', 'actions' => '["create","read","update"]'],
    ['role' => 'Editor', 'resource' => 'devices', 'actions' => '["read","update"]'],
    ['role' => 'Editor', 'resource' => 'signage', 'actions' => '["create","read","update"]'],
    ['role' => 'Viewer', 'resource' => 'products', 'actions' => '["read"]'],
    ['role' => 'Viewer', 'resource' => 'templates', 'actions' => '["read"]'],
    ['role' => 'Viewer', 'resource' => 'media', 'actions' => '["read"]'],
    ['role' => 'Viewer', 'resource' => 'devices', 'actions' => '["read"]'],
    ['role' => 'Viewer', 'resource' => 'reports', 'actions' => '["read"]'],
];

foreach ($permissions as $perm) {
    $db->insert('permissions', [
        'id' => $db->generateUuid(),
        'role' => $perm['role'],
        'resource' => $perm['resource'],
        'actions' => $perm['actions']
    ]);
}

// Default license for the company (supports old/new license schemas)
$licenseData = [
    'id' => $db->generateUuid(),
    'company_id' => $companyId,
    'license_key' => 'OMNEX-' . strtoupper(bin2hex(random_bytes(8))),
    'status' => 'active',
    'features' => json_encode(['all']),
];

if ($db->columnExists('licenses', 'valid_from')) {
    $licenseData['valid_from'] = date('Y-m-d H:i:s');
} elseif ($db->columnExists('licenses', 'start_date')) {
    $licenseData['start_date'] = date('Y-m-d');
}

if ($db->columnExists('licenses', 'valid_until')) {
    $licenseData['valid_until'] = date('Y-m-d H:i:s', strtotime('+1 year'));
} elseif ($db->columnExists('licenses', 'end_date')) {
    $licenseData['end_date'] = date('Y-m-d', strtotime('+1 year'));
}

if ($db->columnExists('licenses', 'auto_renew')) {
    $licenseData['auto_renew'] = 1;
}

if ($db->columnExists('licenses', 'type')) {
    $licenseData['type'] = 'enterprise';
}
if ($db->columnExists('licenses', 'period')) {
    $licenseData['period'] = 'yearly';
}
if ($db->columnExists('licenses', 'esl_limit')) {
    $licenseData['esl_limit'] = 1000;
}
if ($db->columnExists('licenses', 'tv_limit')) {
    $licenseData['tv_limit'] = 50;
}
if ($db->columnExists('licenses', 'user_limit')) {
    $licenseData['user_limit'] = 100;
}
if ($db->columnExists('licenses', 'storage_limit')) {
    $licenseData['storage_limit'] = 10240; // 10GB
}
if ($db->columnExists('licenses', 'points_limit')) {
    $licenseData['points_limit'] = 1000;
}

$db->insert('licenses', $licenseData);

// Default import mapping
$db->insert('import_mappings', [
    'id' => $db->generateUuid(),
    'company_id' => null, // Global
    'name' => 'default',
    'description' => 'Varsayılan ERP import formatı',
    'format' => 'auto',
    'is_default' => 1,
    'config' => json_encode([
        'name' => 'Varsayılan Format',
        'version' => '1.0',
        'format' => 'auto',
        'encoding' => 'UTF-8',
        'options' => [
            'txt' => [
                'delimiter' => ';',
                'hasHeader' => true,
                'skipLines' => 0
            ],
            'json' => [
                'dataPath' => 'products',
                'encoding' => 'UTF-8'
            ],
            'csv' => [
                'delimiter' => ',',
                'enclosure' => '"',
                'hasHeader' => true
            ]
        ],
        'fieldMapping' => [
            'sku' => [
                'field' => 'STOK_KODU',
                'alternates' => ['SKU', 'URUN_KODU', 'PRODUCT_CODE'],
                'required' => true,
                'transform' => 'trim'
            ],
            'barcode' => [
                'field' => 'BARKOD',
                'alternates' => ['BARKOD_NO', 'EAN', 'BARCODE'],
                'transform' => 'trim'
            ],
            'name' => [
                'field' => 'URUN_ADI',
                'alternates' => ['AD', 'NAME', 'PRODUCT_NAME'],
                'required' => true,
                'maxLength' => 255
            ],
            'current_price' => [
                'field' => 'SATIS_FIYATI',
                'alternates' => ['FIYAT', 'PRICE', 'SATIS_FIYAT'],
                'transform' => 'number',
                'required' => true
            ],
            'previous_price' => [
                'field' => 'ESKI_FIYAT',
                'alternates' => ['OLD_PRICE', 'ONCEKI_FIYAT'],
                'transform' => 'number',
                'default' => null
            ],
            'unit' => [
                'field' => 'BIRIM',
                'alternates' => ['UNIT', 'OLCU_BIRIMI'],
                'default' => 'adet',
                'valueMap' => [
                    'KG' => 'kg',
                    'ADET' => 'adet',
                    'LT' => 'lt',
                    'PAKET' => 'paket',
                    'KOLI' => 'koli'
                ]
            ],
            'category' => [
                'field' => 'KATEGORI',
                'alternates' => ['CATEGORY', 'GRUP'],
                'transform' => 'trim'
            ],
            'kunye_no' => [
                'field' => 'KUNYE_NO',
                'alternates' => ['TANITIM_NO', 'LABEL_ID', 'ETIKET_NO']
            ]
        ],
        'validation' => [
            'sku' => ['required' => true],
            'name' => ['required' => true, 'maxLength' => 255],
            'current_price' => ['required' => true, 'min' => 0]
        ]
    ])
]);

// Default layout config
$db->insert('layout_configs', [
    'id' => $db->generateUuid(),
    'scope' => 'default',
    'scope_id' => null,
    'config' => json_encode([
        'layoutType' => 'sidebar',
        'themeMode' => 'light',
        'direction' => 'ltr',
        'language' => 'tr',
        'sidebar' => [
            'width' => 260,
            'collapsedWidth' => 64,
            'collapsed' => false,
            'position' => 'left',
            'backgroundColor' => '#ffffff',
            'menuColor' => 'default'
        ],
        'header' => [
            'height' => 64,
            'backgroundColor' => '#ffffff',
            'sticky' => true
        ],
        'content' => [
            'maxWidth' => 1400,
            'padding' => 24
        ]
    ])
]);

// Default menu items
$menus = [
    ['label' => '{"tr":"Dashboard","en":"Dashboard"}', 'href' => '/dashboard', 'icon' => 'home', 'order_index' => 1],
    ['label' => '{"tr":"Ürünler","en":"Products"}', 'href' => '/products', 'icon' => 'package', 'order_index' => 2],
    ['label' => '{"tr":"Şablonlar","en":"Templates"}', 'href' => '/templates', 'icon' => 'layout', 'order_index' => 3],
    ['label' => '{"tr":"Medya","en":"Media"}', 'href' => '/media', 'icon' => 'image', 'order_index' => 4],
    ['label' => '{"tr":"Cihazlar","en":"Devices"}', 'href' => '/devices', 'icon' => 'monitor', 'order_index' => 5],
    ['label' => '{"tr":"Signage","en":"Signage"}', 'href' => '/signage', 'icon' => 'tv', 'order_index' => 6],
    ['label' => '{"tr":"Raporlar","en":"Reports"}', 'href' => '/reports', 'icon' => 'chart-bar', 'order_index' => 7],
    ['label' => '{"tr":"Ayarlar","en":"Settings"}', 'href' => '/settings', 'icon' => 'settings', 'order_index' => 8],
];

foreach ($menus as $menu) {
    $db->insert('menu_items', [
        'id' => $db->generateUuid(),
        'company_id' => null, // Global
        'location' => 'sidebar',
        'label' => $menu['label'],
        'href' => $menu['href'],
        'icon' => $menu['icon'],
        'order_index' => $menu['order_index'],
        'roles' => '["SuperAdmin","Admin","Editor","Viewer"]',
        'visible' => 1
    ]);
}

// Seed completed - output only in CLI mode
if (php_sapi_name() === 'cli') {
    echo "Default data seeded successfully!\n";
    echo "SuperAdmin: " . DEFAULT_ADMIN_EMAIL . " / " . DEFAULT_ADMIN_PASSWORD . "\n";
    echo "Company Admin: company@omnexcore.com / CompanyAdmin2024!\n";
}
