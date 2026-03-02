<?php
/**
 * Layout Config API
 *
 * GET    - Get layout configuration (user > company > default)
 * PUT    - Save user configuration
 * POST   - Save company default (admin only)
 * DELETE - Delete user configuration (reset to company/system default)
 */

$db = Database::getInstance();
$user = Auth::user();
$method = $request->getMethod();

// Get active company ID (supports SuperAdmin company selection)
$companyId = Auth::getActiveCompanyId();

if ($method === 'GET') {
    // Get layout config with priority: user > company > default
    $config = null;
    $source = 'default';

    // Try user-specific config
    $userConfig = $db->fetch(
        "SELECT * FROM layout_configs WHERE scope = 'user' AND scope_id = ?",
        [$user['id']]
    );

    if ($userConfig) {
        $config = $userConfig;
        $source = 'user';
    }

    // Fallback to company config
    if (!$config && $companyId) {
        $companyConfig = $db->fetch(
            "SELECT * FROM layout_configs WHERE scope = 'company' AND scope_id = ?",
            [$companyId]
        );

        if ($companyConfig) {
            $config = $companyConfig;
            $source = 'company';
        }
    }

    // Fallback to default config
    if (!$config) {
        $defaultConfig = $db->fetch(
            "SELECT * FROM layout_configs WHERE scope = 'default'"
        );

        if ($defaultConfig) {
            $config = $defaultConfig;
            $source = 'default';
        }
    }

    $data = $config ? json_decode($config['config'], true) : [];

    Response::success([
        'config' => $data,
        'source' => $source
    ]);

} else if ($method === 'PUT') {
    // Update user layout config
    $configData = $request->input('config', []);

    if (empty($configData)) {
        Response::badRequest('Config verisi gerekli');
    }

    // Check if user config exists
    $existing = $db->fetch(
        "SELECT * FROM layout_configs WHERE scope = 'user' AND scope_id = ?",
        [$user['id']]
    );

    if ($existing) {
        $db->update('layout_configs', [
            'config' => json_encode($configData),
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$existing['id']]);
    } else {
        $db->insert('layout_configs', [
            'id' => $db->generateUuid(),
            'scope' => 'user',
            'scope_id' => $user['id'],
            'config' => json_encode($configData)
        ]);
    }

    Response::success([
        'config' => $configData,
        'source' => 'user'
    ], 'Ayarlar kaydedildi');

} else if ($method === 'POST') {
    // Save company default (admin only)
    $scope = $request->input('scope', 'user');
    $configData = $request->input('config', []);

    if (empty($configData)) {
        Response::badRequest('Config verisi gerekli');
    }

    // Only admin can set company defaults
    if ($scope === 'company') {
        if (!in_array($user['role'], ['SuperAdmin', 'Admin'])) {
            Response::forbidden('Bu işlem için yetkiniz yok');
        }

        if (!$companyId) {
            Response::badRequest('Şirket bilgisi bulunamadı');
        }

        // Check if company config exists
        $existing = $db->fetch(
            "SELECT * FROM layout_configs WHERE scope = 'company' AND scope_id = ?",
            [$companyId]
        );

        if ($existing) {
            $db->update('layout_configs', [
                'config' => json_encode($configData),
                'updated_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$existing['id']]);
        } else {
            $db->insert('layout_configs', [
                'id' => $db->generateUuid(),
                'scope' => 'company',
                'scope_id' => $companyId,
                'config' => json_encode($configData)
            ]);
        }

        // Log the action
        Logger::info('Company layout defaults updated', [
            'company_id' => $companyId,
            'user_id' => $user['id']
        ]);

        Response::success([
            'config' => $configData,
            'source' => 'company'
        ], 'Şirket varsayılan ayarları kaydedildi');

    } else {
        // For non-company scope, treat as user config (same as PUT)
        $existing = $db->fetch(
            "SELECT * FROM layout_configs WHERE scope = 'user' AND scope_id = ?",
            [$user['id']]
        );

        if ($existing) {
            $db->update('layout_configs', [
                'config' => json_encode($configData),
                'updated_at' => date('Y-m-d H:i:s')
            ], 'id = ?', [$existing['id']]);
        } else {
            $db->insert('layout_configs', [
                'id' => $db->generateUuid(),
                'scope' => 'user',
                'scope_id' => $user['id'],
                'config' => json_encode($configData)
            ]);
        }

        Response::success([
            'config' => $configData,
            'source' => 'user'
        ], 'Ayarlar kaydedildi');
    }

} else if ($method === 'DELETE') {
    // Delete user layout config (reset to company/system default)
    $existing = $db->fetch(
        "SELECT * FROM layout_configs WHERE scope = 'user' AND scope_id = ?",
        [$user['id']]
    );

    if ($existing) {
        $db->delete('layout_configs', 'id = ?', [$existing['id']]);
    }

    Response::success(null, 'Kullanıcı ayarları sıfırlandı');

} else {
    Response::methodNotAllowed('Desteklenmeyen HTTP metodu');
}
