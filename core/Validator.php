<?php
/**
 * Validator - Input Validation
 *
 * @package OmnexDisplayHub
 */

class Validator
{
    private array $errors = [];
    private array $data = [];
    private array $rules = [];

    /**
     * Validate data against rules
     */
    public function validate(array $data, array $rules): bool
    {
        $this->data = $data;
        $this->rules = $rules;
        $this->errors = [];

        foreach ($rules as $field => $ruleSet) {
            $rulesArray = is_array($ruleSet) ? $ruleSet : explode('|', $ruleSet);
            $value = $data[$field] ?? null;

            foreach ($rulesArray as $rule) {
                if (is_string($rule)) {
                    [$ruleName, $param] = array_pad(explode(':', $rule, 2), 2, null);
                    $this->applyRule($field, $value, $ruleName, $param);
                }
            }
        }

        return empty($this->errors);
    }

    /**
     * Apply validation rule
     */
    private function applyRule(string $field, mixed $value, string $rule, ?string $param): void
    {
        $label = $this->formatFieldName($field);

        switch ($rule) {
            case 'required':
                if ($value === null || $value === '' || (is_array($value) && empty($value))) {
                    $this->addError($field, "$label is required");
                }
                break;

            case 'email':
                if ($value && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $this->addError($field, "$label must be a valid email address");
                }
                break;

            case 'url':
                if ($value && !filter_var($value, FILTER_VALIDATE_URL)) {
                    $this->addError($field, "$label must be a valid URL");
                }
                break;

            case 'min':
                if ($value !== null && $value !== '') {
                    if (is_string($value)) {
                        // String değerler için karakter uzunluğu kontrolü
                        if (mb_strlen($value) < (int)$param) {
                            $this->addError($field, "$label must be at least $param characters");
                        }
                    } elseif (is_numeric($value)) {
                        // Sadece gerçek sayısal değerler için (int, float)
                        if ($value < (float)$param) {
                            $this->addError($field, "$label must be at least $param");
                        }
                    } elseif (is_array($value) && count($value) < (int)$param) {
                        $this->addError($field, "$label must have at least $param items");
                    }
                }
                break;

            case 'max':
                if ($value !== null && $value !== '') {
                    if (is_string($value)) {
                        // String değerler için karakter uzunluğu kontrolü
                        if (mb_strlen($value) > (int)$param) {
                            $this->addError($field, "$label must not exceed $param characters");
                        }
                    } elseif (is_numeric($value)) {
                        // Sadece gerçek sayısal değerler için (int, float)
                        if ($value > (float)$param) {
                            $this->addError($field, "$label must not exceed $param");
                        }
                    } elseif (is_array($value) && count($value) > (int)$param) {
                        $this->addError($field, "$label must not have more than $param items");
                    }
                }
                break;

            case 'between':
                if ($value !== null && $value !== '') {
                    [$min, $max] = explode(',', $param);
                    if (is_numeric($value) && ($value < (float)$min || $value > (float)$max)) {
                        $this->addError($field, "$label must be between $min and $max");
                    }
                }
                break;

            case 'numeric':
                if ($value !== null && $value !== '' && !is_numeric($value)) {
                    $this->addError($field, "$label must be a number");
                }
                break;

            case 'integer':
                if ($value !== null && $value !== '' && !filter_var($value, FILTER_VALIDATE_INT)) {
                    $this->addError($field, "$label must be an integer");
                }
                break;

            case 'alpha':
                if ($value && !preg_match('/^[a-zA-Z]+$/', $value)) {
                    $this->addError($field, "$label must contain only letters");
                }
                break;

            case 'alphanumeric':
                if ($value && !preg_match('/^[a-zA-Z0-9]+$/', $value)) {
                    $this->addError($field, "$label must contain only letters and numbers");
                }
                break;

            case 'slug':
                if ($value && !preg_match('/^[a-z0-9-]+$/', $value)) {
                    $this->addError($field, "$label must contain only lowercase letters, numbers, and hyphens");
                }
                break;

            case 'in':
                $options = explode(',', $param);
                if ($value !== null && $value !== '' && !in_array($value, $options)) {
                    $this->addError($field, "$label must be one of: " . implode(', ', $options));
                }
                break;

            case 'not_in':
                $options = explode(',', $param);
                if ($value !== null && in_array($value, $options)) {
                    $this->addError($field, "$label must not be: " . implode(', ', $options));
                }
                break;

            case 'regex':
                if ($value && !preg_match($param, $value)) {
                    $this->addError($field, "$label format is invalid");
                }
                break;

            case 'date':
                if ($value && !strtotime($value)) {
                    $this->addError($field, "$label must be a valid date");
                }
                break;

            case 'date_format':
                if ($value) {
                    $date = DateTime::createFromFormat($param, $value);
                    if (!$date || $date->format($param) !== $value) {
                        $this->addError($field, "$label must match format $param");
                    }
                }
                break;

            case 'before':
                if ($value && strtotime($value) >= strtotime($param)) {
                    $this->addError($field, "$label must be before $param");
                }
                break;

            case 'after':
                if ($value && strtotime($value) <= strtotime($param)) {
                    $this->addError($field, "$label must be after $param");
                }
                break;

            case 'confirmed':
                $confirmField = $field . '_confirmation';
                if ($value !== ($this->data[$confirmField] ?? null)) {
                    $this->addError($field, "$label confirmation does not match");
                }
                break;

            case 'same':
                if ($value !== ($this->data[$param] ?? null)) {
                    $this->addError($field, "$label must match " . $this->formatFieldName($param));
                }
                break;

            case 'different':
                if ($value === ($this->data[$param] ?? null)) {
                    $this->addError($field, "$label must be different from " . $this->formatFieldName($param));
                }
                break;

            case 'unique':
                [$table, $column, $exceptId] = array_pad(explode(',', $param), 3, null);
                $column = $column ?? $field;

                // Sanitize identifiers - only allow alphanumeric and underscore
                $table = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
                $column = preg_replace('/[^a-zA-Z0-9_]/', '', $column);

                // Whitelist allowed tables
                if (!$this->isAllowedTable($table)) {
                    $this->addError($field, "Invalid validation table");
                    break;
                }

                if ($value) {
                    $db = Database::getInstance();
                    $sql = "SELECT 1 FROM `$table` WHERE `$column` = ?";
                    $params = [$value];

                    if ($exceptId) {
                        $sql .= " AND id != ?";
                        $params[] = $exceptId;
                    }

                    if ($db->fetch($sql, $params)) {
                        $this->addError($field, "$label already exists");
                    }
                }
                break;

            case 'exists':
                [$table, $column] = array_pad(explode(',', $param), 2, null);
                $column = $column ?? $field;

                // Sanitize identifiers
                $table = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
                $column = preg_replace('/[^a-zA-Z0-9_]/', '', $column);

                // Whitelist allowed tables
                if (!$this->isAllowedTable($table)) {
                    $this->addError($field, "Invalid validation table");
                    break;
                }

                if ($value) {
                    $db = Database::getInstance();
                    if (!$db->fetch("SELECT 1 FROM `$table` WHERE `$column` = ?", [$value])) {
                        $this->addError($field, "$label does not exist");
                    }
                }
                break;

            case 'json':
                if ($value) {
                    json_decode($value);
                    if (json_last_error() !== JSON_ERROR_NONE) {
                        $this->addError($field, "$label must be valid JSON");
                    }
                }
                break;

            case 'array':
                if ($value !== null && !is_array($value)) {
                    $this->addError($field, "$label must be an array");
                }
                break;

            case 'boolean':
                if ($value !== null && !is_bool($value) && !in_array($value, [0, 1, '0', '1', 'true', 'false'], true)) {
                    $this->addError($field, "$label must be true or false");
                }
                break;

            case 'nullable':
                // Allow null values, skip other validations if null
                break;

            case 'password':
                if ($value) {
                    $errors = Security::validatePasswordStrength($value);
                    foreach ($errors as $error) {
                        $this->addError($field, $error);
                    }
                }
                break;
        }
    }

