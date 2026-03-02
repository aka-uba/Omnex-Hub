<?php
/**
 * Branding Upload Endpoint
 *
 * Handles logo, favicon, and PWA icon uploads
 * Files are saved to /public/branding/ folder with fixed names
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

// Only admins can upload branding
if (!in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu islemi yapmak icin yetkiniz yok');
}

// Check if file was uploaded
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    Response::error('Dosya yuklenemedi', 400);
}

// Get target type
$target = $_POST['target'] ?? '';
$validTargets = ['logo', 'logo-dark', 'favicon', 'icon'];

if (!in_array($target, $validTargets)) {
    Response::error('Gecersiz hedef tipi', 400);
}

$file = $_FILES['file'];
$maxSize = 200 * 1024; // 200KB

// Validate file size
if ($file['size'] > $maxSize) {
    Response::error('Dosya boyutu 200KB dan buyuk olamaz', 400);
}

// Get file extension
$fileName = $file['name'];
$fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

// Validate file type
$validExtensions = ['svg', 'png', 'ico', 'jpg', 'jpeg', 'webp'];
if (!in_array($fileExt, $validExtensions)) {
    Response::error('Gecersiz dosya formati. SVG, PNG, JPG, WEBP veya ICO kullanin', 400);
}

// Validate MIME type
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($file['tmp_name']);
$validMimes = [
    'image/svg+xml',
    'image/png',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'image/jpeg',
    'image/webp',
    'text/xml', // Some servers report SVG as text/xml
    'text/plain', // Some servers report SVG as text/plain
    'application/xml'
];

if (!in_array($mimeType, $validMimes)) {
    Response::error('Gecersiz dosya tipi: ' . $mimeType, 400);
}

// Branding folder path
$brandingPath = dirname(__DIR__, 2) . '/public/branding';

// Ensure branding folder exists
if (!is_dir($brandingPath)) {
    mkdir($brandingPath, 0755, true);
}

// Determine target filename based on type
$targetFilenames = [
    'logo' => 'logo',
    'logo-dark' => 'logo-dark',
    'favicon' => 'favicon',
    'icon' => 'icon-192' // Will also update icon-512 and icon-maskable
];

$baseName = $targetFilenames[$target];

// Delete existing files with same base name (different extensions)
foreach (['svg', 'png', 'ico', 'jpg', 'jpeg', 'webp'] as $ext) {
    $existingFile = $brandingPath . '/' . $baseName . '.' . $ext;
    if (file_exists($existingFile)) {
        unlink($existingFile);
    }
}

// If icon, also delete related icon files
if ($target === 'icon') {
    foreach (['icon-512', 'icon-maskable'] as $iconName) {
        foreach (['svg', 'png', 'jpg', 'jpeg', 'webp'] as $ext) {
            $existingFile = $brandingPath . '/' . $iconName . '.' . $ext;
            if (file_exists($existingFile)) {
                unlink($existingFile);
            }
        }
    }
}

// Save the new file
$newFileName = $baseName . '.' . $fileExt;
$targetPath = $brandingPath . '/' . $newFileName;

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    Response::error('Dosya kaydedilemedi', 500);
}

// If icon upload, copy to other icon files
if ($target === 'icon') {
    copy($targetPath, $brandingPath . '/icon-512.' . $fileExt);
    copy($targetPath, $brandingPath . '/icon-maskable.' . $fileExt);
}

// Return success with relative path
$relativePath = 'branding/' . $newFileName;

Response::success([
    'path' => $relativePath,
    'filename' => $newFileName,
    'size' => $file['size'],
    'type' => $fileExt
], 'Gorsel basariyla yuklendi');
