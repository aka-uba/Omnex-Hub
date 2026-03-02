<?php
/**
 * SMTP Entegrasyon Ayarları API
 *
 * 3 SEVİYELİ CONFIG MODELİ:
 * - system: Platform geneli varsayılan (SuperAdmin yönetir)
 * - company: Firma bazlı override
 *
 * GET /api/smtp/settings - Efektif ayarları getir
 * PUT /api/smtp/settings - Ayarları güncelle
 * GET /api/smtp/settings?scope=system - System ayarlarını getir (SuperAdmin)
 * PUT /api/smtp/settings?scope=system - System ayarlarını güncelle (SuperAdmin)
 * DELETE /api/smtp/settings - Company override'ı sil, system'e dön
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

        $effective = $resolver->getEffectiveSettings('smtp', null);

        Response::success([
            'scope' => 'system',
            'configured' => !empty($effective['settings']['host']),
            'settings' => maskPasswords($effective['settings'])
        ]);
    }

    // Normal akış: Efektif ayarları getir (company -> system fallback)
    $effective = $resolver->getEffectiveSettings('smtp', $companyId);
    $smtpSettings = $effective['settings'];

    Response::success([
        'configured' => !empty($smtpSettings['host']),
        'settings' => maskPasswords($smtpSettings),
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
        $current = $resolver->getEffectiveSettings('smtp', null);
        $currentConfig = $current['settings'] ?? [];

        // Ayarları birleştir
        $newConfig = mergeSettings($currentConfig, $input);

        // Kaydet
        $resolver->saveSystemSettings('smtp', $newConfig, $input['enabled'] ?? true);

        Response::success([
            'scope' => 'system',
            'saved' => true,
            'settings' => maskPasswords($newConfig)
        ], 'Sistem SMTP ayarları kaydedildi');
    }

    // Company scope güncellemesi
    // Mevcut company ayarlarını al (veya system'den kopyala)
    $current = $resolver->getEffectiveSettings('smtp', $companyId);
    $currentConfig = $current['settings'] ?? [];

    // Ayarları birleştir
    $newConfig = mergeSettings($currentConfig, $input);

    // Kaydet (company scope)
    $resolver->saveCompanySettings('smtp', $companyId, $newConfig, $input['enabled'] ?? true);

    Response::success([
        'saved' => true,
        'settings' => maskPasswords($newConfig),
        'meta' => [
            'source' => 'company',
            'is_override' => true
        ]
    ], 'SMTP ayarları kaydedildi');

// =========================================================
// DELETE: Company override'ı sil (system default'a dön)
// =========================================================
} elseif ($method === 'DELETE') {
    // Company override'ı sil
    $resolver->deleteCompanyOverride('smtp', $companyId);

    // Artık system default kullanılacak
    $effective = $resolver->getEffectiveSettings('smtp', $companyId);

    Response::success([
        'deleted' => true,
        'settings' => maskPasswords($effective['settings']),
        'meta' => [
            'source' => 'system',
            'is_override' => false
        ]
    ], 'Firma SMTP ayarları silindi, sistem varsayılanı kullanılacak');

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
    return $settings;
}

/**
 * Ayarları birleştir (maskelenmiş şifreleri koru)
 */
function mergeSettings(array $current, array $input): array
{
    // SMTP alanları
    if (isset($input['host'])) {
        $current['host'] = trim($input['host']);
    }
    if (isset($input['port'])) {
        $current['port'] = (int)$input['port'];
    }
    if (isset($input['username'])) {
        $current['username'] = trim($input['username']);
    }
    if (isset($input['password']) && $input['password'] !== '********') {
        $current['password'] = $input['password'];
    }
    if (isset($input['encryption'])) {
        $current['encryption'] = $input['encryption'];
    }
    if (isset($input['from_email'])) {
        $current['from_email'] = trim($input['from_email']);
    }
    if (isset($input['from_name'])) {
        $current['from_name'] = trim($input['from_name']);
    }
    if (isset($input['enabled'])) {
        $current['enabled'] = (bool)$input['enabled'];
    }

    return $current;
}
