<?php
/**
 * TAMSOFT ERP Settings API
 * GET - Ayarları getir
 * PUT - Ayarları kaydet
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/core/Database.php';
require_once BASE_PATH . '/core/Response.php';
require_once BASE_PATH . '/core/Auth.php';
require_once BASE_PATH . '/services/TamsoftGateway.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Ayarları getir
            $settings = $db->fetch(
                "SELECT * FROM tamsoft_settings WHERE company_id = ?",
                [$companyId]
            );

            if ($settings) {
                // Şifreyi maskele
                if (!empty($settings['password'])) {
                    $settings['password_set'] = true;
                    $settings['password'] = '********';
                } else {
                    $settings['password_set'] = false;
                }
            } else {
                // Varsayılan ayarlar
                $settings = [
                    'api_url' => 'http://tamsoftintegration.camlica.com.tr',
                    'username' => '',
                    'password' => '',
                    'password_set' => false,
                    'default_depo_id' => 1,
                    'sync_interval' => 30,
                    'auto_sync_enabled' => 0,
                    'only_stock_positive' => 0,
                    'only_ecommerce' => 0,
                    'single_barcode' => 1,
                    'enabled' => 0,
                    'last_sync_date' => null
                ];
            }

            Response::success($settings);
            break;

        case 'PUT':
            // Ayarları kaydet
            $input = json_decode(file_get_contents('php://input'), true);

            if (!$input) {
                Response::badRequest('Geçersiz veri');
            }

            // Mevcut ayarları kontrol et
            $existing = $db->fetch(
                "SELECT * FROM tamsoft_settings WHERE company_id = ?",
                [$companyId]
            );

            // Şifre güncelleme kontrolü
            $password = null;
            if (isset($input['password']) && $input['password'] !== '********' && !empty($input['password'])) {
                $password = $input['password'];
            } elseif ($existing) {
                $password = $existing['password'];
            }

            $data = [
                'api_url' => $input['api_url'] ?? 'http://tamsoftintegration.camlica.com.tr',
                'username' => $input['username'] ?? '',
                'password' => $password,
                'default_depo_id' => intval($input['default_depo_id'] ?? 1),
                'sync_interval' => intval($input['sync_interval'] ?? 30),
                'auto_sync_enabled' => intval($input['auto_sync_enabled'] ?? 0),
                'only_stock_positive' => intval($input['only_stock_positive'] ?? 0),
                'only_ecommerce' => intval($input['only_ecommerce'] ?? 0),
                'single_barcode' => intval($input['single_barcode'] ?? 1),
                'enabled' => intval($input['enabled'] ?? 0),
                'updated_at' => date('Y-m-d H:i:s')
            ];

            if ($existing) {
                // Güncelle
                $db->update('tamsoft_settings', $data, 'company_id = ?', [$companyId]);
            } else {
                // Yeni ekle
                $data['id'] = $db->generateUuid();
                $data['company_id'] = $companyId;
                $data['created_at'] = date('Y-m-d H:i:s');
                $db->insert('tamsoft_settings', $data);
            }

            // Şifreyi maskele
            $data['password'] = !empty($password) ? '********' : '';
            $data['password_set'] = !empty($password);

            Response::success($data, 'Ayarlar kaydedildi');
            break;

        default:
            Response::methodNotAllowed('Desteklenmeyen metod');
    }
} catch (Exception $e) {
    Response::error('İşlem başarısız: ' . $e->getMessage());
}
