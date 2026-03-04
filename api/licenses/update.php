<?php
/**
 * Licenses - Update
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

if (!in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu islemi yapmaya yetkiniz yok');
}

$id = $request->routeParam('id');
$data = $request->json();
$isSuperAdmin = strcasecmp((string)($user['role'] ?? ''), 'SuperAdmin') === 0;

try {
    $license = $db->fetch("SELECT * FROM licenses WHERE id = ?", [$id]);

    if (!$license) {
        Response::notFound('Lisans bulunamadi');
    }

    if (!$isSuperAdmin && ($license['company_id'] ?? null) !== ($user['company_id'] ?? null)) {
        Response::forbidden('Sadece kendi firmanizin lisanslarini duzenleyebilirsiniz');
    }

    $updateData = [];
    $plan = null;

    // Plan ID doğrulaması (değiştiriliyorsa)
    if (isset($data['plan_id']) && $data['plan_id'] !== $license['plan_id']) {
        $plan = $db->fetch("SELECT * FROM license_plans WHERE id = ?", [$data['plan_id']]);
        if (!$plan) {
            Response::badRequest('Geçersiz plan ID');
        }

        // Plan aktif değilse uyarı (ama engelleme)
        if (empty($plan['is_active']) && $plan['status'] !== 'active') {
            Logger::warning('Updating license with inactive plan', [
                'license_id' => $id,
                'plan_id' => $data['plan_id'],
                'company_id' => $license['company_id']
            ]);
        }

        $updateData['plan_id'] = $data['plan_id'];
    }

    if (isset($data['company_id']) && $data['company_id'] !== $license['company_id']) {
        if (!$isSuperAdmin) {
            Response::forbidden('Firma degistirme yetkiniz yok');
        }

        $company = $db->fetch("SELECT id FROM companies WHERE id = ?", [$data['company_id']]);
        if (!$company) {
            Response::badRequest('Gecersiz sirket ID');
        }

        $updateData['company_id'] = $data['company_id'];
    }

    // Map frontend field names to database column names
    if (isset($data['expires_at'])) $updateData['valid_until'] = $data['expires_at'];
    if (isset($data['valid_until'])) $updateData['valid_until'] = $data['valid_until'];
    if (isset($data['starts_at'])) $updateData['valid_from'] = $data['starts_at'];
    if (isset($data['valid_from'])) $updateData['valid_from'] = $data['valid_from'];
    if (isset($data['status'])) $updateData['status'] = $data['status'];
    if (isset($data['features'])) $updateData['features'] = is_array($data['features']) ? json_encode($data['features']) : $data['features'];
    if (isset($data['auto_renew'])) $updateData['auto_renew'] = $data['auto_renew'] ? 1 : 0;

    // Per-device-type pricing fields
    if (isset($data['pricing_mode'])) $updateData['pricing_mode'] = $data['pricing_mode'];
    if (isset($data['exchange_rate'])) $updateData['exchange_rate'] = (float)$data['exchange_rate'];
    if (isset($data['base_currency'])) $updateData['base_currency'] = $data['base_currency'];

    // Plan değiştirildiyse ve valid_until belirlenmemişse, plan süresinden hesapla
    if ($plan && !isset($updateData['valid_until'])) {
        // Sınırsız plan kontrolü
        $isUnlimited = (int)($plan['is_unlimited'] ?? 0) === 1 ||
                       in_array($plan['plan_type'], ['enterprise', 'ultimate', 'unlimited']);

        if ($isUnlimited) {
            // Sınırsız plan ise valid_until null olmalı
            $updateData['valid_until'] = null;
        } elseif (!empty($plan['duration_months']) && (int)$plan['duration_months'] > 0) {
            // Süreli plan ise bugünden itibaren hesapla
            $startDate = $updateData['valid_from'] ?? $license['valid_from'] ?? date('Y-m-d');
            $updateData['valid_until'] = date('Y-m-d', strtotime("+{$plan['duration_months']} months", strtotime($startDate)));
        }
    }

    if (empty($updateData)) {
        Response::badRequest('Güncellenecek veri yok');
    }

    $updateData['updated_at'] = date('Y-m-d H:i:s');

    // Handle device pricing update if provided
    $validCategories = ['esl_rf', 'esl_tablet', 'esl_pos', 'signage_fiyatgor', 'signage_tv'];
    $devicePricing = $data['device_pricing'] ?? null;

    if ($devicePricing !== null && is_array($devicePricing)) {
        $totalMonthly = 0;

        // Clear existing pricing
        $db->getConnection()->exec(
            "DELETE FROM license_device_pricing WHERE license_id = " . $db->getConnection()->quote($id)
        );

        foreach ($devicePricing as $cat) {
            $category = $cat['device_category'] ?? '';
            if (!in_array($category, $validCategories)) continue;

            $count = max(0, (int)($cat['device_count'] ?? 0));
            $unitPrice = max(0, (float)($cat['unit_price'] ?? 0));
            $currency = $cat['currency'] ?? ($data['base_currency'] ?? $license['base_currency'] ?? 'USD');

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
                $totalMonthly += $count * $unitPrice;
            }
        }

        $updateData['total_monthly_price'] = $totalMonthly;
    }

    $db->update('licenses', $updateData, 'id = ?', [$id]);

    // Log
    Logger::audit('update', 'license', [
        'id' => $id,
        'old' => $license,
        'new' => $data
    ]);

    Response::success(['message' => 'Lisans guncellendi']);
} catch (Exception $e) {
    Logger::error('License update error', ['error' => $e->getMessage()]);
    Response::serverError('Lisans guncellenemedi');
}
