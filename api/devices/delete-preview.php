<?php
/**
 * Delete Device Preview Image API
 *
 * Cihaz önizleme görselini siler
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$deviceId = $request->routeParam('id');

if (!$deviceId) {
    Response::error('Cihaz ID gerekli', 400);
}

// Verify device belongs to company
$device = $db->fetch("SELECT * FROM devices WHERE id = ? AND company_id = ?", [$deviceId, $companyId]);

if (!$device) {
    Response::notFound('Cihaz bulunamadı');
}

// Get preview path from metadata (preferred)
$metadata = $device['metadata'] ? json_decode($device['metadata'], true) : [];
$currentPreview = is_array($metadata) ? ($metadata['preview_image'] ?? null) : null;

if ($currentPreview) {
    // Convert relative path to absolute
    $fullPath = BASE_PATH . '/storage/' . $currentPreview;

    // Delete file if exists
    if (file_exists($fullPath)) {
        unlink($fullPath);
    }

    // Clear preview image from metadata (do not touch current_content)
    if (is_array($metadata) && array_key_exists('preview_image', $metadata)) {
        unset($metadata['preview_image']);
    }

    $db->update('devices', [
        'metadata' => json_encode($metadata),
        'updated_at' => date('Y-m-d H:i:s')
    ], 'id = ?', [$deviceId]);

    // Log action
    Logger::audit('delete_preview', 'devices', [
        'device_id' => $deviceId,
        'deleted_file' => $currentPreview
    ]);
}

Response::success([
    'device_id' => $deviceId,
    'preview_deleted' => true
], 'Önizleme görseli silindi');
