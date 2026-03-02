<?php
/**
 * Bundle Update API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$bundleId = $request->getRouteParam('id');

if (!$bundleId) {
    Response::error('Bundle ID gerekli', 400);
}

// Check ownership + get current pricing for history tracking
$existing = $db->fetch(
    "SELECT id, final_price, total_price, discount_percent FROM bundles WHERE id = ? AND company_id = ?",
    [$bundleId, $companyId]
);

if (!$existing) {
    Response::error('Paket bulunamadı', 404);
}

// Check if this is a branch-specific update
$branchId = $request->input('branch_id');
$isBranchUpdate = !empty($branchId);

if ($isBranchUpdate) {
    // Branch-specific price override update
    require_once __DIR__ . '/../../services/BundlePriceResolver.php';

    $branchOverrideFields = [
        'final_price', 'discount_percent', 'total_price', 'price_override',
        'price_valid_from', 'price_valid_until',
        'is_available', 'availability_reason'
    ];

    $overrideData = [];
    foreach ($branchOverrideFields as $field) {
        if ($request->has($field)) {
            $overrideData[$field] = $request->input($field);
        }
    }

    if (empty($overrideData)) {
        Response::error('Şube override için en az bir alan gerekli', 400);
    }

    $result = BundlePriceResolver::setOverride(
        $bundleId,
        $branchId,
        $overrideData,
        'manual',
        $user['id']
    );

    if (!$result['success']) {
        Response::error($result['error'] ?? 'Override oluşturulamadı', 400);
    }

    // Fetch updated bundle with branch resolution
    $resolved = BundlePriceResolver::resolve($bundleId, $branchId);
    $bundle = $db->fetch("SELECT * FROM bundles WHERE id = ?", [$bundleId]);
    $bundle['images'] = !empty($bundle['images']) ? json_decode($bundle['images'], true) ?: [] : [];
    $bundle['videos'] = !empty($bundle['videos']) ? json_decode($bundle['videos'], true) ?: [] : [];
    $bundle['tags'] = !empty($bundle['tags']) ? json_decode($bundle['tags'], true) ?: [] : [];

    // Merge resolved values
    if ($resolved['success']) {
        foreach ($resolved['values'] as $field => $valueInfo) {
            if ($valueInfo['value'] !== null) {
                $bundle[$field] = $valueInfo['value'];
                $bundle['_source_' . $field] = $valueInfo['source'];
            }
        }
        $bundle['_has_override'] = $resolved['has_override'];
        $bundle['_data_source'] = $resolved['source'];
        $bundle['_branch_id'] = $branchId;
    }

    $bundle['_branch_update'] = true;
    $bundle['_branch_action'] = $result['action'];

    Response::success($bundle);
}

// === Master update flow (no branch_id) ===

// Validate
$validator = Validator::make($request->all(), [
    'name' => 'required|max:500'
]);

if ($validator->fails()) {
    Response::validationError($validator->getErrors());
}

// Validate type if provided
$allowedTypes = ['menu', 'koli', 'package', 'pallet', 'basket', 'custom'];
$type = $request->input('type');
if ($type && !in_array($type, $allowedTypes)) {
    Response::validationError(['type' => ['Geçersiz paket tipi']]);
}

$nowDateTime = date('Y-m-d H:i:s');

// Generate slug if name changed
$name = $request->input('name');
$slug = $request->input('slug');
if (!$slug && $name) {
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

$db->beginTransaction();

try {
    // Update bundle fields
    $updateData = [
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
        'status' => $request->input('status'),
        'updated_at' => $nowDateTime
    ];

    // Remove null values that weren't explicitly set
    foreach ($updateData as $key => $value) {
        if ($value === null && !$request->has($key)) {
            unset($updateData[$key]);
        }
    }

    $db->update('bundles', $updateData, 'id = ?', [$bundleId]);

    // Update items if provided
    $items = $request->input('items');
    if ($items !== null && is_array($items)) {
        // Delete existing items
        $db->delete('bundle_items', 'bundle_id = ?', [$bundleId]);

        // Insert new items
        $totalPrice = 0;
        $itemCount = 0;

        foreach ($items as $index => $item) {
            if (empty($item['product_id'])) continue;

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

        // Recalculate pricing
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

        // Track price change
        $oldFinalPrice = floatval($existing['final_price']);
        if (abs($finalPrice - $oldFinalPrice) > 0.001) {
            $db->query(
                "UPDATE bundles SET total_price = ?, discount_percent = ?, final_price = ?, price_override = ?, item_count = ?, previous_final_price = ?, price_updated_at = ?, previous_price_updated_at = ? WHERE id = ?",
                [$totalPrice, $discountPercent, $finalPrice, $priceOverride, $itemCount, $oldFinalPrice, $nowDateTime, $existing['price_updated_at'] ?? null, $bundleId]
            );
            // Record price history
            try {
                $db->insert('bundle_price_history', [
                    'id' => $db->generateUuid(),
                    'bundle_id' => $bundleId,
                    'old_price' => $oldFinalPrice,
                    'new_price' => $finalPrice,
                    'old_total_price' => floatval($existing['total_price']),
                    'new_total_price' => $totalPrice,
                    'old_discount_percent' => floatval($existing['discount_percent']),
                    'new_discount_percent' => $discountPercent,
                    'changed_at' => $nowDateTime,
                    'source' => 'api',
                    'created_at' => $nowDateTime
                ]);
            } catch (Exception $e) { /* ignore */ }
        } else {
            $db->query(
                "UPDATE bundles SET total_price = ?, discount_percent = ?, final_price = ?, price_override = ?, item_count = ? WHERE id = ?",
                [$totalPrice, $discountPercent, $finalPrice, $priceOverride, $itemCount, $bundleId]
            );
        }
    } else {
        // Items not provided, just update pricing fields if given
        $pricingUpdates = [];
        $pricingParams = [];

        if ($request->has('discount_percent') || $request->has('final_price') || $request->has('price_override')) {
            $bundle = $db->fetch("SELECT total_price, discount_percent, final_price, price_override, price_updated_at FROM bundles WHERE id = ?", [$bundleId]);
            $totalPrice = floatval($bundle['total_price']);
            $discountPercent = floatval($request->input('discount_percent', $bundle['discount_percent']));
            $priceOverride = (int)$request->input('price_override', $bundle['price_override']);

            if ($priceOverride && $request->has('final_price')) {
                $finalPrice = floatval($request->input('final_price'));
                if ($totalPrice > 0) {
                    $discountPercent = round(($totalPrice - $finalPrice) / $totalPrice * 100, 2);
                }
            } else {
                $finalPrice = round($totalPrice * (1 - $discountPercent / 100), 2);
            }

            // Track price change
            $oldFinalPrice = floatval($bundle['final_price']);
            if (abs($finalPrice - $oldFinalPrice) > 0.001) {
                $db->query(
                    "UPDATE bundles SET discount_percent = ?, final_price = ?, price_override = ?, previous_final_price = ?, price_updated_at = ?, previous_price_updated_at = ? WHERE id = ?",
                    [$discountPercent, $finalPrice, $priceOverride, $oldFinalPrice, $nowDateTime, $bundle['price_updated_at'] ?? null, $bundleId]
                );
                try {
                    $db->insert('bundle_price_history', [
                        'id' => $db->generateUuid(),
                        'bundle_id' => $bundleId,
                        'old_price' => $oldFinalPrice,
                        'new_price' => $finalPrice,
                        'old_total_price' => $totalPrice,
                        'new_total_price' => $totalPrice,
                        'old_discount_percent' => floatval($bundle['discount_percent']),
                        'new_discount_percent' => $discountPercent,
                        'changed_at' => $nowDateTime,
                        'source' => 'api',
                        'created_at' => $nowDateTime
                    ]);
                } catch (Exception $e) { /* ignore */ }
            } else {
                $db->query(
                    "UPDATE bundles SET discount_percent = ?, final_price = ?, price_override = ? WHERE id = ?",
                    [$discountPercent, $finalPrice, $priceOverride, $bundleId]
                );
            }
        }
    }

    $db->commit();

    // Fetch updated bundle
    $bundle = $db->fetch("SELECT * FROM bundles WHERE id = ?", [$bundleId]);
    $bundle['images'] = !empty($bundle['images']) ? json_decode($bundle['images'], true) ?: [] : [];
    $bundle['videos'] = !empty($bundle['videos']) ? json_decode($bundle['videos'], true) ?: [] : [];
    $bundle['tags'] = !empty($bundle['tags']) ? json_decode($bundle['tags'], true) ?: [] : [];

    Response::success($bundle);

} catch (Exception $e) {
    $db->rollBack();
    Response::error('Paket güncellenirken hata: ' . $e->getMessage(), 500);
}
