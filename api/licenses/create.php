<?php
/**
 * Create License API (Admin Only)
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

if (!in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu islemi yapmaya yetkiniz yok');
}

$data = $request->json();
$isSuperAdmin = strcasecmp((string)($user['role'] ?? ''), 'SuperAdmin') === 0;

$companyId = $data['company_id'] ?? null;
$planId = $data['plan_id'] ?? null;
$startsAt = $data['starts_at'] ?? date('Y-m-d');
$expiresAt = $data['expires_at'] ?? null;

if (!$companyId && !$isSuperAdmin) {
    $companyId = $user['company_id'] ?? null;
}

if (!$isSuperAdmin && ($user['company_id'] ?? null) !== $companyId) {
    Response::forbidden('Sadece kendi firmaniza lisans tanimlayabilirsiniz');
}

if (!$companyId) {
    Response::badRequest('Şirket ID gerekli');
}

// Firma varlık kontrolü
$company = $db->fetch("SELECT id FROM companies WHERE id = ?", [$companyId]);
if (!$company) {
    Response::badRequest('Geçersiz şirket ID');
}

// Plan ID doğrulaması
if ($planId) {
    $plan = $db->fetch("SELECT * FROM license_plans WHERE id = ?", [$planId]);
    if (!$plan) {
        Response::badRequest('Geçersiz plan ID');
    }

    // Plan aktif değilse uyarı (ama engelleme)
    if (empty($plan['is_active']) && $plan['status'] !== 'active') {
        Logger::warning('Creating license with inactive plan', [
            'plan_id' => $planId,
            'company_id' => $companyId
        ]);
    }

    // expires_at verilmemişse plan süresinden hesapla
    if (!$expiresAt && !empty($plan['duration_months']) && (int)$plan['duration_months'] > 0) {
        $expiresAt = date('Y-m-d', strtotime("+{$plan['duration_months']} months", strtotime($startsAt)));
    }

    // Sınırsız plan ise expires_at null olmalı
    $isUnlimited = (int)($plan['is_unlimited'] ?? 0) === 1 ||
                   in_array($plan['plan_type'], ['enterprise', 'ultimate', 'unlimited']);
    if ($isUnlimited) {
        $expiresAt = null;
    }
}

// Generate license key
$licenseKey = strtoupper(implode('-', [
    bin2hex(random_bytes(4)),
    bin2hex(random_bytes(2)),
    bin2hex(random_bytes(2)),
    bin2hex(random_bytes(2)),
    bin2hex(random_bytes(6))
]));

$id = $db->generateUuid();

try {
    $db->beginTransaction();

    // Per-device-type pricing fields
    $pricingMode = $data['pricing_mode'] ?? 'flat';
    $exchangeRate = (float)($data['exchange_rate'] ?? 1.0);
    $baseCurrency = $data['base_currency'] ?? 'TRY';
    $devicePricing = $data['device_pricing'] ?? [];

    $totalMonthly = 0;
    if ($pricingMode === 'per_device_type' && !empty($devicePricing)) {
        foreach ($devicePricing as $cat) {
            $count = max(0, (int)($cat['device_count'] ?? 0));
            $unitPrice = max(0, (float)($cat['unit_price'] ?? 0));
            $totalMonthly += $count * $unitPrice;
        }
    }

    $db->insert('licenses', [
        'id' => $id,
        'company_id' => $companyId,
        'license_key' => $licenseKey,
        'plan_id' => $planId,
        'valid_from' => $startsAt,
        'valid_until' => $expiresAt,
        'status' => 'active',
        'auto_renew' => 0,
        'pricing_mode' => $pricingMode,
        'exchange_rate' => $exchangeRate,
        'base_currency' => $baseCurrency,
        'total_monthly_price' => $totalMonthly,
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s')
    ]);

    // Insert device pricing rows if per_device_type
    $validCategories = ['esl_rf', 'esl_tablet', 'esl_pos', 'signage_fiyatgor', 'signage_tv'];
    if ($pricingMode === 'per_device_type' && !empty($devicePricing)) {
        foreach ($devicePricing as $cat) {
            $category = $cat['device_category'] ?? '';
            if (!in_array($category, $validCategories)) continue;

            $count = max(0, (int)($cat['device_count'] ?? 0));
            $unitPrice = max(0, (float)($cat['unit_price'] ?? 0));
            $currency = $cat['currency'] ?? $baseCurrency;

            if ($count > 0 || $unitPrice > 0) {
                $db->insert('license_device_pricing', [
                    'id' => $db->generateUuid(),
                    'license_id' => $id,
                    'device_category' => $category,
                    'device_count' => $count,
                    'unit_price' => $unitPrice,
                    'currency' => $currency,
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
            }
        }
    }

    $db->commit();

    // Log (non-critical)
    try {
        Logger::audit('create', 'license', [
            'id' => $id,
            'company_id' => $companyId,
            'plan_id' => $planId,
            'pricing_mode' => $pricingMode
        ]);
    } catch (Throwable $auditError) {
        error_log('License create audit skipped: ' . $auditError->getMessage());
    }

    $license = $db->fetch("SELECT * FROM licenses WHERE id = ?", [$id]);

    // Include device pricing in response
    if ($pricingMode === 'per_device_type') {
        $license['device_pricing'] = $db->fetchAll(
            "SELECT * FROM license_device_pricing WHERE license_id = ? ORDER BY device_category",
            [$id]
        );
    }

    Response::success($license, 'Lisans oluşturuldu');
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    Logger::error('License create error', ['error' => $e->getMessage()]);
    Response::serverError('Lisans oluşturulamadı');
}
