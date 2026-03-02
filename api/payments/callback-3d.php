<?php
/**
 * Payment 3D Secure Callback
 *
 * 3D Secure dogrulama sonrasi Iyzico'nun yonlendirdigi callback endpoint.
 * Kullaniciyi frontend'e yonlendirir.
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../services/IyzicoGateway.php';

$db = Database::getInstance();

// Iyzico'dan gelen parametreler
$status = $_POST['status'] ?? null;
$paymentId = $_POST['paymentId'] ?? null;
$conversationId = $_POST['conversationId'] ?? null;
$mdStatus = $_POST['mdStatus'] ?? null;

// Conversation ID ile transaction'i bul
if (!$conversationId) {
    header('Location: ' . getRedirectUrl('error', 'Gecersiz islem'));
    exit;
}

// Islem kaydini al
$transaction = $db->fetch(
    "SELECT * FROM payment_transactions WHERE conversation_id = ?",
    [$conversationId]
);

if (!$transaction) {
    header('Location: ' . getRedirectUrl('error', 'Islem bulunamadi'));
    exit;
}

$gateway = new IyzicoGateway();
$txnId = $transaction['id'];

// 3D dogrulama basarili mi?
// mdStatus: 1 = Basarili, 0 = Basarisiz, 2,3,4 = Kart katilmamis/hata
$isSuccess = false;
$errorMessage = '';

if ($status === 'success' && in_array($mdStatus, ['1'])) {
    // 3D dogrulama basarili, odemeyi tamamla
    try {
        $verifyResult = $gateway->verify3DPayment($paymentId);

        if ($verifyResult['status'] === 'success') {
            $isSuccess = true;

            // Transaction'i guncelle
            $gateway->updateTransaction($txnId, [
                'status' => 'completed',
                'provider_transaction_id' => $verifyResult['paymentTransactionId'] ?? null,
                'provider_payment_id' => $paymentId,
                'card_type' => $verifyResult['cardType'] ?? null,
                'card_association' => $verifyResult['cardAssociation'] ?? null,
                'card_family' => $verifyResult['cardFamily'] ?? null,
                'card_last_four' => $verifyResult['lastFourDigits'] ?? null,
                'paid_price' => $verifyResult['paidPrice'] ?? null,
                'merchant_commission' => $verifyResult['merchantCommissionRate'] ?? null,
                'iyzico_commission' => $verifyResult['iyziCommissionFee'] ?? null,
                'callback_data' => $_POST,
                'paid_at' => date('Y-m-d H:i:s')
            ]);

            // Lisans suresi uzat
            processLicenseExtension($db, $transaction);

        } else {
            $errorMessage = $verifyResult['errorMessage'] ?? 'Odeme dogrulanamadi';
        }

    } catch (Exception $e) {
        $errorMessage = 'Odeme dogrulama hatasi: ' . $e->getMessage();
    }
} else {
    // 3D basarisiz
    $errorMessage = match($mdStatus) {
        '0' => '3D Secure dogrulama basarisiz',
        '2' => 'Kartiniz 3D Secure\'a kayitli degil',
        '3' => 'Banka sistemi yanit vermedi',
        '4' => 'Kart sahibi onay vermedi',
        '5' => 'Dogrulama yapilamiyor',
        '6' => '3D Secure hatasi',
        '7' => 'Sistem hatasi',
        default => $_POST['mdErrorMessage'] ?? '3D Secure dogrulama hatasi'
    };
}

if (!$isSuccess) {
    $gateway->updateTransaction($txnId, [
        'status' => 'failed',
        'error_code' => 'TDS_FAILED_' . ($mdStatus ?? 'UNKNOWN'),
        'error_message' => $errorMessage,
        'callback_data' => $_POST
    ]);

    header('Location: ' . getRedirectUrl('error', $errorMessage, $txnId));
    exit;
}

// Audit log
try {
    Logger::audit('payment_completed_3d', 'payment', [
        'transaction_id' => $txnId,
        'amount' => $transaction['amount'],
        'payment_id' => $paymentId
    ]);
} catch (Exception $e) {
    // Loglama hatasi kritik degil
}

// Basari sayfasina yonlendir
header('Location: ' . getRedirectUrl('success', 'Odeme tamamlandi', $txnId));
exit;

/**
 * Lisans suresini uzat
 * Guncellendi: Yeni sema ile uyumlu (plan_id referansi)
 */
