<?php
/**
 * Entegrasyon Ayarları API (ERP, POS, WMS, API)
 *
 * 3 SEVİYELİ CONFIG MODELİ:
 * - system: Platform geneli varsayılan (SuperAdmin yönetir)
 * - company: Firma bazlı override
 *
 * GET  /api/integrations/settings?type=erp|pos|wms|api - Efektif ayarları getir
 * PUT  /api/integrations/settings - Ayarları güncelle
 * GET  /api/integrations/settings?type=erp&scope=system - System ayarlarını getir (SuperAdmin)
 * PUT  /api/integrations/settings?scope=system - System ayarlarını güncelle (SuperAdmin)
 * DELETE /api/integrations/settings?type=erp - Company override'ı sil, system'e dön
 *
 * @version 2.0.17
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
$isSuperAdmin = ($user['role'] ?? '') === 'SuperAdmin';

// Entegrasyon tipi parametresi
$integrationType = $_GET['type'] ?? null;
$validTypes = ['erp', 'pos', 'wms', 'api', 'file_import'];

// Scope parametresi (system ayarları için)
$requestedScope = $_GET['scope'] ?? null;

// =========================================================
// GET: Ayarları getir
// =========================================================
if ($method === 'GET') {

    // Tip belirtilmemişse tüm entegrasyonları döndür
    if (!$integrationType) {
        $allSettings = [];
        foreach ($validTypes as $type) {
            $effective = $resolver->getEffectiveSettings($type, $companyId);
            $allSettings[$type] = [
                'settings' => $effective['settings'],
                'meta' => [
                    'source' => $effective['source'],
                    'is_override' => $effective['is_override'],
                    'is_active' => $effective['is_active']
                ]
            ];
        }
        Response::success($allSettings);
    }

    // Geçerli tip kontrolü
    if (!in_array($integrationType, $validTypes)) {
        Response::badRequest('Geçersiz entegrasyon tipi. Geçerli tipler: ' . implode(', ', $validTypes));
    }

    // System scope istendi mi?
    if ($requestedScope === 'system') {
        if (!$isSuperAdmin) {
            Response::error('Sistem ayarlarına erişim yetkiniz yok', 403);
        }

        $effective = $resolver->getEffectiveSettings($integrationType, null);

        Response::success([
            'type' => $integrationType,
            'scope' => 'system',
            'settings' => $effective['settings'],
            'is_active' => $effective['is_active']
        ]);
    }

    // Normal akış: Efektif ayarları getir (company -> system fallback)
    $effective = $resolver->getEffectiveSettings($integrationType, $companyId);

    Response::success([
        'type' => $integrationType,
        'settings' => $effective['settings'],
        'meta' => [
            'source' => $effective['source'],
            'is_override' => $effective['is_override'],
            'is_active' => $effective['is_active'],
            'can_override' => true,
            'is_super_admin' => $isSuperAdmin
        ]
    ]);

// =========================================================
// PUT: Ayarları güncelle
// =========================================================
} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    // Tip body'den veya query'den alınabilir
    $integrationType = $data['type'] ?? $_GET['type'] ?? null;

    if (!$integrationType || !in_array($integrationType, $validTypes)) {
        Response::badRequest('Geçersiz entegrasyon tipi. Geçerli tipler: ' . implode(', ', $validTypes));
    }

    // System scope güncellemesi
    if ($requestedScope === 'system') {
        if (!$isSuperAdmin) {
            Response::error('Sistem ayarlarını değiştirme yetkiniz yok', 403);
        }

        // Mevcut system ayarlarını al
        $current = $resolver->getEffectiveSettings($integrationType, null);
        $currentConfig = $current['settings'] ?? [];

        // Ayarları birleştir
        $newConfig = mergeIntegrationSettings($integrationType, $currentConfig, $data);

        // Kaydet
        $isActive = isset($data['enabled']) ? (bool)$data['enabled'] : true;
        $resolver->saveSystemSettings($integrationType, $newConfig, $isActive);

        // Audit log
        Logger::audit('update', 'integration_settings', [
            'user_id' => $user['id'],
            'type' => $integrationType,
            'scope' => 'system'
        ]);

        Response::success([
            'type' => $integrationType,
            'scope' => 'system',
            'settings' => maskSensitiveFields($newConfig),
            'is_active' => $isActive
        ], ucfirst($integrationType) . ' sistem ayarları kaydedildi');
    }

    // Company scope güncellemesi
    $current = $resolver->getEffectiveSettings($integrationType, $companyId);
    $currentConfig = $current['settings'] ?? [];

    // Ayarları birleştir
    $newConfig = mergeIntegrationSettings($integrationType, $currentConfig, $data);

    // API anahtarı firma bazında benzersiz olmalı
    if ($integrationType === 'api' && !empty($newConfig['api_key'])) {
        $apiRows = $db->fetchAll(
            "SELECT company_id, config_json
             FROM integration_settings
             WHERE integration_type = 'api'
               AND scope = 'company'
               AND company_id IS NOT NULL
               AND company_id <> ?",
            [$companyId]
        );

        foreach ($apiRows as $apiRow) {
            $apiCfg = json_decode($apiRow['config_json'] ?? '{}', true) ?: [];
            if (!empty($apiCfg['api_key']) && hash_equals((string)$apiCfg['api_key'], (string)$newConfig['api_key'])) {
                Response::badRequest('Bu API anahtari baska bir firmada kullaniliyor. Lutfen farkli bir API anahtari olusturun.');
            }
        }
    }

    // Kaydet (company scope)
    $isActive = isset($data['enabled']) ? (bool)$data['enabled'] : true;
    $resolver->saveCompanySettings($integrationType, $companyId, $newConfig, $isActive);

    // Audit log
    Logger::audit('update', 'integration_settings', [
        'user_id' => $user['id'],
        'company_id' => $companyId,
        'type' => $integrationType,
        'scope' => 'company'
    ]);

    Response::success([
        'type' => $integrationType,
        'settings' => maskSensitiveFields($newConfig),
        'meta' => [
            'source' => 'company',
            'is_override' => true,
            'is_active' => $isActive
        ]
    ], ucfirst($integrationType) . ' ayarları kaydedildi');

// =========================================================
// DELETE: Company override'ı sil (system default'a dön)
// =========================================================
} elseif ($method === 'DELETE') {
    if (!$integrationType || !in_array($integrationType, $validTypes)) {
        Response::badRequest('Geçersiz entegrasyon tipi');
    }

    // Company override'ı sil
    $resolver->deleteCompanyOverride($integrationType, $companyId);

    // Artık system default kullanılacak
    $effective = $resolver->getEffectiveSettings($integrationType, $companyId);

    // Audit log
    Logger::audit('delete', 'integration_settings', [
        'user_id' => $user['id'],
        'company_id' => $companyId,
        'type' => $integrationType,
        'action' => 'reset_to_system_default'
    ]);

    Response::success([
        'type' => $integrationType,
        'deleted' => true,
        'settings' => maskSensitiveFields($effective['settings']),
        'meta' => [
            'source' => 'system',
            'is_override' => false,
            'is_active' => $effective['is_active']
        ]
    ], 'Firma ' . strtoupper($integrationType) . ' ayarları silindi, sistem varsayılanı kullanılacak');

} else {
    Response::methodNotAllowed('İzin verilmeyen method');
}

// =========================================================
// YARDIMCI FONKSİYONLAR
// =========================================================

/**
 * Entegrasyon tipine göre ayarları birleştir
 */
