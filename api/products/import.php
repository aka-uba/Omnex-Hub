<?php
/**
 * Product Import API
 *
 * Imports products from uploaded file with custom field mappings
 * Returns detailed import report
 */

require_once BASE_PATH . '/services/RenderCacheService.php';
require_once BASE_PATH . '/services/ProductImportHelper.php';

$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

// Check for file upload or JSON payload
$content = null;
$filename = null;
$customMappings = [];
$options = [];

// File upload
if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
    $allowedExtensions = ['txt', 'csv', 'json', 'xml', 'xlsx', 'xls'];
    $extension = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));

    if (!in_array($extension, $allowedExtensions)) {
        Response::validationError(['file' => ['Desteklenmeyen dosya formatı']]);
    }

    if ($_FILES['file']['size'] > 10 * 1024 * 1024) {
        Response::validationError(['file' => ['Dosya boyutu 10MB\'ı aşamaz']]);
    }

    $content = file_get_contents($_FILES['file']['tmp_name']);
    $filename = $_FILES['file']['name'];

    // Get custom mappings from POST (support both 'mappings' and 'mapping')
    if (isset($_POST['mappings'])) {
        $customMappings = json_decode($_POST['mappings'], true) ?? [];
    }

    // Get manual mappings from frontend UI
    if (isset($_POST['manual_mappings'])) {
        $manualMappings = json_decode($_POST['manual_mappings'], true);
        if (!empty($manualMappings)) {
            $customMappings = $manualMappings;
        }
    }

    // Get options from POST
    if (isset($_POST['options'])) {
        $options = json_decode($_POST['options'], true) ?? [];
    }

} elseif ($request->input('content')) {
    // JSON payload
    $content = $request->input('content');
    $filename = $request->input('filename');
    $customMappings = $request->input('mappings', []);
    $options = $request->input('options', []);

} elseif ($request->input('products')) {
    // Direct product array (from frontend mapping)
    $products = $request->input('products', []);
    $updateExisting = $request->input('update_existing', true);
    $skipErrors = $request->input('skip_errors', true);

    if (empty($products)) {
        Response::validationError(['products' => ['Ürün listesi boş']]);
    }

    // Direct import from mapped data
    $result = importDirectProducts($products, $companyId, $user['id'], $updateExisting, $skipErrors);
    Response::success($result, 'İçe aktarma tamamlandı');
    return;

} else {
    Response::validationError(['file' => ['Dosya veya içerik gerekli']]);
}

