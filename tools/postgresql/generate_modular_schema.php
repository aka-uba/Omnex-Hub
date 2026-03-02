<?php


$basePath = dirname(__DIR__, 2);
$dbPath = $basePath . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'omnex.db';
$outDir = $basePath . DIRECTORY_SEPARATOR . 'database' . DIRECTORY_SEPARATOR . 'postgresql' . DIRECTORY_SEPARATOR . 'v2';

if (!file_exists($dbPath)) {
    fwrite(STDERR, "SQLite source not found: $dbPath\n");
    exit(1);
}

if (!is_dir($outDir) && !mkdir($outDir, 0777, true) && !is_dir($outDir)) {
    fwrite(STDERR, "Cannot create output directory: $outDir\n");
    exit(1);
}

$db = new PDO('sqlite:' . $dbPath);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

$moduleFiles = [
    'core' => '10_core.sql',
    'license' => '11_license.sql',
    'catalog' => '12_catalog.sql',
    'branch' => '13_branch.sql',
    'labels' => '14_labels.sql',
    'media' => '15_media.sql',
    'devices' => '16_devices.sql',
    'signage' => '17_signage.sql',
    'integration' => '18_integration.sql',
    'audit' => '19_audit.sql',
    'legacy' => '20_legacy.sql',
];

$tableToModule = [
    'companies' => 'core',
    'users' => 'core',
    'permissions' => 'core',
    'sessions' => 'core',
    'settings' => 'core',
    'menu_items' => 'core',
    'layout_configs' => 'core',
    'rate_limits' => 'core',
    'migrations' => 'core',

    'licenses' => 'license',
    'license_plans' => 'license',
    'license_device_pricing' => 'license',
    'payment_settings' => 'license',
    'payment_transactions' => 'license',

    'products' => 'catalog',
    'categories' => 'catalog',
    'production_types' => 'catalog',
    'price_history' => 'catalog',
    'bundles' => 'catalog',
    'bundle_items' => 'catalog',
    'bundle_price_history' => 'catalog',

    'branches' => 'branch',
    'user_branch_access' => 'branch',
    'branch_import_logs' => 'branch',
    'product_branch_overrides' => 'branch',
    'branch_price_history' => 'branch',
    'bundle_branch_overrides' => 'branch',
    'bundle_branch_price_history' => 'branch',

    'templates' => 'labels',
    'label_sizes' => 'labels',
    'render_cache' => 'labels',
    'render_jobs' => 'labels',
    'render_queue' => 'labels',
    'render_queue_items' => 'labels',
    'render_priority_weights' => 'labels',
    'render_retry_policies' => 'labels',
    'product_renders' => 'labels',
    'templates_backup' => 'labels',

    'media' => 'media',
    'media_folders' => 'media',
    'company_storage_usage' => 'media',

    'devices' => 'devices',
    'device_groups' => 'devices',
    'device_group_members' => 'devices',
    'device_logs' => 'devices',
    'device_sync_requests' => 'devices',
    'device_tokens' => 'devices',
    'device_commands' => 'devices',
    'device_heartbeats' => 'devices',
    'device_content_assignments' => 'devices',
    'device_alerts' => 'devices',
    'firmware_updates' => 'devices',
    'gateways' => 'devices',
    'gateway_devices' => 'devices',
    'gateway_commands' => 'devices',
    'hanshow_esls' => 'devices',
    'hanshow_queue' => 'devices',
    'hanshow_settings' => 'devices',
    'hanshow_aps' => 'devices',
    'hanshow_firmwares' => 'devices',
    'mqtt_settings' => 'devices',

    'playlists' => 'signage',
    'playlist_items' => 'signage',
    'schedules' => 'signage',
    'schedule_devices' => 'signage',
    'web_templates' => 'signage',
    'web_template_versions' => 'signage',
    'web_template_assignments' => 'signage',
    'web_template_widgets' => 'signage',
    'transcode_queue' => 'signage',
    'transcode_variants' => 'signage',
    'stream_access_logs' => 'signage',

    'integrations' => 'integration',
    'integration_settings' => 'integration',
    'integration_settings_audit' => 'integration',
    'import_mappings' => 'integration',
    'import_logs' => 'integration',
    'tamsoft_settings' => 'integration',
    'tamsoft_tokens' => 'integration',
    'tamsoft_sync_logs' => 'integration',
    'tamsoft_depo_mapping' => 'integration',
    'product_hal_data' => 'integration',
    'product_branch_hal_overrides' => 'integration',
    'hal_distribution_logs' => 'integration',

    'audit_logs' => 'audit',
    'notifications' => 'audit',
    'notification_recipients' => 'audit',
    'notification_settings' => 'audit',
    'user_notification_preferences' => 'audit',

    'settings_backup' => 'legacy',
];

