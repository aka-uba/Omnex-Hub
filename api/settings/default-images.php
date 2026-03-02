<?php
/**
 * Default Images API - Manage default images for ESL devices
 *
 * GET    /api/settings/default-images         - List default images
 * POST   /api/settings/default-images         - Upload new default image
 * DELETE /api/settings/default-images/:name   - Delete default image
 *
 * @package OmnexDisplayHub
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

// Admin veya üstü yetki gerekli
if (!in_array($user['role'], ['SuperAdmin', 'Admin', 'superadmin', 'admin'])) {
    Response::forbidden('Bu işlem için yönetici yetkisi gereklidir');
}

$companyId = Auth::getActiveCompanyId();
$method = $_SERVER['REQUEST_METHOD'];

// Route param kontrolü (silme için)
$filename = $request->getRouteParam('filename');
if (!$filename) {
    $pathParts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
    if (count($pathParts) > 3 && $pathParts[count($pathParts) - 2] === 'default-images') {
        $filename = urldecode($pathParts[count($pathParts) - 1]);
    }
}

// Gateway ID from query param or POST
$gatewayId = $_GET['gateway_id'] ?? $_POST['gateway_id'] ?? null;

// Varsayılan görsel dizini
$defaultsDir = BASE_PATH . '/storage/defaults';
$companyDir = $defaultsDir . '/companies/' . $companyId;
$gatewaysDir = $defaultsDir . '/gateways';
$companyGatewaysDir = $companyDir . '/gateways';

// Dizinleri oluştur
if (!is_dir($defaultsDir)) {
    mkdir($defaultsDir, 0755, true);
}
if (!is_dir($companyDir)) {
    mkdir($companyDir, 0755, true);
}
if (!is_dir($gatewaysDir)) {
    mkdir($gatewaysDir, 0755, true);
}
if (!is_dir($companyGatewaysDir)) {
    mkdir($companyGatewaysDir, 0755, true);
}

switch ($method) {
    case 'GET':
        // Varsayılan görselleri listele
        $images = [];

        // Firma gateway'lerini al
        $gateways = $db->fetchAll(
            "SELECT id, name FROM gateways WHERE company_id = ? ORDER BY name",
            [$companyId]
        );

        // Gateway bazlı görseller (firma klasörü öncelikli)
        foreach ($gateways as $gw) {
            $gwDirs = [
                $companyGatewaysDir . '/' . $gw['id'],
                $gatewaysDir . '/' . $gw['id'] // legacy
            ];
            foreach ($gwDirs as $gwDir) {
                if (is_dir($gwDir)) {
                    $gwImages = glob($gwDir . '/*.{jpg,jpeg,png}', GLOB_BRACE);
                    foreach ($gwImages as $path) {
                        $basename = basename($path);
                        $images[] = [
                            'filename' => $basename,
                            'name' => getImageDisplayName($basename),
                            'url' => getImageUrl($path),
                            'dimensions' => getImageDimensions($path),
                            'type' => 'gateway',
                            'gateway_id' => $gw['id'],
                            'gateway_name' => $gw['name'],
                            'size' => filesize($path)
                        ];
                    }
                }
            }
        }

        // Eski firma varsayılanları (geriye uyumluluk)
        if (is_dir($companyDir)) {
            $companyImages = glob($companyDir . '/*.{jpg,jpeg,png}', GLOB_BRACE);
            foreach ($companyImages as $path) {
                $basename = basename($path);
                $images[] = [
                    'filename' => $basename,
                    'name' => getImageDisplayName($basename),
                    'url' => getImageUrl($path),
                    'dimensions' => getImageDimensions($path),
                    'type' => 'company',
                    'gateway_id' => null,
                    'gateway_name' => 'Genel (Eski)',
                    'size' => filesize($path)
                ];
            }
        }

        // Gateway listesini de döndür
        Response::success([
            'images' => $images,
            'gateways' => $gateways
        ]);
        break;

    case 'POST':
        // Yeni varsayılan görsel yükle
        if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            Response::badRequest('Görsel dosyası yüklenemedi');
        }

        $file = $_FILES['image'];
        $imageType = $_POST['image_type'] ?? 'default';
        $uploadGatewayId = $_POST['gateway_id'] ?? null;

        // Gateway ID zorunlu
        if (!$uploadGatewayId) {
            Response::badRequest('Gateway seçimi zorunludur');
        }

        // Gateway'in bu firmaya ait olduğunu kontrol et
        $gateway = $db->fetch(
            "SELECT id, name FROM gateways WHERE id = ? AND company_id = ?",
            [$uploadGatewayId, $companyId]
        );
        if (!$gateway) {
            Response::forbidden('Bu gateway\'e erişim yetkiniz yok');
        }

        // Dosya türü kontrolü
        $allowedTypes = ['image/jpeg', 'image/png'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mimeType, $allowedTypes)) {
            Response::badRequest('Sadece JPG ve PNG formatları desteklenir');
        }

        // Maksimum boyut: 5MB
        if ($file['size'] > 5 * 1024 * 1024) {
            Response::badRequest('Dosya boyutu 5MB\'dan büyük olamaz');
        }

        // Dosya adı belirleme
        $extension = $mimeType === 'image/png' ? 'png' : 'jpg';
        $targetFilename = $imageType . '.' . $extension;

        // Hedef dizin (gateway bazlı)
        $gatewayDir = $companyGatewaysDir . '/' . $uploadGatewayId;
        if (!is_dir($gatewayDir)) {
            mkdir($gatewayDir, 0755, true);
        }
        $targetPath = $gatewayDir . '/' . $targetFilename;

        // Eski dosyayı sil (varsa)
        $oldFiles = glob($gatewayDir . '/' . $imageType . '.*');
        foreach ($oldFiles as $oldFile) {
            @unlink($oldFile);
        }

        // Dosyayı taşı
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            Response::error('Dosya kaydedilemedi');
        }

        // Görsel boyutlarını al
        $dimensions = getImageDimensions($targetPath);

        Logger::info('Default image uploaded', [
            'company_id' => $companyId,
            'gateway_id' => $uploadGatewayId,
            'filename' => $targetFilename,
            'image_type' => $imageType,
            'size' => $file['size'],
            'user_id' => $user['id']
        ]);

        Response::success([
            'filename' => $targetFilename,
            'name' => getImageDisplayName($targetFilename),
            'url' => getImageUrl($targetPath),
            'dimensions' => $dimensions,
            'type' => 'gateway',
            'gateway_id' => $uploadGatewayId,
            'gateway_name' => $gateway['name']
        ], 'Varsayılan görsel yüklendi');
        break;

    case 'DELETE':
        if (!$filename) {
            Response::badRequest('Dosya adı belirtilmedi');
        }

        $deleteGatewayId = $_GET['gateway_id'] ?? null;
        $targetPath = null;
        $deleted = false;

        // Gateway bazlı silme
        if ($deleteGatewayId) {
            // Gateway'in bu firmaya ait olduğunu kontrol et
            $gateway = $db->fetch(
                "SELECT id FROM gateways WHERE id = ? AND company_id = ?",
                [$deleteGatewayId, $companyId]
            );
            if (!$gateway) {
                Response::forbidden('Bu gateway\'e erişim yetkiniz yok');
            }

            $gatewayDirs = [
                $companyGatewaysDir . '/' . $deleteGatewayId,
                $gatewaysDir . '/' . $deleteGatewayId // legacy
            ];
            foreach ($gatewayDirs as $gatewayDir) {
                $targetPath = $gatewayDir . '/' . basename($filename);
                if (is_dir($gatewayDir) && strpos(realpath($targetPath), realpath($gatewayDir)) === 0) {
                    if (file_exists($targetPath) && @unlink($targetPath)) {
                        $deleted = true;
                        break;
                    }
                }
            }

            // Uzantı farklı ise aynı isimli tüm görselleri dene
            if (!$deleted) {
                $baseName = pathinfo($filename, PATHINFO_FILENAME);
                foreach ($gatewayDirs as $gatewayDir) {
                    $matches = glob($gatewayDir . '/' . $baseName . '.*');
                    foreach ($matches as $match) {
                        if (is_file($match) && @unlink($match)) {
                            $deleted = true;
                            break 2;
                        }
                    }
                }
            }
        }

        // Eski firma bazlı görsellerde de ara (geriye uyumluluk)
        if (!$deleted) {
            $targetPath = $companyDir . '/' . basename($filename);
            if (is_dir($companyDir) && strpos(realpath($targetPath), realpath($companyDir)) === 0) {
                if (file_exists($targetPath) && @unlink($targetPath)) {
                    $deleted = true;
                }
            }
        }

        if (!$deleted) {
            Response::notFound('Dosya bulunamadı veya silinemedi');
        }

        Logger::info('Default image deleted', [
            'company_id' => $companyId,
            'gateway_id' => $deleteGatewayId,
            'filename' => $filename,
            'user_id' => $user['id']
        ]);

        Response::success(null, 'Varsayılan görsel silindi');
        break;

    default:
        Response::methodNotAllowed();
}

/**
 * Görsel için okunabilir ad oluştur
 */
