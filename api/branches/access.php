<?php
/**
 * Branch User Access API
 *
 * GET /api/branches/:id/access - Erişim listesi
 * POST /api/branches/:id/access - Erişim ver
 * DELETE /api/branches/:id/access/:userId - Erişim kaldır
 */

require_once __DIR__ . '/../../services/BranchService.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Yetki kontrolü: Admin veya SuperAdmin
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

$method = $_SERVER['REQUEST_METHOD'];

// ==================== GET: Erişim Listesi ====================
if ($method === 'GET') {
    $accesses = $db->fetchAll(
        "SELECT uba.*, u.first_name, u.last_name, u.email, u.role as user_role
         FROM user_branch_access uba
         JOIN users u ON uba.user_id = u.id
         WHERE uba.branch_id = ?
         ORDER BY uba.is_default DESC, u.first_name",
        [$branchId]
    );

    Response::success($accesses);
}

// ==================== POST: Erişim Ver ====================
if ($method === 'POST') {
    $userId = $request->input('user_id');

    if (empty($userId)) {
        Response::error('Kullanıcı ID gerekli', 400);
    }

    // Kullanıcı aynı firmada mı kontrol et
    $targetUser = $db->fetch(
        "SELECT id, company_id FROM users WHERE id = ?",
        [$userId]
    );

    if (!$targetUser) {
        Response::error('Kullanıcı bulunamadı', 404);
    }

    if ($targetUser['company_id'] !== $companyId) {
        Response::error('Farklı firmadan kullanıcıya erişim verilemez', 400);
    }

    // Mevcut erişim kontrolü
    $existing = $db->fetch(
        "SELECT id FROM user_branch_access WHERE user_id = ? AND branch_id = ?",
        [$userId, $branchId]
    );

    $accessLevel = $request->input('access_level', 'full');
    $isDefault = $request->input('is_default', 0);

    if ($existing) {
        // Güncelle
        $db->update('user_branch_access', [
            'access_level' => $accessLevel,
            'is_default' => $isDefault
        ], 'id = ?', [$existing['id']]);

        Response::success(null, 'Erişim güncellendi');
    } else {
        // Yeni ekle
        $db->insert('user_branch_access', [
            'id' => $db->generateUuid(),
            'user_id' => $userId,
            'branch_id' => $branchId,
            'access_level' => $accessLevel,
            'is_default' => $isDefault,
            'granted_by' => $user['id']
        ]);

        Response::success(null, 'Erişim verildi');
    }
}

// ==================== DELETE: Erişim Kaldır ====================
if ($method === 'DELETE') {
    $userId = $request->routeParam('userId') ?? $_GET['user_id'] ?? null;

    if (!$userId) {
        Response::error('Kullanıcı ID gerekli', 400);
    }

    $deleted = $db->delete(
        'user_branch_access',
        'user_id = ? AND branch_id = ?',
        [$userId, $branchId]
    );

    if ($deleted > 0) {
        Response::success(null, 'Erişim kaldırıldı');
    } else {
        Response::error('Erişim kaydı bulunamadı', 404);
    }
}

Response::error('Geçersiz istek', 400);
