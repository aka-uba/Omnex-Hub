<?php
/**
 * Hanshow Entegrasyon Ayarlari
 *
 * 3 SEVİYELİ CONFIG MODELİ:
 * - system: Platform geneli varsayılan (SuperAdmin yönetir)
 * - company: Firma bazlı override
 *
 * GET  /api/hanshow/settings - Efektif ayarları getir
 * PUT  /api/hanshow/settings - Ayarları güncelle
 * GET  /api/hanshow/settings?scope=system - System ayarlarını getir (SuperAdmin)
 * PUT  /api/hanshow/settings?scope=system - System ayarlarını güncelle (SuperAdmin)
 * DELETE /api/hanshow/settings - Company override'ı sil, system'e dön
 *
 * @version 2.0.12
 */

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

require_once BASE_PATH . '/services/SettingsResolver.php';
require_once BASE_PATH . '/services/HanshowGateway.php';

$db = Database::getInstance();
$resolver = new SettingsResolver();
$method = $_SERVER['REQUEST_METHOD'];
$companyId = Auth::getActiveCompanyId();
$isSuperAdmin = ($user['role'] ?? '') === 'SuperAdmin';

// Scope parametresi (system ayarları için)
$requestedScope = $_GET['scope'] ?? null;

// Callback URL'i otomatik oluştur
$baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http')
    . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost')
    . (defined('WEB_PATH') ? WEB_PATH : '/market-etiket-sistemi')
    . '/api/hanshow/callback';

// =========================================================
// GET: Ayarları getir
// =========================================================
if ($method === 'GET') {

    // System scope istendi mi?
    if ($requestedScope === 'system') {
        if (!$isSuperAdmin) {
            Response::error('Sistem ayarlarına erişim yetkiniz yok', 403);
        }

        $settings = $db->fetch(
            "SELECT * FROM hanshow_settings WHERE scope = 'system' AND company_id IS NULL"
        );

        if (!$settings) {
            $settings = [
                'eslworking_url' => 'http://127.0.0.1:9000',
                'user_id' => 'default',
                'callback_url' => $baseUrl,
                'default_priority' => 10,
                'sync_interval' => 60,
                'auto_retry' => true,
                'max_retry_attempts' => 3,
                'led_flash_on_update' => true,
                'led_color' => 'green',
                'enabled' => true
            ];
        } else {
            $settings['auto_retry'] = (bool)$settings['auto_retry'];
            $settings['led_flash_on_update'] = (bool)$settings['led_flash_on_update'];
            $settings['enabled'] = (bool)$settings['enabled'];
        }

        Response::success([
            'scope' => 'system',
            'settings' => $settings,
            'suggested_callback_url' => $baseUrl
        ]);
    }

    // Normal akış: Efektif ayarları getir (company -> system fallback)
    $settings = $resolver->getHanshowSettings($companyId);

    // Callback URL yoksa öner
    if (empty($settings['callback_url'])) {
        $settings['callback_url'] = $baseUrl;
    }

    // Gateway durumunu kontrol et
    $gateway = new HanshowGateway($settings);
    $pingResult = $gateway->ping();

    // Ek bilgiler
    $meta = [
        'source' => $settings['_source'] ?? 'default',
        'is_override' => $settings['_is_override'] ?? false,
        'can_override' => true,
        'is_super_admin' => $isSuperAdmin
    ];

    // Source bilgilerini ayarlardan kaldır
    unset($settings['_source'], $settings['_is_override']);

    Response::success([
        'settings' => $settings,
        'meta' => $meta,
        'connection' => [
            'online' => $pingResult['success'],
            'response_time' => $pingResult['response_time'] ?? null,
            'connected_aps' => $pingResult['connected_aps'] ?? 0,
            'ap_list' => $pingResult['data']['ap_list'] ?? [],
            'error' => $pingResult['data']['errmsg'] ?? $pingResult['errmsg'] ?? null
        ],
        'suggested_callback_url' => $baseUrl
    ]);

// =========================================================
// PUT: Ayarları güncelle
// =========================================================
} elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    // System scope güncellemesi
    if ($requestedScope === 'system') {
        if (!$isSuperAdmin) {
            Response::error('Sistem ayarlarını değiştirme yetkiniz yok', 403);
        }

        $resolver->saveHanshowSystemSettings($data);

        // Bağlantı testi
        $settings = $resolver->getHanshowSettings(null);
        $gateway = new HanshowGateway($settings);
        $pingResult = $gateway->ping();

        Response::success([
            'scope' => 'system',
            'settings' => $settings,
            'connection' => [
                'online' => $pingResult['success'],
                'response_time' => $pingResult['response_time'] ?? null,
                'error' => $pingResult['errmsg'] ?? null
            ]
        ], 'Sistem ayarları kaydedildi');
    }

    // Company scope güncellemesi (normal kullanıcı)
    $resolver->saveHanshowCompanySettings($companyId, $data);

    // Güncel ayarları getir
    $settings = $resolver->getHanshowSettings($companyId);

    // Bağlantı testi
    $gateway = new HanshowGateway($settings);
    $pingResult = $gateway->ping();

    // Source bilgilerini temizle
    unset($settings['_source'], $settings['_is_override']);

    Response::success([
        'settings' => $settings,
        'meta' => [
            'source' => 'company',
            'is_override' => true
        ],
        'connection' => [
            'online' => $pingResult['success'],
            'response_time' => $pingResult['response_time'] ?? null,
            'error' => $pingResult['errmsg'] ?? null
        ]
    ], 'Ayarlar kaydedildi');

// =========================================================
// DELETE: Company override'ı sil (system default'a dön)
// =========================================================
} elseif ($method === 'DELETE') {
    // Company override'ı sil
    $deleted = $db->delete(
        'hanshow_settings',
        'company_id = ? AND scope = ?',
        [$companyId, 'company']
    );

    // Artık system default kullanılacak
    $settings = $resolver->getHanshowSettings($companyId);
    unset($settings['_source'], $settings['_is_override']);

    Response::success([
        'deleted' => $deleted,
        'settings' => $settings,
        'meta' => [
            'source' => 'system',
            'is_override' => false
        ]
    ], 'Firma ayarları silindi, sistem varsayılanı kullanılacak');

} else {
    Response::methodNotAllowed('İzin verilmeyen method');
}
