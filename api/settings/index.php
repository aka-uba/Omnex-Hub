<?php
/**
 * Settings API - Get/Update settings
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$method = $request->getMethod();
$companyId = Auth::getActiveCompanyId();
$scope = strtolower((string)$request->query('scope', 'user'));
$isCompanyScope = $scope === 'company';
$role = strtolower((string)($user['role'] ?? ''));
$isAdmin = in_array($role, ['superadmin', 'admin'], true);

if ($isCompanyScope && !$isAdmin) {
    Response::error('Firma ayarlarini duzenlemek icin yetki gerekli', 403);
}

if ($method === 'GET') {
    // Get settings for user/company
    $settings = [];

    // Get company settings if exists
    if ($companyId) {
        $companySettings = $db->fetch(
            "SELECT * FROM settings WHERE company_id = ? AND user_id IS NULL",
            [$companyId]
        );
        if ($companySettings) {
            $settings = json_decode($companySettings['data'], true) ?? [];
        }
    }

    // Company scope istendiyse sadece company settings dondur
    if ($isCompanyScope) {
        Response::success($settings);
    }

    // Get user-specific settings (override company settings)
    $userSettings = $db->fetch(
        "SELECT * FROM settings WHERE user_id = ?",
        [$user['id']]
    );
    if ($userSettings) {
        $userData = json_decode($userSettings['data'], true) ?? [];
        $settings = array_merge($settings, $userData);
    }

    // Default settings if empty
    if (empty($settings)) {
        $settings = [
            'language' => 'tr',
            'timezone' => 'Europe/Istanbul',
            'date_format' => 'DD.MM.YYYY',
            'session_timeout_minutes' => 43200,
            'notify_email' => true,
            'notify_push' => false,
            'notify_errors' => true
        ];
    }

    Response::success($settings);

} else if ($method === 'PUT') {
    // Update settings (scope-aware)
    $data = $request->json();
    if (empty($data)) {
        // Fallback for form-encoded payloads
        $data = $request->all();
    }

    if (isset($data['scope'])) {
        unset($data['scope']);
    }

    if ($isCompanyScope) {
        if (!$companyId) {
            Response::error('Aktif firma bulunamadi', 400);
        }

        $existing = $db->fetch(
            "SELECT * FROM settings WHERE company_id = ? AND user_id IS NULL",
            [$companyId]
        );

        if ($existing) {
            $db->update('settings', [
                'data' => json_encode($data),
                'updated_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$existing['id']]);
        } else {
            $db->insert('settings', [
                'id' => $db->generateUuid(),
                'user_id' => null,
                'company_id' => $companyId,
                'data' => json_encode($data)
            ]);
        }

        Response::success($data, 'Firma ayarlari kaydedildi');
    }

    // Default: update user settings

    // Check if user settings exist
    $existing = $db->fetch(
        "SELECT * FROM settings WHERE user_id = ?",
        [$user['id']]
    );

    if ($existing) {
        $db->update('settings', [
            'data' => json_encode($data),
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$existing['id']]);
    } else {
        $db->insert('settings', [
            'id' => $db->generateUuid(),
            'user_id' => $user['id'],
            'company_id' => $companyId,
            'data' => json_encode($data)
        ]);
    }

    Response::success($data, 'Ayarlar kaydedildi');

} else {
    Response::error('Method not allowed', 405);
}
