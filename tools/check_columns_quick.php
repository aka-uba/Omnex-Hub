<?php
require_once __DIR__ . '/../config.php';
$db = Database::getInstance();

// licenses tablosu kolonları
echo "=== licenses ===\n";
$cols = $db->fetchAll("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'licenses' ORDER BY ordinal_position");
foreach ($cols as $c) echo "  {$c['column_name']} ({$c['data_type']})\n";

// devices tablosu kolonları
echo "\n=== devices ===\n";
$cols = $db->fetchAll("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'devices' ORDER BY ordinal_position");
foreach ($cols as $c) echo "  {$c['column_name']} ({$c['data_type']})\n";

// device_commands tablosu kolonları
echo "\n=== device_commands ===\n";
$cols = $db->fetchAll("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'device_commands' ORDER BY ordinal_position");
foreach ($cols as $c) echo "  {$c['column_name']} ({$c['data_type']})\n";

// device_logs tablosu kolonları
echo "\n=== device_logs ===\n";
$cols = $db->fetchAll("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'device_logs' ORDER BY ordinal_position");
foreach ($cols as $c) echo "  {$c['column_name']} ({$c['data_type']})\n";

// schedules tablosu kolonları
echo "\n=== schedules ===\n";
$cols = $db->fetchAll("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'schedules' ORDER BY ordinal_position");
foreach ($cols as $c) echo "  {$c['column_name']} ({$c['data_type']})\n";

// render_queue tablosu kolonları
echo "\n=== render_queue ===\n";
$cols = $db->fetchAll("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'render_queue' ORDER BY ordinal_position");
foreach ($cols as $c) echo "  {$c['column_name']} ({$c['data_type']})\n";

// audit_logs tablosu kolonları
echo "\n=== audit_logs ===\n";
$cols = $db->fetchAll("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_logs' ORDER BY ordinal_position");
foreach ($cols as $c) echo "  {$c['column_name']} ({$c['data_type']})\n";

// notification_recipients tablosu kolonları
echo "\n=== notification_recipients ===\n";
$cols = $db->fetchAll("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notification_recipients' ORDER BY ordinal_position");
foreach ($cols as $c) echo "  {$c['column_name']} ({$c['data_type']})\n";

// device_content_assignments tablosu kolonları
echo "\n=== device_content_assignments ===\n";
$cols = $db->fetchAll("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'device_content_assignments' ORDER BY ordinal_position");
foreach ($cols as $c) echo "  {$c['column_name']} ({$c['data_type']})\n";