$textPkTables = [
    'label_sizes',
    'web_template_widgets',
    'render_priority_weights',
    'render_retry_policies',
    'integration_settings',
    'license_plans',
    'settings',
    'menu_items',
    'hanshow_settings',
];
$textPkTables = array_flip($textPkTables);

$intPkTables = [
    'stream_access_logs' => 'bigint_identity',
    'hanshow_firmwares' => 'integer',
    'migrations' => 'bigint_identity',
];

$timeColumnNames = array_flip([
    'created_at', 'updated_at', 'expires_at', 'last_sync', 'last_online', 'last_seen',
    'last_heartbeat', 'last_request_at', 'last_stream_request_at', 'started_at',
    'completed_at', 'sent_at', 'approved_at', 'released_at', 'read_at', 'granted_at',
    'executed_at', 'window_start', 'changed_at', 'last_used_at', 'revoked_at',
    'price_updated_at', 'previous_price_updated_at', 'price_valid_from', 'price_valid_until',
    'valid_from', 'valid_until', 'campaign_start', 'campaign_end', 'token_expires_at',
    'sync_code_expires_at', 'password_reset_expires', 'last_sync_at', 'last_calculated_at',
    'processed_at', 'archived_at', 'scheduled_at', 'next_retry_at', 'started_processing_at',
    'last_error_at', 'last_success_at', 'published_at', 'deleted_at', 'last_login'
]);

$moduleBuffers = [];
foreach ($moduleFiles as $module => $fileName) {
    $moduleBuffers[$module] = [];
    $moduleBuffers[$module][] = '-- Auto-generated from database/omnex.db on ' . date('Y-m-d H:i:s');
    $moduleBuffers[$module][] = '-- Module: ' . $module;
    $moduleBuffers[$module][] = '';
}

$indexBuffer = [];
$indexBuffer[] = '-- Auto-generated indexes from SQLite metadata';
$indexBuffer[] = '-- Review and tune manually with EXPLAIN ANALYZE after migration.';
$indexBuffer[] = '';

$constraintBuffer = [];
$constraintBuffer[] = '-- Foreign key constraints generated from SQLite metadata';
$constraintBuffer[] = '-- Applied after all tables are created to avoid dependency ordering issues.';
$constraintBuffer[] = '';

$rlsBuffer = [];
$rlsBuffer[] = '-- Suggested RLS policies for company-bound UUID tables';
$rlsBuffer[] = '-- Apply after application sets app.company_id and app.role session vars.';
$rlsBuffer[] = '';

$tables = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);

$tableMeta = [];

foreach ($tables as $table) {
    $module = $tableToModule[$table] ?? 'legacy';
    if (!isset($moduleFiles[$module])) {
        $module = 'legacy';
    }

    $columns = $db->query('PRAGMA table_info(' . qIdent($table) . ')')->fetchAll();
    $fksRaw = $db->query('PRAGMA foreign_key_list(' . qIdent($table) . ')')->fetchAll();
    $indexes = $db->query('PRAGMA index_list(' . qIdent($table) . ')')->fetchAll();

    $pkColumns = [];
    foreach ($columns as $col) {
        if ((int)$col['pk'] > 0) {
            $pkColumns[(int)$col['pk']] = $col['name'];
        }
    }
    ksort($pkColumns);
    $pkColumns = array_values($pkColumns);

    $pkTypeMode = null;
    if (isset($intPkTables[$table])) {
        $pkTypeMode = $intPkTables[$table];
    } elseif (!empty($pkColumns)) {
        $pkCol = $pkColumns[0];
        if ($pkCol === 'id' && !isset($textPkTables[$table])) {
            $pkTypeMode = 'uuid';
        } elseif (isset($textPkTables[$table])) {
            $pkTypeMode = 'text';
        }
    }

    $tableMeta[$table] = [
        'module' => $module,
        'columns' => $columns,
        'fks' => $fksRaw,
        'indexes' => $indexes,
        'pk_columns' => $pkColumns,
        'pk_mode' => $pkTypeMode,
    ];
}

