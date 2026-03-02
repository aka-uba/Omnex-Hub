<?php
/**
 * Render Queue API - Job Silme
 *
 * DELETE /api/render-queue/:id
 * POST /api/render-queue/:id/delete
 * POST /api/render-queue/bulk-delete (for bulk operations)
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/services/RenderQueueService.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$data = $request->all();

// Bulk delete
if (!empty($data['ids']) && is_array($data['ids'])) {
    $ids = $data['ids'];
    $deleted = 0;
    $errors = [];

    foreach ($ids as $id) {
        // Job'un bu firmaya ait olduğunu doğrula
        $job = $db->fetch(
            "SELECT id, status FROM render_queue WHERE id = ? AND company_id = ?",
            [$id, $companyId]
        );

        if (!$job) {
            $errors[] = "Job $id bulunamadı";
            continue;
        }

        // Sadece completed, cancelled, failed durumundaki işler silinebilir
        if (!in_array($job['status'], ['completed', 'cancelled', 'failed'])) {
            $errors[] = "Job $id aktif durumda, silinemez";
            continue;
        }

        try {
            // Önce queue items'ı sil
            $db->delete('render_queue_items', 'queue_id = ?', [$id]);

            // Sonra queue'yu sil
            $rowCount = $db->delete('render_queue', 'id = ?', [$id]);

            if ($rowCount > 0) {
                $deleted++;
            } else {
                $errors[] = "Job $id silinemedi (satır bulunamadı)";
            }
        } catch (Exception $e) {
            $errors[] = "Job $id silme hatası: " . $e->getMessage();
        }
    }

    Response::success([
        'deleted' => $deleted,
        'errors' => $errors
    ], "$deleted iş silindi");
}

// Single delete - URL'den ID al
$jobId = $request->getRouteParam('id');

if (!$jobId) {
    Response::badRequest('Job ID gerekli');
}

// Job'un bu firmaya ait olduğunu doğrula
$job = $db->fetch(
    "SELECT id, status FROM render_queue WHERE id = ? AND company_id = ?",
    [$jobId, $companyId]
);

if (!$job) {
    Response::notFound('Job bulunamadı');
}

// Sadece completed, cancelled, failed durumundaki işler silinebilir
if (!in_array($job['status'], ['completed', 'cancelled', 'failed'])) {
    Response::badRequest('Aktif durumda olan işler silinemez. Önce iptal edin.');
}

try {
    // Önce queue items'ı sil
    $db->delete('render_queue_items', 'queue_id = ?', [$jobId]);

    // Sonra queue'yu sil
    $rowCount = $db->delete('render_queue', 'id = ?', [$jobId]);

    if ($rowCount > 0) {
        Response::success([
            'id' => $jobId,
            'deleted' => true
        ], 'İş başarıyla silindi');
    } else {
        Response::error('Silme işlemi başarısız - kayıt bulunamadı');
    }
} catch (Exception $e) {
    Response::error('Silme hatası: ' . $e->getMessage());
}
