<?php
/**
 * Payment Status API
 *
 * GET - Odeme isleminin durumunu sorgular.
 */

require_once __DIR__ . '/../../services/IyzicoGateway.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$method = $request->getMethod();

if ($method !== 'GET') {
    Response::methodNotAllowed('Sadece GET desteklenir');
}

$transactionId = $request->routeParam('id');

if (empty($transactionId)) {
    Response::badRequest('Islem ID gerekli');
}

try {
    // Islem kaydini bul
    $transaction = $db->fetch(
        "SELECT pt.*, c.name as company_name
         FROM payment_transactions pt
         LEFT JOIN companies c ON pt.company_id = c.id
         WHERE pt.id = ? OR pt.provider_payment_id = ? OR pt.conversation_id = ?",
        [$transactionId, $transactionId, $transactionId]
    );

    if (!$transaction) {
        Response::notFound('Islem bulunamadi');
    }

    // Kullanicinin kendi islemi mi kontrol et (SuperAdmin haric)
    if ($user['role'] !== 'SuperAdmin' && $transaction['company_id'] !== $user['company_id']) {
        Response::forbidden('Bu islemi goruntuleme yetkiniz yok');
    }

    // Pending durumda ve provider_payment_id varsa Iyzico'dan guncel durumu sor
    if ($transaction['status'] === 'pending' && !empty($transaction['provider_payment_id'])) {
        try {
            $gateway = new IyzicoGateway();
            $iyzicoStatus = $gateway->getPaymentStatus($transaction['provider_payment_id']);

            if ($iyzicoStatus['status'] === 'success' && isset($iyzicoStatus['paymentStatus'])) {
                $newStatus = match($iyzicoStatus['paymentStatus']) {
                    'SUCCESS' => 'completed',
                    'FAILURE' => 'failed',
                    'INIT_THREEDS', 'CALLBACK_THREEDS' => 'processing',
                    default => $transaction['status']
                };

                if ($newStatus !== $transaction['status']) {
                    $gateway->updateTransaction($transaction['id'], [
                        'status' => $newStatus
                    ]);
                    $transaction['status'] = $newStatus;
                }
            }
        } catch (Exception $e) {
            // Iyzico sorgu hatasi loglama
            Logger::warning('Iyzico status check failed', ['error' => $e->getMessage()]);
        }
    }

    // Islem bilgilerini formatla
    $response = [
        'id' => $transaction['id'],
        'provider_transaction_id' => $transaction['provider_transaction_id'],
        'provider_payment_id' => $transaction['provider_payment_id'],
        'conversation_id' => $transaction['conversation_id'],
        'status' => $transaction['status'],
        'amount' => (float)$transaction['amount'],
        'paid_price' => $transaction['paid_price'] ? (float)$transaction['paid_price'] : null,
        'currency' => $transaction['currency'],
        'installment' => (int)$transaction['installment'],
        'transaction_type' => $transaction['transaction_type'],
        'company' => [
            'id' => $transaction['company_id'],
            'name' => $transaction['company_name']
        ],
        'card' => [
            'type' => $transaction['card_type'],
            'association' => $transaction['card_association'],
            'family' => $transaction['card_family'],
            'last_four' => $transaction['card_last_four']
        ],
        'buyer' => [
            'name' => $transaction['buyer_name'],
            'email' => $transaction['buyer_email']
        ],
        'created_at' => $transaction['created_at'],
        'paid_at' => $transaction['paid_at']
    ];

    // Hata varsa ekle
    if ($transaction['status'] === 'failed') {
        $response['error'] = [
            'code' => $transaction['error_code'],
            'message' => $transaction['error_message']
        ];
    }

    // Lisans bilgisi varsa ekle
    if (!empty($transaction['license_id'])) {
        $license = $db->fetch("SELECT * FROM licenses WHERE id = ?", [$transaction['license_id']]);
        if ($license) {
            $response['license'] = [
                'id' => $license['id'],
                'plan_name' => $license['plan_name'],
                'valid_until' => $license['valid_until'],
                'status' => $license['status']
            ];
        }
    }

    Response::success($response);

} catch (Exception $e) {
    Logger::error('Payment status error', ['error' => $e->getMessage()]);
    Response::serverError('Islem durumu alinamadi');
}
