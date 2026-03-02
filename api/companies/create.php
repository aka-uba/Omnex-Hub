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
            'type' => $plan['plan_type'] ?? 'standard',
            'period' => ($plan['duration_months'] ?? 12) >= 12 ? 'yearly' : 'monthly',
            'valid_from' => date('Y-m-d H:i:s'),
            'valid_until' => $endDate,
            'status' => 'active'
        ]);
    }
}

// Move temporary branding files if they exist
$tempId = $request->input('temp_id');
if ($tempId && strpos($tempId, 'temp_') === 0) {
    $tempPath = dirname(__DIR__, 2) . '/storage/temp/' . $tempId . '/branding';
    $targetPath = dirname(__DIR__, 2) . '/storage/companies/' . $id . '/branding';

    if (is_dir($tempPath)) {
        // Ensure target directory exists
        if (!is_dir($targetPath)) {
            mkdir($targetPath, 0755, true);
        }

        // Move all files from temp to target
        $files = glob($tempPath . '/*');
        foreach ($files as $file) {
            $filename = basename($file);
            rename($file, $targetPath . '/' . $filename);
        }

        // Clean up temp directory
        rmdir($tempPath);
        $tempParent = dirname($tempPath);
        if (is_dir($tempParent) && count(glob($tempParent . '/*')) === 0) {
            rmdir($tempParent);
        }
    }
}

// Seed default data for the new company
require_once BASE_PATH . '/services/CompanySeeder.php';
$seeder = new CompanySeeder($id);
$seedResults = $seeder->seedAllWithStorage();
$storageEnsure = CompanyStorageService::ensureForCompany($id);

$company = $db->fetch("SELECT * FROM companies WHERE id = ?", [$id]);

// Audit log
Logger::audit('create', 'company', [
    'id' => $id,
    'new' => [
        'name' => $name,
        'code' => $code,
        'status' => $request->input('status', 'active')
    ],
    'seed_results' => $seedResults
]);

// Add seed summary to company data
$company['seed_summary'] = CompanySeeder::getSummary($seedResults);
$company['storage_summary'] = $storageEnsure;

Response::success($company, 'Company created and default data seeded');
