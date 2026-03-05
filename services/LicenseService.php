<?php
/**
 * LicenseService - Merkezi Lisans ve Limit Yönetim Servisi
 *
 * Tüm limit kontrolleri license_plans tablosundan yapılır.
 * licenses tablosu sadece firma-plan bağlantısı ve süre bilgisi tutar.
 *
 * @package OmnexDisplayHub
 */

class LicenseService
{
    private static ?array $cache = [];

    /**
     * Sınırsız kabul edilen plan tipleri
     */
    private static array $unlimitedPlanTypes = ['enterprise', 'ultimate', 'unlimited'];

    /**
     * Sınırsız kabul edilen limit değerleri
     * 0, -1 veya null = sınırsız
     */
    public static function isUnlimitedValue($value): bool
    {
        return $value === null || $value === 0 || $value === -1 || $value === '0' || $value === '-1';
    }

    /**
     * Firma lisans ve plan bilgisini al (cache'li)
     */
    public static function getCompanyLicense(string $companyId, bool $forceRefresh = false): ?array
    {
        $cacheKey = "license_{$companyId}";

        if (!$forceRefresh && isset(self::$cache[$cacheKey])) {
            return self::$cache[$cacheKey];
        }

        $db = Database::getInstance();

        $result = $db->fetch(
            "SELECT
                l.id as license_id,
                l.company_id,
                l.plan_id,
                l.license_key,
                l.valid_from,
                l.valid_until,
                l.status as license_status,
                l.created_at as license_created_at,

                p.id as plan_id,
                p.name as plan_name,
                p.plan_type,
                p.max_users,
                p.max_devices,
                p.max_storage,
                p.max_branches,
                p.duration_months,
                p.price,
                p.is_active as plan_is_active,
                p.is_unlimited as plan_is_unlimited,
                p.features as plan_features

             FROM licenses l
             LEFT JOIN license_plans p ON l.plan_id = p.id
             WHERE l.company_id = ?
             AND l.status = 'active'
             ORDER BY l.created_at DESC
             LIMIT 1",
            [$companyId]
        );

        if ($result) {
            // Plan sınırsız mı: DB'den is_unlimited veya plan_type fallback
            $dbUnlimited = isset($result['plan_is_unlimited']) && (int)$result['plan_is_unlimited'] === 1;
            $typeUnlimited = in_array($result['plan_type'], self::$unlimitedPlanTypes);
            $result['is_unlimited'] = $dbUnlimited || $typeUnlimited;

            // Kalan gün hesapla
            $result['days_left'] = self::calculateDaysLeft($result['valid_until']);
            $result['is_expired'] = $result['days_left'] !== null && $result['days_left'] < 0;
            $result['is_expiring_soon'] = $result['days_left'] !== null && $result['days_left'] >= 0 && $result['days_left'] <= 7;
        }

        self::$cache[$cacheKey] = $result;
        return $result;
    }

    /**
     * Kalan gün hesapla
     */
    public static function calculateDaysLeft(?string $validUntil): ?int
    {
        if (!$validUntil) {
            return null; // Süresiz
        }

        $now = new DateTime();
        $expiry = new DateTime($validUntil);
        $diff = $now->diff($expiry);

        return $diff->invert ? -$diff->days : $diff->days;
    }

