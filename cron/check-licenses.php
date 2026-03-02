<?php
/**
 * Lisans Süresi Kontrol Cron Job
 *
 * Günde bir kez çalıştırılmalı:
 * 0 9 * * * php /path/to/market-etiket-sistemi/cron/check-licenses.php
 *
 * @package OmnexDisplayHub
 */

// CLI kontrolü
if (php_sapi_name() !== 'cli') {
    die('Bu script sadece CLI üzerinden çalıştırılabilir.');
}

// Config yükle
require_once dirname(__DIR__) . '/config.php';

echo "=== Lisans Kontrolü Başlatıldı ===\n";
echo "Tarih: " . date('Y-m-d H:i:s') . "\n\n";

try {
    // Önce süresi dolmuş lisansları expired olarak işaretle
    $expiredCount = LicenseService::markExpiredLicenses();
    if ($expiredCount > 0) {
        echo "Süresi dolmuş {$expiredCount} lisans expired olarak işaretlendi.\n\n";
    }

    $results = LicenseMiddleware::checkExpiringLicenses();

    if (empty($results)) {
        echo "Bildirim gönderilecek lisans bulunamadı.\n";
    } else {
        echo "Bildirim gönderilen lisanslar:\n";
        echo str_repeat('-', 60) . "\n";

        foreach ($results as $r) {
            $status = $r['days_left'] < 0 ? 'SÜRESI DOLDU' : "{$r['days_left']} gün kaldı";
            echo sprintf(
                "Firma: %s\nDurum: %s\n%s\n",
                $r['company_name'] ?? $r['company_id'],
                $status,
                str_repeat('-', 60)
            );
        }

        echo "\nToplam: " . count($results) . " bildirim gönderildi.\n";
    }

} catch (Exception $e) {
    echo "HATA: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n=== Lisans Kontrolü Tamamlandı ===\n";
