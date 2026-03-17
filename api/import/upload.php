<?php
/**
 * ERP Import File Upload API
 *
 * POST /api/import/upload
 *
 * External ERP systems push import files via API key authentication.
 * Files are saved to company-specific import directory for processing.
 *
 * Authentication: API key via Authorization header or X-Api-Key header
 * The API key is the one configured in Integration Settings > API tab.
 *
 * @package OmnexDisplayHub
 */

require_once BASE_PATH . '/services/SettingsResolver.php';

// =========================================================
// API Key Authentication
// =========================================================
$apiKey = null;

// Try Authorization: Bearer {key}
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if (!$auth && function_exists('apache_request_headers')) {
    $headers = apache_request_headers();
    if (is_array($headers)) {
        foreach ($headers as $headerName => $headerValue) {
            if (strcasecmp((string)$headerName, 'Authorization') === 0) {
                $auth = (string)$headerValue;
                break;
            }
        }
    }
}
if (preg_match('/Bearer\s+(.+)$/i', $auth, $matches)) {
    $apiKey = trim($matches[1]);
}

// Fallback: X-Api-Key header
if (!$apiKey) {
    $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? null;
}

if (!$apiKey) {
    Response::unauthorized('API anahtarı gerekli. Authorization: Bearer {API_KEY} veya X-Api-Key header kullanın.');
}

// Look up company by API key from integration_settings
$db = Database::getInstance();
$companyId = null;

try {
    $rows = $db->fetchAll(
        "SELECT company_id, config_json FROM integration_settings
         WHERE integration_type = 'api' AND scope = 'company' AND is_active = true"
    );

    foreach ($rows as $row) {
        $config = json_decode($row['config_json'] ?? '{}', true);
        if (!empty($config['api_key']) && hash_equals($config['api_key'], $apiKey)) {
            $companyId = $row['company_id'];
            break;
        }
    }
} catch (Exception $e) {
    Logger::error('API key lookup failed', ['error' => $e->getMessage()]);
    Response::error('Kimlik doğrulama hatası', 500);
}

if (!$companyId) {
    Logger::warning('Invalid API key attempt', [
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'key_prefix' => substr($apiKey, 0, 8) . '...'
    ]);
    Response::unauthorized('Geçersiz API anahtarı');
}

// =========================================================
// Check if file import is enabled for this company
// =========================================================
$resolver = new SettingsResolver();
$importSettings = $resolver->getEffectiveSettings('file_import', $companyId);
$config = $importSettings['settings'] ?? [];

if (empty($config['enabled'])) {
    Response::error('Dosya içe aktarma bu firma için aktif değil', 403);
}

// =========================================================
// Validate File Upload
// =========================================================
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE => 'Dosya PHP ini boyut limitini aşıyor',
        UPLOAD_ERR_FORM_SIZE => 'Dosya form boyut limitini aşıyor',
        UPLOAD_ERR_PARTIAL => 'Dosya kısmen yüklendi',
        UPLOAD_ERR_NO_FILE => 'Dosya yüklenmedi',
        UPLOAD_ERR_NO_TMP_DIR => 'Geçici dizin bulunamadı',
        UPLOAD_ERR_CANT_WRITE => 'Dosya yazılamadı',
    ];
    $code = $_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE;
    $msg = $errorMessages[$code] ?? 'Dosya yükleme hatası';
    Response::badRequest($msg);
}

$originalFilename = $_FILES['file']['name'];
$tmpPath = $_FILES['file']['tmp_name'];
$fileSize = $_FILES['file']['size'];

// Validate extension
$allowedFormats = $config['allowed_formats'] ?? ['csv', 'txt', 'json', 'xml', 'xlsx'];
$extension = strtolower(pathinfo($originalFilename, PATHINFO_EXTENSION));

if (!in_array($extension, $allowedFormats)) {
    Response::badRequest('Desteklenmeyen dosya formatı: ' . $extension . '. İzin verilen: ' . implode(', ', $allowedFormats));
}

// Validate file size
$maxSizeMb = $config['max_file_size_mb'] ?? 10;
$maxSizeBytes = $maxSizeMb * 1024 * 1024;

if ($fileSize > $maxSizeBytes) {
    Response::badRequest('Dosya boyutu ' . $maxSizeMb . 'MB limitini aşıyor');
}

// Validate MIME type (basic check)
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $tmpPath);
finfo_close($finfo);

$allowedMimes = [
    'text/plain', 'text/csv', 'text/tab-separated-values',
    'application/json', 'application/xml', 'text/xml',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel', 'application/octet-stream',
    'application/zip' // XLSX files are ZIP archives
];

if (!in_array($mimeType, $allowedMimes)) {
    Response::badRequest('Desteklenmeyen dosya tipi: ' . $mimeType);
}

// Compute file hash for DB record
$fileContent = file_get_contents($tmpPath);
$fileHash = md5($fileContent);

// =========================================================
// Save File
// =========================================================
$importDir = BASE_PATH . '/storage/companies/' . $companyId . '/imports/';

// Ensure directory exists
if (!is_dir($importDir)) {
    mkdir($importDir, 0755, true);
}
if (!is_dir($importDir . 'processed/')) {
    mkdir($importDir . 'processed/', 0755, true);
}
if (!is_dir($importDir . 'failed/')) {
    mkdir($importDir . 'failed/', 0755, true);
}

// Sanitize filename - prevent path traversal
$safeFilename = preg_replace('/[^a-zA-Z0-9._-]/', '_', pathinfo($originalFilename, PATHINFO_FILENAME));
$safeFilename = substr($safeFilename, 0, 100); // Limit length
$timestamp = date('Ymd_His');
$savedFilename = $timestamp . '_' . $safeFilename . '.' . $extension;
$savedPath = $importDir . $savedFilename;

// Verify saved path is within import directory (prevent traversal)
$realImportDir = realpath($importDir);
if (!$realImportDir) {
    Response::error('Import dizini oluşturulamadı', 500);
}

if (!move_uploaded_file($tmpPath, $savedPath)) {
    Response::error('Dosya kaydedilemedi', 500);
}

// Verify saved file is within expected directory
$realSavedPath = realpath($savedPath);
if (!$realSavedPath || strpos($realSavedPath, $realImportDir) !== 0) {
    // Path traversal detected - delete and reject
    @unlink($savedPath);
    Response::badRequest('Geçersiz dosya yolu');
}

// =========================================================
// Record in database
// =========================================================
$fileId = $db->generateUuid();

try {
    $db->insert('erp_import_files', [
        'id' => $fileId,
        'company_id' => $companyId,
        'filename' => $savedFilename,
        'original_filename' => $originalFilename,
        'file_path' => 'storage/companies/' . $companyId . '/imports/' . $savedFilename,
        'file_size' => $fileSize,
        'file_format' => $extension,
        'file_hash' => $fileHash,
        'source' => 'api_push',
        'status' => 'pending',
        'created_at' => date('Y-m-d H:i:s')
    ]);
} catch (Exception $e) {
    Logger::error('Failed to record import file', ['error' => $e->getMessage()]);
}

// Audit log
Logger::audit('create', 'erp_import_file', [
    'company_id' => $companyId,
    'file_id' => $fileId,
    'filename' => $originalFilename,
    'source' => 'api_push',
    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
]);

Response::success([
    'id' => $fileId,
    'filename' => $savedFilename,
    'original_filename' => $originalFilename,
    'file_size' => $fileSize,
    'file_format' => $extension,
    'status' => 'pending',
    'message' => 'Dosya başarıyla yüklendi ve işleme kuyruğuna alındı'
], 'Dosya yüklendi');
