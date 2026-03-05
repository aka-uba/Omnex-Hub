<?php
/**
 * Payment Settings API (SuperAdmin Only)
 *
 * GET  - Odeme ayarlarini getir (?provider=iyzico|paynet)
 * PUT  - Odeme ayarlarini guncelle (provider alani ile)
 *
 * Supports both Iyzico and Paynet payment gateways
 */

require_once __DIR__ . '/../../services/IyzicoGateway.php';
require_once __DIR__ . '/../../services/PaynetGateway.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// SADECE SuperAdmin erisebilir
if ($user['role'] !== 'SuperAdmin') {
    Response::forbidden('Bu sayfaya erisim yetkiniz yok. Sadece SuperAdmin odeme ayarlarini degistirebilir.');
}

$request = new Request();
$method = $request->getMethod();
$activeProviderFilter = "(status = 'active' OR is_active = true)";
$activeProviderOrder = "CASE WHEN is_active = true THEN 0 ELSE 1 END, COALESCE(updated_at, created_at) DESC";

// Provider parametresini al (parametre yoksa aktif provider'i sec)
$provider = $_GET['provider'] ?? null;

if (!$provider) {
    $activeProvider = $db->fetch(
        "SELECT provider
         FROM payment_settings
         WHERE $activeProviderFilter
         ORDER BY $activeProviderOrder
         LIMIT 1"
    );
    $provider = $activeProvider['provider'] ?? 'iyzico';
}

if (!in_array($provider, ['iyzico', 'paynet'])) {
    $provider = 'iyzico';
}

switch ($method) {
    case 'GET':
        try {
            if ($provider === 'paynet') {
                $gateway = new PaynetGateway();
                $settings = $gateway->getSettings(true);
                $plans = $gateway->getLicensePlans(true);
            } else {
                $gateway = new IyzicoGateway();
                $settings = $gateway->getSettings(true);
                $plans = $gateway->getLicensePlans(true);
            }

            Response::success([
                'settings' => $settings,
                'plans' => $plans,
                'provider' => $provider
            ]);
        } catch (Exception $e) {
            Logger::error('Payment settings fetch error', ['error' => $e->getMessage(), 'provider' => $provider]);
            Response::serverError('Ayarlar yuklenemedi: ' . $e->getMessage());
        }
        break;

    case 'PUT':
        $data = $request->json();

        // Provider'i body'den al (varsayilan: iyzico)
        $saveProvider = $data['provider'] ?? 'iyzico';
        if (!in_array($saveProvider, ['iyzico', 'paynet'])) {
            $saveProvider = 'iyzico';
        }

        try {
            if ($saveProvider === 'paynet') {
                // Paynet validasyonu
                if (isset($data['status']) && $data['status'] === 'active') {
                    $existingSettings = (new PaynetGateway())->getSettings();

                    if (empty($data['publishable_key']) && empty($existingSettings['publishable_key'])) {
                        Response::badRequest('Odeme sistemini aktif etmek icin Publishable Key gerekli');
                    }

                    if (empty($data['secret_key']) && !$existingSettings['has_secret_key']) {
                        Response::badRequest('Odeme sistemini aktif etmek icin Secret Key gerekli');
                    }
                }

                // Paynet ayarlarini kaydet
                $gateway = new PaynetGateway();
                $result = $gateway->saveSettings($data);
            } else {
                // Iyzico validasyonu
                if (isset($data['status']) && $data['status'] === 'active') {
                    $existingSettings = (new IyzicoGateway())->getSettings();

                    if (empty($data['api_key']) && empty($existingSettings['api_key'])) {
                        Response::badRequest('Odeme sistemini aktif etmek icin API Key gerekli');
                    }

                    if (empty($data['secret_key']) && !$existingSettings['has_secret_key']) {
                        Response::badRequest('Odeme sistemini aktif etmek icin Secret Key gerekli');
                    }
                }

                // Iyzico ayarlarini kaydet
                $gateway = new IyzicoGateway();
                $result = $gateway->saveSettings($data);
            }

            // Audit log
            Logger::audit('update', 'payment_settings', [
                'user_id' => $user['id'],
                'provider' => $saveProvider,
                'changes' => array_keys($data)
            ]);

            Response::success($result, ucfirst($saveProvider) . ' odeme ayarlari kaydedildi');
        } catch (Exception $e) {
            Logger::error('Payment settings save error', ['error' => $e->getMessage(), 'provider' => $saveProvider]);
            Response::serverError('Ayarlar kaydedilemedi: ' . $e->getMessage());
        }
        break;

    default:
        Response::methodNotAllowed('Gecersiz metod');
}