$pkTypeByTable = [];
foreach ($tableMeta as $table => $meta) {
    $mode = $meta['pk_mode'];
    if ($mode === 'uuid') {
        $pkTypeByTable[$table] = 'uuid';
    } elseif ($mode === 'text') {
        $pkTypeByTable[$table] = 'text';
    } elseif ($mode === 'bigint_identity') {
        $pkTypeByTable[$table] = 'bigint';
    } elseif ($mode === 'integer') {
        $pkTypeByTable[$table] = 'integer';
    } else {
        if (!empty($meta['pk_columns'])) {
            $pkColName = $meta['pk_columns'][0];
            $declType = '';
            foreach ($meta['columns'] as $c) {
                if ($c['name'] === $pkColName) {
                    $declType = strtoupper((string)$c['type']);
                    break;
                }
            }
            if (str_contains($declType, 'INT')) {
                $pkTypeByTable[$table] = 'integer';
            } else {
                $pkTypeByTable[$table] = 'text';
            }
        }
    }
}

$fkTypeHints = [];
foreach ($tableMeta as $table => $meta) {
    foreach ($meta['fks'] as $fk) {
        $from = $fk['from'];
        $refTable = $fk['table'];
        $fkTypeHints[$table][$from] = $pkTypeByTable[$refTable] ?? 'text';
    }
}

$seenIndexNames = [];

