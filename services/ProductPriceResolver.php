<?php
/**
 * ProductPriceResolver - Ürün fiyat/değer çözümleme servisi
 *
 * Fallback zinciri: Şube Override → Bölge Override → Master Ürün
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Logger.php';

class ProductPriceResolver
{
    /**
     * Çözümlenebilir alanlar
     */
    const RESOLVABLE_FIELDS = [
        'price' => ['current_price', 'previous_price', 'price_updated_at', 'price_valid_until'],
        'campaign' => ['discount_percent', 'discount_amount', 'campaign_text', 'campaign_start', 'campaign_end'],
        'stock' => ['stock_quantity', 'min_stock_level', 'max_stock_level', 'reorder_point'],
        'location' => ['shelf_location', 'aisle', 'shelf_number'],
        'compliance' => ['kunye_no', 'kunye_data'],
        'availability' => ['is_available', 'availability_reason']
    ];

    /**
     * Ürünün efektif değerlerini getir
     *
     * @param string $productId
     * @param string|null $branchId - null = master değerler
     * @param array $fieldGroups - İstenen alan grupları
     * @return array
     */
    public static function resolve(
        string $productId,
        ?string $branchId = null,
        array $fieldGroups = ['price', 'campaign', 'stock', 'compliance', 'availability']
    ): array {
        $db = Database::getInstance();

        // Master ürünü al
        $product = $db->fetch("SELECT * FROM products WHERE id = ?", [$productId]);
        if (!$product) {
            return ['success' => false, 'error' => 'Ürün bulunamadı'];
        }

        // Şube belirtilmemişse master değerleri döndür
        if (!$branchId) {
            return self::formatMasterResult($product, $fieldGroups);
        }

        // Şube ve bölge override'larını al
        $branch = $db->fetch("SELECT id, parent_id FROM branches WHERE id = ?", [$branchId]);
        if (!$branch) {
            return self::formatMasterResult($product, $fieldGroups);
        }

        // Şube override
        $branchOverride = $db->fetch(
            "SELECT * FROM product_branch_overrides
             WHERE product_id = ? AND branch_id = ? AND deleted_at IS NULL",
            [$productId, $branchId]
        );

        // Bölge override (parent varsa)
        $regionOverride = null;
        if ($branch['parent_id']) {
            $regionOverride = $db->fetch(
                "SELECT * FROM product_branch_overrides
                 WHERE product_id = ? AND branch_id = ? AND deleted_at IS NULL",
                [$productId, $branch['parent_id']]
            );
        }

        return self::buildResult($product, $branchOverride, $regionOverride, $fieldGroups);
    }

    /**
     * Toplu çözümleme (liste görünümü için optimize)
     */
    public static function resolveMultiple(
        array $productIds,
        ?string $branchId = null,
        array $fieldGroups = ['price']
    ): array {
        if (empty($productIds)) return [];

        $db = Database::getInstance();

        // Ürünleri al
        $placeholders = implode(',', array_fill(0, count($productIds), '?'));
        $products = $db->fetchAll(
            "SELECT * FROM products WHERE id IN ($placeholders)",
            $productIds
        );

        $productMap = [];
        foreach ($products as $p) {
            $productMap[$p['id']] = $p;
        }

        // Şube yoksa sadece master
        if (!$branchId) {
            $results = [];
            foreach ($productIds as $pid) {
                if (isset($productMap[$pid])) {
                    $results[$pid] = self::formatMasterResult($productMap[$pid], $fieldGroups);
                }
            }
            return $results;
        }

        // Şube bilgisi
        $branch = $db->fetch("SELECT id, parent_id FROM branches WHERE id = ?", [$branchId]);
        if (!$branch) {
            $results = [];
            foreach ($productIds as $pid) {
                if (isset($productMap[$pid])) {
                    $results[$pid] = self::formatMasterResult($productMap[$pid], $fieldGroups);
                }
            }
            return $results;
        }

        // Tüm şube override'larını al
        $branchOverrides = $db->fetchAll(
            "SELECT * FROM product_branch_overrides
             WHERE product_id IN ($placeholders) AND branch_id = ? AND deleted_at IS NULL",
            array_merge($productIds, [$branchId])
        );

        $branchOverrideMap = [];
        foreach ($branchOverrides as $bo) {
            $branchOverrideMap[$bo['product_id']] = $bo;
        }

        // Bölge override'larını al
        $regionOverrideMap = [];
        if ($branch['parent_id']) {
            $regionOverrides = $db->fetchAll(
                "SELECT * FROM product_branch_overrides
                 WHERE product_id IN ($placeholders) AND branch_id = ? AND deleted_at IS NULL",
                array_merge($productIds, [$branch['parent_id']])
            );

            foreach ($regionOverrides as $ro) {
                $regionOverrideMap[$ro['product_id']] = $ro;
            }
        }

        // Sonuçları birleştir
        $results = [];
        foreach ($productIds as $pid) {
            if (isset($productMap[$pid])) {
                $results[$pid] = self::buildResult(
                    $productMap[$pid],
                    $branchOverrideMap[$pid] ?? null,
                    $regionOverrideMap[$pid] ?? null,
                    $fieldGroups
                );
            }
        }

        return $results;
    }

    /**
     * Tek bir alan için efektif değer getir
     */
    public static function getEffectiveValue(
        string $productId,
        string $field,
        ?string $branchId = null
    ) {
        $db = Database::getInstance();

        $product = $db->fetch("SELECT * FROM products WHERE id = ?", [$productId]);
        if (!$product) return null;

        if (!$branchId) {
            return [
                'value' => $product[$field] ?? null,
                'source' => 'master'
            ];
        }

        $branch = $db->fetch("SELECT id, parent_id FROM branches WHERE id = ?", [$branchId]);
        if (!$branch) {
            return [
                'value' => $product[$field] ?? null,
                'source' => 'master'
            ];
        }

        // Şube override
        $branchOverride = $db->fetch(
            "SELECT $field FROM product_branch_overrides
             WHERE product_id = ? AND branch_id = ? AND deleted_at IS NULL",
            [$productId, $branchId]
        );

        if ($branchOverride && $branchOverride[$field] !== null) {
            return [
                'value' => $branchOverride[$field],
                'source' => 'branch'
            ];
        }

        // Bölge override
        if ($branch['parent_id']) {
            $regionOverride = $db->fetch(
                "SELECT $field FROM product_branch_overrides
                 WHERE product_id = ? AND branch_id = ? AND deleted_at IS NULL",
                [$productId, $branch['parent_id']]
            );

            if ($regionOverride && $regionOverride[$field] !== null) {
                return [
                    'value' => $regionOverride[$field],
                    'source' => 'region'
                ];
            }
        }

        // Master
        return [
            'value' => $product[$field] ?? null,
            'source' => 'master'
        ];
    }

    /**
     * Master sonuç formatla
     */
    private static function formatMasterResult(array $product, array $fieldGroups): array
    {
        $result = [
            'success' => true,
            'product_id' => $product['id'],
            'source' => 'master',
            'has_override' => false,
            'values' => []
        ];

        foreach ($fieldGroups as $group) {
            if (!isset(self::RESOLVABLE_FIELDS[$group])) continue;

            foreach (self::RESOLVABLE_FIELDS[$group] as $field) {
                $result['values'][$field] = [
                    'value' => $product[$field] ?? null,
                    'source' => 'master'
                ];
            }
        }

        return $result;
    }

    /**
     * Sonuç oluştur (fallback zinciri uygula)
     */
    private static function buildResult(
        array $product,
        ?array $branchOverride,
        ?array $regionOverride,
        array $fieldGroups
    ): array {
        $result = [
            'success' => true,
            'product_id' => $product['id'],
            'source' => 'master',
            'has_override' => $branchOverride !== null || $regionOverride !== null,
            'override_scope' => $branchOverride['override_scope'] ?? ($regionOverride['override_scope'] ?? null),
            'values' => []
        ];

        // Ana kaynak belirleme
        if ($branchOverride) {
            $result['source'] = 'branch';
        } elseif ($regionOverride) {
            $result['source'] = 'region';
        }

        foreach ($fieldGroups as $group) {
            if (!isset(self::RESOLVABLE_FIELDS[$group])) continue;

            foreach (self::RESOLVABLE_FIELDS[$group] as $field) {
                $result['values'][$field] = self::resolveField(
                    $field,
                    $product,
                    $branchOverride,
                    $regionOverride
                );
            }
        }

        return $result;
    }

    /**
     * Tek alan için fallback zinciri uygula
     */
    private static function resolveField(
        string $field,
        array $product,
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

            // Varsayılan: satışta
            return ['value' => true, 'source' => 'default', 'reason' => null];
        }

        // 1. Şube override
        if ($branchOverride && array_key_exists($field, $branchOverride) && $branchOverride[$field] !== null) {
            return [
                'value' => $branchOverride[$field],
                'source' => 'branch'
            ];
        }

        // 2. Bölge override
        if ($regionOverride && array_key_exists($field, $regionOverride) && $regionOverride[$field] !== null) {
            return [
                'value' => $regionOverride[$field],
                'source' => 'region'
            ];
        }

        // 3. Master
        return [
            'value' => $product[$field] ?? null,
            'source' => 'master'
        ];
    }

    /**
     * Override oluştur veya güncelle
     */
    public static function setOverride(
        string $productId,
        string $branchId,
        array $values,
        string $source = 'manual',
        ?string $userId = null
    ): array {
        $db = Database::getInstance();

        // Ürün ve şube kontrolü - fiyat bilgisiyle birlikte al
        $product = $db->fetch("SELECT id, current_price, previous_price FROM products WHERE id = ?", [$productId]);
        if (!$product) {
            return ['success' => false, 'error' => 'Ürün bulunamadı'];
        }

        $branch = $db->fetch("SELECT id FROM branches WHERE id = ?", [$branchId]);
        if (!$branch) {
            Logger::error('Branch not found in setOverride', [
                'branch_id' => $branchId,
                'product_id' => $productId
            ]);
            return ['success' => false, 'error' => 'Şube bulunamadı: ' . $branchId];
        }

        // Mevcut override'ı bul
        $existing = $db->fetch(
            "SELECT * FROM product_branch_overrides
             WHERE product_id = ? AND branch_id = ? AND deleted_at IS NULL",
            [$productId, $branchId]
        );

        $now = date('Y-m-d H:i:s');

        // Override scope belirleme
        $scope = self::determineScope($values);

        // Fiyat değişikliği varsa previous_price'ı ayarla
        if (isset($values['current_price'])) {
            // Mevcut efektif fiyatı bul (override varsa override, yoksa master)
            $currentEffectivePrice = $existing['current_price'] ?? $product['current_price'];

            // Yeni fiyat farklıysa, eski fiyatı previous_price olarak kaydet
            if (floatval($values['current_price']) != floatval($currentEffectivePrice)) {
                $values['previous_price'] = $currentEffectivePrice;
                $values['price_updated_at'] = $now;
            }
        }

        if ($existing) {
            // Güncelle
            $updateData = array_merge($values, [
                'override_scope' => $scope,
                'source' => $source,
                'updated_at' => $now,
                'updated_by' => $userId
            ]);

            // Fiyat değişikliği logla (update'den önce yapıyoruz ki eski fiyatı alabilelim)
            if (isset($values['current_price']) && floatval($values['current_price']) != floatval($existing['current_price'] ?? 0)) {
                $oldPrice = $existing['current_price'] ?? $product['current_price'];
                self::logPriceChange($productId, $branchId, $oldPrice, $values['current_price'], $source, $userId);
            }

            $db->update('product_branch_overrides', $updateData, 'id = ?', [$existing['id']]);

            return ['success' => true, 'action' => 'updated', 'id' => $existing['id']];
        } else {
            // Yeni oluştur
            $id = $db->generateUuid();
            $insertData = array_merge($values, [
                'id' => $id,
                'product_id' => $productId,
                'branch_id' => $branchId,
                'override_scope' => $scope,
                'source' => $source,
                'created_at' => $now,
                'created_by' => $userId
            ]);

            $db->insert('product_branch_overrides', $insertData);

            // Fiyat değişikliği logla - ilk override'da master fiyatı eski fiyat olarak kullan
            if (isset($values['current_price'])) {
                $oldPrice = $product['current_price']; // Master fiyat
                self::logPriceChange($productId, $branchId, $oldPrice, $values['current_price'], $source, $userId);
            }

            return ['success' => true, 'action' => 'created', 'id' => $id];
        }
    }

    /**
     * Override sil (soft delete)
     */
    public static function deleteOverride(
        string $productId,
        string $branchId,
        ?string $userId = null
    ): bool {
        $db = Database::getInstance();

        $db->update(
            'product_branch_overrides',
            [
                'deleted_at' => date('Y-m-d H:i:s'),
                'deleted_by' => $userId
            ],
            'product_id = ? AND branch_id = ? AND deleted_at IS NULL',
            [$productId, $branchId]
        );

        return true;
    }

    /**
     * Override scope belirleme
     */
    private static function determineScope(array $values): string
    {
        $hasPrice = isset($values['current_price']) || isset($values['previous_price']);
        $hasCampaign = isset($values['discount_percent']) || isset($values['campaign_text']);
        $hasStock = isset($values['stock_quantity']);
        $hasCompliance = isset($values['kunye_no']);

        $count = ($hasPrice ? 1 : 0) + ($hasCampaign ? 1 : 0) + ($hasStock ? 1 : 0) + ($hasCompliance ? 1 : 0);

        if ($count > 1) return 'full';
        if ($hasPrice) return 'price';
        if ($hasCampaign) return 'campaign';
        if ($hasStock) return 'stock';
        if ($hasCompliance) return 'compliance';

        return 'price';
    }

    /**
     * Fiyat değişikliği logla
     */
    private static function logPriceChange(
        string $productId,
        string $branchId,
        $oldPrice,
        $newPrice,
        string $source,
        ?string $userId
    ): void {
        $db = Database::getInstance();

        $changePercent = null;
        if ($oldPrice && $oldPrice > 0) {
            $changePercent = (($newPrice - $oldPrice) / $oldPrice) * 100;
        }

        $db->insert('branch_price_history', [
            'id' => $db->generateUuid(),
            'product_id' => $productId,
            'branch_id' => $branchId,
            'old_price' => $oldPrice,
            'new_price' => $newPrice,
            'price_type' => 'current',
            'change_reason' => $source,
            'change_percent' => $changePercent,
            'changed_by' => $userId
        ]);
    }
}
