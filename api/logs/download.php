<?php
/**
 * Log Management API - Download log file
 */

$user = Auth::user();
if (!$user || $user['role'] !== 'SuperAdmin') {
    Response::forbidden('Sadece SuperAdmin erişebilir');
}

$filename = $_GET['file'] ?? null;
if (!$filename) {
    Response::error('Dosya adı gerekli', 400);
}

$logDir = STORAGE_PATH . '/logs';
$filePath = $logDir . '/' . basename($filename);

if (!file_exists($filePath)) {
    Response::error('Dosya bulunamadı', 404);
}

// Security check
$realPath = realpath($filePath);
$realLogDir = realpath($logDir);
if (strpos($realPath, $realLogDir) !== 0) {
    Response::error('Geçersiz dosya yolu', 403);
}

// Send file for download
header('Content-Type: text/plain; charset=utf-8');
header('Content-Disposition: attachment; filename="' . basename($filename) . '"');
header('Content-Length: ' . filesize($filePath));
header('Cache-Control: no-cache, no-store, must-revalidate');

readfile($filePath);
exit;