foreach ($tables as $table) {
    $meta = $tableMeta[$table];
    $module = $meta['module'];
    $schema = $module;

    $moduleBuffers[$module][] = '-- Table: ' . $table;

    $columnLines = [];
    $pkColumns = $meta['pk_columns'];
    $pkMode = $meta['pk_mode'];

    foreach ($meta['columns'] as $col) {
        $colName = (string)$col['name'];
        $declType = strtoupper(trim((string)$col['type']));
        $isPk = ((int)$col['pk'] > 0);
        $isNotNull = ((int)$col['notnull'] === 1);
        $defaultRaw = $col['dflt_value'];

        $pgType = inferPgType(
            $table,
            $colName,
            $declType,
            $isPk,
            $pkMode,
            $fkTypeHints[$table][$colName] ?? null,
            $timeColumnNames
        );

        $parts = [qIdent($colName) . ' ' . $pgType];

        $defaultSql = mapDefault($defaultRaw, $pgType, $isPk, $pkMode, $colName);
        if ($defaultSql !== null) {
            $parts[] = 'DEFAULT ' . $defaultSql;
        }

        if ($isNotNull || $isPk) {
            $parts[] = 'NOT NULL';
        }

        $columnLines[] = '  ' . implode(' ', $parts);
    }

    $constraintLines = [];

    if (!empty($pkColumns)) {
        $pkName = makeName('pk_' . $table);
        $pkColsSql = implode(', ', array_map('qIdent', $pkColumns));
        $constraintLines[] = '  CONSTRAINT ' . qIdent($pkName) . ' PRIMARY KEY (' . $pkColsSql . ')';
    }

    $fkGroups = [];
    foreach ($meta['fks'] as $fk) {
        $fkId = (int)$fk['id'];
        if (!isset($fkGroups[$fkId])) {
            $fkGroups[$fkId] = [
                'table' => $fk['table'],
                'on_update' => strtoupper((string)$fk['on_update']),
                'on_delete' => strtoupper((string)$fk['on_delete']),
                'from' => [],
                'to' => [],
            ];
        }
        $fkGroups[$fkId]['from'][(int)$fk['seq']] = $fk['from'];
        $fkGroups[$fkId]['to'][(int)$fk['seq']] = $fk['to'];
    }

    foreach ($fkGroups as $fkGroup) {
        ksort($fkGroup['from']);
        ksort($fkGroup['to']);
        $fromCols = array_values($fkGroup['from']);
        $toCols = array_values($fkGroup['to']);

        $refTable = (string)$fkGroup['table'];
        $refModule = $tableToModule[$refTable] ?? 'legacy';
        $refSchema = $refModule;

        $fkName = makeName('fk_' . $table . '_' . implode('_', $fromCols) . '_' . $refTable);
        $onUpdate = mapAction($fkGroup['on_update']);
        $onDelete = mapAction($fkGroup['on_delete']);

        $constraintBuffer[] = 'ALTER TABLE ' . qIdent($schema) . '.' . qIdent($table);
        $constraintBuffer[] = '  ADD CONSTRAINT ' . qIdent($fkName)
            . ' FOREIGN KEY (' . implode(', ', array_map('qIdent', $fromCols)) . ')'
            . ' REFERENCES ' . qIdent($refSchema) . '.' . qIdent($refTable)
            . ' (' . implode(', ', array_map('qIdent', $toCols)) . ')'
            . ' ON UPDATE ' . $onUpdate
            . ' ON DELETE ' . $onDelete . ';';
        $constraintBuffer[] = '';
    }

    $allLines = array_merge($columnLines, $constraintLines);

    $moduleBuffers[$module][] = 'CREATE TABLE IF NOT EXISTS ' . qIdent($schema) . '.' . qIdent($table) . ' (';
    $moduleBuffers[$module][] = implode(",\n", $allLines);
    $moduleBuffers[$module][] = ');';
    $moduleBuffers[$module][] = '';

    $hasCompanyId = false;
    $companyIdType = null;
    foreach ($meta['columns'] as $col) {
        if ($col['name'] === 'company_id') {
            $hasCompanyId = true;
            $companyIdType = inferPgType(
                $table,
                'company_id',
                strtoupper(trim((string)$col['type'])),
                false,
                $pkMode,
                $fkTypeHints[$table]['company_id'] ?? null,
                $timeColumnNames
            );
            break;
        }
    }

    if ($hasCompanyId && $companyIdType === 'uuid') {
        $policyName = makeName('p_' . $table . '_company_isolation');
        $rlsBuffer[] = 'ALTER TABLE ' . qIdent($schema) . '.' . qIdent($table) . ' ENABLE ROW LEVEL SECURITY;';
        $rlsBuffer[] = 'DROP POLICY IF EXISTS ' . qIdent($policyName) . ' ON ' . qIdent($schema) . '.' . qIdent($table) . ';';
        $rlsBuffer[] = 'CREATE POLICY ' . qIdent($policyName) . ' ON ' . qIdent($schema) . '.' . qIdent($table);
        $rlsBuffer[] = '  USING (';
        $rlsBuffer[] = "    current_setting('app.role', true) = 'SuperAdmin'";
        $rlsBuffer[] = "    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid";
        $rlsBuffer[] = '  );';
        $rlsBuffer[] = '';
    }

    foreach ($meta['indexes'] as $idx) {
        $idxName = (string)$idx['name'];
        $isUnique = ((int)$idx['unique'] === 1);
        $origin = $idx['origin'] ?? '';

        if ($origin === 'pk') {
            continue;
        }

        $idxCols = $db->query('PRAGMA index_info(' . qIdent($idxName) . ')')->fetchAll();
        if (empty($idxCols)) {
            continue;
        }

        usort($idxCols, static fn(array $a, array $b): int => ((int)$a['seqno']) <=> ((int)$b['seqno']));
        $colSql = implode(', ', array_map(static fn(array $x): string => qIdent((string)$x['name']), $idxCols));

        $pgIndexName = $idxName;
        if (str_starts_with($idxName, 'sqlite_autoindex_')) {
            $base = ($isUnique ? 'uq_' : 'ix_') . $table . '_' . implode('_', array_map(static fn(array $x): string => (string)$x['name'], $idxCols));
            $pgIndexName = makeName($base);
        }

        $seenKey = $schema . '.' . $pgIndexName;
        if (isset($seenIndexNames[$seenKey])) {
            continue;
        }
        $seenIndexNames[$seenKey] = true;

        $idxSqlRow = $db->query('SELECT sql FROM sqlite_master WHERE type = \'index\' AND name = ' . $db->quote($idxName))->fetch();
        $whereClause = '';
        if (!empty($idxSqlRow['sql']) && stripos((string)$idxSqlRow['sql'], ' WHERE ') !== false) {
            $parts = preg_split('/\s+WHERE\s+/i', (string)$idxSqlRow['sql'], 2);
            if (isset($parts[1])) {
                $whereClause = ' WHERE ' . trim($parts[1]);
            }
        }

        $indexBuffer[] = 'CREATE ' . ($isUnique ? 'UNIQUE ' : '') . 'INDEX IF NOT EXISTS '
            . qIdent($pgIndexName)
            . ' ON ' . qIdent($schema) . '.' . qIdent($table)
            . ' (' . $colSql . ')' . $whereClause . ';';
    }
}

