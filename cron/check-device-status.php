#!/usr/bin/env php
<?php
/**
 * Cron: Cihaz durumlarını kontrol et ve offline olan cihazları işaretle
 *
 * Çalıştırma: Her 1 dakikada bir
 * Crontab: * * * * * php /path/to/check-device-status.php
 *
 * Windows Task Scheduler:
 * Program: C:\xampp\php\php.exe
 * Arguments: C:\xampp\htdocs\market-etiket-sistemi\cron\check-device-status.php
 * Trigger: Every 1 minute
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';

$db = Database::getInstance();
$now = date('Y-m-d H:i:s');

// Timeout süresi: 2 dakika (heartbeat 30sn, 2dk timeout = 4 missed heartbeat)
$offlineThreshold = 120; // seconds

echo "[" . date('Y-m-d H:i:s') . "] Checking device status...\n";

try {
    // Online olarak işaretlenmiş ama son 2 dakikada heartbeat atmayan cihazları bul
    $sql = "
        SELECT
            d.id,
            d.name,
            d.type,
            d.status as current_status,
            d.last_seen,
            d.last_online,
            d.company_id,
            COALESCE(d.last_seen, d.last_online) as last_activity,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(d.last_seen, d.last_online)))::bigint as seconds_ago
        FROM devices d
        WHERE d.status = 'online'
          AND d.type IN ('android_tv', 'web_display', 'esl')
          AND COALESCE(d.last_seen, d.last_online) IS NOT NULL
          AND EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE(d.last_seen, d.last_online))) > ?
    ";

    $devicesToOffline = $db->fetchAll($sql, [$offlineThreshold]);

    if (empty($devicesToOffline)) {
        echo "✅ All devices are healthy (no timeout detected)\n";
        exit(0);
    }

    echo "⚠️  Found " . count($devicesToOffline) . " device(s) with timeout:\n";

    $updatedCount = 0;

    foreach ($devicesToOffline as $device) {
        $minutesAgo = round($device['seconds_ago'] / 60, 1);

        echo "  - [{$device['name']}] (Type: {$device['type']}) - Last seen: {$minutesAgo} min ago\n";

        // Update status to offline
        $db->update('devices', [
            'status' => 'offline',
            'updated_at' => $now
        ], 'id = ?', [$device['id']]);

        $updatedCount++;

        // Optional: Create notification for admin
        if (PRODUCTION_MODE) {
            try {
                require_once __DIR__ . '/../services/NotificationService.php';

                NotificationService::create([
                    'title' => 'Cihaz Çevrimdışı',
                    'message' => "'{$device['name']}' cihazı {$minutesAgo} dakikadır çevrimdışı",
                    'type' => 'warning',
                    'target_type' => 'device',
                    'target_id' => $device['id'],
                    'company_id' => $device['company_id'],
                    'channels' => ['app']
                ]);
            } catch (Exception $e) {
                echo "    ⚠️  Notification failed: {$e->getMessage()}\n";
            }
        }
    }

    echo "✅ Updated {$updatedCount} device(s) to offline status\n";

    // Cleanup: Eski heartbeat kayıtlarını sil (30 günden eski)
    $cleanupSql = "DELETE FROM device_heartbeats WHERE created_at < now() - INTERVAL '30 days'";
    $cleanupStmt = $db->query($cleanupSql);
    $deletedRows = $cleanupStmt->rowCount();

    if ($deletedRows > 0) {
        echo "🧹 Cleaned up {$deletedRows} old heartbeat record(s)\n";
    }

} catch (Exception $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

echo "[" . date('Y-m-d H:i:s') . "] Device status check completed\n";
exit(0);
