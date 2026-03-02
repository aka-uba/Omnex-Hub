<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config.php';
require_once CORE_PATH . '/Database.php';

try {
    $db = Database::getInstance();
    if (!$db->isPostgres()) {
        fwrite(STDERR, "DB driver is '" . $db->getDriver() . "'. Set OMNEX_DB_DRIVER=pgsql.\n");
        exit(2);
    }

    $db->migrate();

    $seedMarker = 'seed:php:all';
    $seedAlreadyApplied = (int)$db->fetchColumn(
        'SELECT COUNT(*) FROM core.migrations WHERE name = ?',
        [$seedMarker]
    ) > 0;

    if (!$seedAlreadyApplied) {
        $db->seed();
        $db->query(
            'INSERT INTO core.migrations (name) VALUES (?) ON CONFLICT (name) DO NOTHING',
            [$seedMarker]
        );
    }

    $companyCount = (int)$db->fetchColumn('SELECT COUNT(*) FROM companies');
    $userCount = (int)$db->fetchColumn('SELECT COUNT(*) FROM users');
    $migrationCount = (int)$db->fetchColumn("SELECT COUNT(*) FROM core.migrations WHERE name LIKE 'pg:%'");

    echo "PostgreSQL migrate+seed OK\n";
    echo json_encode([
        'companies' => $companyCount,
        'users' => $userCount,
        'pg_schema_steps' => $migrationCount,
        'seed_applied' => !$seedAlreadyApplied,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'PostgreSQL migrate+seed FAILED: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
