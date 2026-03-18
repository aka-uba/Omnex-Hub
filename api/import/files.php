<?php
/**
 * Import Directory Files API
 *
 * GET  /api/import/files         - List files in company import directory
 * POST /api/import/files/import  - Trigger manual import for a specific file
 *
 * @package OmnexDisplayHub
 */

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

require_once BASE_PATH . '/services/SettingsResolver.php';

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$companyId = Auth::getActiveCompanyId();

$importDir = BASE_PATH . '/storage/companies/' . $companyId . '/imports/';
$processedDir = $importDir . 'processed/';
$failedDir = $importDir . 'failed/';

// =========================================================
// GET: List files in import directory
// =========================================================
if ($method === 'GET' && !empty($_GET['preview'])) {
    // Preview a specific file for mapping configuration
    $previewFilename = basename($_GET['preview']);
    $filePath = $importDir . $previewFilename;

    if (!file_exists($filePath) || !is_file($filePath)) {
        Response::badRequest('Dosya bulunamadı: ' . $previewFilename);
    }

    $realImportDir = is_dir($importDir) ? realpath($importDir) : null;
    $realPath = realpath($filePath);
    if (!$realPath || !$realImportDir || strpos($realPath, $realImportDir) !== 0) {
        Response::badRequest('Geçersiz dosya yolu');
    }

    require_once BASE_PATH . '/parsers/BaseParser.php';
    require_once BASE_PATH . '/parsers/TxtParser.php';
    require_once BASE_PATH . '/parsers/CsvParser.php';
    require_once BASE_PATH . '/parsers/JsonParser.php';
    require_once BASE_PATH . '/parsers/XmlParser.php';
    require_once BASE_PATH . '/parsers/XlsxParser.php';
    require_once BASE_PATH . '/parsers/ParserFactory.php';
    require_once BASE_PATH . '/services/SmartFieldMapper.php';

    $fileContent = file_get_contents($filePath);
    $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

    try {
        $parser = OmnexParserFactory::autoDetect($fileContent, $previewFilename);
        $rawData = $parser->parse($fileContent);

        if (empty($rawData) || !is_array($rawData)) {
            throw new Exception('Dosya parse edilemedi veya boş');
        }

        $firstRow = $rawData[0] ?? [];
        $headers = is_array($firstRow) ? array_keys($firstRow) : [];
        $sampleData = array_slice($rawData, 0, 5);

        $detected = SmartFieldMapper::detectMappings($headers, $sampleData);

        Response::success([
            'filename' => $previewFilename,
            'total_rows' => count($rawData),
            'detected_fields' => $headers,
            'detected_mappings' => $detected['mappings'] ?? [],
            'sample_data' => $sampleData,
            'mapped_data' => $sampleData
        ]);
    } catch (Exception $e) {
        Response::error('Dosya önizleme hatası: ' . $e->getMessage(), 422);
    }
}

