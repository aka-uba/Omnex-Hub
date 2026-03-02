<?php
/**
 * LicenseMiddleware - Lisans kontrolü middleware
 *
 * Tüm lisans kontrolleri LicenseService üzerinden yapılır.
 * license_plans tablosu tek kaynak olarak kullanılır.
 *
 * @package OmnexDisplayHub
 */

require_once __DIR__ . '/../services/LicenseService.php';

class LicenseMiddleware
{
    /**
     * Lisans kontrolü yapılmayacak route'lar
     */
    private static array $exemptRoutes = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/logout',
        '/api/auth/refresh-token',
        '/api/auth/forgot-password',
        '/api/auth/reset-password',
        '/api/csrf-token',
        '/api/licenses',  // Admin lisans yönetimi
        '/api/companies', // Admin firma yönetimi
        '/api/system/about',
        '/api/payments',  // Ödeme işlemleri (lisans yenilemek için)
        '/api/license-plans', // Plan yönetimi
    ];

    /**
     * Lisans durumunu kontrol et - LicenseService'e delegate eder
     *
     * @param string $companyId Firma ID
     * @return array ['valid' => bool, 'message' => string, 'license' => array|null, 'days_left' => int|null]
     */
    public static function checkLicense(string $companyId): array
    {
        $result = LicenseService::isLicenseValid($companyId);

        // LicenseService formatını middleware formatına dönüştür
        $response = [
            'valid' => $result['valid'],
            'message' => $result['message'],
            'license' => $result['license'] ?? null,
            'days_left' => $result['days_left'] ?? null
        ];

        // Ek alanlar
        if (isset($result['warning'])) {
            $response['warning'] = $result['warning'];
        }

        if (!$result['valid'] && isset($result['days_left']) && $result['days_left'] < 0) {
            $response['expired_days'] = abs($result['days_left']);
        }

        return $response;
    }

    /**
     * Route'un lisans kontrolünden muaf olup olmadığını kontrol et
     */
    public static function isExemptRoute(string $path): bool
    {
        foreach (self::$exemptRoutes as $exempt) {
            if (strpos($path, $exempt) === 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * Middleware handle - AuthMiddleware'den sonra çağrılır
     */
    public static function handle(Request $request): bool
    {
        $path = $request->getPath();

        // Muaf route kontrolü
        if (self::isExemptRoute($path)) {
            return true;
        }

        // Authenticated user kontrolü
        $user = Auth::user();
        if (!$user) {
            return true; // Auth olmamış, AuthMiddleware halledecek
        }

        // SuperAdmin her zaman geçer
        if ($user['role'] === 'SuperAdmin') {
            return true;
        }

        // Company ID kontrolü
        $companyId = $user['company_id'] ?? null;
        if (!$companyId) {
            return true; // Company yoksa geç (olmamalı ama)
        }

        // Lisans kontrolü
        $result = self::checkLicense($companyId);

        if (!$result['valid']) {
            // Detaylı lisans hatası döndür - frontend bunu işleyecek
            $errorCode = 'LICENSE_INVALID';
            $redirectUrl = '/admin/licenses';
            $licenseStatus = $result['license']['license_status'] ?? ($result['license']['status'] ?? null);

            if ($result['license']) {
                switch ($licenseStatus) {
                    case 'expired':
                        $errorCode = 'LICENSE_EXPIRED';
                        break;
                    case 'cancelled':
                        $errorCode = 'LICENSE_CANCELLED';
                        break;
                    case 'suspended':
                        $errorCode = 'LICENSE_SUSPENDED';
                        break;
                }
            } else {
                $errorCode = 'LICENSE_NOT_FOUND';
            }

            // Kullanıcı Admin değilse yöneticiye yönlendir bilgisi ver
            $isAdmin = in_array($user['role'], ['Admin', 'SuperAdmin']);

            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => $result['message'],
                'code' => $errorCode,
                'license_error' => true,
                'redirect_url' => $isAdmin ? '#/admin/licenses' : null,
                'can_renew' => $isAdmin,
                'contact_admin' => !$isAdmin,
                'license_info' => $result['license'] ? [
                    'type' => $result['license']['plan_type'] ?? ($result['license']['type'] ?? null),
                    'status' => $licenseStatus,
                    'expired_at' => $result['license']['valid_until'] ?? null,
                    'days_overdue' => $result['expired_days'] ?? null
                ] : null
            ]);
            exit;
        }

        // Uyarı durumunda header ekle (frontend için)
        if (!empty($result['warning']) && !empty($result['days_left'])) {
            header('X-License-Warning: ' . $result['days_left']);
        }

        return true;
    }

    /**
     * Cron job için: Süresi dolmak üzere olan lisanslar için bildirim gönder
     * license_plans tablosundan plan tipi kontrol edilir
     */
    public static function checkExpiringLicenses(): array
    {
        $db = Database::getInstance();
        $results = [];

        // Aktif lisansları plan bilgileriyle birlikte al
        $licenses = $db->fetchAll(
            "SELECT l.*, c.name as company_name, p.plan_type, p.name as plan_name
             FROM licenses l
             LEFT JOIN companies c ON l.company_id = c.id
             LEFT JOIN license_plans p ON l.plan_id = p.id
             WHERE l.status = 'active'
             AND l.valid_until IS NOT NULL"
        );

        foreach ($licenses as $license) {
            // Sınırsız plan tiplerini atla
            $planType = $license['plan_type'] ?? $license['type'] ?? '';
            if (in_array($planType, ['enterprise', 'ultimate', 'unlimited'])) {
                continue;
            }

            $endDate = $license['valid_until'] ?? null;
            if (!$endDate) continue;

            $daysLeft = LicenseService::calculateDaysLeft($endDate);
            if ($daysLeft === null) continue;

            // Bildirim gönderilecek günler: 30, 14, 7, 3, 1, 0
            $notifyDays = [30, 14, 7, 3, 1, 0];

            if (in_array($daysLeft, $notifyDays) || $daysLeft < 0) {
                // Bildirim gönder
                if (class_exists('NotificationTriggers')) {
                    NotificationTriggers::onLicenseExpiring($license['company_id'], $daysLeft);
                }

                $results[] = [
                    'company_id' => $license['company_id'],
                    'company_name' => $license['company_name'],
                    'plan_name' => $license['plan_name'] ?? $license['type'],
                    'days_left' => $daysLeft,
                    'notified' => true
                ];

                // Süresi dolmuşsa durumu güncelle
                if ($daysLeft < 0) {
                    $db->update('licenses', ['status' => 'expired'], 'id = ?', [$license['id']]);
                    // Cache temizle
                    LicenseService::clearCache($license['company_id']);
                }
            }
        }

        return $results;
    }

    /**
     * Belirli bir limit kontrolü - LicenseService'e delegate eder
     *
     * @param string $companyId
     * @param string $limitType users|devices|branches|storage
     * @param int $currentUsage
     * @param int $requestedAdd
     * @return array
     */
    public static function checkLimit(string $companyId, string $limitType, int $currentUsage, int $requestedAdd = 1): array
    {
        return LicenseService::checkLimit($companyId, $limitType, $currentUsage, $requestedAdd);
    }

    /**
     * Tüm limitleri ve kullanımları getir
     *
     * @param string $companyId
     * @return array
     */
    public static function getAllLimits(string $companyId): array
    {
        return LicenseService::getAllLimitsWithUsage($companyId);
    }
}
