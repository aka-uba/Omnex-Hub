<?php
/**
 * License Plans API
 *
 * GET - Lisans planlarini listele (default: active only)
 * Also returns payment system status for non-SuperAdmin users
 */

require_once __DIR__ . '/../../services/IyzicoGateway.php';
require_once __DIR__ . '/../../services/PaynetGateway.php';

$db = Database::getInstance();
$user = Auth::user();

$request = new Request();
$method = $request->getMethod();
$activeProviderFilter = "(status = 'active' OR is_active = true)";
$activeProviderOrder = "CASE WHEN is_active = true THEN 0 ELSE 1 END, COALESCE(updated_at, created_at) DESC";

if ($method !== 'GET') {
    Response::methodNotAllowed('Sadece GET desteklenir');
}

try {
    $includeInactiveRaw = $request->query('include_inactive', null);
    $includeInactive = false;
    if ($includeInactiveRaw !== null) {
        $includeInactive = filter_var($includeInactiveRaw, FILTER_VALIDATE_BOOLEAN);
    }
    $role = strtolower((string)($user['role'] ?? ''));
    $canSeeInactive = in_array($role, ['superadmin', 'admin'], true);
    if ($canSeeInactive && $includeInactiveRaw === null) {
        // Admin/SuperAdmin default: include inactive plans in management screens
        $includeInactive = true;
    } elseif (!$canSeeInactive) {
        $includeInactive = false;
    }

    // Active provider detection (supports both legacy status and is_active)
    $activeProvider = $db->fetch(
        "SELECT provider, status, is_active
         FROM payment_settings
         WHERE $activeProviderFilter
         ORDER BY $activeProviderOrder
         LIMIT 1"
    );
    $paymentActive = (bool)$activeProvider;
    $provider = $activeProvider['provider'] ?? null;

    if ($provider === 'paynet') {
        $gateway = new PaynetGateway();
    } else {
        $gateway = new IyzicoGateway();
    }

    $plans = $gateway->getLicensePlans($includeInactive);

    // Company context for per-device estimated pricing
    $companyId = null;
    if ($user && isset($user['company_id'])) {
        $companyId = $user['company_id'];
    }

    $companyDeviceCount = null;
    if (!empty($companyId)) {
        $deviceRow = $db->fetch(
            "SELECT COUNT(*) as count FROM devices WHERE company_id = ?",
            [$companyId]
        );
        $companyDeviceCount = (int)($deviceRow['count'] ?? 0);
    }

    // Frontend icin flat formatlama (LicenseManagement.js ile uyumlu)
    $formattedPlans = array_map(function ($plan) use ($companyDeviceCount) {
        $features = is_array($plan['features']) ? $plan['features'] : [];
        if (empty($features) && !empty($plan['features']) && is_string($plan['features'])) {
            $decodedFeatures = json_decode($plan['features'], true);
            if (is_array($decodedFeatures)) {
                $features = $decodedFeatures;
            }
        }

        $durationMonths = (int)($plan['duration_months'] ?? 1);
        if ($durationMonths <= 0) {
            $durationMonths = 1;
        }

        $planPriceKurus = (float)($plan['price'] ?? 0);
        $isPerDevicePricing = in_array('per_device_pricing', $features, true)
            || (($plan['plan_type'] ?? '') === 'per_device');

        // Decode device_categories and default_device_pricing JSON fields
        $deviceCategories = [];
        if (!empty($plan['device_categories'])) {
            $decoded = is_array($plan['device_categories']) ? $plan['device_categories'] : json_decode($plan['device_categories'], true);
            if (is_array($decoded)) $deviceCategories = $decoded;
        }
        $defaultDevicePricing = [];
        if (!empty($plan['default_device_pricing'])) {
            $decoded = is_array($plan['default_device_pricing']) ? $plan['default_device_pricing'] : json_decode($plan['default_device_pricing'], true);
            if (is_array($decoded)) $defaultDevicePricing = $decoded;
        }

        // Determine effective pricing mode
        $pricingMode = 'flat';
        if (!empty($deviceCategories)) {
            $pricingMode = 'per_device_type';
        } elseif ($isPerDevicePricing) {
            $pricingMode = 'per_device';
        }

        $maxDevices = (int)($plan['max_devices'] ?? -1);
        $cappedDeviceCount = $companyDeviceCount;
        if ($cappedDeviceCount !== null && $maxDevices > 0 && $cappedDeviceCount > $maxDevices) {
            $cappedDeviceCount = $maxDevices;
        }

        $monthlyUnitPriceKurus = $planPriceKurus / $durationMonths;
        $estimatedPriceKurus = $planPriceKurus;
        if ($isPerDevicePricing && $cappedDeviceCount !== null) {
            $estimatedPriceKurus = $monthlyUnitPriceKurus * 12 * max(1, $cappedDeviceCount);
        }

        return [
            'id' => $plan['id'],
            'name' => $plan['name'],
            'slug' => $plan['slug'],
            'description' => $plan['description'],
            'plan_type' => $plan['plan_type'],
            'duration_months' => $durationMonths,
            // Price is stored in kurus, convert to TL for frontend UI
            'price' => $planPriceKurus / 100,
            'currency' => $plan['currency'] ?? 'TRY',
            'pricing_mode' => $pricingMode,
            'device_categories' => $deviceCategories,
            'default_device_pricing' => $defaultDevicePricing,
            'device_unit_price' => $monthlyUnitPriceKurus / 100,
            'device_count' => $cappedDeviceCount,
            'estimated_price' => $estimatedPriceKurus / 100,
            // Flat limit fields (frontend expects these)
            'max_users' => (int)$plan['max_users'],
            'max_devices' => (int)$plan['max_devices'],
            'max_products' => (int)$plan['max_products'],
            'max_templates' => (int)$plan['max_templates'],
            'max_branches' => (int)$plan['max_branches'],
            'storage_limit' => (int)($plan['storage_limit'] ?? $plan['max_storage'] ?? 0),
            // Features array
            'features' => $features,
            // Boolean flags
            'is_popular' => (bool)$plan['is_popular'],
            'is_enterprise' => (bool)$plan['is_enterprise'],
            'is_active' => (bool)$plan['is_active'],
            'sort_order' => (int)($plan['sort_order'] ?? 0)
        ];
    }, $plans);

    Response::success([
        'plans' => $formattedPlans,
        'payment_active' => $paymentActive,
        'provider' => $provider
    ]);

} catch (Exception $e) {
    Logger::error('License plans fetch error', ['error' => $e->getMessage()]);
    Response::serverError('Planlar yuklenemedi');
}

/**
 * Fiyat formatlama
 */
function formatPrice($amount, $currency = 'TRY')
{
    if ($amount <= 0) {
        return 'Ucretsiz';
    }

    $symbols = [
        'TRY' => 'TL',
        'USD' => '$',
        'EUR' => 'EUR'
    ];

    $symbol = $symbols[$currency] ?? $currency . ' ';

    return $symbol . number_format($amount, 0, ',', '.');
}

/**
 * Limit formatlama
 */
function formatLimit($value)
{
    if ($value == -1 || $value === null) {
        return [
            'value' => -1,
            'formatted' => 'Sinirsiz',
            'unlimited' => true
        ];
    }

    return [
        'value' => (int)$value,
        'formatted' => number_format($value, 0, '', '.'),
        'unlimited' => false
    ];
}
