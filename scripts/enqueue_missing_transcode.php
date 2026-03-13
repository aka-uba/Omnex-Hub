<?php
/**
 * Transcode edilmemis tum videolari (ortak kutuphane dahil) kuyruge ekler.
 * Ortak kutuphane videolari icin company_id null olabilir, bu durumda
 * fallback olarak ilk firmanin ID'si kullanilir.
 */
require __DIR__ . '/../config.php';

$db = Database::getInstance();
$service = new TranscodeQueueService();

// Transcode edilmemis videolar
$all = $db->fetchAll("SELECT id, file_name, company_id, scope FROM media WHERE file_type = 'video' ORDER BY scope, company_id");
$queued = 0;
$skipped = 0;
$errors = [];

// Fallback company_id (ortak kutuphane icin)
$firstCompany = $db->fetch("SELECT id FROM companies ORDER BY created_at ASC LIMIT 1");
$fallbackCompanyId = $firstCompany['id'] ?? null;

foreach ($all as $v) {
    $mediaId = $v['id'];

    // Zaten transcode edilmis veya kuyrukta mi?
    $hasVariants = $db->fetch("SELECT COUNT(*) as c FROM transcode_variants WHERE media_id = ?", [$mediaId]);
    $hasQueue = $db->fetch("SELECT COUNT(*) as c FROM transcode_queue WHERE media_id = ? AND status IN ('pending','processing')", [$mediaId]);

    if ((int)($hasVariants['c'] ?? 0) > 0 || (int)($hasQueue['c'] ?? 0) > 0) {
        continue; // Zaten mevcut, atla
    }

    // company_id coz
    $companyId = $v['company_id'] ?? $fallbackCompanyId;
    if (!$companyId) {
        $errors[] = $v['file_name'] . ': company_id bulunamadi';
        $skipped++;
        continue;
    }

    try {
        $service->enqueue($mediaId, $companyId, null);
        $queued++;
        echo "[QUEUED] " . $v['file_name'] . " (scope:" . ($v['scope'] ?? 'null') . ")" . PHP_EOL;
    } catch (\Throwable $e) {
        $skipped++;
        $errors[] = $v['file_name'] . ': ' . $e->getMessage();
        echo "[SKIP]  " . $v['file_name'] . ': ' . $e->getMessage() . PHP_EOL;
    }
}

echo PHP_EOL . "Sonuc: queued=$queued, skipped=$skipped" . PHP_EOL;
if (!empty($errors)) {
    echo "Hatalar:" . PHP_EOL;
    foreach ($errors as $e) echo "  - $e" . PHP_EOL;
}
