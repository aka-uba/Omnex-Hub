<?php
/**
 * ProductImportHelper - Shared import functions
 *
 * Extracted from api/products/import.php for reuse by:
 * - Manual import (api/products/import.php)
 * - Auto-import cron (cron/auto-import.php)
 * - ERP file push processing
 *
 * @package OmnexDisplayHub
 */

/**
 * Map a raw data row to product fields using custom mappings
 */
function mapRowToProduct(array $row, array $mappings): array
{
    $product = [];

    foreach ($mappings as $targetField => $sourceField) {
        if (!empty($sourceField) && isset($row[$sourceField])) {
            $value = $row[$sourceField];

            switch ($targetField) {
                case 'current_price':
                case 'previous_price':
                case 'campaign_price':
                case 'weight':
                    $product[$targetField] = parseImportNumber($value);
                    break;

                case 'stock':
                    $product[$targetField] = (int) parseImportNumber($value);
                    break;

                case 'vat_rate':
                case 'discount_percent':
                    $product[$targetField] = parseImportNumber($value);
                    break;

                case 'price_updated_at':
                case 'previous_price_updated_at':
                case 'valid_from':
                case 'valid_until':
                    $product[$targetField] = parseImportDate($value);
                    break;

                case 'is_active':
                case 'is_featured':
                    $product[$targetField] = parseImportBoolean($value) ? 1 : 0;
                    break;

                case 'campaign_text':
                    $lowerVal = mb_strtolower(trim($value));
                    if (in_array($lowerVal, ['evet', 'yes', '1', 'true', 'var'])) {
                        $product[$targetField] = 'Evet';
                    } elseif (in_array($lowerVal, ['hayır', 'hayir', 'no', '0', 'false', 'yok'])) {
                        $product[$targetField] = 'Hayır';
                    } else {
                        $product[$targetField] = trim((string) $value);
                    }
                    break;

                default:
                    $product[$targetField] = trim((string) $value);
            }
        }
    }

    return $product;
}

/**
 * Parse number from various formats (Turkish, US, simple)
 */
function parseImportNumber($value): float
{
    if (is_numeric($value)) {
        return (float) $value;
    }

    $value = (string) $value;
    $value = preg_replace('/[^\d.,-]/', '', $value);

    // Turkish format: 1.234,56
    if (preg_match('/^\d{1,3}(\.\d{3})*(,\d+)?$/', $value)) {
        $value = str_replace('.', '', $value);
        $value = str_replace(',', '.', $value);
    }
    // Standard format: 1,234.56
    elseif (preg_match('/^\d{1,3}(,\d{3})*(\.\d+)?$/', $value)) {
        $value = str_replace(',', '', $value);
    }
    // Simple comma decimal: 1234,56
    elseif (strpos($value, ',') !== false && strpos($value, '.') === false) {
        $value = str_replace(',', '.', $value);
    }

    return (float) $value;
}

/**
 * Parse date from various formats
 */
function parseImportDate($value): ?string
{
    if (empty($value)) {
        return null;
    }

    if (preg_match('/^\d{4}-\d{2}-\d{2}/', $value)) {
        return substr($value, 0, 10);
    }

    $formats = ['d.m.Y', 'd/m/Y', 'm/d/Y', 'Y/m/d', 'd-m-Y', 'Ymd'];

    foreach ($formats as $format) {
        $date = DateTime::createFromFormat($format, $value);
        if ($date) {
            return $date->format('Y-m-d');
        }
    }

    $timestamp = strtotime($value);
    return $timestamp ? date('Y-m-d', $timestamp) : null;
}

/**
 * Parse boolean from various formats
 */
function parseImportBoolean($value): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return (int) $value !== 0;
    }

    $value = mb_strtolower(trim((string) $value));
    return in_array($value, ['true', 'yes', 'evet', '1', 'aktif', 'var', 'on']);
}

/**
 * Validate product data - returns array of error strings
 */
function validateImportProduct(array $product): array
{
    $errors = [];

    if (empty($product['sku'])) {
        $errors[] = 'SKU/Stok kodu zorunlu';
    }

    if (empty($product['name'])) {
        $errors[] = 'Ürün adı zorunlu';
    }

    if (!isset($product['current_price']) || $product['current_price'] === '') {
        $errors[] = 'Fiyat zorunlu';
    } elseif ($product['current_price'] < 0) {
        $errors[] = 'Fiyat negatif olamaz';
    }

    return $errors;
}

/**
 * Prepare data for product update
 */
function prepareImportUpdateData(array $mapped): array
{
    $data = ['updated_at' => date('Y-m-d H:i:s')];

    $fields = [
        'barcode', 'name', 'current_price', 'previous_price', 'campaign_price', 'unit',
        'category', 'subcategory', 'brand', 'origin', 'description',
        'image_url', 'stock', 'vat_rate', 'discount_percent',
        'campaign_text', 'weight', 'kunye_no', 'shelf_location',
        'supplier_code', 'valid_from', 'valid_until',
        'price_updated_at', 'previous_price_updated_at', 'is_featured',
        'group', 'images', 'videos', 'video_url', 'storage_info'
    ];

    foreach ($fields as $field) {
        if (isset($mapped[$field]) && $mapped[$field] !== null && $mapped[$field] !== '') {
            $data[$field] = $mapped[$field];
        }
    }

    if (isset($mapped['is_active'])) {
        $data['status'] = $mapped['is_active'] ? 'active' : 'inactive';
    }

    return $data;
}

/**
 * Prepare data for product insert
 */
