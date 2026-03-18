<?php
/**
 * Branches API - Create
 * POST /api/branches
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

$companyId = Auth::getActiveCompanyId();

// Zorunlu alanlar
$code = $request->input('code');
$name = $request->input('name');

if (empty($code) || empty($name)) {
    Response::error('Şube kodu ve adı zorunludur', 400);
}

// Veriyi hazırla
$branchData = [
    'company_id' => $companyId,
    'code' => $code,
    'name' => $name,
    'type' => $request->input('type', 'store'),
    'parent_id' => $request->input('parent_id'),
    'external_code' => $request->input('external_code'),
    'address' => $request->input('address'),
    'city' => $request->input('city'),
    'district' => $request->input('district'),
    'postal_code' => $request->input('postal_code'),
    'country' => $request->input('country', 'TR'),
    'phone' => $request->input('phone'),
    'email' => $request->input('email'),
    'latitude' => $request->input('latitude'),
    'longitude' => $request->input('longitude'),
    'manager_user_id' => $request->input('manager_user_id'),
    'timezone' => $request->input('timezone', 'Europe/Istanbul'),
    'currency' => $request->input('currency', 'TRY'),
    'is_active' => $request->input('is_active', 1),
    'is_virtual' => $request->input('is_virtual', 0),
    'settings' => $request->input('settings'),
    'sort_order' => $request->input('sort_order') ?: (function() use ($db, $companyId) {
        $max = $db->fetch("SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM branches WHERE company_id = ?", [$companyId]);
        return ($max['max_sort'] ?? 0) + 1;
    })()
];

$result = BranchService::create($branchData);

if ($result['success']) {
    // Audit log
    Logger::info("Branch created: {$result['data']['code']}", [
        'branch_id' => $result['data']['id'],
        'user_id' => $user['id']
    ]);

    Response::success($result['data'], 'Şube oluşturuldu');
} else {
    Response::error($result['error'], 400);
}
