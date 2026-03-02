<?php
/**
 * Create Notification API
 * POST /api/notifications
 *
 * Body: {
 *   title: string (required),
 *   message: string,
 *   type: string (info, success, warning, error, system),
 *   icon: string,
 *   link: string,
 *   target_type: string (user, role, company, all),
 *   target_id: string (user_id, role name, company_id),
 *   channels: array (["web", "push", "toast", "email"]),
 *   priority: string (low, normal, high, urgent),
 *   expires_at: string (ISO datetime)
 * }
 *
 * Permission: Admin/SuperAdmin only
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
if (!$companyId) {
    Response::badRequest('Aktif firma bulunamadi');
}

// Permission check
$isAdmin = in_array($user['role'], ['SuperAdmin', 'Admin'], true);
if (!$isAdmin) {
    Response::forbidden('Bildirim olusturma yetkisi sadece yoneticilere aittir');
}

// Validate required fields
$title = trim((string)$request->input('title', ''));
if ($title === '') {
    Response::badRequest('Bildirim basligi gerekli');
}

// Optional fields
$message = trim((string)$request->input('message', ''));
$type = strtolower((string)$request->input('type', 'info'));
$icon = $request->input('icon');
$link = $request->input('link');
$targetType = strtolower((string)$request->input('target_type', 'user'));
$targetId = $request->input('target_id');
$rawChannels = $request->input('channels', ['web']);
$priority = strtolower((string)$request->input('priority', 'normal'));
$expiresAt = $request->input('expires_at');

// Validate type
$validTypes = ['info', 'success', 'warning', 'error', 'system'];
if (!in_array($type, $validTypes, true)) {
    Response::badRequest('Gecersiz bildirim tipi. Gecerli tipler: ' . implode(', ', $validTypes));
}

// Validate priority
$validPriorities = ['low', 'normal', 'high', 'urgent'];
if (!in_array($priority, $validPriorities, true)) {
    Response::badRequest('Gecersiz oncelik. Gecerli oncelikler: ' . implode(', ', $validPriorities));
}

// Validate target type
$validTargetTypes = ['user', 'role', 'company', 'all'];
if (!in_array($targetType, $validTargetTypes, true)) {
    Response::badRequest('Gecersiz hedef tipi. Gecerli tipler: ' . implode(', ', $validTargetTypes));
}

// Normalize channels
$channels = is_array($rawChannels) ? $rawChannels : [$rawChannels];
$channels = array_values(array_unique(array_filter(array_map(
    fn($ch) => strtolower(trim((string)$ch)),
    $channels
))));
$validChannels = ['web', 'push', 'toast', 'email'];
$channels = array_values(array_filter($channels, fn($ch) => in_array($ch, $validChannels, true)));
if (empty($channels)) {
    $channels = ['web'];
}

$scopeCompanyId = $companyId;
$recipients = [];

switch ($targetType) {
    case 'user':
        if (!$targetId) {
            Response::badRequest('Hedef kullanici gerekli');
        }

        // Keep tenant isolation: user must belong to active company context
        $targetUser = $db->fetch(
            "SELECT id, company_id FROM users WHERE id = ? AND company_id = ? AND status = 'active'",
            [$targetId, $companyId]
        );
        if (!$targetUser) {
            Response::notFound('Kullanici bulunamadi veya aktif degil');
        }
        $scopeCompanyId = $targetUser['company_id'];
        $recipients = [$targetUser['id']];
        break;

    case 'role':
        if (!$targetId) {
            Response::badRequest('Hedef rol gerekli');
        }

        $roleUsers = $db->fetchAll(
            "SELECT id FROM users
             WHERE LOWER(role) = LOWER(?) AND company_id = ? AND status = 'active'",
            [$targetId, $companyId]
        );
        $recipients = array_column($roleUsers, 'id');
        break;

    case 'company':
        if ($targetId) {
            if ($user['role'] !== 'SuperAdmin' && $targetId !== $companyId) {
                Response::forbidden('Baska firmalara bildirim gonderemezsiniz');
            }

            // SuperAdmin can pick a different company explicitly
            if ($user['role'] === 'SuperAdmin' || $targetId === $companyId) {
                $targetCompany = $db->fetch("SELECT id FROM companies WHERE id = ?", [$targetId]);
                if (!$targetCompany) {
                    Response::notFound('Firma bulunamadi');
                }
                $scopeCompanyId = $targetCompany['id'];
            }
        }

        $companyUsers = $db->fetchAll(
            "SELECT id FROM users WHERE company_id = ? AND status = 'active'",
            [$scopeCompanyId]
        );
        $recipients = array_column($companyUsers, 'id');
        break;

    case 'all':
        // In this app, "all" is scoped to active company context.
        $allUsers = $db->fetchAll(
            "SELECT id FROM users WHERE company_id = ? AND status = 'active'",
            [$companyId]
        );
        $recipients = array_column($allUsers, 'id');
        break;
}

$recipients = array_values(array_unique(array_filter($recipients)));
if (empty($recipients)) {
    Response::badRequest('Bu hedef icin aktif alici bulunamadi');
}

// Create notification record
$notificationId = $db->generateUuid();
$notificationData = [
    'id' => $notificationId,
    'company_id' => $scopeCompanyId,
    'title' => $title,
    'message' => $message !== '' ? $message : null,
    'type' => $type,
    'icon' => $icon,
    'link' => $link,
    'target_type' => $targetType,
    'target_id' => $targetId,
    'channels' => json_encode($channels),
    'priority' => $priority,
    'expires_at' => $expiresAt,
    'created_by' => $user['id'],
    'created_at' => date('Y-m-d H:i:s')
];

// Remove null values
$notificationData = array_filter($notificationData, fn($v) => $v !== null);
$db->insert('notifications', $notificationData);

// Create recipient records
$recipientCount = 0;
foreach ($recipients as $recipientUserId) {
    $db->insert('notification_recipients', [
        'id' => $db->generateUuid(),
        'notification_id' => $notificationId,
        'user_id' => $recipientUserId,
        'status' => 'unread'
    ]);
    $recipientCount++;
}

// Return created notification
$notification = $db->fetch("SELECT * FROM notifications WHERE id = ?", [$notificationId]);
$notification['channels'] = json_decode($notification['channels'] ?? '["web"]', true);
$notification['recipient_count'] = $recipientCount;

Response::created($notification, 'Bildirim olusturuldu');
