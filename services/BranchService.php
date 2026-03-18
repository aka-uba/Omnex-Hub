<?php
/**
 * BranchService - Şube yönetim servisi
 *
 * Şube CRUD, erişim kontrolü ve hiyerarşi yönetimi
 * Limit kontrolleri LicenseService üzerinden yapılır.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/LicenseService.php';

class BranchService
{
    /**
     * Kullanıcının şubeye erişimi var mı?
     */
    public static function userHasAccess(string $userId, string $branchId): bool
    {
        $db = Database::getInstance();

        // Kullanıcı bilgisini al
        $user = $db->fetch("SELECT role, company_id FROM users WHERE id = ?", [$userId]);
        if (!$user) return false;

        // SuperAdmin her yere erişir
        if ($user['role'] === 'SuperAdmin') return true;

        // Şube firmasını kontrol et
        $branch = $db->fetch("SELECT company_id FROM branches WHERE id = ?", [$branchId]);
        if (!$branch) return false;

        // Farklı firmaya erişim yok
        if ($branch['company_id'] !== $user['company_id']) return false;

        // Admin firmasının tüm şubelerine erişir
        if ($user['role'] === 'Admin') return true;

        // Diğer roller için user_branch_access tablosunu kontrol et
        $access = $db->fetch(
            "SELECT id FROM user_branch_access
             WHERE user_id = ? AND branch_id = ?
             AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
            [$userId, $branchId]
        );

        return $access !== null;
    }

    /**
     * Kullanıcının erişebildiği şubeleri getir
     */
    public static function getUserBranches(string $userId): array
    {
        $db = Database::getInstance();
        $activeBranchExpr = $db->isPostgres() ? 'is_active IS TRUE' : 'is_active = 1';
        $activeBranchAliasExpr = $db->isPostgres() ? 'b.is_active IS TRUE' : 'b.is_active = 1';

        $user = $db->fetch("SELECT role, company_id FROM users WHERE id = ?", [$userId]);
        if (!$user) return [];

        // SuperAdmin için tüm şubeler (firma seçilmişse o firmanınkiler)
        if ($user['role'] === 'SuperAdmin') {
            if ($user['company_id']) {
                return $db->fetchAll(
                    "SELECT * FROM branches WHERE company_id = ? AND $activeBranchExpr ORDER BY sort_order, name",
                    [$user['company_id']]
                );
            }
            return $db->fetchAll("SELECT * FROM branches WHERE $activeBranchExpr ORDER BY sort_order, name");
        }

        // Admin firmasının tüm şubelerine erişir
        if ($user['role'] === 'Admin') {
            return $db->fetchAll(
                "SELECT * FROM branches WHERE company_id = ? AND $activeBranchExpr ORDER BY sort_order, name",
                [$user['company_id']]
            );
        }

        // Diğer roller için sadece erişim verilen şubeler
        return $db->fetchAll(
            "SELECT b.* FROM branches b
             INNER JOIN user_branch_access uba ON b.id = uba.branch_id
             WHERE uba.user_id = ? AND $activeBranchAliasExpr
             AND (uba.expires_at IS NULL OR uba.expires_at > CURRENT_TIMESTAMP)
             ORDER BY b.sort_order, b.name",
            [$userId]
        );
    }

    /**
     * Kullanıcının varsayılan şubesini getir
     */
    public static function getUserDefaultBranch(string $userId): ?array
    {
        $db = Database::getInstance();
        $defaultAccessExpr = $db->isPostgres() ? 'uba.is_default IS TRUE' : 'uba.is_default = 1';
        $activeBranchExpr = $db->isPostgres() ? 'b.is_active IS TRUE' : 'b.is_active = 1';

        $user = $db->fetch("SELECT role, company_id FROM users WHERE id = ?", [$userId]);
        if (!$user) return null;

        // Önce user_branch_access'ten varsayılanı bul
        $defaultAccess = $db->fetch(
            "SELECT b.* FROM branches b
             INNER JOIN user_branch_access uba ON b.id = uba.branch_id
             WHERE uba.user_id = ? AND $defaultAccessExpr AND $activeBranchExpr
             AND (uba.expires_at IS NULL OR uba.expires_at > CURRENT_TIMESTAMP)",
            [$userId]
        );

        if ($defaultAccess) return $defaultAccess;

        // Yoksa ilk erişilebilir şubeyi döndür
        $branches = self::getUserBranches($userId);
        return !empty($branches) ? $branches[0] : null;
    }

    /**
     * Şube hiyerarşisini getir (bölge → şube)
     */
    public static function getBranchHierarchy(string $companyId): array
    {
        $db = Database::getInstance();

        // Tüm şubeleri al (parent_name ile birlikte)
        $allBranches = $db->fetchAll(
            "SELECT b.*, p.name as parent_name
             FROM branches b
             LEFT JOIN branches p ON b.parent_id = p.id
             WHERE b.company_id = ? ORDER BY b.sort_order, b.name",
            [$companyId]
        );

        // Bölgeleri ve alt şubeleri grupla
        $regions = [];
        $orphans = []; // Bölgesiz şubeler

        foreach ($allBranches as $branch) {
            if ($branch['type'] === 'region') {
                $branch['children'] = [];
                $regions[$branch['id']] = $branch;
            }
        }

        foreach ($allBranches as $branch) {
            if ($branch['type'] !== 'region') {
                if ($branch['parent_id'] && isset($regions[$branch['parent_id']])) {
                    $regions[$branch['parent_id']]['children'][] = $branch;
                } else {
                    $orphans[] = $branch;
                }
            }
        }

        return [
            'regions' => array_values($regions),
            'orphans' => $orphans,
            'all' => $allBranches
        ];
    }

    /**
     * Firma şube limitini kontrol et
     * Tüm kontroller LicenseService üzerinden yapılır (license_plans tablosu kaynak)
     */
    public static function canCreateBranch(string $companyId, string $type = 'store'): array
    {
        // LicenseService'i kullan
        return LicenseService::canCreateBranch($companyId, $type);
    }

    /**
     * Şube oluştur
     */
    public static function create(array $data): array
    {
        $db = Database::getInstance();

        // Zorunlu alanlar
        if (empty($data['company_id']) || empty($data['code']) || empty($data['name'])) {
            return ['success' => false, 'error' => 'company_id, code ve name zorunludur'];
        }

        $type = $data['type'] ?? 'store';

        // Limit kontrolü
        $canCreate = self::canCreateBranch($data['company_id'], $type);
        if (!$canCreate['allowed']) {
            return ['success' => false, 'error' => $canCreate['reason'] ?? 'Şube limiti aşıldı'];
        }

        // Kod benzersizliği kontrolü
        $existing = $db->fetch(
            "SELECT id FROM branches WHERE company_id = ? AND code = ?",
            [$data['company_id'], $data['code']]
        );

        if ($existing) {
            return ['success' => false, 'error' => 'Bu şube kodu zaten kullanılıyor'];
        }

        $id = $db->generateUuid();

        $branch = [
            'id' => $id,
            'company_id' => $data['company_id'],
            'parent_id' => $data['parent_id'] ?? null,
            'code' => $data['code'],
            'external_code' => $data['external_code'] ?? null,
            'name' => $data['name'],
            'type' => $type,
            'address' => $data['address'] ?? null,
            'city' => $data['city'] ?? null,
            'district' => $data['district'] ?? null,
            'postal_code' => $data['postal_code'] ?? null,
            'country' => $data['country'] ?? 'TR',
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'manager_user_id' => $data['manager_user_id'] ?? null,
            'timezone' => $data['timezone'] ?? 'Europe/Istanbul',
            'currency' => $data['currency'] ?? 'TRY',
            'is_active' => $data['is_active'] ?? 1,
            'is_virtual' => $data['is_virtual'] ?? 0,
            'settings' => isset($data['settings']) ? json_encode($data['settings']) : null,
            'sort_order' => $data['sort_order'] ?? 0
        ];

        // Sort order çakışma kontrolü: aynı sıraya sahip varsa kaydır
        self::shiftSortOrders($db, $data['company_id'], (int)$branch['sort_order'], null);

        $db->insert('branches', $branch);

        return ['success' => true, 'data' => $branch];
    }

    /**
     * Şube güncelle
     */
    public static function update(string $branchId, array $data): array
    {
        $db = Database::getInstance();

        $branch = $db->fetch("SELECT * FROM branches WHERE id = ?", [$branchId]);
        if (!$branch) {
            return ['success' => false, 'error' => 'Şube bulunamadı'];
        }

        // Kod değişiyorsa benzersizlik kontrolü
        if (isset($data['code']) && $data['code'] !== $branch['code']) {
            $existing = $db->fetch(
                "SELECT id FROM branches WHERE company_id = ? AND code = ? AND id != ?",
                [$branch['company_id'], $data['code'], $branchId]
            );

            if ($existing) {
                return ['success' => false, 'error' => 'Bu şube kodu zaten kullanılıyor'];
            }
        }

        $updateData = [];
        $allowedFields = [
            'parent_id', 'code', 'external_code', 'name', 'type',
            'address', 'city', 'district', 'postal_code', 'country',
            'phone', 'email', 'latitude', 'longitude',
            'manager_user_id', 'timezone', 'currency',
            'is_active', 'is_virtual', 'settings', 'sort_order'
        ];

        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                $value = $data[$field];
                if ($field === 'settings' && is_array($value)) {
                    $value = json_encode($value);
                }
                $updateData[$field] = $value;
            }
        }

        if (!empty($updateData)) {
            // Sort order değiştiyse çakışma kontrolü
            if (array_key_exists('sort_order', $updateData)) {
                $newSort = (int)$updateData['sort_order'];
                $oldSort = (int)($branch['sort_order'] ?? 0);
                if ($newSort !== $oldSort) {
                    self::shiftSortOrders($db, $branch['company_id'], $newSort, $branchId);
                }
            }

            $updateData['updated_at'] = date('Y-m-d H:i:s');
            $db->update('branches', $updateData, 'id = ?', [$branchId]);
        }

        $updated = $db->fetch("SELECT * FROM branches WHERE id = ?", [$branchId]);
        return ['success' => true, 'data' => $updated];
    }

    /**
     * Aynı sort_order'a sahip şubeleri bir üst sıraya kaydır.
     * Yeni/güncellenen şubenin istenen sırasını boşaltır.
     *
     * @param Database $db
     * @param string $companyId
     * @param int $sortOrder Hedef sıra numarası
     * @param string|null $excludeId Güncellenen şubenin ID'si (kendisini hariç tut)
     */
    private static function shiftSortOrders($db, string $companyId, int $sortOrder, ?string $excludeId): void
    {
        $params = [$companyId, $sortOrder];
        $excludeClause = '';
        if ($excludeId) {
            $excludeClause = ' AND id != ?';
            $params[] = $excludeId;
        }

        // Bu sırada başka şube var mı?
        $conflict = $db->fetch(
            "SELECT id FROM branches WHERE company_id = ? AND sort_order = ?{$excludeClause} LIMIT 1",
            $params
        );

        if ($conflict) {
            // Bu sıra ve üstündeki tüm şubeleri 1 artır
            $shiftParams = [$companyId, $sortOrder];
            $shiftExclude = '';
            if ($excludeId) {
                $shiftExclude = ' AND id != ?';
                $shiftParams[] = $excludeId;
            }

            $db->query(
                "UPDATE branches SET sort_order = sort_order + 1 WHERE company_id = ? AND sort_order >= ?{$shiftExclude}",
                $shiftParams
            );
        }
    }

    /**
     * Şube sil
     */
    public static function delete(string $branchId): array
    {
        $db = Database::getInstance();

        $branch = $db->fetch("SELECT * FROM branches WHERE id = ?", [$branchId]);
        if (!$branch) {
            return ['success' => false, 'error' => 'Şube bulunamadı'];
        }

        // Bağlı verileri kontrol et
        $deviceCount = $db->fetch("SELECT COUNT(*) as count FROM devices WHERE branch_id = ?", [$branchId]);
        $overrideCount = $db->fetch("SELECT COUNT(*) as count FROM product_branch_overrides WHERE branch_id = ? AND deleted_at IS NULL", [$branchId]);
        $accessCount = $db->fetch("SELECT COUNT(*) as count FROM user_branch_access WHERE branch_id = ?", [$branchId]);

        // Alt şubeleri kontrol et (bölge ise)
        $childCount = $db->fetch("SELECT COUNT(*) as count FROM branches WHERE parent_id = ?", [$branchId]);

        return [
            'success' => true,
            'branch' => $branch,
            'affected' => [
                'devices' => $deviceCount['count'],
                'overrides' => $overrideCount['count'],
                'user_access' => $accessCount['count'],
                'children' => $childCount['count']
            ]
        ];
    }

    /**
     * Şubeyi kalıcı olarak sil
     */
    public static function forceDelete(string $branchId): bool
    {
        $db = Database::getInstance();

        // Cihazların şube bağlantısını kaldır
        $db->query("UPDATE devices SET branch_id = NULL WHERE branch_id = ?", [$branchId]);

        // Alt şubelerin parent'ını kaldır
        $db->query("UPDATE branches SET parent_id = NULL WHERE parent_id = ?", [$branchId]);

        // Şubeyi sil (CASCADE ile override'lar ve access'ler silinir)
        $db->delete('branches', 'id = ?', [$branchId]);

        return true;
    }

    /**
     * Şube koduna göre şube bul
     */
    public static function findByCode(string $companyId, string $code): ?array
    {
        $db = Database::getInstance();
        return $db->fetch(
            "SELECT * FROM branches WHERE company_id = ? AND (code = ? OR external_code = ?)",
            [$companyId, $code, $code]
        );
    }

    /**
     * Bölgenin tüm alt şubelerini getir
     */
    public static function getRegionBranches(string $regionId): array
    {
        $db = Database::getInstance();
        return $db->fetchAll(
            "SELECT * FROM branches WHERE parent_id = ? AND type != 'region' ORDER BY sort_order, name",
            [$regionId]
        );
    }
}

