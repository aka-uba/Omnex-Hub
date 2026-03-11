<?php
/**
 * ERP Dosya Otomatik Import Cron Job
 *
 * auto_import_enabled aktif olan firmaların import dizinlerini
 * check_interval dakika aralığında tarar ve dosyaları import eder.
 *
 * Önerilen cron ayarı (her 5 dakikada bir):
 * 0,5,10,15,20,25,30,35,40,45,50,55 * * * * php /path/to/cron/auto-import.php
 *
 * Windows Task Scheduler için:
 * php.exe C:\xampp\htdocs\market-etiket-sistemi\cron\auto-import.php
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
require_once BASE_PATH . '/services/SettingsResolver.php';
require_once BASE_PATH . '/services/ProductImportHelper.php';

// Parsers
require_once BASE_PATH . '/parsers/BaseParser.php';
require_once BASE_PATH . '/parsers/TxtParser.php';
require_once BASE_PATH . '/parsers/CsvParser.php';
require_once BASE_PATH . '/parsers/JsonParser.php';
require_once BASE_PATH . '/parsers/XmlParser.php';
require_once BASE_PATH . '/parsers/XlsxParser.php';
require_once BASE_PATH . '/parsers/ParserFactory.php';
require_once BASE_PATH . '/services/SmartFieldMapper.php';

echo "=== ERP Dosya Otomatik Import ===\n";
echo "Tarih: " . date('Y-m-d H:i:s') . "\n\n";

// Lock dosyası - aynı anda birden fazla çalışmayı engelle
$lockFile = BASE_PATH . '/storage/auto-import.lock';
$lockFp = fopen($lockFile, 'c');
if (!$lockFp || !flock($lockFp, LOCK_EX | LOCK_NB)) {
    echo "UYARI: Başka bir auto-import işlemi zaten çalışıyor.\n";
    exit(0);
}

// Lock alındı, PID yaz
ftruncate($lockFp, 0);
fwrite($lockFp, (string) getmypid());

try {
    $db = Database::getInstance();
    $resolver = new SettingsResolver();

    // file_import aktif olan firmaları bul
    $companies = $db->fetchAll(
        "SELECT is2.company_id, is2.config_json, c.name as company_name
         FROM integration_settings is2
         LEFT JOIN companies c ON c.id::text = is2.company_id
         WHERE is2.integration_type = 'file_import'
           AND is2.scope = 'company'
           AND is2.is_active = true"
    );

    if (empty($companies)) {
        echo "Dosya import aktif firma bulunamadı.\n";
        echo "\n=== Tamamlandı ===\n";
        cleanup($lockFp, $lockFile);
        exit(0);
    }

    echo count($companies) . " firma için otomatik import kontrol ediliyor...\n\n";

    $importedCount = 0;
    $skippedCount = 0;
    $errorCount = 0;

    foreach ($companies as $company) {
        $companyId = $company['company_id'];
        $companyName = $company['company_name'] ?? $companyId;
        $config = json_decode($company['config_json'] ?? '{}', true) ?: [];

        echo "--- Firma: {$companyName} ---\n";

        // Auto import aktif mi?
        if (empty($config['auto_import_enabled'])) {
            echo "  Durum: ATLANDI (Otomatik import kapalı)\n\n";
            $skippedCount++;
            continue;
        }

        $checkInterval = max(5, intval($config['check_interval'] ?? 30)); // dakika
        $lastAutoImport = $config['last_auto_import'] ?? null;

        echo "  Kontrol aralığı: {$checkInterval} dk\n";
        echo "  Son kontrol: " . ($lastAutoImport ?: 'Hiç') . "\n";

        // İnterval kontrolü
        if ($lastAutoImport) {
            $lastCheckTime = strtotime($lastAutoImport);
            $intervalSeconds = $checkInterval * 60;
            $nextCheckTime = $lastCheckTime + $intervalSeconds;

            if (time() < $nextCheckTime) {
                $remainingMin = ceil(($nextCheckTime - time()) / 60);
                echo "  Durum: ATLANDI (Sonraki kontrole {$remainingMin} dk kaldı)\n\n";
                $skippedCount++;
                continue;
            }
        }

        // Import dizinini kontrol et
        $importDir = BASE_PATH . '/storage/companies/' . $companyId . '/imports/';
        $processedDir = $importDir . 'processed/';
        $failedDir = $importDir . 'failed/';

        if (!is_dir($importDir)) {
            echo "  Durum: ATLANDI (Import dizini yok)\n\n";
            $skippedCount++;
            // Son kontrol zamanını güncelle
            updateLastAutoImport($resolver, $companyId, $config);
            continue;
        }

        // Dizin ve alt dizinleri oluştur
        if (!is_dir($processedDir)) mkdir($processedDir, 0755, true);
        if (!is_dir($failedDir)) mkdir($failedDir, 0755, true);

        // İzin verilen formatlar
        $allowedFormats = $config['allowed_formats'] ?? ['csv', 'txt', 'json', 'xml', 'xlsx'];
        $defaultImportFilename = trim((string)($config['default_import_filename'] ?? ''));

        // Dizindeki dosyaları tara
        $files = [];
        foreach (glob($importDir . '*') as $filePath) {
            if (!is_file($filePath)) continue;

            $filename = basename($filePath);
            if ($defaultImportFilename !== '') {
                $isExact = ($filename === $defaultImportFilename);
                $isTimestampVariant = preg_match('/^\d{8}_\d{6}_/', $filename) === 1
                    && str_ends_with($filename, $defaultImportFilename);
                if (!$isExact && !$isTimestampVariant) continue;
            }

            $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
            if (!in_array($extension, $allowedFormats)) continue;

            // Boyut kontrolü
            $maxSizeMb = $config['max_file_size_mb'] ?? 10;
            $fileSize = filesize($filePath);
            if ($fileSize > ($maxSizeMb * 1024 * 1024)) {
                echo "  UYARI: {$filePath} dosyası {$maxSizeMb}MB sınırını aşıyor, atlandı.\n";
                continue;
            }

            $files[] = $filePath;
        }

        if (empty($files)) {
            echo "  Durum: Bekleyen dosya yok\n\n";
            $skippedCount++;
            updateLastAutoImport($resolver, $companyId, $config);
            continue;
        }

        echo "  {" . count($files) . "} dosya bulundu, import başlıyor...\n";

        foreach ($files as $filePath) {
            $filename = basename($filePath);
            $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
            $fileSize = filesize($filePath);

            echo "    Dosya: {$filename} ({$extension}, " . round($fileSize / 1024) . " KB)\n";

            // DB'de daha önce işlenmiş mi kontrol et (hash)
            $fileContent = file_get_contents($filePath);
            $fileHash = md5($fileContent);
            $fileId = null;

            try {
                $pending = $db->fetch(
                    "SELECT id FROM erp_import_files
                     WHERE company_id = ? AND file_hash = ? AND status IN ('pending', 'processing')
                     ORDER BY created_at DESC LIMIT 1",
                    [$companyId, $fileHash]
                );

                if ($pending) {
                    $fileId = $pending['id'];
                    $db->update('erp_import_files', [
                        'status' => 'processing',
                        'processed_at' => null
                    ], 'id = ?', [$fileId]);
                }

                if (!$fileId) {
                    $existing = $db->fetch(
                        "SELECT id, status FROM erp_import_files
                         WHERE company_id = ? AND file_hash = ? AND status IN ('completed', 'processing')
                         ORDER BY created_at DESC LIMIT 1",
                        [$companyId, $fileHash]
                    );

                    if ($existing) {
                        echo "      Durum: ATLANDI (Hash eşleşmesi, daha önce işlenmiş)\n";
                        // Dosyayı processed'e taşı
                        rename($filePath, $processedDir . $filename);
                        continue;
                    }
                }
            } catch (Exception $e) {
                // Tablo yoksa devam et
            }

            // erp_import_files kaydı oluştur
            if (!$fileId) {
                $fileId = $db->generateUuid();
                try {
                    $db->insert('erp_import_files', [
                        'id' => $fileId,
                        'company_id' => $companyId,
                        'filename' => $filename,
                        'original_filename' => $filename,
                        'file_path' => 'storage/companies/' . $companyId . '/imports/' . $filename,
                        'file_size' => $fileSize,
                        'file_format' => $extension,
                        'file_hash' => $fileHash,
                        'source' => 'directory_scan',
                        'status' => 'processing',
                        'created_at' => date('Y-m-d H:i:s')
                    ]);
                } catch (Exception $e) {
                    echo "      HATA: DB kaydı oluşturulamadı: " . $e->getMessage() . "\n";
                }
            }

            // Dosyayı parse et
            try {
                $parser = OmnexParserFactory::autoDetect($fileContent, $filename);
                $rawData = $parser->parse($fileContent);

                if (empty($rawData) || !is_array($rawData)) {
                    throw new Exception('Dosya parse edilemedi veya boş');
                }

                $firstRow = $rawData[0] ?? [];
                $headers = is_array($firstRow) ? array_keys($firstRow) : [];

                echo "      Parse: {" . count($rawData) . "} satır, {" . count($headers) . "} sütun\n";

                // Field mapping: Kayıtlı mapping varsa kullan, yoksa SmartFieldMapper
                $mappings = $config['default_mappings'] ?? [];

                if (empty($mappings)) {
                    // SmartFieldMapper ile otomatik tespit
                    $sampleData = array_slice($rawData, 0, 5);
                    $detected = SmartFieldMapper::detectMappings($headers, $sampleData);
                    $mappings = $detected['mappings'] ?? [];
                    echo "      Mapping: Otomatik tespit ({" . count($mappings) . "} alan eşlendi)\n";
                } else {
                    echo "      Mapping: Kayıtlı varsayılan mapping kullanılıyor\n";
                }

                if (empty($mappings)) {
                    throw new Exception('Alan eşleştirmesi yapılamadı');
                }

                // Import seçenekleri
                $options = [
                    'update_existing' => $config['update_existing'] ?? true,
                    'create_new' => $config['create_new'] ?? true,
                    'skip_errors' => $config['skip_errors'] ?? true,
                    'trigger_render' => $config['trigger_render'] ?? true
                ];

                // Import pipeline çalıştır
                $report = runImportPipeline($rawData, $mappings, $companyId, 'system', $options);
                $summary = $report['summary'] ?? [];

                $inserted = $summary['inserted'] ?? 0;
                $updated = $summary['updated'] ?? 0;
                $failed = $summary['failed'] ?? 0;
                $skipped = $summary['skipped'] ?? 0;
                $totalRows = $summary['total_rows'] ?? 0;

                echo "      Sonuç: " . ($report['success'] ? 'BAŞARILI' : 'KISMEN BAŞARILI') . "\n";
                echo "      Toplam: {$totalRows}, Eklenen: {$inserted}, Güncellenen: {$updated}, Başarısız: {$failed}, Atlanan: {$skipped}\n";

                // DB kaydını güncelle
                $status = ($failed > 0 && $inserted + $updated === 0) ? 'failed' : 'completed';
                try {
                    $db->update('erp_import_files', [
                        'status' => $status,
                        'total_rows' => $totalRows,
                        'inserted' => $inserted,
                        'updated' => $updated,
                        'failed' => $failed,
                        'skipped' => $skipped,
                        'mappings_used' => json_encode($mappings),
                        'import_options' => json_encode($options),
                        'result_summary' => json_encode($summary),
                        'error_message' => !empty($report['errors']) ? implode('; ', $report['errors']) : null,
                        'processed_at' => date('Y-m-d H:i:s')
                    ], 'id = ?', [$fileId]);
                } catch (Exception $e) {
                    // DB güncelleme hatası sessizce geç
                }

                // Dosyayı taşı
                $destDir = $status === 'completed' ? $processedDir : $failedDir;
                rename($filePath, $destDir . $filename);

                $importedCount++;

                // Bildirim gönder
                if ($inserted + $updated > 0) {
                    try {
                        require_once BASE_PATH . '/services/NotificationTriggers.php';
                        NotificationTriggers::onImportComplete('system', [
                            'summary' => $summary,
                            'filename' => $filename,
                            'source' => 'auto_import',
                            'company_id' => $companyId
                        ]);
                    } catch (Exception $e) {
                        // Bildirim hatası sessizce geç
                    }
                }

            } catch (Exception $e) {
                echo "      HATA: " . $e->getMessage() . "\n";
                $errorCount++;

                // DB kaydını güncelle
                try {
                    $db->update('erp_import_files', [
                        'status' => 'failed',
                        'error_message' => $e->getMessage(),
                        'processed_at' => date('Y-m-d H:i:s')
                    ], 'id = ?', [$fileId]);
                } catch (Exception $dbEx) {
                    // Sessizce geç
                }

                // Başarısız dosyayı taşı
                rename($filePath, $failedDir . $filename);
            }
        }

        // Son kontrol zamanını güncelle
        updateLastAutoImport($resolver, $companyId, $config);

        echo "\n";
    }

    echo str_repeat('=', 50) . "\n";
    echo "Özet:\n";
    echo "  Import edilen: {$importedCount}\n";
    echo "  Atlanan: {$skippedCount}\n";
    echo "  Hatalı: {$errorCount}\n";

} catch (Exception $e) {
    echo "KRİTİK HATA: " . $e->getMessage() . "\n";
    cleanup($lockFp, $lockFile);
    exit(1);
}

cleanup($lockFp, $lockFile);
echo "\n=== ERP Dosya Otomatik Import Tamamlandı ===\n";

// =========================================================
// YARDIMCI FONKSİYONLAR
// =========================================================

/**
 * Son otomatik import zamanını güncelle
 */
function updateLastAutoImport(SettingsResolver $resolver, string $companyId, array $config): void
{
    $config['last_auto_import'] = date('Y-m-d H:i:s');
    $config['last_auto_import_result'] = 'checked';

    try {
        $resolver->saveCompanySettings('file_import', $companyId, $config, true);
    } catch (Exception $e) {
        echo "  UYARI: Son kontrol zamanı güncellenemedi: " . $e->getMessage() . "\n";
    }
}

/**
 * Lock dosyasını temizle
 */
function cleanup($lockFp, string $lockFile): void
{
    if ($lockFp) {
        flock($lockFp, LOCK_UN);
        fclose($lockFp);
    }
    @unlink($lockFile);
}
