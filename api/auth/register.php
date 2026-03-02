<?php
/**
 * Auth Register API
 */

require_once BASE_PATH . '/services/CompanyStorageService.php';

$email = $request->input('email');
$password = $request->input('password');
$firstName = $request->input('first_name');
$lastName = $request->input('last_name');
$companyName = $request->input('company_name');

// Validate input
$validator = Validator::make($request->all(), [
    'email' => 'required|email|unique:users,email',
    'password' => 'required|min:8',
    'first_name' => 'required|min:2|max:50',
    'last_name' => 'required|min:2|max:50',
    'company_name' => 'required|min:2|max:100'
]);

if ($validator->fails()) {
    Response::validationError($validator->getErrors());
}

// Validate password strength
$passwordErrors = Security::validatePasswordStrength($password);
if (!empty($passwordErrors)) {
    Response::validationError(['password' => $passwordErrors]);
}

// Rate limiting for registration
$rateLimitKey = 'register:' . $request->ip();
if (!Security::checkRateLimit($rateLimitKey, 5, 3600)) {
    Response::tooManyRequests(3600);
}

$db = Database::getInstance();

try {
    $db->beginTransaction();

    // Create company
    $companyId = $db->generateUuid();
    $companySlug = preg_replace('/[^a-z0-9]+/', '-', strtolower($companyName));
    $companySlug = trim($companySlug, '-');

    // Ensure unique slug
    $existingSlug = $db->fetch(
        "SELECT id FROM companies WHERE slug = ?",
        [$companySlug]
    );

    if ($existingSlug) {
        $companySlug .= '-' . substr($companyId, 0, 6);
    }

    $db->insert('companies', [
        'id' => $companyId,
        'name' => $companyName,
        'slug' => $companySlug,
        'status' => 'active',
        'settings' => json_encode([
            'language' => 'tr',
            'timezone' => 'Europe/Istanbul',
            'currency' => 'TRY'
        ])
    ]);

    // Ensure company storage path exists for newly registered company
    CompanyStorageService::ensureForCompany($companyId);

    // Create user as company admin
    $userId = $db->generateUuid();

    $db->insert('users', [
        'id' => $userId,
        'company_id' => $companyId,
        'email' => $email,
        'password_hash' => Auth::hashPassword($password),
        'first_name' => $firstName,
        'last_name' => $lastName,
        'role' => 'Admin',
        'status' => 'active',
        'preferences' => json_encode([
            'language' => 'tr',
            'theme' => 'light',
            'notifications' => true
        ])
    ]);

    // Create trial license
    $licenseId = $db->generateUuid();
    $db->insert('licenses', [
        'id' => $licenseId,
        'company_id' => $companyId,
        'license_key' => 'TRIAL-' . strtoupper(bin2hex(random_bytes(8))),
        'type' => 'trial',
        'period' => 'monthly',
        'status' => 'active',
        'user_limit' => 3,
        'esl_limit' => 10,
        'tv_limit' => 2,
        'storage_limit' => 500,
        'features' => json_encode(['basic_templates', 'basic_signage']),
        'valid_from' => date('Y-m-d'),
        'valid_until' => date('Y-m-d', strtotime('+30 days'))
    ]);

    // Create default import mapping
    $mappingId = $db->generateUuid();
    $db->insert('import_mappings', [
        'id' => $mappingId,
        'company_id' => $companyId,
        'name' => 'Varsayılan Mapping',
        'description' => 'Otomatik oluşturulmuş varsayılan veri eşleme',
        'format' => 'auto',
        'config' => json_encode([
            'fieldMapping' => [
                'sku' => ['field' => 'STOK_KODU', 'required' => true, 'transform' => 'trim'],
                'barcode' => ['field' => 'BARKOD', 'alternates' => ['BARKOD_NO', 'EAN']],
                'name' => ['field' => 'URUN_ADI', 'required' => true],
                'current_price' => ['field' => 'SATIS_FIYATI', 'transform' => 'number', 'required' => true],
                'previous_price' => ['field' => 'ESKI_FIYAT', 'transform' => 'number'],
                'unit' => ['field' => 'BIRIM', 'default' => 'adet'],
                'category' => ['field' => 'KATEGORI']
            ]
        ]),
        'is_default' => 1,
        'created_by' => $userId
    ]);

    $db->commit();

    // Generate tokens
    $user = $db->fetch("SELECT * FROM users WHERE id = ?", [$userId]);
    $tokens = Auth::generateTokens($user);

    // Log registration
    Logger::audit('register', 'users', [
        'user_id' => $userId,
        'company_id' => $companyId
    ]);

    // Send notification to admins about new registration
    try {
        require_once __DIR__ . '/../../services/NotificationTriggers.php';
        NotificationTriggers::onUserRegistered([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email
        ]);
    } catch (Exception $notifyError) {
        // Notification failure should not break registration
        Logger::warning('Failed to send registration notification', [
            'error' => $notifyError->getMessage()
        ]);
    }

    // Prepare user data
    $userData = [
        'id' => $user['id'],
        'email' => $user['email'],
        'first_name' => $user['first_name'],
        'last_name' => $user['last_name'],
        'role' => $user['role'],
        'company_id' => $user['company_id']
    ];

    Response::success([
        'user' => $userData,
        'access_token' => $tokens['access_token'],
        'refresh_token' => $tokens['refresh_token'],
        'token_type' => $tokens['token_type'],
        'expires_in' => $tokens['expires_in']
    ], 'Kayıt başarılı', 201);

} catch (Exception $e) {
    $db->rollBack();
    Logger::error('Registration failed', ['error' => $e->getMessage()]);
    Response::error('Kayıt sırasında bir hata oluştu', 500);
}
