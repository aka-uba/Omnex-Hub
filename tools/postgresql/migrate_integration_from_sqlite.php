<?php

declare(strict_types=1);

/**
 * Migrate integration-module data from SQLite backup to PostgreSQL.
 *
 * Examples:
 *   php tools/postgresql/migrate_integration_from_sqlite.php
 *   php tools/postgresql/migrate_integration_from_sqlite.php --dry-run=1
 *   php tools/postgresql/migrate_integration_from_sqlite.php --backup=backup/.../database/omnex.db --mode=replace
 */

function parseArgs(array $argv): array
{
    $args = [
        'backup' => 'backup/market-etiket-sistemi-26022026-postgresql-oncesi/database/omnex.db',
        'env' => '.env.local',
        'mode' => 'upsert', // upsert|replace
        'dry-run' => '0',
    ];

    foreach ($argv as $arg) {
        if (!str_starts_with($arg, '--')) {
            continue;
        }
        [$key, $val] = array_pad(explode('=', substr($arg, 2), 2), 2, '');
        if ($key !== '' && array_key_exists($key, $args)) {
            $args[$key] = $val;
        }
    }

    $args['mode'] = strtolower((string)$args['mode']);
    if (!in_array($args['mode'], ['upsert', 'replace'], true)) {
        throw new InvalidArgumentException('Invalid --mode. Use upsert or replace.');
    }
    $args['dry-run'] = in_array(strtolower((string)$args['dry-run']), ['1', 'true', 'yes'], true);

    return $args;
}

function parseEnvFile(string $path): array
{
    if (!is_file($path)) {
        throw new RuntimeException("Env file not found: {$path}");
    }

    $data = [];
    $lines = file($path, FILE_IGNORE_NEW_LINES);
    if ($lines === false) {
        throw new RuntimeException("Cannot read env file: {$path}");
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        $pos = strpos($line, '=');
        if ($pos === false) {
            continue;
        }
        $k = trim(substr($line, 0, $pos));
        $v = trim(substr($line, $pos + 1));
        $data[$k] = trim($v, "\"'");
    }

    return $data;
}

