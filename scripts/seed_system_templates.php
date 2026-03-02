<?php
/**
 * System Templates Seed Script
 *
 * Bu script, sistem şablonlarını veritabanına ekler.
 * Kullanım: php scripts/seed_system_templates.php
 *
 * @version 1.0.0
 * @date 2026-02-01
 */

// CLI veya web'den çalıştırılabilir
$isCli = php_sapi_name() === 'cli';

if (!$isCli) {
    header('Content-Type: text/html; charset=utf-8');
    echo "<pre>";
}

echo "=== Sistem Şablonları Seed Script ===\n\n";

// Config yükle
require_once __DIR__ . '/../config.php';

try {
    $db = Database::getInstance();
    echo "✓ Veritabanı bağlantısı başarılı\n";

    // SQL dosyasını oku
    $sqlFile = __DIR__ . '/../database/seeds/system_templates.sql';

    if (!file_exists($sqlFile)) {
        throw new Exception("SQL dosyası bulunamadı: $sqlFile");
    }

    $sqlContent = file_get_contents($sqlFile);
    echo "✓ SQL dosyası okundu\n";

    // Mevcut sistem şablonlarını kontrol et
    $existingCount = $db->fetchColumn(
        "SELECT COUNT(*) FROM templates WHERE scope = 'system' OR company_id IS NULL"
    );
    echo "  Mevcut sistem şablonu sayısı: $existingCount\n";

    // SQL'i parçalara ayır (her INSERT ayrı)
    // Önce comment'leri ve boş satırları temizle
    $lines = explode("\n", $sqlContent);
    $cleanedSql = '';

    foreach ($lines as $line) {
        $trimmed = trim($line);
        // Boş satır veya comment satırı değilse ekle
        if (!empty($trimmed) && strpos($trimmed, '--') !== 0) {
            $cleanedSql .= $line . "\n";
        }
    }

    // INSERT ifadelerini ayır
    $statements = preg_split('/;\s*\n/', $cleanedSql);
    $statements = array_filter($statements, function($s) {
        return !empty(trim($s));
    });

    echo "\n  İşlenecek SQL ifadesi sayısı: " . count($statements) . "\n\n";

    $inserted = 0;
    $skipped = 0;
    $errors = 0;

    foreach ($statements as $index => $statement) {
        $statement = trim($statement);
        if (empty($statement)) continue;

        // INSERT OR REPLACE ifadesi mi kontrol et
        if (stripos($statement, 'INSERT') !== false) {
            try {
                // Şablon adını çıkar (debug için)
                preg_match("/name\s*,.*?VALUES\s*\([^,]+,\s*'([^']+)'/is", $statement, $matches);
                $templateName = $matches[1] ?? 'Bilinmeyen';

                // SQL'i çalıştır
                $db->query($statement);
                $inserted++;
                echo "  ✓ Eklendi: $templateName\n";

            } catch (Exception $e) {
                $errorMsg = $e->getMessage();

                // UNIQUE constraint hatası = zaten var
                if (strpos($errorMsg, 'UNIQUE constraint') !== false) {
                    $skipped++;
                    echo "  - Atlandı (zaten var): $templateName\n";
                } else {
                    $errors++;
                    echo "  ✗ Hata: $templateName - $errorMsg\n";
                }
            }
        }
    }

    echo "\n=== Sonuç ===\n";
    echo "Eklenen: $inserted\n";
    echo "Atlanan: $skipped\n";
    echo "Hata: $errors\n";

    // Güncel sayıyı göster
    $newCount = $db->fetchColumn(
        "SELECT COUNT(*) FROM templates WHERE scope = 'system' OR company_id IS NULL"
    );
    echo "\nToplam sistem şablonu: $newCount\n";

    // Eklenen şablonları listele
    echo "\n=== Sistem Şablonları ===\n";
    $templates = $db->fetchAll(
        "SELECT id, name, type, target_device_type, orientation, created_at
         FROM templates
         WHERE scope = 'system' OR company_id IS NULL
         ORDER BY created_at DESC
         LIMIT 10"
    );

    foreach ($templates as $t) {
        echo sprintf(
            "  • %s (%s, %s, %s)\n",
            $t['name'],
            $t['type'] ?? 'label',
            $t['target_device_type'] ?? 'esl_101_portrait',
            $t['orientation'] ?? 'portrait'
        );
    }

    echo "\n✓ İşlem tamamlandı!\n";

} catch (Exception $e) {
    echo "✗ Hata: " . $e->getMessage() . "\n";
    if (!$isCli) {
        echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    }
    exit(1);
}

if (!$isCli) {
    echo "</pre>";
}
