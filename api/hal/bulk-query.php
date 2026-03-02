<?php
/**
 * HAL Toplu Künye Sorgulama API
 *
 * POST /api/hal/bulk-query
 * Body: { "kunye_numbers": ["2073079250202837944", "2543109260003156241"] }
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../core/Database.php';
require_once __DIR__ . '/../../core/Auth.php';
require_once __DIR__ . '/../../core/Response.php';
require_once __DIR__ . '/../../services/HalKunyeScraper.php';

// Auth kontrolü
$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$kunyeNumbers = $input['kunye_numbers'] ?? [];

if (empty($kunyeNumbers) || !is_array($kunyeNumbers)) {
    Response::error('Künye numaraları dizisi gerekli', 400);
}

// Maksimum 10 künye sorgulanabilir
if (count($kunyeNumbers) > 10) {
    Response::error('Maksimum 10 künye sorgulanabilir', 400);
}

try {
    $scraper = new HalKunyeScraper();
    $results = $scraper->queryMultiple($kunyeNumbers);

    $successCount = 0;
    $failCount = 0;

    foreach ($results as $result) {
        if ($result['success']) {
            $successCount++;
        } else {
            $failCount++;
        }
    }

    Response::success([
        'results' => $results,
        'summary' => [
            'total' => count($kunyeNumbers),
            'success' => $successCount,
            'failed' => $failCount
        ]
    ], "Toplu sorgu tamamlandı: $successCount başarılı, $failCount başarısız");

} catch (Exception $e) {
    Response::error('Sorgu hatası: ' . $e->getMessage(), 500);
}
