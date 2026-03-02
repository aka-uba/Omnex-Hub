<?php
/**
 * Delete Category API
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$id = $request->routeParam('id');

// Get active company ID (handles SuperAdmin with X-Active-Company header)
$companyId = Auth::getActiveCompanyId();

$category = $db->fetch("SELECT * FROM categories WHERE id = ?", [$id]);
if (!$category) {
    Response::notFound('Kategori bulunamadı');
}

// Security check: ensure category belongs to user's company
if ($category['company_id'] && $companyId && $category['company_id'] !== $companyId) {
    Response::forbidden('Bu kategoriye erişim yetkiniz yok');
}

// Move child categories to parent level (or root if no parent)
$parentId = $category['parent_id'];
$db->query(
    "UPDATE categories SET parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE parent_id = ?",
    [$parentId, $id]
);

// Clear category from products (optional: keep category name in products)
// $db->query("UPDATE products SET category = NULL WHERE category = ?", [$category['name']]);

$db->delete('categories', 'id = ?', [$id]);
Response::success(null, 'Kategori silindi');