    /**
     * Lisans geçerli mi? (salt-okunur kontrol)
     */
    public static function isLicenseValid(string $companyId): array
    {
        $license = self::getCompanyLicense($companyId);

        if (!$license) {
            return [
                'valid' => false,
                'code' => 'LICENSE_NOT_FOUND',
                'message' => 'No active license found'
            ];
        }

        // Sınırsız plan her zaman geçerli
        if ($license['is_unlimited']) {
            return [
                'valid' => true,
                'code' => 'UNLIMITED',
                'message' => 'Unlimited license',
                'license' => $license
            ];
        }

        // Lisans durumu kontrolü
        if ($license['license_status'] !== 'active') {
            return [
                'valid' => false,
                'code' => 'LICENSE_' . strtoupper($license['license_status']),
                'message' => 'License ' . ($license['license_status'] === 'expired' ? 'has expired' : 'has been cancelled'),
                'license' => $license
            ];
        }

        // Süre kontrolü (sadece kontrol, DB güncellemesi markExpiredLicenses() ile yapılır)
        if ($license['is_expired']) {
            return [
                'valid' => false,
                'code' => 'LICENSE_EXPIRED',
                'message' => 'License has expired',
                'days_overdue' => abs($license['days_left']),
                'license' => $license,
                'needs_status_update' => true  // İşaretçi: cron job tarafından güncellenmeli
            ];
        }

        return [
            'valid' => true,
            'code' => 'VALID',
            'message' => $license['is_expiring_soon']
                ? "License expires in {$license['days_left']} days"
                : 'License valid',
            'days_left' => $license['days_left'],
            'warning' => $license['is_expiring_soon'],
            'license' => $license
        ];
    }

    /**
     * Süresi dolmuş lisansları expired olarak işaretle (cron job için)
     */
    public static function markExpiredLicenses(): int
    {
        $db = Database::getInstance();
        $unlimitedExpr = "(p.is_unlimited = true OR p.plan_type IN ('enterprise', 'ultimate', 'unlimited'))";

        $result = $db->query(
            "UPDATE licenses
             SET status = 'expired', updated_at = ?
             WHERE status = 'active'
             AND valid_until IS NOT NULL
             AND valid_until < ?
             AND id NOT IN (
                 SELECT l.id FROM licenses l
                 INNER JOIN license_plans p ON l.plan_id = p.id
                 WHERE $unlimitedExpr
             )",
            [date('Y-m-d H:i:s'), date('Y-m-d')]
        );

        // Cache temizle
        self::clearCache();

        return $result ? $db->rowCount() : 0;
    }

    /**
     * Belirli bir limit değerini al
     */
    public static function getLimit(string $companyId, string $limitType): array
    {
        $license = self::getCompanyLicense($companyId);

        if (!$license) {
            return [
                'limit' => 0,
                'unlimited' => false,
                'error' => 'License not found'
            ];
        }

        // Sınırsız plan
        if ($license['is_unlimited']) {
            return [
                'limit' => -1,
                'unlimited' => true,
                'plan_name' => $license['plan_name'],
                'plan_type' => $license['plan_type']
            ];
        }

        // Limit alanını bul
        $limitMap = [
            'users' => 'max_users',
            'devices' => 'max_devices',
            'storage' => 'max_storage',
            'branches' => 'max_branches',
            'esl' => 'max_devices',
            'tv' => 'max_devices'
        ];

        $field = $limitMap[$limitType] ?? "max_{$limitType}";
        $value = $license[$field] ?? 0;

        $isUnlimited = self::isUnlimitedValue($value);

        return [
            'limit' => $isUnlimited ? -1 : (int)$value,
            'unlimited' => $isUnlimited,
            'plan_name' => $license['plan_name'],
            'plan_type' => $license['plan_type']
        ];
    }

    /**
     * Limit aşımı kontrolü
     */
    public static function checkLimit(string $companyId, string $limitType, int $currentUsage, int $requestedAdd = 1): array
    {
        $limitInfo = self::getLimit($companyId, $limitType);

        if (isset($limitInfo['error'])) {
            return [
                'allowed' => false,
                'reason' => $limitInfo['error']
            ];
        }

        // Sınırsız
        if ($limitInfo['unlimited']) {
            return [
                'allowed' => true,
                'remaining' => -1,
                'unlimited' => true
            ];
        }

        $limit = $limitInfo['limit'];
        $afterAdd = $currentUsage + $requestedAdd;
        $remaining = $limit - $currentUsage;

        return [
            'allowed' => $afterAdd <= $limit,
            'limit' => $limit,
            'current' => $currentUsage,
            'remaining' => $remaining,
            'requested' => $requestedAdd,
            'unlimited' => false,
            'reason' => $afterAdd > $limit ? "Limit exceeded ({$currentUsage}/{$limit})" : null
        ];
    }

