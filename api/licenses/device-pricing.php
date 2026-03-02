<?php
/**
 * License Device Pricing API
 * GET  /api/licenses/:id/device-pricing - Get pricing breakdown
 * PUT  /api/licenses/:id/device-pricing - Save/update pricing breakdown
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

if (!in_array($user['role'], ['SuperAdmin', 'Admin'])) {
    Response::forbidden('Bu islemi yapmaya yetkiniz yok');
}

global $request;
$id = $request ? $request->routeParam('id') : null;

if (!$id) {
    Response::error('License ID gerekli', 400);
}

$license = $db->fetch("SELECT * FROM licenses WHERE id = ?", [$id]);
if (!$license) {
    Response::notFound('Lisans bulunamadi');
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    // Get device pricing breakdown
    $pricing = $db->fetchAll(
        "SELECT * FROM license_device_pricing WHERE license_id = ? ORDER BY device_category",
        [$id]
    );

    // Calculate totals
    $totalMonthlyBase = 0;
    foreach ($pricing as &$row) {
        $row['unit_price'] = (float)$row['unit_price'];
        $row['device_count'] = (int)$row['device_count'];
        $row['subtotal'] = $row['unit_price'] * $row['device_count'];
        $totalMonthlyBase += $row['subtotal'];
    }
    unset($row);

    $exchangeRate = (float)($license['exchange_rate'] ?? 1.0);
    $baseCurrency = $license['base_currency'] ?? 'TRY';

    Response::success([
        'pricing_mode' => $license['pricing_mode'] ?? 'flat',
        'exchange_rate' => $exchangeRate,
        'base_currency' => $baseCurrency,
        'categories' => $pricing,
        'total_monthly_base' => round($totalMonthlyBase, 2),
        'total_monthly_try' => round($totalMonthlyBase * $exchangeRate, 2),
        'total_annual_base' => round($totalMonthlyBase * 12, 2),
        'total_annual_try' => round($totalMonthlyBase * 12 * $exchangeRate, 2)
    ]);

} elseif ($method === 'PUT') {
    $data = $request->json();

    $validCategories = ['esl_rf', 'esl_tablet', 'esl_pos', 'signage_fiyatgor', 'signage_tv'];

    $pricingMode = $data['pricing_mode'] ?? 'per_device_type';
    $exchangeRate = (float)($data['exchange_rate'] ?? 1.0);
    $baseCurrency = $data['base_currency'] ?? 'USD';
    $categories = $data['categories'] ?? [];

    if ($exchangeRate <= 0) {
        Response::badRequest('Kur degeri sifirdan buyuk olmali');
    }

    try {
        // Update license pricing fields
        $totalMonthly = 0;

        // Delete existing pricing rows and re-insert
        $db->getConnection()->exec(
            "DELETE FROM license_device_pricing WHERE license_id = " . $db->getConnection()->quote($id)
        );

        foreach ($categories as $cat) {
            $category = $cat['device_category'] ?? '';
            if (!in_array($category, $validCategories)) {
                continue;
            }

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

                $totalMonthly += $unitPrice * $count;
            }
        }

        // Update license record
        $db->update('licenses', [
            'pricing_mode' => $pricingMode,
            'exchange_rate' => $exchangeRate,
            'base_currency' => $baseCurrency,
            'total_monthly_price' => $totalMonthly,
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$id]);

        Logger::audit('update', 'license_device_pricing', [
            'license_id' => $id,
            'pricing_mode' => $pricingMode,
            'categories_count' => count($categories),
            'total_monthly' => $totalMonthly
        ]);

        // Return updated pricing
        $updatedPricing = $db->fetchAll(
            "SELECT * FROM license_device_pricing WHERE license_id = ? ORDER BY device_category",
            [$id]
        );

        Response::success([
            'pricing_mode' => $pricingMode,
            'exchange_rate' => $exchangeRate,
            'base_currency' => $baseCurrency,
            'categories' => $updatedPricing,
            'total_monthly_base' => round($totalMonthly, 2),
            'total_monthly_try' => round($totalMonthly * $exchangeRate, 2)
        ], 'Fiyatlandirma guncellendi');

    } catch (Exception $e) {
        Logger::error('Device pricing update error', ['error' => $e->getMessage()]);
        Response::serverError('Fiyatlandirma guncellenemedi');
    }
} else {
    Response::error('Method not allowed', 405);
}
