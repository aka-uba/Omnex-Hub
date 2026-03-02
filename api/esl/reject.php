<?php
/**
 * ESL Device Rejection API
 *
 * POST /api/esl/reject
 * User Auth required (admin or user with device permissions)
 *
 * Body:
 * - syncCode (required): 6-digit sync code from device
 * - reason: Rejection reason (optional)
 *
 * Response:
 * - success: true
 * - message: Rejection confirmation
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

// Get active company ID for tenant isolation
$companyId = Auth::getActiveCompanyId();
if (empty($companyId)) {
    Response::badRequest('Active company context is required for device rejection');
}

// Get request data
$data = $request->json();

// Accept both syncCode and sync_code, also request_id
$syncCode = trim($data['syncCode'] ?? $data['sync_code'] ?? '');
$requestId = $data['request_id'] ?? null;
$reason = $data['reason'] ?? null;

// Validate - need either sync code or request id
if (empty($syncCode) && empty($requestId)) {
    Response::badRequest('Sync code or request ID is required');
}

// Validate sync code format if provided
if ($syncCode && !preg_match('/^\d{6}$/', $syncCode)) {
    Response::badRequest('Invalid sync code format. Must be 6 digits.');
}

// Find pending sync request
$syncRequest = null;
if ($requestId) {
    $syncRequest = $db->fetch(
        "SELECT * FROM device_sync_requests
         WHERE id = ? AND status = 'pending'
           AND (company_id = ? OR company_id IS NULL)",
        [$requestId, $companyId]
    );
} elseif ($syncCode) {
    $syncRequest = $db->fetch(
        "SELECT * FROM device_sync_requests
         WHERE sync_code = ? AND status = 'pending'
           AND (company_id = ? OR company_id IS NULL)",
        [$syncCode, $companyId]
    );
}

if (!$syncRequest) {
    $existingRequest = null;
    if ($requestId) {
        $existingRequest = $db->fetch("SELECT status, company_id FROM device_sync_requests WHERE id = ?", [$requestId]);
    } elseif ($syncCode) {
        $existingRequest = $db->fetch("SELECT status, company_id FROM device_sync_requests WHERE sync_code = ?", [$syncCode]);
    }

    if ($existingRequest) {
        if (!empty($existingRequest['company_id']) && $existingRequest['company_id'] !== $companyId) {
            Response::forbidden('This registration belongs to another company');
        }

        if ($existingRequest['status'] === 'approved') {
            Response::error('This device has already been approved', 409);
        } elseif ($existingRequest['status'] === 'rejected') {
            Response::error('This device registration was already rejected', 409);
        }
    }

    Response::notFound('Invalid sync code or request ID. Please check and try again.');
}

// Update sync request status to rejected
$db->query(
    "UPDATE device_sync_requests
     SET company_id = COALESCE(company_id, ?),
         status = 'rejected',
         rejection_reason = ?,
         approved_by = ?,
         approved_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?",
    [$companyId, $reason, $user['id'], $syncRequest['id']]
);

// Log the rejection
if (class_exists('Logger')) {
    Logger::info('Device registration rejected', [
        'request_id' => $syncRequest['id'],
        'fingerprint' => $syncRequest['fingerprint'] ?? null,
        'serial_number' => $syncRequest['serial_number'] ?? null,
        'rejected_by' => $user['id'],
        'reason' => $reason
    ]);
}

Response::success([
    'message' => 'Device registration rejected successfully',
    'serialNumber' => $syncRequest['serial_number'] ?? $syncRequest['fingerprint'] ?? null,
    'reason' => $reason
]);

