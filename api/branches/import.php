<?php
/**
 * Branch Import API
 *
 * POST /api/branches/:id/import - Şubeye fiyat/stok/kampanya import
 * GET /api/branches/:id/import/history - Import geçmişi
 */

require_once __DIR__ . '/../../services/BranchImportService.php';
require_once __DIR__ . '/../../services/BranchService.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$branchId = $request->routeParam('id');
if (!$branchId) {
    Response::error('Şube ID gerekli', 400);
}

$companyId = Auth::getActiveCompanyId();

// Şube erişim kontrolü
if (!BranchService::userHasAccess($user['id'], $branchId)) {
    Response::error('Bu şubeye erişim yetkiniz yok', 403);
}

$method = $_SERVER['REQUEST_METHOD'];

// ==================== GET: Import Geçmişi ====================
if ($method === 'GET') {
    $history = BranchImportService::getImportHistory($branchId, 20);
    Response::success($history);
}

// ==================== POST: Import ====================
if ($method === 'POST') {
    // Dosya kontrolü
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        Response::error('Dosya yüklenemedi', 400);
    }

    $file = $_FILES['file'];

    // Boyut kontrolü (max 10MB)
    if ($file['size'] > 10 * 1024 * 1024) {
        Response::error('Dosya boyutu çok büyük (max 10MB)', 400);
    }

    // Uzantı kontrolü
    $allowedExtensions = ['csv', 'txt', 'json', 'xml', 'xlsx', 'xls'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExtensions)) {
        Response::error('Desteklenmeyen dosya formatı', 400);
    }

    // Import parametreleri
    $importType = $_POST['type'] ?? 'price'; // price, stock, campaign, full
    $importMode = $_POST['mode'] ?? 'skip_if_manual'; // overwrite, skip_if_manual, merge

    // Mapping (isteğe bağlı)
    $mapping = null;
    if (!empty($_POST['mapping'])) {
        $mapping = json_decode($_POST['mapping'], true);
    }

    // Import çalıştır
    $result = BranchImportService::import(
        $file['tmp_name'],
        $branchId,
        $companyId,
        [
            'type' => $importType,
            'mode' => $importMode,
            'mapping' => $mapping,
            'source_name' => $file['name'],
            'user_id' => $user['id']
        ]
    );

    if ($result['success']) {
        Logger::info("Branch import completed", [
            'branch_id' => $branchId,
            'file' => $file['name'],
            'summary' => $result['summary']
        ]);

        Response::success($result);
    } else {
        Response::error($result['error'], 400);
    }
}

Response::error('Geçersiz istek', 400);
