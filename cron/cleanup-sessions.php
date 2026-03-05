<?php
/**
 * Session Cleanup Cron
 *
 * Süresi dolmuş sessionları temizler
 *
 * Kullanım:
 * php cron/cleanup-sessions.php
 *
 * Windows Task Scheduler: Her gece 03:00'te çalıştır
 */

require_once __DIR__ . '/../config.php';

$startTime = microtime(true);
$db = Database::getInstance();

// Süresi dolmuş sessionları say
$expiredCount = $db->fetchColumn("SELECT COUNT(*) FROM sessions WHERE expires_at <= now()");

// Süresi dolmuş sessionları sil
$db->query("DELETE FROM sessions WHERE expires_at <= now()");

$duration = round((microtime(true) - $startTime) * 1000, 2);

Logger::info("Session cleanup completed", [
    'deleted_sessions' => $expiredCount,
    'duration_ms' => $duration
]);

echo "[" . date('Y-m-d H:i:s') . "] Session cleanup completed: {$expiredCount} expired sessions deleted ({$duration}ms)\n";
