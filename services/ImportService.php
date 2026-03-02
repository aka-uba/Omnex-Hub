<?php
/**
 * ImportService - Data Import Handler
 *
 * @package OmnexDisplayHub
 */

class ImportService
{
    private Database $db;
    private string $companyId;
    private array $errors = [];
    private array $warnings = [];

    public function __construct(?string $companyId)
    {
        $this->db = Database::getInstance();

        if (empty($companyId)) {
            throw new Exception('Company ID is required. Please select a company.');
        }

        $this->companyId = $companyId;
    }

    /**
     * Import data from content
     */
    public function import(
        string $content,
        ?string $mappingName = 'default',
        ?string $filename = null,
        ?string $userId = null
    ): array {
        $result = [
            'success' => false,
            'total_rows' => 0,
            'valid_rows' => 0,
            'invalid_rows' => 0,
            'inserted' => 0,
            'updated' => 0,
            'skipped' => 0,
            'errors' => [],
            'warnings' => []
        ];

        $startTime = microtime(true);

        try {
            // 1. Load mapping config
            $mapping = $this->loadMapping($mappingName);

            // 2. Auto-detect parser and parse content
            $parser = OmnexParserFactory::autoDetect($content, $filename);

            // Configure parser with mapping options
            $parserType = $parser->getType();
            if (isset($mapping['options'][$parserType])) {
                $parser->configure($mapping['options'][$parserType]);
            }

            // 3. Parse content
            $rawData = $parser->parse($content);
            $result['total_rows'] = count($rawData);

            if (empty($rawData)) {
                $result['errors'][] = ['code' => 'empty_data'];
                return $result;
            }

            // 4. Apply field mapping
            $parser->setFieldMapping($mapping['fieldMapping']);
            $mappedData = $parser->mapFields($rawData);

            // 5. Validate data
            $validator = new DataValidator($mapping['validation'] ?? []);
            [$validData, $invalidData] = $validator->validate($mappedData);

            $result['valid_rows'] = count($validData);
            $result['invalid_rows'] = count($invalidData);
            $result['errors'] = array_merge($result['errors'], $validator->getErrors());
            $result['warnings'] = array_merge($result['warnings'], $validator->getWarnings());

            // 6. Import valid data
            if (!empty($validData)) {
                $this->db->beginTransaction();

                try {
                    $importOptions = $mapping['importOptions'] ?? [];
                    $batchSize = $importOptions['batchSize'] ?? 100;

                    foreach (array_chunk($validData, $batchSize) as $batch) {
                        foreach ($batch as $row) {
                            $importResult = $this->importRow($row, $importOptions);

                            switch ($importResult) {
                                case 'inserted':
                                    $result['inserted']++;
                                    break;
                                case 'updated':
                                    $result['updated']++;
                                    break;
                                case 'skipped':
                                    $result['skipped']++;
                                    break;
                            }
                        }
                    }

                    $this->db->commit();
                    $result['success'] = true;

                } catch (Exception $e) {
                    $this->db->rollBack();
                    throw $e;
                }
            }

            // 7. Log import
            $duration = (int)((microtime(true) - $startTime) * 1000);
            $this->logImport($result, $mappingName, $filename, $userId, $duration);

        } catch (Exception $e) {
            $result['success'] = false;
            $result['errors'][] = $e->getMessage();
            Logger::error('Import failed', [
                'company_id' => $this->companyId,
                'error' => $e->getMessage()
            ]);
        }

        return $result;
    }

    /**
     * Preview import without saving
     */
    public function preview(
        string $content,
        ?string $mappingName = 'default',
        ?string $filename = null,
        int $limit = 10
    ): array {
        $result = [
            'success' => false,
            'detected_format' => null,
            'total_rows' => 0,
            'detected_fields' => [],
            'detected_mappings' => [],
            'sample_data' => [],
            'mapped_data' => [],
            'validation_errors' => [],
            'field_stats' => []
        ];

        try {
            // Load mapping
            $mapping = $this->loadMapping($mappingName);

            // Auto-detect and parse
            $parser = OmnexParserFactory::autoDetect($content, $filename);
            $result['detected_format'] = $parser->getType();

            // Configure parser
            $parserType = $parser->getType();
            if (isset($mapping['options'][$parserType])) {
                $parser->configure($mapping['options'][$parserType]);
            }

            // Parse
            $rawData = $parser->parse($content);
            $result['total_rows'] = (int) count($rawData);

            // Extract detected fields (source headers)
            if (!empty($rawData)) {
                $result['detected_fields'] = array_keys($rawData[0]);

                // Auto-detect mappings using SmartFieldMapper
                require_once SERVICES_PATH . '/SmartFieldMapper.php';
                $result['detected_mappings'] = SmartFieldMapper::detectMappings(
                    $result['detected_fields'],
                    array_slice($rawData, 0, 10)
                );
            }

            // Sample raw data
            $result['sample_data'] = array_slice($rawData, 0, $limit);

            // Apply mapping
            $parser->setFieldMapping($mapping['fieldMapping']);
            $mappedData = $parser->mapFields($rawData);

            // Sample mapped data
            $result['mapped_data'] = array_slice($mappedData, 0, $limit);

            // Validate sample
            $validator = new DataValidator($mapping['validation'] ?? []);
            [$valid, $invalid] = $validator->validate(array_slice($mappedData, 0, 100));

            $result['validation_errors'] = $validator->getErrors();

            // Field stats
            $result['field_stats'] = $this->calculateFieldStats($mappedData, $mapping['fieldMapping']);

            $result['success'] = true;

        } catch (Throwable $e) {
            $result['success'] = false;
            $result['errors'] = [$e->getMessage()];
        }

        return $result;
    }

