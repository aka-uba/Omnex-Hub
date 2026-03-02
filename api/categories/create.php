<?php
/**
 * Create Category API
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Get active company ID (handles SuperAdmin with X-Active-Company header)
$companyId = Auth::getActiveCompanyId();

if (!$companyId) {
    Response::badRequest('Aktif firma bulunamadı');
}

$name = $request->input('name');
if (!$name) {
    Response::badRequest('Kategori adı gerekli');
}

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

$id = $db->generateUuid();
$data = [
    'id' => $id,
    'company_id' => $companyId,
    'name' => $name,
    'slug' => $slug,
    'description' => $request->input('description'),
    'parent_id' => $request->input('parent_id'),
    'color' => $request->input('color', '#228be6'),
    'sort_order' => $request->input('sort_order', 0),
    'status' => $request->input('status', 'active'),
    'created_at' => date('Y-m-d H:i:s'),
    'updated_at' => date('Y-m-d H:i:s')
];

// Remove null values
$data = array_filter($data, fn($v) => $v !== null);

$db->insert('categories', $data);

$category = $db->fetch("SELECT * FROM categories WHERE id = ?", [$id]);
Response::success($category, 'Kategori oluşturuldu');
