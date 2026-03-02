<?php
/**
 * HAL Künye Data API
 * GET /api/hal/data?product_id=xxx - Ürün HAL verisini getir
 * POST /api/hal/data - HAL verisi kaydet/güncelle
 * DELETE /api/hal/data?product_id=xxx - HAL verisini sil
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../core/Database.php';
require_once __DIR__ . '/../../core/Auth.php';
require_once __DIR__ . '/../../core/Response.php';
require_once BASE_PATH . '/services/RenderCacheService.php';

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$db = Database::getInstance();
$companyId = Auth::getActiveCompanyId();
$method = $_SERVER['REQUEST_METHOD'];

// GET - Ürün HAL verisini getir
if ($method === 'GET') {
    $productId = $_GET['product_id'] ?? '';

    if (empty($productId)) {
        Response::error('product_id gerekli', 400);
    }

    $halData = $db->fetch(
        "SELECT * FROM product_hal_data WHERE product_id = ? AND company_id = ?",
        [$productId, $companyId]
    );

    if (!$halData) {
        Response::success(null, 'HAL verisi bulunamadı');
    }

    // JSON alanlarını decode et
    if (!empty($halData['gecmis_bildirimler'])) {
        $halData['gecmis_bildirimler'] = json_decode($halData['gecmis_bildirimler'], true);
    }
    if (!empty($halData['hal_raw_data'])) {
        $halData['hal_raw_data'] = json_decode($halData['hal_raw_data'], true);
    }

    Response::success($halData);
}

// POST - HAL verisi kaydet/güncelle
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    $productId = $input['product_id'] ?? '';
    if (empty($productId)) {
        Response::error('product_id gerekli', 400);
    }

    // Ürünün şirkete ait olduğunu kontrol et
    $product = $db->fetch(
        "SELECT id FROM products WHERE id = ? AND company_id = ?",
        [$productId, $companyId]
    );

    if (!$product) {
        Response::error('Ürün bulunamadı', 404);
    }

    // Mevcut HAL verisi var mı?
    $existing = $db->fetch(
        "SELECT id FROM product_hal_data WHERE product_id = ? AND company_id = ?",
        [$productId, $companyId]
    );

    $halFields = [
        // Migration 057 temel alanlar
        'kunye_no', 'uretici_adi', 'malin_adi', 'malin_cinsi', 'malin_turu',
        'ilk_bildirim_tarihi', 'uretim_yeri', 'malin_sahibi', 'tuketim_bildirim_tarihi',
        'tuketim_yeri', 'gumruk_kapisi', 'uretim_ithal_tarihi', 'miktar', 'alis_fiyati',
        'isletme_adi', 'diger_bilgiler', 'sertifikasyon_kurulusu', 'sertifika_no',
        'gecmis_bildirimler', 'hal_sorgu_tarihi', 'hal_raw_data',
        // Migration 059 ile eklenen SOAP API alanları
        'kalan_miktar', 'birim', 'birim_id', 'bildirim_turu',
        'uretici_tc_vergi_no', 'malin_sahibi_tc_vergi_no', 'bildirimci_tc_vergi_no',
        'arac_plaka_no', 'belge_no', 'belge_tipi',
        'malin_cins_kod_no', 'malin_kod_no', 'malin_turu_kod_no',
        'gidecek_isyeri_id', 'gidecek_yer_turu_id', 'analiz_status'
    ];

    $data = [];
    foreach ($halFields as $field) {
        if (isset($input[$field])) {
            // JSON alanlarını encode et
            if (in_array($field, ['gecmis_bildirimler', 'hal_raw_data']) && is_array($input[$field])) {
                $data[$field] = json_encode($input[$field], JSON_UNESCAPED_UNICODE);
            } else {
                $data[$field] = $input[$field];
            }
        }
    }

    if (empty($data['kunye_no'])) {
        Response::error('kunye_no gerekli', 400);
    }

    $data['updated_at'] = date('Y-m-d H:i:s');

    if ($existing) {
        // Güncelle
        $db->update('product_hal_data', $data, 'id = ?', [$existing['id']]);
        try {
            $renderCacheService = new RenderCacheService();
            $renderCacheService->onProductUpdated($productId, $companyId, 'hal', ['priority' => 'high']);
        } catch (Throwable $e) {
            error_log('[HAL data] Render cache refresh failed: ' . $e->getMessage());
        }
        Response::success(['id' => $existing['id']], 'HAL verisi güncellendi');
    } else {
        // Yeni kayıt
        $data['product_id'] = $productId;
        $data['company_id'] = $companyId;
        $data['created_at'] = date('Y-m-d H:i:s');

        $id = $db->insert('product_hal_data', $data);
        try {
            $renderCacheService = new RenderCacheService();
            $renderCacheService->onProductUpdated($productId, $companyId, 'hal', ['priority' => 'high']);
        } catch (Throwable $e) {
            error_log('[HAL data] Render cache refresh failed: ' . $e->getMessage());
        }
        Response::success(['id' => $id], 'HAL verisi kaydedildi');
    }
}

// DELETE - HAL verisini sil
if ($method === 'DELETE') {
    $productId = $_GET['product_id'] ?? '';

    if (empty($productId)) {
        Response::error('product_id gerekli', 400);
    }

    $deleted = $db->delete(
        'product_hal_data',
        'product_id = ? AND company_id = ?',
        [$productId, $companyId]
    );

    if ($deleted > 0) {
        try {
            $renderCacheService = new RenderCacheService();
            $renderCacheService->onProductUpdated($productId, $companyId, 'hal_delete', ['priority' => 'high']);
        } catch (Throwable $e) {
            error_log('[HAL data] Render cache refresh failed after delete: ' . $e->getMessage());
        }
        Response::success(null, 'HAL verisi silindi');
    } else {
        Response::error('HAL verisi bulunamadı', 404);
    }
}

Response::error('Method not allowed', 405);
