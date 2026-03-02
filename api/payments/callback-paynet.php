<?php
/**
 * Paynet 3D callback handler.
 *
 * Receives session/token from Paynet redirect, completes 3D charge,
 * then applies license extension and redirects to frontend result page.
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../services/PaynetGateway.php';

$db = Database::getInstance();
$gateway = new PaynetGateway();

$conversationId = $_GET['conversation_id'] ?? $_POST['conversation_id'] ?? null;
$sessionId = $_POST['session_id'] ?? $_POST['sessionId'] ?? $_GET['session_id'] ?? null;
$tokenId = $_POST['token_id'] ?? $_POST['tokenId'] ?? $_GET['token_id'] ?? null;
$referenceNo = $_POST['reference_no'] ?? $_POST['referenceNo'] ?? $_GET['reference_no'] ?? null;

if (!$conversationId && $referenceNo) {
    $conversationId = $referenceNo;
}

if (empty($conversationId)) {
    header('Location: ' . getRedirectUrl('error', 'Missing conversation id'));
    exit;
}

$transaction = $db->fetch(
    "SELECT * FROM payment_transactions
     WHERE provider = 'paynet' AND (conversation_id = ? OR reference_no = ?)
     ORDER BY created_at DESC
     LIMIT 1",
    [$conversationId, $conversationId]
);

if (!$transaction) {
    header('Location: ' . getRedirectUrl('error', 'Transaction not found'));
    exit;
}

if (($transaction['status'] ?? '') === 'completed') {
    header('Location: ' . getRedirectUrl('success', 'Payment already completed', $transaction['id']));
    exit;
}

if (empty($sessionId) || empty($tokenId)) {
    $gateway->updateTransaction($transaction['id'], [
        'status' => 'failed',
        'error_code' => 'PAYNET_CALLBACK_MISSING_FIELDS',
        'error_message' => 'Missing session_id or token_id',
        'callback_data' => $_POST
    ]);
    header('Location: ' . getRedirectUrl('error', 'Missing 3D callback payload', $transaction['id']));
    exit;
}

try {
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $scriptPath = $_SERVER['SCRIPT_NAME'] ?? '/api/payments/callback-paynet.php';
    $selfUrl = $protocol . '://' . $host . $scriptPath . '?conversation_id=' . urlencode($conversationId);

    $amount = (int)($transaction['amount'] ?? 0);
    $verifyResult = $gateway->verify3DPayment($sessionId, $tokenId, $amount, $selfUrl);

    if (($verifyResult['status'] ?? 'failure') !== 'success') {
        $gateway->updateTransaction($transaction['id'], [
            'status' => 'failed',
            'session_id' => $sessionId,
            'token_id' => $tokenId,
            'error_code' => $verifyResult['errorCode'] ?? 'PAYNET_CHARGE_FAILED',
            'error_message' => $verifyResult['errorMessage'] ?? 'Paynet charge failed',
            'raw_response' => $verifyResult
        ]);
        header('Location: ' . getRedirectUrl('error', $verifyResult['errorMessage'] ?? 'Payment failed', $transaction['id']));
        exit;
    }

    $gateway->updateTransaction($transaction['id'], [
        'status' => 'completed',
        'session_id' => $sessionId,
        'token_id' => $tokenId,
        'provider_transaction_id' => $verifyResult['transaction_id'] ?? null,
        'completed_at' => date('Y-m-d H:i:s'),
        'raw_response' => $verifyResult
    ]);

    processLicenseExtension($db, $transaction);

    Logger::audit('payment_completed_3d', 'payment', [
        'transaction_id' => $transaction['id'],
        'provider' => 'paynet',
        'amount' => $transaction['amount'] ?? null
    ]);

    header('Location: ' . getRedirectUrl('success', 'Payment completed', $transaction['id']));
    exit;
} catch (Exception $e) {
    Logger::error('Paynet callback error', [
        'error' => $e->getMessage(),
        'conversation_id' => $conversationId
    ]);

    $gateway->updateTransaction($transaction['id'], [
        'status' => 'failed',
        'session_id' => $sessionId,
        'token_id' => $tokenId,
        'error_code' => 'PAYNET_CALLBACK_EXCEPTION',
        'error_message' => $e->getMessage(),
        'callback_data' => $_POST
    ]);

    header('Location: ' . getRedirectUrl('error', 'Payment callback failed', $transaction['id']));
    exit;
}

/**
 * Applies plan extension/creation based on transaction metadata.
 */
function processLicenseExtension($db, $transaction)
{
    $metadata = json_decode($transaction['metadata'] ?? '{}', true);
    $planId = $metadata['plan_id'] ?? $transaction['plan_id'] ?? null;
    $companyId = $transaction['company_id'] ?? null;

    if (!$planId || !$companyId) {
        Logger::warning('Paynet license extension skipped: missing identifiers', [
            'plan_id' => $planId,
            'company_id' => $companyId
        ]);
        return;
    }

    $plan = $db->fetch("SELECT * FROM license_plans WHERE id = ?", [$planId]);
    if (!$plan) {
        Logger::error('Paynet license extension failed: plan not found', ['plan_id' => $planId]);
        return;
    }

    $durationMonths = (int)($plan['duration_months'] ?? 0);
    if (!empty($metadata['renewal_months'])) {
        $durationMonths = (int)$metadata['renewal_months'];
    }
    $now = date('Y-m-d H:i:s');

    $newValidUntil = null;
    if ($durationMonths > 0) {
        $newValidUntil = date('Y-m-d', strtotime("+{$durationMonths} months"));
    }

    $license = $db->fetch(
        "SELECT * FROM licenses WHERE company_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        [$companyId]
    );

    if ($license) {
        if (!empty($license['valid_until']) && $durationMonths > 0) {
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
    } else {
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
    }

    if (class_exists('NotificationTriggers')) {
        NotificationTriggers::onPaymentSuccess($companyId, $plan['name'] ?? 'Plan');
    }
}

function getRedirectUrl($status, $message, $txnId = null)
{
    $basePath = '';
    $scriptPath = $_SERVER['SCRIPT_NAME'] ?? '';
    if (preg_match('#^(/[^/]+)/#', $scriptPath, $matches)) {
        $basePath = $matches[1];
    }

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $baseUrl = "{$protocol}://{$host}{$basePath}";

    $params = [
        'status' => $status,
        'message' => $message
    ];
    if ($txnId) {
        $params['transaction_id'] = $txnId;
    }

    return $baseUrl . '/#/payments/result?' . http_build_query($params);
}
