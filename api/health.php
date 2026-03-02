<?php
/**
 * Omnex Display Hub - Health Check Endpoint
 *
 * Public endpoint (no auth required).
 * Used by Docker health checks, CI/CD pipelines, and monitoring.
 *
 * GET /api/health
 */

$response = [
    'status' => 'ok',
    'version' => defined('APP_VERSION') ? APP_VERSION : 'unknown',
    'service' => 'omnex-display-hub',
    'timestamp' => gmdate('Y-m-d\TH:i:s\Z')
];

// Database connectivity check
try {
    $db = Database::getInstance();
    $result = $db->fetch("SELECT 1 AS check_val");
    $response['database'] = ($result && isset($result['check_val'])) ? 'connected' : 'error';
} catch (Exception $e) {
    $response['database'] = 'disconnected';
    $response['status'] = 'degraded';

    // Only show error details in non-production
    if (!defined('PRODUCTION_MODE') || !PRODUCTION_MODE) {
        $response['db_error'] = $e->getMessage();
    }
}

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
http_response_code($response['status'] === 'ok' ? 200 : 503);
echo json_encode($response);
exit;
