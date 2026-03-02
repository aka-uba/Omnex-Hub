<?php
require_once __DIR__ . '/../config.php';

$db = Database::getInstance();

// Hanshow queue'daki callback sonuçları
$queue = $db->fetchAll("SELECT * FROM hanshow_queue ORDER BY created_at DESC LIMIT 10");
echo "=== Hanshow Queue (Son 10) ===\n";
foreach ($queue as $q) {
    echo "ESL: {$q['esl_id']} | Status: {$q['status']} | Type: {$q['request_type']} | Created: {$q['created_at']}\n";
    if (!empty($q['response_data'])) {
        echo "Response: {$q['response_data']}\n";
    }
    echo "---\n";
}

// Devices tablosundan Hanshow ESL bilgileri
echo "\n=== Hanshow ESL Cihazları (devices tablosu) ===\n";
$devices = $db->fetchAll("SELECT device_id, name, status, battery_level, signal_strength, last_seen, last_heartbeat FROM devices WHERE manufacturer = 'Hanshow'");
foreach ($devices as $d) {
    echo "ID: {$d['device_id']}\n";
    echo "  Batarya: " . ($d['battery_level'] ?? 'N/A') . "%\n";
    echo "  Sinyal: " . ($d['signal_strength'] ?? 'N/A') . " dBm\n";
    echo "  Durum: {$d['status']}\n";
    echo "  Son Görülme: " . ($d['last_seen'] ?? 'N/A') . "\n";
    echo "---\n";
}
