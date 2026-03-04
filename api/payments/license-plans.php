<?php
/**
 * License Plans CRUD API
 *
 * GET /license-plans - Tum planlari listele
 * GET /license-plans/:id - Tek plan getir
 * POST /license-plans - Yeni plan olustur (Admin only)
 * PUT /license-plans/:id - Plan guncelle (Admin only)
 * DELETE /license-plans/:id - Plan sil (Admin only)
 */

$db = Database::getInstance();
// Use global request if available (has route params), otherwise create new
$request = $GLOBALS['request'] ?? new Request();
$method = $request->getMethod();
$user = Auth::user();

/**
 * Plan fiyatını veritabanında kuruş olarak sakla.
 * Varsayım: admin panel TL gönderir.
 */
function normalizePriceToKurus($value): int
{
    $num = (float)$value;
    if ($num <= 0) {
        return 0;
    }

    return (int)round($num * 100);
}

function normalizeBooleanFlag($value, bool $default = false): bool
{
    if ($value === null || $value === '') {
        return $default;
    }

    if (is_bool($value)) {
        return $value;
    }

    if (is_int($value) || is_float($value)) {
        return ((int)$value) === 1;
    }

    if (is_string($value)) {
        $normalized = strtolower(trim($value));
        if ($normalized === '') {
            return $default;
        }
        if (in_array($normalized, ['1', 'true', 'yes', 'on', 'active'], true)) {
            return true;
        }
        if (in_array($normalized, ['0', 'false', 'no', 'off', 'inactive'], true)) {
            return false;
        }
    }

    return (bool)$value;
}

function normalizeBooleanDbFlag($value, bool $default = false): int
{
    return normalizeBooleanFlag($value, $default) ? 1 : 0;
}

function normalizeTextValue($value, string $default = ''): string
{
    if ($value === null) {
        return $default;
    }

    $text = trim((string)$value);
    return $text !== '' ? $text : $default;
}

function normalizePricingMode($value): string
{
    $mode = normalizeTextValue($value, 'flat');
    $allowed = ['flat', 'per_device', 'per_device_type'];
    return in_array($mode, $allowed, true) ? $mode : 'flat';
}

function normalizeFeaturesValue($value, string $pricingMode = 'flat'): array
{
    if (is_string($value)) {
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            $value = $decoded;
        } elseif ($value === '') {
            $value = [];
        } else {
            $value = [$value];
        }
    }

    if (!is_array($value)) {
        $value = [];
    }

    $features = [];
    foreach ($value as $feature) {
        $feature = trim((string)$feature);
        if ($feature !== '') {
            $features[$feature] = $feature;
        }
    }

    if ($pricingMode === 'per_device') {
        $features['per_device_pricing'] = 'per_device_pricing';
    } else {
        unset($features['per_device_pricing']);
    }

    return array_values($features);
}

function determinePricingModeForPlan(array $plan, array $features, array $deviceCategories): string
{
    if (!empty($deviceCategories)) {
        return 'per_device_type';
    }

    if (in_array('per_device_pricing', $features, true) || (($plan['plan_type'] ?? '') === 'per_device')) {
        return 'per_device';
    }

    return 'flat';
}

