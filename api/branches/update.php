<?php
/**
 * Branches API - Update
 * PUT /api/branches/:id
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

$data = $request->all();
$companyId = Auth::getActiveCompanyId();

// Şube kontrolü
$branch = $db->fetch(
    "SELECT * FROM branches WHERE id = ? AND company_id = ?",
    [$branchId, $companyId]
);

if (!$branch) {
    Response::error('Şube bulunamadı', 404);
}

$result = BranchService::update($branchId, $data);

if ($result['success']) {
    Logger::info("Branch updated: {$branch['code']}", [
        'branch_id' => $branchId,
        'user_id' => $user['id']
    ]);

    Response::success($result['data'], 'Şube güncellendi');
} else {
    Response::error($result['error'], 400);
}