if ($method === 'GET' && empty($_GET['preview'])) {
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $perPage = min(100, max(1, (int) ($_GET['per_page'] ?? 10)));
    $files = [];

    if (is_dir($importDir)) {
        foreach (glob($importDir . '*') as $filePath) {
            if (!is_file($filePath)) continue;

            $filename = basename($filePath);
            $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

            // Skip non-import files
            $allowedExtensions = ['csv', 'txt', 'tsv', 'json', 'xml', 'xlsx', 'xls', 'dat'];
            if (!in_array($extension, $allowedExtensions)) continue;

            $fileSize = filesize($filePath);
            $modified = filemtime($filePath);

            // Check if already imported (by hash)
            $fileHash = md5_file($filePath);
            $alreadyImported = false;

            try {
                $existing = $db->fetch(
                    "SELECT id, status FROM erp_import_files
                     WHERE company_id = ? AND file_hash = ? AND status IN ('completed', 'processing')
                     ORDER BY created_at DESC LIMIT 1",
                    [$companyId, $fileHash]
                );
                if ($existing) {
                    $alreadyImported = true;
                }
            } catch (Exception $e) {
                // Table might not exist
            }

            $files[] = [
                'filename' => $filename,
                'extension' => $extension,
                'size' => $fileSize,
                'size_formatted' => $fileSize >= 1048576
                    ? round($fileSize / 1048576, 1) . ' MB'
                    : round($fileSize / 1024, 1) . ' KB',
                'modified' => date('Y-m-d H:i:s', $modified),
                'hash' => $fileHash,
                'already_imported' => $alreadyImported
            ];
        }

        // Sort by modification time, newest first
        usort($files, function ($a, $b) {
            return strtotime($b['modified']) - strtotime($a['modified']);
        });
    }

    $total = count($files);
    $offset = ($page - 1) * $perPage;
    $pagedFiles = array_slice($files, $offset, $perPage);

    $defaultImportFilename = null;
    try {
        $resolver = new SettingsResolver();
        $effective = $resolver->getEffectiveSettings('file_import', $companyId);
        $settings = $effective['settings'] ?? [];
        $defaultImportFilename = !empty($settings['default_import_filename'])
            ? (string)$settings['default_import_filename']
            : null;
    } catch (Exception $e) {
        // Keep listing resilient if settings fetch fails
    }

    Response::success([
        'files' => $pagedFiles,
        'directory' => 'storage/companies/' . $companyId . '/imports/',
        'default_import_filename' => $defaultImportFilename,
        'total' => $total,
        'pagination' => [
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => max(1, (int)ceil($total / $perPage))
        ]
    ]);
}

