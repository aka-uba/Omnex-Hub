<?php
/**
 * Ortak kutuphanedeki (public scope) transcode edilmemis videolari kuyruge ekler.
 * transcode_variants.media_id TEXT, media.id UUID - CAST gerekli.
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);
set_time_limit(300);

require __DIR__ . '/../config.php';

$db = Database::getInstance();

// Fallback company_id
$firstCompany = $db->fetch("SELECT id FROM companies ORDER BY created_at ASC LIMIT 1");
$fallbackCompanyId = $firstCompany['id'] ?? null;
echo "Fallback company_id: " . ($fallbackCompanyId ?? 'NONE') . PHP_EOL;

if (!$fallbackCompanyId) {
    echo "HATA: Fallback company bulunamadi!\n";
    exit(1);
}

echo "Querying videos..." . PHP_EOL;

// transcode_variants.media_id TEXT, media.id UUID -> CAST gerekli
$sql = "SELECT m.id, m.name, m.original_name, m.company_id, m.scope
        FROM media m
        LEFT JOIN transcode_variants tv ON tv.media_id = CAST(m.id AS TEXT)
        LEFT JOIN transcode_queue tq ON tq.media_id = CAST(m.id AS TEXT) AND tq.status IN ('pending','processing')
        WHERE m.file_type = 'video'
        AND tv.id IS NULL
        AND tq.id IS NULL
        ORDER BY m.scope, m.company_id";
$missing = $db->fetchAll($sql);
echo "Missing transcode: " . count($missing) . PHP_EOL;

if (count($missing) === 0) {
    echo "Tum videolar zaten transcode edilmis veya kuyrukta." . PHP_EOL;
    exit(0);
}

// Enqueue
$service = new TranscodeQueueService();
$queued = 0;
$skipped = 0;

foreach ($missing as $v) {
    $mediaId = $v['id'];
    $companyId = $v['company_id'] ?? $fallbackCompanyId;
    $displayName = $v['original_name'] ?? $v['name'] ?? $mediaId;

    try {
        $service->enqueue($mediaId, $companyId, null);
        $queued++;
        echo "[Q] " . $displayName . PHP_EOL;
    } catch (\Throwable $e) {
        $skipped++;
        echo "[S] " . $displayName . ': ' . $e->getMessage() . PHP_EOL;
    }
}

echo PHP_EOL . "Done: queued=$queued, skipped=$skipped" . PHP_EOL;
