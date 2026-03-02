<?php
/**
 * Payment Callback API
 *
 * Iyzico webhook callback endpoint.
 * Iyzico asenkron olarak odeme durumu bildirimleri gonderir.
 *
 * POST - Webhook bildirimi al
 * GET  - Callback URL dogrulama
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../services/IyzicoGateway.php';

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// GET istegi - URL dogrulama icin
if ($method === 'GET') {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Iyzico callback endpoint is active',
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit;
}

// POST istegi - Webhook bildirimi
if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Raw input al
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!$data) {
    // Form data olarak gelmis olabilir
    $data = $_POST;
}

// Log gelen veriyi
Logger::info('Iyzico callback received', [
    'raw_input' => substr($rawInput, 0, 500),
    'post_data' => $data
]);

// Gerekli alanlar
$iyziEventType = $data['iyziEventType'] ?? null;
$token = $data['token'] ?? null;
$paymentId = $data['paymentId'] ?? null;
$paymentConversationId = $data['paymentConversationId'] ?? null;
$status = $data['status'] ?? null;

try {
    // Conversation ID ile transaction'i bul
    $transaction = null;

    if ($paymentConversationId) {
        $transaction = $db->fetch(
            "SELECT * FROM payment_transactions WHERE conversation_id = ?",
            [$paymentConversationId]
        );
    }

    if (!$transaction && $paymentId) {
        $transaction = $db->fetch(
            "SELECT * FROM payment_transactions WHERE provider_payment_id = ?",
            [$paymentId]
        );
    }

    if (!$transaction) {
        Logger::warning('Iyzico callback: Transaction not found', [
            'conversation_id' => $paymentConversationId,
            'payment_id' => $paymentId
        ]);

        http_response_code(200); // Iyzico'ya 200 don ki tekrar denemesin
        echo json_encode(['success' => false, 'message' => 'Transaction not found']);
        exit;
    }

    $gateway = new IyzicoGateway();

    // Event tipine gore isle
    switch ($iyziEventType) {
        case 'PAYMENT_APPROVAL':
            // Odeme onaylandi
            if ($status === 'SUCCESS') {
                $gateway->updateTransaction($transaction['id'], [
                    'status' => 'completed',
                    'provider_payment_id' => $paymentId,
                    'callback_data' => $data,
                    'paid_at' => date('Y-m-d H:i:s')
                ]);

                // KRITIK: Lisans olustur veya uzat
                $companyId = $transaction['company_id'];
                $metadata = json_decode($transaction['metadata'] ?? '{}', true);
                $planId = $metadata['plan_id'] ?? $transaction['plan_id'] ?? null;

                if ($planId && $companyId) {
                    // Plan bilgisini al
                    $plan = $db->fetch("SELECT * FROM license_plans WHERE id = ?", [$planId]);

                    if ($plan) {
                        // Bitis tarihini hesapla
                        $validUntil = null;
                        $durationMonths = (int)($plan['duration_months'] ?? 0);
                        if (!empty($metadata['renewal_months'])) {
                            $durationMonths = (int)$metadata['renewal_months'];
                        }

                        if ($durationMonths > 0) {
                            $validUntil = date('Y-m-d', strtotime("+{$durationMonths} months"));
                        }
                        // duration_months = 0 veya null ise sinirsiz lisans

                        // Mevcut aktif lisans var mi kontrol et
                        $existingLicense = $db->fetch(
                            "SELECT * FROM licenses WHERE company_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
                            [$companyId]
                        );

                        if ($existingLicense) {
                            // Mevcut lisansi uzat
                            $newValidUntil = $validUntil;

                            // Eger mevcut lisansin suresi varsa, ustune ekle
                            if ($existingLicense['valid_until'] && $durationMonths > 0) {
                                $currentExpiry = strtotime($existingLicense['valid_until']);
                                $now = time();
                                // Henuz dolmamissa mevcut tarihin ustune ekle
                                if ($currentExpiry > $now) {
                                    $newValidUntil = date('Y-m-d', strtotime("+{$durationMonths} months", $currentExpiry));
                                }
                            }

                            $db->update('licenses', [
                                'plan_id' => $planId,
                                'valid_until' => $newValidUntil,
                                'external_id' => $transaction['id'],
                                'updated_at' => date('Y-m-d H:i:s')
                            ], 'id = ?', [$existingLicense['id']]);

                            Logger::info('License extended via payment', [
                                'license_id' => $existingLicense['id'],
                                'plan_id' => $planId,
                                'new_valid_until' => $newValidUntil
                            ]);
                        } else {
                            // Yeni lisans olustur
                            $licenseKey = strtoupper(implode('-', [
                                bin2hex(random_bytes(4)),
                                bin2hex(random_bytes(2)),
                                bin2hex(random_bytes(2)),
                                bin2hex(random_bytes(2)),
                                bin2hex(random_bytes(6))
                            ]));

                            $licenseId = $db->generateUuid();
                            $db->insert('licenses', [
                                'id' => $licenseId,
                                'company_id' => $companyId,
                                'license_key' => $licenseKey,
                                'plan_id' => $planId,
                                'valid_from' => date('Y-m-d'),
                                'valid_until' => $validUntil,
                                'status' => 'active',
                                'external_id' => $transaction['id'],
                                'created_at' => date('Y-m-d H:i:s'),
                                'updated_at' => date('Y-m-d H:i:s')
                            ]);

                            Logger::info('License created via payment', [
                                'license_id' => $licenseId,
                                'company_id' => $companyId,
                                'plan_id' => $planId,
                                'valid_until' => $validUntil
                            ]);
                        }

                        // Bildirim gonder
                        if (class_exists('NotificationTriggers')) {
                            NotificationTriggers::onPaymentSuccess($companyId, $plan['name'] ?? 'Plan');
                        }
                    } else {
                        Logger::error('Payment callback: Plan not found', ['plan_id' => $planId]);
                    }
                } else {
                    Logger::warning('Payment callback: Missing plan_id or company_id', [
                        'plan_id' => $planId,
                        'company_id' => $companyId
                    ]);
                }

                Logger::info('Payment completed via callback', [
                    'transaction_id' => $transaction['id'],
                    'payment_id' => $paymentId
                ]);
            } else {
                $gateway->updateTransaction($transaction['id'], [
                    'status' => 'failed',
                    'error_code' => 'CALLBACK_FAILURE',
                    'error_message' => 'Payment failed via callback',
                    'callback_data' => $data
                ]);
            }
            break;

        case 'REFUND_APPROVAL':
            // Iade onaylandi
            $gateway->updateTransaction($transaction['id'], [
                'status' => 'refunded',
                'callback_data' => $data
            ]);

            Logger::info('Refund approved via callback', [
                'transaction_id' => $transaction['id']
            ]);
            break;

        case 'CANCEL_APPROVAL':
            // Iptal onaylandi
            $gateway->updateTransaction($transaction['id'], [
                'status' => 'cancelled',
                'callback_data' => $data
            ]);

            Logger::info('Cancellation approved via callback', [
                'transaction_id' => $transaction['id']
            ]);
            break;

        default:
            Logger::info('Iyzico callback: Unknown event type', [
                'event_type' => $iyziEventType,
                'data' => $data
            ]);
    }

    // Basarili yanit
    http_response_code(200);
    echo json_encode(['success' => true, 'message' => 'Callback processed']);

} catch (Exception $e) {
    Logger::error('Iyzico callback error', [
        'error' => $e->getMessage(),
        'data' => $data
    ]);

    // Hata olsa bile 200 don ki Iyzico tekrar denemesin
    http_response_code(200);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