try {
    // Load dependencies
    require_once PARSERS_PATH . '/BaseParser.php';
    require_once PARSERS_PATH . '/JsonParser.php';
    require_once PARSERS_PATH . '/TxtParser.php';
    require_once PARSERS_PATH . '/CsvParser.php';
    require_once PARSERS_PATH . '/XmlParser.php';
    require_once PARSERS_PATH . '/XlsxParser.php';
    require_once PARSERS_PATH . '/ParserFactory.php';
    require_once SERVICES_PATH . '/SmartFieldMapper.php';

    $db = Database::getInstance();
    $startTime = microtime(true);

    // Parse file
    $parser = OmnexParserFactory::autoDetect($content, $filename);
    $format = $parser->getType();
    $rawData = $parser->parse($content);

    if (empty($rawData)) {
        Response::error('Dosyada veri bulunamadı', 400);
    }

    // Get headers
    $headers = array_keys($rawData[0]);

    // Determine field mappings
    if (empty($customMappings)) {
        // Auto-detect mappings
        $customMappings = SmartFieldMapper::detectMappings($headers, array_slice($rawData, 0, 10));

        // Debug log for auto-mapping
        Logger::info('Auto-mapping detected', [
            'source_headers' => $headers,
            'detected_mappings' => $customMappings,
            'required_fields_mapped' => [
                'sku' => $customMappings['sku'] ?? 'NOT FOUND',
                'name' => $customMappings['name'] ?? 'NOT FOUND',
                'current_price' => $customMappings['current_price'] ?? 'NOT FOUND'
            ]
        ]);
    }

    // Import options
    $updateExisting = $options['update_existing'] ?? true;
    $skipErrors = $options['skip_errors'] ?? true;
    $createNew = $options['create_new'] ?? true;

    // Initialize report
    $report = [
        'success' => false,
        'file' => [
            'name' => $filename,
            'format' => $format,
            'size' => strlen($content)
        ],
        'summary' => [
            'total_rows' => count($rawData),
            'processed' => 0,
            'inserted' => 0,
            'updated' => 0,
            'skipped' => 0,
            'failed' => 0
        ],
        'mappings_used' => $customMappings,
        'errors' => [],
        'failed_rows' => [],
        'duration_ms' => 0
    ];

    // Track imported/updated product IDs for render cache
    $importedProductIds = [];

    // Process rows
    $db->beginTransaction();

    try {
        foreach ($rawData as $index => $row) {
            $rowNum = $index + 1;

            try {
                // Map fields
                $mapped = mapRowToProduct($row, $customMappings);

                // Debug first row mapping
                if ($rowNum <= 2) {
                    Logger::info("Row $rowNum mapping result", [
                        'raw_row_keys' => array_keys($row),
                        'raw_row_sample' => array_slice($row, 0, 5),
                        'mapped_result' => $mapped,
                        'sku_value' => $mapped['sku'] ?? 'EMPTY',
                        'name_value' => $mapped['name'] ?? 'EMPTY',
                        'price_value' => $mapped['current_price'] ?? 'EMPTY'
                    ]);
                }

                // Debug: Log before validation call
                if ($rowNum <= 3) {
                    Logger::debug("Row $rowNum BEFORE validation", [
                        'mapped_keys' => array_keys($mapped),
                        'has_sku' => isset($mapped['sku']),
                        'has_name' => isset($mapped['name']),
                        'has_price' => isset($mapped['current_price'])
                    ]);
                }

                // Validate required fields
                $validationErrors = validateProduct($mapped);

                // Debug: Log validation for first few rows
                if ($rowNum <= 3) {
                    Logger::info("Row $rowNum validation", [
                        'sku' => $mapped['sku'] ?? 'MISSING',
                        'name' => $mapped['name'] ?? 'MISSING',
                        'current_price' => $mapped['current_price'] ?? 'MISSING',
                        'current_price_type' => gettype($mapped['current_price'] ?? null),
                        'validation_errors' => $validationErrors,
                        'validation_passed' => empty($validationErrors)
                    ]);
                }

                if (!empty($validationErrors)) {
                    if ($skipErrors) {
                        $report['failed_rows'][] = [
                            'row' => $rowNum,
                            'data' => array_slice($row, 0, 5), // First 5 fields for context
                            'errors' => $validationErrors
                        ];
                        $report['summary']['failed']++;
                        continue;
                    } else {
                        throw new Exception(implode(', ', $validationErrors));
                    }
                }

                // Check for existing product
                $existing = null;
                if (!empty($mapped['sku'])) {
                    $existing = $db->fetch(
                        "SELECT id, current_price FROM products WHERE company_id = ? AND sku = ?",
                        [$companyId, $mapped['sku']]
                    );
                }

                if ($existing) {
                    if (!$updateExisting) {
                        $report['summary']['skipped']++;
                        continue;
                    }

                    // Update existing
                    $updateData = prepareUpdateData($mapped);

                    // Debug: Log database operation for first few rows
                    if ($rowNum <= 3) {
                        Logger::info("Row $rowNum DB update", [
                            'product_id' => $existing['id'],
                            'update_fields' => array_keys($updateData),
                            'sku' => $mapped['sku']
                        ]);
                        Logger::debug("Row $rowNum BEFORE db->update()", [
                            'table' => 'products',
                            'update_data_count' => count($updateData),
                            'product_id' => $existing['id']
                        ]);
                    }

                    $updateResult = $db->update('products', $updateData, 'id = ?', [$existing['id']]);

                    if ($rowNum <= 3) {
                        Logger::debug("Row $rowNum AFTER db->update()", [
                            'update_result' => $updateResult,
                            'product_id' => $existing['id']
                        ]);
                    }

                    // Increment version for cache invalidation
                    $db->query(
                        "UPDATE products SET version = COALESCE(version, 0) + 1 WHERE id = ?",
                        [$existing['id']]
                    );

                    if ($rowNum <= 3) {
                        Logger::debug("Row $rowNum version update done");
                    }

                    // Track for render cache
                    $importedProductIds[] = $existing['id'];

                    // Log price change
                    if (isset($mapped['current_price']) &&
                        floatval($existing['current_price']) !== floatval($mapped['current_price'])) {
                        $db->insert('price_history', [
                            'id' => $db->generateUuid(),
                            'product_id' => $existing['id'],
                            'old_price' => $existing['current_price'],
                            'new_price' => $mapped['current_price'],
                            'changed_at' => date('Y-m-d H:i:s'),
                            'source' => 'import'
                        ]);
                    }

                    $report['summary']['updated']++;

                } else {
                    if (!$createNew) {
                        $report['summary']['skipped']++;
                        continue;
                    }

                    // Insert new
                    $insertData = prepareInsertData($mapped, $companyId);
                    $insertData['version'] = 1;
                    $insertData['render_status'] = 'pending';
                    $db->insert('products', $insertData);

                    // Track for render cache
                    $importedProductIds[] = $insertData['id'];

                    $report['summary']['inserted']++;
                }

                $report['summary']['processed']++;

                if ($rowNum <= 3) {
                    Logger::debug("Row $rowNum PROCESSED successfully", [
                        'processed_count' => $report['summary']['processed'],
                        'updated_count' => $report['summary']['updated'],
                        'inserted_count' => $report['summary']['inserted']
                    ]);
                }

            } catch (Exception $e) {
                Logger::error("Row $rowNum EXCEPTION caught", [
                    'error' => $e->getMessage(),
                    'error_type' => get_class($e),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                    'trace' => $e->getTraceAsString()
                ]);
                if ($skipErrors) {
                    $report['failed_rows'][] = [
                        'row' => $rowNum,
                        'data' => array_slice($row, 0, 5),
                        'errors' => [$e->getMessage()]
                    ];
                    $report['summary']['failed']++;
                } else {
                    throw $e;
                }
            }
        }

        // Debug: Log loop completion
        Logger::info("Import loop completed", [
            'total_rows' => count($rawData),
            'processed' => $report['summary']['processed'],
            'inserted' => $report['summary']['inserted'],
            'updated' => $report['summary']['updated'],
            'failed' => $report['summary']['failed'],
            'skipped' => $report['summary']['skipped']
        ]);

        $db->commit();
        $report['success'] = true;

        // Trigger bulk render cache update for all imported/updated products
        if (!empty($importedProductIds)) {
            try {
                $cacheService = new RenderCacheService();
                $renderResult = $cacheService->onBulkProductsUpdated(
                    $importedProductIds,
                    $companyId,
                    'import',
                    [
                        'user_id' => $user['id'],
                        'filename' => $filename,
                        'priority' => 'normal'
                    ]
                );
                $report['render_jobs_created'] = $renderResult['jobs_created'] ?? 0;
                $report['render_batch_id'] = $renderResult['batch_id'] ?? null;

                // Send notification about render jobs created
                if ($report['render_jobs_created'] > 0) {
                    require_once BASE_PATH . '/services/NotificationTriggers.php';
                    NotificationTriggers::onRenderJobsComplete(
                        $user['id'],
                        'import',
                        $report['render_jobs_created'],
                        count($importedProductIds)
                    );
                }
            } catch (Exception $e) {
                // Log error but don't fail the import
                Logger::warning('Render cache trigger failed after import', [
                    'product_count' => count($importedProductIds),
                    'error' => $e->getMessage()
                ]);
            }
        }

    } catch (Exception $e) {
        $db->rollBack();
        $report['errors'][] = $e->getMessage();
        throw $e;
    }

    // Calculate duration
    $report['duration_ms'] = (int) ((microtime(true) - $startTime) * 1000);

    // Log import
    logImport($db, $companyId, $user['id'], $report, $filename);

    // Send notification about import completion
    try {
        require_once __DIR__ . '/../../services/NotificationTriggers.php';
        NotificationTriggers::onImportComplete($user['id'], $report);
    } catch (Exception $notifyError) {
        // Notification failure should not break import response
        Logger::warning('Failed to send import notification', [
            'error' => $notifyError->getMessage()
        ]);
    }

    Response::success($report, 'İçe aktarma tamamlandı');

} catch (Exception $e) {
    Logger::error('Import failed', [
        'error' => $e->getMessage(),
        'file' => $filename
    ]);
    Response::error('İçe aktarma başarısız: ' . $e->getMessage(), 400);
}

