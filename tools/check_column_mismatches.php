<?php
/**
 * PostgreSQL Schema vs PHP Code - Targeted Mismatch Scanner v2
 * Sadece gerçek sorunları bulur (false positive minimized)
 */
require dirname(__DIR__) . '/config.php';

$db = Database::getInstance();

echo "╔══════════════════════════════════════════════════════════╗\n";
echo "║  Column Mismatch Scanner v2 - Targeted Analysis        ║\n";
echo "╚══════════════════════════════════════════════════════════╝\n\n";

// 1. Build schema map
$schemaData = $db->fetchAll("
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'public')
    ORDER BY table_name, ordinal_position
");

$tableColumns = [];
$booleanColumns = [];
foreach ($schemaData as $col) {
    $tableColumns[$col['table_name']][] = $col['column_name'];
    if ($col['data_type'] === 'boolean') {
        $booleanColumns[$col['table_name'] . '.' . $col['column_name']] = true;
    }
}

echo "Schema: " . count($tableColumns) . " tables, " . count($booleanColumns) . " boolean columns\n\n";

// 2. Scan
$errors = [];
$warnings = [];

$rootDir = dirname(__DIR__);
$phpFiles = [];
$scanDirs = ['api', 'core', 'services', 'middleware', 'workers', 'cron', 'gateway'];
foreach ($scanDirs as $dir) {
    $fullDir = $rootDir . '/' . $dir;
    if (!is_dir($fullDir)) continue;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($fullDir, RecursiveDirectoryIterator::SKIP_DOTS));
    foreach ($it as $f) {
        if ($f->getExtension() === 'php') $phpFiles[] = $f->getPathname();
    }
}
foreach (glob($rootDir . '/*.php') as $f) $phpFiles[] = $f;

echo "Scanning " . count($phpFiles) . " PHP files...\n\n";

