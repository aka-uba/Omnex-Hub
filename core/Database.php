<?php
/**
 * Database - PDO wrapper (SQLite + PostgreSQL)
 *
 * @package OmnexDisplayHub
 */

class Database
{
    private static ?Database $instance = null;
    private PDO $pdo;
    private int $lastRowCount = 0;
    private string $driver = 'sqlite';
    private array $tableColumnCache = [];

    private const NON_UUID_ID_TABLES = [
        'migrations' => true,
        'stream_access_logs' => true,
        'hanshow_firmwares' => true,
        'label_sizes' => true,
        'web_template_widgets' => true,
        'render_priority_weights' => true,
        'render_retry_policies' => true,
        'integration_settings' => true,
        'license_plans' => true,
        'settings' => true,
        'menu_items' => true,
        'hanshow_settings' => true,
    ];

    private const POSTGRES_SCHEMA_FILES = [
        '00_extensions.sql',
        '01_schemas.sql',
        '10_core.sql',
        '11_license.sql',
        '12_catalog.sql',
        '13_branch.sql',
        '14_labels.sql',
        '15_media.sql',
        '16_devices.sql',
        '17_signage.sql',
        '18_integration.sql',
        '19_audit.sql',
        '20_legacy.sql',
        '30_constraints.sql',
        '40_indexes.sql',
        '41_perf_indexes.sql',
        '42_devices_branch_indexes.sql',
        '70_rls.sql',
    ];

    private function __construct()
    {
        $configuredDriver = strtolower(trim((string)(defined('DB_DRIVER') ? DB_DRIVER : (getenv('OMNEX_DB_DRIVER') ?: 'sqlite'))));
        if (in_array($configuredDriver, ['pgsql', 'postgres', 'postgresql'], true)) {
            $this->driver = 'pgsql';
            $this->connectPostgresql();
            return;
        }

        $this->driver = 'sqlite';
        $this->connectSqlite();
    }

    public static function getInstance(): Database
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getPdo(): PDO
    {
        return $this->pdo;
    }

    public function getDriver(): string
    {
        return $this->driver;
    }

    public function isPostgres(): bool
    {
        return $this->driver === 'pgsql';
    }

    public function isSqlite(): bool
    {
        return $this->driver === 'sqlite';
    }

    /**
     * Set session-level app context for PostgreSQL RLS policies.
     */
    public function setAppContext(?string $companyId = null, ?string $userId = null, ?string $role = null): void
    {
        if (!$this->isPostgres()) {
            return;
        }

        $context = [
            'app.company_id' => $companyId ?? '',
            'app.user_id' => $userId ?? '',
            'app.role' => $role ?? '',
        ];

        foreach ($context as $key => $value) {
            $this->query('SELECT set_config(?, ?, false)', [$key, $value]);
        }
    }

    /**
     * Execute a query with prepared statements.
     */
    public function query(string $sql, array $params = []): PDOStatement
    {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $this->lastRowCount = $stmt->rowCount();
        return $stmt;
    }

    /**
     * Fetch a single row.
     */
    public function fetch(string $sql, array $params = []): ?array
    {
        $result = $this->query($sql, $params)->fetch();
        return $result ?: null;
    }

    /**
     * Fetch all rows.
     */
    public function fetchAll(string $sql, array $params = []): array
    {
        return $this->query($sql, $params)->fetchAll();
    }

    /**
     * Fetch a single column value.
     */
    public function fetchColumn(string $sql, array $params = [], int $column = 0): mixed
    {
        return $this->query($sql, $params)->fetchColumn($column);
    }

    /**
     * Get row count from the last executed query.
     */
    public function rowCount(): int
    {
        return $this->lastRowCount;
    }

