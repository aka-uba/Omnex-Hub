<?php
/**
 * Create Company API (Admin Only)
 *
 * Firma oluşturma - Lisans sadece plan_id ile oluşturulur
 * Tüm limitler license_plans tablosundan alınır
 */

require_once BASE_PATH . '/services/LicenseService.php';
require_once BASE_PATH . '/services/CompanyStorageService.php';

$db = Database::getInstance();
$postCreateWarnings = [];

$name = $request->input('name');
if (!$name) {
    Response::badRequest('Şirket adı gerekli');
}

$id = $db->generateUuid();
$code = strtoupper(substr(preg_replace('/[^a-z0-9]/i', '', $name), 0, 3)) . rand(1000, 9999);

// Generate slug from name
$slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $name));
$slug = trim($slug, '-');

// Ensure unique slug
$baseSlug = $slug;
$counter = 1;
while ($db->fetch("SELECT id FROM companies WHERE slug = ?", [$slug])) {
    $slug = $baseSlug . '-' . $counter;
    $counter++;
}

$db->insert('companies', [
    'id' => $id,
    'name' => $name,
    'slug' => $slug,
    'code' => $code,
    'email' => $request->input('email'),
    'phone' => $request->input('phone'),
    'address' => $request->input('address'),
    'status' => $request->input('status', 'active')
]);

// Plan ID varsa lisans oluştur
// NOT: Limitler sadece license_plans tablosundan okunur
// licenses tablosunda limit alanları artık kullanılmıyor
$planId = $request->input('plan_id');
$licenseExpiresAt = $request->input('license_expires_at');

if ($planId) {
    // Plan bilgisini al
    $plan = $db->fetch("SELECT * FROM license_plans WHERE id = ?", [$planId]);

    if ($plan) {
        // Lisans bitiş tarihi
        $endDate = $licenseExpiresAt;
        if (!$endDate) {
            // Sınırsız plan tipleri için bitiş tarihi yok
            if (in_array($plan['plan_type'], ['enterprise', 'ultimate', 'unlimited'])) {
                $endDate = null;
            } else {
                // Plan süresine göre hesapla
                $months = $plan['duration_months'] ?? 12;
                $endDate = date('Y-m-d H:i:s', strtotime("+{$months} months"));
            }
        }

        // Lisans anahtarı oluştur
        $licenseKey = strtoupper(substr($code, 0, 4) . '-' . bin2hex(random_bytes(4)) . '-' . bin2hex(random_bytes(4)));

        // Lisans kaydı oluştur (sadece plan_id ve süre bilgisi)
        $db->insert('licenses', [
            'id' => $db->generateUuid(),
            'company_id' => $id,
            'plan_id' => $planId,
            'license_key' => $licenseKey,
            'valid_from' => date('Y-m-d H:i:s'),
            'valid_until' => $endDate,
            'status' => 'active'
        ]);
    }
}

$runNonCritical = static function (string $step, callable $fn) use (&$postCreateWarnings): void {
    set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
        throw new ErrorException($message, 0, $severity, $file, $line);
    });

    try {
        $fn();
    } catch (Throwable $e) {
        $postCreateWarnings[] = $step;
        error_log(sprintf('Company create non-critical step failed (%s): %s', $step, $e->getMessage()));
    } finally {
        restore_error_handler();
    }
};

// Move temporary branding files if they exist (non-critical)
$tempId = $request->input('temp_id');
$runNonCritical('branding_move', static function () use ($tempId, $id): void {
    if (!$tempId || strpos($tempId, 'temp_') !== 0) {
        return;
    }

    $tempPath = dirname(__DIR__, 2) . '/storage/temp/' . $tempId . '/branding';
    $targetPath = dirname(__DIR__, 2) . '/storage/companies/' . $id . '/branding';

    if (!is_dir($tempPath)) {
        return;
    }

    if (!is_dir($targetPath) && !mkdir($targetPath, 0755, true) && !is_dir($targetPath)) {
        throw new RuntimeException('Failed to create company branding directory');
    }

    $files = glob($tempPath . '/*') ?: [];
    foreach ($files as $file) {
        $filename = basename($file);
        if (!rename($file, $targetPath . '/' . $filename)) {
            throw new RuntimeException('Failed to move branding file');
        }
    }

    if (!rmdir($tempPath) && is_dir($tempPath)) {
        throw new RuntimeException('Failed to clean temp branding directory');
    }

    $tempParent = dirname($tempPath);
    if (is_dir($tempParent) && count(glob($tempParent . '/*') ?: []) === 0 && !rmdir($tempParent) && is_dir($tempParent)) {
        throw new RuntimeException('Failed to clean temp company directory');
    }
});

// Seed default data for the new company and ensure storage (non-critical)
require_once BASE_PATH . '/services/CompanySeeder.php';
$seedResults = [];
$storageEnsure = [];

$runNonCritical('seed_defaults', static function () use (&$seedResults, $id): void {
    $seeder = new CompanySeeder($id);
    $seedResults = $seeder->seedAllWithStorage();
});

$runNonCritical('ensure_storage', static function () use (&$storageEnsure, $id): void {
    $storageEnsure = CompanyStorageService::ensureForCompany($id);
});

$company = $db->fetch("SELECT * FROM companies WHERE id = ?", [$id]);

// Audit log (non-critical)
$runNonCritical('audit_log', static function () use ($id, $name, $code, $request, $seedResults): void {
    Logger::audit('create', 'company', [
        'id' => $id,
        'new' => [
            'name' => $name,
            'code' => $code,
            'status' => $request->input('status', 'active')
        ],
        'seed_results' => $seedResults
    ]);
});

// Add seed summary to company data
$company['seed_summary'] = !empty($seedResults) ? CompanySeeder::getSummary($seedResults) : null;
$company['storage_summary'] = $storageEnsure;
if (!empty($postCreateWarnings)) {
    $company['post_create_warnings'] = array_values(array_unique($postCreateWarnings));
}

Response::success($company, 'Company created and default data seeded');