function processLicenseExtension($db, $transaction)
{
    $metadata = json_decode($transaction['metadata'] ?? '{}', true);
    $planId = $metadata['plan_id'] ?? $transaction['plan_id'] ?? null;
    $companyId = $transaction['company_id'];

    if (!$planId || !$companyId) {
        Logger::warning('License extension skipped: missing plan_id or company_id', [
            'plan_id' => $planId,
            'company_id' => $companyId
        ]);
        return;
    }

    $plan = $db->fetch("SELECT * FROM license_plans WHERE id = ?", [$planId]);
    if (!$plan) {
        Logger::error('License extension failed: plan not found', ['plan_id' => $planId]);
        return;
    }

    $durationMonths = (int)($plan['duration_months'] ?? 0);
    if (!empty($metadata['renewal_months'])) {
        $durationMonths = (int)$metadata['renewal_months'];
    }
    $now = date('Y-m-d H:i:s');

    // Bitis tarihini hesapla (0 = sinirsiz)
    $newValidUntil = null;
    if ($durationMonths > 0) {
        $newValidUntil = date('Y-m-d', strtotime("+{$durationMonths} months"));
    }

    // Firmanin mevcut aktif lisansini bul
    $license = $db->fetch(
        "SELECT * FROM licenses WHERE company_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        [$companyId]
    );

    if ($license) {
        // Mevcut lisansin bitis tarihinden itibaren uzat
        if ($license['valid_until'] && $durationMonths > 0) {
            $currentEnd = strtotime($license['valid_until']);
            if ($currentEnd > time()) {
                $newValidUntil = date('Y-m-d', strtotime("+{$durationMonths} months", $currentEnd));
            }
        }

        $db->update('licenses', [
            'plan_id' => $planId,
            'valid_until' => $newValidUntil,
            'external_id' => $transaction['id'],
            'status' => 'active',
            'updated_at' => $now
        ], 'id = ?', [$license['id']]);

        Logger::info('License extended via 3D payment', [
            'license_id' => $license['id'],
            'plan_id' => $planId,
            'new_valid_until' => $newValidUntil
        ]);

    } else {
        // Yeni lisans olustur
        $licenseId = $db->generateUuid();
        $licenseKey = strtoupper(implode('-', [
            bin2hex(random_bytes(4)),
            bin2hex(random_bytes(2)),
            bin2hex(random_bytes(2)),
            bin2hex(random_bytes(2)),
            bin2hex(random_bytes(6))
        ]));

        $db->insert('licenses', [
            'id' => $licenseId,
            'company_id' => $companyId,
            'license_key' => $licenseKey,
            'plan_id' => $planId,
            'valid_from' => date('Y-m-d'),
            'valid_until' => $newValidUntil,
            'status' => 'active',
            'external_id' => $transaction['id'],
            'created_at' => $now,
            'updated_at' => $now
        ]);

        Logger::info('License created via 3D payment', [
            'license_id' => $licenseId,
            'company_id' => $companyId,
            'plan_id' => $planId,
            'valid_until' => $newValidUntil
        ]);
    }

    // Bildirim gonder
    if (class_exists('NotificationTriggers')) {
        NotificationTriggers::onPaymentSuccess($companyId, $plan['name'] ?? 'Plan');
    }
}

/**
 * Frontend yonlendirme URL'i olustur
 */
function getRedirectUrl($status, $message, $txnId = null)
{
    $basePath = '';

    // Base path'i tespit et
    $scriptPath = $_SERVER['SCRIPT_NAME'] ?? '';
    if (preg_match('#^(/[^/]+)/#', $scriptPath, $matches)) {
        $basePath = $matches[1];
    }

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

    $baseUrl = "{$protocol}://{$host}{$basePath}";

    $params = [
        'status' => $status,
        'message' => urlencode($message)
    ];

    if ($txnId) {
        $params['transaction_id'] = $txnId;
    }

    // Odeme sonuc sayfasina yonlendir
    return $baseUrl . '/#/payments/result?' . http_build_query($params);
}
