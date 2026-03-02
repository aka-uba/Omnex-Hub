<?php
/**
 * BundlePriceResolver - Bundle fiyat/değer çözümleme servisi
 *
 * ProductPriceResolver pattern'ini takip eder.
 * Fallback zinciri: Şube Override → Bölge Override → Master Bundle
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Logger.php';

class BundlePriceResolver
{
    /**
     * Çözümlenebilir alanlar
     */
    const RESOLVABLE_FIELDS = [
        'final_price', 'previous_final_price', 'discount_percent', 'total_price',
        'price_override', 'price_updated_at', 'previous_price_updated_at',
        'price_valid_from', 'price_valid_until', 'is_available', 'availability_reason'
    ];

    /**
     * Bundle'ın efektif değerlerini getir
     *
     * @param string $bundleId
     * @param string|null $branchId - null = master değerler
     * @return array
     */
    public static function resolve(string $bundleId, ?string $branchId = null): array
    {
        $db = Database::getInstance();

        // Master bundle'ı al
        $bundle = $db->fetch("SELECT * FROM bundles WHERE id = ?", [$bundleId]);
        if (!$bundle) {
            return ['success' => false, 'error' => 'Bundle bulunamadı'];
        }

        // Şube belirtilmemişse master değerleri döndür
        if (!$branchId) {
            return self::formatMasterResult($bundle);
        }

        // Şube bilgisi
        $branch = $db->fetch("SELECT id, parent_id FROM branches WHERE id = ?", [$branchId]);
        if (!$branch) {
            return self::formatMasterResult($bundle);
        }

        // Şube override
        $branchOverride = $db->fetch(
            "SELECT * FROM bundle_branch_overrides
             WHERE bundle_id = ? AND branch_id = ? AND deleted_at IS NULL",
            [$bundleId, $branchId]
        );

        // Bölge override (parent varsa)
        $regionOverride = null;
        if ($branch['parent_id']) {
            $regionOverride = $db->fetch(
                "SELECT * FROM bundle_branch_overrides
                 WHERE bundle_id = ? AND branch_id = ? AND deleted_at IS NULL",
                [$bundleId, $branch['parent_id']]
            );
        }

        return self::buildResult($bundle, $branchOverride, $regionOverride);
    }

    /**
     * Master sonuç formatla
     */
    private static function formatMasterResult(array $bundle): array
    {
        $result = [
            'success' => true,
            'bundle_id' => $bundle['id'],
            'source' => 'master',
            'has_override' => false,
            'values' => []
        ];

        foreach (self::RESOLVABLE_FIELDS as $field) {
            $result['values'][$field] = [
                'value' => $bundle[$field] ?? null,
                'source' => 'master'
            ];
        }

        return $result;
    }

    /**
     * Sonuç oluştur (fallback zinciri uygula)
     */
    private static function buildResult(
        array $bundle,
        ?array $branchOverride,
        ?array $regionOverride
    ): array {
        $result = [
            'success' => true,
            'bundle_id' => $bundle['id'],
            'source' => 'master',
            'has_override' => $branchOverride !== null || $regionOverride !== null,
            'values' => []
        ];

        if ($branchOverride) {
            $result['source'] = 'branch';
        } elseif ($regionOverride) {
            $result['source'] = 'region';
        }

        foreach (self::RESOLVABLE_FIELDS as $field) {
            $result['values'][$field] = self::resolveField($field, $bundle, $branchOverride, $regionOverride);
        }

        return $result;
    }

    /**
     * Tek alan için fallback zinciri uygula
     */
    private static function resolveField(
        string $field,
        array $bundle,
        ?array $branchOverride,
        ?array $regionOverride
    ): array {
        // is_available için özel mantık (varsayılan 1)
        if ($field === 'is_available') {
            if ($branchOverride && isset($branchOverride[$field]) && $branchOverride[$field] !== null) {
                return [
                    'value' => (bool)$branchOverride[$field],
                    'source' => 'branch',
                    'reason' => $branchOverride['availability_reason'] ?? null
                ];
            }
            if ($regionOverride && isset($regionOverride[$field]) && $regionOverride[$field] !== null) {
                return [
                    'value' => (bool)$regionOverride[$field],
                    'source' => 'region',
                    'reason' => $regionOverride['availability_reason'] ?? null
                ];
            }
            return ['value' => true, 'source' => 'default', 'reason' => null];
        }

        // 1. Şube override
        if ($branchOverride && array_key_exists($field, $branchOverride) && $branchOverride[$field] !== null) {
            return ['value' => $branchOverride[$field], 'source' => 'branch'];
        }

        // 2. Bölge override
        if ($regionOverride && array_key_exists($field, $regionOverride) && $regionOverride[$field] !== null) {
            return ['value' => $regionOverride[$field], 'source' => 'region'];
        }

        // 3. Master
        return ['value' => $bundle[$field] ?? null, 'source' => 'master'];
    }

    /**
     * Override oluştur veya güncelle
     */
    public static function setOverride(
        string $bundleId,
        string $branchId,
        array $values,
        string $source = 'manual',
        ?string $userId = null
    ): array {
        $db = Database::getInstance();

        // Bundle kontrolü - fiyat bilgisiyle birlikte al
        $bundle = $db->fetch(
            "SELECT id, final_price, previous_final_price, discount_percent, total_price FROM bundles WHERE id = ?",
            [$bundleId]
        );
        if (!$bundle) {
            return ['success' => false, 'error' => 'Bundle bulunamadı'];
        }

        // Şube kontrolü
        $branch = $db->fetch("SELECT id FROM branches WHERE id = ?", [$branchId]);
        if (!$branch) {
            Logger::error('Branch not found in BundlePriceResolver::setOverride', [
                'branch_id' => $branchId,
                'bundle_id' => $bundleId
            ]);
            return ['success' => false, 'error' => 'Şube bulunamadı: ' . $branchId];
        }

        // Mevcut override'ı bul
        $existing = $db->fetch(
            "SELECT * FROM bundle_branch_overrides
             WHERE bundle_id = ? AND branch_id = ? AND deleted_at IS NULL",
            [$bundleId, $branchId]
        );

        $now = date('Y-m-d H:i:s');

        // Fiyat değişikliği varsa previous_final_price'ı ayarla
        if (isset($values['final_price'])) {
            $currentEffectivePrice = $existing['final_price'] ?? $bundle['final_price'];

            if (abs(floatval($values['final_price']) - floatval($currentEffectivePrice)) > 0.001) {
                $values['previous_final_price'] = $currentEffectivePrice;
                $values['price_updated_at'] = $now;
                if ($existing && !empty($existing['price_updated_at'])) {
                    $values['previous_price_updated_at'] = $existing['price_updated_at'];
                } elseif (!empty($bundle['price_updated_at'])) {
                    $values['previous_price_updated_at'] = $bundle['price_updated_at'];
                }
            }
        }

        if ($existing) {
            // Güncelle
            $updateData = array_merge($values, [
                'source' => $source,
                'updated_at' => $now,
                'updated_by' => $userId
            ]);

            // Fiyat değişikliği logla
            if (isset($values['final_price']) && abs(floatval($values['final_price']) - floatval($existing['final_price'] ?? 0)) > 0.001) {
                $oldPrice = $existing['final_price'] ?? $bundle['final_price'];
                self::logPriceChange(
                    $bundleId, $branchId,
                    $oldPrice, $values['final_price'],
                    $existing['total_price'] ?? $bundle['total_price'],
                    $values['total_price'] ?? $existing['total_price'] ?? $bundle['total_price'],
                    $existing['discount_percent'] ?? $bundle['discount_percent'],
                    $values['discount_percent'] ?? $existing['discount_percent'] ?? $bundle['discount_percent'],
                    $source, $userId
                );
            }

            $db->update('bundle_branch_overrides', $updateData, 'id = ?', [$existing['id']]);

            return ['success' => true, 'action' => 'updated', 'id' => $existing['id']];
        } else {
            // Yeni oluştur
            $id = $db->generateUuid();
            $insertData = array_merge($values, [
                'id' => $id,
                'bundle_id' => $bundleId,
                'branch_id' => $branchId,
                'source' => $source,
                'created_at' => $now,
                'created_by' => $userId
            ]);

            $db->insert('bundle_branch_overrides', $insertData);

            // Fiyat değişikliği logla - ilk override'da master fiyatı eski fiyat olarak kullan
            if (isset($values['final_price'])) {
                $oldPrice = $bundle['final_price'];
                self::logPriceChange(
                    $bundleId, $branchId,
                    $oldPrice, $values['final_price'],
                    $bundle['total_price'],
                    $values['total_price'] ?? $bundle['total_price'],
                    $bundle['discount_percent'],
                    $values['discount_percent'] ?? $bundle['discount_percent'],
                    $source, $userId
                );
            }

            return ['success' => true, 'action' => 'created', 'id' => $id];
        }
    }

    /**
     * Override sil (soft delete)
     */
    public static function deleteOverride(
        string $bundleId,
        string $branchId,
        ?string $userId = null
    ): bool {
        $db = Database::getInstance();

        $db->update(
            'bundle_branch_overrides',
            [
                'deleted_at' => date('Y-m-d H:i:s'),
                'deleted_by' => $userId
            ],
            'bundle_id = ? AND branch_id = ? AND deleted_at IS NULL',
            [$bundleId, $branchId]
        );

        return true;
    }

    /**
     * Fiyat değişikliği logla
     */
    private static function logPriceChange(
        string $bundleId,
        string $branchId,
        $oldPrice,
        $newPrice,
        $oldTotalPrice,
        $newTotalPrice,
        $oldDiscountPercent,
        $newDiscountPercent,
        string $source,
        ?string $userId
    ): void {
        $db = Database::getInstance();

        $changePercent = null;
        if ($oldPrice && floatval($oldPrice) > 0) {
            $changePercent = ((floatval($newPrice) - floatval($oldPrice)) / floatval($oldPrice)) * 100;
        }

        try {
            $db->insert('bundle_branch_price_history', [
                'id' => $db->generateUuid(),
                'bundle_id' => $bundleId,
                'branch_id' => $branchId,
                'old_price' => $oldPrice,
                'new_price' => $newPrice,
                'old_total_price' => $oldTotalPrice,
                'new_total_price' => $newTotalPrice,
                'old_discount_percent' => $oldDiscountPercent,
                'new_discount_percent' => $newDiscountPercent,
                'change_reason' => $source,
                'change_percent' => $changePercent,
                'changed_by' => $userId
            ]);
        } catch (Exception $e) {
            Logger::error('Bundle branch price history insert failed', [
                'bundle_id' => $bundleId,
                'branch_id' => $branchId,
                'error' => $e->getMessage()
            ]);
        }
    }
}
