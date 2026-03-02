<?php
/**
 * HAL Bildirim Listesi API
 *
 * GET /api/hal/bildirimler?start_date=2026-02-01&end_date=2026-02-17&sifat_id=7&only_remaining=true
 *
 * Tarih aralığı ve sıfat bazlı bildirim sorgulama.
 * Sonuçlar BelgeNo bazlı gruplanarak döner.
 *
 * @version 1.0.0
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../core/Database.php';
require_once __DIR__ . '/../../core/Auth.php';
require_once __DIR__ . '/../../core/Response.php';
require_once __DIR__ . '/../../services/HalBildirimService.php';

// Auth kontrolü
$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    Response::error('Method not allowed', 405);
}

// Parametreleri al
$startDate = $_GET['start_date'] ?? '';
$endDate = $_GET['end_date'] ?? '';
$sifatId = isset($_GET['sifat_id']) ? (int)$_GET['sifat_id'] : 0;
$onlyRemaining = ($_GET['only_remaining'] ?? 'true') === 'true';
$kunyeTuru = isset($_GET['kunye_turu']) ? (int)$_GET['kunye_turu'] : 1;

// Validasyon
if (empty($startDate) || empty($endDate)) {
    Response::error('Başlangıç ve bitiş tarihi gerekli', 400);
}

// Tarih formatı kontrolü
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
    Response::error('Tarih formatı geçersiz (YYYY-MM-DD)', 400);
}

// Tarih aralığı kontrolü (max 31 gün - HAL limiti)
$start = new DateTime($startDate);
$end = new DateTime($endDate);
$diff = $start->diff($end);

if ($diff->days > 31) {
    Response::error('Tarih aralığı en fazla 31 gün olabilir', 400);
}

if ($start > $end) {
    Response::error('Başlangıç tarihi bitiş tarihinden büyük olamaz', 400);
}

// Servisi oluştur ve sorgula
$service = new HalBildirimService();

if (!$service->hasCredentials()) {
    Response::error('HAL ayarları yapılandırılmamış. Lütfen Ayarlar > Entegrasyonlar bölümünden HAL kimlik bilgilerinizi girin.', 400);
}

// Bildirim sorgulama
$result = $service->fetchBildirimler($startDate, $endDate, $sifatId, $onlyRemaining, $kunyeTuru);

if (!$result['success']) {
    Response::error($result['error'] ?? 'Bildirim sorgusu başarısız', 500);
}

// BelgeNo bazlı grupla
$grouped = $service->groupByBelge($result['data']);

Response::success([
    'bildirimler' => $result['data'],
    'grouped' => $grouped,
    'total' => $result['total'],
    'params' => [
        'start_date' => $startDate,
        'end_date' => $endDate,
        'sifat_id' => $sifatId,
        'only_remaining' => $onlyRemaining,
        'kunye_turu' => $kunyeTuru
    ]
]);