function hydrateLicensePlanForResponse(array $plan): array
{
    $features = normalizeFeaturesValue($plan['features'] ?? []);
    $rawDeviceCategories = $plan['device_categories'] ?? [];
    if (is_array($rawDeviceCategories)) {
        $deviceCategories = $rawDeviceCategories;
    } else {
        $deviceCategories = json_decode((string)$rawDeviceCategories, true);
        $deviceCategories = is_array($deviceCategories) ? $deviceCategories : [];
    }

    $rawDefaultDevicePricing = $plan['default_device_pricing'] ?? [];
    if (is_array($rawDefaultDevicePricing)) {
        $defaultDevicePricing = $rawDefaultDevicePricing;
    } else {
        $defaultDevicePricing = json_decode((string)$rawDefaultDevicePricing, true);
        $defaultDevicePricing = is_array($defaultDevicePricing) ? $defaultDevicePricing : [];
    }

    $pricingMode = determinePricingModeForPlan($plan, $features, $deviceCategories);
    $durationMonths = (int)($plan['duration_months'] ?? 1);
    if ($durationMonths <= 0) {
        $durationMonths = 1;
    }

    $plan['features'] = $features;
    $plan['price'] = ((float)($plan['price'] ?? 0)) / 100;
    $plan['max_users'] = (int)($plan['max_users'] ?? 0);
    $plan['max_devices'] = (int)($plan['max_devices'] ?? 0);
    $plan['max_products'] = (int)($plan['max_products'] ?? 0);
    $plan['max_templates'] = (int)($plan['max_templates'] ?? 0);
    $plan['max_branches'] = (int)($plan['max_branches'] ?? -1);
    $plan['storage_limit'] = (int)($plan['max_storage'] ?? -1);
    $plan['is_popular'] = normalizeBooleanFlag($plan['is_popular'] ?? false);
    $plan['is_enterprise'] = normalizeBooleanFlag($plan['is_enterprise'] ?? false);
    $plan['is_active'] = normalizeBooleanFlag($plan['is_active'] ?? (($plan['status'] ?? 'active') === 'active'), true);
    $plan['device_categories'] = $deviceCategories;
    $plan['default_device_pricing'] = $defaultDevicePricing;
    $plan['pricing_mode'] = $pricingMode;
    $plan['device_unit_price'] = $pricingMode === 'per_device'
        ? round($plan['price'] / $durationMonths, 2)
        : null;

    return $plan;
}

// Auth kontrolu
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Route parametresinden ID al
$planId = $request->getRouteParam('id');

// GET - Liste veya tek plan
if ($method === 'GET') {
    if ($planId) {
        // Tek plan getir
        $plan = $db->fetch("SELECT * FROM license_plans WHERE id = ?", [$planId]);

        if (!$plan) {
            Response::notFound('Plan bulunamadi');
        }

        Response::success(hydrateLicensePlanForResponse($plan));
        return;

        // Features JSON decode
        $plan['features'] = json_decode($plan['features'] ?? '[]', true);
        $plan['price'] = ((float)$plan['price']) / 100;
        $plan['max_users'] = (int)$plan['max_users'];
        $plan['max_devices'] = (int)$plan['max_devices'];
        $plan['max_products'] = (int)$plan['max_products'];
        $plan['max_templates'] = (int)$plan['max_templates'];
        $plan['max_branches'] = (int)($plan['max_branches'] ?? -1);
        // DB'de max_storage, frontend'de storage_limit olarak kullanılıyor
        $plan['storage_limit'] = (int)($plan['max_storage'] ?? -1);
        $plan['is_popular'] = (bool)$plan['is_popular'];
        $plan['is_enterprise'] = (bool)$plan['is_enterprise'];
        $plan['is_active'] = (bool)($plan['is_active'] ?? ($plan['status'] === 'active'));
        $plan['device_categories'] = json_decode($plan['device_categories'] ?? '[]', true);
        $plan['default_device_pricing'] = json_decode($plan['default_device_pricing'] ?? '{}', true);

        Response::success($plan);
    } else {
        // Tum planlari listele (aktif ve pasif dahil)
        $includeInactive = $request->query('include_inactive', false);
        $activeFlagExpr = $db->isPostgres() ? 'is_active IS TRUE' : 'is_active = 1';

        $query = "SELECT * FROM license_plans";
        if (!$includeInactive) {
            $query .= " WHERE status = 'active' OR $activeFlagExpr";
        }
        $query .= " ORDER BY sort_order ASC";

        $plans = $db->fetchAll($query);

        Response::success(array_map('hydrateLicensePlanForResponse', $plans));
        return;

        // Format plans
        $formattedPlans = array_map(function ($plan) {
            $plan['features'] = json_decode($plan['features'] ?? '[]', true);
            $plan['price'] = ((float)$plan['price']) / 100;
            $plan['max_users'] = (int)$plan['max_users'];
            $plan['max_devices'] = (int)$plan['max_devices'];
            $plan['max_products'] = (int)$plan['max_products'];
            $plan['max_templates'] = (int)$plan['max_templates'];
            $plan['max_branches'] = (int)($plan['max_branches'] ?? -1);
            // DB'de max_storage, frontend'de storage_limit olarak kullanılıyor
            $plan['storage_limit'] = (int)($plan['max_storage'] ?? -1);
            $plan['is_popular'] = (bool)$plan['is_popular'];
            $plan['is_enterprise'] = (bool)$plan['is_enterprise'];
            $plan['is_active'] = (bool)($plan['is_active'] ?? ($plan['status'] === 'active'));
            $plan['device_categories'] = json_decode($plan['device_categories'] ?? '[]', true);
            $plan['default_device_pricing'] = json_decode($plan['default_device_pricing'] ?? '{}', true);
            return $plan;
        }, $plans);

        Response::success($formattedPlans);
    }
}

