<?php
/**
 * Device Groups - Update
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');
$data = $request->json();

try {
    // Check if group exists
    $group = $db->fetch(
        "SELECT * FROM device_groups WHERE id = ? AND company_id = ?",
        [$id, $companyId]
    );

    if (!$group) {
        Response::notFound('Grup bulunamadi');
    }

    // Update group
    $updateData = [
        'updated_at' => date('Y-m-d H:i:s')
    ];

    if (isset($data['name'])) $updateData['name'] = $data['name'];
    if (isset($data['description'])) $updateData['description'] = $data['description'];
    if (isset($data['color'])) $updateData['color'] = $data['color'];
    if (isset($data['device_type'])) $updateData['device_type'] = $data['device_type'];

    $db->update('device_groups', $updateData, 'id = ?', [$id]);

    // Update device members if provided
    if (isset($data['device_ids']) && is_array($data['device_ids'])) {
        // Remove existing members
        $db->delete('device_group_members', 'group_id = ?', [$id]);

        // Add new members
        foreach ($data['device_ids'] as $deviceId) {
            $db->insert('device_group_members', [
                'id' => $db->generateUuid(),
                'group_id' => $id,
                'device_id' => $deviceId,
                'created_at' => date('Y-m-d H:i:s')
            ]);
        }
    }

    // Log
    Logger::audit('update', 'device_group', [
        'id' => $id,
        'old' => $group,
        'new' => $data
    ]);

    Response::success(['message' => 'Grup guncellendi']);
} catch (Exception $e) {
    Logger::error('Device group update error', ['error' => $e->getMessage()]);
    Response::serverError('Grup guncellenemedi');
}
