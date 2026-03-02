<?php
/**
 * Upload Device Preview Image API
 *
 * Tenant-uyumlu dosya yapısı:
 * storage/devices/{company_id}/previews/{device_id}.{ext}
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();

// Device ID from route or POST
$deviceId = $request->routeParam('id') ?? $request->input('device_id');

if (!$deviceId) {
    Response::error('Cihaz ID gerekli', 400);
}

// Verify device belongs to company
$device = $db->fetch("SELECT * FROM devices WHERE id = ? AND company_id = ?", [$deviceId, $companyId]);

if (!$device) {
    Response::notFound('Cihaz bulunamadı');
}

// Check if file was uploaded
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE => 'Dosya boyutu çok büyük (php.ini limiti)',
        UPLOAD_ERR_FORM_SIZE => 'Dosya boyutu çok büyük (form limiti)',
        UPLOAD_ERR_PARTIAL => 'Dosya kısmen yüklendi',
        UPLOAD_ERR_NO_FILE => 'Dosya seçilmedi',
        UPLOAD_ERR_NO_TMP_DIR => 'Geçici klasör bulunamadı',
        UPLOAD_ERR_CANT_WRITE => 'Dosya yazılamadı',
        UPLOAD_ERR_EXTENSION => 'PHP uzantısı yüklemeyi durdurdu'
    ];
    $errorCode = $_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE;
    Response::error($errorMessages[$errorCode] ?? 'Dosya yüklenemedi', 400);
}

$file = $_FILES['file'];

// Validate file type
$allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $allowedMimes)) {
    Response::error('Desteklenmeyen dosya türü. Sadece PNG, JPG, GIF, WEBP kabul edilir.', 400);
}

// Validate file size (max 2MB)
$maxSize = 2 * 1024 * 1024; // 2MB
if ($file['size'] > $maxSize) {
    Response::error('Dosya boyutu 2MB\'dan büyük olamaz', 400);
}

// Determine file extension
$extensions = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/gif' => 'gif',
    'image/webp' => 'webp'
];
$ext = $extensions[$mimeType] ?? 'jpg';

// Create tenant-compatible directory structure
// storage/devices/{company_id}/previews/
$baseStoragePath = BASE_PATH . '/storage/devices';
$companyPath = $baseStoragePath . '/' . $companyId;
$previewsPath = $companyPath . '/previews';

// Create directories if they don't exist
if (!is_dir($baseStoragePath)) {
    mkdir($baseStoragePath, 0755, true);
}
if (!is_dir($companyPath)) {
    mkdir($companyPath, 0755, true);
}
if (!is_dir($previewsPath)) {
    mkdir($previewsPath, 0755, true);
}

// Generate unique filename
$filename = $deviceId . '_' . time() . '.' . $ext;
$filePath = $previewsPath . '/' . $filename;

// Delete old preview if exists
$oldPreview = $device['current_content'] ?? null;
if ($oldPreview) {
    // Convert relative path to absolute
    $oldFullPath = BASE_PATH . '/storage/' . $oldPreview;
    if (file_exists($oldFullPath)) {
        unlink($oldFullPath);
    }
}

// Move uploaded file
if (!move_uploaded_file($file['tmp_name'], $filePath)) {
    Response::error('Dosya kaydedilemedi', 500);
}

// Calculate relative path for database (from storage folder)
$relativePath = 'devices/' . $companyId . '/previews/' . $filename;

// Store preview image in metadata (do not override current_content assignments)
$metadata = $device['metadata'] ? json_decode($device['metadata'], true) : [];
if (!is_array($metadata)) {
    $metadata = [];
}
$metadata['preview_image'] = $relativePath;

$db->update('devices', [
    'metadata' => json_encode($metadata),
    'updated_at' => date('Y-m-d H:i:s')
], 'id = ?', [$deviceId]);

// Log action
Logger::audit('upload_preview', 'devices', [
    'device_id' => $deviceId,
    'file' => $relativePath
]);

Response::success([
    'device_id' => $deviceId,
    'preview_url' => $relativePath,
    'full_url' => '/storage/' . $relativePath,
    'file_size' => $file['size'],
    'mime_type' => $mimeType
], 'Önizleme görseli yüklendi');
