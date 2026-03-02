<?php

declare(strict_types=1);

/**
 * Compare SQLite backup schema with live PostgreSQL schema.
 *
 * Usage:
 *   php tools/postgresql/compare_sqlite_pg_schema.php
 *   php tools/postgresql/compare_sqlite_pg_schema.php --backup=backup/.../database/omnex.db --out=docs/POSTGRESQL_SCHEMA_DIFF_2026-02-26.md
 */

function parseArgs(array $argv): array
{
    $args = [
        'backup' => 'backup/market-etiket-sistemi-26022026-postgresql-oncesi/database/omnex.db',
        'env' => '.env.local',
        'out' => '',
    ];

    foreach ($argv as $arg) {
        if (!str_starts_with($arg, '--')) {
            continue;
        }
        $parts = explode('=', substr($arg, 2), 2);
        $key = $parts[0] ?? '';
        $value = $parts[1] ?? '';
        if ($key !== '' && array_key_exists($key, $args)) {
            $args[$key] = $value;
        }
    }

    return $args;
}

function parseEnvFile(string $path): array
{
    if (!is_file($path)) {
        throw new RuntimeException("Env file not found: {$path}");
    }

    $values = [];
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
        $key = trim(substr($line, 0, $pos));
        $val = trim(substr($line, $pos + 1));
        $values[$key] = trim($val, "\"'");
    }

    return $values;
}

function normalizePgType(string $dataType, string $udtName): string
{
    $d = strtolower($dataType);
    $u = strtolower($udtName);

    if ($d === 'boolean') {
        return 'boolean';
    }
    if ($d === 'integer' || $d === 'bigint' || $d === 'smallint') {
        return 'integer';
    }
    if (str_contains($d, 'timestamp') || $u === 'timestamp' || $u === 'timestamptz') {
        return 'datetime';
    }
    if ($d === 'date') {
        return 'date';
    }
    if ($d === 'uuid') {
        return 'uuid';
    }
    if ($d === 'json' || $d === 'jsonb') {
        return 'json';
    }
    if ($d === 'numeric' || $d === 'double precision' || $d === 'real' || $d === 'money') {
        return 'decimal';
    }
    if ($d === 'bytea') {
        return 'binary';
    }
    return 'text';
}

function normalizeSqliteType(string $decl): string
{
    $t = strtoupper(trim($decl));
    if ($t === '') {
        return 'text';
    }
    if (str_contains($t, 'BOOL')) {
        return 'boolean';
    }
    if (str_contains($t, 'INT')) {
        return 'integer';
    }
    if (str_contains($t, 'REAL') || str_contains($t, 'FLOA') || str_contains($t, 'DOUB') || str_contains($t, 'NUMERIC') || str_contains($t, 'DECIMAL')) {
        return 'decimal';
    }
    if (str_contains($t, 'DATE') || str_contains($t, 'TIME')) {
        return 'datetime';
    }
    if (str_contains($t, 'JSON')) {
        return 'json';
    }
    if (str_contains($t, 'BLOB')) {
        return 'binary';
    }
    if (str_contains($t, 'UUID')) {
        return 'uuid';
    }
    return 'text';
}

function createPgPdo(array $env): PDO
{
    $host = $env['OMNEX_DB_HOST'] ?? '127.0.0.1';
    $port = $env['OMNEX_DB_PORT'] ?? '5432';
    $name = $env['OMNEX_DB_NAME'] ?? 'market_etiket';
    $user = $env['OMNEX_DB_USER'] ?? 'postgres';
    $pass = $env['OMNEX_DB_PASS'] ?? '';

    $dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s', $host, $port, $name);
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $searchPath = $env['OMNEX_DB_SEARCH_PATH'] ?? '';
    if ($searchPath !== '') {
        $pdo->exec('SET search_path TO ' . $searchPath);
    }

    return $pdo;
}

