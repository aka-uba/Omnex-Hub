<?php
/**
 * User Notification Settings API
 * GET /api/notifications/settings - Get user's notification settings
 * PUT /api/notifications/settings - Update user's notification settings
 *
 * Settings include:
 * - enabled: boolean (master switch)
 * - sound: boolean (sound notifications)
 * - desktop: boolean (desktop/push notifications)
 * - types: object (per-type channel settings)
 * - email_digest: string (never, daily, weekly)
 * - dnd_enabled: boolean (do not disturb)
 * - dnd_start: string (HH:MM)
 * - dnd_end: string (HH:MM)
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$userId = $user['id'];
$companyId = Auth::getActiveCompanyId();
$role = strtolower((string)($user['role'] ?? ''));
$isSuperAdmin = $role === 'superadmin';
$method = $request->getMethod();

// Use user_notification_preferences table (separate from company notification_settings)
$tableName = 'user_notification_preferences';

if ($method === 'GET') {
    $companyRetentionDays = 30;
    if ($isSuperAdmin && !empty($companyId)) {
        $companySettings = $db->fetch(
            "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
            [$companyId]
        );
        if (!empty($companySettings['data'])) {
            $companyData = json_decode($companySettings['data'], true) ?? [];
            $configuredRetention = (int)($companyData['device_notification_retention_days'] ?? 30);
            $companyRetentionDays = max(1, min(365, $configuredRetention));
        }
    }

    // Get user's notification settings
    $settings = $db->fetch(
        "SELECT * FROM $tableName WHERE user_id = ?",
        [$userId]
    );

    if ($settings) {
        // Parse JSON fields and map to frontend format
        $typePrefs = json_decode($settings['type_preferences'], true) ?? [];
        $visibleTypePrefs = array_filter($typePrefs, function($key) {
            return strpos($key, '_') !== 0; // hide internal keys
        }, ARRAY_FILTER_USE_KEY);

        $response = [
            'user_id' => $settings['user_id'],
            'enabled' => (bool)$settings['web_enabled'],
            'sound' => (bool)$settings['sound_enabled'],
            'desktop' => (bool)$settings['push_enabled'],
            'types' => !empty($visibleTypePrefs) ? $visibleTypePrefs : [
                'info' => ['web' => true, 'push' => false, 'email' => false],
                'success' => ['web' => true, 'push' => false, 'email' => false],
                'warning' => ['web' => true, 'push' => true, 'email' => false],
                'error' => ['web' => true, 'push' => true, 'email' => true],
                'system' => ['web' => true, 'push' => false, 'email' => false]
            ],
            'email_digest' => 'never',
            'dnd_enabled' => !empty($settings['quiet_start']) && !empty($settings['quiet_end']),
            'dnd_start' => $settings['quiet_start'] ?? '22:00',
            'dnd_end' => $settings['quiet_end'] ?? '08:00',
            'device_notification_retention_days' => $companyRetentionDays
        ];

        // Check if there's email_digest stored in type_preferences
        if (isset($typePrefs['_email_digest'])) {
            $response['email_digest'] = $typePrefs['_email_digest'];
        }
        if (isset($typePrefs['_dnd_enabled'])) {
            $response['dnd_enabled'] = (bool)$typePrefs['_dnd_enabled'];
        }
    } else {
        // Return default settings
        $response = [
            'user_id' => $userId,
            'enabled' => true,
            'sound' => true,
            'desktop' => false,
            'types' => [
                'info' => ['web' => true, 'push' => false, 'email' => false],
                'success' => ['web' => true, 'push' => false, 'email' => false],
                'warning' => ['web' => true, 'push' => true, 'email' => false],
                'error' => ['web' => true, 'push' => true, 'email' => true],
                'system' => ['web' => true, 'push' => false, 'email' => false]
            ],
            'email_digest' => 'never',
            'dnd_enabled' => false,
            'dnd_start' => '22:00',
            'dnd_end' => '08:00',
            'device_notification_retention_days' => $companyRetentionDays
        ];
    }

    Response::success($response);

} elseif ($method === 'PUT') {
    // Update user's notification settings
    $data = $request->all();

    // Prepare update data mapping frontend fields to database fields
    $updateData = [
        'updated_at' => date('Y-m-d H:i:s')
    ];

    if (array_key_exists('device_notification_retention_days', $data)) {
        if (!$isSuperAdmin) {
            Response::forbidden('Bu ayari guncellemek icin SuperAdmin yetkisi gerekli');
        }

        if (empty($companyId)) {
            Response::badRequest('Aktif firma bulunamadi');
        }

        $retentionDays = max(1, min(365, (int)$data['device_notification_retention_days']));
        $companySettingsRow = $db->fetch(
            "SELECT id, data FROM settings WHERE company_id = ? AND user_id IS NULL",
            [$companyId]
        );

        $companySettingsData = [];
        if (!empty($companySettingsRow['data'])) {
            $companySettingsData = json_decode($companySettingsRow['data'], true) ?? [];
        }
        $companySettingsData['device_notification_retention_days'] = $retentionDays;

        if ($companySettingsRow) {
            $db->update('settings', [
                'data' => json_encode($companySettingsData),
                'updated_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$companySettingsRow['id']]);
        } else {
            $db->insert('settings', [
                'id' => $db->generateUuid(),
                'company_id' => $companyId,
                'user_id' => null,
                'data' => json_encode($companySettingsData),
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ]);
        }
    }

    // Master switch -> web_enabled
    if (isset($data['enabled'])) {
        $updateData['web_enabled'] = $data['enabled'] ? 1 : 0;
        $updateData['toast_enabled'] = $data['enabled'] ? 1 : 0;
    }

    // Sound
    if (isset($data['sound'])) {
        $updateData['sound_enabled'] = $data['sound'] ? 1 : 0;
    }

    // Desktop/Push
    if (isset($data['desktop'])) {
        $updateData['push_enabled'] = $data['desktop'] ? 1 : 0;
    }

    // Types and extra settings stored as JSON
    $typePrefs = [];
    if (isset($data['types'])) {
        $typePrefs = $data['types'];
    }

    // Store email_digest and dnd_enabled in type_preferences JSON
    if (isset($data['email_digest'])) {
        $typePrefs['_email_digest'] = $data['email_digest'];
        // Also update email_enabled based on email_digest
        $updateData['email_enabled'] = $data['email_digest'] !== 'never' ? 1 : 0;
    }
    if (isset($data['dnd_enabled'])) {
        $typePrefs['_dnd_enabled'] = $data['dnd_enabled'];
    }

    if (!empty($typePrefs)) {
        $updateData['type_preferences'] = json_encode($typePrefs);
    }

    // Quiet hours / DND times
    $dndEnabled = isset($data['dnd_enabled']) ? (bool)$data['dnd_enabled'] : null;
    if ($dndEnabled === false) {
        // Explicitly clear quiet hours when DND is disabled
        $updateData['quiet_start'] = null;
        $updateData['quiet_end'] = null;
    } elseif ($dndEnabled === true || array_key_exists('dnd_start', $data) || array_key_exists('dnd_end', $data)) {
        $dndStart = $data['dnd_start'] ?? null;
        $dndEnd = $data['dnd_end'] ?? null;

        if ($dndStart !== null && !preg_match('/^\d{2}:\d{2}$/', $dndStart)) {
            Response::badRequest('Sessiz saat baslangici HH:MM formatinda olmali');
        }
        if ($dndEnd !== null && !preg_match('/^\d{2}:\d{2}$/', $dndEnd)) {
            Response::badRequest('Sessiz saat bitisi HH:MM formatinda olmali');
        }

        $updateData['quiet_start'] = $dndStart;
        $updateData['quiet_end'] = $dndEnd;
    }

    // Check if settings exist
    $existing = $db->fetch(
        "SELECT id FROM $tableName WHERE user_id = ?",
        [$userId]
    );

    if ($existing) {
        // Update existing settings
        $db->update($tableName, $updateData, 'id = ?', [$existing['id']]);
    } else {
        // Create new settings record
        $updateData['id'] = $db->generateUuid();
        $updateData['user_id'] = $userId;
        $updateData['created_at'] = date('Y-m-d H:i:s');

        // Set defaults for missing fields
        if (!isset($updateData['email_enabled'])) $updateData['email_enabled'] = 0;
        if (!isset($updateData['push_enabled'])) $updateData['push_enabled'] = 0;
        if (!isset($updateData['toast_enabled'])) $updateData['toast_enabled'] = 1;
        if (!isset($updateData['web_enabled'])) $updateData['web_enabled'] = 1;
        if (!isset($updateData['sound_enabled'])) $updateData['sound_enabled'] = 1;
        if (!isset($updateData['type_preferences'])) $updateData['type_preferences'] = '{}';

        $db->insert($tableName, $updateData);
    }

    // Get updated settings and format response
    $settings = $db->fetch(
        "SELECT * FROM $tableName WHERE user_id = ?",
        [$userId]
    );

    $typePrefs = json_decode($settings['type_preferences'], true) ?? [];

    $response = [
        'user_id' => $settings['user_id'],
        'enabled' => (bool)$settings['web_enabled'],
        'sound' => (bool)$settings['sound_enabled'],
        'desktop' => (bool)$settings['push_enabled'],
        'types' => array_filter($typePrefs, function($key) {
            return strpos($key, '_') !== 0; // Filter out internal keys like _email_digest
        }, ARRAY_FILTER_USE_KEY),
        'email_digest' => $typePrefs['_email_digest'] ?? 'never',
        'dnd_enabled' => $typePrefs['_dnd_enabled'] ?? false,
        'dnd_start' => $settings['quiet_start'] ?? '22:00',
        'dnd_end' => $settings['quiet_end'] ?? '08:00'
    ];

    if ($isSuperAdmin && !empty($companyId)) {
        $companySettings = $db->fetch(
            "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
            [$companyId]
        );
        $companyData = !empty($companySettings['data'])
            ? (json_decode($companySettings['data'], true) ?? [])
            : [];
        $response['device_notification_retention_days'] = max(
            1,
            min(365, (int)($companyData['device_notification_retention_days'] ?? 30))
        );
    }

    Response::success($response, 'Bildirim ayarlari kaydedildi');

} else {
    Response::methodNotAllowed('Method not allowed');
}
