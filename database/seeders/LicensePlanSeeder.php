<?php
/**
 * LicensePlanSeeder - Seeds default license plans.
 *
 * This seeder is permanent (non-demo) and upserts by id/slug.
 */

require_once __DIR__ . '/BaseSeeder.php';

class LicensePlanSeeder extends BaseSeeder
{
    protected function getTableName(): string
    {
        return 'license_plans';
    }

    protected function getDataFileName(): string
    {
        return 'license_plans.json';
    }

    public function run(): bool
    {
        $this->log("=== LicensePlanSeeder baslatiliyor ({$this->locale}) ===");

        // Permanent defaults: not company-scoped and not demo-scoped.
        $this->companyId = null;
        $this->demoOnly = false;

        $jsonData = $this->loadJsonData();
        if (!$jsonData || empty($jsonData['data'])) {
            if ($this->locale !== 'en') {
                $prevLocale = $this->locale;
                $this->locale = 'en';
                $jsonData = $this->loadJsonData();
                $this->locale = $prevLocale;
            }
        }

        if (!$jsonData || empty($jsonData['data'])) {
            $this->logError('Lisans plani verisi yuklenemedi veya bos');
            return false;
        }

        foreach ($jsonData['data'] as $plan) {
            if ($this->defaultOnly && empty($plan['is_default'])) {
                $this->stats['skipped']++;
                continue;
            }

            $this->seedPlan($plan);
        }

        $this->printSummary();
        return $this->stats['errors'] === 0;
    }

    public function clearDemoData(): int
    {
        // Permanent defaults should not be removed by demo cleanup.
        return 0;
    }

    public function clearAllData(): int
    {
        // Keep default license plans intact.
        return 0;
    }

    private function seedPlan(array $plan): bool
    {
        $data = $this->preparePlanData($plan);
        $table = $this->getTableName();
        $existingId = $this->findExistingPlanId($table, $data);

        if ($this->dryRun) {
            if ($existingId !== null) {
                $this->stats['updated']++;
                $this->log('  [DRY-RUN] Would update: ' . $existingId);
            } else {
                $this->stats['created']++;
                $this->log('  [DRY-RUN] Would insert: ' . ($data['id'] ?? 'unknown'));
            }
            return true;
        }

        try {
            if ($existingId !== null) {
                $update = $data;
                unset($update['id'], $update['created_at']);
                $update['updated_at'] = date('Y-m-d H:i:s');
                $update = $this->filterDataForTable($update, $table);

                $this->db->update($table, $update, 'id = ?', [$existingId]);
                $this->stats['updated']++;
                $this->log('  Updated: ' . ($data['name'] ?? $existingId));
            } else {
                $insert = $data;
                if (empty($insert['created_at'])) {
                    $insert['created_at'] = date('Y-m-d H:i:s');
                }
                if (empty($insert['updated_at'])) {
                    $insert['updated_at'] = date('Y-m-d H:i:s');
                }
                $insert = $this->filterDataForTable($insert, $table);

                $this->db->insert($table, $insert);
                $this->stats['created']++;
                $this->log('  Inserted: ' . ($data['name'] ?? $data['id']));
            }

            return true;
        } catch (Throwable $e) {
            $this->stats['errors']++;
            $this->logError('Lisans plani kayit hatasi (' . ($data['id'] ?? 'unknown') . '): ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Find existing plan by canonical ID first, then by unique slug.
     * Prevents duplicate inserts when IDs differ but slug is the same.
     */
    private function findExistingPlanId(string $table, array $data): ?string
    {
        $id = trim((string)($data['id'] ?? ''));
        if ($id !== '') {
            $existingById = $this->db->fetch("SELECT id FROM {$table} WHERE id = ?", [$id]);
            if ($existingById && !empty($existingById['id'])) {
                return (string)$existingById['id'];
            }
        }

        $slug = trim((string)($data['slug'] ?? ''));
        if ($slug === '') {
            return null;
        }

        $columns = $this->db->getTableColumns($table);
        if (!in_array('slug', $columns, true)) {
            return null;
        }

        $existingBySlug = $this->db->fetch("SELECT id FROM {$table} WHERE slug = ?", [$slug]);
        if ($existingBySlug && !empty($existingBySlug['id'])) {
            return (string)$existingBySlug['id'];
        }

        return null;
    }

    private function preparePlanData(array $plan): array
    {
        $features = $plan['features'] ?? null;
        if (is_array($features)) {
            $features = json_encode($features, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        $deviceCategories = $plan['device_categories'] ?? null;
        if (is_array($deviceCategories)) {
            $deviceCategories = json_encode($deviceCategories, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        $defaultDevicePricing = $plan['default_device_pricing'] ?? null;
        if (is_array($defaultDevicePricing)) {
            $defaultDevicePricing = json_encode($defaultDevicePricing, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        return [
            'id' => (string)($plan['id'] ?? ''),
            'name' => (string)($plan['name'] ?? ''),
            'slug' => $plan['slug'] ?? null,
            'description' => $plan['description'] ?? null,
            'plan_type' => (string)($plan['plan_type'] ?? 'subscription'),
            'duration_months' => (int)($plan['duration_months'] ?? 12),
            'price' => (float)($plan['price'] ?? 0),
            'currency' => (string)($plan['currency'] ?? 'TRY'),
            'max_users' => (int)($plan['max_users'] ?? 5),
            'max_devices' => (int)($plan['max_devices'] ?? 10),
            'max_products' => (int)($plan['max_products'] ?? 1000),
            'max_templates' => (int)($plan['max_templates'] ?? 50),
            'features' => $features,
            'is_popular' => !empty($plan['is_popular']) ? 1 : 0,
            'is_enterprise' => !empty($plan['is_enterprise']) ? 1 : 0,
            'sort_order' => (int)($plan['sort_order'] ?? 0),
            'status' => (string)($plan['status'] ?? 'active'),
            'is_active' => isset($plan['is_active']) ? ((bool)$plan['is_active'] ? 1 : 0) : 1,
            'max_branches' => (int)($plan['max_branches'] ?? -1),
            'max_storage' => (int)($plan['max_storage'] ?? -1),
            'is_unlimited' => !empty($plan['is_unlimited']) ? 1 : 0,
            'device_categories' => $deviceCategories,
            'default_device_pricing' => $defaultDevicePricing,
            'created_at' => $plan['created_at'] ?? null,
            'updated_at' => $plan['updated_at'] ?? null,
        ];
    }
}