    /**
     * Get table column names in current driver.
     */
    public function getTableColumns(string $table, ?string $schema = null): array
    {
        $tableName = trim($table);
        if ($tableName === '') {
            return [];
        }

        if ($this->isSqlite()) {
            $rows = $this->fetchAll('PRAGMA table_info(' . $this->escapeIdentifier($tableName) . ')');
            $names = [];
            foreach ($rows as $row) {
                if (isset($row['name'])) {
                    $names[] = (string)$row['name'];
                }
            }
            return $names;
        }

        if ($schema !== null && $schema !== '') {
            $rows = $this->fetchAll(
                'SELECT column_name
                 FROM information_schema.columns
                 WHERE table_schema = ?
                   AND table_name = ?
                 ORDER BY ordinal_position',
                [$schema, $tableName]
            );
        } else {
            $rows = $this->fetchAll(
                'SELECT column_name
                 FROM information_schema.columns
                 WHERE table_name = ?
                   AND table_schema = ANY (current_schemas(false))
                 ORDER BY ordinal_position',
                [$tableName]
            );
        }

        $names = [];
        foreach ($rows as $row) {
            if (isset($row['column_name'])) {
                $names[] = (string)$row['column_name'];
            }
        }
        return $names;
    }

    /**
     * Check whether table exists in current driver.
     */
    public function tableExists(string $table, ?string $schema = null): bool
    {
        $tableName = trim($table);
        if ($tableName === '') {
            return false;
        }

        if ($this->isSqlite()) {
            $row = $this->fetch(
                "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
                [$tableName]
            );
            return !empty($row);
        }

        if ($schema !== null && $schema !== '') {
            $count = (int)$this->fetchColumn(
                'SELECT COUNT(*)
                 FROM information_schema.tables
                 WHERE table_schema = ?
                   AND table_name = ?',
                [$schema, $tableName]
            );
            return $count > 0;
        }

        $count = (int)$this->fetchColumn(
            'SELECT COUNT(*)
             FROM information_schema.tables
             WHERE table_name = ?
               AND table_schema = ANY (current_schemas(false))',
            [$tableName]
        );
        return $count > 0;
    }

    public function columnExists(string $table, string $column, ?string $schema = null): bool
    {
        $tableKey = strtolower(trim($table));
        $columnKey = strtolower(trim($column));
        if ($tableKey === '' || $columnKey === '') {
            return false;
        }

        if (!isset($this->tableColumnCache[$tableKey])) {
            $this->tableColumnCache[$tableKey] = array_map(
                static fn(string $name): string => strtolower($name),
                $this->getTableColumns($table, $schema)
            );
        }

        return in_array($columnKey, $this->tableColumnCache[$tableKey], true);
    }

    /**
     * Insert a row and return the inserted ID if available.
     */
    public function insert(string $table, array $data): string
    {
        $safeTable = $this->validateTable($table);

        // Keep existing UUID behavior but avoid forcing ID on non-UUID tables.
        if (!isset($data['id']) && $this->shouldAutoGenerateUuidForTable($table)) {
            $data['id'] = $this->generateUuid();
        }

        $columns = implode(', ', array_map(
            fn($col) => $this->escapeIdentifier((string)$col),
            array_keys($data)
        ));
        $placeholders = implode(', ', array_fill(0, count($data), '?'));

        $sql = "INSERT INTO $safeTable ($columns) VALUES ($placeholders)";
        $this->query($sql, array_values($data));

        if (isset($data['id'])) {
            return (string)$data['id'];
        }

        $lastInsertId = $this->pdo->lastInsertId();
        return $lastInsertId !== false ? (string)$lastInsertId : '';
    }

    /**
     * Update rows.
     */
    public function update(string $table, array $data, string $where, array $whereParams = []): int
    {
        $safeTable = $this->validateTable($table);

        $set = implode(', ', array_map(
            fn($col) => $this->escapeIdentifier((string)$col) . ' = ?',
            array_keys($data)
        ));
        $sql = "UPDATE $safeTable SET $set WHERE $where";

        $stmt = $this->query($sql, array_merge(array_values($data), $whereParams));
        return $stmt->rowCount();
    }

