<?php
/**
 * Bundle Create API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

// Validate
$validator = Validator::make($request->all(), [
    'name' => 'required|max:500',
    'type' => 'required'
]);

if ($validator->fails()) {
    Response::validationError($validator->getErrors());
}

// Validate type
$allowedTypes = ['menu', 'koli', 'package', 'pallet', 'basket', 'custom'];
$type = $request->input('type', 'package');
if (!in_array($type, $allowedTypes)) {
    Response::validationError(['type' => ['Geçersiz paket tipi']]);
}

$bundleId = $db->generateUuid();
$nowDateTime = date('Y-m-d H:i:s');

// Generate slug
$name = $request->input('name');
$slug = $request->input('slug');
if (!$slug) {
    $slug = strtolower(trim($name));
    $slug = preg_replace('/[çÇ]/', 'c', $slug);
    $slug = preg_replace('/[ğĞ]/', 'g', $slug);
    $slug = preg_replace('/[ıİ]/', 'i', $slug);
    $slug = preg_replace('/[öÖ]/', 'o', $slug);
    $slug = preg_replace('/[şŞ]/', 's', $slug);
    $slug = preg_replace('/[üÜ]/', 'u', $slug);
    $slug = preg_replace('/[^a-z0-9\s-]/', '', $slug);
    $slug = preg_replace('/[\s]+/', '-', $slug);
    $slug = preg_replace('/-+/', '-', $slug);
    $slug = trim($slug, '-');
}

// Process items
$items = $request->input('items', []);
$totalPrice = 0;
$itemCount = 0;

$db->beginTransaction();

try {
    // Insert bundle
    $data = [
        'id' => $bundleId,
        'company_id' => $companyId,
        'name' => $name,
        'slug' => $slug,
        'description' => $request->input('description'),
        'type' => $type,
        'image_url' => $request->input('image_url'),
        'images' => $request->input('images') ? (is_string($request->input('images')) ? $request->input('images') : json_encode($request->input('images'))) : null,
        'videos' => $request->input('videos') ? (is_string($request->input('videos')) ? $request->input('videos') : json_encode($request->input('videos'))) : null,
        'video_url' => $request->input('video_url'),
        'cover_image_index' => (int)$request->input('cover_image_index', 0),
        'barcode' => $request->input('barcode'),
        'sku' => $request->input('sku'),
        'currency' => $request->input('currency', 'TRY'),
        'price_valid_from' => $request->input('price_valid_from'),
        'price_valid_until' => $request->input('price_valid_until'),
        'valid_from' => $request->input('valid_from'),
        'valid_until' => $request->input('valid_until'),
        'category' => $request->input('category'),
        'tags' => $request->input('tags') ? (is_string($request->input('tags')) ? $request->input('tags') : json_encode($request->input('tags'))) : null,
        'extra_data' => $request->input('extra_data') ? (is_string($request->input('extra_data')) ? $request->input('extra_data') : json_encode($request->input('extra_data'))) : null,
        'status' => $request->input('status', 'active'),
        'created_by' => $user['id'],
        'created_at' => $nowDateTime,
        'updated_at' => $nowDateTime
    ];

    $db->insert('bundles', $data);

    // Insert items
    if (!empty($items) && is_array($items)) {
        foreach ($items as $index => $item) {
            if (empty($item['product_id'])) continue;

            // Get product current price if not provided
            $unitPrice = isset($item['unit_price']) ? floatval($item['unit_price']) : 0;
            if ($unitPrice <= 0) {
                $product = $db->fetch("SELECT current_price FROM products WHERE id = ?", [$item['product_id']]);
                $unitPrice = $product ? floatval($product['current_price']) : 0;
            }

            $quantity = max(1, (int)($item['quantity'] ?? 1));
            $customPrice = isset($item['custom_price']) && $item['custom_price'] !== '' && $item['custom_price'] !== null ? floatval($item['custom_price']) : null;
            $effectivePrice = $customPrice !== null ? $customPrice : $unitPrice;
            $totalPrice += $effectivePrice * $quantity;
            $itemCount++;

            $db->insert('bundle_items', [
                'id' => $db->generateUuid(),
                'bundle_id' => $bundleId,
                'product_id' => $item['product_id'],
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'custom_price' => $customPrice,
                'sort_order' => $item['sort_order'] ?? $index,
                'notes' => $item['notes'] ?? null,
                'created_at' => $nowDateTime,
                'updated_at' => $nowDateTime
            ]);
        }
    }

    // Calculate pricing
    $discountPercent = floatval($request->input('discount_percent', 0));
    $priceOverride = (int)$request->input('price_override', 0);
    $finalPrice = 0;

    if ($priceOverride && $request->input('final_price') !== null) {
        $finalPrice = floatval($request->input('final_price'));
        if ($totalPrice > 0) {
            $discountPercent = round(($totalPrice - $finalPrice) / $totalPrice * 100, 2);
        }
    } else {
        $finalPrice = round($totalPrice * (1 - $discountPercent / 100), 2);
    }

    // Update bundle with calculated values (including price dates)
    $db->query(
        "UPDATE bundles SET total_price = ?, discount_percent = ?, final_price = ?, price_override = ?, item_count = ?, price_updated_at = ? WHERE id = ?",
        [$totalPrice, $discountPercent, $finalPrice, $priceOverride, $itemCount, $nowDateTime, $bundleId]
    );

    // Record initial price history
    if ($finalPrice > 0) {
        try {
            $db->insert('bundle_price_history', [
                'id' => $db->generateUuid(),
                'bundle_id' => $bundleId,
                'old_price' => null,
                'new_price' => $finalPrice,
                'old_total_price' => null,
                'new_total_price' => $totalPrice,
                'old_discount_percent' => null,
                'new_discount_percent' => $discountPercent,
                'changed_at' => $nowDateTime,
                'source' => 'api',
                'created_at' => $nowDateTime
            ]);
        } catch (Exception $e) {
            // Ignore price history errors
        }
    }

    $db->commit();

    // Fetch created bundle
    $bundle = $db->fetch("SELECT * FROM bundles WHERE id = ?", [$bundleId]);
    $bundle['images'] = !empty($bundle['images']) ? json_decode($bundle['images'], true) ?: [] : [];
    $bundle['videos'] = !empty($bundle['videos']) ? json_decode($bundle['videos'], true) ?: [] : [];
    $bundle['tags'] = !empty($bundle['tags']) ? json_decode($bundle['tags'], true) ?: [] : [];

    Response::success($bundle, 201);

} catch (Exception $e) {
    $db->rollBack();
    Response::error('Paket oluşturulurken hata: ' . $e->getMessage(), 500);
}
