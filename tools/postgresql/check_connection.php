<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config.php';
require_once CORE_PATH . '/Database.php';

try {
    $db = Database::getInstance();
    if (!$db->isPostgres()) {
        fwrite(STDERR, "DB driver is '" . $db->getDriver() . "'. Set OMNEX_DB_DRIVER=pgsql first.\n");
        exit(2);
    }

    $info = $db->fetch(
        "SELECT
            version() AS version,
            current_database() AS database_name,
            current_user AS db_user,
            current_schema() AS current_schema,
            current_setting('search_path') AS search_path,
            inet_server_addr()::text AS server_addr,
            inet_server_port() AS server_port"
    );

    echo "PostgreSQL connection OK\n";
    echo json_encode($info, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, 'PostgreSQL connection FAILED: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
