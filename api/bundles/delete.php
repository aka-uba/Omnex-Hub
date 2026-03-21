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
    "SELECT id, name, company_id, sku, barcode FROM bundles WHERE id = ? AND company_id = ?",
    [$bundleId, $companyId]
);

if (!$bundle) {
    Response::error('Paket bulunamadı', 404);
}

try {
    $db->beginTransaction();

    // Log deletion for PriceView bundle delta sync (best-effort)
    if ($db->tableExists('bundle_deletions')) {
        try {
            $db->insert('bundle_deletions', [
                'bundle_id' => $bundle['id'],
                'company_id' => $bundle['company_id'],
                'sku' => $bundle['sku'] ?? null,
                'barcode' => $bundle['barcode'] ?? null,
                'deleted_by' => $user['id'] ?? null
            ]);
        } catch (\Throwable $logError) {
            // Non-critical: do not block delete if log insert fails.
        }
    }

    // Delete (CASCADE will remove bundle_items)
    $db->delete('bundles', 'id = ?', [$bundleId]);
    $db->commit();
} catch (\Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    Response::error('Paket silinemedi', 500);
}

Response::success(['message' => 'Paket silindi: ' . $bundle['name']]);
