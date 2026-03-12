<?php
/**
 * Media Upload API - With Tenant Isolation & Quota Control
 *
 * STORAGE STRUCTURE (v2.0.14):
 * - /storage/companies/{company_id}/media/images/ - Company images
 * - /storage/companies/{company_id}/media/videos/ - Company videos
 * - /storage/public/ - Shared media (admin only)
 *
 * DEPRECATED:
 * - /storage/media/ - Legacy path (not used for new uploads)
 * - Date-based subdirectories (YYYY/MM) - No longer used
 *
 * @package OmnexDisplayHub
 * @since v2.0.14
 */

require_once dirname(dirname(__DIR__)) . '/services/StorageService.php';
require_once __DIR__ . '/_thumbnail_utils.php';

/**
 * Sanitize SVG content by removing dangerous elements and attributes.
 * Strips <script>, <foreignObject>, on* event handlers, and javascript: URIs.
 */
function sanitizeSvg(string $content): string {
    // Remove XML processing instructions that could be dangerous
    $content = preg_replace('/<\?xml-stylesheet[^>]*>/i', '', $content);

    // Remove <script> tags and their content
    $content = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $content);
    $content = preg_replace('/<script\b[^>]*\/>/is', '', $content);

    // Remove <foreignObject> elements and their content
    $content = preg_replace('/<foreignObject\b[^>]*>.*?<\/foreignObject>/is', '', $content);
    $content = preg_replace('/<foreignObject\b[^>]*\/>/is', '', $content);

    // Remove on* event handler attributes (onclick, onload, onerror, etc.)
    $content = preg_replace('/\s+on\w+\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]*)/i', '', $content);

    // Remove javascript: URIs in href, xlink:href, src, and action attributes
    $content = preg_replace('/(href|xlink:href|src|action)\s*=\s*["\']?\s*javascript:[^"\'>\s]*/i', '$1=""', $content);

    // Remove data: URIs that contain script (data:text/html, etc.) but allow data:image/*
    $content = preg_replace('/(href|xlink:href|src|action)\s*=\s*["\']?\s*data:(?!image\/)[^"\'>\s]*/i', '$1=""', $content);

    // Remove <use> elements with external references (can bypass sanitization)
    $content = preg_replace('/<use\b[^>]*href\s*=\s*["\']https?:\/\/[^"\']*["\'][^>]*\/>/is', '', $content);

    // Remove <embed>, <object>, <iframe> elements
    $content = preg_replace('/<(embed|object|iframe)\b[^>]*>.*?<\/\1>/is', '', $content);
    $content = preg_replace('/<(embed|object|iframe)\b[^>]*\/>/is', '', $content);

    return $content;
}

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$file = $request->file('file');

if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE => 'Dosya boyutu sunucu limitini aşıyor',
        UPLOAD_ERR_FORM_SIZE => 'Dosya boyutu form limitini aşıyor',
        UPLOAD_ERR_PARTIAL => 'Dosya kısmen yüklendi',
        UPLOAD_ERR_NO_FILE => 'Dosya seçilmedi',
        UPLOAD_ERR_NO_TMP_DIR => 'Geçici klasör bulunamadı',
        UPLOAD_ERR_CANT_WRITE => 'Dosya yazılamadı',
        UPLOAD_ERR_EXTENSION => 'Dosya uzantısı engellendi'
    ];
    $errorCode = $file['error'] ?? UPLOAD_ERR_NO_FILE;
    Response::error($errorMessages[$errorCode] ?? 'Dosya yüklenemedi', 400);
}

// Validate file type
$allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/avi', 'video/quicktime',
    'application/pdf'
];

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $allowedTypes)) {
    Response::error('Desteklenmeyen dosya türü: ' . $mimeType, 400);
}

// Determine media type (image | video | document)
$mediaType = 'document';
if (str_starts_with($mimeType, 'image/')) {
    $mediaType = 'image';
} elseif (str_starts_with($mimeType, 'video/')) {
    $mediaType = 'video';
}

// Determine storage target
$target = $request->input('target', 'company'); // 'company' or 'public'

// ========================================
// QUOTA CHECK (v2.0.14)
// ========================================
if ($target === 'company') {
    if (!$companyId) {
        Response::error('Firma bağlamı gerekli', 400);
    }

    $storageService = new StorageService();
    $quotaCheck = $storageService->checkQuota($companyId, $file['size']);

    if (!$quotaCheck['allowed']) {
        Response::error($quotaCheck['message'], 413, [
            'quota_exceeded' => true,
            'current_usage_mb' => round($quotaCheck['usage']['total_bytes'] / 1024 / 1024, 2),
            'limit_mb' => $quotaCheck['limit_mb'],
            'file_size_mb' => round($file['size'] / 1024 / 1024, 2),
            'remaining_mb' => $quotaCheck['remaining_mb'] ?? 0
        ]);
    }
}

// Generate unique filename
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$filename = uniqid() . '_' . time() . '.' . $ext;

