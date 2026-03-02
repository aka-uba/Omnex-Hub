<?php
/**
 * SettingsResolver Service
 *
 * 3 Seviyeli Ayar Modeli: system -> company -> (user)
 * Tüm entegrasyonlar için merkezi ayar çözümleme servisi.
 *
 * ALTIN KURAL:
 * 1. company override varsa -> onu kullan
 * 2. yoksa system default -> fallback
 *
 * =========================================================
 * is_active DAVRANIŞ POLİTİKASI
 * =========================================================
 *
 * SORU: System is_active=false ise, company override açabilir mi?
 * CEVAP: EVET, açabilir. Çünkü:
 *
 * 1. Company override VARSA:
 *    - Company'nin kendi is_active değeri kullanılır
 *    - System is_active değeri dikkate ALINMAZ
 *    - Örnek: System kapalı (is_active=false) olsa bile,
 *             company kendi ayarlarında is_active=true yapabilir
 *
 * 2. Company override YOKSA:
 *    - System is_active değeri kullanılır
 *    - System kapalıysa, o firma için entegrasyon kapalıdır
 *
 * MANTIK:
 * - Override = "Ben kendi kurallarımı belirliyorum"
 * - Override yapan firma, bağımsız davranır
 * - Bu pattern, "pilot firma" senaryolarına uygun:
 *   - Sistem genelinde kapalı, ama X firması test ediyor
 *   - Sistem genelinde açık, ama Y firması kullanmıyor
 *
 * KOD ÖRNEĞİ:
 * ```php
 * $effective = $resolver->getEffectiveSettings('smtp', $companyId);
 * if (!$effective['is_active']) {
 *     return Response::error('Bu entegrasyon şu anda devre dışı', 403);
 * }
 * ```
 *
 * @package Omnex Display Hub
 * @version 2.0.12
 */

