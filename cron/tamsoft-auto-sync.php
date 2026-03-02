<?php
/**
 * TAMSOFT ERP Otomatik Senkronizasyon Cron Job
 *
 * auto_sync_enabled aktif olan firmaların TAMSOFT ERP senkronizasyonunu
 * sync_interval dakika aralığında otomatik çalıştırır.
 *
 * Önerilen cron ayarı (her 5 dakikada bir):
 * 0,5,10,15,20,25,30,35,40,45,50,55 * * * * php /path/to/cron/tamsoft-auto-sync.php
 *
 * Windows Task Scheduler için:
 * php.exe C:\xampp\htdocs\market-etiket-sistemi\cron\tamsoft-auto-sync.php
 *
 * @package OmnexDisplayHub
 */

// CLI kontrolü
if (php_sapi_name() !== 'cli') {
    die('Bu script sadece CLI üzerinden çalıştırılabilir.');
}

// Config yükle
require_once dirname(__DIR__) . '/config.php';
require_once BASE_PATH . '/core/Database.php';
require_once BASE_PATH . '/services/TamsoftGateway.php';

echo "=== TAMSOFT Otomatik Senkronizasyon ===\n";
echo "Tarih: " . date('Y-m-d H:i:s') . "\n\n";

try {
    $db = Database::getInstance();

    // auto_sync_enabled olan firmaları bul
    $companies = $db->fetchAll(
        "SELECT ts.company_id, ts.sync_interval, ts.last_sync_date, ts.default_depo_id,
                c.name as company_name
         FROM tamsoft_settings ts
         LEFT JOIN companies c ON c.id = ts.company_id
         WHERE ts.enabled = 1
           AND ts.auto_sync_enabled = 1
           AND ts.username IS NOT NULL
           AND ts.username != ''"
    );

    if (empty($companies)) {
        echo "Otomatik senkronizasyon aktif firma bulunamadı.\n";
        echo "\n=== Tamamlandı ===\n";
        exit(0);
    }

    echo count($companies) . " firma için otomatik sync kontrol ediliyor...\n\n";

    $syncedCount = 0;
    $skippedCount = 0;
    $errorCount = 0;

    foreach ($companies as $company) {
        $companyId = $company['company_id'];
        $companyName = $company['company_name'] ?? $companyId;
        $syncInterval = intval($company['sync_interval'] ?? 30); // dakika
        $lastSyncDate = $company['last_sync_date'];

        echo "--- Firma: {$companyName} ---\n";
        echo "  Sync aralığı: {$syncInterval} dk\n";
        echo "  Son sync: " . ($lastSyncDate ?: 'Hiç') . "\n";

        // Son sync'ten bu yana yeterli süre geçti mi kontrol et
        if ($lastSyncDate) {
            $lastSyncTime = strtotime($lastSyncDate);
            $intervalSeconds = $syncInterval * 60;
            $nextSyncTime = $lastSyncTime + $intervalSeconds;

            if (time() < $nextSyncTime) {
                $remainingMin = ceil(($nextSyncTime - time()) / 60);
                echo "  Durum: ATLANDI (Sonraki sync'e {$remainingMin} dk kaldı)\n\n";
                $skippedCount++;
                continue;
            }
        }

        // Senkronizasyonu çalıştır
        echo "  Durum: SYNC BAŞLATILIYOR...\n";

        try {
            $gateway = new TamsoftGateway($companyId);

            // Tüm depoları senkronize et
            $result = $gateway->syncAllProducts([
                'full_sync' => false
            ]);

            if ($result['success']) {
                $total = $result['total'] ?? 0;
                $inserted = $result['inserted'] ?? 0;
                $updated = $result['updated'] ?? 0;
                $failed = $result['failed'] ?? 0;
                $depoCount = $result['depo_count'] ?? 0;

                echo "  Sonuç: BAŞARILI\n";
                echo "  Depo: {$depoCount}, Toplam: {$total}, Eklenen: {$inserted}, Güncellenen: {$updated}, Başarısız: {$failed}\n";

                // Sync log kaydı
                $logId = $db->generateUuid();
                $db->insert('tamsoft_sync_logs', [
                    'id' => $logId,
                    'company_id' => $companyId,
                    'status' => 'completed',
                    'total_items' => $total,
                    'inserted' => $inserted,
                    'updated' => $updated,
                    'failed' => $failed,
                    'sync_type' => 'auto',
                    'started_at' => date('Y-m-d H:i:s'),
                    'completed_at' => date('Y-m-d H:i:s'),
                    'created_at' => date('Y-m-d H:i:s')
                ]);

                $syncedCount++;
            } else {
                $errorMsg = $result['errors'][0]['error'] ?? 'Bilinmeyen hata';
                echo "  Sonuç: BAŞARISIZ - {$errorMsg}\n";

                // Hata log kaydı
                $logId = $db->generateUuid();
                $db->insert('tamsoft_sync_logs', [
                    'id' => $logId,
                    'company_id' => $companyId,
                    'status' => 'failed',
                    'total_items' => $result['total'] ?? 0,
                    'inserted' => $result['inserted'] ?? 0,
                    'updated' => $result['updated'] ?? 0,
                    'failed' => $result['failed'] ?? 0,
                    'sync_type' => 'auto',
                    'error_message' => $errorMsg,
                    'created_at' => date('Y-m-d H:i:s')
                ]);

                $errorCount++;
            }
        } catch (Exception $e) {
            echo "  Sonuç: HATA - " . $e->getMessage() . "\n";
            $errorCount++;

            // Hata log kaydı
            try {
                $logId = $db->generateUuid();
                $db->insert('tamsoft_sync_logs', [
                    'id' => $logId,
                    'company_id' => $companyId,
                    'status' => 'failed',
                    'sync_type' => 'auto',
                    'error_message' => $e->getMessage(),
                    'created_at' => date('Y-m-d H:i:s')
                ]);
            } catch (Exception $logEx) {
                // Log hatası sessizce geç
            }
        }

        echo "\n";
    }

    echo str_repeat('=', 50) . "\n";
    echo "Özet:\n";
    echo "  Senkronize edilen: {$syncedCount}\n";
    echo "  Atlanan (henüz zamanı gelmemiş): {$skippedCount}\n";
    echo "  Hatalı: {$errorCount}\n";

} catch (Exception $e) {
    echo "KRİTİK HATA: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n=== TAMSOFT Otomatik Senkronizasyon Tamamlandı ===\n";
