<?php
/*
Secure image upload endpoint for HTML editor.
Stores uploads in company-isolated storage path.
*/

require_once __DIR__ . '/../../config.php';

$allowedMimeTypes = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/gif' => 'gif',
    'image/webp' => 'webp'
];
$maxUploadBytes = 10 * 1024 * 1024; // 10MB

function uploadShowError(string $error, int $status = 400): void
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

function uploadResolveEditorUser(): array
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
        uploadShowError('Oturum gerekli', 401);
    }

    $role = strtolower((string)($user['role'] ?? ''));
    if (!in_array($role, ['superadmin', 'admin', 'manager', 'editor'], true)) {
        uploadShowError('Bu islem icin yetkiniz yok', 403);
    }

    return $user;
}

function uploadResolveCompanyId(Database $db, array $user): ?string
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

$db = Database::getInstance();
$user = uploadResolveEditorUser();
$companyId = uploadResolveCompanyId($db, $user);

if (!$companyId) {
    uploadShowError('Firma baglami gerekli', 403);
}

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
    uploadShowError('Dosya gonderilmedi');
}

$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    uploadShowError('Dosya yukleme basarisiz');
}

$fileSize = (int)($file['size'] ?? 0);
if ($fileSize <= 0 || $fileSize > $maxUploadBytes) {
    uploadShowError('Dosya boyutu gecersiz');
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = (string)$finfo->file($file['tmp_name']);

if (!isset($allowedMimeTypes[$mimeType])) {
    uploadShowError('Desteklenmeyen dosya turu');
}

$safeBaseName = Security::sanitizeFilename(pathinfo((string)$file['name'], PATHINFO_FILENAME));
if ($safeBaseName === '') {
    $safeBaseName = 'image';
}

$extension = $allowedMimeTypes[$mimeType];
$filename = $safeBaseName . '-' . bin2hex(random_bytes(6)) . '.' . $extension;

$relativeDir = 'companies/' . $companyId . '/media/images';
$uploadDir = STORAGE_PATH . '/' . $relativeDir;

if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
    uploadShowError('Hedef klasor olusturulamadi', 500);
}

$destination = $uploadDir . '/' . $filename;
if (!move_uploaded_file($file['tmp_name'], $destination)) {
    uploadShowError('Dosya kaydedilemedi', 500);
}

$relativePath = $relativeDir . '/' . $filename;
if (isset($_POST['onlyFilename'])) {
    echo $filename;
} else {
    echo $relativePath;
}
