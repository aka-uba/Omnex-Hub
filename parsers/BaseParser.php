<?php
/**
 * BaseParser - Abstract Parser Class
 *
 * @package OmnexDisplayHub
 */

abstract class OmnexBaseParser
{
    protected array $config = [];
    protected array $fieldMapping = [];
    protected array $errors = [];
    protected array $warnings = [];
    protected string $type;

    /**
     * Parse content and return array of data
     */
    abstract public function parse(string $content): array;

    /**
     * Check if parser supports the content
     */
    abstract public function supports(string $content): bool;

    /**
     * Get parser type
     */
    public function getType(): string
    {
        return $this->type;
    }

    /**
     * Configure parser options
     */
    public function configure(array $options): self
    {
        $this->config = array_merge($this->config, $options);
        return $this;
    }

    /**
     * Set field mapping
     */
    public function setFieldMapping(array $mapping): self
    {
        $this->fieldMapping = $mapping;
        return $this;
    }

    /**
     * Map raw data fields to target fields
     */
    public function mapFields(array $rawData): array
    {
        if (empty($this->fieldMapping)) {
            return $rawData;
        }

        $mapped = [];
        $rowNum = 0;
        foreach ($rawData as $row) {
            $rowNum++;
            try {
                $mappedRow = [];
                foreach ($this->fieldMapping as $targetField => $sourceConfig) {
                    $mappedRow[$targetField] = $this->extractValue($row, $sourceConfig);
                }
                $mapped[] = $mappedRow;
            } catch (Exception $e) {
                $this->warnings[] = "Row $rowNum: " . $e->getMessage();
            }
        }
        return $mapped;
    }

    /**
     * Extract value from row using config
     */
    protected function extractValue(array $row, mixed $config): mixed
    {
        // Simple string mapping
        if (is_string($config)) {
            return $row[$config] ?? null;
        }

        // Array config with advanced options
        if (is_array($config)) {
            $value = null;

            // Try main field
            $field = $config['field'] ?? null;
            if ($field && isset($row[$field])) {
                $value = $row[$field];
            }

            // Try alternate fields
            if ($value === null && isset($config['alternates'])) {
                foreach ($config['alternates'] as $alt) {
                    if (isset($row[$alt]) && $row[$alt] !== '') {
                        $value = $row[$alt];
                        break;
                    }
                }
            }

            // Apply default
            if ($value === null || $value === '') {
                $value = $config['default'] ?? null;
            }

            // Apply transform
            if ($value !== null && isset($config['transform'])) {
                $value = $this->transform($value, $config['transform']);
            }

            // Apply value map
            if ($value !== null && isset($config['valueMap'])) {
                $upperValue = strtoupper(trim($value));
                if (isset($config['valueMap'][$upperValue])) {
                    $value = $config['valueMap'][$upperValue];
                } elseif (isset($config['valueMap'][$value])) {
                    $value = $config['valueMap'][$value];
                }
            }

            // Apply max length
            if ($value !== null && isset($config['maxLength']) && is_string($value)) {
                $value = mb_substr($value, 0, (int) $config['maxLength']);
            }

            return $value;
        }

        return null;
    }

    /**
     * Transform value
     */
    protected function transform(mixed $value, string $type): mixed
    {
        if ($value === null || $value === '') {
            return $value;
        }

        return match ($type) {
            'uppercase' => strtoupper($value),
            'lowercase' => strtolower($value),
            'trim' => is_string($value) ? trim($value) : $value,
            'number' => $this->parseNumber($value),
            'integer' => (int) floor($this->parseNumber($value)),
            'float' => (float) $this->parseNumber($value),
            'date' => $this->parseDate($value),
            'datetime' => $this->parseDateTime($value),
            'boolean' => $this->parseBoolean($value),
            'json' => is_string($value) ? json_decode($value, true) : $value,
            'slug' => $this->slugify($value),
            'clean' => $this->cleanString($value),
            default => $value
        };
    }