    /**
     * Şube limiti kontrolü
     */
    public static function canCreateBranch(string $companyId, string $type = 'store'): array
    {
        $db = Database::getInstance();

        // Mevcut şube sayısını al
        if ($type === 'region') {
            $current = $db->fetch(
                "SELECT COUNT(*) as count FROM branches WHERE company_id = ? AND type = 'region'",
                [$companyId]
            );
            $limitType = 'regions';
        } else {
            $current = $db->fetch(
                "SELECT COUNT(*) as count FROM branches WHERE company_id = ? AND type != 'region'",
                [$companyId]
            );
            $limitType = 'branches';
        }

        $currentCount = (int)($current['count'] ?? 0);

        return self::checkLimit($companyId, $limitType, $currentCount, 1);
    }

    /**
     * Kullanıcı limiti kontrolü
     */
    public static function canCreateUser(string $companyId): array
    {
        $db = Database::getInstance();

        $current = $db->fetch(
            "SELECT COUNT(*) as count FROM users WHERE company_id = ? AND status = 'active'",
            [$companyId]
        );

        $currentCount = (int)($current['count'] ?? 0);

        return self::checkLimit($companyId, 'users', $currentCount, 1);
    }

    /**
     * Cihaz limiti kontrolü
     */
    public static function canCreateDevice(string $companyId, string $deviceType = 'esl'): array
    {
        $db = Database::getInstance();

        // Per-device-type pricing aktifse kategori bazlı kontrol
        $license = self::getCompanyLicense($companyId);
        if ($license) {
            $licenseRecord = $db->fetch("SELECT pricing_mode FROM licenses WHERE id = ?", [$license['license_id']]);
            if ($licenseRecord && $licenseRecord['pricing_mode'] === 'per_device_type') {
                $category = self::deviceTypeToCategory($deviceType);
                if ($category) {
                    return self::checkDeviceCategoryLimit($companyId, $license['license_id'], $category);
                }
            }
        }

        $current = $db->fetch(
            "SELECT COUNT(*) as count FROM devices WHERE company_id = ?",
            [$companyId]
        );

        $currentCount = (int)($current['count'] ?? 0);

        return self::checkLimit($companyId, 'devices', $currentCount, 1);
    }

    /**
     * Cihaz tipi → fiyatlandırma kategorisi eşleme
     */
    public static function deviceTypeToCategory(string $deviceType): ?string
    {
        $map = [
            'esl' => 'esl_rf',
            'esl_rtos' => 'esl_rf',
            'esl_android' => 'esl_tablet',
            'tablet' => 'esl_tablet',
            'esl_pos' => 'esl_pos',
            'android_tv' => 'signage_tv',
            'tv' => 'signage_tv',
            'web_display' => 'signage_tv',
            'pwa_player' => 'signage_tv',
            'signage_fiyatgor' => 'signage_fiyatgor',
        ];
        return $map[$deviceType] ?? null;
    }

    /**
     * Kategori bazlı cihaz limiti kontrolü (per-device-type pricing)
     */
    public static function checkDeviceCategoryLimit(string $companyId, string $licenseId, string $category): array
    {
        $db = Database::getInstance();

        // Kategorinin izin verilen limiti
        $pricing = $db->fetch(
            "SELECT device_count FROM license_device_pricing WHERE license_id = ? AND device_category = ?",
            [$licenseId, $category]
        );

        if (!$pricing) {
            return [
                'allowed' => false,
                'reason' => "Device category '{$category}' not included in license"
            ];
        }

        $limit = (int)$pricing['device_count'];

        // Sınırsız
        if (self::isUnlimitedValue($limit)) {
            return [
                'allowed' => true,
                'remaining' => -1,
                'unlimited' => true,
                'category' => $category
            ];
        }

        // Mevcut kullanım: Bu kategorideki cihaz sayısı
        $categoryTypes = self::getCategoryDeviceTypes($category);
        $placeholders = implode(',', array_fill(0, count($categoryTypes), '?'));
        $params = array_merge([$companyId], $categoryTypes);

        $current = $db->fetch(
            "SELECT COUNT(*) as count FROM devices WHERE company_id = ? AND (type IN ({$placeholders}) OR model IN ({$placeholders}))",
            array_merge($params, $categoryTypes)
        );

        $currentCount = (int)($current['count'] ?? 0);
        $remaining = $limit - $currentCount;

        return [
            'allowed' => ($currentCount + 1) <= $limit,
            'limit' => $limit,
            'current' => $currentCount,
            'remaining' => $remaining,
            'unlimited' => false,
            'category' => $category,
            'reason' => ($currentCount + 1) > $limit ? "Category limit exceeded ({$currentCount}/{$limit})" : null
        ];
    }

