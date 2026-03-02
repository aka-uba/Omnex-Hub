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

    $db->insert('license_plans', [
        'id' => $id,
        'name' => $name,
        'slug' => $slug,
        'description' => $request->input('description', ''),
        'plan_type' => $request->input('plan_type', 'monthly'),
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
        'is_popular' => (bool)$request->input('is_popular', false),
        'is_enterprise' => (bool)$request->input('is_enterprise', false),
        'sort_order' => (int)$request->input('sort_order', 0),
        'status' => $request->input('status', 'active'),
        'is_active' => (bool)$request->input('is_active', true),
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
        $features = $request->input('features');
        if (is_array($features)) {
            $updateData['features'] = json_encode($features);
        } else {
            $updateData['features'] = $features;
        }
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
        $updateData['is_popular'] = (bool)$request->input('is_popular');
    }
    if ($request->has('is_enterprise')) {
        $updateData['is_enterprise'] = (bool)$request->input('is_enterprise');
    }
    if ($request->has('is_active')) {
        $updateData['is_active'] = (bool)$request->input('is_active');
        // Status'u da senkronize et
        $updateData['status'] = $request->input('is_active') ? 'active' : 'inactive';
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
        'is_active' => false,
        'updated_at' => date('Y-m-d H:i:s')
    ], 'id = ?', [$planId]);

    Logger::audit('delete', 'license_plan', [
        'id' => $planId,
        'old' => ['name' => $plan['name'], 'price' => $plan['price']]
    ]);

    Response::success(null, 'Plan silindi');
}

Response::methodNotAllowed('Desteklenmeyen metod');