class SettingsResolver
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    // =========================================================
    // GENEL PATTERN: getEffectiveSettings
    // =========================================================

    /**
     * Entegrasyon ayarlarını çözümle (company -> system fallback)
     *
     * @param string $integrationType hal, smtp, erp, payment
     * @param string|null $companyId Firma ID (null = sadece system)
     * @return array ['settings' => [...], 'source' => 'company|system', 'is_override' => bool]
     */
    public function getEffectiveSettings(string $integrationType, ?string $companyId = null): array
    {
        // 1. Company override var mı?
        if ($companyId) {
            $companySettings = $this->db->fetch(
                "SELECT * FROM integration_settings
                 WHERE integration_type = ? AND company_id = ? AND scope = 'company'",
                [$integrationType, $companyId]
            );

            if ($companySettings && !empty($companySettings['config_json'])) {
                return [
                    'settings' => json_decode($companySettings['config_json'], true) ?: [],
                    'source' => 'company',
                    'is_override' => true,
                    'is_active' => (bool)$companySettings['is_active'],
                    'id' => $companySettings['id']
                ];
            }
        }

        // 2. System default'a fallback
        $systemSettings = $this->db->fetch(
            "SELECT * FROM integration_settings
             WHERE integration_type = ? AND scope = 'system' AND company_id IS NULL",
            [$integrationType]
        );

        if ($systemSettings && !empty($systemSettings['config_json'])) {
            return [
                'settings' => json_decode($systemSettings['config_json'], true) ?: [],
                'source' => 'system',
                'is_override' => false,
                'is_active' => (bool)$systemSettings['is_active'],
                'id' => $systemSettings['id']
            ];
        }

        // 3. Hiç ayar yoksa boş döndür
        return [
            'settings' => [],
            'source' => 'none',
            'is_override' => false,
            'is_active' => false,
            'id' => null
        ];
    }

    /**
     * Company-level ayar kaydet veya güncelle
     *
     * @param string $integrationType
     * @param string $companyId
     * @param array $config
     * @param bool $isActive
     * @return bool
     */
    public function saveCompanySettings(string $integrationType, string $companyId, array $config, bool $isActive = true): bool
    {
        $existing = $this->db->fetch(
            "SELECT id FROM integration_settings
             WHERE integration_type = ? AND company_id = ? AND scope = 'company'",
            [$integrationType, $companyId]
        );

        $data = [
            'config_json' => json_encode($config),
            'is_active' => $isActive ? 1 : 0,
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if ($existing) {
            return $this->db->update('integration_settings', $data, 'id = ?', [$existing['id']]);
        } else {
            $data['id'] = $this->db->generateUuid();
            $data['company_id'] = $companyId;
            $data['scope'] = 'company';
            $data['integration_type'] = $integrationType;
            $data['created_at'] = date('Y-m-d H:i:s');
            return $this->db->insert('integration_settings', $data);
        }
    }

    /**
     * System-level ayar kaydet (SuperAdmin only)
     *
     * @param string $integrationType
     * @param array $config
     * @param bool $isActive
     * @return bool
     */
    public function saveSystemSettings(string $integrationType, array $config, bool $isActive = true): bool
    {
        $existing = $this->db->fetch(
            "SELECT id FROM integration_settings
             WHERE integration_type = ? AND scope = 'system' AND company_id IS NULL",
            [$integrationType]
        );

        $data = [
            'config_json' => json_encode($config),
            'is_active' => $isActive ? 1 : 0,
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if ($existing) {
            return $this->db->update('integration_settings', $data, 'id = ?', [$existing['id']]);
        } else {
            $data['id'] = 'system-' . $integrationType . '-default';
            $data['company_id'] = null;
            $data['scope'] = 'system';
            $data['integration_type'] = $integrationType;
            $data['created_at'] = date('Y-m-d H:i:s');
            return $this->db->insert('integration_settings', $data);
        }
    }

    /**
     * Company override'ı sil (system default'a dön)
     *
     * @param string $integrationType
     * @param string $companyId
     * @return bool
     */
    public function deleteCompanyOverride(string $integrationType, string $companyId): bool
    {
        return $this->db->delete(
            'integration_settings',
            'integration_type = ? AND company_id = ? AND scope = ?',
            [$integrationType, $companyId, 'company']
        );
    }

    // =========================================================
    // HANSHOW ÖZEL METODLAR
    // =========================================================

    /**
     * Hanshow ayarlarını çözümle (ayrı tablo kullanır)
     *
     * @param string|null $companyId
     * @return array
     */
    public function getHanshowSettings(?string $companyId = null): array
    {
        // 1. Company override
        if ($companyId) {
            $companySettings = $this->db->fetch(
                "SELECT * FROM hanshow_settings
                 WHERE company_id = ? AND scope = 'company'",
                [$companyId]
            );

            if ($companySettings) {
                $companySettings['_source'] = 'company';
                $companySettings['_is_override'] = true;
                return $this->normalizeHanshowSettings($companySettings);
            }
        }

        // 2. System default
        $systemSettings = $this->db->fetch(
            "SELECT * FROM hanshow_settings
             WHERE scope = 'system' AND company_id IS NULL"
        );

        if ($systemSettings) {
            $systemSettings['_source'] = 'system';
            $systemSettings['_is_override'] = false;
            return $this->normalizeHanshowSettings($systemSettings);
        }

        // 3. Varsayılan değerler
        return $this->getHanshowDefaults();
    }

    /**
     * Hanshow company ayarı kaydet
     *
     * @param string $companyId
     * @param array $data
     * @return bool
     */
    public function saveHanshowCompanySettings(string $companyId, array $data): bool
    {
        $existing = $this->db->fetch(
            "SELECT id FROM hanshow_settings WHERE company_id = ? AND scope = 'company'",
            [$companyId]
        );

        $saveData = [
            'eslworking_url' => $data['eslworking_url'] ?? 'http://127.0.0.1:9000',
            'user_id' => $data['user_id'] ?? 'default',
            'callback_url' => $data['callback_url'] ?? null,
            'default_priority' => $data['default_priority'] ?? 10,
            'sync_interval' => $data['sync_interval'] ?? 60,
            'auto_retry' => isset($data['auto_retry']) ? (int)$data['auto_retry'] : 1,
            'max_retry_attempts' => $data['max_retry_attempts'] ?? 3,
            'led_flash_on_update' => isset($data['led_flash_on_update']) ? (int)$data['led_flash_on_update'] : 1,
            'led_color' => $data['led_color'] ?? 'green',
            'enabled' => isset($data['enabled']) ? (int)$data['enabled'] : 1,
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if ($existing) {
            return $this->db->update('hanshow_settings', $saveData, 'id = ?', [$existing['id']]);
        } else {
            $saveData['id'] = $this->db->generateUuid();
            $saveData['company_id'] = $companyId;
            $saveData['scope'] = 'company';
            $saveData['created_at'] = date('Y-m-d H:i:s');
            return $this->db->insert('hanshow_settings', $saveData);
        }
    }

    /**
     * Hanshow system ayarı kaydet (SuperAdmin only)
     *
     * @param array $data
     * @return bool
     */
    public function saveHanshowSystemSettings(array $data): bool
    {
        $existing = $this->db->fetch(
            "SELECT id FROM hanshow_settings WHERE scope = 'system' AND company_id IS NULL"
        );

        $saveData = [
            'eslworking_url' => $data['eslworking_url'] ?? 'http://127.0.0.1:9000',
            'user_id' => $data['user_id'] ?? 'default',
            'callback_url' => $data['callback_url'] ?? null,
            'default_priority' => $data['default_priority'] ?? 10,
            'sync_interval' => $data['sync_interval'] ?? 60,
            'auto_retry' => isset($data['auto_retry']) ? (int)$data['auto_retry'] : 1,
            'max_retry_attempts' => $data['max_retry_attempts'] ?? 3,
            'led_flash_on_update' => isset($data['led_flash_on_update']) ? (int)$data['led_flash_on_update'] : 1,
            'led_color' => $data['led_color'] ?? 'green',
            'enabled' => isset($data['enabled']) ? (int)$data['enabled'] : 1,
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if ($existing) {
            return $this->db->update('hanshow_settings', $saveData, 'id = ?', [$existing['id']]);
        } else {
            $saveData['id'] = 'system-hanshow-default';
            $saveData['company_id'] = null;
            $saveData['scope'] = 'system';
            $saveData['created_at'] = date('Y-m-d H:i:s');
            return $this->db->insert('hanshow_settings', $saveData);
        }
    }

    /**
     * Hanshow ayarlarını normalize et
     */
    private function normalizeHanshowSettings(array $settings): array
    {
        $settings['auto_retry'] = (bool)($settings['auto_retry'] ?? true);
        $settings['led_flash_on_update'] = (bool)($settings['led_flash_on_update'] ?? true);
        $settings['enabled'] = (bool)($settings['enabled'] ?? true);
        return $settings;
    }

    /**
     * Hanshow varsayılan değerler
     */
    private function getHanshowDefaults(): array
    {
        return [
            'id' => null,
            'company_id' => null,
            'scope' => 'default',
            'eslworking_url' => 'http://127.0.0.1:9000',
            'user_id' => 'default',
            'callback_url' => null,
            'default_priority' => 10,
            'sync_interval' => 60,
            'auto_retry' => true,
            'max_retry_attempts' => 3,
            'led_flash_on_update' => true,
            'led_color' => 'green',
            'enabled' => true,
            '_source' => 'default',
            '_is_override' => false
        ];
    }

    // =========================================================
    // YARDIMCI METODLAR
    // =========================================================

    /**
     * Tüm entegrasyonların durumunu getir
     *
     * @param string|null $companyId
     * @return array
     */
    public function getAllIntegrationStatus(?string $companyId = null): array
    {
        $integrations = ['hal', 'smtp', 'erp', 'payment'];
        $status = [];

        foreach ($integrations as $type) {
            $effective = $this->getEffectiveSettings($type, $companyId);
            $status[$type] = [
                'configured' => !empty($effective['settings']),
                'active' => $effective['is_active'],
                'source' => $effective['source'],
                'is_override' => $effective['is_override']
            ];
        }

        // Hanshow ayrı tablo
        $hanshow = $this->getHanshowSettings($companyId);
        $status['hanshow'] = [
            'configured' => !empty($hanshow['eslworking_url']),
            'active' => $hanshow['enabled'] ?? false,
            'source' => $hanshow['_source'] ?? 'default',
            'is_override' => $hanshow['_is_override'] ?? false
        ];

        return $status;
    }

    /**
     * Belirli bir entegrasyon için hem system hem company ayarlarını getir
     * (UI'da "Varsayılanı kullan" checkbox'ı için)
     *
     * @param string $integrationType
     * @param string $companyId
     * @return array
     */
    public function getBothSettings(string $integrationType, string $companyId): array
    {
        $system = $this->db->fetch(
            "SELECT * FROM integration_settings
             WHERE integration_type = ? AND scope = 'system' AND company_id IS NULL",
            [$integrationType]
        );

        $company = $this->db->fetch(
            "SELECT * FROM integration_settings
             WHERE integration_type = ? AND company_id = ? AND scope = 'company'",
            [$integrationType, $companyId]
        );

        return [
            'system' => $system ? json_decode($system['config_json'], true) : [],
            'company' => $company ? json_decode($company['config_json'], true) : null,
            'has_override' => $company !== null,
            'using_system' => $company === null
        ];
    }
}
