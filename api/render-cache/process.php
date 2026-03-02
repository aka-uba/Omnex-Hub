<?php
/**
 * Render Cache API - Job İşleme
 *
 * GET /api/render-cache/process - Sonraki işlenecek job'u al (frontend render için)
 * POST /api/render-cache/process - Render sonucunu kaydet
 */

require_once BASE_PATH . '/services/RenderCacheService.php';

$db = Database::getInstance();
// Use global request if available (has route params), otherwise create new
$request = $GLOBALS['request'] ?? new Request();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$cacheService = new RenderCacheService();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $data = $request->all();
    $filters = [];

    if (!empty($data['batch_id'])) {
        $filters['batch_id'] = (string)$data['batch_id'];
    }
    if (!empty($data['product_ids'])) {
        $filters['product_ids'] = $data['product_ids'];
    }
    if (!empty($data['template_ids'])) {
        $filters['template_ids'] = $data['template_ids'];
    }

    // Sonraki job'u al
    $job = $cacheService->getNextJob($companyId, $filters);

    if (!$job) {
        Response::success([
            'has_job' => false,
            'pending_count' => $cacheService->getPendingJobCount($companyId, $filters),
            'message' => 'Bekleyen render job yok'
        ]);
    }

    // Urun ve sablon bilgilerini al
    $product = $db->fetch("SELECT * FROM products WHERE id = ?", [$job['product_id']]);
    $template = $db->fetch("SELECT * FROM templates WHERE id = ?", [$job['template_id']]);

    // HAL verisini urun payload'una ekle (product_hal_data tablosu)
    // Not: dynamic alanlar icin urun objesi eksiksiz olmali.
    if ($product) {
        $halData = $db->fetch(
            "SELECT * FROM product_hal_data WHERE product_id = ? AND company_id = ?",
            [$job['product_id'], $companyId]
        );
        if ($halData) {
            if (!empty($halData['gecmis_bildirimler']) && is_string($halData['gecmis_bildirimler'])) {
                $decodedHistory = json_decode($halData['gecmis_bildirimler'], true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $halData['gecmis_bildirimler'] = $decodedHistory;
                }
            }
            if (!empty($halData['hal_raw_data']) && is_string($halData['hal_raw_data'])) {
                $decodedRaw = json_decode($halData['hal_raw_data'], true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $halData['hal_raw_data'] = $decodedRaw;
                }
            }

            foreach ($halData as $field => $value) {
                if (in_array($field, ['id', 'product_id', 'company_id', 'created_at', 'updated_at', 'deleted_at'], true)) {
                    continue;
                }
                $current = $product[$field] ?? null;
                if (($current === null || $current === '') && $value !== null && $value !== '') {
                    $product[$field] = $value;
                }
            }
            $product['hal_data'] = $halData;
        }
    }

    if (!$product || !$template) {
        // Ürün veya şablon silinmiş, job'u başarısız yap ve sonraki job'a geç
        $cacheService->failJob($job['id'], 'Ürün veya şablon bulunamadı');

        // Kalan bekleyen job sayısını kontrol et
        $pendingCount = $cacheService->getPendingJobCount($companyId, $filters);

        // Worker'a has_job: false döndür ki sonraki job'u alabilsin
        Response::success([
            'has_job' => false,
            'pending_count' => $pendingCount,
            'message' => 'Geçersiz job atlandı (ürün/şablon silinmiş), sonraki job kontrol ediliyor',
            'skipped_job_id' => $job['id']
        ]);
    }

    // Bekleyen job sayısı
    $pendingCount = $cacheService->getPendingJobCount($companyId, $filters);

    // Batch bilgisi
    $batchStatus = null;
    if (!empty($job['batch_id'])) {
        $batchStatus = $cacheService->getBatchStatus($job['batch_id']);
    }

    Response::success([
        'has_job' => true,
        'job' => [
            'id' => $job['id'],
            'product_id' => $job['product_id'],
            'template_id' => $job['template_id'],
            'job_type' => $job['job_type'],
            'priority' => $job['priority'],
            'batch_id' => $job['batch_id'],
            'batch_index' => $job['batch_index'],
            'batch_total' => $job['batch_total']
        ],
        'product' => $product,
        'template' => $template,
        'pending_count' => $pendingCount,
        'batch_status' => $batchStatus
    ]);
}

