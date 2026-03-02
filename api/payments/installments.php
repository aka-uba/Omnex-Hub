<?php
/**
 * Payment Installments API
 *
 * POST - Kart BIN numarasina gore taksit seceneklerini getirir.
 */

require_once __DIR__ . '/../../services/IyzicoGateway.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$method = (new Request())->getMethod();

if ($method !== 'POST') {
    Response::methodNotAllowed('Sadece POST desteklenir');
}

$request = new Request();
$data = $request->json();

// Validasyon
if (empty($data['bin_number'])) {
    Response::badRequest('Kart numarasinin ilk 6 hanesi (BIN) gerekli');
}

if (empty($data['price'])) {
    Response::badRequest('Fiyat gerekli');
}

$binNumber = preg_replace('/\D/', '', $data['bin_number']);
if (strlen($binNumber) < 6) {
    Response::badRequest('BIN numarasi en az 6 hane olmali');
}

// Sadece ilk 6 haneyi al
$binNumber = substr($binNumber, 0, 6);
$price = (float)$data['price'];

if ($price <= 0) {
    Response::badRequest('Gecersiz fiyat');
}

try {
    $gateway = new IyzicoGateway();

    // Odeme sistemi aktif mi kontrol et
    $settings = $gateway->getSettings();
    if ($settings['status'] !== 'active') {
        Response::badRequest('Odeme sistemi aktif degil');
    }

    // Taksit desteği kapalıysa
    if (!$settings['installment_enabled']) {
        Response::success([
            'installment_enabled' => false,
            'message' => 'Taksit secenegi aktif degil',
            'installments' => []
        ]);
    }

    // Iyzico'dan taksit seceneklerini al
    $result = $gateway->getInstallmentOptions($binNumber, $price);

    if ($result['status'] !== 'success') {
        Response::badRequest($result['errorMessage'] ?? 'Taksit bilgisi alinamadi');
    }

    // Taksit seceneklerini formatla
    $installmentDetails = $result['installmentDetails'] ?? [];
    $formattedInstallments = [];

    foreach ($installmentDetails as $detail) {
        $installmentPrices = $detail['installmentPrices'] ?? [];

        foreach ($installmentPrices as $option) {
            $installmentNumber = (int)$option['installmentNumber'];

            // Maksimum taksit kontrolu
            if ($installmentNumber > $settings['max_installments']) {
                continue;
            }

            $formattedInstallments[] = [
                'installment_number' => $installmentNumber,
                'total_price' => (float)$option['totalPrice'],
                'installment_price' => (float)$option['installmentPrice'],
                'formatted_total' => formatPrice($option['totalPrice'], $settings['currency']),
                'formatted_installment' => formatPrice($option['installmentPrice'], $settings['currency'])
            ];
        }

        // Kart bilgileri
        $cardInfo = [
            'bank_name' => $detail['bankName'] ?? null,
            'bank_code' => $detail['bankCode'] ?? null,
            'card_type' => $detail['cardType'] ?? null,
            'card_association' => $detail['cardAssociation'] ?? null,
            'card_family' => $detail['cardFamilyName'] ?? null,
            'commercial' => (bool)($detail['commercial'] ?? false),
            'force_3ds' => (bool)($detail['force3ds'] ?? false)
        ];
    }

    Response::success([
        'installment_enabled' => true,
        'card_info' => $cardInfo ?? null,
        'installments' => $formattedInstallments,
        'max_installments' => $settings['max_installments']
    ]);

} catch (Exception $e) {
    Logger::error('Installment options error', ['error' => $e->getMessage()]);
    Response::serverError('Taksit bilgisi alinamadi: ' . $e->getMessage());
}

/**
 * Fiyat formatlama
 */
function formatPrice($amount, $currency = 'TRY')
{
    $symbols = [
        'TRY' => '₺',
        'USD' => '$',
        'EUR' => '€'
    ];

    $symbol = $symbols[$currency] ?? $currency . ' ';

    return $symbol . number_format($amount, 2, ',', '.');
}
