<?php
/**
 * Branches API - Delete
 * DELETE /api/branches/:id
 */

require_once __DIR__ . '/../../services/BranchService.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Yetki kontrolü
if (!in_array($user['role'], ['Admin', 'SuperAdmin'])) {
    Response::error('Bu işlem için yetkiniz yok', 403);
}

$branchId = $request->routeParam('id');
if (!$branchId) {
    Response::error('Şube ID gerekli', 400);
}

$companyId = Auth::getActiveCompanyId();

// Şube kontrolü
$branch = $db->fetch(
    "SELECT * FROM branches WHERE id = ? AND company_id = ?",
    [$branchId, $companyId]
);

if (!$branch) {
    Response::error('Şube bulunamadı', 404);
}

// Etkilenen verileri kontrol et
$deleteInfo = BranchService::delete($branchId);

if (!$deleteInfo['success']) {
    Response::error($deleteInfo['error'], 400);
}

$affected = $deleteInfo['affected'];

// Force delete istenmişse
if (isset($_GET['force']) && $_GET['force'] === 'true') {
    BranchService::forceDelete($branchId);

    Logger::info("Branch force deleted: {$branch['code']}", [
        'branch_id' => $branchId,
        'user_id' => $user['id'],
        'affected' => $affected
    ]);

    Response::success(null, 'Şube silindi');
}

// Etkilenen veriler varsa onay iste
if ($affected['devices'] > 0 || $affected['overrides'] > 0 ||
    $affected['user_access'] > 0 || $affected['children'] > 0) {

    Response::success([
        'requires_confirmation' => true,
        'branch' => $deleteInfo['branch'],
        'affected' => $affected,
        'message' => 'Şube silinirse bağlı veriler de etkilenecek. Onaylıyor musunuz?'
    ]);
}

// Bağlı veri yoksa direkt sil
BranchService::forceDelete($branchId);

Logger::info("Branch deleted: {$branch['code']}", [
    'branch_id' => $branchId,
    'user_id' => $user['id']
]);

Response::success(null, 'Şube silindi');
