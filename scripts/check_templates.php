<?php
require_once __DIR__ . '/../config.php';

$db = Database::getInstance();
$templates = $db->fetchAll("SELECT name, design_data FROM templates WHERE scope = 'system' ORDER BY created_at DESC LIMIT 6");

foreach ($templates as $t) {
    $data = json_decode($t['design_data'], true);
    $objects = $data['objects'] ?? [];

    $dynamicFields = 0;
    $fieldList = [];
    foreach ($objects as $obj) {
        if (!empty($obj['dynamicField'])) {
            $dynamicFields++;
            $fieldList[] = $obj['dynamicField'];
        }
    }

    echo $t['name'] . ":\n";
    echo "  - Toplam nesne: " . count($objects) . "\n";
    echo "  - Dinamik alan: " . $dynamicFields . "\n";
    echo "  - Alanlar: " . implode(', ', array_unique($fieldList)) . "\n\n";
}
