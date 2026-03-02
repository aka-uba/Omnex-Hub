<?php
/**
 * Paynet Payment Gateway Service
 *
 * Paynet API ile odeme islemleri icin kullanilir.
 * Dokumantasyon: https://doc.paynet.com.tr/
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

class PaynetGateway
{
    private $secretKey;
    private $publishableKey;
    private $apiUrl;
    private $isTestMode;
    private $timeout;
    private $db;

    // API Endpoints
    const ENDPOINT_CHARGE = '/v1/transaction/charge';
    const ENDPOINT_3D_CHARGE = '/v1/transaction/3d_charge';
    const ENDPOINT_TDS_INITIAL = '/v2/transaction/tds_initial';
    const ENDPOINT_TDS_CHARGE = '/v2/transaction/tds_charge';
    const ENDPOINT_CHECK = '/v1/transaction/check';
    const ENDPOINT_REFUND = '/v1/transaction/refund';
    const ENDPOINT_CANCEL = '/v1/transaction/cancel';

    // Test ve Live API URL'leri
    const API_URL_LIVE = 'https://pts-api.paynet.com.tr';
    const API_URL_TEST = 'https://pts-api.paynet.com.tr'; // Paynet test icin ayni URL kullanir

    /**
     * Constructor
     *
     * @param array|null $settings Ayarlar (null ise veritabanindan yukler)
     */
    public function __construct($settings = null)
    {
        $this->db = Database::getInstance();

        if ($settings === null) {
            $settings = $this->loadSettings();
        }

        $this->secretKey = $settings['secret_key'] ?? '';
        $this->publishableKey = $settings['publishable_key'] ?? '';
        $this->isTestMode = (bool)($settings['is_test_mode'] ?? true);
        $this->apiUrl = $settings['api_url'] ?? self::API_URL_LIVE;
        $this->timeout = $settings['timeout'] ?? 30;
    }

    /**
     * Veritabanindan ayarlari yukle
     */
    private function loadSettings()
    {
        $settings = $this->db->fetch(
            "SELECT * FROM payment_settings WHERE provider = 'paynet' LIMIT 1"
        );

        if ($settings) {
            // Sifrelenmis secret key'i coz
            if (!empty($settings['secret_key'])) {
                $settings['secret_key'] = $this->decryptKey($settings['secret_key']);
            }
            return $settings;
        }

        return [
            'secret_key' => '',
            'publishable_key' => '',
            'is_test_mode' => true,
            'api_url' => self::API_URL_LIVE
        ];
    }

    /**
     * Secret key'i sifrele (veritabanina kaydederken)
     */
    public function encryptKey($key)
    {
        if (empty($key)) return '';

        $encryptionKey = defined('JWT_SECRET') ? JWT_SECRET : 'omnex_default_key';
        $iv = substr(hash('sha256', $encryptionKey), 0, 16);

        return base64_encode(openssl_encrypt($key, 'AES-256-CBC', $encryptionKey, 0, $iv));
    }

    /**
     * Sifrelenmis key'i coz
     */
    private function decryptKey($encryptedKey)
    {
        if (empty($encryptedKey)) return '';

        $encryptionKey = defined('JWT_SECRET') ? JWT_SECRET : 'omnex_default_key';
        $iv = substr(hash('sha256', $encryptionKey), 0, 16);

        return openssl_decrypt(base64_decode($encryptedKey), 'AES-256-CBC', $encryptionKey, 0, $iv);
    }

    /**
     * API istegi gonder
     */
    private function request($endpoint, $data = [], $method = 'POST')
    {
        $url = rtrim($this->apiUrl, '/') . $endpoint;

        $ch = curl_init();

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'Authorization: Basic ' . base64_encode($this->secretKey . ':')
        ];

        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_SSL_VERIFYPEER => !$this->isTestMode,
            CURLOPT_SSL_VERIFYHOST => $this->isTestMode ? 0 : 2,
        ]);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($method === 'GET' && !empty($data)) {
            curl_setopt($ch, CURLOPT_URL, $url . '?' . http_build_query($data));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'error' => $error,
                'http_code' => $httpCode
            ];
        }

        $decoded = json_decode($response, true);

        return [
            'success' => $httpCode >= 200 && $httpCode < 300,
            'http_code' => $httpCode,
            'data' => $decoded,
            'raw' => $response
        ];
    }

    /**
     * Paynet amount format: "130,00"
     */
    private function formatAmount(float $amount): string
    {
        return str_replace('.', ',', number_format($amount, 2, '.', ''));
    }

    /**
     * Fallback auto-submit html when provider returns post_url + token/session.
     */
    private function buildAutoSubmitHtml(string $postUrl, string $sessionId, string $tokenId): string
    {
        $safePostUrl = htmlspecialchars($postUrl, ENT_QUOTES, 'UTF-8');
        $safeSessionId = htmlspecialchars($sessionId, ENT_QUOTES, 'UTF-8');
        $safeTokenId = htmlspecialchars($tokenId, ENT_QUOTES, 'UTF-8');

        return '<!doctype html><html><head><meta charset="utf-8"><title>Redirecting...</title></head><body>'
            . '<form id="paynet-3d-form" method="post" action="' . $safePostUrl . '">'
            . '<input type="hidden" name="session_id" value="' . $safeSessionId . '">'
            . '<input type="hidden" name="token_id" value="' . $safeTokenId . '">'
            . '</form>'
            . '<script>document.getElementById("paynet-3d-form").submit();</script>'
            . '</body></html>';
    }

    /**
     * Odeme islemi yap (3D'siz)
     *
     * @param array $params Odeme parametreleri
     * @return array
     */
    public function charge($params)
    {
        $required = ['session_id', 'token_id', 'amount'];
        foreach ($required as $field) {
            if (empty($params[$field])) {
                return [
                    'success' => false,
                    'error' => "Eksik parametre: {$field}"
                ];
            }
        }

        $data = [
            'session_id' => $params['session_id'],
            'token_id' => $params['token_id'],
            'amount' => (int)$params['amount'], // Kurus cinsinden
            'transaction_type' => $params['transaction_type'] ?? 1, // 1: Sale, 3: Pre-auth
            'installment_count' => $params['installment'] ?? 1,
        ];

        // Referans numarasi (siparis no)
        if (!empty($params['reference_no'])) {
            $data['reference_no'] = $params['reference_no'];
        }

        // Kart saklama
        if (!empty($params['add_card_to_wallet'])) {
            $data['add_card_to_wallet'] = true;
        }

        return $this->request(self::ENDPOINT_CHARGE, $data);
    }

    /**
     * 3D Secure odeme islemi baslat
     *
     * @param array $params Odeme parametreleri
     * @return array
     */
    public function charge3D($params)
    {
        $required = ['session_id', 'token_id', 'amount', 'return_url'];
        foreach ($required as $field) {
            if (empty($params[$field])) {
                return [
                    'success' => false,
                    'error' => "Eksik parametre: {$field}"
                ];
            }
        }

        $data = [
            'session_id' => $params['session_id'],
            'token_id' => $params['token_id'],
            'amount' => (int)$params['amount'],
            'return_url' => $params['return_url'],
            'transaction_type' => $params['transaction_type'] ?? 1,
            'installment_count' => $params['installment'] ?? 1,
        ];

        if (!empty($params['reference_no'])) {
            $data['reference_no'] = $params['reference_no'];
        }

        return $this->request(self::ENDPOINT_3D_CHARGE, $data);
    }

    /**
     * Initialize payment in a provider-compatible format.
     * Returns shape compatible with Iyzico flow:
     * - status: success|failure
     * - threeDSHtmlContent: html for browser redirect
     * - token_id/session_id: Paynet 3D identifiers
     */
    public function initializePayment(array $paymentData): array
    {
        $card = $paymentData['payment_card'] ?? [];
        $buyer = $paymentData['buyer'] ?? [];
        $billing = $paymentData['billing_address'] ?? [];

        $conversationId = (string)($paymentData['conversation_id'] ?? $this->db->generateUuid());
        $amount = (float)($paymentData['price'] ?? 0);
        if ($amount <= 0) {
            return [
                'status' => 'failure',
                'errorMessage' => 'Invalid amount'
            ];
        }

        $cardNumber = preg_replace('/\s+/', '', (string)($card['cardNumber'] ?? ''));
        $holderName = trim((string)($card['cardHolderName'] ?? ''));
        $expireMonth = str_pad((string)($card['expireMonth'] ?? ''), 2, '0', STR_PAD_LEFT);
        $expireYearRaw = (string)($card['expireYear'] ?? '');
        $expireYear = strlen($expireYearRaw) === 2 ? ('20' . $expireYearRaw) : $expireYearRaw;
        $cvc = (string)($card['cvc'] ?? '');

        if ($cardNumber === '' || $holderName === '' || $expireMonth === '' || $expireYear === '' || $cvc === '') {
            return [
                'status' => 'failure',
                'errorMessage' => 'Missing card information'
            ];
        }

        $returnUrl = (string)($paymentData['callback_url'] ?? '');
        if ($returnUrl === '') {
            return [
                'status' => 'failure',
                'errorMessage' => 'Missing return_url'
            ];
        }

        $requestData = [
            'card' => [
                'number' => $cardNumber,
                'holder_name' => $holderName,
                'expiry_month' => $expireMonth,
                'expiry_year' => $expireYear,
                'cvv' => $cvc
            ],
            'customer' => [
                'name' => trim((string)(($buyer['name'] ?? '') . ' ' . ($buyer['surname'] ?? ''))),
                'email' => (string)($buyer['email'] ?? ''),
                'phone_number' => (string)($buyer['gsmNumber'] ?? ''),
                'identity_number' => (string)($buyer['identityNumber'] ?? ''),
                'city' => (string)($buyer['city'] ?? ($billing['city'] ?? ''))
            ],
            'billing' => [
                'address_line' => (string)($billing['address'] ?? ''),
                'city' => (string)($billing['city'] ?? ''),
                'country' => (string)($billing['country'] ?? ''),
                'zip_code' => (string)($billing['zipCode'] ?? '')
            ],
            'invoice' => [
                'description' => (string)($paymentData['description'] ?? 'License payment')
            ],
            'transaction' => [
                'reference_no' => $conversationId,
                'amount' => $this->formatAmount($amount),
                'installment' => (int)($paymentData['installment'] ?? 1),
                'currency' => strtoupper((string)($paymentData['currency'] ?? 'TRY')),
                'return_url' => $returnUrl
            ]
        ];

        $result = $this->request(self::ENDPOINT_TDS_INITIAL, $requestData);
        if (!$result['success']) {
            return [
                'status' => 'failure',
                'errorMessage' => 'Paynet tds_initial request failed',
                'raw' => $result
            ];
        }

        $response = is_array($result['data']) ? $result['data'] : [];
        $code = (string)($response['code'] ?? '');
        $ok = ($code === '' || $code === '0');
        if (!$ok) {
            return [
                'status' => 'failure',
                'errorCode' => $response['code'] ?? 'PAYNET_INIT_FAILED',
                'errorMessage' => $response['message'] ?? 'Paynet tds_initial failed',
                'raw' => $response
            ];
        }

        $tokenId = (string)($response['token_id'] ?? '');
        $sessionId = (string)($response['session_id'] ?? '');
        $htmlContent = $response['html_content'] ?? null;
        $postUrl = (string)($response['post_url'] ?? '');

        if (!$htmlContent && $postUrl !== '' && $sessionId !== '' && $tokenId !== '') {
            $htmlContent = $this->buildAutoSubmitHtml($postUrl, $sessionId, $tokenId);
        }

        if (!$htmlContent) {
            return [
                'status' => 'failure',
                'errorCode' => 'PAYNET_3D_CONTENT_MISSING',
                'errorMessage' => 'Paynet 3D content missing',
                'raw' => $response
            ];
        }

        return [
            'status' => 'success',
            'threeDSHtmlContent' => $htmlContent,
            'token_id' => $tokenId ?: null,
            'session_id' => $sessionId ?: null,
            'post_url' => $postUrl !== '' ? $postUrl : null,
            'paymentId' => $tokenId ?: null,
            'raw' => $response
        ];
    }

    /**
     * Finalize Paynet 3D after callback payload.
     */
    public function verify3DPayment(string $sessionId, string $tokenId, int $amountKurus, string $returnUrl): array
    {
        $amountTl = max(0, $amountKurus) / 100;
        $result = $this->request(self::ENDPOINT_TDS_CHARGE, [
            'session_id' => $sessionId,
            'token_id' => $tokenId,
            'amount' => $this->formatAmount($amountTl),
            'return_url' => $returnUrl
        ]);

        if (!$result['success']) {
            return [
                'status' => 'failure',
                'errorMessage' => 'Paynet tds_charge request failed',
                'raw' => $result
            ];
        }

        $response = is_array($result['data']) ? $result['data'] : [];
        $code = (string)($response['code'] ?? '');
        $ok = ($code === '' || $code === '0');

        return [
            'status' => $ok ? 'success' : 'failure',
            'errorCode' => $ok ? null : ($response['code'] ?? 'PAYNET_CHARGE_FAILED'),
            'errorMessage' => $ok ? null : ($response['message'] ?? 'Paynet tds_charge failed'),
            'transaction_id' => $response['transaction_id'] ?? null,
            'raw' => $response
        ];
    }

    /**
     * Islem durumu kontrol
     *
     * @param string $transactionId
     * @return array
     */
    public function checkTransaction($transactionId)
    {
        return $this->request(self::ENDPOINT_CHECK, [
            'xact_id' => $transactionId
        ], 'GET');
    }

    /**
     * Iade islemi
     *
     * @param string $transactionId
     * @param int $amount Kurus cinsinden
     * @return array
     */
    public function refund($transactionId, $amount = null)
    {
        $data = [
            'xact_id' => $transactionId
        ];

        if ($amount !== null) {
            $data['amount'] = (int)$amount;
        }

        return $this->request(self::ENDPOINT_REFUND, $data);
    }

    /**
     * Iptal islemi
     *
     * @param string $transactionId
     * @return array
     */
    public function cancel($transactionId)
    {
        return $this->request(self::ENDPOINT_CANCEL, [
            'xact_id' => $transactionId
        ]);
    }

    /**
     * Baglanti testi
     */
    public function ping()
    {
        $startTime = microtime(true);

        // Basit bir check istegi ile test
        $result = $this->request(self::ENDPOINT_CHECK, [
            'xact_id' => 'test_ping_' . time()
        ], 'GET');

        $responseTime = round((microtime(true) - $startTime) * 1000);

        // 404 bile olsa API'ye ulastik demektir (gecersiz islem ID)
        $isOnline = $result['http_code'] > 0 && $result['http_code'] < 500;

        return [
            'success' => true,
            'online' => $isOnline,
            'response_time' => $responseTime,
            'http_code' => $result['http_code'],
            'is_test_mode' => $this->isTestMode
        ];
    }

    /**
     * Odeme islemi olustur ve veritabanina kaydet
     *
     * @param array $data Islem verileri
     * @return string Transaction ID
     */
    public function createTransaction($data)
    {
        $id = $this->db->generateUuid();
        $referenceNo = 'OMX-' . strtoupper(substr(md5(uniqid()), 0, 8)) . '-' . time();

        $this->db->insert('payment_transactions', [
            'id' => $id,
            'company_id' => $data['company_id'],
            'user_id' => $data['user_id'] ?? null,
            'license_id' => $data['license_id'] ?? null,
            'provider' => 'paynet',
            'reference_no' => $referenceNo,
            'amount' => $data['amount'],
            'currency' => $data['currency'] ?? 'TRY',
            'installment' => $data['installment'] ?? 1,
            'status' => 'pending',
            'transaction_type' => $data['transaction_type'] ?? 'sale',
            'license_plan' => $data['license_plan'] ?? null,
            'license_period' => $data['license_period'] ?? null,
            'license_extension_days' => $data['license_extension_days'] ?? null,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
            'metadata' => isset($data['metadata']) ? json_encode($data['metadata']) : null
        ]);

        return [
            'transaction_id' => $id,
            'reference_no' => $referenceNo
        ];
    }

    /**
     * Save transaction in a structure compatible with IyzicoGateway.
     */
    public function saveTransaction(array $data): string
    {
        $id = $this->db->generateUuid();
        $referenceNo = $data['reference_no'] ?? ('PMT-' . strtoupper(substr(md5(uniqid((string)mt_rand(), true)), 0, 10)));

        $this->db->insert('payment_transactions', [
            'id' => $id,
            'company_id' => $data['company_id'],
            'user_id' => $data['user_id'] ?? null,
            'license_id' => $data['license_id'] ?? null,
            'transaction_type' => $data['transaction_type'] ?? 'license_purchase',
            'amount' => $data['amount'],
            'currency' => $data['currency'] ?? 'TRY',
            'status' => $data['status'] ?? 'pending',
            'provider' => 'paynet',
            'provider_transaction_id' => $data['provider_transaction_id'] ?? null,
            'provider_payment_id' => $data['provider_payment_id'] ?? null,
            'reference_no' => $referenceNo,
            'session_id' => $data['session_id'] ?? null,
            'token_id' => $data['token_id'] ?? null,
            'basket_id' => $data['basket_id'] ?? null,
            'conversation_id' => $data['conversation_id'] ?? null,
            'installment' => $data['installment'] ?? 1,
            'buyer_email' => $data['buyer_email'] ?? null,
            'buyer_name' => $data['buyer_name'] ?? null,
            'buyer_phone' => $data['buyer_phone'] ?? null,
            'buyer_ip' => $data['buyer_ip'] ?? ($_SERVER['REMOTE_ADDR'] ?? null),
            'plan_id' => $data['plan_id'] ?? null,
            'metadata' => isset($data['metadata']) ? json_encode($data['metadata']) : null,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);

        return $id;
    }

    /**
     * Islem durumunu guncelle
     */
    public function updateTransaction($id, $data)
    {
        $updateData = [];

        $allowedFields = [
            'transaction_id', 'session_id', 'token_id', 'status',
            'is_3d', 'tds_status', 'card_holder_name', 'card_masked_pan',
            'card_brand', 'card_bank_name', 'error_code', 'error_message',
            'provider_response', 'provider_transaction_id', 'provider_payment_id',
            'paid_at', 'completed_at'
        ];

        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $updateData[$field] = $data[$field];
            }
        }

        if (isset($data['raw_response'])) {
            $updateData['provider_response'] = is_array($data['raw_response'])
                ? json_encode($data['raw_response'])
                : $data['raw_response'];
        } elseif (isset($data['callback_data'])) {
            $updateData['provider_response'] = is_array($data['callback_data'])
                ? json_encode($data['callback_data'])
                : $data['callback_data'];
        }

        if (!empty($updateData)) {
            $updateData['updated_at'] = date('Y-m-d H:i:s');
            $this->db->update('payment_transactions', $updateData, 'id = ?', [$id]);
        }
    }

    /**
     * Odeme tamamlandi - Lisansi yenile
     */
    public function processLicenseRenewal($transactionId)
    {
        $transaction = $this->db->fetch(
            "SELECT * FROM payment_transactions WHERE id = ?",
            [$transactionId]
        );

        if (!$transaction || $transaction['status'] !== 'completed') {
            return [
                'success' => false,
                'error' => 'Gecersiz veya tamamlanmamis islem'
            ];
        }

        $licenseId = $transaction['license_id'];

        if (empty($licenseId)) {
            // Yeni lisans olustur
            return $this->createNewLicense($transaction);
        } else {
            // Mevcut lisansi uzat
            return $this->extendLicense($transaction);
        }
    }

    /**
     * Yeni lisans olustur
     */
    private function createNewLicense($transaction)
    {
        $plan = $transaction['license_plan'] ?? 'Standard';
        $period = $transaction['license_period'] ?? 'monthly';

        // Plan limitlerini al
        $planData = $this->db->fetch(
            "SELECT * FROM license_plans WHERE name = ? OR slug = ?",
            [$plan, strtolower($plan)]
        );

        // Bitis tarihini hesapla
        $startDate = date('Y-m-d');
        switch ($period) {
            case 'yearly':
                $endDate = date('Y-m-d', strtotime('+1 year'));
                break;
            case 'lifetime':
                $endDate = date('Y-m-d', strtotime('+100 years'));
                break;
            default:
                $endDate = date('Y-m-d', strtotime('+1 month'));
        }

        // Lisans anahtari olustur
        $licenseKey = strtoupper(implode('-', [
            bin2hex(random_bytes(4)),
            bin2hex(random_bytes(2)),
            bin2hex(random_bytes(2)),
            bin2hex(random_bytes(2)),
            bin2hex(random_bytes(6))
        ]));

        $licenseId = $this->db->generateUuid();

        $this->db->insert('licenses', [
            'id' => $licenseId,
            'company_id' => $transaction['company_id'],
            'license_key' => $licenseKey,
            'type' => $plan,
            'valid_from' => $startDate,
            'valid_until' => $endDate,
            'status' => 'active',
            'max_devices' => $planData ? ($planData['esl_limit'] + $planData['tv_limit']) : 100
        ]);

        // Transaction'i guncelle
        $this->db->update('payment_transactions', [
            'license_id' => $licenseId
        ], 'id = ?', [$transaction['id']]);

        return [
            'success' => true,
            'license_id' => $licenseId,
            'license_key' => $licenseKey,
            'valid_until' => $endDate
        ];
    }

    /**
     * Mevcut lisansi uzat
     */
    private function extendLicense($transaction)
    {
        $license = $this->db->fetch(
            "SELECT * FROM licenses WHERE id = ?",
            [$transaction['license_id']]
        );

        if (!$license) {
            return [
                'success' => false,
                'error' => 'Lisans bulunamadi'
            ];
        }

        // Mevcut bitis tarihinden veya bugunden itibaren uzat
        $currentEnd = new DateTime($license['valid_until']);
        $now = new DateTime();

        $baseDate = ($currentEnd > $now) ? $currentEnd : $now;

        $period = $transaction['license_period'] ?? 'monthly';
        $extensionDays = $transaction['license_extension_days'];

        if ($extensionDays) {
            $baseDate->modify("+{$extensionDays} days");
        } else {
            switch ($period) {
                case 'yearly':
                    $baseDate->modify('+1 year');
                    break;
                case 'lifetime':
                    $baseDate->modify('+100 years');
                    break;
                default:
                    $baseDate->modify('+1 month');
            }
        }

        $newEndDate = $baseDate->format('Y-m-d');

        // Lisansi guncelle
        $this->db->update('licenses', [
            'valid_until' => $newEndDate,
            'status' => 'active'
        ], 'id = ?', [$license['id']]);

        return [
            'success' => true,
            'license_id' => $license['id'],
            'old_valid_until' => $license['valid_until'],
            'new_valid_until' => $newEndDate
        ];
    }

    /**
     * Ayarlari kaydet (SuperAdmin only)
     */
    public function saveSettings($data)
    {
        $existing = $this->db->fetch(
            "SELECT id FROM payment_settings WHERE provider = 'paynet'"
        );

        // Frontend 'status' gonderir, veritabani 'is_active' bekler
        $isActive = 0;
        if (isset($data['status'])) {
            $isActive = ($data['status'] === 'active') ? 1 : 0;
        } elseif (isset($data['is_active'])) {
            $isActive = $data['is_active'] ? 1 : 0;
        }

        // Frontend 'environment' gonderir, veritabani 'is_test_mode' bekler
        $isTestMode = 1;
        if (isset($data['environment'])) {
            $isTestMode = ($data['environment'] === 'sandbox') ? 1 : 0;
        } elseif (isset($data['is_test_mode'])) {
            $isTestMode = $data['is_test_mode'] ? 1 : 0;
        }

        $settingsData = [
            'is_active' => $isActive,
            'is_test_mode' => $isTestMode,
            'publishable_key' => $data['publishable_key'] ?? '',
            'api_url' => $data['api_url'] ?? self::API_URL_LIVE,
            'callback_url' => $data['callback_url'] ?? '',
            'updated_at' => date('Y-m-d H:i:s')
        ];

        // Secret key degistiyse sifrele
        if (!empty($data['secret_key'])) {
            $settingsData['secret_key'] = $this->encryptKey($data['secret_key']);
        }

        // Ek ayarlar
        if (!empty($data['settings'])) {
            $settingsData['settings_json'] = json_encode($data['settings']);
        }

        if ($existing) {
            $this->db->update('payment_settings', $settingsData, 'id = ?', [$existing['id']]);
        } else {
            $settingsData['id'] = $this->db->generateUuid();
            $settingsData['provider'] = 'paynet';
            $this->db->insert('payment_settings', $settingsData);
        }

        return ['success' => true];
    }

    /**
     * Ayarlari getir (secret key maskelenmis)
     */
    public function getSettings($includeMaskedKey = true)
    {
        $settings = $this->db->fetch(
            "SELECT * FROM payment_settings WHERE provider = 'paynet' LIMIT 1"
        );

        if (!$settings) {
            return [
                'provider' => 'paynet',
                'status' => 'inactive',
                'environment' => 'sandbox',
                'publishable_key' => '',
                'secret_key_masked' => '',
                'has_secret_key' => false,
                'api_url' => self::API_URL_LIVE
            ];
        }

        // Veritabani alanlarini frontend formatina donustur
        $result = [
            'id' => $settings['id'],
            'provider' => 'paynet',
            'status' => ($settings['is_active'] ?? 0) ? 'active' : 'inactive',
            'environment' => ($settings['is_test_mode'] ?? 1) ? 'sandbox' : 'production',
            'publishable_key' => $settings['publishable_key'] ?? '',
            'api_url' => $settings['api_url'] ?? self::API_URL_LIVE,
            'callback_url' => $settings['callback_url'] ?? ''
        ];

        // Secret key'i maskele
        if ($includeMaskedKey && !empty($settings['secret_key'])) {
            $decrypted = $this->decryptKey($settings['secret_key']);
            if (strlen($decrypted) > 8) {
                $result['secret_key_masked'] = substr($decrypted, 0, 4) . str_repeat('*', strlen($decrypted) - 8) . substr($decrypted, -4);
            } else {
                $result['secret_key_masked'] = '****';
            }
            $result['has_secret_key'] = true;
        } else {
            $result['secret_key_masked'] = '';
            $result['has_secret_key'] = false;
        }

        return $result;
    }

    /**
     * Lisans planlari listesi
     */
    public function getLicensePlans(bool $includeInactive = false)
    {
        $activePlanFilter = $this->db->isPostgres()
            ? "(status = 'active' OR is_active IS TRUE)"
            : "(status = 'active' OR is_active = 1)";

        $query = "SELECT * FROM license_plans";
        if (!$includeInactive) {
            $query .= " WHERE $activePlanFilter";
        }
        $query .= " ORDER BY sort_order ASC";

        return $this->db->fetchAll($query);
    }

    /**
     * Publishable key'i getir (frontend icin)
     */
    public function getPublishableKey()
    {
        $settings = $this->db->fetch(
            "SELECT publishable_key, is_active, is_test_mode FROM payment_settings WHERE provider = 'paynet' LIMIT 1"
        );

        if (!$settings || !$settings['is_active']) {
            return null;
        }

        return [
            'publishable_key' => $settings['publishable_key'],
            'is_test_mode' => (bool)$settings['is_test_mode']
        ];
    }
}
