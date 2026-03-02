<?php
/**
 * Delete Media API - With Tenant Isolation and Storage Usage Update
 *
 * @package OmnexDisplayHub
 * @since v2.0.14
 */

require_once dirname(dirname(__DIR__)) . '/services/StorageService.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$id = $request->routeParam('id');

// Get media with proper isolation check
$media = $db->fetch("SELECT * FROM media WHERE id = ?", [$id]);

if (!$media) {
    Response::notFound('Dosya bulunamadı');
}

$userRole = $user['role'] ?? 'Viewer';
$isSuperAdmin = strtolower($userRole) === 'superadmin';

// Check if media is public/shared (scope='public' or is_public=1)
$isPublicMedia = ($media['scope'] === 'public' || $media['is_public'] == 1);

// Public media can only be deleted by SuperAdmin
if ($isPublicMedia && !$isSuperAdmin) {
    Response::forbidden('Ortak kütüphane medyaları silinemez. Sadece SuperAdmin silebilir.');
}

// Check company isolation - users can only delete their own company's media
if (!$isPublicMedia && $media['company_id'] !== $companyId && !$isSuperAdmin) {
    Response::forbidden('Bu medyayı silme yetkiniz yok');
}

// Get file size before deletion for storage update
$fileSize = (int)($media['file_size'] ?? 0);
$mediaCompanyId = $media['company_id'];

// Delete physical file
$filepath = $media['file_path'];
$deleted = false;

if (preg_match('/^[A-Za-z]:[\\\\\/]/', $filepath) || strpos($filepath, '\\\\') === 0 || $filepath[0] === '/') {
    // Absolute path (legacy)
    if (file_exists($filepath)) {
        $deleted = @unlink($filepath);
    }
} else {
    // Relative path - check in storage directory
    $storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : dirname(dirname(__DIR__)) . '/storage';
    $fullPath = $storagePath . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $filepath);
    if (file_exists($fullPath)) {
        $deleted = @unlink($fullPath);
    } else {
        // File already doesn't exist on disk
        $deleted = true;
    }
}

// Delete from database
$db->delete('media', 'id = ?', [$id]);

// ========================================
// UPDATE STORAGE USAGE (v2.0.14)
// ========================================
if (!$isPublicMedia && $mediaCompanyId && $fileSize > 0) {
    $storageService = new StorageService();
    $storageService->decrementUsage($mediaCompanyId, $fileSize, 'media');
}

Logger::audit('delete', 'media', [
    'media_id' => $id,
    'scope' => $media['scope'] ?? 'company',
    'file_size' => $fileSize,
    'company_id' => $mediaCompanyId,
    'file_deleted' => $deleted
]);

Response::success(null, 'Dosya silindi');
