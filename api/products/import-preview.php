<?php
/**
 * Product Import Preview API
 */

$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

// Debug: Check what we received
if (empty($_FILES) && empty($_POST)) {
    // Check for raw input
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        // Could be multipart not being parsed correctly
        error_log("Import preview: Raw input received but FILES/POST empty. Content-Type: " . ($_SERVER['CONTENT_TYPE'] ?? 'not set'));
    }
}

// Check for file upload or raw content
$content = null;
$filename = null;

if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
    // Validate by extension instead of MIME type (more reliable for xlsx)
    $allowedExtensions = ['txt', 'csv', 'json', 'xml', 'xlsx', 'xls'];
    $extension = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));

    if (!in_array($extension, $allowedExtensions)) {
        Response::validationError(['file' => ['Desteklenmeyen dosya formatı. İzin verilen: ' . implode(', ', $allowedExtensions)]]);
    }

    // Check file size (10MB max)
    if ($_FILES['file']['size'] > 10 * 1024 * 1024) {
        Response::validationError(['file' => ['Dosya boyutu 10MB\'ı aşamaz']]);
    }

    $content = file_get_contents($_FILES['file']['tmp_name']);
    $filename = $_FILES['file']['name'];

} elseif ($request->input('content')) {
    $content = $request->input('content');
    $filename = $request->input('filename');

} elseif (isset($_FILES['file'])) {
    // File upload error
    $uploadErrors = [
        UPLOAD_ERR_INI_SIZE => 'Dosya PHP ini ayarındaki maksimum boyutu aşıyor',
        UPLOAD_ERR_FORM_SIZE => 'Dosya form MAX_FILE_SIZE değerini aşıyor',
        UPLOAD_ERR_PARTIAL => 'Dosya kısmen yüklendi',
        UPLOAD_ERR_NO_FILE => 'Dosya yüklenmedi',
        UPLOAD_ERR_NO_TMP_DIR => 'Geçici klasör bulunamadı',
        UPLOAD_ERR_CANT_WRITE => 'Dosya diske yazılamadı',
        UPLOAD_ERR_EXTENSION => 'PHP eklentisi dosya yüklemeyi durdurdu'
    ];
    $errorCode = $_FILES['file']['error'];
    $errorMsg = $uploadErrors[$errorCode] ?? "Bilinmeyen hata kodu: $errorCode";
    Response::validationError(['file' => [$errorMsg]]);
} else {
    Response::validationError(['file' => ['Dosya veya içerik gerekli. FILES: ' . json_encode(array_keys($_FILES)) . ', POST: ' . json_encode(array_keys($_POST))]]);
}

// Get mapping name and preview limit
$mappingName = $request->input('mapping', 'default');
$limit = (int)$request->input('limit', 10);

// Load parsers
require_once PARSERS_PATH . '/BaseParser.php';
require_once PARSERS_PATH . '/JsonParser.php';
require_once PARSERS_PATH . '/TxtParser.php';
require_once PARSERS_PATH . '/CsvParser.php';
require_once PARSERS_PATH . '/XmlParser.php';
require_once PARSERS_PATH . '/XlsxParser.php';
require_once PARSERS_PATH . '/ParserFactory.php';

// Preview
require_once SERVICES_PATH . '/ImportService.php';

try {
    // Debug: Log start
    Logger::debug('Import preview starting', [
        'filename' => $filename,
        'content_length' => strlen($content),
        'mapping' => $mappingName,
        'company_id' => $companyId
    ]);

    $importService = new ImportService($companyId);

    $result = $importService->preview(
        $content,
        $mappingName,
        $filename,
        $limit
    );

    // Debug: Log success
    Logger::debug('Import preview completed', [
        'total_rows' => $result['total_rows'] ?? 0,
        'success' => $result['success'] ?? false
    ]);

    Response::success($result, 'Önizleme hazırlandı');

} catch (Throwable $e) {
    // Catch all errors including TypeError
    Logger::error('Import preview failed', [
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ]);
    Response::error('İçe aktarma önizleme hatası: ' . $e->getMessage(), 500);
}