// ========================================
// BUILD UPLOAD PATH (v2.0.14 - No date subdirs)
// ========================================
if ($target === 'public') {
    // Public storage - admin only
    $userRole = $user['role'] ?? 'Viewer';
    $isAdmin = in_array(strtolower($userRole), ['superadmin', 'admin']);

    if (!$isAdmin) {
        Response::error('Sadece adminler paylaşılan alana yükleyebilir', 403);
    }

    // Public path (still uses media type subdirs)
    $typeSubdir = ($mediaType === 'video') ? 'videos' : 'images';
    $relativePath = 'public/' . $typeSubdir;
    $uploadDir = STORAGE_PATH . '/public/' . $typeSubdir;
} else {
    // Company-specific storage (NEW structure - no date subdirs)
    $typeSubdir = ($mediaType === 'video') ? 'videos' : 'images';
    $relativePath = 'companies/' . $companyId . '/media/' . $typeSubdir;
    $uploadDir = STORAGE_PATH . '/companies/' . $companyId . '/media/' . $typeSubdir;
}

// Create directory structure
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        Response::error('Klasör oluşturulamadı', 500);
    }
}

$filepath = $uploadDir . '/' . $filename;

// Sanitize SVG files before saving
if ($mimeType === 'image/svg+xml') {
    $svgContent = file_get_contents($file['tmp_name']);
    $svgContent = sanitizeSvg($svgContent);
    if (file_put_contents($filepath, $svgContent) === false) {
        Response::error('Dosya kaydedilemedi', 500);
    }
} else {
    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        Response::error('Dosya kaydedilemedi', 500);
    }
}

// Get file size (actual on disk)
$actualFileSize = filesize($filepath);

// Get image dimensions if applicable
$width = null;
$height = null;
if ($mediaType === 'image' && $mimeType !== 'image/svg+xml') {
    $size = getimagesize($filepath);
    if ($size) {
        $width = $size[0];
        $height = $size[1];
    }
}

// For public uploads, company_id can be null (shared resource)
$insertCompanyId = ($target === 'public') ? null : $companyId;

// Generate ID
$id = $db->generateUuid();

// Save to database with new fields
$db->insert('media', [
    'id' => $id,
    'company_id' => $insertCompanyId,
    'folder_id' => $request->input('folder_id'),
    'name' => pathinfo($file['name'], PATHINFO_FILENAME),
    'original_name' => $file['name'],
    'file_path' => $relativePath . '/' . $filename,
    'file_type' => $mediaType,  // Backward compat (image, video, document)
    'media_type' => $mediaType, // New field (image | video)
    'mime_type' => $mimeType,
    'file_size' => $actualFileSize,
    'width' => $width,
    'height' => $height,
    'uploaded_by' => $user['id'],
    'is_public' => ($target === 'public') ? 1 : 0,
    'scope' => $target  // 'company' or 'public'
]);

// Best-effort: video upload sonrasinda otomatik transcode kuyrukla
if ($mediaType === 'video' && !empty($insertCompanyId)) {
    try {
        $transcodeQueue = new TranscodeQueueService();
        $transcodeQueue->autoEnqueueOnUpload($id, $insertCompanyId);
    } catch (\Throwable $e) {
        error_log('Media upload auto-transcode enqueue skipped: ' . $e->getMessage());
    }
}

// ========================================
// UPDATE STORAGE USAGE (v2.0.14)
// ========================================
if ($target === 'company' && $companyId) {
    $storageService->incrementUsage($companyId, $actualFileSize, 'media');
}

$media = $db->fetch("SELECT * FROM media WHERE id = ?", [$id]);

// Calculate base URL for media files
$basePath = '';
if (defined('BASE_PATH')) {
    $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
    $docRoot = str_replace('\\', '/', rtrim($docRoot, '/\\'));
    $fsBasePath = str_replace('\\', '/', BASE_PATH);

    if ($docRoot && strpos($fsBasePath, $docRoot) === 0) {
        $basePath = substr($fsBasePath, strlen($docRoot));
        $basePath = rtrim($basePath, '/');
    }
}

// Add virtual fields for frontend compatibility
$media['path'] = $media['file_path'];
$media['type'] = $media['file_type'];
$media['size'] = $media['file_size'];
$media['filename'] = basename($media['file_path']);
$media['url'] = $basePath . '/storage/' . $media['file_path'];

// Pre-generate and expose thumbnail URL (especially for videos)
if (in_array($mediaType, ['image', 'video'], true)) {
    // Best-effort: do not block upload success if thumbnail generation fails
    @media_thumbnail_ensure($media, 200);
    $thumbUrl = media_thumbnail_url($media, $basePath, 200);
    if ($thumbUrl) {
        $media['thumbnail_url'] = $thumbUrl;
    }
}

Logger::audit('upload', 'media', [
    'media_id' => $id,
    'media_type' => $mediaType,
    'file_size' => $actualFileSize,
    'company_id' => $companyId
]);

Response::created($media, 'Dosya yüklendi');