    /**
     * Kategori → cihaz tipleri eşleme (ters yönde)
     */
    public static function getCategoryDeviceTypes(string $category): array
    {
        $map = [
            'esl_rf' => ['esl', 'esl_rtos'],
            'esl_tablet' => ['esl_android', 'tablet'],
            'esl_pos' => ['esl_pos'],
            'signage_fiyatgor' => ['signage_fiyatgor'],
            'signage_tv' => ['android_tv', 'tv', 'web_display', 'pwa_player'],
        ];
        return $map[$category] ?? [];
    }

    /**
     * Firma lisansının cihaz tipi bazlı limitleri (per-device-type pricing)
     */
    public static function getDeviceTypeLimits(string $companyId): array
    {
        $license = self::getCompanyLicense($companyId);
        if (!$license) {
            return ['error' => 'LICENSE_NOT_FOUND'];
        }

        $db = Database::getInstance();

        // Lisans pricing_mode kontrolü
        $licenseRecord = $db->fetch(
            "SELECT pricing_mode FROM licenses WHERE id = ?",
            [$license['license_id']]
        );

        if (!$licenseRecord || $licenseRecord['pricing_mode'] !== 'per_device_type') {
            return ['mode' => 'flat', 'categories' => []];
        }

        // Tüm kategori limitleri
        $pricing = $db->fetchAll(
            "SELECT device_category, device_count, unit_price, currency
             FROM license_device_pricing
             WHERE license_id = ?
             ORDER BY device_category",
            [$license['license_id']]
        );

        // Her kategori için mevcut kullanım
        $categories = [];
        foreach ($pricing as $row) {
            $cat = $row['device_category'];
            $types = self::getCategoryDeviceTypes($cat);
            $used = 0;

            if (!empty($types)) {
                $placeholders = implode(',', array_fill(0, count($types), '?'));
                $params = array_merge([$companyId], $types, $types);
                $usage = $db->fetch(
                    "SELECT COUNT(*) as count FROM devices WHERE company_id = ? AND (type IN ({$placeholders}) OR model IN ({$placeholders}))",
                    $params
                );
                $used = (int)($usage['count'] ?? 0);
            }

            $limit = (int)$row['device_count'];
            $categories[$cat] = [
                'limit' => $limit,
                'used' => $used,
                'unlimited' => self::isUnlimitedValue($limit),
                'remaining' => self::isUnlimitedValue($limit) ? -1 : max(0, $limit - $used),
                'unit_price' => (float)$row['unit_price'],
                'currency' => $row['currency']
            ];
        }

        return [
            'mode' => 'per_device_type',
            'categories' => $categories
        ];
    }

    /**
     * Depolama limiti kontrolü (MB cinsinden)
     */
    public static function canUseStorage(string $companyId, int $requestedMB): array
    {
        $db = Database::getInstance();

        // Mevcut depolama kullanımını hesapla
        $usage = $db->fetch(
            "SELECT COALESCE(SUM(file_size), 0) as total_bytes FROM media WHERE company_id = ?",
            [$companyId]
        );

        $currentMB = (int)(($usage['total_bytes'] ?? 0) / (1024 * 1024));

        return self::checkLimit($companyId, 'storage', $currentMB, $requestedMB);
    }

