<?php
/**
 * Setup Seed API Endpoint
 *
 * POST /api/setup/seed
 */

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

if (!in_array($user['role'], ['SuperAdmin', 'Admin'], true)) {
    Response::forbidden('Bu islem icin yetkiniz yok');
}

$db = Database::getInstance();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    Response::error('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

$seedersPath = BASE_PATH . '/database/seeders';
require_once $seedersPath . '/BaseSeeder.php';
require_once $seedersPath . '/LicensePlanSeeder.php';
require_once $seedersPath . '/CategorySeeder.php';
require_once $seedersPath . '/ProductionTypeSeeder.php';
require_once $seedersPath . '/ProductSeeder.php';
require_once $seedersPath . '/TemplateSeeder.php';
require_once $seedersPath . '/SettingsSeeder.php';
require_once $seedersPath . '/LabelSizeSeeder.php';
require_once $seedersPath . '/MenuItemSeeder.php';
require_once $seedersPath . '/LayoutConfigSeeder.php';
require_once BASE_PATH . '/services/CompanyStorageService.php';

$seeders = $input['seeders'] ?? ['license_plans', 'categories', 'production_types', 'products', 'label_sizes'];
$locale = $input['locale'] ?? 'tr';
$demoOnly = (bool)($input['demo_only'] ?? false);
$defaultOnly = (bool)($input['default_only'] ?? false);
$clearDemo = (bool)($input['clear_demo'] ?? false);
$clearAll = (bool)($input['clear_all'] ?? false);

$companyId = $user['company_id'] ?? null;
if ($user['role'] === 'SuperAdmin') {
    if (!empty($input['company_id'])) {
        $companyId = $input['company_id'];
    } elseif (empty($companyId)) {
        $companyId = Auth::getActiveCompanyId();
    }
} elseif (empty($companyId)) {
    $companyId = Auth::getActiveCompanyId();
}

$validSeeders = [
    'license_plans',
    'categories',
    'production_types',
    'products',
    'templates',
    'settings',
    'label_sizes',
    'menu_items',
    'layout_config',
];
$seeders = array_values(array_intersect($seeders, $validSeeders));

if (empty($seeders)) {
    Response::error('En az bir gecerli seeder secmelisiniz', 400);
}

$companyRequiredSeeders = array_diff($seeders, ['license_plans', 'label_sizes']);
if (!empty($companyRequiredSeeders) && empty($companyId)) {
    Response::error('Aktif firma bulunamadi. Kurulum icin once firma secmelisiniz.', 400);
}

$results = [
    'seeders' => [],
    'totals' => [
        'created' => 0,
        'updated' => 0,
        'skipped' => 0,
        'errors' => 0,
        'deleted' => 0,
    ],
];

/**
 * Configure seeder runtime options.
 */
function configureSeeder(BaseSeeder $seeder, string $locale, ?string $companyId, string $userId, bool $demoOnly, bool $defaultOnly): BaseSeeder
{
    $seeder
        ->setLocale($locale)
        ->setCreatedBy($userId)
        ->setDemoOnly($demoOnly)
        ->setDefaultOnly($defaultOnly)
        ->setVerbose(false);

    if (!empty($companyId)) {
        $seeder->setCompanyId((string)$companyId);
    }

    return $seeder;
}

/**
 * Execute a single seeder.
 */
function runSingleSeeder(
    string $seederClass,
    string $seederName,
    array &$results,
    string $locale,
    ?string $companyId,
    string $userId,
    bool $demoOnly,
    bool $defaultOnly,
    bool $clearDemo,
    bool $clearAll
): void {
    /** @var BaseSeeder $seeder */
    $seeder = new $seederClass();
    configureSeeder($seeder, $locale, $companyId, $userId, $demoOnly, $defaultOnly);

    if ($clearAll) {
        $deleted = $seeder->clearAllData();
        $results['seeders'][$seederName] = ['deleted' => $deleted];
        $results['totals']['deleted'] += $deleted;
        return;
    }

    if ($clearDemo) {
        $deleted = $seeder->clearDemoData();
        $results['seeders'][$seederName] = ['deleted' => $deleted];
        $results['totals']['deleted'] += $deleted;
        return;
    }

    $seeder->run();
    $stats = $seeder->getStats();
    $results['seeders'][$seederName] = $stats;
    $results['totals']['created'] += (int)($stats['created'] ?? 0);
    $results['totals']['updated'] += (int)($stats['updated'] ?? 0);
    $results['totals']['skipped'] += (int)($stats['skipped'] ?? 0);
    $results['totals']['errors'] += (int)($stats['errors'] ?? 0);
}

try {
    $seederClasses = [
        'license_plans' => 'LicensePlanSeeder',
        'categories' => 'CategorySeeder',
        'production_types' => 'ProductionTypeSeeder',
        'products' => 'ProductSeeder',
        'templates' => 'TemplateSeeder',
        'settings' => 'SettingsSeeder',
        'label_sizes' => 'LabelSizeSeeder',
        'menu_items' => 'MenuItemSeeder',
        'layout_config' => 'LayoutConfigSeeder',
    ];

    $seederOrder = [
        'license_plans',
        'categories',
        'production_types',
        'products',
        'templates',
        'settings',
        'label_sizes',
        'menu_items',
        'layout_config',
    ];

    foreach ($seederOrder as $seederName) {
        if (!in_array($seederName, $seeders, true) || !isset($seederClasses[$seederName])) {
            continue;
        }

        if ($seederName === 'settings' && empty($companyId)) {
            $results['seeders'][$seederName] = ['error' => 'Company ID gerekli'];
            $results['totals']['errors']++;
            continue;
        }

        runSingleSeeder(
            $seederClasses[$seederName],
            $seederName,
            $results,
            $locale,
            $companyId,
            (string)$user['id'],
            $demoOnly,
            $defaultOnly,
            $clearDemo,
            $clearAll
        );
    }

    if (!$clearAll && !$clearDemo && !empty($companyId)) {
        $results['storage'] = CompanyStorageService::ensureForCompany((string)$companyId);
    }

    $action = $clearAll ? 'clear_all_data' : ($clearDemo ? 'clear_demo_data' : 'seed_data');
    $db->insert('audit_logs', [
        'id' => $db->generateUuid(),
        'company_id' => $companyId,
        'user_id' => $user['id'],
        'action' => $action,
        'entity_type' => 'setup',
        'entity_id' => null,
        'old_values' => null,
        'new_values' => json_encode([
            'seeders' => $seeders,
            'locale' => $locale,
            'results' => $results['totals'],
        ]),
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
        'created_at' => date('Y-m-d H:i:s'),
    ]);

    if ($results['totals']['errors'] > 0) {
        Response::success($results, 'Islem tamamlandi ancak hatalar var');
    } else {
        $message = $clearAll || $clearDemo
            ? "{$results['totals']['deleted']} kayit silindi"
            : "{$results['totals']['created']} kayit eklendi, {$results['totals']['updated']} kayit guncellendi";
        Response::success($results, $message);
    }
} catch (Throwable $e) {
    Response::error('Seed islemi basarisiz: ' . $e->getMessage(), 500);
}
