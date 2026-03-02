<?php
/**
 * HAL Entegrasyon Ayarları API
 *
 * 3 SEVİYELİ CONFIG MODELİ:
 * - system: Platform geneli varsayılan (SuperAdmin yönetir)
 * - company: Firma bazlı override
 *
 * GET /api/hal/settings - Efektif ayarları getir
 * PUT /api/hal/settings - Ayarları güncelle
 * GET /api/hal/settings?scope=system - System ayarlarını getir (SuperAdmin)
 * PUT /api/hal/settings?scope=system - System ayarlarını güncelle (SuperAdmin)
 * DELETE /api/hal/settings - Company override'ı sil, system'e dön
 *
 * @version 2.0.12
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../core/Database.php';
require_once __DIR__ . '/../../core/Auth.php';
require_once __DIR__ . '/../../core/Response.php';
require_once __DIR__ . '/../../services/SettingsResolver.php';

// Auth kontrolü
$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$db = Database::getInstance();
$resolver = new SettingsResolver();
$companyId = Auth::getActiveCompanyId();
$method = $_SERVER['REQUEST_METHOD'];
$isSuperAdmin = ($user['role'] ?? '') === 'SuperAdmin';

// Scope parametresi
$requestedScope = $_GET['scope'] ?? null;

// =========================================================
// GET: Ayarları getir
// =========================================================
if ($method === 'GET') {

    // System scope istendi mi?
    if ($requestedScope === 'system') {
        if (!$isSuperAdmin) {
            Response::error('Sistem ayarlarına erişim yetkiniz yok', 403);
        }

        $effective = $resolver->getEffectiveSettings('hal', null);

        Response::success([
            'scope' => 'system',
            'configured' => !empty($effective['settings']['username']),
            'settings' => maskPasswords($effective['settings'])
        ]);
    }

    // Normal akış: Efektif ayarları getir (company -> system fallback)
    $effective = $resolver->getEffectiveSettings('hal', $companyId);
    $halSettings = $effective['settings'];

    Response::success([
        'configured' => !empty($halSettings['username']),
        'settings' => maskPasswords($halSettings),
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
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        Response::error('Geçersiz veri', 400);
    }

    // System scope güncellemesi
    if ($requestedScope === 'system') {
        if (!$isSuperAdmin) {
            Response::error('Sistem ayarlarını değiştirme yetkiniz yok', 403);
        }

        // Mevcut system ayarlarını al
        $current = $resolver->getEffectiveSettings('hal', null);
        $currentConfig = $current['settings'] ?? [];

        // Ayarları birleştir
        $newConfig = mergeSettings($currentConfig, $input);

        // Kaydet
        $resolver->saveSystemSettings('hal', $newConfig, $input['enabled'] ?? true);

        Response::success([
            'scope' => 'system',
            'saved' => true,
            'settings' => maskPasswords($newConfig)
        ], 'Sistem HAL ayarları kaydedildi');
    }

    // Company scope güncellemesi
    // Mevcut company ayarlarını al (veya system'den kopyala)
    $current = $resolver->getEffectiveSettings('hal', $companyId);
    $currentConfig = $current['settings'] ?? [];

    // Ayarları birleştir
    $newConfig = mergeSettings($currentConfig, $input);

    // Kaydet (company scope)
    $resolver->saveCompanySettings('hal', $companyId, $newConfig, $input['enabled'] ?? true);

    Response::success([
        'saved' => true,
        'settings' => maskPasswords($newConfig),
        'meta' => [
            'source' => 'company',
            'is_override' => true
        ]
    ], 'HAL ayarları kaydedildi');

// =========================================================
// DELETE: Company override'ı sil (system default'a dön)
// =========================================================
} elseif ($method === 'DELETE') {
    // Company override'ı sil
    $resolver->deleteCompanyOverride('hal', $companyId);

    // Artık system default kullanılacak
    $effective = $resolver->getEffectiveSettings('hal', $companyId);

    Response::success([
        'deleted' => true,
        'settings' => maskPasswords($effective['settings']),
        'meta' => [
            'source' => 'system',
            'is_override' => false
        ]
    ], 'Firma HAL ayarları silindi, sistem varsayılanı kullanılacak');

} else {
    Response::error('Method not allowed', 405);
}

// =========================================================
// YARDIMCI FONKSİYONLAR
// =========================================================

/**
 * Şifreleri maskele
 */
function maskPasswords(array $settings): array
{
    if (!empty($settings['password'])) {
        $settings['password_set'] = true;
        $settings['password'] = '********';
    }
    if (!empty($settings['service_password'])) {
        $settings['service_password_set'] = true;
        $settings['service_password'] = '********';
    }
    return $settings;
}

/**
 * Ayarları birleştir (maskelenmiş şifreleri koru)
 */
function mergeSettings(array $current, array $input): array
{
    // Temel alanlar
    if (isset($input['username'])) {
        $current['username'] = trim($input['username']);
    }
    if (isset($input['password']) && $input['password'] !== '********') {
        $current['password'] = $input['password'];
    }
    if (isset($input['service_password']) && $input['service_password'] !== '********') {
        $current['service_password'] = $input['service_password'];
    }
    if (isset($input['tc_vergi_no'])) {
        $current['tc_vergi_no'] = trim($input['tc_vergi_no']);
    }
    if (isset($input['sifat_id'])) {
        $current['sifat_id'] = (int)$input['sifat_id'];
    }
    if (isset($input['sifat2_id'])) {
        $current['sifat2_id'] = (int)$input['sifat2_id'];
    }
    if (isset($input['enabled'])) {
        $current['enabled'] = (bool)$input['enabled'];
    }

    // Ek alanlar (store_code, mapping vs.)
    if (isset($input['store_code'])) {
        $current['store_code'] = trim($input['store_code']);
    }
    if (isset($input['warehouse_code'])) {
        $current['warehouse_code'] = trim($input['warehouse_code']);
    }
    if (isset($input['field_mappings'])) {
        $current['field_mappings'] = $input['field_mappings'];
    }

    return $current;
}
