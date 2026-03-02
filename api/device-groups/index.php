<?php
/**
 * Device Groups - List
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

try {
    $groups = $db->fetchAll(
        "SELECT dg.*,
                (SELECT COUNT(*) FROM device_group_members dgm WHERE dgm.group_id = dg.id) as device_count
         FROM device_groups dg
         WHERE dg.company_id = ?
         ORDER BY dg.name ASC",
        [$companyId]
    );

    // Get device IDs for each group
    foreach ($groups as &$group) {
        $members = $db->fetchAll(
            "SELECT device_id FROM device_group_members WHERE group_id = ?",
            [$group['id']]
        );
        $group['device_ids'] = array_column($members, 'device_id');
    }

    Response::success($groups);
} catch (Exception $e) {
    Logger::error('Device groups list error', ['error' => $e->getMessage()]);
    Response::serverError('Gruplar yuklenemedi');
}
