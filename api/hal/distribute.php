<?php
/**
 * HAL Künye Dağıtım API
 *
 * POST /api/hal/distribute
 *
 * Seçili künyeleri ürünlere dağıtır.
 * Her atama için product_hal_data tablosuna insert/update yapar.
 * Dağıtım geçmişini hal_distribution_logs tablosuna kaydeder.
 *
 * @version 1.0.0
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../core/Database.php';
require_once __DIR__ . '/../../core/Auth.php';
require_once __DIR__ . '/../../core/Response.php';
require_once BASE_PATH . '/services/RenderCacheService.php';

// Auth kontrolü
$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    Response::error('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['assignments'])) {
    Response::error('Dağıtım atamaları gerekli', 400);
}

$db = Database::getInstance();
$companyId = Auth::getActiveCompanyId();
$userId = $user['id'];

$distributed = 0;
$skipped = 0;
$errors = [];
$updatedProductIds = [];

foreach ($input['assignments'] as $idx => $assignment) {
    $kunyeNo = $assignment['kunye_no'] ?? '';
    $productId = $assignment['product_id'] ?? '';
    $miktar = floatval($assignment['miktar'] ?? 0);
    $kalanMiktar = floatval($assignment['kalan_miktar'] ?? 0);
    $type = $assignment['type'] ?? 'full';
    $malinAdi = $assignment['malin_adi'] ?? '';
    $malinCinsi = $assignment['malin_cinsi'] ?? '';
    $malinTuru = $assignment['malin_turu'] ?? '';
    $belgeNo = $assignment['belge_no'] ?? '';
    $belgeTipi = $assignment['belge_tipi'] ?? '';
    $sifatId = isset($assignment['sifat_id']) ? (int)$assignment['sifat_id'] : null;
    $bildirimTarihi = $assignment['bildirim_tarihi'] ?? '';
    $birim = $assignment['birim'] ?? '';
    $birimId = $assignment['birim_id'] ?? '';
    $aracPlakaNo = $assignment['arac_plaka_no'] ?? '';
    $ureticiTcVergiNo = $assignment['uretici_tc_vergi_no'] ?? '';
    $malinSahibiTcVergiNo = $assignment['malin_sahibi_tc_vergi_no'] ?? '';
    $bildirimciTcVergiNo = $assignment['bildirimci_tc_vergi_no'] ?? '';
    $malinCinsKodNo = $assignment['malin_cins_kod_no'] ?? '';
    $malinKodNo = $assignment['malin_kod_no'] ?? '';
    $malinTuruKodNo = $assignment['malin_turu_kod_no'] ?? '';
    $malinSatisFiyati = $assignment['malin_satis_fiyati'] ?? '';
    $gidecekIsyeriId = $assignment['gidecek_isyeri_id'] ?? '';
    $gidecekYerTuruId = $assignment['gidecek_yer_turu_id'] ?? '';
    $analizStatus = $assignment['analiz_status'] ?? '';
    $bildirimTuru = $assignment['bildirim_turu'] ?? '';

    // Validasyon
    if (empty($kunyeNo) || empty($productId)) {
        $errors[] = [
            'index' => $idx,
            'error' => 'Künye no ve ürün ID gerekli',
            'kunye_no' => $kunyeNo
        ];
        continue;
    }

    // Ürün varlık kontrolü
    $product = $db->fetch(
        "SELECT id, name FROM products WHERE id = ? AND company_id = ?",
        [$productId, $companyId]
    );

    if (!$product) {
        $errors[] = [
            'index' => $idx,
            'error' => 'Ürün bulunamadı',
            'kunye_no' => $kunyeNo,
            'product_id' => $productId
        ];
        continue;
    }

    try {
        // product_hal_data tablosuna insert/update (product_id UNIQUE constraint)
        $existing = $db->fetch(
            "SELECT id FROM product_hal_data WHERE product_id = ? AND company_id = ?",
            [$productId, $companyId]
        );

        $halData = [
            'product_id' => $productId,
            'company_id' => $companyId,
            'kunye_no' => $kunyeNo,
            'malin_adi' => $malinAdi,
            'malin_cinsi' => $malinCinsi,
            'malin_turu' => $malinTuru,
            'ilk_bildirim_tarihi' => $bildirimTarihi,
            'miktar' => $miktar > 0 ? (string)$miktar : null,
            'kalan_miktar' => $kalanMiktar > 0 ? (string)$kalanMiktar : null,
            'alis_fiyati' => !empty($malinSatisFiyati) ? floatval($malinSatisFiyati) : null,
            'birim' => $birim,
            'birim_id' => $birimId,
            'bildirim_turu' => $bildirimTuru,
            'uretici_tc_vergi_no' => $ureticiTcVergiNo,
            'malin_sahibi_tc_vergi_no' => $malinSahibiTcVergiNo,
            'bildirimci_tc_vergi_no' => $bildirimciTcVergiNo,
            'arac_plaka_no' => $aracPlakaNo,
            'belge_no' => $belgeNo,
            'belge_tipi' => $belgeTipi,
            'malin_cins_kod_no' => $malinCinsKodNo,
            'malin_kod_no' => $malinKodNo,
            'malin_turu_kod_no' => $malinTuruKodNo,
            'gidecek_isyeri_id' => $gidecekIsyeriId,
            'gidecek_yer_turu_id' => $gidecekYerTuruId,
            'analiz_status' => $analizStatus,
            'hal_sorgu_tarihi' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if ($existing) {
            $db->update('product_hal_data', $halData, 'id = ?', [$existing['id']]);
        } else {
            $halData['id'] = $db->generateUuid();
            $halData['created_at'] = date('Y-m-d H:i:s');
            $db->insert('product_hal_data', $halData);
        }

        // Dağıtım logunu kaydet
        $db->insert('hal_distribution_logs', [
            'id' => $db->generateUuid(),
            'company_id' => $companyId,
            'kunye_no' => $kunyeNo,
            'product_id' => $productId,
            'belge_no' => $belgeNo,
            'distribution_type' => $type,
            'assigned_miktar' => $miktar,
            'kalan_miktar' => $kalanMiktar,
            'sifat_id' => $sifatId,
            'bildirim_tarihi' => $bildirimTarihi,
            'malin_adi' => $malinAdi,
            'malin_cinsi' => $malinCinsi,
            'distributed_by' => $userId,
            'created_at' => date('Y-m-d H:i:s')
        ]);

        $distributed++;
        $updatedProductIds[] = $productId;

    } catch (Exception $e) {
        error_log("HAL distribute error for kunye {$kunyeNo}: " . $e->getMessage());
        $errors[] = [
            'index' => $idx,
            'error' => 'Kayıt hatası: ' . $e->getMessage(),
            'kunye_no' => $kunyeNo
        ];
    }
}

if (!empty($updatedProductIds)) {
    try {
        $renderCacheService = new RenderCacheService();
        $renderCacheService->onBulkProductsUpdated(
            array_values(array_unique($updatedProductIds)),
            $companyId,
            'hal_distribute',
            ['priority' => 'high', 'user_id' => $userId]
        );
    } catch (Throwable $e) {
        error_log('[HAL distribute] Render cache refresh failed: ' . $e->getMessage());
    }
}

Response::success([
    'distributed' => $distributed,
    'skipped' => $skipped,
    'errors' => $errors,
    'total' => count($input['assignments'])
], $distributed > 0
    ? "{$distributed} künye başarıyla dağıtıldı"
    : 'Dağıtım yapılamadı'
);
