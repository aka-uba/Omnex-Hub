<?php
/**
 * Payment Init API
 *
 * Active provider (Iyzico/Paynet) 3D odeme islemini baslatir.
 * POST - Odeme baslatma istegi
 */

require_once __DIR__ . '/../../services/IyzicoGateway.php';
require_once __DIR__ . '/../../services/PaynetGateway.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$request = new Request();
$method = $request->getMethod();
$activeProviderFilter = "(status = 'active' OR is_active = true)";
$activeProviderOrder = "CASE WHEN is_active = true THEN 0 ELSE 1 END, COALESCE(updated_at, created_at) DESC";
$activePlanFilter = "(status = 'active' OR is_active = true)";

if ($method !== 'POST') {
    Response::methodNotAllowed('Sadece POST desteklenir');
}

$data = $request->json();
$isSuperAdmin = strcasecmp((string)($user['role'] ?? ''), 'SuperAdmin') === 0;

try {
    $activeProvider = $db->fetch(
        "SELECT provider, status, is_active
         FROM payment_settings
         WHERE $activeProviderFilter
         ORDER BY $activeProviderOrder
         LIMIT 1"
    );
    $provider = $activeProvider['provider'] ?? 'iyzico';
    $gateway = ($provider === 'paynet') ? new PaynetGateway() : new IyzicoGateway();

    // Odeme sistemi aktif mi kontrol et
    $settings = $gateway->getSettings();
    $isPaymentActive = ($settings['status'] ?? 'inactive') === 'active'
        || ($settings['is_active'] ?? false) === true
        || (int)($settings['is_active'] ?? 0) === 1;
    if (!$isPaymentActive) {
        Response::badRequest('Odeme sistemi aktif degil');
    }

    // Plan ID zorunlu (slug/name fallback destekli)
    $planId = $data['plan_id'] ?? null;
    if (!$planId && !empty($data['license_plan'])) {
        $planBySlug = $db->fetch(
            "SELECT id FROM license_plans WHERE slug = ? OR name = ? LIMIT 1",
            [$data['license_plan'], $data['license_plan']]
        );
        $planId = $planBySlug['id'] ?? null;
    }

    if (empty($planId)) {
        Response::badRequest('Gecersiz lisans plani');
    }

    // Lisans planini al
    $plan = $db->fetch(
        "SELECT * FROM license_plans WHERE id = ? AND $activePlanFilter",
        [$planId]
    );

    if (!$plan) {
        Response::badRequest('Gecersiz veya pasif lisans plani');
    }

    // Company ID
    $companyId = $data['company_id'] ?? Auth::getActiveCompanyId() ?? ($user['company_id'] ?? null);
    if (empty($companyId)) {
        Response::badRequest('Firma bilgisi gerekli');
    }

    if (!$isSuperAdmin && ($user['company_id'] ?? null) !== $companyId) {
        Response::forbidden('Sadece kendi firmaniz icin odeme baslatabilirsiniz');
    }

    $licenseId = $data['license_id'] ?? null;
    $currentLicense = null;
    if (!empty($licenseId)) {
        $currentLicense = $db->fetch("SELECT * FROM licenses WHERE id = ?", [$licenseId]);
        if (!$currentLicense) {
            Response::badRequest('Gecersiz lisans kaydi');
        }

        if (($currentLicense['company_id'] ?? null) !== $companyId) {
            Response::forbidden('Bu lisans icin odeme baslatamazsiniz');
        }
    }

    // Card payload zorunlu (bu endpoint tek adimda initialize + 3D baslatir)
    $paymentCardInput = $data['payment_card'] ?? [];
    $requiredCardFields = ['card_holder_name', 'card_number', 'expire_month', 'expire_year', 'cvc'];
    foreach ($requiredCardFields as $field) {
        if (empty($paymentCardInput[$field])) {
            Response::badRequest("Eksik kart bilgisi: {$field}");
        }
    }

    // Price calculation (plan price is stored in kurus)
    $planPriceKurus = (float)($plan['price'] ?? 0);
    $planDurationMonths = (int)($plan['duration_months'] ?? 1);
    if ($planDurationMonths <= 0) {
        $planDurationMonths = 1;
    }

    $requestedPeriod = strtolower((string)($data['license_period'] ?? 'plan'));
    $renewalMonths = match ($requestedPeriod) {
        'monthly' => 1,
        'yearly' => 12,
        'lifetime' => 1200,
        default => $planDurationMonths
    };

    $features = [];
    if (!empty($plan['features'])) {
        $decodedFeatures = json_decode($plan['features'], true);
        if (is_array($decodedFeatures)) {
            $features = $decodedFeatures;
        }
    }

    $isPerDevicePricing = in_array('per_device_pricing', $features, true)
        || (($plan['plan_type'] ?? '') === 'per_device');
    $decodedDeviceCategories = [];
    if (!empty($plan['device_categories'])) {
        $decodedDeviceCategories = json_decode($plan['device_categories'], true);
        if (!is_array($decodedDeviceCategories)) {
            $decodedDeviceCategories = [];
        }
    }
    $hasDeviceCategories = !empty($decodedDeviceCategories);
    $isPerDeviceTypePricing = $hasDeviceCategories
        || (($currentLicense['pricing_mode'] ?? 'flat') === 'per_device_type');

    $deviceCount = 1;
    if ($isPerDevicePricing) {
        $requestedBillableDevices = (int)($data['billable_devices'] ?? 0);
        if ($requestedBillableDevices > 0) {
            $deviceCount = $requestedBillableDevices;
        } else {
            $deviceRow = $db->fetch(
                "SELECT COUNT(*) as count FROM devices WHERE company_id = ?",
                [$companyId]
            );
            $deviceCount = (int)($deviceRow['count'] ?? 0);
        }

        $maxDevices = (int)($plan['max_devices'] ?? -1);
        if ($maxDevices > 0 && $deviceCount > $maxDevices) {
            $deviceCount = $maxDevices;
        }

        $deviceCount = max(1, $deviceCount);
    }

    // Plan price represents total plan duration amount.
    // Convert to monthly equivalent, then apply requested renewal period.
    $monthlyPriceKurus = $planPriceKurus / $planDurationMonths;
    $amountKurus = (int)round($monthlyPriceKurus * $renewalMonths);

    if ($isPerDeviceTypePricing && $currentLicense) {
        $fixedMonthlyTotal = (float)($currentLicense['total_monthly_price'] ?? 0);
        $amountKurus = (int)round($fixedMonthlyTotal * 100 * $renewalMonths);
    }

    if ($isPerDevicePricing) {
        $amountKurus = (int)round($amountKurus * $deviceCount);
    }

    if ($amountKurus <= 0) {
        Response::badRequest('Bu plan icin odeme gerekmemektedir');
    }

    $amountTl = $amountKurus / 100;

    // Buyer defaults
    $buyerInput = $data['buyer'] ?? [];
    $billingInput = $data['billing_address'] ?? [];

    $buyerName = trim((string)($buyerInput['name'] ?? ($user['first_name'] ?? 'Kullanici')));
    $buyerSurname = trim((string)($buyerInput['surname'] ?? ($user['last_name'] ?? '')));
    $buyerEmail = trim((string)($buyerInput['email'] ?? ($user['email'] ?? '')));

    if ($buyerEmail === '') {
        Response::badRequest('Odeme icin e-posta bilgisi gerekli');
    }

    $buyer = [
        'id' => $user['id'],
        'name' => $buyerName !== '' ? $buyerName : 'Kullanici',
        'surname' => $buyerSurname,
        'gsmNumber' => $buyerInput['phone'] ?? '',
        'email' => $buyerEmail,
        'identityNumber' => $buyerInput['identity_number'] ?? '11111111111',
        'lastLoginDate' => date('Y-m-d H:i:s'),
        'registrationDate' => $user['created_at'] ?? date('Y-m-d H:i:s'),
        'registrationAddress' => $billingInput['address'] ?? 'Adres bilgisi girilmedi',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
        'city' => $billingInput['city'] ?? 'Istanbul',
        'country' => $billingInput['country'] ?? 'Turkey',
        'zipCode' => $billingInput['zip_code'] ?? '34000'
    ];

    $billingAddress = [
        'contactName' => trim(($buyer['name'] ?? '') . ' ' . ($buyer['surname'] ?? '')),
        'city' => $billingInput['city'] ?? 'Istanbul',
        'country' => $billingInput['country'] ?? 'Turkey',
        'address' => $billingInput['address'] ?? 'Adres bilgisi girilmedi',
        'zipCode' => $billingInput['zip_code'] ?? '34000'
    ];

    $paymentCard = [
        'cardHolderName' => $paymentCardInput['card_holder_name'],
        'cardNumber' => preg_replace('/\s+/', '', $paymentCardInput['card_number']),
        'expireMonth' => $paymentCardInput['expire_month'],
        'expireYear' => $paymentCardInput['expire_year'],
        'cvc' => $paymentCardInput['cvc'],
        'registerCard' => $paymentCardInput['register_card'] ?? 0
    ];

    // Basket ID / Conversation ID
    $basketId = $db->generateUuid();
    $conversationId = $db->generateUuid();

    // Callback URL
    $callbackUrl = $settings['callback_url'] ?? null;
    if (empty($callbackUrl)) {
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $basePath = dirname(dirname($_SERVER['SCRIPT_NAME']));
        $callbackFile = ($provider === 'paynet') ? 'callback-paynet.php' : 'callback-3d.php';
        $callbackUrl = "{$protocol}://{$host}{$basePath}/payments/{$callbackFile}";
    }
    if ($provider === 'paynet' && strpos($callbackUrl, 'conversation_id=') === false) {
        $separator = (strpos($callbackUrl, '?') === false) ? '?' : '&';
        $callbackUrl .= $separator . 'conversation_id=' . urlencode($conversationId);
    }

    $basketItems = [
        [
            'id' => $plan['id'],
            'name' => $plan['name'],
            'category1' => 'Lisans',
            'category2' => $plan['plan_type'] ?? 'Subscription',
            'itemType' => 'VIRTUAL',
            'price' => number_format($amountTl, 2, '.', ''),
            'subMerchantKey' => null,
            'subMerchantPrice' => null
        ]
    ];

    // Islem kaydi
    $transactionId = $gateway->saveTransaction([
        'company_id' => $companyId,
        'user_id' => $user['id'],
        'license_id' => $data['license_id'] ?? null,
        'transaction_type' => 'license_purchase',
        'amount' => $amountKurus,
        'currency' => $plan['currency'] ?? 'TRY',
        'status' => 'pending',
        'reference_no' => $conversationId,
        'basket_id' => $basketId,
        'conversation_id' => $conversationId,
        'installment' => (int)($data['installment'] ?? 1),
        'buyer_email' => $buyer['email'],
        'buyer_name' => trim(($buyer['name'] ?? '') . ' ' . ($buyer['surname'] ?? '')),
        'buyer_phone' => $buyer['gsmNumber'],
        'buyer_ip' => $buyer['ip'],
        'plan_id' => $plan['id'],
        'metadata' => [
            'plan_id' => $plan['id'],
            'plan_name' => $plan['name'],
            'duration_months' => $planDurationMonths,
            'renewal_months' => $renewalMonths,
            'pricing_mode' => $isPerDeviceTypePricing
                ? 'per_device_type'
                : ($isPerDevicePricing ? 'per_device' : 'flat'),
            'device_count' => $isPerDevicePricing ? $deviceCount : null,
            'company_monthly_total' => $isPerDeviceTypePricing && $currentLicense
                ? (float)($currentLicense['total_monthly_price'] ?? 0)
                : null
        ]
    ]);

    // Iyzico initialize
    $paymentData = [
        'conversation_id' => $conversationId,
        'price' => $amountTl,
        'paid_price' => $amountTl,
        'currency' => $plan['currency'] ?? 'TRY',
        'basket_id' => $basketId,
        'installment' => (int)($data['installment'] ?? 1),
        'callback_url' => $callbackUrl,
        'buyer' => $buyer,
        'billing_address' => $billingAddress,
        'shipping_address' => $billingAddress,
        'basket_items' => $basketItems,
        'payment_card' => $paymentCard,
        'description' => ($plan['name'] ?? 'License') . ' license payment'
    ];

    $result = $gateway->initializePayment($paymentData);

    if (($result['status'] ?? 'failure') !== 'success') {
        $gateway->updateTransaction($transactionId, [
            'status' => 'failed',
            'error_code' => $result['errorCode'] ?? 'INIT_FAILED',
            'error_message' => $result['errorMessage'] ?? 'Odeme baslatma hatasi',
            'raw_response' => $result
        ]);

        Response::badRequest($result['errorMessage'] ?? 'Odeme baslatma hatasi');
    }

    $updatePayload = [
        'provider_payment_id' => $result['paymentId'] ?? null,
        'raw_response' => $result
    ];
    if (!empty($result['session_id'])) {
        $updatePayload['session_id'] = $result['session_id'];
    }
    if (!empty($result['token_id'])) {
        $updatePayload['token_id'] = $result['token_id'];
    }
    $gateway->updateTransaction($transactionId, $updatePayload);

    Logger::audit('payment_initiated', 'payment', [
        'transaction_id' => $transactionId,
        'amount_kurus' => $amountKurus,
        'plan' => $plan['name'],
        'user_id' => $user['id']
    ]);

    Response::success([
        'transaction_id' => $transactionId,
        'reference_no' => $conversationId,
        'conversation_id' => $conversationId,
        'provider' => $provider,
        'threeDSHtmlContent' => $result['threeDSHtmlContent'] ?? null,
        'post_url' => $result['post_url'] ?? null,
        'status' => $result['status'] ?? 'success',
        'amount' => $amountKurus,
        'currency' => $plan['currency'] ?? 'TRY',
        'pricing' => [
            'mode' => $isPerDevicePricing ? 'per_device' : 'flat',
            'device_count' => $deviceCount,
            'renewal_months' => $renewalMonths
        ]
    ]);

} catch (Exception $e) {
    Logger::error('Payment init error', ['error' => $e->getMessage()]);
    Response::serverError('Odeme baslatma hatasi: ' . $e->getMessage());
}
