<?php
/**
 * Product Import Analysis API
 *
 * Analyzes uploaded file and suggests field mappings
 */

$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

// Check for file upload
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    Response::validationError(['file' => ['Dosya yüklenemedi']]);
}

$allowedTypes = [
    'text/plain',
    'text/csv',
    'application/json',
    'text/xml',
    'application/xml',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream' // For XLSX files
];

$allowedExtensions = ['txt', 'csv', 'json', 'xml', 'xlsx', 'xls'];

// Validate file
$filename = $_FILES['file']['name'];
$extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

if (!in_array($extension, $allowedExtensions)) {
    Response::validationError(['file' => ['Desteklenmeyen dosya formatı. Desteklenen: TXT, CSV, JSON, XML, XLSX']]);
}

// Check file size (max 10MB)
if ($_FILES['file']['size'] > 10 * 1024 * 1024) {
    Response::validationError(['file' => ['Dosya boyutu 10MB\'ı aşamaz']]);
}

// Read file content
$content = file_get_contents($_FILES['file']['tmp_name']);

if (empty($content)) {
    Response::validationError(['file' => ['Dosya boş veya okunamadı']]);
}

try {
    // Load parsers
    require_once PARSERS_PATH . '/BaseParser.php';
    require_once PARSERS_PATH . '/JsonParser.php';
    require_once PARSERS_PATH . '/TxtParser.php';
    require_once PARSERS_PATH . '/CsvParser.php';
    require_once PARSERS_PATH . '/XmlParser.php';
    require_once PARSERS_PATH . '/XlsxParser.php';
    require_once PARSERS_PATH . '/ParserFactory.php';
    require_once SERVICES_PATH . '/SmartFieldMapper.php';

    // Auto-detect parser
    $parser = OmnexParserFactory::autoDetect($content, $filename);
    $format = $parser->getType();

    // Parse data
    $data = $parser->parse($content);

    if (empty($data)) {
        Response::error('Dosyada veri bulunamadı', 400);
    }

    // Get headers from first row
    $headers = array_keys($data[0]);

    // Get sample data (first 5 rows)
    $sampleData = array_slice($data, 0, 5);

    // Get smart mapping suggestions
    $suggestions = SmartFieldMapper::getSuggestions($headers, $sampleData);
    $autoMappings = SmartFieldMapper::detectMappings($headers, $sampleData);

    // Calculate mapping statistics
    $mappedCount = 0;
    $requiredMapped = true;
    $requiredFields = ['sku', 'name', 'current_price'];

    foreach ($requiredFields as $field) {
        if (!isset($autoMappings[$field])) {
            $requiredMapped = false;
        }
    }

    foreach ($autoMappings as $target => $source) {
        if ($source) {
            $mappedCount++;
        }
    }

    // Build response
    $response = [
        'success' => true,
        'file' => [
            'name' => $filename,
            'size' => $_FILES['file']['size'],
            'format' => $format
        ],
        'analysis' => [
            'total_rows' => count($data),
            'total_columns' => count($headers),
            'headers' => $headers,
            'sample_data' => $sampleData
        ],
        'mapping' => [
            'auto_detected' => $autoMappings,
            'suggestions' => $suggestions,
            'mapped_count' => $mappedCount,
            'required_complete' => $requiredMapped,
            'target_fields' => SmartFieldMapper::getTargetFields()
        ]
    ];

    Response::success($response);

} catch (Exception $e) {
    Logger::error('Import analysis failed', [
        'error' => $e->getMessage(),
        'file' => $filename
    ]);
    Response::error('Dosya analiz edilemedi: ' . $e->getMessage(), 400);
}