    /**
     * Delete rows.
     */
    public function delete(string $table, string $where, array $params = []): int
    {
        $safeTable = $this->validateTable($table);
        $sql = "DELETE FROM $safeTable WHERE $where";
        $stmt = $this->query($sql, $params);
        return $stmt->rowCount();
    }

    /**
     * Begin transaction.
     */
    public function beginTransaction(): bool
    {
        return $this->pdo->beginTransaction();
    }

    /**
     * Commit transaction.
     */
    public function commit(): bool
    {
        return $this->pdo->commit();
    }

    /**
     * Rollback transaction.
     */
    public function rollBack(): bool
    {
        return $this->pdo->rollBack();
    }

    /**
     * Check if in transaction.
     */
    public function inTransaction(): bool
    {
        return $this->pdo->inTransaction();
    }

    /**
     * Run migrations.
     * SQLite: existing migration files under database/migrations.
     * PostgreSQL: modular schema files under database/postgresql/v2.
     */
    public function migrate(): void
    {
        if ($this->isPostgres()) {
            $this->migratePostgresql();
            return;
        }

        $this->migrateSqlite();
    }

    /**
     * Run seeds (unchanged behavior).
     */
    public function seed(): void
    {
        $seedsDir = DATABASE_PATH . '/seeds';
        if (!is_dir($seedsDir)) {
            return;
        }

        $files = glob($seedsDir . '/*.php');
        sort($files);

        foreach ($files as $file) {
            require_once $file;
            Logger::info('Seed executed: ' . basename($file));
        }
    }

    private function connectSqlite(): void
    {
        $dbPath = DB_PATH;
        $dbDir = dirname($dbPath);

        if (!is_dir($dbDir)) {
            mkdir($dbDir, 0755, true);
        }

        try {
            $this->pdo = new PDO('sqlite:' . $dbPath, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);

            $this->pdo->exec('PRAGMA foreign_keys = ON');
            $this->pdo->exec('PRAGMA journal_mode = WAL');
            $this->pdo->exec('PRAGMA synchronous = NORMAL');
        } catch (PDOException $e) {
            throw new Exception('SQLite connection failed: ' . $e->getMessage());
        }
    }

