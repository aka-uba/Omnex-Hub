<?php
/**
 * Diagnostic + Fix script for auth issues
 * Run inside Docker container: docker exec omnex-app php /var/www/html/deploy/scripts/fix_auth.php
 */
error_reporting(E_ALL);
ini_set('display_errors', '1');

echo "=== Omnex Auth Diagnostic ===\n\n";

// 1. Check Argon2ID support
echo "1. PHP Argon2ID support: ";
echo defined('PASSWORD_ARGON2ID') ? "YES\n" : "NO (CRITICAL!)\n";

// 2. Load config
echo "2. Loading config... ";
require '/var/www/html/config.php';
echo "OK\n";

echo "   DEFAULT_ADMIN_PASSWORD = '" . DEFAULT_ADMIN_PASSWORD . "'\n";
echo "   OMNEX_ADMIN_PASSWORD env = '" . (getenv('OMNEX_ADMIN_PASSWORD') ?: '(not set)') . "'\n";

// 3. Test hash generation
echo "\n3. Hash generation test:\n";
$testHash = Auth::hashPassword('OmnexAdmin2024!');
echo "   Hash: " . substr($testHash, 0, 60) . "...\n";
echo "   Verify: " . (Auth::verifyPassword('OmnexAdmin2024!', $testHash) ? 'OK' : 'FAIL') . "\n";

// 4. DB connection
echo "\n4. Database connection... ";
try {
    $db = Database::getInstance();
    echo "OK\n";
} catch (\Throwable $e) {
    echo "FAIL: " . $e->getMessage() . "\n";
    exit(1);
}

// 5. Check users
echo "\n5. Users in database:\n";
$users = $db->fetchAll("SELECT id, email, role, status, company_id, LEFT(password_hash, 30) as hash_prefix FROM users ORDER BY created_at");
if (empty($users)) {
    echo "   NO USERS FOUND! Seed did not run.\n";
} else {
    foreach ($users as $u) {
        echo "   - {$u['email']} | role={$u['role']} | status={$u['status']} | hash={$u['hash_prefix']}...\n";
    }
}

// 6. Check migration markers
echo "\n6. Seed migration marker:\n";
$marker = $db->fetch("SELECT * FROM migrations WHERE name = 'seed:php:all'");
echo "   seed:php:all: " . ($marker ? "EXISTS (applied at {$marker['applied_at']})" : "NOT FOUND") . "\n";

// 7. Check companies
echo "\n7. Companies:\n";
$companies = $db->fetchAll("SELECT id, name, code, status FROM companies ORDER BY created_at");
if (empty($companies)) {
    echo "   NO COMPANIES FOUND!\n";
} else {
    foreach ($companies as $c) {
        echo "   - {$c['name']} ({$c['code']}) status={$c['status']}\n";
    }
}

// 8. Verify existing password hashes
echo "\n8. Password verification against 'OmnexAdmin2024!':\n";
$adminUser = $db->fetch("SELECT id, email, password_hash, status FROM users WHERE email = 'admin@omnexcore.com'");
if ($adminUser) {
    $ok = password_verify('OmnexAdmin2024!', $adminUser['password_hash']);
    echo "   admin@omnexcore.com: " . ($ok ? 'PASS' : 'FAIL') . " (status={$adminUser['status']})\n";
    if (!$ok) {
        echo "   Stored hash: " . substr($adminUser['password_hash'], 0, 40) . "...\n";
        echo "   Hash length: " . strlen($adminUser['password_hash']) . "\n";
    }
} else {
    echo "   admin@omnexcore.com: USER NOT FOUND\n";
}

$companyUser = $db->fetch("SELECT id, email, password_hash, status FROM users WHERE email = 'company@omnexcore.com'");
if ($companyUser) {
    $ok = password_verify('OmnexAdmin2024!', $companyUser['password_hash']);
    $ok2 = password_verify('CompanyAdmin2024!', $companyUser['password_hash']);
    echo "   company@omnexcore.com: OmnexAdmin2024!=" . ($ok ? 'PASS' : 'FAIL') . " CompanyAdmin2024!=" . ($ok2 ? 'PASS' : 'FAIL') . " (status={$companyUser['status']})\n";
} else {
    echo "   company@omnexcore.com: USER NOT FOUND\n";
}

// 9. Check rate limits
echo "\n9. Rate limit entries:\n";
try {
    $rateLimits = $db->fetchAll("SELECT key, attempts, window_start FROM rate_limits WHERE key LIKE 'login%' ORDER BY window_start DESC LIMIT 5");
    if (empty($rateLimits)) {
        echo "   No login rate limits found\n";
    } else {
        foreach ($rateLimits as $rl) {
            echo "   - {$rl['key']} | attempts={$rl['attempts']} | since={$rl['window_start']}\n";
        }
    }
} catch (\Throwable $e) {
    echo "   Could not check: " . $e->getMessage() . "\n";
}

// 10. FIX: Reset passwords
echo "\n=== APPLYING FIX ===\n";

$newHash = Auth::hashPassword('OmnexAdmin2024!');
echo "New hash generated: " . substr($newHash, 0, 40) . "...\n";
echo "Verify new hash: " . (password_verify('OmnexAdmin2024!', $newHash) ? 'OK' : 'FAIL') . "\n";

if ($adminUser) {
    $db->update('users', [
        'password_hash' => $newHash,
        'status' => 'active'
    ], 'email = ?', ['admin@omnexcore.com']);
    echo "Updated admin@omnexcore.com password + status=active\n";
}

if ($companyUser) {
    $companyHash = Auth::hashPassword('CompanyAdmin2024!');
    $db->update('users', [
        'password_hash' => $companyHash,
        'status' => 'active'
    ], 'email = ?', ['company@omnexcore.com']);
    echo "Updated company@omnexcore.com password + status=active\n";
}

// Clear rate limits
try {
    $db->delete('rate_limits', "key LIKE 'login%'");
    echo "Cleared login rate limits\n";
} catch (\Throwable $e) {
    echo "Rate limit clear skipped: " . $e->getMessage() . "\n";
}

// 11. Final verify
echo "\n=== FINAL VERIFICATION ===\n";
$adminUser2 = $db->fetch("SELECT password_hash, status FROM users WHERE email = 'admin@omnexcore.com'");
if ($adminUser2) {
    $ok = password_verify('OmnexAdmin2024!', $adminUser2['password_hash']);
    echo "admin@omnexcore.com: verify=" . ($ok ? 'PASS' : 'FAIL') . " status={$adminUser2['status']}\n";
}

$companyUser2 = $db->fetch("SELECT password_hash, status FROM users WHERE email = 'company@omnexcore.com'");
if ($companyUser2) {
    $ok = password_verify('CompanyAdmin2024!', $companyUser2['password_hash']);
    echo "company@omnexcore.com: verify=" . ($ok ? 'PASS' : 'FAIL') . " status={$companyUser2['status']}\n";
}

echo "\nDone! Try logging in now.\n";