if ($method === 'POST') {
    $data = $request->all();
    $jobId = $data['job_id'] ?? null;
    $imageBase64 = $data['image_base64'] ?? null;
    $success = $data['success'] ?? false;
    $errorMessage = $data['error_message'] ?? null;

    if (!$jobId) {
        Response::badRequest('job_id gerekli');
    }

    // Job'u doğrula
    $job = $db->fetch("SELECT * FROM render_jobs WHERE id = ? AND company_id = ?", [$jobId, $companyId]);
    if (!$job) {
        Response::notFound('Job bulunamadı');
    }

    if (!$success) {
        // Başarısız
        $cacheService->failJob($jobId, $errorMessage ?? 'Bilinmeyen hata');
        Response::success([
            'success' => false,
            'message' => 'Job başarısız olarak işaretlendi',
            'pending_count' => $cacheService->getPendingJobCount($companyId)
        ]);
    }

    if (empty($imageBase64)) {
        Response::badRequest('image_base64 gerekli');
    }

    // Base64'ü dosyaya kaydet
    $parts = explode(',', $imageBase64);
    if (count($parts) !== 2) {
        Response::badRequest('Geçersiz base64 formatı');
    }

    $imageData = base64_decode($parts[1]);
    if ($imageData === false) {
        Response::badRequest('Base64 decode hatası');
    }

    // Storage dizini oluştur
    $cacheDir = STORAGE_PATH . '/renders/cache/' . $companyId;
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0755, true);
    }

    // Dosya adı: product_template.png - aynı ürün+şablon için üzerine yazar (birikmez)
    $filename = $job['product_id'] . '_' . $job['template_id'] . '.png';
    $filePath = $cacheDir . '/' . $filename;

    // Dosyayı kaydet
    if (file_put_contents($filePath, $imageData) === false) {
        $cacheService->failJob($jobId, 'Dosya kaydetme hatası');
        Response::error('Dosya kaydedilemedi', 500);
    }

    // MD5 ve boyut
    $imageMd5 = md5($imageData);
    $imageSize = strlen($imageData);

    // Job'u tamamla ve cache'i güncelle
    $cacheService->completeJob($jobId, $filePath, $imageMd5, $imageSize);

    // Kalan job sayısı
    $pendingCount = $cacheService->getPendingJobCount($companyId);

    // Batch durumu
    $batchStatus = null;
    if (!empty($job['batch_id'])) {
        $batchStatus = $cacheService->getBatchStatus($job['batch_id']);

        // Batch tamamlandıysa bildirim gönder
        if (!empty($batchStatus['is_complete']) && $batchStatus['is_complete'] === true) {
            require_once BASE_PATH . '/services/NotificationTriggers.php';

            $completedCount = $batchStatus['completed'] ?? 0;
            $failedCount = $batchStatus['failed'] ?? 0;
            $jobType = $job['job_type'] ?? 'queue';

            // Job type'a göre source belirle
            $source = 'queue';
            if ($jobType === 'bulk_send') {
                $source = 'bulk_send';
            } elseif ($jobType === 'erp_sync') {
                $source = 'erp';
            } elseif ($jobType === 'import') {
                $source = 'import';
            }

            // Başarılı olanlar için bildirim
            if ($completedCount > 0) {
                NotificationTriggers::onRenderJobsComplete(
                    $user['id'],
                    $source,
                    $completedCount,
                    $batchStatus['total'] ?? $completedCount
                );
            }

            // Başarısız olanlar için bildirim
            if ($failedCount > 0) {
                NotificationTriggers::onRenderJobsFailed(
                    $user['id'],
                    $source,
                    $failedCount,
                    'Bazı tasarımlar render edilemedi'
                );
            }
        }
    }

    Response::success([
        'success' => true,
        'message' => 'Render başarıyla kaydedildi',
        'image_path' => $filePath,
        'image_md5' => $imageMd5,
        'image_size' => $imageSize,
        'pending_count' => $pendingCount,
        'batch_status' => $batchStatus
    ]);
}

Response::methodNotAllowed();