    private function connectPostgresql(): void
    {
        if (!in_array('pgsql', PDO::getAvailableDrivers(), true)) {
            throw new Exception('PDO pgsql driver is not installed. Enable pdo_pgsql extension first.');
        }

        $cfg = $this->resolvePostgresConfig();

        try {
            $this->pdo = new PDO($cfg['dsn'], (string)$cfg['user'], (string)$cfg['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);

            $tz = date_default_timezone_get();
            if (is_string($tz) && $tz !== '') {
                $this->pdo->exec('SET TIME ZONE ' . $this->pdo->quote($tz));
            }

            $searchPathRaw = (string)$cfg['search_path'];
            $searchPathParts = array_filter(array_map('trim', explode(',', $searchPathRaw)));
            $safeSearchPath = [];
            foreach ($searchPathParts as $part) {
                if (preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $part)) {
                    $safeSearchPath[] = $this->escapeIdentifier($part);
                }
            }
            if (!empty($safeSearchPath)) {
                $this->pdo->exec('SET search_path TO ' . implode(', ', $safeSearchPath));
            }
        } catch (PDOException $e) {
            throw new Exception('PostgreSQL connection failed: ' . $e->getMessage());
        }
    }

    private function resolvePostgresConfig(): array
    {
        $host = defined('DB_PG_HOST') ? (string)DB_PG_HOST : (string)(getenv('OMNEX_DB_HOST') ?: '127.0.0.1');
        $port = (int)(defined('DB_PG_PORT') ? DB_PG_PORT : (getenv('OMNEX_DB_PORT') ?: 5432));
        $name = defined('DB_PG_NAME') ? (string)DB_PG_NAME : (string)(getenv('OMNEX_DB_NAME') ?: 'market_etiket');
        $user = defined('DB_PG_USER') ? (string)DB_PG_USER : (string)(getenv('OMNEX_DB_USER') ?: 'postgres');
        $pass = defined('DB_PG_PASS') ? (string)DB_PG_PASS : (string)(getenv('OMNEX_DB_PASS') ?: '');
        $sslMode = defined('DB_PG_SSLMODE') ? (string)DB_PG_SSLMODE : (string)(getenv('OMNEX_DB_SSLMODE') ?: 'prefer');
        $connectTimeout = (int)(defined('DB_PG_CONNECT_TIMEOUT') ? DB_PG_CONNECT_TIMEOUT : (getenv('OMNEX_DB_CONNECT_TIMEOUT') ?: 5));
        $appName = defined('DB_PG_APP_NAME') ? (string)DB_PG_APP_NAME : (string)(getenv('OMNEX_DB_APP_NAME') ?: 'market-etiket-sistemi');
        $searchPath = defined('DB_PG_SEARCH_PATH')
            ? (string)DB_PG_SEARCH_PATH
            : (string)(getenv('OMNEX_DB_SEARCH_PATH') ?: 'core,license,catalog,branch,labels,media,devices,signage,integration,audit,legacy,public');

        $url = defined('DB_URL') ? (string)DB_URL : (string)(getenv('DATABASE_URL') ?: getenv('OMNEX_DB_URL') ?: '');
        if ($url !== '') {
            $lowerUrl = strtolower($url);
            if (str_starts_with($lowerUrl, 'pgsql:')) {
                $dsnBody = substr($url, 6);
                $chunks = explode(';', (string)$dsnBody);
                foreach ($chunks as $chunk) {
                    $chunk = trim($chunk);
                    if ($chunk === '' || !str_contains($chunk, '=')) {
                        continue;
                    }

                    [$key, $value] = explode('=', $chunk, 2);
                    $key = strtolower(trim((string)$key));
                    $value = trim((string)$value);
                    if ($value === '') {
                        continue;
                    }

                    if ($key === 'user' || $key === 'username') {
                        $user = $value;
                    } elseif ($key === 'password' || $key === 'pass') {
                        $pass = $value;
                    } elseif ($key === 'search_path' || $key === 'currentschema' || $key === 'schema') {
                        $searchPath = $value;
                    }
                }

                return [
                    'dsn' => $url,
                    'user' => $user,
                    'pass' => $pass,
                    'search_path' => $searchPath,
                ];
            }

            if (preg_match('/^(postgres|postgresql):\\/\\//i', $url) === 1) {
                $parsed = parse_url($url);
                if ($parsed === false) {
                    throw new Exception('Invalid DATABASE_URL format.');
                }

                if (!empty($parsed['host'])) {
                    $host = (string)$parsed['host'];
                }
                if (!empty($parsed['port'])) {
                    $port = (int)$parsed['port'];
                }
                if (!empty($parsed['path'])) {
                    $name = ltrim((string)$parsed['path'], '/');
                }
                if (!empty($parsed['user'])) {
                    $user = rawurldecode((string)$parsed['user']);
                }
                if (array_key_exists('pass', $parsed)) {
                    $pass = rawurldecode((string)$parsed['pass']);
                }

                if (!empty($parsed['query'])) {
                    parse_str((string)$parsed['query'], $q);
                    if (!empty($q['host'])) {
                        $host = (string)$q['host'];
                    }
                    if (!empty($q['port'])) {
                        $port = (int)$q['port'];
                    }
                    if (!empty($q['dbname'])) {
                        $name = (string)$q['dbname'];
                    }
                    if (!empty($q['sslmode'])) {
                        $sslMode = (string)$q['sslmode'];
                    }
                    if (!empty($q['connect_timeout'])) {
                        $connectTimeout = (int)$q['connect_timeout'];
                    }
                    if (!empty($q['application_name'])) {
                        $appName = (string)$q['application_name'];
                    }
                    if (!empty($q['search_path'])) {
                        $searchPath = (string)$q['search_path'];
                    }
                    if (!empty($q['currentschema'])) {
                        $searchPath = (string)$q['currentschema'];
                    }
                    if (!empty($q['schema'])) {
                        $searchPath = (string)$q['schema'];
                    }
                }
            }
        }

        if ($name === '') {
            throw new Exception('PostgreSQL database name is empty. Set OMNEX_DB_NAME or DATABASE_URL.');
        }

        $dsnParts = [];
        $dsnParts[] = 'host=' . $host;
        $dsnParts[] = 'port=' . (string)$port;
        $dsnParts[] = 'dbname=' . $name;
        if ($sslMode !== '') {
            $dsnParts[] = 'sslmode=' . $sslMode;
        }
        if ($connectTimeout > 0) {
            $dsnParts[] = 'connect_timeout=' . (string)$connectTimeout;
        }
        if ($appName !== '') {
            $dsnParts[] = 'application_name=' . $appName;
        }

        return [
            'dsn' => 'pgsql:' . implode(';', $dsnParts),
            'user' => $user,
            'pass' => $pass,
            'search_path' => $searchPath,
        ];
    }

    private function migrateSqlite(): void
    {
        $migrationsDir = DATABASE_PATH . '/migrations';
        if (!is_dir($migrationsDir)) {
            return;
        }

        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                executed_at TEXT DEFAULT (CURRENT_TIMESTAMP)
            )
        ");

        $executed = $this->fetchAll('SELECT name FROM migrations');
        $executedNames = array_column($executed, 'name');

        $sqlFiles = glob($migrationsDir . '/*.sql') ?: [];
        $phpFiles = glob($migrationsDir . '/*.php') ?: [];
        $files = array_merge($sqlFiles, $phpFiles);
        sort($files);

        foreach ($files as $file) {
            $name = basename($file);
            if (in_array($name, $executedNames, true)) {
                continue;
            }

            $ext = pathinfo($file, PATHINFO_EXTENSION);
            if ($ext === 'php') {
                require_once $file;
                $funcName = 'migrate_' . pathinfo($name, PATHINFO_FILENAME);
                if (function_exists($funcName)) {
                    $funcName($this);
                }
            } else {
                $sql = file_get_contents($file);
                $statements = array_filter(array_map('trim', explode(';', (string)$sql)));

                foreach ($statements as $statement) {
                    if ($statement === '') {
                        continue;
                    }

                    try {
                        $this->pdo->exec($statement);
                    } catch (PDOException $e) {
                        $msg = $e->getMessage();
                        if (strpos($msg, 'duplicate column name') !== false ||
                            strpos($msg, 'already exists') !== false) {
                            continue;
                        }
                        throw $e;
                    }
                }
            }

            $this->query('INSERT INTO migrations (name) VALUES (?)', [$name]);
            Logger::info('Migration executed: ' . $name);
        }
    }

