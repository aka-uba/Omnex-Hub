<?php
/**
 * Iyzico Payment Gateway Service
 *
 * Iyzico API v2 entegrasyonu
 * https://dev.iyzipay.com/
 */

class IyzicoGateway
{
    private $db;
    private $settings;
    private $baseUrl;

    // Iyzico API endpoints
    const SANDBOX_URL = 'https://sandbox-api.iyzipay.com';
    const PRODUCTION_URL = 'https://api.iyzipay.com';

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->loadSettings();
    }

    /**
     * Ayarlari yukle
     *
     * Veritabani semasi:
     * - is_active: 1 | 0
     * - is_test_mode: 1 (sandbox) | 0 (production)
     * - publishable_key (api_key olarak kullanilir)
     * - secret_key, callback_url, settings_json
     */
    private function loadSettings(): void
    {
        $dbSettings = $this->db->fetch(
            "SELECT * FROM payment_settings WHERE provider = 'iyzico' ORDER BY created_at DESC LIMIT 1"
        );

        if ($dbSettings) {
            // settings_json'dan ek ayarlari parse et
            $extraSettings = json_decode($dbSettings['settings_json'] ?? '{}', true) ?: [];

            // DB semasi -> internal format donusumu
            $isActive = (int)($dbSettings['is_active'] ?? 0) === 1;
            $isTestMode = (int)($dbSettings['is_test_mode'] ?? 1) === 1;

            $this->settings = [
                'provider' => 'iyzico',
                'environment' => $isTestMode ? 'sandbox' : 'production',
                'api_key' => $dbSettings['publishable_key'] ?? '',
                'secret_key' => $dbSettings['secret_key'] ?? '',
                'callback_url' => $dbSettings['callback_url'] ?? '',
                'currency' => $extraSettings['currency'] ?? 'TRY',
                'installment_enabled' => (int)($extraSettings['installment_enabled'] ?? 1),
                'max_installments' => (int)($extraSettings['max_installments'] ?? 12),
                'status' => $isActive ? 'active' : 'inactive'
            ];
        } else {
            // Varsayilan ayarlar
            $this->settings = [
                'provider' => 'iyzico',
                'environment' => 'sandbox',
                'api_key' => '',
                'secret_key' => '',
                'callback_url' => '',
                'currency' => 'TRY',
                'installment_enabled' => 1,
                'max_installments' => 12,
                'status' => 'inactive'
            ];
        }

        // Base URL ayarla
        $this->baseUrl = ($this->settings['environment'] ?? 'sandbox') === 'production'
            ? self::PRODUCTION_URL
            : self::SANDBOX_URL;
    }

    /**
     * Ayarlari getir (frontend icin)
     */
    public function getSettings(bool $includePlans = false): array
    {
        $result = [
            'provider' => $this->settings['provider'] ?? 'iyzico',
            'environment' => $this->settings['environment'] ?? 'sandbox',
            'api_key' => $this->settings['api_key'] ?? '',
            'has_secret_key' => !empty($this->settings['secret_key']),
            'callback_url' => $this->settings['callback_url'] ?? '',
            'currency' => $this->settings['currency'] ?? 'TRY',
            'installment_enabled' => (bool)($this->settings['installment_enabled'] ?? true),
            'max_installments' => (int)($this->settings['max_installments'] ?? 12),
            'status' => $this->settings['status'] ?? 'inactive'
        ];

        return $result;
    }

    /**
     * Ayarlari kaydet
     *
     * Veritabani semasi (guncellenmis):
     * - is_active: 1 | 0 (frontend'den status olarak gelir)
     * - is_test_mode: 1 | 0 (frontend'den environment olarak gelir)
     * - publishable_key (frontend'den api_key olarak gelir)
     * - secret_key, callback_url
     * - settings_json: { currency, installment_enabled, max_installments }
     */
    public function saveSettings(array $data): array
    {
        $updateData = [];

        // status -> is_active donusumu
        if (isset($data['status'])) {
            $updateData['is_active'] = ($data['status'] === 'active') ? 1 : 0;
        }

        // environment -> is_test_mode donusumu
        if (isset($data['environment'])) {
            $updateData['is_test_mode'] = ($data['environment'] === 'sandbox') ? 1 : 0;
        }

        // api_key -> publishable_key donusumu
        if (isset($data['api_key'])) {
            $updateData['publishable_key'] = $data['api_key'];
        }

        // secret_key (ayni isimde)
        if (isset($data['secret_key']) && !empty($data['secret_key'])) {
            $updateData['secret_key'] = $data['secret_key'];
        }

        // callback_url (ayni isimde)
        if (isset($data['callback_url'])) {
            $updateData['callback_url'] = $data['callback_url'];
        }

        // Ek ayarlari settings_json'a kaydet
        $extraSettings = [];
        if (isset($data['currency'])) {
            $extraSettings['currency'] = $data['currency'];
        }
        if (isset($data['installment_enabled'])) {
            $extraSettings['installment_enabled'] = $data['installment_enabled'] ? 1 : 0;
        }
        if (isset($data['max_installments'])) {
            $extraSettings['max_installments'] = (int)$data['max_installments'];
        }

        // Mevcut settings_json ile birlestir
        $existing = $this->db->fetch(
            "SELECT id, settings_json FROM payment_settings WHERE provider = 'iyzico'"
        );

        if ($existing && !empty($existing['settings_json'])) {
            $currentExtra = json_decode($existing['settings_json'], true) ?: [];
            $extraSettings = array_merge($currentExtra, $extraSettings);
        }

        if (!empty($extraSettings)) {
            $updateData['settings_json'] = json_encode($extraSettings);
        }

        $updateData['updated_at'] = date('Y-m-d H:i:s');

        if ($existing) {
            $this->db->update('payment_settings', $updateData, 'id = ?', [$existing['id']]);
        } else {
            $updateData['id'] = $this->db->generateUuid();
            $updateData['provider'] = 'iyzico';
            $updateData['created_at'] = date('Y-m-d H:i:s');
            $this->db->insert('payment_settings', $updateData);
        }

        // Ayarlari yeniden yukle
        $this->loadSettings();

        return $this->getSettings();
    }

    /**
     * Lisans planlarini getir
     */
    public function getLicensePlans(bool $includeInactive = false): array
    {
        // is_active veya status kolonu ile uyumlu sorgu
        $activePlanFilter = $this->db->isPostgres()
            ? "(status = 'active' OR is_active IS TRUE)"
            : "(status = 'active' OR is_active = 1)";
        $query = "SELECT * FROM license_plans";
        if (!$includeInactive) {
            $query .= " WHERE $activePlanFilter";
        }
        $query .= " ORDER BY sort_order ASC";
        $plans = $this->db->fetchAll($query);

        return array_map(function ($plan) {
            // JSON features parse
            $plan['features'] = json_decode($plan['features'] ?? '[]', true);

            // Sayisal alanlar (yeni kolonlar yoksa eski kolonlardan fallback)
            $plan['price'] = (float)($plan['price'] ?? $plan['price_monthly'] ?? 0);
            $plan['duration_months'] = (int)($plan['duration_months'] ?? 12);
            $plan['currency'] = $plan['currency'] ?? 'TRY';

            // Limitler (yeni kolonlar yoksa eski kolonlardan fallback, -1 = sinirsiz)
            $plan['max_users'] = (int)($plan['max_users'] ?? $plan['user_limit'] ?? -1);
            $plan['max_devices'] = (int)($plan['max_devices'] ?? $plan['esl_limit'] ?? -1);
            $plan['max_products'] = (int)($plan['max_products'] ?? -1);
            $plan['max_templates'] = (int)($plan['max_templates'] ?? -1);
            $plan['max_branches'] = (int)($plan['max_branches'] ?? -1);
            // DB'de max_storage, frontend'de storage_limit olarak kullaniliyor
            $plan['storage_limit'] = (int)($plan['max_storage'] ?? $plan['storage_limit'] ?? 0);

            // Boolean alanlar
            $plan['is_popular'] = (bool)($plan['is_popular'] ?? $plan['is_featured'] ?? false);
            $plan['is_enterprise'] = (bool)($plan['is_enterprise'] ?? false);
            $plan['is_active'] = (bool)($plan['is_active'] ?? ($plan['status'] === 'active'));

            return $plan;
        }, $plans);
    }

    /**
     * Baglanti testi
     */
    public function ping(): array
    {
        if (empty($this->settings['api_key']) || empty($this->settings['secret_key'])) {
            return [
                'success' => false,
                'message' => 'API anahtarlari tanimlanmamis'
            ];
        }

        try {
            // Iyzico API health check - basit bir istek gonder
            $response = $this->request('POST', '/payment/iyzipos/apitest', []);

            return [
                'success' => $response['status'] === 'success',
                'message' => $response['status'] === 'success'
                    ? 'Iyzico baglantisi basarili'
                    : ($response['errorMessage'] ?? 'Baglanti hatasi'),
                'environment' => $this->settings['environment']
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Baglanti hatasi: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Iyzico API istegi gonder
     */
    private function request(string $method, string $endpoint, array $data): array
    {
        $url = $this->baseUrl . $endpoint;

        // Authorization header olustur
        $randomKey = $this->generateRandomString(8);
        $timestamp = time();
        $hashString = $this->settings['api_key'] . $randomKey . $this->settings['secret_key'] . $timestamp;
        $hash = base64_encode(hash('sha256', $hashString, true));

        $authorizationHeader = 'IYZWS ' . $this->settings['api_key'] . ':' . $hash;

        $headers = [
            'Accept: application/json',
            'Content-Type: application/json',
            'Authorization: ' . $authorizationHeader,
            'x-iyzi-rnd: ' . $randomKey,
            'x-iyzi-timestamp: ' . $timestamp
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('cURL Error: ' . $error);
        }

        $result = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON response');
        }

        return $result;
    }

    /**
     * Random string olustur
     */
    private function generateRandomString(int $length): string
    {
        return bin2hex(random_bytes($length / 2));
    }

    /**
     * Odeme baslatma istegi
     */
    public function initializePayment(array $paymentData): array
    {
        // Gerekli alanlar
        $request = [
            'locale' => 'tr',
            'conversationId' => $paymentData['conversation_id'] ?? $this->db->generateUuid(),
            'price' => number_format($paymentData['price'], 2, '.', ''),
            'paidPrice' => number_format($paymentData['paid_price'] ?? $paymentData['price'], 2, '.', ''),
            'currency' => $this->settings['currency'] ?? 'TRY',
            'installment' => $paymentData['installment'] ?? 1,
            'basketId' => $paymentData['basket_id'] ?? $this->db->generateUuid(),
            'paymentChannel' => 'WEB',
            'paymentGroup' => 'PRODUCT',
            'callbackUrl' => $this->settings['callback_url'] ?? $paymentData['callback_url'],
            'buyer' => $paymentData['buyer'],
            'shippingAddress' => $paymentData['shipping_address'] ?? $paymentData['billing_address'],
            'billingAddress' => $paymentData['billing_address'],
            'basketItems' => $paymentData['basket_items'],
            'paymentCard' => $paymentData['payment_card']
        ];

        // 3D Secure kullan
        return $this->request('POST', '/payment/3dsecure/initialize', $request);
    }

    /**
     * 3D Secure dogrulama
     */
    public function verify3DPayment(string $paymentId): array
    {
        $request = [
            'locale' => 'tr',
            'conversationId' => $this->db->generateUuid(),
            'paymentId' => $paymentId
        ];

        return $this->request('POST', '/payment/3dsecure/auth', $request);
    }

    /**
     * Odeme durumu sorgula
     */
    public function getPaymentStatus(string $paymentId): array
    {
        $request = [
            'locale' => 'tr',
            'conversationId' => $this->db->generateUuid(),
            'paymentId' => $paymentId
        ];

        return $this->request('POST', '/payment/detail', $request);
    }

    /**
     * Taksit seceneklerini getir
     */
    public function getInstallmentOptions(string $binNumber, float $price): array
    {
        $request = [
            'locale' => 'tr',
            'conversationId' => $this->db->generateUuid(),
            'binNumber' => $binNumber,
            'price' => number_format($price, 2, '.', '')
        ];

        return $this->request('POST', '/payment/iyzipos/installment', $request);
    }

    /**
     * Odeme iptal
     */
    public function cancelPayment(string $paymentId, string $ip): array
    {
        $request = [
            'locale' => 'tr',
            'conversationId' => $this->db->generateUuid(),
            'paymentId' => $paymentId,
            'ip' => $ip
        ];

        return $this->request('POST', '/payment/cancel', $request);
    }

    /**
     * Iade islemi
     */
    public function refundPayment(string $paymentTransactionId, float $price, string $ip): array
    {
        $request = [
            'locale' => 'tr',
            'conversationId' => $this->db->generateUuid(),
            'paymentTransactionId' => $paymentTransactionId,
            'price' => number_format($price, 2, '.', ''),
            'ip' => $ip
        ];

        return $this->request('POST', '/payment/refund', $request);
    }

    /**
     * Islem kaydet
     */
    public function saveTransaction(array $data): string
    {
        $id = $this->db->generateUuid();

        $this->db->insert('payment_transactions', [
            'id' => $id,
            'company_id' => $data['company_id'],
            'user_id' => $data['user_id'] ?? null,
            'license_id' => $data['license_id'] ?? null,
            'transaction_type' => $data['transaction_type'] ?? 'license_purchase',
            'amount' => $data['amount'],
            'currency' => $data['currency'] ?? 'TRY',
            'status' => $data['status'] ?? 'pending',
            'provider' => 'iyzico',
            'provider_transaction_id' => $data['provider_transaction_id'] ?? null,
            'provider_payment_id' => $data['provider_payment_id'] ?? null,
            'basket_id' => $data['basket_id'] ?? null,
            'conversation_id' => $data['conversation_id'] ?? null,
            'installment' => $data['installment'] ?? 1,
            'buyer_email' => $data['buyer_email'] ?? null,
            'buyer_name' => $data['buyer_name'] ?? null,
            'buyer_phone' => $data['buyer_phone'] ?? null,
            'buyer_ip' => $data['buyer_ip'] ?? $_SERVER['REMOTE_ADDR'] ?? null,
            'raw_request' => isset($data['raw_request']) ? json_encode($data['raw_request']) : null,
            'raw_response' => isset($data['raw_response']) ? json_encode($data['raw_response']) : null,
            'metadata' => isset($data['metadata']) ? json_encode($data['metadata']) : null,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);

        return $id;
    }

    /**
     * Islem guncelle
     */
    public function updateTransaction(string $id, array $data): void
    {
        $allowedFields = [
            'status', 'provider_transaction_id', 'provider_payment_id',
            'card_type', 'card_association', 'card_family', 'card_last_four',
            'paid_price', 'merchant_commission', 'iyzico_commission',
            'error_code', 'error_message', 'error_group',
            'raw_response', 'callback_data', 'paid_at'
        ];

        $updateData = ['updated_at' => date('Y-m-d H:i:s')];

        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                if (in_array($field, ['raw_response', 'callback_data']) && is_array($data[$field])) {
                    $updateData[$field] = json_encode($data[$field]);
                } else {
                    $updateData[$field] = $data[$field];
                }
            }
        }

        $this->db->update('payment_transactions', $updateData, 'id = ?', [$id]);
    }

    /**
     * Islem getir
     */
    public function getTransaction(string $id): ?array
    {
        return $this->db->fetch("SELECT * FROM payment_transactions WHERE id = ?", [$id]);
    }

    /**
     * Islem gecmisi
     */
    public function getTransactionHistory(string $companyId, int $limit = 50, int $offset = 0): array
    {
        $userJoin = $this->db->isPostgres()
            ? 'LEFT JOIN users u ON CAST(pt.user_id AS TEXT) = CAST(u.id AS TEXT)'
            : 'LEFT JOIN users u ON pt.user_id = u.id';
        return $this->db->fetchAll(
            "SELECT pt.*, u.first_name, u.last_name, u.email as user_email
             FROM payment_transactions pt
             $userJoin
             WHERE pt.company_id = ?
             ORDER BY pt.created_at DESC
             LIMIT ? OFFSET ?",
            [$companyId, $limit, $offset]
        );
    }
}
