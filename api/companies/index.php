<?php
/**
 * Companies List API (Admin Only)
 *
 * Firma listesi ve lisans/plan bilgileri
 * license_plans tablosu kaynak olarak kullanılır
 */

require_once BASE_PATH . '/services/LicenseService.php';

$db = Database::getInstance();

// Check if branches table exists
$branchesTableExists = false;
try {
    $branchesTableExists = $db->tableExists('branches');
} catch (Exception $e) {
    // Table doesn't exist
}

// Build query based on branches table existence
// Plan limitleri license_plans tablosundan alınır
if ($branchesTableExists) {
    $companies = $db->fetchAll(
        "SELECT c.*,
                (SELECT COUNT(*) FROM users WHERE company_id = c.id) as user_count,
                (SELECT COUNT(*) FROM devices WHERE company_id = c.id) as device_count,
                (SELECT COUNT(*) FROM branches WHERE company_id = c.id AND type = 'region') as region_count,
                (SELECT COUNT(*) FROM branches WHERE company_id = c.id AND type != 'region') as branch_count,
                l.id as license_id,
                l.license_key,
                l.status as license_status,
                l.valid_from as license_valid_from,
                l.valid_until as license_expires_at,
                l.plan_id,
                p.name as plan_name,
                p.slug as plan_slug,
                p.plan_type,
                p.max_users,
                p.max_devices,
                p.max_storage,
                p.max_branches,
                p.duration_months,
                p.price as plan_price,
                p.features as plan_features
         FROM companies c
         LEFT JOIN licenses l ON c.id = l.company_id AND l.status = 'active'
         LEFT JOIN license_plans p ON l.plan_id = p.id
         ORDER BY c.created_at ASC"
    );
} else {
    // Fallback query without branches
    $companies = $db->fetchAll(
        "SELECT c.*,
                (SELECT COUNT(*) FROM users WHERE company_id = c.id) as user_count,
                (SELECT COUNT(*) FROM devices WHERE company_id = c.id) as device_count,
                0 as region_count,
                0 as branch_count,
                l.id as license_id,
                l.license_key,
                l.status as license_status,
                l.valid_from as license_valid_from,
                l.valid_until as license_expires_at,
                l.plan_id,
                p.name as plan_name,
                p.slug as plan_slug,
                p.plan_type,
                p.max_users,
                p.max_devices,
                p.max_storage,
                p.max_branches,
                p.duration_months,
                p.price as plan_price,
                p.features as plan_features
         FROM companies c
         LEFT JOIN licenses l ON c.id = l.company_id AND l.status = 'active'
         LEFT JOIN license_plans p ON l.plan_id = p.id
         ORDER BY c.created_at ASC"
    );
}

// Add branding paths for each company
$brandingBasePath = dirname(__DIR__, 2) . '/storage/companies';
$imageExtensions = ['svg', 'png', 'jpg', 'jpeg', 'webp'];
$icoExtensions = ['svg', 'png', 'ico', 'jpg', 'jpeg', 'webp'];

foreach ($companies as &$company) {
    $company['logo'] = null;      // Logo for general use
    $company['icon'] = null;      // PWA icon (icon-192) for table preview
    $company['favicon'] = null;   // Favicon for header

    $companyBrandingPath = $brandingBasePath . '/' . $company['id'] . '/branding';
    if (is_dir($companyBrandingPath)) {
        // Check for logo
        foreach ($imageExtensions as $ext) {
            $logoFile = $companyBrandingPath . '/logo.' . $ext;
            if (file_exists($logoFile)) {
                $company['logo'] = 'storage/companies/' . $company['id'] . '/branding/logo.' . $ext;
                break;
            }
        }

        // Check for icon-192 (PWA icon for table)
        foreach ($imageExtensions as $ext) {
            $iconFile = $companyBrandingPath . '/icon-192.' . $ext;
            if (file_exists($iconFile)) {
                $company['icon'] = 'storage/companies/' . $company['id'] . '/branding/icon-192.' . $ext;
                break;
            }
        }

        // Check for favicon (for header)
        foreach ($icoExtensions as $ext) {
            $faviconFile = $companyBrandingPath . '/favicon.' . $ext;
            if (file_exists($faviconFile)) {
                $company['favicon'] = 'storage/companies/' . $company['id'] . '/branding/favicon.' . $ext;
                break;
            }
        }
    }

    // Sınırsız plan kontrolü
    $planType = $company['plan_type'] ?? '';
    $company['is_unlimited'] = in_array($planType, ['enterprise', 'ultimate', 'unlimited']);

    // Kalan gün hesapla
    if ($company['license_expires_at']) {
        $company['days_left'] = LicenseService::calculateDaysLeft($company['license_expires_at']);
        $company['is_expired'] = $company['days_left'] !== null && $company['days_left'] < 0;
        $company['is_expiring_soon'] = $company['days_left'] !== null && $company['days_left'] >= 0 && $company['days_left'] <= 7;
    } else {
        $company['days_left'] = null;
        $company['is_expired'] = false;
        $company['is_expiring_soon'] = false;
    }

    // Limit bilgilerini formatlı şekilde ekle
    $company['limits'] = [
        'users' => [
            'limit' => $company['is_unlimited'] ? -1 : ($company['max_users'] ?? 0),
            'used' => (int)$company['user_count'],
            'unlimited' => $company['is_unlimited'] || LicenseService::isUnlimitedValue($company['max_users'] ?? 0)
        ],
        'devices' => [
            'limit' => $company['is_unlimited'] ? -1 : ($company['max_devices'] ?? 0),
            'used' => (int)$company['device_count'],
            'unlimited' => $company['is_unlimited'] || LicenseService::isUnlimitedValue($company['max_devices'] ?? 0)
        ],
        'branches' => [
            'limit' => $company['is_unlimited'] ? -1 : ($company['max_branches'] ?? 0),
            'used' => (int)$company['branch_count'],
            'unlimited' => $company['is_unlimited'] || LicenseService::isUnlimitedValue($company['max_branches'] ?? 0)
        ]
    ];
}

Response::success($companies ?? []);