function prepareImportInsertData(array $mapped, string $companyId): array
{
    $db = Database::getInstance();
    $data = [
        'id' => $db->generateUuid(),
        'company_id' => $companyId,
        'sku' => $mapped['sku'],
        'status' => 'active',
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s')
    ];

    $fields = [
        'barcode', 'name', 'current_price', 'previous_price', 'campaign_price', 'unit',
        'category', 'subcategory', 'brand', 'origin', 'description',
        'image_url', 'stock', 'vat_rate', 'discount_percent',
        'campaign_text', 'weight', 'kunye_no', 'shelf_location',
        'supplier_code', 'valid_from', 'valid_until',
        'price_updated_at', 'previous_price_updated_at', 'is_featured',
        'group', 'images', 'videos', 'video_url', 'storage_info'
    ];

    foreach ($fields as $field) {
        if (isset($mapped[$field]) && $mapped[$field] !== null && $mapped[$field] !== '') {
            $data[$field] = $mapped[$field];
        }
    }

    if (isset($mapped['is_active'])) {
        $data['status'] = $mapped['is_active'] ? 'active' : 'inactive';
    }

    $data['unit'] = $data['unit'] ?? 'adet';
    $data['vat_rate'] = $data['vat_rate'] ?? 20;
    $data['stock'] = $data['stock'] ?? 0;

    return $data;
}

/**
 * Log import operation to import_logs table
 */
function logImportOperation($db, string $companyId, string $userId, array $report, ?string $filename): void
{
    try {
        $db->insert('import_logs', [
            'id' => $db->generateUuid(),
            'company_id' => $companyId,
            'filename' => $filename,
            'total_rows' => $report['summary']['total_rows'],
            'valid_rows' => $report['summary']['processed'],
            'inserted' => $report['summary']['inserted'],
            'updated' => $report['summary']['updated'],
            'skipped' => $report['summary']['skipped'],
            'errors' => !empty($report['failed_rows']) ? json_encode($report['failed_rows']) : null,
            'duration_ms' => $report['duration_ms'] ?? 0,
            'status' => $report['success'] ? 'completed' : 'failed',
            'created_by' => $userId,
            'created_at' => date('Y-m-d H:i:s')
        ]);
    } catch (Exception $e) {
        Logger::warning('Failed to log import', ['error' => $e->getMessage()]);
    }
}

/**
 * Run the full import pipeline on parsed data rows
 *
 * @param array $rawData Parsed rows from file
 * @param array $mappings Field mappings [targetField => sourceField]
 * @param string $companyId Company UUID
 * @param string $userId User UUID (or 'system' for cron)
 * @param array $options Import options (update_existing, create_new, skip_errors, trigger_render)
 * @return array Import report
 */
function runImportPipeline(array $rawData, array $mappings, string $companyId, string $userId, array $options = []): array
{
    $db = Database::getInstance();
    $startTime = microtime(true);

    $updateExisting = $options['update_existing'] ?? true;
    $createNew = $options['create_new'] ?? true;
    $skipErrors = $options['skip_errors'] ?? true;
    $triggerRender = $options['trigger_render'] ?? true;

    $report = [
        'success' => false,
        'summary' => [
            'total_rows' => count($rawData),
            'processed' => 0,
            'inserted' => 0,
            'updated' => 0,
            'skipped' => 0,
            'failed' => 0
        ],
        'errors' => [],
        'failed_rows' => []
    ];

    $importedProductIds = [];

    $db->beginTransaction();

    try {
        foreach ($rawData as $index => $row) {
            $rowNum = $index + 1;

            try {
                $mapped = mapRowToProduct($row, $mappings);
                $validationErrors = validateImportProduct($mapped);

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

                    $updateData = prepareImportUpdateData($mapped);
                    $db->update('products', $updateData, 'id = ?', [$existing['id']]);

                    $db->query(
                        "UPDATE products SET version = COALESCE(version, 0) + 1 WHERE id = ?",
                        [$existing['id']]
                    );

                    $importedProductIds[] = $existing['id'];

                    if (isset($mapped['current_price']) &&
                        floatval($existing['current_price']) !== floatval($mapped['current_price'])) {
                        try {
                            $db->insert('price_history', [
                                'id' => $db->generateUuid(),
                                'product_id' => $existing['id'],
                                'old_price' => $existing['current_price'],
                                'new_price' => $mapped['current_price'],
                                'changed_at' => date('Y-m-d H:i:s'),
                                'source' => 'import'
                            ]);
                        } catch (Exception $e) {
                            // Price history insert failure is non-critical
                        }
                    }

                    $report['summary']['updated']++;
                } else {
                    if (!$createNew) {
                        $report['summary']['skipped']++;
                        continue;
                    }

                    $insertData = prepareImportInsertData($mapped, $companyId);
                    $insertData['version'] = 1;
                    $insertData['render_status'] = 'pending';
                    $db->insert('products', $insertData);

                    $importedProductIds[] = $insertData['id'];
                    $report['summary']['inserted']++;
                }

                $report['summary']['processed']++;

            } catch (Exception $e) {
                if ($skipErrors) {
                    $report['failed_rows'][] = [
                        'row' => $rowNum,
                        'sku' => $row[$mappings['sku'] ?? ''] ?? 'N/A',
                        'name' => $row[$mappings['name'] ?? ''] ?? 'N/A',
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

        // Trigger render cache update
        if ($triggerRender && !empty($importedProductIds)) {
            try {
                require_once BASE_PATH . '/services/RenderCacheService.php';
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
            } catch (Exception $e) {
                Logger::warning('Render cache trigger failed after import', [
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

    return $report;
}
