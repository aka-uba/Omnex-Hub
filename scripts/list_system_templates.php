<?php
require_once __DIR__ . '/../config.php';

$db = Database::getInstance();
$templates = $db->fetchAll("SELECT id, name, scope, company_id FROM templates WHERE scope = 'system' OR company_id IS NULL ORDER BY created_at DESC LIMIT 10");

echo "=== Sistem Şablonları ID Listesi ===\n\n";
foreach ($templates as $t) {
    echo $t['id'] . ' | ' . $t['name'] . ' | scope=' . ($t['scope'] ?? 'NULL') . ' | company=' . ($t['company_id'] ?? 'NULL') . "\n";
}
