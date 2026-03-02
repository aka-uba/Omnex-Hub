<?php
/**
 * Upload User Avatar API
 */

$db = Database::getInstance();
$currentUser = Auth::user();

// Get user ID from request
$userId = $request->input('user_id');

if (!$userId) {
    Response::badRequest('Kullanıcı ID gerekli');
}

// Check if target user exists
$targetUser = $db->fetch("SELECT * FROM users WHERE id = ?", [$userId]);
if (!$targetUser) {
    Response::notFound('Kullanıcı bulunamadı');
}

// Permission check: Admin/SuperAdmin can edit any user, others can only edit themselves
if ($currentUser['role'] !== 'SuperAdmin' && $currentUser['role'] !== 'Admin') {
    if ($currentUser['id'] !== $userId) {
        Response::forbidden('Bu kullanıcının avatarını değiştirme yetkiniz yok');
    }
}

// Check file upload
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE => 'Dosya boyutu çok büyük',
        UPLOAD_ERR_FORM_SIZE => 'Dosya boyutu çok büyük',
        UPLOAD_ERR_PARTIAL => 'Dosya kısmen yüklendi',
        UPLOAD_ERR_NO_FILE => 'Dosya yüklenmedi',
        UPLOAD_ERR_NO_TMP_DIR => 'Geçici klasör bulunamadı',
        UPLOAD_ERR_CANT_WRITE => 'Dosya yazılamadı',
    ];
    $errorCode = $_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE;
    Response::badRequest($errorMessages[$errorCode] ?? 'Dosya yüklenemedi');
}

$file = $_FILES['file'];
$maxSize = 500 * 1024; // 500KB

if ($file['size'] > $maxSize) {
    Response::badRequest('Dosya boyutu 500KB\'dan büyük olamaz');
}

// Validate file type
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
$allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

$extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

if (!in_array($mimeType, $allowedTypes) && !in_array($extension, $allowedExtensions)) {
    Response::badRequest('Geçersiz dosya formatı. JPG, PNG, WEBP veya GIF kullanın');
}

// Create storage directory for user avatars
$avatarPath = dirname(__DIR__, 2) . '/storage/avatars';
if (!is_dir($avatarPath)) {
    mkdir($avatarPath, 0755, true);
}

// Delete existing avatar files
foreach ($allowedExtensions as $ext) {
    $existingFile = $avatarPath . '/' . $userId . '.' . $ext;
    if (file_exists($existingFile)) {
        unlink($existingFile);
    }
}

// Save new avatar
$targetFilename = $userId . '.' . $extension;
$targetPath = $avatarPath . '/' . $targetFilename;

if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
    Response::serverError('Avatar kaydedilemedi');
}

// Update user record with avatar path
$avatarUrl = 'storage/avatars/' . $targetFilename;
$db->update('users', ['avatar' => $avatarUrl, 'updated_at' => date('Y-m-d H:i:s')], 'id = ?', [$userId]);

Response::success([
    'path' => $avatarUrl,
    'user_id' => $userId
], 'Avatar yüklendi');
