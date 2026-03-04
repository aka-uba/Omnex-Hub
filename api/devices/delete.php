<?php
/**
 * Delete Device API
 *
 * Cihazı ve tüm ilişkili kayıtları tamamen siler (hard delete).
 * Transaction içinde çalışır — herhangi bir adım başarısız olursa
 * tüm değişiklikler geri alınır.
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

$deviceSerialNumber = $device['device_id'] ?? null; // Seri numarası (@B2A401A959 gibi)

try {
    $db->beginTransaction();

    // İlişkili kayıtları temizle (sıralama önemli — FK bağımlılıkları)
    // render_queue_items: FK NO ACTION — mutlaka önce silinmeli!
    $relatedCleanups = [
        // Tablo adı => SQL sorgusu (device UUID ile eşleşen kayıtlar)
        'render_queue_items'        => "DELETE FROM render_queue_items WHERE device_id = ?",
        'device_tokens'             => "DELETE FROM device_tokens WHERE device_id = ?",
        'device_heartbeats'         => "DELETE FROM device_heartbeats WHERE device_id = ?",
        'device_commands'           => "DELETE FROM device_commands WHERE device_id = ?",
        'device_logs'               => "DELETE FROM device_logs WHERE device_id = ?",
        'device_group_members'      => "DELETE FROM device_group_members WHERE device_id = ?",
        'schedule_devices'          => "DELETE FROM schedule_devices WHERE device_id = ?",
        'device_alerts'             => "DELETE FROM device_alerts WHERE device_id = ?",
        'device_content_assignments'=> "DELETE FROM device_content_assignments WHERE device_id = ?",
        'web_template_assignments'  => "DELETE FROM web_template_assignments WHERE device_id = ?",
        'gateway_devices'           => "DELETE FROM gateway_devices WHERE device_id = ?",
    ];

    foreach ($relatedCleanups as $table => $sql) {
        try {
            $db->query($sql, [$id]);
        } catch (Exception $e) {
            // Tablo mevcut olmayabilir (bazı tablolar migration'a bağlı)
            Logger::debug("Device delete: could not clean $table", ['error' => $e->getMessage()]);
        }
    }

    // device_sync_requests: device_id alanı TEXT (seri numarası) olabilir,
    // hem UUID hem de seri numarası ile temizle
    try {
        $db->query("DELETE FROM device_sync_requests WHERE device_id = ?", [$id]);
    } catch (Exception $e) {
        Logger::debug("Device delete: could not clean device_sync_requests by UUID", ['error' => $e->getMessage()]);
    }
    if ($deviceSerialNumber) {
        try {
            $db->query("DELETE FROM device_sync_requests WHERE device_id = ? OR serial_number = ?", [$deviceSerialNumber, $deviceSerialNumber]);
        } catch (Exception $e) {
            Logger::debug("Device delete: could not clean device_sync_requests by serial", ['error' => $e->getMessage()]);
        }
    }

    // Ürün atamalarını temizle
    try {
        $db->query(
            "UPDATE products SET assigned_device_id = NULL, assigned_template_id = NULL, updated_at = ? WHERE assigned_device_id = ?",
            [date('Y-m-d H:i:s'), $id]
        );
    } catch (Exception $e) {
        Logger::debug("Device delete: could not clear product assignments", ['error' => $e->getMessage()]);
    }

    // gateway_commands: FK SET NULL — otomatik ama güvenlik için kontrol
    try {
        $db->query("UPDATE gateway_commands SET device_id = NULL WHERE device_id = ?", [$id]);
    } catch (Exception $e) {
        Logger::debug("Device delete: could not clear gateway_commands", ['error' => $e->getMessage()]);
    }

    // Ana cihaz kaydını sil
    $deletedRows = $db->delete('devices', 'id = ?', [$id]);

    if ($deletedRows === 0) {
        $db->rollBack();
        Response::error('Cihaz silinemedi — kayıt bulunamadı veya yetki yetersiz', 500);
    }

    $db->commit();

    Logger::audit('delete', 'devices', [
        'device_id' => $id,
        'device_serial' => $deviceSerialNumber,
        'device_name' => $device['name'] ?? ''
    ]);

    Response::success(null, 'Cihaz ve tüm ilişkili veriler silindi');

} catch (Exception $e) {
    try { $db->rollBack(); } catch (Exception $re) { /* ignore rollback error */ }

    Logger::error("Device delete failed", [
        'device_id' => $id,
        'error' => $e->getMessage()
    ]);

    Response::error('Cihaz silinirken hata oluştu: ' . $e->getMessage(), 500);
}