    private function migratePostgresql(): void
    {
        $schemaDir = DATABASE_PATH . '/postgresql/v2';
        if (!is_dir($schemaDir)) {
            return;
        }

        // Bootstrap migration tracking before schema files run.
        $this->pdo->exec('CREATE SCHEMA IF NOT EXISTS core');
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS core.migrations (
                id bigint generated always as identity PRIMARY KEY,
                name text NOT NULL UNIQUE,
                executed_at timestamptz DEFAULT now()
            )
        ");

        $executedRows = $this->fetchAll("SELECT name FROM core.migrations WHERE name LIKE 'pg:%'");
        $executed = array_flip(array_column($executedRows, 'name'));

        foreach (self::POSTGRES_SCHEMA_FILES as $fileName) {
            $marker = 'pg:' . $fileName;
            if (isset($executed[$marker])) {
                continue;
            }

            $path = $schemaDir . '/' . $fileName;
            if (!is_file($path)) {
                continue;
            }

            $sql = trim((string)file_get_contents($path));
            if ($sql === '') {
                $this->query(
                    'INSERT INTO core.migrations (name) VALUES (?) ON CONFLICT (name) DO NOTHING',
                    [$marker]
                );
                continue;
            }

            $this->pdo->exec($sql);
            $this->query(
                'INSERT INTO core.migrations (name) VALUES (?) ON CONFLICT (name) DO NOTHING',
                [$marker]
            );
            Logger::info('PostgreSQL schema step executed: ' . $fileName);
        }
    }

