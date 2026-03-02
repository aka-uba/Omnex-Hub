<?php
/**
 * Thumbnail Generation API (image + video)
 *
 * Usage: /api/media/thumbnail.php?id=MEDIA_ID&size=200
 */

if (!defined('BASE_PATH')) {
    require_once dirname(dirname(__DIR__)) . '/config.php';
}

require_once __DIR__ . '/_thumbnail_utils.php';

function thumbnailResolveUser(Database $db): ?array
{
    $existing = Auth::user();
    if ($existing) {
        return $existing;
    }

    $token = null;
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
        $token = trim((string)$matches[1]);
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

function thumbnailHasValidSignedAccess(string $relativePath): bool
{
    $signature = (string)($_GET['sig'] ?? '');
    $expiresRaw = (string)($_GET['exp'] ?? '');
    if ($relativePath === '' || $signature === '' || $expiresRaw === '' || !ctype_digit($expiresRaw)) {
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

$mediaId = $_GET['id'] ?? '';
$size = (int)($_GET['size'] ?? 200);

if (isset($request) && is_object($request)) {
    if ($mediaId === '') {
        $mediaId = (string)($request->query('id') ?? '');
    }
    if ($size === 200) {
        $size = (int)($request->query('size') ?? 200);
    }
}

$size = max(50, min(800, $size));

if ($mediaId === '') {
    header('HTTP/1.1 400 Bad Request');
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Media ID required']);
    exit;
}

$db = Database::getInstance();
$media = $db->fetch("SELECT * FROM media WHERE id = ?", [$mediaId]);
if (!$media) {
    header('HTTP/1.1 404 Not Found');
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Media not found']);
    exit;
}

$fileType = strtolower((string)($media['file_type'] ?? ''));
if (!in_array($fileType, ['image', 'video'], true)) {
    header('HTTP/1.1 400 Bad Request');
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Thumbnail not available for this media type']);
    exit;
}

$fullPath = media_thumbnail_resolve_full_path($media);
if (!$fullPath || !is_file($fullPath)) {
    header('HTTP/1.1 404 Not Found');
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Original file not found']);
    exit;
}

$storagePath = realpath(media_thumbnail_storage_path());
$fullPathReal = realpath($fullPath);
$relativePath = '';
if ($storagePath && $fullPathReal) {
    $storageNorm = str_replace('\\', '/', rtrim($storagePath, '\\/'));
    $fullNorm = str_replace('\\', '/', $fullPathReal);
    if (strtolower(substr($fullNorm, 0, strlen($storageNorm) + 1)) === strtolower($storageNorm . '/')) {
        $relativePath = substr($fullNorm, strlen($storageNorm) + 1);
    }
}

$isPublicMedia = ((int)($media['is_public'] ?? 0) === 1) || (($media['scope'] ?? '') === 'public');
if (!$isPublicMedia && !thumbnailHasValidSignedAccess($relativePath)) {
    $user = thumbnailResolveUser($db);
    if (!$user) {
        header('HTTP/1.1 401 Unauthorized');
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Authentication required']);
        exit;
    }

    $isSuperAdmin = (($user['role'] ?? '') === 'SuperAdmin');
    $sameCompany = !empty($media['company_id']) && (($user['company_id'] ?? null) === $media['company_id']);
    if (!$isSuperAdmin && !$sameCompany) {
        header('HTTP/1.1 403 Forbidden');
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Access denied']);
        exit;
    }
}

$cacheFile = media_thumbnail_cache_file($media, $size, $fullPath);
if (!$cacheFile) {
    header('HTTP/1.1 500 Internal Server Error');
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Failed to build cache path']);
    exit;
}

if (is_file($cacheFile)) {
    header('Content-Type: image/jpeg');
    header('Content-Length: ' . filesize($cacheFile));
    header('Cache-Control: public, max-age=31536000');
    header('X-Thumbnail-Cache: HIT');
    readfile($cacheFile);
    exit;
}

$generatedFile = media_thumbnail_ensure($media, $size);
if ($generatedFile && is_file($generatedFile)) {
    header('Content-Type: image/jpeg');
    header('Content-Length: ' . filesize($generatedFile));
    header('Cache-Control: public, max-age=31536000');
    header('X-Thumbnail-Cache: MISS');
    readfile($generatedFile);
    exit;
}

header('HTTP/1.1 404 Not Found');
header('Content-Type: application/json');
echo json_encode([
    'error' => 'Thumbnail could not be generated',
    'type' => $fileType,
    'ffmpeg_available' => media_thumbnail_ffmpeg_available()
]);
exit;