    /**
     * Parse number from string
     */
    protected function parseNumber(mixed $value): float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }

        if (is_string($value)) {
            // Remove currency symbols and spaces
            $value = preg_replace('/[^\d.,-]/', '', $value);
            // Handle Turkish format (1.234,56)
            if (preg_match('/^\d{1,3}(\.\d{3})*(,\d+)?$/', $value)) {
                $value = str_replace('.', '', $value);
                $value = str_replace(',', '.', $value);
            }
            // Handle standard format (1,234.56)
            elseif (preg_match('/^\d{1,3}(,\d{3})*(\.\d+)?$/', $value)) {
                $value = str_replace(',', '', $value);
            }
            // Handle simple comma decimal (1234,56)
            elseif (strpos($value, ',') !== false && strpos($value, '.') === false) {
                $value = str_replace(',', '.', $value);
            }
        }

        return (float) $value;
    }

    /**
     * Parse date from various formats
     */
    protected function parseDate(mixed $value): ?string
    {
        if (empty($value)) {
            return null;
        }

        $formats = [
            'Y-m-d',
            'd.m.Y',
            'd/m/Y',
            'm/d/Y',
            'Y/m/d',
            'd-m-Y',
            'Ymd'
        ];

        foreach ($formats as $format) {
            $date = DateTime::createFromFormat($format, $value);
            if ($date && $date->format($format) === $value) {
                return $date->format('Y-m-d');
            }
        }

        // Try strtotime
        $timestamp = strtotime($value);
        if ($timestamp !== false) {
            return date('Y-m-d', $timestamp);
        }

        return null;
    }

    /**
     * Parse datetime
     */
    protected function parseDateTime(mixed $value): ?string
    {
        if (empty($value)) {
            return null;
        }

        $timestamp = strtotime($value);
        if ($timestamp !== false) {
            return date('Y-m-d H:i:s', $timestamp);
        }

        return null;
    }

    /**
     * Parse boolean
     */
    protected function parseBoolean(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        $trueValues = ['1', 'true', 'yes', 'evet', 'on', 'aktif', 'active'];
        return in_array(strtolower(trim($value)), $trueValues, true);
    }

    /**
     * Create URL-safe slug
     */
    protected function slugify(string $value): string
    {
        // Transliterate Turkish chars
        $map = [
            'ç' => 'c', 'Ç' => 'C', 'ğ' => 'g', 'Ğ' => 'G',
            'ı' => 'i', 'İ' => 'I', 'ö' => 'o', 'Ö' => 'O',
            'ş' => 's', 'Ş' => 'S', 'ü' => 'u', 'Ü' => 'U'
        ];
        $value = strtr($value, $map);

        $value = strtolower($value);
        $value = preg_replace('/[^a-z0-9\s-]/', '', $value);
        $value = preg_replace('/[\s-]+/', '-', $value);
        return trim($value, '-');
    }

    /**
     * Clean string
     */
    protected function cleanString(string $value): string
    {
        // Remove null bytes
        $value = str_replace(chr(0), '', $value);
        // Remove control characters
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value);
        // Normalize whitespace
        $value = preg_replace('/\s+/', ' ', $value);
        return trim($value);
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

    /**
     * Clear errors and warnings
     */
    public function clearMessages(): void
    {
        $this->errors = [];
        $this->warnings = [];
    }

    /**
     * Detect encoding and convert to UTF-8
     */
    protected function ensureUtf8(string $content): string
    {
        $encoding = mb_detect_encoding($content, ['UTF-8', 'ISO-8859-1', 'ISO-8859-9', 'Windows-1254'], true);

        if ($encoding && $encoding !== 'UTF-8') {
            $content = mb_convert_encoding($content, 'UTF-8', $encoding);
        }

        // Remove BOM if present
        if (substr($content, 0, 3) === "\xEF\xBB\xBF") {
            $content = substr($content, 3);
        }

        return $content;
    }
}
