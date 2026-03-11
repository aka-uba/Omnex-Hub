<?php
/**
 * Setup Status API Endpoint
 *
 * GET /api/setup/status
 */

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

if (!in_array($user['role'], ['SuperAdmin', 'Admin'], true)) {
    Response::forbidden('Bu islem icin yetkiniz yok');
}

$db = Database::getInstance();
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    Response::error('Method not allowed', 405);
}

$companyId = $user['company_id'] ?? null;
if ($user['role'] === 'SuperAdmin') {
    if (!empty($_GET['company_id'])) {
        $companyId = (string)$_GET['company_id'];
    } elseif (empty($companyId)) {
        $companyId = Auth::getActiveCompanyId();
    }
} elseif (empty($companyId)) {
    $companyId = Auth::getActiveCompanyId();
}

if (empty($companyId)) {
    Response::success([
        'company_id' => null,
        'counts' => [
            'categories' => 0,
            'production_types' => 0,
            'products' => 0,
            'templates' => 0,
            'label_sizes' => 0,
            'license_plans' => 0,
        ],
        'categories' => ['total' => 0, 'demo' => 0, 'parents' => 0, 'children' => 0],
        'products' => ['total' => 0, 'demo' => 0, 'active' => 0],
        'templates' => ['total' => 0, 'demo' => 0],
        'production_types' => ['total' => 0, 'demo' => 0],
        'label_sizes' => ['total' => 0, 'active' => 0, 'inactive' => 0],
        'license_plans' => ['total' => 0, 'active' => 0, 'inactive' => 0],
        'available_locales' => [],
        'has_data' => false,
    ]);
}

$isDemoCondition = $db->isPostgres() ? 'is_demo IS TRUE' : 'is_demo = 1';

try {
    $categoryStats = $db->fetch(
        "SELECT
            COUNT(*) as total,
            SUM(CASE WHEN $isDemoCondition THEN 1 ELSE 0 END) as demo,
            SUM(CASE WHEN parent_id IS NULL THEN 1 ELSE 0 END) as parents,
            SUM(CASE WHEN parent_id IS NOT NULL THEN 1 ELSE 0 END) as children
        FROM categories
        WHERE company_id = ?",
        [$companyId]
    );

    $productStats = $db->fetch(
        "SELECT
            COUNT(*) as total,
            SUM(CASE WHEN $isDemoCondition THEN 1 ELSE 0 END) as demo,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
        FROM products
        WHERE company_id = ?",
        [$companyId]
    );

    $templateStats = $db->fetch(
        "SELECT
            COUNT(*) as total,
            SUM(CASE WHEN $isDemoCondition THEN 1 ELSE 0 END) as demo
        FROM templates
        WHERE company_id = ? OR scope = 'system' OR company_id IS NULL",
        [$companyId]
    );

    $productionTypeStats = $db->fetch(
        "SELECT
            COUNT(*) as total,
            SUM(CASE WHEN $isDemoCondition THEN 1 ELSE 0 END) as demo
        FROM production_types
        WHERE company_id = ?",
        [$companyId]
    );

    $isActiveCondition = $db->isPostgres() ? 'is_active IS TRUE' : 'is_active = 1';
    $labelSizeStats = $db->fetch(
        "SELECT
            COUNT(*) as total,
            SUM(CASE WHEN $isActiveCondition THEN 1 ELSE 0 END) as active
        FROM label_sizes
        WHERE (company_id IS NULL OR company_id = ?)",
        [$companyId]
    );

    $licenseActiveCondition = $db->isPostgres() ? 'is_active IS TRUE' : 'is_active = 1';
    $licensePlanStats = $db->fetch(
        "SELECT
            COUNT(*) as total,
            SUM(CASE WHEN $licenseActiveCondition THEN 1 ELSE 0 END) as active
        FROM license_plans"
    );

    $availableLocales = [];

    // 1) Application locales from /locales/*
    $localesPath = BASE_PATH . '/locales';
    if (is_dir($localesPath)) {
        $dirs = scandir($localesPath);
        foreach ($dirs as $dir) {
            if ($dir === '.' || $dir === '..') {
                continue;
            }
            $full = $localesPath . '/' . $dir;
            if (!is_dir($full)) {
                continue;
            }
            if (preg_match('/^[a-z]{2}$/', $dir) !== 1) {
                continue;
            }
            $availableLocales[$dir] = true;
        }
    }

    // 2) Seeder data locales from /database/seeders/data/*
    $seedDataPath = BASE_PATH . '/database/seeders/data';
    if (is_dir($seedDataPath)) {
        $dirs = scandir($seedDataPath);
        foreach ($dirs as $dir) {
            if ($dir === '.' || $dir === '..' || $dir === 'shared') {
                continue;
            }
            $full = $seedDataPath . '/' . $dir;
            if (!is_dir($full)) {
                continue;
            }
            if (preg_match('/^[a-z]{2}$/', $dir) !== 1) {
                continue;
            }
            $availableLocales[$dir] = true;
        }
    }

    $localeList = array_keys($availableLocales);
    sort($localeList);

    $response = [
        'company_id' => $companyId,
        'counts' => [
            'categories' => (int)($categoryStats['total'] ?? 0),
            'production_types' => (int)($productionTypeStats['total'] ?? 0),
            'products' => (int)($productStats['total'] ?? 0),
            'templates' => (int)($templateStats['total'] ?? 0),
            'label_sizes' => (int)($labelSizeStats['total'] ?? 0),
            'license_plans' => (int)($licensePlanStats['total'] ?? 0),
        ],
        'categories' => [
            'total' => (int)($categoryStats['total'] ?? 0),
            'demo' => (int)($categoryStats['demo'] ?? 0),
            'parents' => (int)($categoryStats['parents'] ?? 0),
            'children' => (int)($categoryStats['children'] ?? 0),
        ],
        'products' => [
            'total' => (int)($productStats['total'] ?? 0),
            'demo' => (int)($productStats['demo'] ?? 0),
            'active' => (int)($productStats['active'] ?? 0),
        ],
        'templates' => [
            'total' => (int)($templateStats['total'] ?? 0),
            'demo' => (int)($templateStats['demo'] ?? 0),
        ],
        'production_types' => [
            'total' => (int)($productionTypeStats['total'] ?? 0),
            'demo' => (int)($productionTypeStats['demo'] ?? 0),
        ],
        'label_sizes' => [
            'total' => (int)($labelSizeStats['total'] ?? 0),
            'active' => (int)($labelSizeStats['active'] ?? 0),
            'inactive' => max(0, (int)($labelSizeStats['total'] ?? 0) - (int)($labelSizeStats['active'] ?? 0)),
        ],
        'license_plans' => [
            'total' => (int)($licensePlanStats['total'] ?? 0),
            'active' => (int)($licensePlanStats['active'] ?? 0),
            'inactive' => max(0, (int)($licensePlanStats['total'] ?? 0) - (int)($licensePlanStats['active'] ?? 0)),
        ],
        'available_locales' => $localeList,
        'has_data' => ((int)($categoryStats['total'] ?? 0) > 0)
            || ((int)($productStats['total'] ?? 0) > 0)
            || ((int)($templateStats['total'] ?? 0) > 0)
            || ((int)($labelSizeStats['total'] ?? 0) > 0)
            || ((int)($licensePlanStats['total'] ?? 0) > 0),
    ];

    Response::success($response);
} catch (Throwable $e) {
    Response::error('Durum bilgisi alinamadi: ' . $e->getMessage(), 500);
}
