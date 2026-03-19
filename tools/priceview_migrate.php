<?php
/**
 * PriceView Migration Runner
 * Applies 22_priceview.sql to PostgreSQL
 */

require_once __DIR__ . '/../config.php';

$db = Database::getInstance();

if (!$db->isPostgres()) {
    echo "ERROR: PostgreSQL not active. Current driver is not pgsql.\n";
    exit(1);
}

echo "PostgreSQL connection OK\n";

// Check if migration already applied
$migrationName = 'pg:22_priceview';
try {
    $existing = $db->fetch(
        "SELECT id FROM migrations WHERE name = ?",
        [$migrationName]
    );
    if ($existing) {
        echo "Migration '$migrationName' already applied. Skipping.\n";
        exit(0);
    }
} catch (Exception $e) {
    // migrations table might not exist or different schema
    echo "Warning: Could not check migration status: " . $e->getMessage() . "\n";
}

// Read and execute migration SQL
$sqlFile = __DIR__ . '/../database/postgresql/v2/22_priceview.sql';
if (!file_exists($sqlFile)) {
    echo "ERROR: Migration file not found: $sqlFile\n";
    exit(1);
}

$sql = file_get_contents($sqlFile);
echo "Applying migration: 22_priceview.sql\n";

try {
    $pdo = $db->getPdo();
    $pdo->exec($sql);
    echo "Migration applied successfully!\n";

    // Record migration
    try {
        $db->insert('migrations', [
            'name' => $migrationName,
            'applied_at' => date('Y-m-d H:i:s')
        ]);
        echo "Migration recorded in migrations table.\n";
    } catch (Exception $e) {
        echo "Warning: Could not record migration: " . $e->getMessage() . "\n";
    }

    // Verify table exists
    $check = $db->fetch(
        "SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = 'audit' AND table_name = 'product_deletions'"
    );
    echo "Verification: audit.product_deletions exists = " . ($check['cnt'] > 0 ? 'YES' : 'NO') . "\n";

    // Verify index
    $idxCheck = $db->fetch(
        "SELECT COUNT(*) as cnt FROM pg_indexes WHERE indexname = 'idx_product_deletions_company_deleted_at'"
    );
    echo "Verification: index exists = " . ($idxCheck['cnt'] > 0 ? 'YES' : 'NO') . "\n";

    // Verify RLS
    $rlsCheck = $db->fetch(
        "SELECT COUNT(*) as cnt FROM pg_policies WHERE tablename = 'product_deletions'"
    );
    echo "Verification: RLS policy exists = " . ($rlsCheck['cnt'] > 0 ? 'YES' : 'NO') . "\n";

} catch (Exception $e) {
    echo "ERROR: Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\nDone!\n";
