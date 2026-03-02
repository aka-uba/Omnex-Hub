<?php
/**
 * Media Serve API - Secure file serving under storage with tenant checks
 */

$basePath = dirname(dirname(__DIR__));
require_once $basePath . DIRECTORY_SEPARATOR . 'config.php';

$storagePath = defined('STORAGE_PATH')
    ? STORAGE_PATH
    : $basePath . DIRECTORY_SEPARATOR . 'storage';
$storagePath = realpath($storagePath);

if (!$storagePath || !is_dir($storagePath)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Storage dizini bulunamadi']);
    exit;
}

function mediaJsonError(int $code, string $message): void
{
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(['error' => $message]);
    exit;
}

function mediaNormalizePath(string $path): string
{
    $path = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
    return rtrim($path, DIRECTORY_SEPARATOR);
}

function mediaStartsWithPath(string $path, string $base): bool
{
    $path = strtolower(mediaNormalizePath($path));
    $base = strtolower(mediaNormalizePath($base));
    return $path === $base || strpos($path, $base . DIRECTORY_SEPARATOR) === 0;
}

function resolveMediaUser(Database $db): ?array
{
    $existing = Auth::user();
    if ($existing) {
        return $existing;
    }

    $token = null;
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
        $token = trim($matches[1]);
    }
    if (!$token && !empty($_COOKIE['omnex_token'])) {
        $token = (string)$_COOKIE['omnex_token'];
    }

    if ($token) {
        $payload = Auth::validateToken($token);
        if ($payload) {
            $userId = $payload['user_id'] ?? $payload['sub'] ?? null;
            if ($userId) {
                $user = $db->fetch(
                    "SELECT id, company_id, role, status FROM users WHERE id = ?",
                    [$userId]
                );
                if ($user && ($user['status'] ?? '') === 'active') {
                    Auth::setUser($user);
                    return $user;
                }
            }
        }
    }

    if (session_status() === PHP_SESSION_NONE) {
        @session_start();
    }
    if (!empty($_SESSION['user_id'])) {
        $user = $db->fetch(
            "SELECT id, company_id, role, status FROM users WHERE id = ?",
            [$_SESSION['user_id']]
        );
        if ($user && ($user['status'] ?? '') === 'active') {
            Auth::setUser($user);
            return $user;
        }
    }

    return null;
}

function mediaHasValidSignedAccess(string $relativePath): bool
{
    $signature = (string)($_GET['sig'] ?? '');
    $expiresRaw = (string)($_GET['exp'] ?? '');
    if ($signature === '' || $expiresRaw === '' || !ctype_digit($expiresRaw)) {
        return false;
    }

    $expiresAt = (int)$expiresRaw;
    if ($expiresAt < time()) {
        return false;
    }

    $normalizedRelative = ltrim(str_replace('\\', '/', $relativePath), '/');
    $expected = hash_hmac('sha256', $normalizedRelative . '|' . $expiresAt, JWT_SECRET);

    return hash_equals($expected, $signature);
}

$requestedPath = (string)($_GET['path'] ?? '');
if ($requestedPath === '') {
    mediaJsonError(400, 'Path gerekli');
}

$requestedPath = urldecode($requestedPath);
$requestedPath = str_replace("\0", '', $requestedPath);
$requestedPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $requestedPath);
$requestedPath = preg_replace('/^storage[\/\\\\]?/i', '', $requestedPath);
$requestedPath = ltrim($requestedPath, DIRECTORY_SEPARATOR);

$isAbsolute = (bool)preg_match('/^[A-Za-z]:[\/\\\\]/', $requestedPath) || str_starts_with($requestedPath, DIRECTORY_SEPARATOR);
if ($isAbsolute) {
    $filePath = realpath($requestedPath);
} else {
    $filePath = realpath($storagePath . DIRECTORY_SEPARATOR . $requestedPath);
}

if (!$filePath) {
    mediaJsonError(404, 'Dosya bulunamadi');
}

if (!mediaStartsWithPath($filePath, $storagePath)) {
    mediaJsonError(403, 'Erisim reddedildi');
}

if (!is_file($filePath)) {
    mediaJsonError(404, 'Dosya bulunamadi');
}