// Admin kontrolu (POST, PUT, DELETE icin)
$adminRoles = ['SuperAdmin', 'Admin', 'superadmin', 'admin'];
if (!in_array($user['role'], $adminRoles)) {
    Response::forbidden('Bu islem icin admin yetkisi gerekli');
}

// POST - Yeni plan olustur
if ($method === 'POST') {
    $name = $request->input('name');
    $price = (float)$request->input('price', 0);
    $priceKurus = normalizePriceToKurus($price);

    if (empty($name)) {
        Response::badRequest('Plan adi zorunlu');
    }

    // Slug olustur
    $slug = $request->input('slug');
    if (empty($slug)) {
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $name));
        $slug = trim($slug, '-');
    }

    // Slug benzersizlik kontrolu
    $existing = $db->fetch("SELECT id FROM license_plans WHERE slug = ?", [$slug]);
    if ($existing) {
        $slug = $slug . '-' . time();
    }

    $id = $db->generateUuid();

    // Features JSON encode
    $features = $request->input('features', []);
    if (is_array($features)) {
        $features = json_encode($features);
    }

    // Device categories and default pricing
    $deviceCategories = $request->input('device_categories', []);
    $defaultDevicePricing = $request->input('default_device_pricing', []);
    $pricingMode = normalizePricingMode($request->input('pricing_mode', 'flat'));
    $isActive = normalizeBooleanFlag($request->input('is_active', true), true);
    $planType = normalizeTextValue($request->input('plan_type', 'standard'), 'standard');
    if ($pricingMode === 'per_device') {
        $planType = 'per_device';
    }

    if ($pricingMode !== 'per_device_type') {
        $deviceCategories = [];
        $defaultDevicePricing = [];
    }

    $features = json_encode(normalizeFeaturesValue($request->input('features', []), $pricingMode));
    $status = normalizeTextValue($request->input('status', ''), $isActive ? 'active' : 'inactive');

    $db->insert('license_plans', [
        'id' => $id,
        'name' => $name,
        'slug' => $slug,
        'description' => normalizeTextValue($request->input('description', ''), ''),
        'plan_type' => $planType,
        'duration_months' => (int)$request->input('duration_months', 1),
        'price' => $priceKurus,
        'currency' => $request->input('currency', 'TRY'),
        'max_users' => (int)$request->input('max_users', 1),
        'max_devices' => (int)$request->input('max_devices', 10),
        'max_products' => (int)$request->input('max_products', 100),
        'max_templates' => (int)$request->input('max_templates', 10),
        'max_branches' => (int)$request->input('max_branches', -1),
        'max_storage' => (int)$request->input('storage_limit', -1),
        'features' => $features,
        'is_popular' => normalizeBooleanDbFlag($request->input('is_popular', false)),
        'is_enterprise' => normalizeBooleanDbFlag($request->input('is_enterprise', false)),
        'sort_order' => (int)$request->input('sort_order', 0),
        'status' => $status,
        'is_active' => normalizeBooleanDbFlag($isActive, true),
        'device_categories' => is_array($deviceCategories) ? json_encode($deviceCategories) : ($deviceCategories ?: '[]'),
        'default_device_pricing' => is_array($defaultDevicePricing) ? json_encode($defaultDevicePricing) : ($defaultDevicePricing ?: '{}'),
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s')
    ]);

    // Yeni plani getir
    $plan = $db->fetch("SELECT * FROM license_plans WHERE id = ?", [$id]);
    $plan['features'] = json_decode($plan['features'] ?? '[]', true);
    $plan['price'] = ((float)$plan['price']) / 100;
    $plan['storage_limit'] = (int)($plan['max_storage'] ?? -1);
    $plan['device_categories'] = json_decode($plan['device_categories'] ?? '[]', true);
    $plan['default_device_pricing'] = json_decode($plan['default_device_pricing'] ?? '{}', true);
    $plan = hydrateLicensePlanForResponse($plan);

    Logger::audit('create', 'license_plan', [
        'id' => $id,
        'new' => ['name' => $name, 'price' => $price, 'slug' => $slug]
    ]);

    Response::success($plan, 'Plan olusturuldu');
}

