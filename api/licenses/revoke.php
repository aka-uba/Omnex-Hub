<?php
/**
 * Revoke License API (Admin Only)
 */

$db = Database::getInstance();
$id = $request->routeParam('id');

$license = $db->fetch("SELECT * FROM licenses WHERE id = ?", [$id]);
if (!$license) {
    Response::notFound('Lisans bulunamadı');
}

// Update status - updated_at may not exist in all schema versions
try {
    $db->update('licenses', [
        'status' => 'revoked',
        'updated_at' => date('Y-m-d H:i:s')
    ], 'id = ?', [$id]);
} catch (Exception $e) {
    // Fallback: only update status if updated_at column doesn't exist
    $db->update('licenses', ['status' => 'revoked'], 'id = ?', [$id]);
}

Response::success(null, 'Lisans iptal edildi');
