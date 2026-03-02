<?php
/**
 * Logger - Logging Utility
 *
 * @package OmnexDisplayHub
 */

class Logger
{
    private const LEVELS = [
        'debug' => 0,
        'info' => 1,
        'warning' => 2,
        'error' => 3,
        'critical' => 4
    ];

    /**
     * Log debug message
     */
    public static function debug(string $message, array $context = []): void
    {
        self::log('debug', $message, $context);
    }

    /**
     * Log info message
     */
    public static function info(string $message, array $context = []): void
    {
        self::log('info', $message, $context);
    }

    /**
     * Log warning message
     */
    public static function warning(string $message, array $context = []): void
    {
        self::log('warning', $message, $context);
    }

    /**
     * Log error message
     */
    public static function error(string $message, array $context = []): void
    {
        self::log('error', $message, $context, ERROR_LOG_FILE);
    }

    /**
     * Log critical message
     */
    public static function critical(string $message, array $context = []): void
    {
        self::log('critical', $message, $context, ERROR_LOG_FILE);
    }

    /**
     * Log audit event
     */
    public static function audit(string $action, string $resource, array $data = []): void
    {
        $user = Auth::user();

        $entry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'user_id' => $user['id'] ?? null,
            'user_email' => $user['email'] ?? null,
            'company_id' => $user['company_id'] ?? null,
            'action' => $action,
            'resource' => $resource,
            'data' => $data,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
        ];

        self::write(AUDIT_LOG_FILE, json_encode($entry, JSON_UNESCAPED_UNICODE));

        // Also save to database if available
        try {
            $db = Database::getInstance();
            // Extract entity_id from various possible keys
            $entityId = $data['id']
                ?? $data['entity_id']
                ?? $data['user_id']
                ?? $data['device_id']
                ?? $data['template_id']
                ?? $data['product_id']
                ?? $data['media_id']
                ?? $data['company_id']
                ?? $data['license_id']
                ?? $data['group_id']
                ?? $data['payment_id']
                ?? $data['transaction_id']
                ?? null;

            $db->insert('audit_logs', [
                'company_id' => $entry['company_id'],
                'user_id' => $entry['user_id'],
                'action' => $action,
                'entity_type' => $resource,
                'entity_id' => $entityId,
                'old_values' => isset($data['old']) ? json_encode($data['old']) : null,
                'new_values' => isset($data['new']) ? json_encode($data['new']) : null,
                'ip_address' => $entry['ip'],
                'user_agent' => $entry['user_agent']
            ]);
        } catch (Exception $e) {
            // Silently fail if database not available
        }
    }

    /**
     * Log API request
     */
    public static function api(string $method, string $path, int $status, float $duration): void
    {
        $apiLogFile = STORAGE_PATH . '/logs/api.log';

        $entry = sprintf(
            "[%s] %s %s - %d (%.2fms) - %s",
            date('Y-m-d H:i:s'),
            $method,
            $path,
            $status,
            $duration * 1000,
            $_SERVER['REMOTE_ADDR'] ?? '-'
        );

        self::write($apiLogFile, $entry);
    }

    /**
     * Generic log method
     */
    private static function log(string $level, string $message, array $context = [], ?string $file = null): void
    {
        // Check if should log based on level
        $configLevel = self::LEVELS[LOG_LEVEL] ?? 0;
        $messageLevel = self::LEVELS[$level] ?? 0;

        if ($messageLevel < $configLevel) {
            return;
        }

        $file = $file ?? LOG_FILE;

        // Format context
        $contextStr = !empty($context) ? ' ' . json_encode($context, JSON_UNESCAPED_UNICODE) : '';

        $entry = sprintf(
            "[%s] [%s] %s%s",
            date('Y-m-d H:i:s'),
            strtoupper($level),
            $message,
            $contextStr
        );

        self::write($file, $entry);
    }

    /**
     * Write to log file
     */
    private static function write(string $file, string $entry): void
    {
        $dir = dirname($file);

        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        // Rotate log if too large (10MB)
        if (file_exists($file) && filesize($file) > 10 * 1024 * 1024) {
            self::rotate($file);
        }

        file_put_contents($file, $entry . PHP_EOL, FILE_APPEND | LOCK_EX);
    }

    /**
     * Rotate log file
     */
    private static function rotate(string $file): void
    {
        $date = date('Y-m-d_His');
        $rotatedFile = $file . '.' . $date;
        rename($file, $rotatedFile);

        // Keep only last 10 rotated files
        $pattern = $file . '.*';
        $files = glob($pattern);
        if (count($files) > 10) {
            sort($files);
            $toDelete = array_slice($files, 0, count($files) - 10);
            foreach ($toDelete as $oldFile) {
                unlink($oldFile);
            }
        }
    }

    /**
     * Clean old log files
     */
    public static function clean(int $daysToKeep = 30): int
    {
        $logDir = STORAGE_PATH . '/logs';
        if (!is_dir($logDir)) {
            return 0;
        }

        $deleted = 0;
        $cutoff = time() - ($daysToKeep * 86400);

        $files = glob($logDir . '/*.log.*');
        foreach ($files as $file) {
            if (filemtime($file) < $cutoff) {
                unlink($file);
                $deleted++;
            }
        }

        return $deleted;
    }

    /**
     * Get log contents
     */
    public static function read(string $file, int $lines = 100): array
    {
        if (!file_exists($file)) {
            return [];
        }

        $result = [];
        $fp = fopen($file, 'r');

        if (!$fp) {
            return [];
        }

        // Read from end of file
        fseek($fp, 0, SEEK_END);
        $pos = ftell($fp);
        $lineCount = 0;
        $buffer = '';

        while ($pos > 0 && $lineCount < $lines) {
            $pos--;
            fseek($fp, $pos);
            $char = fgetc($fp);

            if ($char === "\n" && $buffer !== '') {
                $result[] = $buffer;
                $buffer = '';
                $lineCount++;
            } else {
                $buffer = $char . $buffer;
            }
        }

        if ($buffer !== '' && $lineCount < $lines) {
            $result[] = $buffer;
        }

        fclose($fp);

        return array_reverse($result);
    }
}
