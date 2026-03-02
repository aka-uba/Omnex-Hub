<?php
/**
 * Update Category API
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$id = $request->routeParam('id');

// Get active company ID (handles SuperAdmin with X-Active-Company header)
$companyId = Auth::getActiveCompanyId();

// Fetch category with company check for security
$category = $db->fetch("SELECT * FROM categories WHERE id = ?", [$id]);
if (!$category) {
    Response::notFound('Kategori bulunamadı');
}

// Security check: ensure category belongs to user's company
if ($category['company_id'] && $companyId && $category['company_id'] !== $companyId) {
    Response::forbidden('Bu kategoriye erişim yetkiniz yok');
}

$name = $request->input('name');
$data = ['updated_at' => date('Y-m-d H:i:s')];

if ($name) {
    $data['name'] = $name;
    // Generate slug from name
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
    $data['slug'] = $slug;
}
if ($request->has('description')) {
    $data['description'] = $request->input('description');
}
if ($request->has('parent_id')) {
    $parentId = $request->input('parent_id');
    // Validate: category cannot be its own parent
    if ($parentId === $id) {
        Response::badRequest('Kategori kendi üst kategorisi olamaz');
    }
    // Validate: parent cannot be a child of this category (circular reference)
    if ($parentId) {
        $checkParent = $parentId;
        while ($checkParent) {
            $parent = $db->fetch("SELECT parent_id FROM categories WHERE id = ?", [$checkParent]);
            if (!$parent) break;
            if ($parent['parent_id'] === $id) {
                Response::badRequest('Döngüsel kategori referansı oluşturulamaz');
            }
            $checkParent = $parent['parent_id'];
        }
    }
    $data['parent_id'] = $parentId ?: null;
}
if ($request->has('color')) {
    $data['color'] = $request->input('color');
}
if ($request->has('sort_order')) {
    $data['sort_order'] = (int)$request->input('sort_order');
}
if ($request->has('status')) {
    $data['status'] = $request->input('status');
}

$db->update('categories', $data, 'id = ?', [$id]);

$category = $db->fetch("SELECT * FROM categories WHERE id = ?", [$id]);
Response::success($category, 'Kategori güncellendi');