// =========================================================
// POST: Trigger manual import for a specific file
// =========================================================
if ($method === 'POST') {
    // Only admin+ can trigger import
    if (!in_array($user['role'], ['SuperAdmin', 'Admin', 'Manager'])) {
        Response::forbidden('Import yapma yetkiniz yok');
    }

    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $filename = $data['filename'] ?? '';

    if (empty($filename)) {
        Response::badRequest('Dosya adı gerekli');
    }

    // Sanitize filename - prevent path traversal
    $filename = basename($filename);
    $filePath = $importDir . $filename;

    // Verify file exists and is within import directory
    if (!file_exists($filePath) || !is_file($filePath)) {
        Response::badRequest('Dosya bulunamadı: ' . $filename);
    }

    $realImportDir = realpath($importDir);
    $realFilePath = realpath($filePath);
    if (!$realFilePath || !$realImportDir || strpos($realFilePath, $realImportDir) !== 0) {
        Response::badRequest('Geçersiz dosya yolu');
    }

    // Load parsers and helpers
    require_once BASE_PATH . '/parsers/BaseParser.php';
    require_once BASE_PATH . '/parsers/TxtParser.php';
    require_once BASE_PATH . '/parsers/CsvParser.php';
    require_once BASE_PATH . '/parsers/JsonParser.php';
    require_once BASE_PATH . '/parsers/XmlParser.php';
    require_once BASE_PATH . '/parsers/XlsxParser.php';
    require_once BASE_PATH . '/parsers/ParserFactory.php';
    require_once BASE_PATH . '/services/SmartFieldMapper.php';
    require_once BASE_PATH . '/services/ProductImportHelper.php';

    $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $fileSize = filesize($filePath);
    $fileContent = file_get_contents($filePath);
    $fileHash = md5($fileContent);

    $fileId = null;

    // Reuse pending API/directory record for the same hash when available
    try {
        $pending = $db->fetch(
            "SELECT id FROM erp_import_files
             WHERE company_id = ? AND file_hash = ? AND status IN ('pending', 'processing')
             ORDER BY created_at DESC LIMIT 1",
            [$companyId, $fileHash]
        );

        if ($pending) {
            $fileId = $pending['id'];
            $db->update('erp_import_files', [
                'status' => 'processing',
                'processed_at' => null
            ], 'id = ?', [$fileId]);
        }

        // Allow re-import of previously imported files
    } catch (Exception $e) {
        // Continue
    }

    // Create DB record
    if (!$fileId) {
        $fileId = $db->generateUuid();
        try {
            $db->insert('erp_import_files', [
                'id' => $fileId,
                'company_id' => $companyId,
                'filename' => $filename,
                'original_filename' => $filename,
                'file_path' => 'storage/companies/' . $companyId . '/imports/' . $filename,
                'file_size' => $fileSize,
                'file_format' => $extension,
                'file_hash' => $fileHash,
                'source' => 'manual',
                'status' => 'processing',
                'created_at' => date('Y-m-d H:i:s')
            ]);
        } catch (Exception $e) {
            Logger::error('Failed to create import record', ['error' => $e->getMessage()]);
        }
    }

    // Parse file
    try {
        $parser = OmnexParserFactory::autoDetect($fileContent, $filename);
        $rawData = $parser->parse($fileContent);

        if (empty($rawData) || !is_array($rawData)) {
            throw new Exception('Dosya parse edilemedi veya boş');
        }

        $firstRow = $rawData[0] ?? [];
        $headers = is_array($firstRow) ? array_keys($firstRow) : [];

        // Get import settings for default mappings
        $resolver = new SettingsResolver();
        $importSettings = $resolver->getEffectiveSettings('file_import', $companyId);
        $config = $importSettings['settings'] ?? [];

        // Use frontend-sent mappings > saved mappings > auto-detect
        $requestMappings = $data['mappings'] ?? [];
        $mappings = !empty($requestMappings) ? $requestMappings : ($config['default_mappings'] ?? []);
        $mappingSource = !empty($requestMappings) ? 'saved' : (!empty($config['default_mappings']) ? 'saved' : 'auto');

        if (empty($mappings)) {
            $sampleData = array_slice($rawData, 0, 5);
            $detected = SmartFieldMapper::detectMappings($headers, $sampleData);
            $mappings = $detected['mappings'] ?? [];
            $mappingSource = 'auto';
        }

        if (empty($mappings)) {
            throw new Exception('Alan eşleştirmesi yapılamadı. Lütfen varsayılan eşleştirmeleri ayarlayın.');
        }

        // Import options (from modal override or config defaults)
        $requestOptions = $data['options'] ?? [];
        $options = [
            'update_existing' => $requestOptions['update_existing'] ?? $config['update_existing'] ?? true,
            'create_new' => $requestOptions['create_new'] ?? $config['create_new'] ?? true,
            'skip_errors' => $requestOptions['skip_errors'] ?? $config['skip_errors'] ?? true,
            'trigger_render' => $requestOptions['trigger_render'] ?? $config['trigger_render'] ?? true
        ];

        // Run import
        $report = runImportPipeline($rawData, $mappings, $companyId, $user['id'], $options);
        $summary = $report['summary'] ?? [];

        $inserted = $summary['inserted'] ?? 0;
        $updated = $summary['updated'] ?? 0;
        $failed = $summary['failed'] ?? 0;
        $skipped = $summary['skipped'] ?? 0;
        $totalRows = $summary['total_rows'] ?? 0;

        $status = ($failed > 0 && $inserted + $updated === 0) ? 'failed' : 'completed';

        // Update DB record
        try {
            $db->update('erp_import_files', [
                'status' => $status,
                'total_rows' => $totalRows,
                'inserted' => $inserted,
                'updated' => $updated,
                'failed' => $failed,
                'skipped' => $skipped,
                'mappings_used' => json_encode($mappings),
                'import_options' => json_encode($options),
                'result_summary' => json_encode($summary),
                'error_message' => !empty($report['errors']) ? implode('; ', array_slice($report['errors'], 0, 5)) : null,
                'processed_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$fileId]);
        } catch (Exception $e) {
            // Silent
        }

        // Move file to processed/failed
        if (!is_dir($processedDir)) mkdir($processedDir, 0755, true);
        if (!is_dir($failedDir)) mkdir($failedDir, 0755, true);

        $destDir = $status === 'completed' ? $processedDir : $failedDir;
        rename($filePath, $destDir . $filename);

        // Notification
        if ($inserted + $updated > 0) {
            try {
                require_once BASE_PATH . '/services/NotificationTriggers.php';
                NotificationTriggers::onImportComplete($user['id'], [
                    'summary' => $summary,
                    'filename' => $filename,
                    'source' => 'manual_settings',
                    'company_id' => $companyId
                ]);
            } catch (Exception $e) {
                // Silent
            }
        }

        // Audit log
        Logger::audit('create', 'erp_import_file', [
            'user_id' => $user['id'],
            'company_id' => $companyId,
            'file_id' => $fileId,
            'filename' => $filename,
            'source' => 'manual_settings',
            'result' => $status,
            'summary' => $summary
        ]);

        Response::success([
            'file_id' => $fileId,
            'filename' => $filename,
            'status' => $status,
            'mapping_source' => $mappingSource,
            'summary' => [
                'total_rows' => $totalRows,
                'inserted' => $inserted,
                'updated' => $updated,
                'failed' => $failed,
                'skipped' => $skipped
            ],
            'errors' => array_slice($report['errors'] ?? [], 0, 10)
        ], $status === 'completed' ? 'Import başarılı' : 'Import kısmen başarısız');

    } catch (Exception $e) {
        // Update DB record as failed
        try {
            $db->update('erp_import_files', [
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'processed_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$fileId]);
        } catch (Exception $dbEx) {
            // Silent
        }

        // Move to failed
        if (!is_dir($failedDir)) mkdir($failedDir, 0755, true);
        @rename($filePath, $failedDir . $filename);

        Response::error('Import hatası: ' . $e->getMessage(), 422);
    }
}

// =========================================================
// DELETE: Delete file(s) from import directory
// =========================================================
if ($method === 'DELETE') {
    if (!in_array($user['role'], ['SuperAdmin', 'Admin', 'superadmin', 'admin'])) {
        Response::forbidden('Bu işlem için yetkiniz yok');
    }

    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    $filenames = $data['filenames'] ?? [];

    // Support single filename param too
    if (empty($filenames) && !empty($data['filename'])) {
        $filenames = [$data['filename']];
    }

    if (empty($filenames)) {
        Response::badRequest('Silinecek dosya adı gerekli');
    }

    $deleted = 0;
    $errors = [];

    $realImportDir = is_dir($importDir) ? realpath($importDir) : null;

    foreach ($filenames as $fname) {
        $fname = basename((string)$fname); // Path traversal koruması
        $filePath = $importDir . $fname;

        if (!file_exists($filePath) || !is_file($filePath)) {
            $errors[] = $fname . ': dosya bulunamadı';
            continue;
        }

        // Path traversal kontrolü
        $realPath = realpath($filePath);
        if (!$realPath || !$realImportDir || strpos($realPath, $realImportDir) !== 0) {
            $errors[] = $fname . ': geçersiz yol';
            continue;
        }

        if (@unlink($filePath)) {
            $deleted++;

            // DB kaydını da temizle
            try {
                $db->delete('erp_import_files', "company_id = ? AND filename = ? AND status = 'pending'", [$companyId, $fname]);
            } catch (Exception $e) {
                // Sessiz - dosya silindi, DB kaydı kalmış olabilir
            }

            Logger::audit('delete', 'erp_import_file', [
                'user_id' => $user['id'],
                'company_id' => $companyId,
                'filename' => $fname
            ]);
        } else {
            $errors[] = $fname . ': silinemedi';
        }
    }

    $total = count($filenames);
    $message = $deleted . '/' . $total . ' dosya silindi';

    Response::success([
        'deleted' => $deleted,
        'total' => $total,
        'errors' => $errors
    ], $message);
}