function getSqliteSchema(PDO $sqlite): array
{
    $tables = $sqlite->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        ->fetchAll(PDO::FETCH_COLUMN);

    $schema = [];
    foreach ($tables as $table) {
        $stmt = $sqlite->query("PRAGMA table_info('" . str_replace("'", "''", (string)$table) . "')");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $cols = [];
        foreach ($rows as $row) {
            $name = (string)($row['name'] ?? '');
            if ($name === '') {
                continue;
            }
            $cols[$name] = [
                'decl' => (string)($row['type'] ?? ''),
                'norm' => normalizeSqliteType((string)($row['type'] ?? '')),
            ];
        }
        $schema[(string)$table] = $cols;
    }

    return $schema;
}

function getPgSchema(PDO $pg): array
{
    $sql = "SELECT table_schema, table_name, column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name, ordinal_position";

    $rows = $pg->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    $schema = [];
    foreach ($rows as $row) {
        $schemaName = (string)$row['table_schema'];
        $table = (string)$row['table_name'];
        $column = (string)$row['column_name'];
        $schema[$schemaName][$table][$column] = [
            'data_type' => (string)$row['data_type'],
            'udt_name' => (string)$row['udt_name'],
            'norm' => normalizePgType((string)$row['data_type'], (string)$row['udt_name']),
        ];
    }
    return $schema;
}

function parseSearchPath(array $env): array
{
    $raw = trim((string)($env['OMNEX_DB_SEARCH_PATH'] ?? ''));
    if ($raw === '') {
        return ['public'];
    }

    $items = array_map(static fn(string $v): string => trim($v), explode(',', $raw));
    $items = array_values(array_filter($items, static fn(string $v): bool => $v !== ''));
    if (!in_array('public', $items, true)) {
        $items[] = 'public';
    }
    return $items;
}

function resolvePgTableSchema(array $pgSchema, string $table, array $schemaPriority): ?string
{
    foreach ($schemaPriority as $schemaName) {
        if (isset($pgSchema[$schemaName][$table])) {
            return $schemaName;
        }
    }
    foreach ($pgSchema as $schemaName => $tables) {
        if (isset($tables[$table])) {
            return (string)$schemaName;
        }
    }
    return null;
}

function buildReport(array $sqliteSchema, array $pgSchema, array $schemaPriority): array
{
    $missingTables = [];
    $missingColumns = [];
    $typeMismatches = [];
    $mappedTables = [];

    foreach ($sqliteSchema as $table => $sqliteCols) {
        $schemaName = resolvePgTableSchema($pgSchema, $table, $schemaPriority);
        if ($schemaName === null) {
            $missingTables[] = $table;
            continue;
        }

        $mappedTables[$table] = $schemaName;
        $pgCols = $pgSchema[$schemaName][$table] ?? [];

        foreach ($sqliteCols as $col => $sqliteMeta) {
            if (!isset($pgCols[$col])) {
                $missingColumns[] = [
                    'table' => $table,
                    'schema' => $schemaName,
                    'column' => $col,
                    'sqlite_decl' => $sqliteMeta['decl'],
                ];
                continue;
            }

            $sqliteNorm = $sqliteMeta['norm'];
            $pgNorm = $pgCols[$col]['norm'];
            if ($sqliteNorm !== $pgNorm) {
                $pair = $sqliteNorm . '->' . $pgNorm;
                $safePairs = [
                    'integer->boolean',
                    'text->uuid',
                    'datetime->text',
                    'text->datetime',
                    'integer->uuid',
                    'uuid->text',
                ];
                if (in_array($pair, $safePairs, true)) {
                    $typeMismatches[] = [
                        'table' => $table,
                        'schema' => $schemaName,
                        'column' => $col,
                        'sqlite_type' => $sqliteMeta['decl'],
                        'sqlite_norm' => $sqliteNorm,
                        'pg_type' => $pgCols[$col]['data_type'] . '(' . $pgCols[$col]['udt_name'] . ')',
                        'pg_norm' => $pgNorm,
                    ];
                }
            }
        }
    }

    sort($missingTables);
    usort($missingColumns, static function (array $a, array $b): int {
        return [$a['table'], $a['column']] <=> [$b['table'], $b['column']];
    });
    usort($typeMismatches, static function (array $a, array $b): int {
        return [$a['table'], $a['column']] <=> [$b['table'], $b['column']];
    });

    return [
        'missing_tables' => $missingTables,
        'missing_columns' => $missingColumns,
        'type_mismatches' => $typeMismatches,
        'table_count_sqlite' => count($sqliteSchema),
        'table_count_pg_total' => array_sum(array_map(static fn(array $t): int => count($t), $pgSchema)),
        'table_count_mapped' => count($mappedTables),
    ];
}