function getImageDisplayName($filename) {
    $name = pathinfo($filename, PATHINFO_FILENAME);

    $displayNames = [
        'default' => 'Genel Varsayılan',
        'portrait' => 'Dikey Ekranlar',
        'landscape' => 'Yatay Ekranlar',
        '800x1280' => '10.1" Dikey (800x1280)',
        '1280x800' => '10.1" Yatay (1280x800)',
        '400x300' => '4.2" (400x300)',
        '296x128' => '2.9" (296x128)',
        '640x384' => '7.5" (640x384)'
    ];

    return $displayNames[$name] ?? $name;
}

/**
 * Görsel URL'si oluştur
 */
function getImageUrl($path) {
    $basePath = defined('BASE_PATH') ? BASE_PATH : dirname(dirname(__DIR__));
    $relativePath = str_replace($basePath, '', $path);
    $relativePath = str_replace('\\', '/', $relativePath);

    // Serve.php üzerinden sun
    $baseUrl = defined('APP_URL') ? rtrim(APP_URL, '/') : '';
    if ($baseUrl && str_ends_with($baseUrl, '/api')) {
        $baseUrl = substr($baseUrl, 0, -4);
    }
    if ($baseUrl) {
        return $baseUrl . '/api/media/serve.php?path=' . urlencode($path);
    }
    return '/api/media/serve.php?path=' . urlencode($path);
}

/**
 * Görsel boyutlarını al
 */
function getImageDimensions($path) {
    if (!file_exists($path)) {
        return null;
    }

    $info = @getimagesize($path);
    if (!$info) {
        return null;
    }

    return $info[0] . 'x' . $info[1];
}
