<?php
/**
 * Device Groups - Bulk Action
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');
$data = $request->json();

$action = $data['action'] ?? null;

if (!$action) {
    Response::badRequest('Islem tipi zorunludur');
}

try {
    // Get group
    $group = $db->fetch(
        "SELECT * FROM device_groups WHERE id = ? AND company_id = ?",
        [$id, $companyId]
    );

    if (!$group) {
        Response::notFound('Grup bulunamadi');
    }

    // Get devices in group
    $devices = $db->fetchAll(
        "SELECT d.* FROM devices d
         INNER JOIN device_group_members dgm ON d.id = dgm.device_id
         WHERE dgm.group_id = ?",
        [$id]
    );

    if (empty($devices)) {
        Response::badRequest('Grupta cihaz yok');
    }

    $successCount = 0;
    $errorCount = 0;

    foreach ($devices as $device) {
        try {
            switch ($action) {
                case 'template':
                    // Send template to device
                    $templateId = $data['template_id'] ?? null;
                    if ($templateId) {
                        // Here would be the actual device communication
                        // For now, just log the action
                        $db->insert('device_commands', [
                            'id' => $db->generateUuid(),
                            'device_id' => $device['id'],
                            'command' => 'send_template',
                            'parameters' => json_encode(['template_id' => $templateId]),
                            'status' => 'pending',
                            'created_at' => date('Y-m-d H:i:s')
                        ]);
                        $successCount++;
                    }
                    break;

                case 'playlist':
                    // Send playlist to device
                    $playlistId = $data['playlist_id'] ?? null;
                    if ($playlistId) {
                        $db->insert('device_commands', [
                            'id' => $db->generateUuid(),
                            'device_id' => $device['id'],
                            'command' => 'send_playlist',
                            'parameters' => json_encode(['playlist_id' => $playlistId]),
                            'status' => 'pending',
                            'created_at' => date('Y-m-d H:i:s')
                        ]);
                        $successCount++;
                    }
                    break;

                case 'refresh':
                    $db->insert('device_commands', [
                        'id' => $db->generateUuid(),
                        'device_id' => $device['id'],
                        'command' => 'refresh',
                        'parameters' => null,
                        'status' => 'pending',
                        'created_at' => date('Y-m-d H:i:s')
                    ]);
                    $successCount++;
                    break;

                case 'restart':
                    $db->insert('device_commands', [
                        'id' => $db->generateUuid(),
                        'device_id' => $device['id'],
                        'command' => 'restart',
                        'parameters' => null,
                        'status' => 'pending',
                        'created_at' => date('Y-m-d H:i:s')
                    ]);
                    $successCount++;
                    break;

                default:
                    $errorCount++;
            }
        } catch (Exception $e) {
            $errorCount++;
        }
    }

    // Log
    Logger::audit('bulk_action', 'device_group', [
        'id' => $id,
        'action' => $action,
        'success' => $successCount,
        'errors' => $errorCount
    ]);

    Response::success([
        'message' => "Islem tamamlandi: $successCount basarili, $errorCount hatali",
        'success_count' => $successCount,
        'error_count' => $errorCount
    ]);
} catch (Exception $e) {
    Logger::error('Device group bulk action error', ['error' => $e->getMessage()]);
    Response::serverError('Islem basarisiz');
}