function renderMarkdown(array $report, string $backupPath, string $envPath): string
{
    $lines = [];
    $lines[] = '# SQLite -> PostgreSQL Canli Sema Fark Raporu';
    $lines[] = '';
    $lines[] = '- Tarih: ' . date('Y-m-d H:i:s');
    $lines[] = '- Kaynak SQLite: `' . $backupPath . '`';
    $lines[] = '- Hedef PostgreSQL env: `' . $envPath . '`';
    $lines[] = '- SQLite tablo sayisi: `' . $report['table_count_sqlite'] . '`';
    $lines[] = '- PostgreSQL tablo sayisi (sistem disi): `' . $report['table_count_pg_total'] . '`';
    $lines[] = '- Eslesen tablo sayisi: `' . $report['table_count_mapped'] . '`';
    $lines[] = '';

    $lines[] = '## Eksik Tablolar (SQLite var, PostgreSQL yok)';
    if (count($report['missing_tables']) === 0) {
        $lines[] = '- Yok';
    } else {
        foreach ($report['missing_tables'] as $table) {
            $lines[] = '- `' . $table . '`';
        }
    }
    $lines[] = '';

    $lines[] = '## Eksik Kolonlar (SQLite var, PostgreSQL tablo icinde yok)';
    if (count($report['missing_columns']) === 0) {
        $lines[] = '- Yok';
    } else {
        foreach ($report['missing_columns'] as $row) {
            $lines[] = '- `' . $row['table'] . '.' . $row['column'] . '` -> schema: `' . $row['schema'] . '`, sqlite type: `' . $row['sqlite_decl'] . '`';
        }
    }
    $lines[] = '';

    $lines[] = '## Riskli Tip Uyumsuzluklari';
    if (count($report['type_mismatches']) === 0) {
        $lines[] = '- Yok';
    } else {
        foreach ($report['type_mismatches'] as $row) {
            $lines[] = '- `' . $row['table'] . '.' . $row['column'] . '` -> sqlite `' . $row['sqlite_type'] . '` (' . $row['sqlite_norm'] . '), pg `' . $row['pg_type'] . '` (' . $row['pg_norm'] . ')';
        }
    }
    $lines[] = '';

    return implode(PHP_EOL, $lines) . PHP_EOL;
}

try {
    $args = parseArgs(array_slice($argv, 1));
    $backupPath = $args['backup'];
    $envPath = $args['env'];
    $outPath = $args['out'];

    if (!is_file($backupPath)) {
        throw new RuntimeException("SQLite backup not found: {$backupPath}");
    }

    $env = parseEnvFile($envPath);
    $sqlite = new PDO('sqlite:' . $backupPath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pg = createPgPdo($env);

    $sqliteSchema = getSqliteSchema($sqlite);
    $pgSchema = getPgSchema($pg);
    $searchPath = parseSearchPath($env);
    $report = buildReport($sqliteSchema, $pgSchema, $searchPath);
    $markdown = renderMarkdown($report, $backupPath, $envPath);

    if ($outPath !== '') {
        $dir = dirname($outPath);
        if (!is_dir($dir) && !mkdir($dir, 0777, true) && !is_dir($dir)) {
            throw new RuntimeException("Cannot create output directory: {$dir}");
        }
        file_put_contents($outPath, $markdown);
        echo "Rapor yazildi: {$outPath}" . PHP_EOL;
    }

    echo $markdown;
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'ERROR: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
