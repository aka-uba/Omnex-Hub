<?php
/**
 * ERP Import Settings API
 *
 * GET  /api/import/settings - Get import settings for current company
 * PUT  /api/import/settings - Update import settings
 *
 * Uses SettingsResolver with integration_type = 'file_import'
 *
 * @package OmnexDisplayHub
 */

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

require_once BASE_PATH . '/services/SettingsResolver.php';

$db = Database::getInstance();
$resolver = new SettingsResolver();
$method = $_SERVER['REQUEST_METHOD'];
$companyId = Auth::getActiveCompanyId();

$integrationType = 'file_import';

// Default settings structure
$defaults = [
    'enabled' => false,
    'auto_import_enabled' => false,
    'check_interval' => 30,
    'default_import_filename' => null,
    'allowed_formats' => ['csv', 'txt', 'json', 'xml', 'xlsx'],
    'max_file_size_mb' => 10,
    'default_mappings' => [],
    'update_existing' => true,
    'create_new' => true,
    'skip_errors' => true,
    'trigger_render' => true,
    'last_auto_import' => null,
    'last_auto_import_result' => null
];

// =========================================================
// GET: Get import settings
// =========================================================
if ($method === 'GET') {
    $effective = $resolver->getEffectiveSettings($integrationType, $companyId);
    $settings = array_merge($defaults, $effective['settings'] ?? []);

    // Build import directory path
    $importDir = 'storage/companies/' . $companyId . '/imports/';
    $importDirFull = BASE_PATH . '/' . $importDir;

    // Check if directory exists and has pending files
    $pendingFiles = 0;
    if (is_dir($importDirFull)) {
        $files = glob($importDirFull . '*');
        foreach ($files as $f) {
            if (is_file($f)) {
                $pendingFiles++;
            }
        }
    }

    // Get recent auto-import stats
    $recentImports = [];
    try {
        $recentImports = $db->fetchAll(
            "SELECT id, filename, source, status, total_rows, inserted, updated, failed, skipped, error_message, processed_at, created_at
             FROM erp_import_files
             WHERE company_id = ?
             ORDER BY created_at DESC
             LIMIT 5",
            [$companyId]
        );
    } catch (Exception $e) {
        // Table might not exist yet
    }

    Response::success([
        'settings' => $settings,
        'import_directory' => $importDir,
        'pending_files' => $pendingFiles,
        'recent_imports' => $recentImports,
        'meta' => [
            'source' => $effective['source'] ?? 'default',
            'is_active' => $effective['is_active'] ?? false,
            'is_override' => $effective['is_override'] ?? false
        ]
    ]);
}

// =========================================================
// PUT: Update import settings
// =========================================================
if ($method === 'PUT') {
    // Only admin+ can change import settings
    if (!in_array($user['role'], ['SuperAdmin', 'Admin'])) {
        Response::forbidden('Import ayarlarını değiştirme yetkiniz yok');
    }

    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    // Get current settings
    $effective = $resolver->getEffectiveSettings($integrationType, $companyId);
    $current = array_merge($defaults, $effective['settings'] ?? []);

    // Merge new settings
    $fields = [
        'enabled', 'auto_import_enabled', 'check_interval',
        'default_import_filename',
        'allowed_formats', 'max_file_size_mb',
        'update_existing', 'create_new', 'skip_errors', 'trigger_render'
    ];

    foreach ($fields as $field) {
        if (isset($data[$field])) {
            if (in_array($field, ['enabled', 'auto_import_enabled', 'update_existing', 'create_new', 'skip_errors', 'trigger_render'])) {
                $current[$field] = (bool) $data[$field];
            } elseif (in_array($field, ['check_interval', 'max_file_size_mb'])) {
                $current[$field] = max(1, (int) $data[$field]);
            } elseif ($field === 'default_import_filename') {
                $filename = trim((string) $data[$field]);
                if ($filename === '') {
                    $current[$field] = null;
                } else {
                    $safeFilename = basename($filename);
                    // Normalize timestamped API-push filenames: 20260311_153045_products.csv => products.csv
                    $normalized = preg_replace('/^\d{8}_\d{6}_/', '', $safeFilename);
                    $current[$field] = $normalized !== '' ? $normalized : $safeFilename;
                }
            } elseif ($field === 'allowed_formats') {
                $validFormats = ['csv', 'txt', 'json', 'xml', 'xlsx'];
                $current[$field] = array_values(array_intersect((array) $data[$field], $validFormats));
            } else {
                $current[$field] = $data[$field];
            }
        }
    }

    // Handle default_mappings
    if (isset($data['default_mappings']) && is_array($data['default_mappings'])) {
        $current['default_mappings'] = $data['default_mappings'];
    }

    // Validate check_interval
    if ($current['check_interval'] < 5) {
        $current['check_interval'] = 5;
    }
    if ($current['check_interval'] > 1440) {
        $current['check_interval'] = 1440;
    }

    // Validate max file size
    if ($current['max_file_size_mb'] > 50) {
        $current['max_file_size_mb'] = 50;
    }

    // Ensure import directory exists
    $importDir = BASE_PATH . '/storage/companies/' . $companyId . '/imports/';
    if (!is_dir($importDir)) {
        mkdir($importDir, 0755, true);
    }
    if (!is_dir($importDir . 'processed/')) {
        mkdir($importDir . 'processed/', 0755, true);
    }
    if (!is_dir($importDir . 'failed/')) {
        mkdir($importDir . 'failed/', 0755, true);
    }

    // Save settings
    $isActive = $current['enabled'];
    $resolver->saveCompanySettings($integrationType, $companyId, $current, $isActive);

    // Audit log
    Logger::audit('update', 'import_settings', [
        'user_id' => $user['id'],
        'company_id' => $companyId,
        'type' => $integrationType
    ]);

    Response::success([
        'settings' => $current,
        'import_directory' => 'storage/companies/' . $companyId . '/imports/',
        'meta' => [
            'source' => 'company',
            'is_active' => $isActive,
            'is_override' => true
        ]
    ], 'Import ayarları kaydedildi');
}
