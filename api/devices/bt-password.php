<?php
/**
 * Device Bluetooth Password API
 *
 * GET    /api/devices/:id/bt-password  -> Decrypt and return password
 * POST   /api/devices/:id/bt-password  -> Encrypt and store password
 * DELETE /api/devices/:id/bt-password  -> Remove password (set NULL)
 *
 * PavoDisplay/Kexin cihazların Bluetooth admin şifresi yönetimi.
 * Şifre AES-256-CBC ile şifreli saklanır (Security::encrypt/decrypt).
 *
 * @package OmnexDisplayHub
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Authentication required');
}

// Only admin/manager+ can manage BT passwords
if (!in_array(strtolower($user['role'] ?? ''), ['superadmin', 'admin', 'manager'])) {
    Response::forbidden('Bu işlem için yetkiniz yok');
}

$companyId = Auth::getActiveCompanyId();
$deviceId = $request->routeParam('id');
$method = $request->getMethod();

// Get device
$device = $db->fetch(
    "SELECT id, name, type, model, manufacturer, bt_password_encrypted FROM devices WHERE id = ? AND company_id = ?",
    [$deviceId, $companyId]
);

if (!$device) {
    Response::notFound('Cihaz bulunamadı');
}

switch ($method) {
    case 'GET':
        // Decrypt and return the BT password
        if (empty($device['bt_password_encrypted'])) {
            Response::success([
                'device_id' => $deviceId,
                'bt_protected' => false,
                'password' => null
            ]);
        }

        $plaintext = Security::decrypt($device['bt_password_encrypted']);
        if ($plaintext === null) {
            Response::error('Şifre çözümlenemedi', 500);
        }

        Response::success([
            'device_id' => $deviceId,
            'bt_protected' => true,
            'password' => $plaintext
        ]);
        break;

    case 'POST':
        // Encrypt and store the BT password
        $body = $request->body();
        $password = $body['password'] ?? null;

        if (empty($password) || !is_string($password)) {
            Response::badRequest('Bluetooth şifresi gereklidir');
        }

        if (strlen($password) < 4 || strlen($password) > 64) {
            Response::badRequest('Şifre 4-64 karakter arasında olmalıdır');
        }

        $encrypted = Security::encrypt($password);

        $db->update('devices', [
            'bt_password_encrypted' => $encrypted,
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$deviceId]);

        Logger::audit('bt_password_set', 'devices', [
            'device_id' => $deviceId,
            'device_name' => $device['name'],
            'user_id' => $user['id']
        ]);

        Response::success([
            'device_id' => $deviceId,
            'bt_protected' => true,
            'message' => 'Bluetooth şifresi kaydedildi'
        ]);
        break;

    case 'DELETE':
        // Remove the BT password
        $db->update('devices', [
            'bt_password_encrypted' => null,
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$deviceId]);

        Logger::audit('bt_password_removed', 'devices', [
            'device_id' => $deviceId,
            'device_name' => $device['name'],
            'user_id' => $user['id']
        ]);

        Response::success([
            'device_id' => $deviceId,
            'bt_protected' => false,
            'message' => 'Bluetooth şifresi kaldırıldı'
        ]);
        break;

    default:
        Response::error('Method not allowed', 405);
}