writeFile($outDir . DIRECTORY_SEPARATOR . '00_extensions.sql', [
    '-- PostgreSQL extensions',
    'CREATE EXTENSION IF NOT EXISTS pgcrypto;',
    'CREATE EXTENSION IF NOT EXISTS citext;',
    'CREATE EXTENSION IF NOT EXISTS pg_trgm;',
    ''
]);

$schemaLines = ['-- Schemas'];
foreach (array_keys($moduleFiles) as $schema) {
    $schemaLines[] = 'CREATE SCHEMA IF NOT EXISTS ' . qIdent($schema) . ';';
}
$schemaLines[] = '';
writeFile($outDir . DIRECTORY_SEPARATOR . '01_schemas.sql', $schemaLines);

foreach ($moduleFiles as $module => $fileName) {
    writeFile($outDir . DIRECTORY_SEPARATOR . $fileName, $moduleBuffers[$module]);
}

writeFile($outDir . DIRECTORY_SEPARATOR . '30_constraints.sql', $constraintBuffer);

$indexHeader = array_slice($indexBuffer, 0, 3);
$indexStatements = array_slice($indexBuffer, 3);
sort($indexStatements);
$indexBuffer = array_merge($indexHeader, $indexStatements);
writeFile($outDir . DIRECTORY_SEPARATOR . '40_indexes.sql', $indexBuffer);
writeFile($outDir . DIRECTORY_SEPARATOR . '70_rls.sql', $rlsBuffer);

$readme = [];
$readme[] = '# PostgreSQL V2 Moduler Sema';
$readme[] = '';
$readme[] = '- Kaynak: `database/omnex.db` canli semasi';
$readme[] = '- Uretim scripti: `tools/postgresql/generate_modular_schema.php`';
$readme[] = '- Uretim tarihi: ' . date('Y-m-d H:i:s');
$readme[] = '';
$readme[] = '## Uygulama Sirasi';
$readme[] = '1. `00_extensions.sql`';
$readme[] = '2. `01_schemas.sql`';
$readme[] = '3. `10_core.sql`';
$readme[] = '4. `11_license.sql`';
$readme[] = '5. `12_catalog.sql`';
$readme[] = '6. `13_branch.sql`';
$readme[] = '7. `14_labels.sql`';
$readme[] = '8. `15_media.sql`';
$readme[] = '9. `16_devices.sql`';
$readme[] = '10. `17_signage.sql`';
$readme[] = '11. `18_integration.sql`';
$readme[] = '12. `19_audit.sql`';
$readme[] = '13. `20_legacy.sql`';
$readme[] = '14. `30_constraints.sql`';
$readme[] = '15. `40_indexes.sql`';
$readme[] = '16. `70_rls.sql`';
$readme[] = '';
$readme[] = '## Notlar';
$readme[] = '- Bu cikti baseline uretimdir; kritik tablolar icin manuel constraint/type review gerekir.';
$readme[] = '- `products.id` icinde UUID disi kayit oldugu icin cutover oncesi normalize edilmelidir.';
$readme[] = '- `hanshow_esls.has_led/has_magnet` alanlarindaki bos string degerler boolean migrate oncesi temizlenmelidir.';
$readme[] = '';
writeFile($outDir . DIRECTORY_SEPARATOR . 'README.md', $readme);

echo "Generated modular PostgreSQL schema in: $outDir\n";

function writeFile(string $path, array $lines): void
{
    file_put_contents($path, implode(PHP_EOL, $lines) . PHP_EOL);
}

function qIdent(string $identifier): string
{
    return '"' . str_replace('"', '""', $identifier) . '"';
}

function makeName(string $name): string
{
    $normalized = preg_replace('/[^a-zA-Z0-9_]+/', '_', strtolower($name));
    $normalized = trim($normalized ?? '', '_');
    if ($normalized === '') {
        $normalized = 'obj';
    }

    if (strlen($normalized) <= 63) {
        return $normalized;
    }

    $hash = substr(sha1($normalized), 0, 8);
    return substr($normalized, 0, 54) . '_' . $hash;
}

