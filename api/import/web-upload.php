<?php
/**
 * Web-based Import File Upload API
 *
 * POST /api/import/web-upload
 *
 * Authenticated users upload import files from the Integration Settings page.
 * Supports multiple file upload. Files saved to company import directory.
 *
 * Authentication: JWT session (AuthMiddleware)
 * Required role: admin or higher
 *
 * @package OmnexDisplayHub
 */

require_once BASE_PATH . '/services/SettingsResolver.php';

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Only admin+ can upload import files
if (!in_array($user['role'], ['superadmin', 'SuperAdmin', 'admin', 'Admin'])) {
    Response::forbidden('Bu işlem için yetkiniz yok');
}

$companyId = Auth::getActiveCompanyId();
if (!$companyId) {
    Response::badRequest('Firma bilgisi bulunamadı');
}

$db = Database::getInstance();

// Get import settings for validation
$resolver = new SettingsResolver();
$importSettings = $resolver->getEffectiveSettings('file_import', $companyId);
$config = $importSettings['settings'] ?? [];

$allowedFormats = $config['allowed_formats'] ?? ['csv', 'txt', 'json', 'xml', 'xlsx'];
$maxSizeMb = $config['max_file_size_mb'] ?? 10;
$maxSizeBytes = $maxSizeMb * 1024 * 1024;

$allowedMimes = [
    'text/plain', 'text/csv', 'text/tab-separated-values',
    'application/csv', 'text/comma-separated-values', 'text/x-csv',
    'application/json', 'application/xml', 'text/xml',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel', 'application/octet-stream',
    'application/zip'
];

// Ensure import directory exists
$importDir = BASE_PATH . '/storage/companies/' . $companyId . '/imports/';
if (!is_dir($importDir)) {
    mkdir($importDir, 0755, true);
}
if (!is_dir($importDir . 'processed/')) {
    mkdir($importDir . 'processed/', 0755, true);
}
if (!is_dir($importDir . 'failed/')) {
    mkdir($importDir . 'failed/', 0755, true);
}

// Collect uploaded files - support both single and multi-file
$uploadedFiles = [];

if (isset($_FILES['files'])) {
    // Multiple files: files[]
    if (is_array($_FILES['files']['name'])) {
        $count = count($_FILES['files']['name']);
        for ($i = 0; $i < $count; $i++) {
            $uploadedFiles[] = [
                'name'     => $_FILES['files']['name'][$i],
                'tmp_name' => $_FILES['files']['tmp_name'][$i],
                'size'     => $_FILES['files']['size'][$i],
                'error'    => $_FILES['files']['error'][$i],
                'type'     => $_FILES['files']['type'][$i] ?? ''
            ];
        }
    } else {
        // Single file submitted as files
        $uploadedFiles[] = [
            'name'     => $_FILES['files']['name'],
            'tmp_name' => $_FILES['files']['tmp_name'],
            'size'     => $_FILES['files']['size'],
            'error'    => $_FILES['files']['error'],
            'type'     => $_FILES['files']['type'] ?? ''
        ];
    }
} elseif (isset($_FILES['file'])) {
    // Single file as file
    $uploadedFiles[] = [
        'name'     => $_FILES['file']['name'],
        'tmp_name' => $_FILES['file']['tmp_name'],
        'size'     => $_FILES['file']['size'],
        'error'    => $_FILES['file']['error'],
        'type'     => $_FILES['file']['type'] ?? ''
    ];
}

if (empty($uploadedFiles)) {
    Response::badRequest('Dosya yüklenmedi');
}

$results = [];
$successCount = 0;
$failCount = 0;

