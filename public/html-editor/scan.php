<?php
/*
Secure media scan endpoint for HTML editor.
Scans only company-isolated media storage path.
*/

require_once __DIR__ . '/../../config.php';

function scanShowError(string $error, int $status = 400): void
{
    $statusTextMap = [
        400 => 'Bad Request',
        401 => 'Unauthorized',
        403 => 'Forbidden',
        500 => 'Internal Server Error'
    ];
    $statusText = $statusTextMap[$status] ?? 'Error';
    header(($_SERVER['SERVER_PROTOCOL'] ?? 'HTTP/1.1') . " {$status} {$statusText}", true, $status);
    die($error);
}

function scanResolveEditorUser(): array
{
    $db = Database::getInstance();
    $user = null;

    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');

    if ($authHeader && preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
        $payload = Auth::validateToken(trim($matches[1]));
        $userId = $payload['user_id'] ?? $payload['sub'] ?? null;
        if ($userId) {
            $user = $db->fetch(
                "SELECT id, company_id, role, status FROM users WHERE id = ?",
                [$userId]
            );
        }
    }

    if (!$user) {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        if (!empty($_SESSION['user_id'])) {
            $user = $db->fetch(
                "SELECT id, company_id, role, status FROM users WHERE id = ?",
                [$_SESSION['user_id']]
            );
        }
    }

    if (!$user || (($user['status'] ?? '') !== 'active')) {
        scanShowError('Oturum gerekli', 401);
    }

    $role = strtolower((string)($user['role'] ?? ''));
    if (!in_array($role, ['superadmin', 'admin', 'manager', 'editor'], true)) {
        scanShowError('Bu islem icin yetkiniz yok', 403);
    }

    return $user;
}

function scanResolveCompanyId(Database $db, array $user): ?string
{
    $role = strtolower((string)($user['role'] ?? ''));
    if ($role === 'superadmin') {
        $activeCompanyId = $_SERVER['HTTP_X_ACTIVE_COMPANY'] ?? null;
        if ($activeCompanyId) {
            $company = $db->fetch("SELECT id FROM companies WHERE id = ?", [$activeCompanyId]);
            if ($company) {
                return $activeCompanyId;
            }
        }

        $defaultCompany = $db->fetch("SELECT id FROM companies ORDER BY created_at ASC LIMIT 1");
        return $defaultCompany['id'] ?? null;
    }

    return $user['company_id'] ?? null;
}

function scanNormalizePath(string $path): string
{
    $path = str_replace('\\', '/', $path);
    return trim($path, '/');
}

$db = Database::getInstance();
$user = scanResolveEditorUser();
$companyId = scanResolveCompanyId($db, $user);

if (!$companyId) {
    scanShowError('Firma baglami gerekli', 403);
}

$baseScanDir = STORAGE_PATH . '/companies/' . $companyId . '/media';
if (!is_dir($baseScanDir) && !mkdir($baseScanDir, 0755, true) && !is_dir($baseScanDir)) {
    scanShowError('Medya klasoru olusturulamadi', 500);
}

$requestedPath = (string)($_POST['mediaPath'] ?? '');
$requestedPath = scanNormalizePath(str_replace(["\0", '..'], '', $requestedPath));

$scanDir = realpath($baseScanDir);
if ($requestedPath !== '') {
    $target = realpath($baseScanDir . '/' . $requestedPath);
    if ($target && str_starts_with(strtolower(str_replace('\\', '/', $target)), strtolower(str_replace('\\', '/', $scanDir)))) {
        $scanDir = $target;
    }
}

$rootNormalized = str_replace('\\', '/', rtrim(realpath($baseScanDir) ?: $baseScanDir, '/\\'));
$scanNormalized = str_replace('\\', '/', rtrim($scanDir, '/\\'));

$scan = function (string $dir) use (&$scan, $rootNormalized) {
    $files = [];
    $items = @scandir($dir);
    if ($items === false) {
        return $files;
    }

    foreach ($items as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }

        $fullPath = $dir . DIRECTORY_SEPARATOR . $entry;
        $normalizedFullPath = str_replace('\\', '/', $fullPath);
        $relativePath = ltrim(substr($normalizedFullPath, strlen($rootNormalized)), '/');

        if (is_dir($fullPath)) {
            $files[] = [
                'name' => $entry,
                'type' => 'folder',
                'path' => $relativePath,
                'items' => $scan($fullPath),
            ];
            continue;
        }

        $files[] = [
            'name' => $entry,
            'type' => 'file',
            'path' => $relativePath,
            'size' => @filesize($fullPath) ?: 0,
        ];
    }

    return $files;
};

$response = $scan($scanDir);

header('Content-Type: application/json');
echo json_encode([
    'name' => '',
    'type' => 'folder',
    'path' => ltrim(substr($scanNormalized, strlen($rootNormalized)), '/'),
    'items' => $response,
]);