// PUT - Plan guncelle
if ($method === 'PUT') {
    if (empty($planId)) {
        Response::badRequest('Plan ID gerekli');
    }

    $plan = $db->fetch("SELECT * FROM license_plans WHERE id = ?", [$planId]);
    if (!$plan) {
        Response::notFound('Plan bulunamadi');
    }

    $updateData = [];
    $inputPricingMode = $request->has('pricing_mode')
        ? normalizePricingMode($request->input('pricing_mode'))
        : null;

    // Guncellenebilir alanlar
    $fields = [
        'name', 'description', 'plan_type', 'duration_months',
        'price', 'currency', 'max_users', 'max_devices',
        'max_products', 'max_templates', 'max_branches', 'max_storage',
        'sort_order', 'status'
    ];

    foreach ($fields as $field) {
        // Frontend'den storage_limit olarak geliyor, DB'de max_storage
        $inputField = ($field === 'max_storage') ? 'storage_limit' : $field;

        if ($request->has($inputField)) {
            $value = $request->input($inputField);

            // Tip donusumleri
            if (in_array($field, ['duration_months', 'max_users', 'max_devices', 'max_products', 'max_templates', 'max_branches', 'max_storage', 'sort_order'])) {
                $value = (int)$value;
            } elseif ($field === 'price') {
                $value = normalizePriceToKurus($value);
            }

            $updateData[$field] = $value;
        }
    }

    if (array_key_exists('status', $updateData)) {
        $normalizedStatus = normalizeTextValue($updateData['status'], $plan['status'] ?? 'active');
        if ($normalizedStatus === '') {
            unset($updateData['status']);
        } else {
            $updateData['status'] = $normalizedStatus;
        }
    }

    // Slug guncelleme
    if ($request->has('slug') && !empty($request->input('slug'))) {
        $newSlug = $request->input('slug');
        $existingSlug = $db->fetch("SELECT id FROM license_plans WHERE slug = ? AND id != ?", [$newSlug, $planId]);
        if (!$existingSlug) {
            $updateData['slug'] = $newSlug;
        }
    }

    // Features
    if ($request->has('features')) {
        $existingFeatures = normalizeFeaturesValue($plan['features'] ?? []);
        $pricingModeForFeatures = $inputPricingMode ?? determinePricingModeForPlan(
            $plan,
            $existingFeatures,
            json_decode($plan['device_categories'] ?? '[]', true) ?: []
        );
        $updateData['features'] = json_encode(
            normalizeFeaturesValue($request->input('features'), $pricingModeForFeatures)
        );
    }

    // Device categories and default pricing
    if ($request->has('device_categories')) {
        $dc = $request->input('device_categories');
        $updateData['device_categories'] = is_array($dc) ? json_encode($dc) : ($dc ?: '[]');
    }
    if ($request->has('default_device_pricing')) {
        $ddp = $request->input('default_device_pricing');
        $updateData['default_device_pricing'] = is_array($ddp) ? json_encode($ddp) : ($ddp ?: '{}');
    }

    // Boolean alanlar
    if ($request->has('is_popular')) {
        $updateData['is_popular'] = normalizeBooleanDbFlag($request->input('is_popular'));
    }
    if ($request->has('is_enterprise')) {
        $updateData['is_enterprise'] = normalizeBooleanDbFlag($request->input('is_enterprise'));
    }
    if ($request->has('is_active')) {
        $updateData['is_active'] = normalizeBooleanDbFlag($request->input('is_active'));
        // Status'u da senkronize et
        $updateData['status'] = ((int)$updateData['is_active'] === 1) ? 'active' : 'inactive';
    }

    if ($inputPricingMode !== null) {
        if ($inputPricingMode === 'per_device') {
            $updateData['plan_type'] = 'per_device';
            $featuresForMode = isset($updateData['features'])
                ? json_decode($updateData['features'], true)
                : normalizeFeaturesValue($plan['features'] ?? []);
            $updateData['features'] = json_encode(normalizeFeaturesValue($featuresForMode, 'per_device'));
        } elseif ($request->has('plan_type')) {
            $updateData['plan_type'] = normalizeTextValue($request->input('plan_type'), $plan['plan_type'] ?? 'standard');
        }

        if ($inputPricingMode !== 'per_device_type') {
            $updateData['device_categories'] = '[]';
            $updateData['default_device_pricing'] = '{}';
        }

        if (!isset($updateData['features'])) {
            $updateData['features'] = json_encode(normalizeFeaturesValue($plan['features'] ?? [], $inputPricingMode));
        }
    }

    $updateData['updated_at'] = date('Y-m-d H:i:s');

    $db->update('license_plans', $updateData, 'id = ?', [$planId]);

    // Guncel plani getir
    $updatedPlan = $db->fetch("SELECT * FROM license_plans WHERE id = ?", [$planId]);
    $updatedPlan['features'] = json_decode($updatedPlan['features'] ?? '[]', true);
    $updatedPlan['price'] = ((float)$updatedPlan['price']) / 100;
    $updatedPlan['storage_limit'] = (int)($updatedPlan['max_storage'] ?? -1);
    $updatedPlan['device_categories'] = json_decode($updatedPlan['device_categories'] ?? '[]', true);
    $updatedPlan['default_device_pricing'] = json_decode($updatedPlan['default_device_pricing'] ?? '{}', true);
    $updatedPlan = hydrateLicensePlanForResponse($updatedPlan);

    Logger::audit('update', 'license_plan', [
        'id' => $planId,
        'old' => ['name' => $plan['name'], 'price' => $plan['price']],
        'new' => $updateData
    ]);

    Response::success($updatedPlan, 'Plan guncellendi');
}

