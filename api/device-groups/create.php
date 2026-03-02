<?php
/**
 * Device Groups - Create
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$data = $request->json();

if (empty($data['name'])) {
    Response::badRequest('Grup adi zorunludur');
}

try {
    $id = $db->generateUuid();

    $db->insert('device_groups', [
        'id' => $id,
        'company_id' => $companyId,
        'name' => $data['name'],
        'description' => $data['description'] ?? null,
        'color' => $data['color'] ?? '#228be6',
        'device_type' => $data['device_type'] ?? null,
        'created_by' => $user['id'],
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s')
    ]);

    // Add devices if provided
    if (!empty($data['device_ids']) && is_array($data['device_ids'])) {
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
    Logger::audit('create', 'device_group', [
        'id' => $id,
        'new' => $data
    ]);

    Response::created(['id' => $id, 'message' => 'Grup olusturuldu']);
} catch (Exception $e) {
    Logger::error('Device group create error', ['error' => $e->getMessage()]);
    Response::serverError('Grup olusturulamadi');
}
