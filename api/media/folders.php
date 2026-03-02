<?php
/**
 * Media Folders API - Create folder
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

// Fallback for edge cases
if (!$companyId) {
    $firstCompany = $db->fetch("SELECT id FROM companies WHERE status = 'active' ORDER BY created_at LIMIT 1");
    if ($firstCompany) {
        $companyId = $firstCompany['id'];
    }
}

if (!$companyId) {
    Response::error('Company ID gerekli', 400);
}

$data = $request->body();
$name = trim($data['name'] ?? '');
$parentId = $data['parent_id'] ?? null;

if (!$name) {
    Response::error('Klasor adi gerekli', 400);
}

// Check for duplicate name in same parent
$existing = $db->fetch(
    "SELECT id FROM media_folders WHERE name = ? AND company_id = ? AND (parent_id = ? OR (parent_id IS NULL AND ? IS NULL))",
    [$name, $companyId, $parentId, $parentId]
);

if ($existing) {
    Response::error('Bu isimde bir klasor zaten mevcut', 409);
}

// Build path based on parent
$path = '/' . $name;
if ($parentId) {
    $parent = $db->fetch("SELECT path FROM media_folders WHERE id = ?", [$parentId]);
    if ($parent) {
        $path = $parent['path'] . '/' . $name;
    }
}

$id = $db->generateUuid();
$db->insert('media_folders', [
    'id' => $id,
    'company_id' => $companyId,
    'parent_id' => $parentId,
    'name' => $name,
    'path' => $path,
    'created_at' => date('Y-m-d H:i:s'),
    'updated_at' => date('Y-m-d H:i:s')
]);

Response::created([
    'id' => $id,
    'name' => $name,
    'path' => $path,
    'parent_id' => $parentId
]);