/**
 * Map raw row to product fields using custom mappings
 */
// =========================================================
// HELPER FUNCTIONS (delegated to ProductImportHelper.php)
// These wrappers maintain backward compatibility for
// code that calls the old function names directly.
// =========================================================

// mapRowToProduct is now defined in ProductImportHelper.php (same name, shared)
// No wrapper needed - it's already loaded via require_once above.

/**
 * Parse number - delegates to helper
 */
function parseNumber($value): float
{
    return parseImportNumber($value);
}

/**
 * Parse date - delegates to helper
 */
function parseDate($value): ?string
{
    return parseImportDate($value);
}

/**
 * Parse boolean - delegates to helper
 */
function parseBoolean($value): bool
{
    return parseImportBoolean($value);
}

/**
 * Validate product - delegates to helper
 */
function validateProduct(array $product): array
{
    return validateImportProduct($product);
}

/**
 * Prepare update data - delegates to helper
 */
function prepareUpdateData(array $mapped): array
{
    return prepareImportUpdateData($mapped);
}

/**
 * Prepare insert data - delegates to helper
 */
function prepareInsertData(array $mapped, string $companyId): array
{
    return prepareImportInsertData($mapped, $companyId);
}

/**
 * Import products directly from mapped array
 */
function importDirectProducts(array $products, string $companyId, string $userId, bool $updateExisting, bool $skipErrors): array
{
    $db = Database::getInstance();
    $startTime = microtime(true);

    $report = [
        'success' => false,
        'summary' => [
            'total_rows' => count($products),
            'processed' => 0,
            'inserted' => 0,
            'updated' => 0,
            'skipped' => 0,
            'failed' => 0
        ],
        'errors' => [],
        'failed_rows' => []
    ];

    // Track imported/updated product IDs for render cache
    $importedProductIds = [];

    $db->beginTransaction();

    try {
        foreach ($products as $index => $mapped) {
            $rowNum = $index + 1;

            try {
                $validationErrors = validateProduct($mapped);

                if (!empty($validationErrors)) {
                    if ($skipErrors) {
                        $report['failed_rows'][] = [
                            'row' => $rowNum,
                            'sku' => $mapped['sku'] ?? 'N/A',
                            'name' => $mapped['name'] ?? 'N/A',
                            'errors' => $validationErrors
                        ];
                        $report['summary']['failed']++;
                        continue;
                    } else {
                        throw new Exception(implode(', ', $validationErrors));
                    }
                }

                $existing = null;
                if (!empty($mapped['sku'])) {
                    $existing = $db->fetch(
                        "SELECT id, current_price FROM products WHERE company_id = ? AND sku = ?",
                        [$companyId, $mapped['sku']]
                    );
                }

                if ($existing) {
                    if (!$updateExisting) {
                        $report['summary']['skipped']++;
                        continue;
                    }

                    $updateData = prepareUpdateData($mapped);
                    $db->update('products', $updateData, 'id = ?', [$existing['id']]);

                    // Increment version for cache invalidation
                    $db->query(
                        "UPDATE products SET version = COALESCE(version, 0) + 1 WHERE id = ?",
                        [$existing['id']]
                    );

                    // Track for render cache
                    $importedProductIds[] = $existing['id'];

                    if (isset($mapped['current_price']) &&
                        floatval($existing['current_price']) !== floatval($mapped['current_price'])) {
                        $db->insert('price_history', [
                            'id' => $db->generateUuid(),
                            'product_id' => $existing['id'],
                            'old_price' => $existing['current_price'],
                            'new_price' => $mapped['current_price'],
                            'changed_at' => date('Y-m-d H:i:s'),
                            'source' => 'import'
                        ]);
                    }

                    $report['summary']['updated']++;
                } else {
                    $insertData = prepareInsertData($mapped, $companyId);
                    $insertData['version'] = 1;
                    $insertData['render_status'] = 'pending';
                    $db->insert('products', $insertData);

                    // Track for render cache
                    $importedProductIds[] = $insertData['id'];

                    $report['summary']['inserted']++;
                }

                $report['summary']['processed']++;

            } catch (Exception $e) {
                if ($skipErrors) {
                    $report['failed_rows'][] = [
                        'row' => $rowNum,
                        'sku' => $mapped['sku'] ?? 'N/A',
                        'name' => $mapped['name'] ?? 'N/A',
                        'errors' => [$e->getMessage()]
                    ];
                    $report['summary']['failed']++;
                } else {
                    throw $e;
                }
            }
        }

        $db->commit();
        $report['success'] = true;

        // Trigger bulk render cache update for all imported/updated products
        if (!empty($importedProductIds)) {
            try {
                $cacheService = new RenderCacheService();
                $renderResult = $cacheService->onBulkProductsUpdated(
                    $importedProductIds,
                    $companyId,
                    'import',
                    [
                        'user_id' => $userId,
                        'priority' => 'normal'
                    ]
                );
                $report['render_jobs_created'] = $renderResult['jobs_created'] ?? 0;
                $report['render_batch_id'] = $renderResult['batch_id'] ?? null;

                // Send notification about render jobs created
                if ($report['render_jobs_created'] > 0) {
                    require_once BASE_PATH . '/services/NotificationTriggers.php';
                    NotificationTriggers::onRenderJobsComplete(
                        $userId,
                        'import',
                        $report['render_jobs_created'],
                        count($importedProductIds)
                    );
                }
            } catch (Exception $e) {
                // Log error but don't fail the import
                Logger::warning('Render cache trigger failed after direct import', [
                    'product_count' => count($importedProductIds),
                    'error' => $e->getMessage()
                ]);
            }
        }

    } catch (Exception $e) {
        $db->rollBack();
        $report['errors'][] = $e->getMessage();
    }

    $report['duration_ms'] = (int) ((microtime(true) - $startTime) * 1000);

    // Log import
    logImport($db, $companyId, $userId, $report, 'direct_import');

    return $report;
}

/**
 * Log import operation - delegates to helper
 */
function logImport($db, string $companyId, string $userId, array $report, ?string $filename): void
{
    logImportOperation($db, $companyId, $userId, $report, $filename);
}