foreach ($phpFiles as $phpFile) {
    $content = file_get_contents($phpFile);
    $relPath = str_replace([$rootDir . '\\', $rootDir . '/'], '', $phpFile);
    $relPath = str_replace('\\', '/', $relPath);
    $lines = explode("\n", $content);

    if (strpos($relPath, 'database/') === 0 || strpos($relPath, 'tools/') === 0) continue;

    foreach ($lines as $lineIdx => $line) {
        $lineNo = $lineIdx + 1;
        $trimLine = trim($line);
        if (preg_match('/^\s*(\/\/|#|\*|\/\*)/', $trimLine)) continue;

        // CHECK 1: Direct SQL SELECT with specific columns
        if (preg_match('/SELECT\s+(?!.*\*)([\w\s,\.]+?)\s+FROM\s+(\w+)/i', $line, $m)) {
            $selectPart = $m[1];
            $tableName = strtolower($m[2]);
            if (!isset($tableColumns[$tableName])) continue;
            if (preg_match('/\(|CASE|JOIN|UNION/i', $selectPart)) continue;
            $rawCols = explode(',', $selectPart);
            foreach ($rawCols as $rawCol) {
                $rawCol = trim($rawCol);
                if (preg_match('/^(?:\w+\.)?(\w+)(?:\s+AS\s+\w+)?$/i', $rawCol, $cm)) {
                    $col = strtolower($cm[1]);
                    if (in_array($col, ['from','select','where','and','or','as','null','true','false','distinct'])) continue;
                    if (!in_array($col, $tableColumns[$tableName])) {
                        $errors[] = ['file'=>$relPath,'line'=>$lineNo,'table'=>$tableName,'column'=>$col,'type'=>'SELECT','sql'=>substr($trimLine,0,150)];
                    }
                }
            }
        }

        // CHECK 2: $db->insert('table', [...])
        if (preg_match("/->insert\s*\(\s*['\"](\w+)['\"]\s*,\s*\[/", $line, $m)) {
            $tableName = strtolower($m[1]);
            if (!isset($tableColumns[$tableName])) continue;
            $block = '';
            for ($i = $lineIdx; $i < min($lineIdx + 30, count($lines)); $i++) {
                $block .= $lines[$i] . "\n";
                if (preg_match('/\]\s*\)/', $lines[$i])) break;
            }
            if (preg_match_all("/^\s*['\"](\w+)['\"]\s*=>/m", $block, $keyMatches)) {
                foreach ($keyMatches[1] as $key) {
                    $key = strtolower($key);
                    if (!in_array($key, $tableColumns[$tableName])) {
                        $errors[] = ['file'=>$relPath,'line'=>$lineNo,'table'=>$tableName,'column'=>$key,'type'=>'INSERT','sql'=>"insert('{$tableName}', ['{$key}' => ...])"];
                    }
                }
            }
        }

        // CHECK 3: $db->update('table', [...])
        if (preg_match("/->update\s*\(\s*['\"](\w+)['\"]\s*,\s*\[/", $line, $m)) {
            $tableName = strtolower($m[1]);
            if (!isset($tableColumns[$tableName])) continue;
            $block = '';
            for ($i = $lineIdx; $i < min($lineIdx + 20, count($lines)); $i++) {
                $block .= $lines[$i] . "\n";
                if (preg_match('/\]\s*,\s*[\'"]/', $lines[$i])) break;
            }
            if (preg_match_all("/^\s*['\"](\w+)['\"]\s*=>/m", $block, $keyMatches)) {
                foreach ($keyMatches[1] as $key) {
                    $key = strtolower($key);
                    if (!in_array($key, $tableColumns[$tableName])) {
                        $errors[] = ['file'=>$relPath,'line'=>$lineNo,'table'=>$tableName,'column'=>$key,'type'=>'UPDATE','sql'=>"update('{$tableName}', ['{$key}' => ...])"];
                    }
                }
            }
        }

        // CHECK 4: Boolean = 1/0
        if (preg_match_all('/(\w+)\s*=\s*([01])\b/', $line, $boolMatches, PREG_SET_ORDER)) {
            if (preg_match('/(SELECT|WHERE|AND|OR|SET|fetch|query)/i', $line)) {
                foreach ($boolMatches as $bm) {
                    $col = strtolower($bm[1]);
                    foreach ($tableColumns as $tbl => $cols) {
                        if (isset($booleanColumns[$tbl . '.' . $col])) {
                            $warnings[] = ['file'=>$relPath,'line'=>$lineNo,'type'=>'BOOLEAN','detail'=>"{$tbl}.{$col} = {$bm[2]} → = " . ($bm[2] ? 'true' : 'false'),'context'=>substr($trimLine,0,120)];
                            break;
                        }
                    }
                }
            }
        }

        // CHECK 5: SQLite syntax
        if (preg_match("/datetime\s*\(\s*['\"]now['\"]/i", $line)) {
            $warnings[] = ['file'=>$relPath,'line'=>$lineNo,'type'=>'SQLITE','detail'=>"datetime('now') → now()",'context'=>substr($trimLine,0,120)];
        }
        if (preg_match('/INSERT\s+OR\s+(IGNORE|REPLACE)/i', $line, $ior)) {
            $warnings[] = ['file'=>$relPath,'line'=>$lineNo,'type'=>'SQLITE','detail'=>"INSERT OR {$ior[1]} → ON CONFLICT",'context'=>substr($trimLine,0,120)];
        }
        if (preg_match('/PRAGMA\s+\w+/i', $line) && strpos($line, 'isPostgres') === false && strpos($line, 'information_schema') === false) {
            $warnings[] = ['file'=>$relPath,'line'=>$lineNo,'type'=>'SQLITE','detail'=>"PRAGMA not in PostgreSQL",'context'=>substr($trimLine,0,120)];
        }
    }
}

// Deduplicate
$uniq = function($arr) {
    $result = [];
    foreach ($arr as $item) {
        $key = $item['file'] . ':' . $item['line'] . ':' . ($item['column'] ?? $item['type']);
        $result[$key] = $item;
    }
    return array_values($result);
};

$errors = $uniq($errors);
$warnings = $uniq($warnings);

// Output ERRORS
echo "╔══════════════════════════════════════════════════════════╗\n";
echo "║  ✗ ERRORS - Column Mismatches (" . str_pad(count($errors), 3) . ")                  ║\n";
echo "╚══════════════════════════════════════════════════════════╝\n\n";

$byFile = [];
foreach ($errors as $e) $byFile[$e['file']][] = $e;

foreach ($byFile as $file => $errs) {
    echo "📄 {$file}\n";
    foreach ($errs as $e) {
        echo "   L{$e['line']} [{$e['type']}] {$e['table']}.{$e['column']}\n";
    }
    echo "\n";
}

// Output WARNINGS
echo "╔══════════════════════════════════════════════════════════╗\n";
echo "║  ⚠ WARNINGS (" . str_pad(count($warnings), 3) . ")                                  ║\n";
echo "╚══════════════════════════════════════════════════════════╝\n\n";

$wByType = [];
foreach ($warnings as $w) $wByType[$w['type']][] = $w;
foreach ($wByType as $type => $ws) {
    echo "  {$type} (" . count($ws) . "):\n";
    foreach ($ws as $w) {
        echo "    {$w['file']}:{$w['line']} → {$w['detail']}\n";
    }
    echo "\n";
}

echo "\n=== SUMMARY ===\n";
echo "Errors: " . count($errors) . " | Warnings: " . count($warnings) . " | Files: " . count($phpFiles) . "\n";
