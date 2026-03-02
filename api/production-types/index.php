<?php
/**
 * Production Types API
 *
 * GET    /api/production-types          - List all production types
 * GET    /api/production-types/:id      - Get single production type
 * POST   /api/production-types          - Create production type
 * PUT    /api/production-types/:id      - Update production type
 * DELETE /api/production-types/:id      - Delete production type
 */

$db = Database::getInstance();
$user = Auth::user();
$method = $request->getMethod();
$id = $request->getRouteParam('id');

// Get active company ID (supports SuperAdmin company selection)
$companyId = Auth::getActiveCompanyId();

if (!$companyId) {
    Response::error('Şirket bilgisi bulunamadı', 400);
}

// GET - List or single
if ($method === 'GET') {
    if ($id) {
        // Get single
        $item = $db->fetch(
            "SELECT * FROM production_types WHERE id = ? AND company_id = ?",
            [$id, $companyId]
        );

        if (!$item) {
            Response::notFound('Üretim şekli bulunamadı');
        }

        Response::success($item);
    } else {
        // List all
        $status = $request->input('status');

        $sql = "SELECT * FROM production_types WHERE company_id = ?";
        $params = [$companyId];

        if ($status) {
            $sql .= " AND status = ?";
            $params[] = $status;
        }

        $sql .= " ORDER BY sort_order ASC, name ASC";

        $items = $db->fetchAll($sql, $params);

        Response::success($items);
    }
}

// POST - Create
else if ($method === 'POST') {
    $name = trim($request->input('name', ''));
    $description = trim($request->input('description', ''));
    $color = $request->input('color', '#228be6');
    $sortOrder = intval($request->input('sort_order', 0));
    $status = $request->input('status', 'active');

    if (empty($name)) {
        Response::badRequest('Üretim şekli adı zorunludur');
    }

    // Check duplicate
    $existing = $db->fetch(
        "SELECT id FROM production_types WHERE company_id = ? AND LOWER(name) = LOWER(?)",
        [$companyId, $name]
    );

    if ($existing) {
        Response::badRequest('Bu isimde bir üretim şekli zaten mevcut');
    }

    // Generate slug
    $slug = generateSlug($name);

    $newId = $db->generateUuid();

    $db->insert('production_types', [
        'id' => $newId,
        'company_id' => $companyId,
        'name' => $name,
        'slug' => $slug,
        'description' => $description ?: null,
        'color' => $color,
        'sort_order' => $sortOrder,
        'status' => $status
    ]);

    $item = $db->fetch("SELECT * FROM production_types WHERE id = ?", [$newId]);

    Response::success($item, 'Üretim şekli eklendi');
}

// PUT - Update
else if ($method === 'PUT') {
    if (!$id) {
        Response::badRequest('ID gerekli');
    }

    $item = $db->fetch(
        "SELECT * FROM production_types WHERE id = ? AND company_id = ?",
        [$id, $companyId]
    );

    if (!$item) {
        Response::notFound('Üretim şekli bulunamadı');
    }

    $name = trim($request->input('name', $item['name']));
    $description = $request->input('description', $item['description']);
    $color = $request->input('color', $item['color']);
    $sortOrder = $request->input('sort_order', $item['sort_order']);
    $status = $request->input('status', $item['status']);

    if (empty($name)) {
        Response::badRequest('Üretim şekli adı zorunludur');
    }

    // Check duplicate (exclude self)
    $existing = $db->fetch(
        "SELECT id FROM production_types WHERE company_id = ? AND LOWER(name) = LOWER(?) AND id != ?",
        [$companyId, $name, $id]
    );

    if ($existing) {
        Response::badRequest('Bu isimde bir üretim şekli zaten mevcut');
    }

    // Generate slug if name changed
    $slug = $item['slug'];
    if ($name !== $item['name']) {
        $slug = generateSlug($name);
    }

    $db->update('production_types', [
        'name' => $name,
        'slug' => $slug,
        'description' => $description ?: null,
        'color' => $color,
        'sort_order' => intval($sortOrder),
        'status' => $status,
        'updated_at' => date('Y-m-d H:i:s')
    ], 'id = ?', [$id]);

    $item = $db->fetch("SELECT * FROM production_types WHERE id = ?", [$id]);

    Response::success($item, 'Üretim şekli güncellendi');
}

// DELETE
else if ($method === 'DELETE') {
    if (!$id) {
        Response::badRequest('ID gerekli');
    }

    $item = $db->fetch(
        "SELECT * FROM production_types WHERE id = ? AND company_id = ?",
        [$id, $companyId]
    );

    if (!$item) {
        Response::notFound('Üretim şekli bulunamadı');
    }

    // Check if used in products
    $usedCount = $db->fetch(
        "SELECT COUNT(*) as cnt FROM products WHERE production_type = ? AND company_id = ?",
        [$item['name'], $companyId]
    );

    if ($usedCount && $usedCount['cnt'] > 0) {
        Response::badRequest("Bu üretim şekli {$usedCount['cnt']} üründe kullanılıyor. Önce ürünlerdeki üretim şeklini değiştirin.");
    }

    $db->delete('production_types', 'id = ?', [$id]);

    Response::success(null, 'Üretim şekli silindi');
}

else {
    Response::methodNotAllowed('Desteklenmeyen HTTP metodu');
}

/**
 * Generate URL-friendly slug from text
 */
function generateSlug($text) {
    $turkishMap = [
        'ç' => 'c', 'Ç' => 'C', 'ğ' => 'g', 'Ğ' => 'G',
        'ı' => 'i', 'İ' => 'I', 'ö' => 'o', 'Ö' => 'O',
        'ş' => 's', 'Ş' => 'S', 'ü' => 'u', 'Ü' => 'U'
    ];

    $text = strtr($text, $turkishMap);
    $text = strtolower($text);
    $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
    $text = preg_replace('/[\s-]+/', '-', $text);
    $text = trim($text, '-');

    return $text;
}