    /**
     * Import single row
     */
    private function importRow(array $row, array $options): string
    {
        $mode = $options['mode'] ?? 'upsert';
        $updateExisting = $options['updateExisting'] ?? true;
        $createNew = $options['createNew'] ?? true;

        // Check if product exists
        $existing = null;
        if (!empty($row['sku'])) {
            $existing = $this->db->fetch(
                "SELECT id, current_price FROM products WHERE company_id = ? AND sku = ?",
                [$this->companyId, $row['sku']]
            );
        }

        if ($existing) {
            if (!$updateExisting) {
                return 'skipped';
            }

            // Check if price changed for history
            $priceChanged = isset($row['current_price']) &&
                            floatval($existing['current_price']) !== floatval($row['current_price']);

            // Update product
            $updateData = $this->prepareUpdateData($row);
            $this->db->update('products', $updateData, 'id = ?', [$existing['id']]);

            // Log price change
            if ($priceChanged) {
                $this->db->insert('price_history', [
                    'id' => $this->db->generateUuid(),
                    'product_id' => $existing['id'],
                    'old_price' => $existing['current_price'],
                    'new_price' => $row['current_price'],
                    'changed_at' => date('Y-m-d H:i:s'),
                    'source' => 'import'
                ]);
            }

            return 'updated';

        } else {
            if (!$createNew) {
                return 'skipped';
            }

            // Insert new product
            $insertData = $this->prepareInsertData($row);
            $this->db->insert('products', $insertData);

            return 'inserted';
        }
    }

    /**
     * Prepare data for update
     */
    private function prepareUpdateData(array $row): array
    {
        $data = ['updated_at' => date('Y-m-d H:i:s')];

        $fields = [
            'barcode', 'name', 'current_price', 'previous_price', 'campaign_price', 'unit',
            'category', 'subcategory', 'brand', 'origin', 'description',
            'image_url', 'stock', 'vat_rate', 'discount_percent',
            'campaign_text', 'weight', 'kunye_no', 'shelf_location',
            'supplier_code', 'valid_from', 'valid_until', 'production_type',
            'price_updated_at', 'previous_price_updated_at',
            'group', 'images', 'videos', 'video_url', 'storage_info'
        ];

        foreach ($fields as $field) {
            if (isset($row[$field]) && $row[$field] !== null) {
                $data[$field] = $row[$field];
            }
        }

        // Handle boolean fields
        if (isset($row['is_active'])) {
            $data['status'] = $row['is_active'] ? 'active' : 'inactive';
        }

        if (isset($row['is_featured'])) {
            $data['is_featured'] = $row['is_featured'] ? 1 : 0;
        }

        // Ensure stock is integer
        if (isset($data['stock'])) {
            $data['stock'] = (int) floor((float) $data['stock']);
        }

        return $data;
    }

    /**
     * Prepare data for insert
     */
    private function prepareInsertData(array $row): array
    {
        $data = [
            'id' => $this->db->generateUuid(),
            'company_id' => $this->companyId,
            'sku' => $row['sku'],
            'status' => isset($row['is_active']) && !$row['is_active'] ? 'inactive' : 'active',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ];

        $fields = [
            'barcode', 'name', 'current_price', 'previous_price', 'campaign_price', 'unit',
            'category', 'subcategory', 'brand', 'origin', 'description',
            'image_url', 'stock', 'vat_rate', 'discount_percent',
            'campaign_text', 'weight', 'kunye_no', 'shelf_location',
            'supplier_code', 'valid_from', 'valid_until', 'production_type',
            'price_updated_at', 'previous_price_updated_at',
            'group', 'images', 'videos', 'video_url', 'storage_info'
        ];

        foreach ($fields as $field) {
            if (isset($row[$field]) && $row[$field] !== null) {
                $data[$field] = $row[$field];
            }
        }

        // Defaults and type coercion
        $data['unit'] = $data['unit'] ?? 'adet';
        $data['vat_rate'] = $data['vat_rate'] ?? 20;
        $data['stock'] = isset($data['stock']) ? (int) floor((float) $data['stock']) : 0;
        $data['is_featured'] = isset($row['is_featured']) && $row['is_featured'] ? 1 : 0;

        return $data;
    }

