<?php
/**
 * Device Groups - Delete
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');

try {
    // Check if group exists
    $group = $db->fetch(
        "SELECT * FROM device_groups WHERE id = ? AND company_id = ?",
        [$id, $companyId]
    );

    if (!$group) {
        Response::notFound('Grup bulunamadi');
    }

    // Delete members first
    $db->delete('device_group_members', 'group_id = ?', [$id]);

    // Delete group
    $db->delete('device_groups', 'id = ?', [$id]);

    // Log
    Logger::audit('delete', 'device_group', [
        'id' => $id,
        'old' => $group
    ]);

    Response::success(['message' => 'Grup silindi']);
} catch (Exception $e) {
    Logger::error('Device group delete error', ['error' => $e->getMessage()]);
    Response::serverError('Grup silinemedi');
}
