<?php
/**
 * Device Heartbeat Cron
 *
 * Tüm ESL cihazlarının online/offline durumunu kontrol eder
 * Hafif TCP ping kullanarak yük oluşturmadan hızlı kontrol yapar
 *
 * Kullanım:
 * php cron/device-heartbeat.php
 *
 * Windows Task Scheduler: Her 30 saniyede bir çalıştır
 * Eylem: C:\xampp\php\php.exe
 * Argüman: C:\xampp\htdocs\market-etiket-sistemi\cron\device-heartbeat.php
 */

require_once __DIR__ . '/../config.php';
require_once BASE_PATH . '/services/PavoDisplayGateway.php';

// Lock dosyası - aynı anda birden fazla çalışmayı engelle
$lockFile = BASE_PATH . '/storage/device-heartbeat.lock';
$lockFp = fopen($lockFile, 'c');
if (!$lockFp || !flock($lockFp, LOCK_EX | LOCK_NB)) {
    echo "[" . date('Y-m-d H:i:s') . "] UYARI: Başka bir device-heartbeat işlemi zaten çalışıyor.\n";
    exit(0);
}
ftruncate($lockFp, 0);
fwrite($lockFp, (string)getmypid());

$startTime = microtime(true);
$db = Database::getInstance();
$gateway = new PavoDisplayGateway();

// Tüm ESL cihazları al (sadece aktif olanlar)
$devices = $db->fetchAll(
    "SELECT id, ip_address, device_id, company_id, status, name
     FROM devices
     WHERE type = 'esl' AND status != 'inactive' AND ip_address IS NOT NULL AND ip_address != ''"
);

$totalDevices = count($devices);
$onlineCount = 0;
$offlineCount = 0;
$statusChangedCount = 0;

Logger::info("Heartbeat started for {$totalDevices} devices");

foreach ($devices as $device) {
    try {
        // Hafif ping (sadece TCP bağlantı kontrolü, HTTP isteği yok)
        $pingResult = $gateway->ping($device['ip_address'], true);

        $newStatus = $pingResult['online'] ? 'online' : 'offline';
        $oldStatus = $device['status'];

        // İstatistik
        if ($newStatus === 'online') {
            $onlineCount++;
        } else {
            $offlineCount++;
        }

        // Sadece durum değiştiyse güncelle (gereksiz DB yazma önlenir)
        if ($oldStatus !== $newStatus) {
            $db->update('devices', [
                'status' => $newStatus,
                'last_seen' => $pingResult['online'] ? date('Y-m-d H:i:s') : ($device['last_seen'] ?? date('Y-m-d H:i:s')),
                'updated_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$device['id']]);

            $statusChangedCount++;

            Logger::info("Device status changed", [
                'device_id' => $device['device_id'],
                'device_name' => $device['name'],
                'ip' => $device['ip_address'],
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
                'response_time' => $pingResult['response_time'] ?? null
            ]);
        }
    } catch (Exception $e) {
        Logger::error('Heartbeat ping error', [
            'device_id' => $device['id'],
            'device_name' => $device['name'],
            'ip' => $device['ip_address'],
            'error' => $e->getMessage()
        ]);
    }
}

$duration = round((microtime(true) - $startTime) * 1000, 2);

Logger::info("Heartbeat completed", [
    'total_devices' => $totalDevices,
    'online' => $onlineCount,
    'offline' => $offlineCount,
    'status_changed' => $statusChangedCount,
    'duration_ms' => $duration
]);

// Performans uyarısı (30 saniyeden uzun sürerse)
if ($duration > 30000) {
    Logger::warning("Heartbeat took too long", [
        'duration_ms' => $duration,
        'total_devices' => $totalDevices,
        'suggestion' => 'Consider reducing check interval or optimizing ping method'
    ]);
}

// Lock serbest bırak
flock($lockFp, LOCK_UN);
fclose($lockFp);
@unlink($lockFile);

echo "[" . date('Y-m-d H:i:s') . "] Heartbeat completed: {$onlineCount} online, {$offlineCount} offline, {$statusChangedCount} changed ({$duration}ms)\n";
