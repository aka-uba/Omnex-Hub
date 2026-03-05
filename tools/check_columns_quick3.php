<?php
require_once __DIR__ . '/../config.php';
$db = Database::getInstance();

$tables = ['hanshow_esls', 'payment_transactions', 'license_plans'];
foreach ($tables as $t) {
    echo "=== $t ===\n";
    $cols = $db->fetchAll("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ? ORDER BY ordinal_position", [$t]);
    if (empty($cols)) { echo "  (table not found)\n"; continue; }
    foreach ($cols as $c) echo "  {$c['column_name']} ({$c['data_type']})\n";
    echo "\n";
}
