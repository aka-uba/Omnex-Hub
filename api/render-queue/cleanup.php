<?php
/**
 * Render Queue API - Eski Kayıtları Temizle
 *
 * POST /api/render-queue/cleanup
 * Admin only
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/services/RenderQueueService.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Yetki kontrolü (admin veya manager olmalı)
if (!in_array($user['role'], ['SuperAdmin', 'Admin', 'Manager', 'superadmin', 'admin', 'manager'])) {
    Response::forbidden('Bu işlem için yönetici yetkisi gerekli');
}

$companyId = Auth::getActiveCompanyId();
$data = $request->all();
$daysOld = max(1, min(365, (int)($data['days_old'] ?? 7)));

$queueService = new RenderQueueService();
$deleted = $queueService->cleanupOldQueues($daysOld, $companyId);

Response::success([
    'deleted' => $deleted,
    'days_old' => $daysOld
], "$deleted eski kayıt silindi");
