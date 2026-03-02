<?php
/**
 * Delete Pending Sync Request API
 *
 * DELETE /api/esl/pending/:id
 * User Auth required (admin or user with device permissions)
 *
 * Response:
 * - success: true
 * - message: Deletion confirmation
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

// Get request ID from route
$requestId = $request->getRouteParam('id');

if (empty($requestId)) {
    Response::badRequest('Request ID is required');
}

// Find sync request
$syncRequest = $db->fetch(
    "SELECT * FROM device_sync_requests WHERE id = ?",
    [$requestId]
);

if (!$syncRequest) {
    Response::notFound('Sync request not found');
}

// Only allow deletion of non-approved requests
if ($syncRequest['status'] === 'approved' && !empty($syncRequest['device_id'])) {
    Response::error('Cannot delete approved request that created a device', 409);
}

// Delete the sync request
$db->query(
    "DELETE FROM device_sync_requests WHERE id = ?",
    [$requestId]
);

// Log the deletion
if (class_exists('Logger')) {
    Logger::info('Sync request deleted', [
        'request_id' => $requestId,
        'fingerprint' => $syncRequest['fingerprint'] ?? null,
        'sync_code' => $syncRequest['sync_code'] ?? null,
        'deleted_by' => $user['id']
    ]);
}

Response::success([
    'message' => 'Sync request deleted successfully'
]);
