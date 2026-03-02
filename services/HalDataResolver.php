<?php
/**
 * HAL Data Resolver Service
 * Şube bazlı HAL verisi çözümleme servisi
 * Fallback zinciri: Branch Override → Master Data
 */

require_once __DIR__ . '/../core/Database.php';

class HalDataResolver
{
    private Database $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * Ürün için HAL verisini çözümle (şube override dahil)
     */
    public function resolve(string $productId, ?string $branchId = null): ?array
    {
        // Master HAL verisini al
        $masterData = $this->db->fetch(
            "SELECT * FROM product_hal_data WHERE product_id = ?",
            [$productId]
        );

        if (!$masterData) {
            return null;
        }

        // Branch ID yoksa master döndür
        if (!$branchId) {
            return $this->formatHalData($masterData);
        }

        // Branch override var mı kontrol et
        $override = $this->db->fetch(
            "SELECT * FROM product_branch_hal_overrides
             WHERE hal_data_id = ? AND branch_id = ? AND deleted_at IS NULL",
            [$masterData['id'], $branchId]
        );

        // Override yoksa master döndür
        if (!$override) {
            return $this->formatHalData($masterData);
        }

        // Override alanlarını uygula (NULL = master'dan miras)
        $overridableFields = [
            'kunye_no', 'malin_sahibi', 'tuketim_yeri',
            'tuketim_bildirim_tarihi', 'alis_fiyati', 'miktar'
        ];

        foreach ($overridableFields as $field) {
            if ($override[$field] !== null) {
                $masterData[$field] = $override[$field];
            }
        }

        $result = $this->formatHalData($masterData);
        $result['has_branch_override'] = true;
        $result['branch_id'] = $branchId;

        return $result;
    }

    /**
     * HAL verisini formatla
     */
    private function formatHalData(array $data): array
    {
        // JSON alanlarını decode et
        if (!empty($data['gecmis_bildirimler'])) {
            $data['gecmis_bildirimler'] = json_decode($data['gecmis_bildirimler'], true) ?? [];
        } else {
            $data['gecmis_bildirimler'] = [];
        }

        if (!empty($data['hal_raw_data'])) {
            $data['hal_raw_data'] = json_decode($data['hal_raw_data'], true) ?? [];
        }

        return $data;
    }

    /**
     * Şube override kaydet/güncelle
     */
    public function saveBranchOverride(string $halDataId, string $branchId, array $overrides, ?string $userId = null): array
    {
        $existing = $this->db->fetch(
            "SELECT id FROM product_branch_hal_overrides
             WHERE hal_data_id = ? AND branch_id = ? AND deleted_at IS NULL",
            [$halDataId, $branchId]
        );

        $allowedFields = ['kunye_no', 'malin_sahibi', 'tuketim_yeri', 'tuketim_bildirim_tarihi', 'alis_fiyati', 'miktar'];
        $data = [];

        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $overrides)) {
                $data[$field] = $overrides[$field];
            }
        }

        $data['updated_at'] = date('Y-m-d H:i:s');
        $data['updated_by'] = $userId;

        if ($existing) {
            $this->db->update('product_branch_hal_overrides', $data, 'id = ?', [$existing['id']]);
            return ['id' => $existing['id'], 'action' => 'updated'];
        }

        $data['hal_data_id'] = $halDataId;
        $data['branch_id'] = $branchId;
        $data['created_at'] = date('Y-m-d H:i:s');
        $data['created_by'] = $userId;

        $id = $this->db->insert('product_branch_hal_overrides', $data);
        return ['id' => $id, 'action' => 'created'];
    }

    /**
     * Şube override sil (soft delete)
     */
    public function deleteBranchOverride(string $halDataId, string $branchId, ?string $userId = null): bool
    {
        $result = $this->db->update(
            'product_branch_hal_overrides',
            [
                'deleted_at' => date('Y-m-d H:i:s'),
                'deleted_by' => $userId
            ],
            'hal_data_id = ? AND branch_id = ? AND deleted_at IS NULL',
            [$halDataId, $branchId]
        );

        return $result > 0;
    }

    /**
     * Ürün için tüm şube override'larını getir
     */
    public function getBranchOverrides(string $productId): array
    {
        $halData = $this->db->fetch(
            "SELECT id FROM product_hal_data WHERE product_id = ?",
            [$productId]
        );

        if (!$halData) {
            return [];
        }

        return $this->db->fetchAll(
            "SELECT o.*, b.name as branch_name
             FROM product_branch_hal_overrides o
             LEFT JOIN branches b ON b.id = o.branch_id
             WHERE o.hal_data_id = ? AND o.deleted_at IS NULL",
            [$halData['id']]
        );
    }
}