    /**
     * Validate and escape identifier (table/column name).
     */
    private function escapeIdentifier(string $identifier): string
    {
        if (!preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $identifier)) {
            throw new Exception('Invalid identifier: ' . $identifier);
        }
        return '"' . $identifier . '"';
    }

    /**
     * Validate table name against whitelist.
     */
    private function validateTable(string $table): string
    {
        $allowedTables = [
            'companies', 'users', 'sessions', 'permissions', 'products',
            'categories', 'templates', 'media', 'media_folders', 'devices',
            'device_groups', 'device_group_members', 'device_logs', 'playlists',
            'playlist_items', 'schedules', 'schedule_devices', 'settings',
            'licenses', 'notifications', 'notification_recipients', 'notification_settings',
            'user_notification_preferences', 'audit_logs', 'layout_configs', 'menu_items',
            'integrations', 'integration_settings', 'import_mappings', 'import_logs', 'price_history', 'migrations',
            'production_types', 'device_tokens', 'device_sync_requests', 'device_commands',
            'device_heartbeats', 'device_content_assignments', 'device_alerts', 'firmware_updates',
            'gateways', 'gateway_devices', 'gateway_commands',
            'payment_settings', 'payment_transactions', 'license_plans',
            'hanshow_esls', 'hanshow_queue', 'hanshow_settings', 'hanshow_aps', 'hanshow_firmwares',
            'tamsoft_settings', 'tamsoft_tokens', 'tamsoft_sync_logs', 'tamsoft_depo_mapping',
            'render_queue', 'render_queue_items', 'render_priority_weights', 'render_retry_policies',
            'render_cache', 'render_jobs',
            'label_sizes',
            'company_storage_usage', 'product_renders',
            'product_hal_data', 'product_branch_hal_overrides',
            'branches', 'product_branch_overrides', 'branch_price_history',
            'user_branch_access', 'branch_import_logs',
            'hal_distribution_logs',
            'web_templates', 'web_template_versions', 'web_template_assignments', 'web_template_widgets',
            'bundles', 'bundle_items', 'bundle_price_history',
            'bundle_branch_overrides', 'bundle_branch_price_history',
            'mqtt_settings',
            'transcode_queue', 'transcode_variants', 'stream_access_logs',
            'license_device_pricing',
            'erp_import_files',
            'tenant_backups'
        ];

        if (!in_array($table, $allowedTables, true)) {
            throw new Exception('Invalid table name: ' . $table);
        }
        return $this->escapeIdentifier($table);
    }

    private function shouldAutoGenerateUuidForTable(string $table): bool
    {
        if (isset(self::NON_UUID_ID_TABLES[$table])) {
            return false;
        }
        return $this->tableHasColumn($table, 'id');
    }

    private function tableHasColumn(string $table, string $column): bool
    {
        return $this->columnExists($table, $column);
    }

    /**
     * Generate UUID v4.
     */
    public function generateUuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    // Prevent cloning
    private function __clone() {}

    // Prevent unserialization
    public function __wakeup()
    {
        throw new Exception('Cannot unserialize singleton');
    }
}

