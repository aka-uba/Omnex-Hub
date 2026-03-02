<?php
/**
 * Cleanup Temporary Branding Files API
 *
 * Removes temporary branding files when modal is cancelled or an error occurs
 */

require_once dirname(__DIR__, 2) . '/config.php';
require_once CORE_PATH . '/Database.php';
require_once CORE_PATH . '/Auth.php';
require_once CORE_PATH . '/Response.php';

// Get authenticated user
$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Only admins can cleanup temp branding
if (!in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu islemi yapmak icin yetkiniz yok');
}

// Get temp ID from request
$input = json_decode(file_get_contents('php://input'), true);
$tempId = $input['temp_id'] ?? '';

if (!$tempId) {
    Response::error('Gecici ID gerekli', 400);
}

// Validate temp ID format for security
if (strpos($tempId, 'temp_') !== 0 || preg_match('/[^a-zA-Z0-9_]/', $tempId)) {
    Response::error('Gecersiz gecici ID formati', 400);
}

// Build temp path
$tempPath = dirname(__DIR__, 2) . '/storage/temp/' . $tempId;

// Check if directory exists
if (!is_dir($tempPath)) {
    Response::success(['cleaned' => false], 'Temizlenecek dosya bulunamadi');
}

// Recursively delete directory
function deleteDirectory($dir) {
    if (!is_dir($dir)) {
        return false;
    }

    $files = array_diff(scandir($dir), ['.', '..']);
    foreach ($files as $file) {
        $path = $dir . '/' . $file;
        if (is_dir($path)) {
            deleteDirectory($path);
        } else {
            unlink($path);
        }
    }

    return rmdir($dir);
}

$deleted = deleteDirectory($tempPath);

Response::success([
    'cleaned' => $deleted,
    'temp_id' => $tempId
], $deleted ? 'Gecici dosyalar temizlendi' : 'Temizleme basarisiz');
