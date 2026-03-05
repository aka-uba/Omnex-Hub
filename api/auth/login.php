<?php
/**
 * Auth Login API
 */

$email = $request->input('email');
$password = $request->input('password');
$remember = $request->input('remember', false);

// Validate input
$validator = Validator::make($request->all(), [
    'email' => 'required|email',
    'password' => 'required|min:6'
]);

if ($validator->fails()) {
    Response::validationError($validator->getErrors());
}

// Rate limiting for login
$rateLimitKey = 'login:' . $request->ip();
if (!Security::checkRateLimit($rateLimitKey, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW)) {
    Response::tooManyRequests(LOGIN_RATE_WINDOW);
}

$db = Database::getInstance();

// Account-based rate limit (15 min window, max 10 attempts)
$accountKey = 'login_account:' . md5(strtolower($email));
if (method_exists('Security', 'checkRateLimitAtomic')) {
    if (!Security::checkRateLimitAtomic($accountKey, 10, 900)) {
        Response::error('Cok fazla basarisiz deneme. Lutfen 15 dakika sonra tekrar deneyin.', 429);
    }
}

// Find user by email
$user = $db->fetch(
    "SELECT * FROM users WHERE email = ? AND status != 'deleted'",
    [$email]
);

if (!$user) {
    Logger::warning('Login failed: User not found', ['email' => $email, 'ip' => $request->ip()]);
    try {
        $db->insert('audit_logs', [
            'id' => $db->generateUuid(),
            'company_id' => null,
            'user_id' => null,
            'action' => 'login_failed',
            'entity_type' => 'auth',
            'old_values' => json_encode(['reason' => 'user_not_found', 'email' => $email]),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => date('Y-m-d H:i:s')
        ]);
    } catch (\Throwable $e) {
        // Don't block login flow if audit logging fails
    }
    Response::error('Geçersiz e-posta veya şifre', 401);
}

// Check password
if (!Auth::verifyPassword($password, $user['password_hash'])) {
    Logger::warning('Login failed: Invalid password', ['email' => $email, 'ip' => $request->ip()]);
    try {
        $db->insert('audit_logs', [
            'id' => $db->generateUuid(),
            'company_id' => $user['company_id'] ?? null,
            'user_id' => $user['id'] ?? null,
            'action' => 'login_failed',
            'entity_type' => 'auth',
            'old_values' => json_encode(['reason' => 'invalid_password', 'email' => $email]),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'created_at' => date('Y-m-d H:i:s')
        ]);
    } catch (\Throwable $e) {
        // Don't block login flow if audit logging fails
    }
    Response::error('Geçersiz e-posta veya şifre', 401);
}

// Check if account is active
if ($user['status'] !== 'active') {
    $messages = [
        'pending' => 'Hesabınız henüz aktif edilmemiş',
        'suspended' => 'Hesabınız askıya alınmış'
    ];
    Response::error($messages[$user['status']] ?? 'Hesabınıza erişilemiyor', 403);
}

// Generate tokens
$tokens = Auth::generateTokens($user);

// Update last login
$db->update('users', [
    'last_login' => date('Y-m-d H:i:s'),
    'last_ip' => $request->ip(),
    'last_user_agent' => $request->userAgent()
], 'id = ?', [$user['id']]);

// Reset account-based rate limit on successful login
if (method_exists('Security', 'resetRateLimit')) {
    Security::resetRateLimit($accountKey);
}

// Log successful login
Logger::audit('login', 'users', ['user_id' => $user['id']]);

// Prepare user data (without sensitive fields)
$userPreferences = [];
if (!empty($user['preferences'])) {
    $userPreferences = json_decode($user['preferences'], true) ?: [];
}

$userData = [
    'id' => $user['id'],
    'email' => $user['email'],
    'first_name' => $user['first_name'],
    'last_name' => $user['last_name'],
    'role' => $user['role'],
    'company_id' => $user['company_id'],
    'avatar' => $user['avatar'],
    'phone' => $user['phone'] ?? null,
    'last_login' => $user['last_login'] ?? null,
    'preferences' => $userPreferences
];

// Load permissions
$permissions = $db->fetchAll(
    "SELECT resource, actions FROM permissions WHERE role = ?",
    [$user['role']]
);

$userData['permissions'] = [];
foreach ($permissions as $perm) {
    $userData['permissions'][$perm['resource']] = json_decode($perm['actions'], true);
}

Response::success([
    'user' => $userData,
    'access_token' => $tokens['access_token'],
    'refresh_token' => $tokens['refresh_token'],
    'token_type' => $tokens['token_type'],
    'expires_in' => $tokens['expires_in']
], 'Giriş başarılı');