    /**
     * Load mapping configuration
     */
    private function loadMapping(string $name): array
    {
        // Try company-specific mapping from database
        $dbMapping = $this->db->fetch(
            "SELECT config FROM import_mappings WHERE company_id = ? AND name = ?",
            [$this->companyId, $name]
        );

        if ($dbMapping) {
            return json_decode($dbMapping['config'], true);
        }

        // Try file-based mapping
        $customPath = MAPPINGS_PATH . "/custom/{$this->companyId}/{$name}.json";
        if (file_exists($customPath)) {
            return json_decode(file_get_contents($customPath), true);
        }

        // Default mapping
        $defaultPath = MAPPINGS_PATH . "/{$name}.json";
        if (file_exists($defaultPath)) {
            return json_decode(file_get_contents($defaultPath), true);
        }

        throw new Exception("Mapping configuration not found: $name");
    }

    /**
     * Calculate field statistics
     */
    private function calculateFieldStats(array $data, array $fieldMapping): array
    {
        $stats = [];

        foreach ($fieldMapping as $targetField => $config) {
            $filled = 0;
            $empty = 0;
            $unique = [];

            foreach ($data as $row) {
                $value = $row[$targetField] ?? null;
                if ($value !== null && $value !== '') {
                    $filled++;
                    // Convert value to string to use as array key (avoid float to int conversion)
                    $unique[(string) $value] = true;
                } else {
                    $empty++;
                }
            }

            $stats[$targetField] = [
                'filled' => (int) $filled,
                'empty' => (int) $empty,
                'unique' => count($unique),
                'fill_rate' => count($data) > 0 ? (float) round(($filled / count($data)) * 100, 1) : 0.0
            ];
        }

        return $stats;
    }

    /**
     * Log import operation
     */
    private function logImport(
        array $result,
        string $mappingName,
        ?string $filename,
        ?string $userId,
        int $durationMs
    ): void {
        $mappingRecord = $this->db->fetch(
            "SELECT id FROM import_mappings WHERE company_id = ? AND name = ?",
            [$this->companyId, $mappingName]
        );

        $this->db->insert('import_logs', [
            'id' => $this->db->generateUuid(),
            'company_id' => $this->companyId,
            'mapping_id' => $mappingRecord['id'] ?? null,
            'filename' => $filename,
            'total_rows' => (int) $result['total_rows'],
            'valid_rows' => (int) $result['valid_rows'],
            'inserted' => (int) $result['inserted'],
            'updated' => (int) $result['updated'],
            'skipped' => (int) $result['skipped'],
            'errors' => !empty($result['errors']) ? json_encode($result['errors']) : null,
            'duration_ms' => (int) $durationMs,
            'status' => $result['success'] ? 'completed' : 'failed',
            'created_by' => $userId,
            'created_at' => date('Y-m-d H:i:s')
        ]);

        // Update mapping usage stats
        if ($mappingRecord) {
            $this->db->query(
                "UPDATE import_mappings SET last_used = ?, use_count = use_count + 1 WHERE id = ?",
                [date('Y-m-d H:i:s'), $mappingRecord['id']]
            );
        }
    }

    /**
     * Get errors
     */
    public function getErrors(): array
    {
        return $this->errors;
    }

    /**
     * Get warnings
     */
    public function getWarnings(): array
    {
        return $this->warnings;
    }
}

/**
 * DataValidator - Validate imported data
 */
class DataValidator
{
    private array $rules;
    private array $errors = [];
    private array $warnings = [];

    public function __construct(array $rules = [])
    {
        $this->rules = $rules;
    }

    /**
     * Validate data array
     */
    public function validate(array $data): array
    {
        $valid = [];
        $invalid = [];

        foreach ($data as $index => $row) {
            $rowErrors = $this->validateRow($row, (int) $index);

            if (empty($rowErrors)) {
                $valid[] = $row;
            } else {
                $invalid[] = ['row' => (int) $index + 1, 'data' => $row, 'errors' => $rowErrors];
                $this->errors = array_merge($this->errors, $rowErrors);
            }
        }

        return [$valid, $invalid];
    }

    /**
     * Validate single row
     */
    private function validateRow(array $row, int $index): array
    {
        $errors = [];
        $rowNum = $index + 1;

        foreach ($this->rules as $field => $rules) {
            $value = $row[$field] ?? null;

            // Pattern validation
            if (isset($rules['pattern']) && $value !== null && $value !== '') {
                if (!preg_match('/' . $rules['pattern'] . '/', $value)) {
                    $errors[] = ['code' => 'invalid_format', 'row' => $rowNum, 'field' => $field];
                }
            }

            // Min value
            if (isset($rules['min']) && is_numeric($value)) {
                if ($value < $rules['min']) {
                    $errors[] = ['code' => 'min_value', 'row' => $rowNum, 'field' => $field, 'min' => $rules['min']];
                }
            }

            // Max value
            if (isset($rules['max']) && is_numeric($value)) {
                if ($value > $rules['max']) {
                    $errors[] = ['code' => 'max_value', 'row' => $rowNum, 'field' => $field, 'max' => $rules['max']];
                }
            }
        }

        return $errors;
    }

    /**
     * Get validation errors
     */
    public function getErrors(): array
    {
        return $this->errors;
    }

    /**
     * Get validation warnings
     */
    public function getWarnings(): array
    {
        return $this->warnings;
    }
}
