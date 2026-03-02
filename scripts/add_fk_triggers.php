<?php
/**
 * Add FK validation triggers for licenses.plan_id and payment_transactions.plan_id
 *
 * SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we use triggers.
 * These triggers will be removed when migrating to PostgreSQL (native FK support).
 *
 * Usage: php scripts/add_fk_triggers.php
 */

require_once __DIR__ . '/../config.php';

$db = Database::getInstance()->getPdo();

echo "=== Adding FK Validation Triggers ===\n\n";

// Drop existing triggers first
$dropTriggers = [
    'trg_licenses_plan_id_insert',
    'trg_licenses_plan_id_update',
    'trg_license_plans_delete_check',
    'trg_payment_transactions_plan_id_insert',
    'trg_payment_transactions_plan_id_update'
];

foreach ($dropTriggers as $trigger) {
    try {
        $db->exec("DROP TRIGGER IF EXISTS {$trigger}");
        echo "Dropped trigger (if existed): {$trigger}\n";
    } catch (PDOException $e) {
        echo "Warning: Could not drop {$trigger}: " . $e->getMessage() . "\n";
    }
}

echo "\n";

// Create triggers
$triggers = [
    // Validate plan_id on licenses INSERT
    'trg_licenses_plan_id_insert' => "
        CREATE TRIGGER trg_licenses_plan_id_insert
        BEFORE INSERT ON licenses
        FOR EACH ROW
        WHEN NEW.plan_id IS NOT NULL
        BEGIN
            SELECT RAISE(ABORT, 'FK violation: plan_id does not exist in license_plans')
            WHERE NOT EXISTS (SELECT 1 FROM license_plans WHERE id = NEW.plan_id);
        END
    ",

    // Validate plan_id on licenses UPDATE
    'trg_licenses_plan_id_update' => "
        CREATE TRIGGER trg_licenses_plan_id_update
        BEFORE UPDATE ON licenses
        FOR EACH ROW
        WHEN NEW.plan_id IS NOT NULL AND NEW.plan_id != COALESCE(OLD.plan_id, '')
        BEGIN
            SELECT RAISE(ABORT, 'FK violation: plan_id does not exist in license_plans')
            WHERE NOT EXISTS (SELECT 1 FROM license_plans WHERE id = NEW.plan_id);
        END
    ",

    // Prevent deletion of plan if referenced by active licenses
    'trg_license_plans_delete_check' => "
        CREATE TRIGGER trg_license_plans_delete_check
        BEFORE DELETE ON license_plans
        FOR EACH ROW
        BEGIN
            SELECT RAISE(ABORT, 'FK violation: Cannot delete plan - referenced by active licenses')
            WHERE EXISTS (SELECT 1 FROM licenses WHERE plan_id = OLD.id AND status = 'active');
        END
    ",

    // Validate plan_id on payment_transactions INSERT
    'trg_payment_transactions_plan_id_insert' => "
        CREATE TRIGGER trg_payment_transactions_plan_id_insert
        BEFORE INSERT ON payment_transactions
        FOR EACH ROW
        WHEN NEW.plan_id IS NOT NULL
        BEGIN
            SELECT RAISE(ABORT, 'FK violation: plan_id does not exist in license_plans')
            WHERE NOT EXISTS (SELECT 1 FROM license_plans WHERE id = NEW.plan_id);
        END
    ",

    // Validate plan_id on payment_transactions UPDATE
    'trg_payment_transactions_plan_id_update' => "
        CREATE TRIGGER trg_payment_transactions_plan_id_update
        BEFORE UPDATE ON payment_transactions
        FOR EACH ROW
        WHEN NEW.plan_id IS NOT NULL AND NEW.plan_id != COALESCE(OLD.plan_id, '')
        BEGIN
            SELECT RAISE(ABORT, 'FK violation: plan_id does not exist in license_plans')
            WHERE NOT EXISTS (SELECT 1 FROM license_plans WHERE id = NEW.plan_id);
        END
    "
];

$success = 0;
$failed = 0;

foreach ($triggers as $name => $sql) {
    try {
        $db->exec($sql);
        echo "✓ Created trigger: {$name}\n";
        $success++;
    } catch (PDOException $e) {
        echo "✗ Failed to create {$name}: " . $e->getMessage() . "\n";
        $failed++;
    }
}

echo "\n=== Summary ===\n";
echo "Created: {$success}\n";
echo "Failed: {$failed}\n";

// Verify triggers exist
echo "\n=== Verification ===\n";
$result = $db->query("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_%' ORDER BY name");
$existingTriggers = $result->fetchAll(PDO::FETCH_COLUMN);

if (count($existingTriggers) > 0) {
    echo "Active FK triggers:\n";
    foreach ($existingTriggers as $t) {
        echo "  - {$t}\n";
    }
} else {
    echo "No FK triggers found.\n";
}

echo "\n=== Test ===\n";

// Test: Try to insert with invalid plan_id
echo "Testing INSERT with invalid plan_id... ";
try {
    $testId = 'test-' . uniqid();
    $db->exec("INSERT INTO licenses (id, company_id, plan_id, status, created_at) VALUES ('{$testId}', 'test-company', 'invalid-plan-id', 'active', datetime('now'))");
    echo "FAILED (should have thrown error)\n";
    // Cleanup
    $db->exec("DELETE FROM licenses WHERE id = '{$testId}'");
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'FK violation') !== false) {
        echo "PASSED (correctly rejected invalid plan_id)\n";
    } else {
        echo "FAILED (unexpected error: " . $e->getMessage() . ")\n";
    }
}

echo "\nDone.\n";
