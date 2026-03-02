<?php
/**
 * Delete Device API
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');

$device = $db->fetch("SELECT * FROM devices WHERE id = ? AND company_id = ?", [$id, $companyId]);

if (!$device) {
    Response::notFound('Cihaz bulunamadı');
}

// Clear related records before deleting device (with error suppression for missing tables)
$relatedCleanups = [
    // Table => SQL query
    'render_queue_items' => "DELETE FROM render_queue_items WHERE device_id = ?",
    'device_tokens' => "DELETE FROM device_tokens WHERE device_id = ?",
    'device_heartbeats' => "DELETE FROM device_heartbeats WHERE device_id = ?",
    'device_commands' => "DELETE FROM device_commands WHERE device_id = ?",
    'device_sync_requests' => "DELETE FROM device_sync_requests WHERE device_id = ?",
    'device_logs' => "DELETE FROM device_logs WHERE device_id = ?",
    'device_group_members' => "DELETE FROM device_group_members WHERE device_id = ?",
    'schedule_devices' => "DELETE FROM schedule_devices WHERE device_id = ?",
    'gateway_device_assignments' => "DELETE FROM gateway_device_assignments WHERE device_id = ?",
    'device_alerts' => "DELETE FROM device_alerts WHERE device_id = ?",
    'device_content_assignments' => "DELETE FROM device_content_assignments WHERE device_id = ?",
];

foreach ($relatedCleanups as $table => $sql) {
    try {
        $db->query($sql, [$id]);
    } catch (Exception $e) {
        // Table might not exist, ignore
        Logger::debug("Device delete: could not clean $table", ['error' => $e->getMessage()]);
    }
}

// Clear products assigned to this device
try {
    $db->query("UPDATE products SET assigned_device_id = NULL, assigned_template_id = NULL, updated_at = ? WHERE assigned_device_id = ?", [date('Y-m-d H:i:s'), $id]);
} catch (Exception $e) {
    Logger::debug("Device delete: could not clear product assignments", ['error' => $e->getMessage()]);
}

// Now delete the device
$db->delete('devices', 'id = ?', [$id]);

Logger::audit('delete', 'devices', ['device_id' => $id, 'device_name' => $device['name']]);

Response::success(null, 'Cihaz silindi');