// DELETE - Plan sil
if ($method === 'DELETE') {
    if (empty($planId)) {
        Response::badRequest('Plan ID gerekli');
    }

    $plan = $db->fetch("SELECT * FROM license_plans WHERE id = ?", [$planId]);
    if (!$plan) {
        Response::notFound('Plan bulunamadi');
    }

    // Bu planin kullanilip kullanilmadigini kontrol et
    $usedInLicenses = $db->fetch(
        "SELECT COUNT(*) as count FROM licenses WHERE plan_id = ?",
        [$planId]
    );

    if ($usedInLicenses && $usedInLicenses['count'] > 0) {
        Response::badRequest('Bu plan ' . $usedInLicenses['count'] . ' lisansta kullaniliyor. Silinemiyor.');
    }

    // Soft delete yerine gercek silme (ya da status degisikligi)
    // Soft delete tercih ediyoruz
    $db->update('license_plans', [
        'status' => 'deleted',
        'is_active' => 0,
        'updated_at' => date('Y-m-d H:i:s')
    ], 'id = ?', [$planId]);

    Logger::audit('delete', 'license_plan', [
        'id' => $planId,
        'old' => ['name' => $plan['name'], 'price' => $plan['price']]
    ]);

    Response::success(null, 'Plan silindi');
}

Response::methodNotAllowed('Desteklenmeyen metod');
