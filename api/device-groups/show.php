<?php
/**
 * Device Groups - Show
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');

try {
    $group = $db->fetch(
        "SELECT dg.*,
                (SELECT COUNT(*) FROM device_group_members dgm WHERE dgm.group_id = dg.id) as device_count
         FROM device_groups dg
         WHERE dg.id = ? AND dg.company_id = ?",
        [$id, $companyId]
    );

    if (!$group) {
        Response::notFound('Grup bulunamadi');
    }

    // Get device IDs
    $members = $db->fetchAll(
        "SELECT device_id FROM device_group_members WHERE group_id = ?",
        [$id]
    );
    $group['device_ids'] = array_column($members, 'device_id');

    Response::success($group);
} catch (Exception $e) {
    Logger::error('Device group show error', ['error' => $e->getMessage()]);
    Response::serverError('Grup yuklenemedi');
}