    /**
     * Tüm limitleri ve kullanımları getir (optimize edilmiş tek sorgu)
     */
    public static function getAllLimitsWithUsage(string $companyId): array
    {
        $license = self::getCompanyLicense($companyId);

        if (!$license) {
            return ['error' => 'LICENSE_NOT_FOUND'];
        }

        $db = Database::getInstance();

        // Tüm kullanım sayılarını tek sorguda al (N+1 problemi çözümü)
        $usage = $db->fetch(
            "SELECT
                (SELECT COUNT(*) FROM users WHERE company_id = ? AND status = 'active') as user_count,
                (SELECT COUNT(*) FROM devices WHERE company_id = ?) as device_count,
                (SELECT COUNT(*) FROM branches WHERE company_id = ? AND type != 'region') as branch_count,
                (SELECT COUNT(*) FROM branches WHERE company_id = ? AND type = 'region') as region_count,
                (SELECT COALESCE(SUM(file_size), 0) FROM media WHERE company_id = ?) as storage_bytes",
            [$companyId, $companyId, $companyId, $companyId, $companyId]
        );

        $isUnlimited = $license['is_unlimited'];

        return [
            'plan' => [
                'id' => $license['plan_id'],
                'name' => $license['plan_name'],
                'type' => $license['plan_type'],
                'is_unlimited' => $isUnlimited
            ],
            'license' => [
                'id' => $license['license_id'],
                'key' => $license['license_key'],
                'status' => $license['license_status'],
                'valid_from' => $license['valid_from'],
                'valid_until' => $license['valid_until'],
                'days_left' => $license['days_left'],
                'is_expired' => $license['is_expired'],
                'is_expiring_soon' => $license['is_expiring_soon']
            ],
            'limits' => [
                'users' => [
                    'limit' => $isUnlimited ? -1 : ($license['max_users'] ?? 0),
                    'used' => (int)($usage['user_count'] ?? 0),
                    'unlimited' => $isUnlimited || self::isUnlimitedValue($license['max_users'])
                ],
                'devices' => [
                    'limit' => $isUnlimited ? -1 : ($license['max_devices'] ?? 0),
                    'used' => (int)($usage['device_count'] ?? 0),
                    'unlimited' => $isUnlimited || self::isUnlimitedValue($license['max_devices'])
                ],
                'branches' => [
                    'limit' => $isUnlimited ? -1 : ($license['max_branches'] ?? 0),
                    'used' => (int)($usage['branch_count'] ?? 0),
                    'unlimited' => $isUnlimited || self::isUnlimitedValue($license['max_branches'])
                ],
                'storage' => [
                    'limit' => $isUnlimited ? -1 : ($license['max_storage'] ?? 0),
                    'used' => (int)(($usage['storage_bytes'] ?? 0) / (1024 * 1024)),
                    'unlimited' => $isUnlimited || self::isUnlimitedValue($license['max_storage']),
                    'unit' => 'MB'
                ]
            ]
        ];
    }

    /**
     * Plan listesini getir
     */
    public static function getAvailablePlans(bool $activeOnly = true): array
    {
        $db = Database::getInstance();

        if ($activeOnly) {
            $where = "WHERE is_active = true";
        } else {
            $where = "";
        }

        return $db->fetchAll(
            "SELECT id, name, plan_type, max_users, max_devices, max_storage, max_branches,
                    duration_months, price, is_active, features, created_at
             FROM license_plans
             {$where}
             ORDER BY
                CASE plan_type
                    WHEN 'free' THEN 1
                    WHEN 'standard' THEN 2
                    WHEN 'professional' THEN 3
                    WHEN 'enterprise' THEN 4
                    WHEN 'ultimate' THEN 5
                    ELSE 6
                END,
                price ASC"
        );
    }

    /**
     * Cache temizle
     */
    public static function clearCache(?string $companyId = null): void
    {
        if ($companyId) {
            unset(self::$cache["license_{$companyId}"]);
        } else {
            self::$cache = [];
        }
    }
}
