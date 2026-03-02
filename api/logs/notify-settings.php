<?php
/**
 * Log Management API - Notification settings for critical logs
 * GET: Read current settings
 * PUT: Update settings
 *
 * Settings tablosunda key kolonu olmadığından, sabit bir ID ile kayıt yapılır.
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user || $user['role'] !== 'SuperAdmin') {
    Response::forbidden('Sadece SuperAdmin erişebilir');
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Sabit ID: log bildirim ayarları için
$settingsId = '__log_notify_settings__';

if ($method === 'GET') {
    // Read notification settings
    $row = $db->fetch(
        "SELECT data FROM settings WHERE id = ?",
        [$settingsId]
    );

    $defaults = [
        'enabled' => false,
        'notify_on_critical' => true,
        'notify_on_error' => false,
        'notify_on_size_threshold' => true,
        'size_threshold_mb' => 50,
        'notify_users' => [],
        'include_system_info' => true,
        'include_context' => true,
        'cooldown_minutes' => 60,
        'monitored_files' => ['error.log', 'app.log', 'audit.log']
    ];

    if ($row && !empty($row['data'])) {
        $data = json_decode($row['data'], true) ?: [];
        $result = array_merge($defaults, $data);
    } else {
        $result = $defaults;
    }

    // Get available users for notification (admins and superadmins)
    $availableUsers = $db->fetchAll(
        "SELECT id, first_name, last_name, email, role FROM users WHERE role IN ('SuperAdmin', 'Admin') AND status = 'active' ORDER BY role, first_name"
    );

    $result['available_users'] = $availableUsers;

    Response::success($result);

} elseif ($method === 'PUT') {
    $rawBody = file_get_contents('php://input');
    $body = !empty($rawBody) ? json_decode($rawBody, true) ?: [] : [];

    $settingsData = [
        'enabled' => !empty($body['enabled']),
        'notify_on_critical' => $body['notify_on_critical'] ?? true,
        'notify_on_error' => $body['notify_on_error'] ?? false,
        'notify_on_size_threshold' => $body['notify_on_size_threshold'] ?? true,
        'size_threshold_mb' => max(1, intval($body['size_threshold_mb'] ?? 50)),
        'notify_users' => $body['notify_users'] ?? [],
        'include_system_info' => $body['include_system_info'] ?? true,
        'include_context' => $body['include_context'] ?? true,
        'cooldown_minutes' => max(5, intval($body['cooldown_minutes'] ?? 60)),
        'monitored_files' => $body['monitored_files'] ?? ['error.log', 'app.log', 'audit.log']
    ];

    $existing = $db->fetch("SELECT id FROM settings WHERE id = ?", [$settingsId]);

    if ($existing) {
        $db->update('settings', [
            'data' => json_encode($settingsData, JSON_UNESCAPED_UNICODE),
            'updated_at' => date('Y-m-d H:i:s')
        ], "id = ?", [$settingsId]);
    } else {
        $db->insert('settings', [
            'id' => $settingsId,
            'company_id' => null,
            'user_id' => null,
            'data' => json_encode($settingsData, JSON_UNESCAPED_UNICODE),
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);
    }

    Logger::audit('update', 'log_notification_settings', [
        'new' => $settingsData
    ]);

    Response::success(['message' => 'Bildirim ayarları güncellendi', 'settings' => $settingsData]);

} else {
    Response::error('Method not allowed', 405);
}