    /**
     * Add error message
     */
    public function addError(string $field, string $message): void
    {
        if (!isset($this->errors[$field])) {
            $this->errors[$field] = [];
        }
        $this->errors[$field][] = $message;
    }

    /**
     * Get all errors
     */
    public function getErrors(): array
    {
        return $this->errors;
    }

    /**
     * Get first error for a field
     */
    public function getFirstError(string $field): ?string
    {
        return $this->errors[$field][0] ?? null;
    }

    /**
     * Check if field has error
     */
    public function hasError(string $field): bool
    {
        return isset($this->errors[$field]) && !empty($this->errors[$field]);
    }

    /**
     * Check if validation failed
     */
    public function fails(): bool
    {
        return !empty($this->errors);
    }

    /**
     * Check if validation passed
     */
    public function passes(): bool
    {
        return empty($this->errors);
    }

    /**
     * Check if table name is in the allowed whitelist
     */
    private function isAllowedTable(string $table): bool
    {
        $allowedTables = [
            'users', 'companies', 'products', 'templates', 'devices',
            'categories', 'media', 'media_folders', 'playlists', 'schedules',
            'settings', 'licenses', 'production_types', 'device_groups',
            'notifications', 'label_sizes', 'hanshow_esls', 'sessions',
            'permissions', 'device_tokens', 'device_sync_requests',
            'device_commands', 'device_heartbeats', 'playlist_items',
            'schedule_devices', 'audit_logs', 'import_mappings',
            'integrations', 'render_queue', 'render_queue_items',
            'notification_recipients', 'user_notification_preferences',
            'layout_configs', 'menu_items', 'firmware_updates',
            'hanshow_queue', 'hanshow_settings', 'hanshow_aps', 'hanshow_firmwares',
            'device_group_members', 'device_alerts', 'device_content_assignments',
        ];

        return in_array($table, $allowedTables, true);
    }

    /**
     * Format field name for display
     */
    private function formatFieldName(string $field): string
    {
        return ucfirst(str_replace(['_', '-'], ' ', $field));
    }

    /**
     * Static validation helper
     */
    public static function make(array $data, array $rules): self
    {
        $validator = new self();
        $validator->validate($data, $rules);
        return $validator;
    }
}