foreach ($uploadedFiles as $file) {
    $originalFilename = $file['name'] ?? '';
    $tmpPath = $file['tmp_name'] ?? '';
    $fileSize = $file['size'] ?? 0;
    $fileError = $file['error'] ?? UPLOAD_ERR_NO_FILE;

    // Check upload error
    if ($fileError !== UPLOAD_ERR_OK) {
        $failCount++;
        $results[] = [
            'filename' => $originalFilename,
            'success' => false,
            'error' => 'Yükleme hatası (kod: ' . $fileError . ')'
        ];
        continue;
    }

    // Validate extension
    $extension = strtolower(pathinfo($originalFilename, PATHINFO_EXTENSION));
    if (!in_array($extension, $allowedFormats)) {
        $failCount++;
        $results[] = [
            'filename' => $originalFilename,
            'success' => false,
            'error' => 'Desteklenmeyen format: .' . $extension
        ];
        continue;
    }

    // Validate file size
    if ($fileSize > $maxSizeBytes) {
        $failCount++;
        $results[] = [
            'filename' => $originalFilename,
            'success' => false,
            'error' => 'Dosya boyutu ' . $maxSizeMb . 'MB limitini aşıyor'
        ];
        continue;
    }

    // Validate MIME
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $tmpPath);
    finfo_close($finfo);

    // Text-based formats (csv, txt, tsv, json, xml) are allowed if MIME starts with text/ or is application/json|xml
    $textExtensions = ['csv', 'txt', 'tsv', 'json', 'xml', 'dat'];
    $isTextBased = in_array($extension, $textExtensions);
    $mimeOk = in_array($mimeType, $allowedMimes)
        || ($isTextBased && (strpos($mimeType, 'text/') === 0 || in_array($mimeType, ['application/json', 'application/xml'])));

    if (!$mimeOk) {
        $failCount++;
        $results[] = [
            'filename' => $originalFilename,
            'success' => false,
            'error' => 'Desteklenmeyen dosya tipi: ' . $mimeType . ' (.' . $extension . ')'
        ];
        continue;
    }

    // Compute file hash for DB record
    $fileContent = file_get_contents($tmpPath);
    $fileHash = md5($fileContent);

    // Sanitize and save file
    $safeFilename = preg_replace('/[^a-zA-Z0-9._-]/', '_', pathinfo($originalFilename, PATHINFO_FILENAME));
    $safeFilename = substr($safeFilename, 0, 100);
    $timestamp = date('Ymd_His');
    $savedFilename = $timestamp . '_' . $safeFilename . '.' . $extension;
    $savedPath = $importDir . $savedFilename;

    $realImportDir = realpath($importDir);
    if (!$realImportDir) {
        $failCount++;
        $results[] = [
            'filename' => $originalFilename,
            'success' => false,
            'error' => 'Import dizini oluşturulamadı'
        ];
        continue;
    }

    if (!move_uploaded_file($tmpPath, $savedPath)) {
        $failCount++;
        $results[] = [
            'filename' => $originalFilename,
            'success' => false,
            'error' => 'Dosya kaydedilemedi'
        ];
        continue;
    }

    // Path traversal check
    $realSavedPath = realpath($savedPath);
    if (!$realSavedPath || strpos($realSavedPath, $realImportDir) !== 0) {
        @unlink($savedPath);
        $failCount++;
        $results[] = [
            'filename' => $originalFilename,
            'success' => false,
            'error' => 'Geçersiz dosya yolu'
        ];
        continue;
    }

    // Record in DB
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
            'source' => 'web_upload',
            'status' => 'pending',
            'created_at' => date('Y-m-d H:i:s')
        ]);
    } catch (Exception $e) {
        Logger::error('Failed to record import file', ['error' => $e->getMessage()]);
    }

    Logger::audit('create', 'erp_import_file', [
        'company_id' => $companyId,
        'file_id' => $fileId,
        'filename' => $originalFilename,
        'source' => 'web_upload',
        'user_id' => $user['id']
    ]);

    $successCount++;
    $results[] = [
        'filename' => $originalFilename,
        'saved_filename' => $savedFilename,
        'success' => true,
        'id' => $fileId,
        'file_size' => $fileSize,
        'file_format' => $extension
    ];
}

$totalCount = $successCount + $failCount;
$message = $successCount . '/' . $totalCount . ' dosya başarıyla yüklendi';

Response::success([
    'results' => $results,
    'success_count' => $successCount,
    'fail_count' => $failCount,
    'total_count' => $totalCount
], $message);
