<?php
/**
 * LabelSizeSeeder - Seeds default label sizes.
 *
 * Permanent defaults:
 * - Not company-scoped
 * - Not demo-scoped
 * - Upsert by stable id, then by (width,height,unit), then by name
 */

require_once __DIR__ . '/BaseSeeder.php';

class LabelSizeSeeder extends BaseSeeder
{
    protected function getTableName(): string
    {
        return 'label_sizes';
    }

    protected function getDataFileName(): string
    {
        return 'label_sizes.json';
    }

    public function run(): bool
    {
        $this->log("=== LabelSizeSeeder baslatiliyor ({$this->locale}) ===");

        // Permanent defaults: global and non-demo
        $this->companyId = null;
        $this->demoOnly = false;

        // Locale-specific first
        $jsonData = $this->loadJsonData();
        if ((!$jsonData || empty($jsonData['data'])) && $this->locale !== 'en') {
            // Fallback to EN locale data
            $prevLocale = $this->locale;
            $this->locale = 'en';
            $jsonData = $this->loadJsonData();
            $this->locale = $prevLocale;
        }
        if (!$jsonData || empty($jsonData['data'])) {
            // Final fallback to shared data
            $jsonData = $this->loadSharedData($this->getDataFileName());
        }

        if (!$jsonData || empty($jsonData['data'])) {
            $this->logError('Etiket boyutu verisi yuklenemedi veya bos');
            return false;
        }

        foreach ($jsonData['data'] as $row) {
            $this->seedLabelSize((array)$row);
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
        // Keep default label sizes intact.
        return 0;
    }

    private function seedLabelSize(array $input): bool
    {
        $table = $this->getTableName();

        $width = isset($input['width']) ? (float)$input['width'] : 0.0;
        $height = isset($input['height']) ? (float)$input['height'] : 0.0;
        if ($width <= 0 || $height <= 0) {
            $this->stats['errors']++;
            $this->logError('Gecersiz etiket boyutu (width/height)');
            return false;
        }

        $unit = (string)($input['unit'] ?? 'mm');
        if (!in_array($unit, ['mm', 'inch', 'px'], true)) {
            $unit = 'mm';
        }

        $name = trim((string)($input['name'] ?? ''));
        if ($name === '') {
            $name = rtrim(rtrim((string)$width, '0'), '.') . 'x' . rtrim(rtrim((string)$height, '0'), '.') . ' ' . $unit;
        }

        $data = [
            'id' => trim((string)($input['id'] ?? '')),
            'company_id' => null,
            'name' => $name,
            'width' => $width,
            'height' => $height,
            'unit' => $unit,
            'is_default' => !empty($input['is_default']) ? 1 : 0,
            'is_active' => array_key_exists('is_active', $input) ? (!empty($input['is_active']) ? 1 : 0) : 1,
            'sort_order' => (int)($input['sort_order'] ?? 0),
        ];

        if ($this->dryRun) {
            $this->stats['created']++;
            $this->log('  [DRY-RUN] Would upsert: ' . $data['name']);
            return true;
        }

        try {
            $existingId = $this->findExistingId($table, $data);

            if ($existingId !== null) {
                $update = $data;
                unset($update['id'], $update['company_id']);
                $update['updated_at'] = date('Y-m-d H:i:s');
                $update = $this->filterDataForTable($update, $table);

                $this->db->update($table, $update, 'id = ?', [$existingId]);
                $this->stats['updated']++;
                $this->log('  Updated: ' . $data['name']);
                return true;
            }

            if ($data['id'] === '') {
                $data['id'] = $this->generateUuid();
            }
            $data['created_at'] = date('Y-m-d H:i:s');
            $data['updated_at'] = date('Y-m-d H:i:s');
            $data = $this->filterDataForTable($data, $table);

            $this->db->insert($table, $data);
            $this->stats['created']++;
            $this->log('  Inserted: ' . $data['name']);
            return true;
        } catch (Throwable $e) {
            $this->stats['errors']++;
            $this->logError('Etiket boyutu kayit hatasi (' . $data['name'] . '): ' . $e->getMessage());
            return false;
        }
    }

    private function findExistingId(string $table, array $data): ?string
    {
        $id = trim((string)($data['id'] ?? ''));
        if ($id !== '') {
            $existingById = $this->db->fetch("SELECT id FROM {$table} WHERE id = ?", [$id]);
            if ($existingById && !empty($existingById['id'])) {
                return (string)$existingById['id'];
            }
        }

        $existingBySize = $this->db->fetch(
            "SELECT id FROM {$table}
             WHERE company_id IS NULL
               AND width = ?
               AND height = ?
               AND unit = ?
             ORDER BY sort_order ASC
             LIMIT 1",
            [(float)$data['width'], (float)$data['height'], (string)$data['unit']]
        );
        if ($existingBySize && !empty($existingBySize['id'])) {
            return (string)$existingBySize['id'];
        }

        $existingByName = $this->db->fetch(
            "SELECT id FROM {$table}
             WHERE company_id IS NULL
               AND name = ?
             LIMIT 1",
            [(string)$data['name']]
        );
        if ($existingByName && !empty($existingByName['id'])) {
            return (string)$existingByName['id'];
        }

        return null;
    }
}