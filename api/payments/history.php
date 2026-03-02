<?php
/**
 * Payment History API
 *
 * GET - Kullanicinin/firmanin odeme gecmisini listeler.
 */

require_once __DIR__ . '/../../services/IyzicoGateway.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$method = (new Request())->getMethod();
$userJoin = $db->isPostgres()
    ? 'LEFT JOIN users u ON CAST(pt.user_id AS TEXT) = CAST(u.id AS TEXT)'
    : 'LEFT JOIN users u ON pt.user_id = u.id';

if ($method !== 'GET') {
    Response::methodNotAllowed('Sadece GET desteklenir');
}

try {
    $page = max(1, (int)Request::get('page', 1));
    $perPage = min(100, max(10, (int)Request::get('per_page', 20)));
    $offset = ($page - 1) * $perPage;

    $status = Request::get('status');
    $companyId = Request::get('company_id');

    // Query builder
    $where = [];
    $params = [];

    // SuperAdmin tum islemleri gorebilir
    if ($user['role'] === 'SuperAdmin') {
        if ($companyId) {
            $where[] = 'pt.company_id = ?';
            $params[] = $companyId;
        }
    } else {
        // Diger kullanicilar sadece kendi firma islemlerini gorebilir
        $where[] = 'pt.company_id = ?';
        $params[] = $user['company_id'];
    }

    if ($status) {
        $where[] = 'pt.status = ?';
        $params[] = $status;
    }

    $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

    // Toplam kayit sayisi
    $countQuery = "SELECT COUNT(*) as total FROM payment_transactions pt {$whereClause}";
    $countResult = $db->fetch($countQuery, $params);
    $total = (int)($countResult['total'] ?? 0);

    // Islemleri getir
    $query = "SELECT
        pt.id, pt.provider_transaction_id, pt.provider_payment_id,
        pt.company_id, pt.user_id, pt.license_id,
        pt.amount, pt.currency, pt.installment, pt.status, pt.transaction_type,
        pt.card_type, pt.card_association, pt.card_family, pt.card_last_four,
        pt.paid_price, pt.merchant_commission, pt.iyzico_commission,
        pt.buyer_email, pt.buyer_name,
        pt.error_code, pt.error_message,
        pt.created_at, pt.paid_at,
        c.name as company_name,
        u.first_name, u.last_name, u.email as user_email
    FROM payment_transactions pt
    LEFT JOIN companies c ON pt.company_id = c.id
    $userJoin
    {$whereClause}
    ORDER BY pt.created_at DESC
    LIMIT ? OFFSET ?";

    $params[] = $perPage;
    $params[] = $offset;

    $transactions = $db->fetchAll($query, $params);

    // Formatlama
    $formattedTransactions = array_map(function($tx) {
        return [
            'id' => $tx['id'],
            'provider_transaction_id' => $tx['provider_transaction_id'],
            'provider_payment_id' => $tx['provider_payment_id'],
            'company' => [
                'id' => $tx['company_id'],
                'name' => $tx['company_name']
            ],
            'user' => [
                'id' => $tx['user_id'],
                'name' => trim(($tx['first_name'] ?? '') . ' ' . ($tx['last_name'] ?? '')),
                'email' => $tx['user_email']
            ],
            'amount' => (float)$tx['amount'],
            'amount_formatted' => formatPrice($tx['amount'], $tx['currency']),
            'paid_price' => $tx['paid_price'] ? (float)$tx['paid_price'] : null,
            'currency' => $tx['currency'],
            'installment' => (int)$tx['installment'],
            'status' => $tx['status'],
            'status_text' => match($tx['status']) {
                'pending' => 'Bekliyor',
                'processing' => 'Isleniyor',
                'completed' => 'Tamamlandi',
                'failed' => 'Basarisiz',
                'refunded' => 'Iade Edildi',
                'cancelled' => 'Iptal Edildi',
                default => $tx['status']
            },
            'transaction_type' => $tx['transaction_type'],
            'card' => [
                'type' => $tx['card_type'],
                'association' => $tx['card_association'],
                'family' => $tx['card_family'],
                'last_four' => $tx['card_last_four']
            ],
            'commission' => [
                'merchant' => $tx['merchant_commission'] ? (float)$tx['merchant_commission'] : null,
                'iyzico' => $tx['iyzico_commission'] ? (float)$tx['iyzico_commission'] : null
            ],
            'buyer' => [
                'name' => $tx['buyer_name'],
                'email' => $tx['buyer_email']
            ],
            'error' => [
                'code' => $tx['error_code'],
                'message' => $tx['error_message']
            ],
            'created_at' => $tx['created_at'],
            'paid_at' => $tx['paid_at']
        ];
    }, $transactions);

    Response::success([
        'transactions' => $formattedTransactions,
        'pagination' => [
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => ceil($total / $perPage)
        ]
    ]);

} catch (Exception $e) {
    Logger::error('Payment history error', ['error' => $e->getMessage()]);
    Response::serverError('Odeme gecmisi alinamadi');
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
