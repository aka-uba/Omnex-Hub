<?php
/**
 * Bundle Delete API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$bundleId = $request->getRouteParam('id');

if (!$bundleId) {
    Response::error('Bundle ID gerekli', 400);
}

// Check ownership
$bundle = $db->fetch(
    "SELECT id, name FROM bundles WHERE id = ? AND company_id = ?",
    [$bundleId, $companyId]
);

if (!$bundle) {
    Response::error('Paket bulunamadı', 404);
}

// Delete (CASCADE will remove bundle_items)
$db->delete('bundles', 'id = ?', [$bundleId]);

Response::success(['message' => 'Paket silindi: ' . $bundle['name']]);
