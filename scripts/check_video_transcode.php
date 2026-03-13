<?php
/**
 * Tum videolarin transcode durumunu kontrol eder.
 * Ortak kutuphane (public scope / company_id NULL) dahil.
 */
require __DIR__ . '/../config.php';

$db = Database::getInstance();
$all = $db->fetchAll("SELECT id, file_name, company_id, scope FROM media WHERE file_type = 'video' ORDER BY scope, company_id");
echo "Total videos: " . count($all) . PHP_EOL;

$noTranscode = [];
foreach ($all as $v) {
    $cnt = $db->fetch("SELECT COUNT(*) as c FROM transcode_variants WHERE media_id = ?", [$v['id']]);
    $pending = $db->fetch("SELECT COUNT(*) as c FROM transcode_queue WHERE media_id = ? AND status IN ('pending','processing')", [$v['id']]);
    $variantCount = (int)($cnt['c'] ?? 0);
    $queuedCount = (int)($pending['c'] ?? 0);
    $status = $variantCount > 0 ? 'OK' : ($queuedCount > 0 ? 'QUEUED' : 'MISSING');
    echo sprintf("  [%s] %s | scope:%s | company:%s | variants:%d | queued:%d\n",
        $status, $v['file_name'], $v['scope'] ?? 'null', $v['company_id'] ?? 'NULL', $variantCount, $queuedCount);
    if ($variantCount === 0 && $queuedCount === 0) {
        $noTranscode[] = $v;
    }
}

echo PHP_EOL . "Transcode edilmemis (MISSING): " . count($noTranscode) . PHP_EOL;
