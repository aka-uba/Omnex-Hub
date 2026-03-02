<?php
/**
 * Database Migration Script
 * Run: php database/migrate.php
 */

// Load config
require_once dirname(__DIR__) . '/config.php';
require_once CORE_PATH . '/Logger.php';
require_once CORE_PATH . '/Database.php';

echo "Starting migrations...\n";

try {
    $db = Database::getInstance();
    $db->migrate();
    echo "Migrations completed successfully!\n";
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