function createPgPdo(array $env): PDO
{
    $host = $env['OMNEX_DB_HOST'] ?? '127.0.0.1';
    $port = $env['OMNEX_DB_PORT'] ?? '5432';
    $name = $env['OMNEX_DB_NAME'] ?? 'market_etiket';
    $user = $env['OMNEX_DB_USER'] ?? 'postgres';
    $pass = $env['OMNEX_DB_PASS'] ?? '';

    $pdo = new PDO(
        sprintf('pgsql:host=%s;port=%s;dbname=%s', $host, $port, $name),
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    $searchPath = trim((string)($env['OMNEX_DB_SEARCH_PATH'] ?? ''));
    if ($searchPath !== '') {
        $pdo->exec('SET search_path TO ' . $searchPath);
    }

    return $pdo;
}

function qIdent(string $name): string
{
    return '"' . str_replace('"', '""', $name) . '"';
}

function getPgTableColumns(PDO $pg, string $schema, string $table): array
{
    $stmt = $pg->prepare(
        'SELECT column_name, data_type, udt_name
         FROM information_schema.columns
         WHERE table_schema = :schema
           AND table_name = :table
         ORDER BY ordinal_position'
    );
    $stmt->execute(['schema' => $schema, 'table' => $table]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $out = [];
    foreach ($rows as $row) {
        $out[(string)$row['column_name']] = [
            'data_type' => strtolower((string)$row['data_type']),
            'udt_name' => strtolower((string)$row['udt_name']),
        ];
    }
    return $out;
}

function getPgPrimaryKey(PDO $pg, string $schema, string $table): array
{
    $stmt = $pg->prepare(
        'SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
          AND tc.table_name = kcu.table_name
         WHERE tc.constraint_type = \'PRIMARY KEY\'
           AND tc.table_schema = :schema
           AND tc.table_name = :table
         ORDER BY kcu.ordinal_position'
    );
    $stmt->execute(['schema' => $schema, 'table' => $table]);
    return array_values(array_map(static fn(array $r): string => (string)$r['column_name'], $stmt->fetchAll(PDO::FETCH_ASSOC)));
}

function isValidUuid(string $value): bool
{
    return (bool)preg_match(
        '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
        $value
    );
}

function deterministicUuid(string $seed): string
{
    $hex = md5($seed);
    return sprintf(
        '%s-%s-4%s-a%s-%s',
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 13, 3),
        substr($hex, 17, 3),
        substr($hex, 20, 12)
    );
}

function normalizeTimestamp(mixed $value): ?string
{
    if ($value === null) {
        return null;
    }

    if (is_int($value) || is_float($value)) {
        $raw = (string)(int)$value;
    } else {
        $raw = trim((string)$value);
    }

    if ($raw === '') {
        return null;
    }

    if (preg_match('/^\d+$/', $raw) === 1) {
        $num = (int)$raw;
        if (strlen($raw) >= 13) {
            $num = (int)floor($num / 1000);
        }
        if ($num <= 0) {
            return null;
        }
        return gmdate('Y-m-d H:i:s', $num);
    }

    try {
        $dt = new DateTimeImmutable($raw);
        return $dt->format('Y-m-d H:i:sP');
    } catch (Throwable) {
        return null;
    }
}

function normalizeValue(mixed $value, array $typeMeta, array &$uuidMap, array &$stats): mixed
{
    $kind = strtolower((string)($typeMeta['data_type'] ?? ''));
    $udt = strtolower((string)($typeMeta['udt_name'] ?? ''));

    if (is_string($value) && trim($value) === '') {
        $value = null;
    }

    if ($kind === 'boolean') {
        if ($value === null) {
            return null;
        }
        if (is_bool($value)) {
            return $value;
        }
        if (is_int($value) || is_float($value)) {
            return ((int)$value) !== 0;
        }
        $v = strtolower(trim((string)$value));
        if (in_array($v, ['1', 't', 'true', 'yes', 'on'], true)) {
            return true;
        }
        if (in_array($v, ['0', 'f', 'false', 'no', 'off'], true)) {
            return false;
        }
        return null;
    }

    if ($kind === 'uuid' || $udt === 'uuid') {
        if ($value === null) {
            return null;
        }
        $raw = strtolower(trim((string)$value, "{} \t\n\r\0\x0B"));
        if ($raw === '') {
            return null;
        }
        if (isValidUuid($raw)) {
            return $raw;
        }
        if (!isset($uuidMap[$raw])) {
            $uuidMap[$raw] = deterministicUuid($raw);
            $stats['uuid_converted']++;
        }
        return $uuidMap[$raw];
    }

    if (in_array($kind, ['smallint', 'integer', 'bigint'], true)) {
        if ($value === null || $value === '') {
            return null;
        }
        return is_numeric($value) ? (int)$value : null;
    }

    if (in_array($kind, ['numeric', 'decimal', 'real', 'double precision'], true)) {
        if ($value === null || $value === '') {
            return null;
        }
        return is_numeric($value) ? (float)$value : null;
    }

    if (str_contains($kind, 'timestamp') || $kind === 'date' || $udt === 'timestamp' || $udt === 'timestamptz') {
        $ts = normalizeTimestamp($value);
        if ($value !== null && $ts === null) {
            $stats['datetime_nullified']++;
        }
        return $ts;
    }

    return $value;
}

function tableExistsSqlite(PDO $sqlite, string $table): bool
{
    $stmt = $sqlite->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=:name");
    $stmt->execute(['name' => $table]);
    return $stmt->fetchColumn() !== false;
}

function fetchSqliteTableRows(PDO $sqlite, string $table): array
{
    $stmt = $sqlite->query('SELECT * FROM "' . str_replace('"', '""', $table) . '"');
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function fetchSqliteRowsByIds(PDO $sqlite, string $table, string $idColumn, array $ids): array
{
    $ids = array_values(array_unique(array_filter($ids, static fn(string $v): bool => trim($v) !== '')));
    if (count($ids) === 0) {
        return [];
    }

    $all = [];
    $chunks = array_chunk($ids, 500);
    foreach ($chunks as $chunk) {
        $ph = implode(',', array_fill(0, count($chunk), '?'));
        $sql = 'SELECT * FROM "' . str_replace('"', '""', $table) . '" WHERE "' . str_replace('"', '""', $idColumn) . '" IN (' . $ph . ')';
        $stmt = $sqlite->prepare($sql);
        $stmt->execute($chunk);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            $all[] = $row;
        }
    }

    return $all;
}

function countPg(PDO $pg, string $schema, string $table): int
{
    return (int)$pg->query('SELECT COUNT(*) FROM ' . qIdent($schema) . '.' . qIdent($table))->fetchColumn();
}

function fetchPgIdSet(PDO $pg, string $schema, string $table): array
{
    $rows = $pg->query('SELECT id FROM ' . qIdent($schema) . '.' . qIdent($table))->fetchAll(PDO::FETCH_COLUMN);
    $set = [];
    foreach ($rows as $id) {
        $k = strtolower(trim((string)$id));
        if ($k !== '') {
            $set[$k] = true;
        }
    }
    return $set;
}

function fetchPgCompanySlugMap(PDO $pg): array
{
    $rows = $pg->query('SELECT id, slug FROM "core"."companies"')->fetchAll(PDO::FETCH_ASSOC);
    $map = [];
    foreach ($rows as $row) {
        $slug = strtolower(trim((string)($row['slug'] ?? '')));
        $id = strtolower(trim((string)($row['id'] ?? '')));
        if ($slug !== '' && $id !== '') {
            $map[$slug] = $id;
        }
    }
    return $map;
}

function buildUpsertSql(string $schema, string $table, array $columns, array $pk): string
{
    $colsSql = implode(', ', array_map('qIdent', $columns));
    $ph = implode(', ', array_fill(0, count($columns), '?'));
    $sql = 'INSERT INTO ' . qIdent($schema) . '.' . qIdent($table) . ' (' . $colsSql . ') VALUES (' . $ph . ')';

    if (count($pk) > 0) {
        $pkSql = implode(', ', array_map('qIdent', $pk));
        $updates = [];
        foreach ($columns as $c) {
            if (in_array($c, $pk, true)) {
                continue;
            }
            $updates[] = qIdent($c) . ' = EXCLUDED.' . qIdent($c);
        }
        $sql .= count($updates) > 0
            ? ' ON CONFLICT (' . $pkSql . ') DO UPDATE SET ' . implode(', ', $updates)
            : ' ON CONFLICT (' . $pkSql . ') DO NOTHING';
    }

    return $sql;
}

function upsertRows(
    PDO $pg,
    string $schema,
    string $table,
    array $rows,
    array &$uuidMap,
    array &$stats,
    bool $dryRun,
    ?callable $rowMutator = null,
    ?callable $rowValidator = null
): array {
    if (count($rows) === 0) {
        return ['source' => 0, 'processed' => 0, 'skipped' => 0];
    }

    $pgColsMeta = getPgTableColumns($pg, $schema, $table);
    $pgCols = array_keys($pgColsMeta);
    $pk = getPgPrimaryKey($pg, $schema, $table);
    $sourceCols = array_keys($rows[0]);
    $columns = array_values(array_filter($pgCols, static fn(string $c): bool => in_array($c, $sourceCols, true)));

    foreach ($pk as $pkCol) {
        if (!in_array($pkCol, $columns, true)) {
            throw new RuntimeException("Cannot upsert {$schema}.{$table}: source row does not include PK column {$pkCol}.");
        }
    }

    $sql = buildUpsertSql($schema, $table, $columns, $pk);
    $stmt = $pg->prepare($sql);

    $processed = 0;
    $skipped = 0;
    foreach ($rows as $row) {
        if ($rowMutator !== null) {
            $row = $rowMutator($row);
            if (!is_array($row)) {
                $skipped++;
                continue;
            }
        }
        if ($rowValidator !== null && $rowValidator($row) !== true) {
            $skipped++;
            continue;
        }

        $params = [];
        foreach ($columns as $col) {
            $val = normalizeValue($row[$col] ?? null, $pgColsMeta[$col], $uuidMap, $stats);
            if (($pgColsMeta[$col]['data_type'] ?? '') === 'boolean' && $val === '') {
                $val = null;
            }
            $params[] = $val;
        }

        if (!$dryRun) {
            $stmt->execute($params);
        }
        $processed++;
    }

    return ['source' => count($rows), 'processed' => $processed, 'skipped' => $skipped];
}

function collectReferencedIds(array $integrationRows): array
{
    $companyIds = [];
    $productIds = [];
    $branchIds = [];

    foreach ($integrationRows as $table => $rows) {
        foreach ($rows as $row) {
            if (!empty($row['company_id'])) {
                $companyIds[] = (string)$row['company_id'];
            }
            if (!empty($row['product_id'])) {
                $productIds[] = (string)$row['product_id'];
            }
            if ($table === 'tamsoft_depo_mapping' && !empty($row['branch_id'])) {
                $branchIds[] = (string)$row['branch_id'];
            }
        }
    }

    return [
        'company_ids' => array_values(array_unique($companyIds)),
        'product_ids' => array_values(array_unique($productIds)),
        'branch_ids' => array_values(array_unique($branchIds)),
    ];
}

try {
    $args = parseArgs(array_slice($argv, 1));
    $backupPath = (string)$args['backup'];
    $envPath = (string)$args['env'];
    $mode = (string)$args['mode'];
    $dryRun = (bool)$args['dry-run'];

    if (!is_file($backupPath)) {
        throw new RuntimeException("SQLite backup not found: {$backupPath}");
    }

    $env = parseEnvFile($envPath);
    $sqlite = new PDO('sqlite:' . $backupPath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pg = createPgPdo($env);

    $integrationTables = [
        'integrations',
        'import_mappings',
        'integration_settings',
        'integration_settings_audit',
        'product_hal_data',
        'product_branch_hal_overrides',
        'hal_distribution_logs',
        'tamsoft_settings',
        'tamsoft_tokens',
        'tamsoft_sync_logs',
        'tamsoft_depo_mapping',
    ];

    $before = [];
    foreach ($integrationTables as $table) {
        $before[$table] = countPg($pg, 'integration', $table);
    }

    $integrationRows = [];
    foreach ($integrationTables as $table) {
        $integrationRows[$table] = tableExistsSqlite($sqlite, $table) ? fetchSqliteTableRows($sqlite, $table) : [];
    }

    $refs = collectReferencedIds($integrationRows);
    $productRows = fetchSqliteRowsByIds($sqlite, 'products', 'id', $refs['product_ids']);
    $branchRows = fetchSqliteRowsByIds($sqlite, 'branches', 'id', $refs['branch_ids']);
    foreach ($productRows as $r) {
        if (!empty($r['company_id'])) {
            $refs['company_ids'][] = (string)$r['company_id'];
        }
    }
    foreach ($branchRows as $r) {
        if (!empty($r['company_id'])) {
            $refs['company_ids'][] = (string)$r['company_id'];
        }
    }
    $refs['company_ids'] = array_values(array_unique($refs['company_ids']));
    $companyRows = fetchSqliteRowsByIds($sqlite, 'companies', 'id', $refs['company_ids']);

    $stats = [
        'uuid_converted' => 0,
        'datetime_nullified' => 0,
        'dependencies' => [],
        'tables' => [],
    ];
    $uuidMap = [];
    $companySlugMap = fetchPgCompanySlugMap($pg);

    if (!$dryRun) {
        $pg->beginTransaction();
    }

    $stats['dependencies']['core.companies'] = upsertRows(
        $pg,
        'core',
        'companies',
        $companyRows,
        $uuidMap,
        $stats,
        $dryRun,
        static function (array $row) use (&$companySlugMap): ?array {
            $id = trim((string)($row['id'] ?? ''));
            if ($id === '') {
                return null;
            }
            if (trim((string)($row['name'] ?? '')) === '') {
                $row['name'] = 'Migrated Company ' . substr($id, 0, 8);
            }
            if (trim((string)($row['slug'] ?? '')) === '') {
                $row['slug'] = 'migrated-' . substr($id, 0, 8);
            }
            $slug = strtolower(trim((string)$row['slug']));
            $idLower = strtolower($id);
            if (isset($companySlugMap[$slug]) && $companySlugMap[$slug] !== $idLower) {
                $row['slug'] = trim((string)$row['slug']) . '-migrated-' . substr($id, 0, 8);
                $slug = strtolower(trim((string)$row['slug']));
            }
            $companySlugMap[$slug] = $idLower;
            return $row;
        }
    );

    $stats['dependencies']['catalog.products'] = upsertRows(
        $pg,
        'catalog',
        'products',
        $productRows,
        $uuidMap,
        $stats,
        $dryRun,
        static function (array $row): ?array {
            $id = trim((string)($row['id'] ?? ''));
            if ($id === '' || trim((string)($row['company_id'] ?? '')) === '') {
                return null;
            }
            if (trim((string)($row['sku'] ?? '')) === '') {
                $row['sku'] = 'MIG-' . substr($id, 0, 8);
            }
            if (trim((string)($row['name'] ?? '')) === '') {
                $row['name'] = 'Migrated Product ' . substr($id, 0, 8);
            }
            if (($row['current_price'] ?? null) === null || $row['current_price'] === '') {
                $row['current_price'] = 0;
            }
            return $row;
        }
    );

    $stats['dependencies']['branch.branches'] = upsertRows(
        $pg,
        'branch',
        'branches',
        $branchRows,
        $uuidMap,
        $stats,
        $dryRun,
        static function (array $row): ?array {
            $id = trim((string)($row['id'] ?? ''));
            if ($id === '' || trim((string)($row['company_id'] ?? '')) === '') {
                return null;
            }
            if (trim((string)($row['code'] ?? '')) === '') {
                $row['code'] = 'BR-' . substr($id, 0, 8);
            }
            if (trim((string)($row['name'] ?? '')) === '') {
                $row['name'] = 'Migrated Branch ' . substr($id, 0, 8);
            }
            $row['manager_user_id'] = null;
            $row['parent_id'] = null;
            return $row;
        }
    );

    if ($mode === 'replace' && !$dryRun) {
        for ($i = count($integrationTables) - 1; $i >= 0; $i--) {
            $pg->exec('DELETE FROM "integration".' . qIdent($integrationTables[$i]));
        }
    }

    $known = [
        'companies' => $dryRun ? [] : fetchPgIdSet($pg, 'core', 'companies'),
        'products' => $dryRun ? [] : fetchPgIdSet($pg, 'catalog', 'products'),
        'branches' => $dryRun ? [] : fetchPgIdSet($pg, 'branch', 'branches'),
        'integration_settings' => $dryRun ? [] : fetchPgIdSet($pg, 'integration', 'integration_settings'),
        'product_hal_data' => $dryRun ? [] : fetchPgIdSet($pg, 'integration', 'product_hal_data'),
    ];
    if ($dryRun) {
        foreach ($companyRows as $r) {
            $k = strtolower(trim((string)($r['id'] ?? '')));
            if ($k !== '') {
                $known['companies'][$k] = true;
            }
        }
        foreach ($productRows as $r) {
            $k = strtolower(trim((string)($r['id'] ?? '')));
            if ($k !== '') {
                $known['products'][$k] = true;
            }
        }
        foreach ($branchRows as $r) {
            $k = strtolower(trim((string)($r['id'] ?? '')));
            if ($k !== '') {
                $known['branches'][$k] = true;
            }
        }
    }

    $stats['tables']['integrations'] = upsertRows(
        $pg,
        'integration',
        'integrations',
        $integrationRows['integrations'],
        $uuidMap,
        $stats,
        $dryRun,
        null,
        static fn(array $row): bool => isset($known['companies'][strtolower(trim((string)($row['company_id'] ?? '')))])
    );

    $stats['tables']['import_mappings'] = upsertRows(
        $pg,
        'integration',
        'import_mappings',
        $integrationRows['import_mappings'],
        $uuidMap,
        $stats,
        $dryRun
    );

    $stats['tables']['integration_settings'] = upsertRows(
        $pg,
        'integration',
        'integration_settings',
        $integrationRows['integration_settings'],
        $uuidMap,
        $stats,
        $dryRun
    );
    foreach ($integrationRows['integration_settings'] as $r) {
        $id = strtolower(trim((string)($r['id'] ?? '')));
        if ($id !== '') {
            $known['integration_settings'][$id] = true;
        }
    }

    $stats['tables']['integration_settings_audit'] = upsertRows(
        $pg,
        'integration',
        'integration_settings_audit',
        $integrationRows['integration_settings_audit'],
        $uuidMap,
        $stats,
        $dryRun,
        null,
        static fn(array $row): bool => isset($known['integration_settings'][strtolower(trim((string)($row['integration_settings_id'] ?? '')))])
    );

    $stats['tables']['product_hal_data'] = upsertRows(
        $pg,
        'integration',
        'product_hal_data',
        $integrationRows['product_hal_data'],
        $uuidMap,
        $stats,
        $dryRun,
        null,
        static fn(array $row): bool => isset($known['companies'][strtolower(trim((string)($row['company_id'] ?? '')))])
            && isset($known['products'][strtolower(trim((string)($row['product_id'] ?? '')))])
    );
    foreach ($integrationRows['product_hal_data'] as $r) {
        $id = strtolower(trim((string)($r['id'] ?? '')));
        if ($id !== '') {
            $known['product_hal_data'][$id] = true;
        }
    }

    $stats['tables']['product_branch_hal_overrides'] = upsertRows(
        $pg,
        'integration',
        'product_branch_hal_overrides',
        $integrationRows['product_branch_hal_overrides'],
        $uuidMap,
        $stats,
        $dryRun,
        null,
        static fn(array $row): bool => isset($known['product_hal_data'][strtolower(trim((string)($row['hal_data_id'] ?? '')))])
    );

    $stats['tables']['hal_distribution_logs'] = upsertRows(
        $pg,
        'integration',
        'hal_distribution_logs',
        $integrationRows['hal_distribution_logs'],
        $uuidMap,
        $stats,
        $dryRun,
        null,
        static fn(array $row): bool => isset($known['companies'][strtolower(trim((string)($row['company_id'] ?? '')))])
            && isset($known['products'][strtolower(trim((string)($row['product_id'] ?? '')))])
    );

    $companyValidator = static fn(array $row): bool => isset($known['companies'][strtolower(trim((string)($row['company_id'] ?? '')))]);

    $stats['tables']['tamsoft_settings'] = upsertRows(
        $pg,
        'integration',
        'tamsoft_settings',
        $integrationRows['tamsoft_settings'],
        $uuidMap,
        $stats,
        $dryRun,
        null,
        $companyValidator
    );

    $stats['tables']['tamsoft_tokens'] = upsertRows(
        $pg,
        'integration',
        'tamsoft_tokens',
        $integrationRows['tamsoft_tokens'],
        $uuidMap,
        $stats,
        $dryRun,
        null,
        $companyValidator
    );

    $stats['tables']['tamsoft_sync_logs'] = upsertRows(
        $pg,
        'integration',
        'tamsoft_sync_logs',
        $integrationRows['tamsoft_sync_logs'],
        $uuidMap,
        $stats,
        $dryRun,
        null,
        $companyValidator
    );

    $stats['tables']['tamsoft_depo_mapping'] = upsertRows(
        $pg,
        'integration',
        'tamsoft_depo_mapping',
        $integrationRows['tamsoft_depo_mapping'],
        $uuidMap,
        $stats,
        $dryRun,
        null,
        static fn(array $row): bool => isset($known['companies'][strtolower(trim((string)($row['company_id'] ?? '')))])
            && isset($known['branches'][strtolower(trim((string)($row['branch_id'] ?? '')))])
    );

    if (!$dryRun) {
        $pg->commit();
    }

    $after = [];
    foreach ($integrationTables as $table) {
        $after[$table] = countPg($pg, 'integration', $table);
    }

    $result = [
        'success' => true,
        'dry_run' => $dryRun,
        'mode' => $mode,
        'backup' => $backupPath,
        'env' => $envPath,
        'before' => $before,
        'after' => $after,
        'stats' => $stats,
    ];

    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    if (isset($pg) && $pg instanceof PDO && $pg->inTransaction()) {
        $pg->rollBack();
    }
    fwrite(STDERR, 'ERROR: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