function isBooleanLike(string $column): bool
{
    $column = strtolower($column);

    if (preg_match('/^(is_|has_|can_|allow_)/', $column) === 1) {
        return true;
    }

    $exact = [
        'enabled', 'visible', 'muted', 'auto_retry', 'heartbeat', 'mpd',
        'freezer', 'price_override', 'stream_mode', 'touch_support', 'use_tls',
        'single_barcode', 'only_stock_positive', 'only_ecommerce', 'is_unlimited',
        'is_featured', 'is_default', 'is_active', 'is_public', 'is_forked', 'is_demo'
    ];

    return in_array($column, $exact, true);
}

function isTimeLike(string $column, array $timeColumnNames): bool
{
    $column = strtolower($column);
    if (isset($timeColumnNames[$column])) {
        return true;
    }

    return preg_match('/(_at|_date|_from|_until)$/', $column) === 1;
}

function inferPgType(
    string $table,
    string $column,
    string $declType,
    bool $isPk,
    ?string $pkMode,
    ?string $fkTypeHint,
    array $timeColumnNames
): string {
    if ($isPk && $pkMode !== null) {
        return match ($pkMode) {
            'uuid' => 'uuid',
            'text' => 'text',
            'bigint_identity' => 'bigint generated always as identity',
            'integer' => 'integer',
            default => 'text',
        };
    }

    if ($fkTypeHint !== null) {
        return $fkTypeHint;
    }

    if (isTimeLike($column, $timeColumnNames)) {
        return 'timestamptz';
    }

    if (isBooleanLike($column)) {
        return 'boolean';
    }

    if ($declType === '') {
        if ($column === 'id' && !in_array($table, ['label_sizes', 'web_template_widgets', 'render_priority_weights', 'render_retry_policies', 'integration_settings', 'license_plans', 'settings', 'menu_items', 'hanshow_settings'], true)) {
            return 'uuid';
        }
        return 'text';
    }

    if (str_contains($declType, 'INT')) {
        return 'integer';
    }

    if (str_contains($declType, 'REAL') || str_contains($declType, 'FLOA') || str_contains($declType, 'DOUB')) {
        return 'double precision';
    }

    if (str_contains($declType, 'NUMERIC') || str_contains($declType, 'DECIMAL')) {
        return 'numeric';
    }

    if (str_contains($declType, 'BLOB')) {
        return 'bytea';
    }

    if (str_contains($declType, 'BOOL')) {
        return 'boolean';
    }

    return 'text';
}

function mapDefault(mixed $raw, string $pgType, bool $isPk, ?string $pkMode, string $column): ?string
{
    if ($raw === null || $raw === '') {
        if ($isPk && $pkMode === 'uuid') {
            return 'gen_random_uuid()';
        }
        return null;
    }

    $value = trim((string)$raw);
    while (str_starts_with($value, '(') && str_ends_with($value, ')')) {
        $value = trim(substr($value, 1, -1));
    }

    $upper = strtoupper($value);

    if ($upper === 'NULL') {
        return null;
    }

    if (stripos($value, "datetime('now')") !== false || stripos($value, 'CURRENT_TIMESTAMP') !== false) {
        return 'now()';
    }

    if ($pgType === 'boolean') {
        $unquoted = trim($value, "'\"");
        if ($unquoted === '1') {
            return 'true';
        }
        if ($unquoted === '0') {
            return 'false';
        }
        if ($unquoted === '') {
            return null;
        }
    }

    if (preg_match('/^-?\d+(\.\d+)?$/', $value) === 1) {
        return $value;
    }

    if (preg_match('/^".*"$/s', $value) === 1) {
        $inner = substr($value, 1, -1);
        return "'" . str_replace("'", "''", $inner) . "'";
    }

    if (preg_match('/^\'.*\'$/s', $value) === 1) {
        return $value;
    }

    return "'" . str_replace("'", "''", $value) . "'";
}

function mapAction(string $action): string
{
    $action = strtoupper(trim($action));
    return match ($action) {
        'CASCADE' => 'CASCADE',
        'SET NULL' => 'SET NULL',
        'SET DEFAULT' => 'SET DEFAULT',
        'RESTRICT' => 'RESTRICT',
        default => 'NO ACTION',
    };
}
