<?php
/**
 * Tenant Backup Cron Job
 *
 * Tüm aktif firmaları sırayla yedekler. Döngü ayarlarına göre çalışır.
 * SuperAdmin panelden yönetilir (ayarlar: cycle, retention, media toggle).
 *
 * Kullanım:
 *   php cron/tenant-backup.php
 *
 * Cron ayarı (günlük gece 4:00):
 *   0 4 * * * php /path/to/cron/tenant-backup.php >> /var/log/tenant-backup.log 2>&1
 */

// CLI-only
if (php_sapi_name() !== 'cli') {
    die('CLI only');
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/Logger.php';
require_once __DIR__ . '/../services/TenantBackupService.php';
require_once __DIR__ . '/../services/NotificationTriggers.php';

echo "[" . date('Y-m-d H:i:s') . "] Tenant backup cron started\n";

$service = TenantBackupService::getInstance();
$db = Database::getInstance();

// Check if should run
if (!$service->shouldCronRun()) {
    echo "Backup cycle not due yet or disabled. Skipping.\n";
    exit(0);
}

// Set SuperAdmin context for RLS bypass
$db->setAppContext(null, null, 'SuperAdmin');

$settings = $service->getBackupSettings();
$includeMedia = $settings['include_media_default'] ?? false;
$retentionCount = $settings['retention_count'] ?? 7;

// Get all active companies
$companies = $db->fetchAll("SELECT id, name, slug FROM companies WHERE status = 'active' ORDER BY name");

if (empty($companies)) {
    echo "No active companies found.\n";
    exit(0);
}

echo "Found " . count($companies) . " active companies.\n";

$successCount = 0;
$failCount = 0;
$totalSize = 0;

foreach ($companies as $company) {
    echo "\nBacking up: {$company['name']} ({$company['id']})...";

    try {
        $result = $service->exportCompany($company['id'], [
            'include_media' => $includeMedia,
            'backup_type'   => 'scheduled',
            'created_by'    => null,
        ]);

        if ($result['success']) {
            $successCount++;
            $totalSize += ($result['file_size'] ?? 0);
            $sizeMB = round(($result['file_size'] ?? 0) / 1048576, 1);
            echo " OK ({$sizeMB} MB)\n";

            // Apply retention
            $deleted = $service->applyRetention($company['id'], $retentionCount);
            if ($deleted > 0) {
                echo "  Retention: {$deleted} old backup(s) deleted\n";
            }
        } else {
            $failCount++;
            echo " FAILED: " . ($result['error'] ?? 'Unknown') . "\n";
            NotificationTriggers::onTenantBackupFailed($company['id'], $result['error'] ?? 'Unknown error');
        }
    } catch (Exception $e) {
        $failCount++;
        echo " ERROR: " . $e->getMessage() . "\n";
        Logger::error('Tenant backup cron: Company backup failed', [
            'company_id' => $company['id'],
            'error'      => $e->getMessage(),
        ]);
    }
}

// Update last_cron_run
$settings['last_cron_run'] = date('c');
$service->saveBackupSettings($settings);

// Summary
$totalSizeMB = round($totalSize / 1048576, 1);
echo "\n[" . date('Y-m-d H:i:s') . "] Backup cron completed.\n";
echo "Success: {$successCount}, Failed: {$failCount}, Total size: {$totalSizeMB} MB\n";

// System notification if failures
if ($failCount > 0) {
    NotificationTriggers::systemAnnouncement(
        'Otomatik Yedekleme Raporu',
        "Başarılı: {$successCount}, Başarısız: {$failCount}. Detaylar için admin paneli kontrol edin.",
        'warning',
        '#/admin/backups'
    );
}

exit($failCount > 0 ? 1 : 0);