$relativePath = '';
if (mediaNormalizePath($filePath) !== mediaNormalizePath($storagePath)) {
    $relativePath = substr(mediaNormalizePath($filePath), strlen(mediaNormalizePath($storagePath)) + 1);
    $relativePath = str_replace('\\', '/', $relativePath);
}

$db = Database::getInstance();
$user = null;
$hasSignedAccess = mediaHasValidSignedAccess($relativePath);
$accessAllowed = false;

if ($relativePath === 'public' || str_starts_with($relativePath, 'public/')) {
    $accessAllowed = true;
} elseif ($relativePath === 'avatars' || str_starts_with($relativePath, 'avatars/')) {
    $accessAllowed = true;
} elseif ($relativePath === 'defaults' || str_starts_with($relativePath, 'defaults/')) {
    $accessAllowed = true;
} elseif ($relativePath === 'companies' || str_starts_with($relativePath, 'companies/')) {
    if ($hasSignedAccess) {
        $accessAllowed = true;
    } else {
        $user = resolveMediaUser($db);
        if (!$user) {
            mediaJsonError(401, 'Oturum gerekli');
        }

        if (preg_match('/^companies\/([^\/]+)(\/|$)/', $relativePath, $matches)) {
            $pathCompanyId = $matches[1];
            $accessAllowed = ($user['role'] ?? '') === 'SuperAdmin' || (($user['company_id'] ?? null) === $pathCompanyId);
        }
    }
} elseif ($relativePath === 'system' || str_starts_with($relativePath, 'system/')) {
    $user = resolveMediaUser($db);
    if (!$user) {
        mediaJsonError(401, 'Oturum gerekli');
    }
    $accessAllowed = in_array($user['role'] ?? '', ['SuperAdmin', 'Admin'], true);
} elseif (
    $relativePath === 'media' || str_starts_with($relativePath, 'media/') ||
    $relativePath === 'renders' || str_starts_with($relativePath, 'renders/') ||
    $relativePath === 'templates' || str_starts_with($relativePath, 'templates/')
) {
    if ($hasSignedAccess) {
        $accessAllowed = true;
    } else {
        // Legacy locations: require auth + DB ownership/public check.
        $user = resolveMediaUser($db);
        if (!$user) {
            mediaJsonError(401, 'Oturum gerekli');
        }

        $relativeNorm = str_replace('\\', '/', $relativePath);
        $absoluteNorm = str_replace('\\', '/', $filePath);
        $media = $db->fetch(
            "SELECT company_id, is_public, scope
             FROM media
             WHERE REPLACE(file_path, '\\\\', '/') = ?
                OR REPLACE(file_path, '\\\\', '/') = ?
             LIMIT 1",
            [$relativeNorm, $absoluteNorm]
        );

        if ($media) {
            $isPublic = ((int)($media['is_public'] ?? 0) === 1) || (($media['scope'] ?? '') === 'public');
            $accessAllowed = $isPublic
                || (($user['role'] ?? '') === 'SuperAdmin')
                || (!empty($media['company_id']) && ($media['company_id'] === ($user['company_id'] ?? null)));
        } else {
            // Compatibility fallback for old non-indexed files: admin only.
            $accessAllowed = in_array($user['role'] ?? '', ['SuperAdmin', 'Admin'], true);
        }
    }
} else {
    $accessAllowed = false;
}

if (!$accessAllowed) {
    mediaJsonError(403, 'Bu dosyaya erisim izniniz yok');
}

$allowedExtensions = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp',
    'mp4', 'webm', 'ogg', 'mov', 'avi',
    'mp3', 'wav',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'txt', 'csv', 'json'
];

$extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
if (!in_array($extension, $allowedExtensions, true)) {
    mediaJsonError(403, 'Bu dosya tipi desteklenmiyor');
}

$mimeType = @mime_content_type($filePath) ?: 'application/octet-stream';

header('Content-Type: ' . $mimeType);
header('Content-Length: ' . filesize($filePath));
header('Cache-Control: public, max-age=31536000');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'");

if ($extension === 'svg') {
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'");
}

readfile($filePath);
exit;