function mergeIntegrationSettings(string $type, array $current, array $input): array
{
    switch ($type) {
        case 'erp':
            return mergeErpSettings($current, $input);
        case 'pos':
            return mergePosSettings($current, $input);
        case 'wms':
            return mergeWmsSettings($current, $input);
        case 'api':
            return mergeApiSettings($current, $input);
        default:
            return array_merge($current, $input);
    }
}

/**
 * ERP ayarlarını birleştir
 */
function mergeErpSettings(array $current, array $input): array
{
    $fields = ['type', 'endpoint', 'username', 'sync_interval', 'database', 'port'];

    foreach ($fields as $field) {
        if (isset($input[$field])) {
            $current[$field] = is_string($input[$field]) ? trim($input[$field]) : $input[$field];
        }
    }

    // Şifre sadece değiştirildiyse güncelle
    if (isset($input['password']) && $input['password'] !== '' && $input['password'] !== '********') {
        $current['password'] = $input['password'];
    }

    if (isset($input['enabled'])) {
        $current['enabled'] = (bool)$input['enabled'];
    }

    return $current;
}

/**
 * POS ayarlarını birleştir
 */
function mergePosSettings(array $current, array $input): array
{
    $fields = ['type', 'endpoint', 'store_id', 'terminal_id'];

    foreach ($fields as $field) {
        if (isset($input[$field])) {
            $current[$field] = is_string($input[$field]) ? trim($input[$field]) : $input[$field];
        }
    }

    // API Key sadece değiştirildiyse güncelle
    if (isset($input['api_key']) && $input['api_key'] !== '' && $input['api_key'] !== '********') {
        $current['api_key'] = $input['api_key'];
    }

    if (isset($input['enabled'])) {
        $current['enabled'] = (bool)$input['enabled'];
    }

    return $current;
}

/**
 * WMS ayarlarını birleştir
 */
function mergeWmsSettings(array $current, array $input): array
{
    $fields = ['endpoint', 'warehouse_id', 'sync_stock'];

    foreach ($fields as $field) {
        if (isset($input[$field])) {
            if ($field === 'sync_stock') {
                $current[$field] = (bool)$input[$field];
            } else {
                $current[$field] = is_string($input[$field]) ? trim($input[$field]) : $input[$field];
            }
        }
    }

    // API Key sadece değiştirildiyse güncelle
    if (isset($input['api_key']) && $input['api_key'] !== '' && $input['api_key'] !== '********') {
        $current['api_key'] = $input['api_key'];
    }

    if (isset($input['enabled'])) {
        $current['enabled'] = (bool)$input['enabled'];
    }

    return $current;
}

/**
 * API ayarlarını birleştir
 */
function mergeApiSettings(array $current, array $input): array
{
    $fields = ['rate_limit', 'webhook_url'];

    foreach ($fields as $field) {
        if (isset($input[$field])) {
            $current[$field] = is_string($input[$field]) ? trim($input[$field]) : $input[$field];
        }
    }

    // API Key yeniden oluşturulabilir
    if (isset($input['api_key']) && $input['api_key'] !== '') {
        $current['api_key'] = $input['api_key'];
    }

    if (isset($input['enabled'])) {
        $current['enabled'] = (bool)$input['enabled'];
    }

    return $current;
}

/**
 * Hassas alanları maskele
 */
function maskSensitiveFields(array $settings): array
{
    $sensitiveFields = ['password', 'api_key', 'secret_key'];

    foreach ($sensitiveFields as $field) {
        if (!empty($settings[$field])) {
            $settings[$field . '_set'] = true;
            $settings[$field] = '********';
        }
    }

    return $settings;
}
