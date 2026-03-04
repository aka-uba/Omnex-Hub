<?php
/**
 * TenantBackupService - Firma bazlı yedekleme, geri yükleme ve içe aktarma servisi
 *
 * Tüm firma verilerini (50+ tablo) JSON arşiv formatında dışa aktarır,
 * mevcut firmaya geri yükler veya yeni firma olarak içe aktarır.
 *
 * @package OmnexDisplayHub
 */

require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../core/Logger.php';

class TenantBackupService
{
    private static ?TenantBackupService $instance = null;
    private $db;

    /** Manifest version for archive compatibility checks */
    const MANIFEST_VERSION = '1.0';

    /** Batch size for SELECT queries to avoid memory issues */
    const BATCH_SIZE = 1000;

    /** Settings key in the settings table */
    const SETTINGS_KEY = 'tenant_backup_config';

    /**
     * Tier 1 — Tables with direct company_id column.
     * Order matters for INSERT (parents first) and DELETE (reverse).
     *
     * Format: 'table_name' => [
     *   'company_id_type' => 'uuid' | 'text',  // column type for WHERE clause
     *   'id_type'         => 'uuid' | 'text',   // PK type (affects UUID remap)
     *   'skip_on_new'     => true,               // skip when importing as new company
     * ]
     */
    private array $tier1Tables = [
        // -- core --
        'users'                     => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'settings'                  => ['company_id_type' => 'text', 'id_type' => 'text'],
        'menu_items'                => ['company_id_type' => 'text', 'id_type' => 'text'],

        // -- catalog --
        'categories'                => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'production_types'          => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'products'                  => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'bundles'                   => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],

        // -- branch --
        'branches'                  => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'branch_import_logs'        => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],

        // -- labels --
        'label_sizes'               => ['company_id_type' => 'uuid', 'id_type' => 'text'],
        'templates'                 => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'render_queue'              => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'product_renders'           => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'render_cache'              => ['company_id_type' => 'text', 'id_type' => 'uuid'],
        'render_jobs'               => ['company_id_type' => 'text', 'id_type' => 'uuid'],

        // -- media --
        'media_folders'             => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'media'                     => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'company_storage_usage'     => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],

        // -- devices --
        'device_groups'             => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'devices'                   => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'device_sync_requests'      => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'gateways'                  => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'hanshow_settings'          => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'hanshow_aps'               => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'hanshow_esls'              => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'hanshow_queue'             => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'mqtt_settings'             => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'firmware_updates'          => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],

        // -- signage --
        'playlists'                 => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'schedules'                 => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'web_templates'             => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'web_template_widgets'      => ['company_id_type' => 'uuid', 'id_type' => 'text'],
        'web_template_assignments'  => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'transcode_queue'           => ['company_id_type' => 'text', 'id_type' => 'uuid'],
        'transcode_variants'        => ['company_id_type' => 'text', 'id_type' => 'uuid'],

        // -- integration --
        'integrations'              => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'integration_settings'      => ['company_id_type' => 'text', 'id_type' => 'text'],
        'import_mappings'           => ['company_id_type' => 'text', 'id_type' => 'uuid'],
        'tamsoft_settings'          => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'tamsoft_tokens'            => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'tamsoft_sync_logs'         => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'tamsoft_depo_mapping'      => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'product_hal_data'          => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],
        'hal_distribution_logs'     => ['company_id_type' => 'uuid', 'id_type' => 'uuid'],

        // -- audit --
        'audit_logs'                => ['company_id_type' => 'text', 'id_type' => 'uuid'],
        'notifications'             => ['company_id_type' => 'text', 'id_type' => 'uuid'],

        // -- license (skip on new company import) --
        'licenses'                  => ['company_id_type' => 'uuid', 'id_type' => 'uuid', 'skip_on_new' => true],
        'payment_settings'          => ['company_id_type' => 'uuid', 'id_type' => 'uuid', 'skip_on_new' => true],
        'payment_transactions'      => ['company_id_type' => 'uuid', 'id_type' => 'uuid', 'skip_on_new' => true],
    ];

    /**
     * Tier 2 — Child tables without company_id.
     * Data is extracted via JOIN through parent table.
     *
     * Format: 'table_name' => [
     *   'parent_table'  => 'parent_table_name',
     *   'parent_fk'     => 'foreign_key_in_child',
     *   'parent_pk'     => 'primary_key_in_parent' (default: 'id'),
     *   'id_type'       => 'uuid' | 'text',
     *   'skip_on_new'   => true,
     * ]
     */
    private array $tier2Tables = [
        // catalog children
        'bundle_items'                  => ['parent_table' => 'bundles',        'parent_fk' => 'bundle_id',    'id_type' => 'uuid'],
        'price_history'                 => ['parent_table' => 'products',       'parent_fk' => 'product_id',   'id_type' => 'uuid'],
        'bundle_price_history'          => ['parent_table' => 'bundles',        'parent_fk' => 'bundle_id',    'id_type' => 'uuid'],

        // branch children
        'product_branch_overrides'      => ['parent_table' => 'branches',       'parent_fk' => 'branch_id',    'id_type' => 'uuid'],
        'bundle_branch_overrides'       => ['parent_table' => 'branches',       'parent_fk' => 'branch_id',    'id_type' => 'uuid'],
        'branch_price_history'          => ['parent_table' => 'branches',       'parent_fk' => 'branch_id',    'id_type' => 'uuid'],
        'bundle_branch_price_history'   => ['parent_table' => 'branches',       'parent_fk' => 'branch_id',    'id_type' => 'uuid'],
        'user_branch_access'            => ['parent_table' => 'users',          'parent_fk' => 'user_id',      'id_type' => 'uuid'],

        // integration children
        'product_branch_hal_overrides'  => ['parent_table' => 'product_hal_data','parent_fk' => 'hal_data_id', 'id_type' => 'uuid'],
        'integration_settings_audit'    => ['parent_table' => 'integration_settings','parent_fk' => 'integration_settings_id','id_type' => 'uuid'],

        // device children
        'device_tokens'                 => ['parent_table' => 'devices',        'parent_fk' => 'device_id',    'id_type' => 'uuid'],
        'device_heartbeats'             => ['parent_table' => 'devices',        'parent_fk' => 'device_id',    'id_type' => 'uuid'],
        'device_commands'               => ['parent_table' => 'devices',        'parent_fk' => 'device_id',    'id_type' => 'uuid'],
        'device_logs'                   => ['parent_table' => 'devices',        'parent_fk' => 'device_id',    'id_type' => 'uuid'],
        'device_alerts'                 => ['parent_table' => 'devices',        'parent_fk' => 'device_id',    'id_type' => 'uuid'],
        'device_group_members'          => ['parent_table' => 'device_groups',  'parent_fk' => 'group_id',     'id_type' => 'uuid'],
        'device_content_assignments'    => ['parent_table' => 'devices',        'parent_fk' => 'device_id',    'id_type' => 'uuid'],
        'gateway_devices'               => ['parent_table' => 'gateways',       'parent_fk' => 'gateway_id',   'id_type' => 'uuid'],
        'gateway_commands'              => ['parent_table' => 'gateways',       'parent_fk' => 'gateway_id',   'id_type' => 'uuid'],

        // signage children
        'playlist_items'                => ['parent_table' => 'playlists',      'parent_fk' => 'playlist_id',  'id_type' => 'uuid'],
        'schedule_devices'              => ['parent_table' => 'schedules',      'parent_fk' => 'schedule_id',  'id_type' => 'uuid'],
        'web_template_versions'         => ['parent_table' => 'web_templates',  'parent_fk' => 'template_id',  'id_type' => 'uuid'],

        // labels children
        'render_queue_items'            => ['parent_table' => 'render_queue',   'parent_fk' => 'queue_id',     'id_type' => 'uuid'],

        // audit children
        'notification_recipients'       => ['parent_table' => 'notifications',  'parent_fk' => 'notification_id','id_type' => 'uuid'],
        'user_notification_preferences' => ['parent_table' => 'users',          'parent_fk' => 'user_id',      'id_type' => 'uuid'],

        // license children
        'license_device_pricing'        => ['parent_table' => 'licenses',       'parent_fk' => 'license_id',   'id_type' => 'uuid', 'skip_on_new' => true],
    ];

    /**
     * UUID columns per table that need remapping in "new company" import mode.
     * Derived from FK constraints. Only uuid-type columns are listed.
     * The 'id' column is always remapped for uuid PK tables.
     */
    private array $uuidColumnsMap = [
        'users'                     => ['id', 'company_id'],
        'categories'                => ['id', 'company_id'],
        'production_types'          => ['id', 'company_id'],
        'products'                  => ['id', 'company_id'],
        'bundles'                   => ['id', 'company_id', 'created_by'],
        'branches'                  => ['id', 'company_id', 'manager_user_id', 'parent_id'],
        'branch_import_logs'        => ['id', 'company_id', 'created_by', 'branch_id'],
        'templates'                 => ['id', 'company_id', 'created_by', 'parent_id'],
        'render_queue'              => ['id', 'company_id', 'template_id', 'product_id', 'created_by'],
        'product_renders'           => ['id', 'company_id', 'product_id', 'template_id'],
        'media_folders'             => ['id', 'company_id', 'parent_id'],
        'media'                     => ['id', 'company_id', 'uploaded_by', 'folder_id'],
        'company_storage_usage'     => ['id', 'company_id'],
        'device_groups'             => ['id', 'company_id', 'parent_id'],
        'devices'                   => ['id', 'company_id', 'group_id', 'current_template_id', 'branch_id'],
        'device_sync_requests'      => ['id', 'company_id'],
        'gateways'                  => ['id', 'company_id'],
        'hanshow_settings'          => ['id', 'company_id'],
        'hanshow_aps'               => ['id', 'company_id'],
        'hanshow_esls'              => ['id', 'company_id', 'current_product_id', 'current_template_id'],
        'hanshow_queue'             => ['id', 'company_id'],
        'mqtt_settings'             => ['id', 'company_id'],
        'firmware_updates'          => ['id', 'company_id', 'created_by'],
        'playlists'                 => ['id', 'company_id'],
        'schedules'                 => ['id', 'company_id'],
        'web_templates'             => ['id', 'company_id', 'parent_template_id', 'created_by', 'updated_by'],
        'web_template_assignments'  => ['id', 'company_id', 'template_id', 'device_id', 'assigned_by'],
        'integrations'              => ['id', 'company_id'],
        'tamsoft_settings'          => ['id', 'company_id'],
        'tamsoft_tokens'            => ['id', 'company_id'],
        'tamsoft_sync_logs'         => ['id', 'company_id'],
        'tamsoft_depo_mapping'      => ['id', 'company_id', 'branch_id'],
        'product_hal_data'          => ['id', 'company_id', 'product_id'],
        'hal_distribution_logs'     => ['id', 'company_id', 'product_id'],
        'licenses'                  => ['id', 'company_id'],
        'payment_settings'          => ['id', 'company_id'],
        'payment_transactions'      => ['id', 'company_id', 'license_id', 'user_id'],
        'tenant_backups'            => ['id', 'company_id', 'created_by'],
        // Tier 2
        'bundle_items'              => ['id', 'bundle_id', 'product_id'],
        'price_history'             => ['id', 'product_id'],
        'bundle_price_history'      => ['id', 'bundle_id'],
        'product_branch_overrides'  => ['id', 'branch_id', 'product_id', 'created_by', 'updated_by', 'deleted_by'],
        'bundle_branch_overrides'   => ['id', 'branch_id', 'bundle_id', 'created_by', 'updated_by', 'deleted_by'],
        'branch_price_history'      => ['id', 'branch_id', 'product_id', 'changed_by'],
        'bundle_branch_price_history'=> ['id', 'branch_id', 'bundle_id', 'changed_by'],
        'user_branch_access'        => ['id', 'user_id', 'branch_id', 'granted_by'],
        'product_branch_hal_overrides'=> ['id', 'hal_data_id'],
        'device_tokens'             => ['id', 'device_id'],
        'device_heartbeats'         => ['id', 'device_id'],
        'device_commands'           => ['id', 'device_id'],
        'device_logs'               => ['id', 'device_id'],
        'device_alerts'             => ['id', 'device_id'],
        'device_group_members'      => ['id', 'group_id', 'device_id'],
        'device_content_assignments'=> ['id', 'device_id'],
        'gateway_devices'           => ['id', 'gateway_id', 'device_id'],
        'gateway_commands'          => ['id', 'gateway_id', 'device_id'],
        'playlist_items'            => ['id', 'playlist_id'],
        'schedule_devices'          => ['id', 'schedule_id'],
        'web_template_versions'     => ['id', 'template_id', 'created_by'],
        'render_queue_items'        => ['id', 'queue_id', 'device_id'],
        'notification_recipients'   => ['id', 'notification_id'],
        'user_notification_preferences' => ['id', 'user_id'],
        'license_device_pricing'    => ['id', 'license_id'],
    ];

    private function __construct()
    {
        $this->db = Database::getInstance();
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    // =========================================================================
    //  EXPORT
    // =========================================================================

    /**
     * Export a company's data to a .tar.gz archive.
     *
     * @param string $companyId  UUID of the company
     * @param array  $options    ['include_media' => bool, 'backup_type' => 'manual'|'scheduled', 'created_by' => uuid]
     * @return array             ['success' => bool, 'backup_id' => string, 'file_path' => string, 'file_size' => int, ...]
     */
    public function exportCompany(string $companyId, array $options = []): array
    {
        $includeMedia = !empty($options['include_media']);
        $backupType   = $options['backup_type'] ?? 'manual';
        $createdBy    = $options['created_by'] ?? null;

        // Fetch company info
        $company = $this->db->fetch("SELECT id, name, slug, code FROM companies WHERE id = ?", [$companyId]);
        if (!$company) {
            return ['success' => false, 'error' => 'Company not found'];
        }

        // Build filename with sanitized company name
        $safeName = preg_replace('/[^a-zA-Z0-9_\-\x{00C0}-\x{024F}]/u', '_', $company['name']);
        $safeName = preg_replace('/_+/', '_', trim($safeName, '_'));
        if (empty($safeName)) {
            $safeName = $company['slug'] ?: $company['code'] ?: substr($companyId, 0, 8);
        }
        $timestamp = date('Ymd_His');
        $filename = "backup_{$safeName}_{$timestamp}";

        // Create backup record
        $backupId = $this->db->generateUuid();
        $this->db->insert('tenant_backups', [
            'id'             => $backupId,
            'company_id'     => $companyId,
            'filename'       => $filename . '.tar.gz',
            'file_path'      => '',
            'backup_type'    => $backupType,
            'status'         => 'running',
            'media_included' => $includeMedia ? 'true' : 'false',
            'progress'       => 0,
            'started_at'     => date('c'),
            'created_by'     => $createdBy,
        ]);

        // Temp directory
        $storageBase = defined('STORAGE_PATH') ? STORAGE_PATH : (dirname(__DIR__) . '/storage');
        $backupDir = $storageBase . '/backups';
        if (!is_dir($backupDir)) {
            @mkdir($backupDir, 0755, true);
        }
        $tempDir = $backupDir . '/tmp_' . $backupId;
        @mkdir($tempDir . '/data', 0755, true);

        try {
            $tablesExported = [];
            $totalTables = count($this->tier1Tables) + count($this->tier2Tables);
            $processed = 0;

            // --- Tier 1: Direct company_id tables ---
            foreach ($this->tier1Tables as $table => $config) {
                $processed++;
                $this->updateProgress($backupId, (int)(($processed / $totalTables) * 80));

                if (!$this->db->tableExists($table)) {
                    continue;
                }

                $cidType = $config['company_id_type'];
                $companyParam = ($cidType === 'uuid') ? $companyId : (string)$companyId;
                $rows = $this->db->fetchAll(
                    "SELECT * FROM {$table} WHERE company_id = ?",
                    [$companyParam]
                );

                if (!empty($rows)) {
                    $this->writeJsonFile($tempDir . "/data/{$table}.json", $rows);
                    $tablesExported[$table] = count($rows);
                }
            }

            // --- Tier 2: Child tables via JOIN ---
            foreach ($this->tier2Tables as $table => $config) {
                $processed++;
                $this->updateProgress($backupId, (int)(($processed / $totalTables) * 80));

                if (!$this->db->tableExists($table)) {
                    continue;
                }

                $parentTable = $config['parent_table'];
                $parentFk    = $config['parent_fk'];
                $parentPk    = $config['parent_pk'] ?? 'id';

                // Determine parent's company_id type
                $parentConfig = $this->tier1Tables[$parentTable] ?? null;
                if (!$parentConfig) {
                    continue; // parent not in tier1 (shouldn't happen)
                }
                $cidType = $parentConfig['company_id_type'];
                $companyParam = ($cidType === 'uuid') ? $companyId : (string)$companyId;

                $sql = "SELECT c.* FROM {$table} c
                        INNER JOIN {$parentTable} p ON c.{$parentFk} = p.{$parentPk}
                        WHERE p.company_id = ?";
                $rows = $this->db->fetchAll($sql, [$companyParam]);

                if (!empty($rows)) {
                    $this->writeJsonFile($tempDir . "/data/{$table}.json", $rows);
                    $tablesExported[$table] = count($rows);
                }
            }

            // --- Optional: Media files ---
            $mediaFilesCopied = 0;
            if ($includeMedia) {
                $this->updateProgress($backupId, 82);
                $mediaDir = $storageBase . '/companies/' . $companyId;
                if (is_dir($mediaDir)) {
                    @mkdir($tempDir . '/media', 0755, true);
                    $mediaFilesCopied = $this->copyDirectory($mediaDir, $tempDir . '/media');
                }
            }

            // --- Write manifest ---
            $this->updateProgress($backupId, 90);
            $manifest = [
                'version'           => self::MANIFEST_VERSION,
                'created_at'        => date('c'),
                'company'           => [
                    'id'   => $companyId,
                    'name' => $company['name'],
                    'slug' => $company['slug'],
                    'code' => $company['code'],
                ],
                'tables_exported'   => $tablesExported,
                'total_rows'        => array_sum($tablesExported),
                'media_included'    => $includeMedia,
                'media_files_count' => $mediaFilesCopied,
                'checksums'         => $this->computeChecksums($tempDir . '/data'),
            ];
            $this->writeJsonFile($tempDir . '/manifest.json', $manifest);

            // --- Create archive ---
            $this->updateProgress($backupId, 92);
            $archivePath = $backupDir . '/' . $filename . '.tar.gz';
            $archiveCreated = $this->createTarGz($tempDir, $archivePath);

            if (!$archiveCreated) {
                throw new Exception('Failed to create archive');
            }

            $fileSize = filesize($archivePath);

            // --- Update backup record ---
            $this->db->update('tenant_backups', [
                'status'          => 'completed',
                'file_path'       => $archivePath,
                'file_size'       => $fileSize,
                'tables_exported' => json_encode($tablesExported),
                'progress'        => 100,
                'completed_at'    => date('c'),
            ], 'id = ?', [$backupId]);

            // Cleanup temp
            $this->removeDirectory($tempDir);

            Logger::info('TenantBackupService: Export completed', [
                'company_id'  => $companyId,
                'backup_id'   => $backupId,
                'tables'      => count($tablesExported),
                'total_rows'  => array_sum($tablesExported),
                'file_size'   => $fileSize,
                'media'       => $includeMedia,
            ]);

            return [
                'success'   => true,
                'backup_id' => $backupId,
                'file_path' => $archivePath,
                'filename'  => $filename . '.tar.gz',
                'file_size' => $fileSize,
                'tables'    => $tablesExported,
            ];

        } catch (Exception $e) {
            // Mark failed
            $this->db->update('tenant_backups', [
                'status'        => 'failed',
                'error_message' => substr($e->getMessage(), 0, 500),
                'completed_at'  => date('c'),
            ], 'id = ?', [$backupId]);

            // Cleanup temp
            $this->removeDirectory($tempDir);

            Logger::error('TenantBackupService: Export failed', [
                'company_id' => $companyId,
                'backup_id'  => $backupId,
                'error'      => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error'   => $e->getMessage(),
                'backup_id' => $backupId,
            ];
        }
    }

    // =========================================================================
    //  IMPORT — OVERWRITE MODE
    // =========================================================================

    /**
     * Import archive data into an EXISTING company (overwrite mode).
     * All existing data for the company is deleted first.
     *
     * @param string $archivePath  Path to .tar.gz file
     * @param string $companyId    Target company UUID
     * @param array  $options      ['include_media' => bool]
     * @return array
     */
    public function importOverwrite(string $archivePath, string $companyId, array $options = []): array
    {
        $includeMedia = $options['include_media'] ?? true;

        // Verify company exists
        $company = $this->db->fetch("SELECT id, name FROM companies WHERE id = ?", [$companyId]);
        if (!$company) {
            return ['success' => false, 'error' => 'Target company not found'];
        }

        // Extract archive
        $storageBase = defined('STORAGE_PATH') ? STORAGE_PATH : (dirname(__DIR__) . '/storage');
        $tempDir = $storageBase . '/backups/import_' . uniqid();

        try {
            if (!$this->extractTarGz($archivePath, $tempDir)) {
                throw new Exception('Failed to extract archive');
            }

            $manifest = $this->readManifest($tempDir);
            if (!$manifest) {
                throw new Exception('Invalid archive: manifest.json not found or invalid');
            }

            // Verify checksums
            if (!$this->verifyChecksums($tempDir . '/data', $manifest['checksums'] ?? [])) {
                throw new Exception('Archive integrity check failed');
            }

            // Set SuperAdmin context for RLS bypass
            $this->db->setAppContext(null, null, 'SuperAdmin');

            // Begin transaction
            $this->db->beginTransaction();

            // DELETE Tier 2 first (children), reverse order
            $tier2Reversed = array_reverse(array_keys($this->tier2Tables));
            foreach ($tier2Reversed as $table) {
                if (!$this->db->tableExists($table)) continue;
                $config = $this->tier2Tables[$table];
                $parentTable = $config['parent_table'];
                $parentFk    = $config['parent_fk'];
                $parentPk    = $config['parent_pk'] ?? 'id';
                $parentConfig = $this->tier1Tables[$parentTable] ?? null;
                if (!$parentConfig) continue;

                $cidType = $parentConfig['company_id_type'];
                $companyParam = ($cidType === 'uuid') ? $companyId : (string)$companyId;

                $this->db->query(
                    "DELETE FROM {$table} WHERE {$parentFk} IN (SELECT {$parentPk} FROM {$parentTable} WHERE company_id = ?)",
                    [$companyParam]
                );
            }

            // DELETE Tier 1 in reverse order
            $tier1Reversed = array_reverse(array_keys($this->tier1Tables));
            foreach ($tier1Reversed as $table) {
                if (!$this->db->tableExists($table)) continue;
                $config = $this->tier1Tables[$table];
                $cidType = $config['company_id_type'];
                $companyParam = ($cidType === 'uuid') ? $companyId : (string)$companyId;
                $this->db->query("DELETE FROM {$table} WHERE company_id = ?", [$companyParam]);
            }

            // Detect cross-company restore (source != target)
            $sourceCompanyId = $manifest['company']['id'] ?? null;
            $isCrossCompany = $sourceCompanyId && $sourceCompanyId !== $companyId;

            // Cross-company: build UUID remap dictionary to avoid PK conflicts
            // Source company's records still exist in DB, so we must remap all UUIDs
            $uuidRemap = [];
            $emailRemap = [];
            if ($isCrossCompany) {
                $uuidRemap[$sourceCompanyId] = $companyId;

                $allTables = array_merge(array_keys($this->tier1Tables), array_keys($this->tier2Tables));
                foreach ($allTables as $table) {
                    $jsonFile = $tempDir . "/data/{$table}.json";
                    if (!file_exists($jsonFile)) continue;

                    $rows = json_decode(file_get_contents($jsonFile), true);
                    if (empty($rows)) continue;

                    $uuidCols = $this->uuidColumnsMap[$table] ?? [];
                    $config = $this->tier1Tables[$table] ?? $this->tier2Tables[$table] ?? [];
                    $idType = $config['id_type'] ?? 'uuid';

                    foreach ($rows as $row) {
                        // Always remap 'id' column for UUID PK tables
                        if ($idType === 'uuid' && !in_array('id', $uuidCols)) {
                            $oldId = $row['id'] ?? null;
                            if ($oldId && !isset($uuidRemap[$oldId]) && $this->isUuid($oldId)) {
                                $uuidRemap[$oldId] = $this->db->generateUuid();
                            }
                        }

                        foreach ($uuidCols as $col) {
                            if ($col === 'company_id') continue;
                            $oldVal = $row[$col] ?? null;
                            if ($oldVal && !isset($uuidRemap[$oldVal]) && $this->isUuid($oldVal)) {
                                $uuidRemap[$oldVal] = $this->db->generateUuid();
                            }
                        }
                    }
                }

                // Handle user email conflicts for cross-company
                $usersJsonFile = $tempDir . "/data/users.json";
                if (file_exists($usersJsonFile)) {
                    $usersData = json_decode(file_get_contents($usersJsonFile), true);
                    if (!empty($usersData)) {
                        $emails = array_filter(array_column($usersData, 'email'));
                        if (!empty($emails)) {
                            $placeholders = implode(',', array_fill(0, count($emails), '?'));
                            $existingEmails = $this->db->fetchAll(
                                "SELECT email FROM users WHERE email IN ({$placeholders}) AND company_id != ?",
                                array_merge(array_values($emails), [$companyId])
                            );
                            $existingSet = array_column($existingEmails, 'email');
                            $suffix = substr(uniqid(), -6);
                            $emailRemap = [];
                            foreach ($existingSet as $email) {
                                $parts = explode('@', $email);
                                if (count($parts) === 2) {
                                    $emailRemap[$email] = $parts[0] . '+imp_' . $suffix . '@' . $parts[1];
                                }
                            }
                        }
                    }
                }
            }

            // INSERT Tier 1 in forward order
            $tablesImported = [];
            $importErrors = [];
            foreach ($this->tier1Tables as $table => $config) {
                $jsonFile = $tempDir . "/data/{$table}.json";
                if (!file_exists($jsonFile)) continue;

                $rows = json_decode(file_get_contents($jsonFile), true);
                if (empty($rows)) continue;

                if ($isCrossCompany) {
                    // Cross-company: apply email remap for users table
                    if ($table === 'users' && !empty($emailRemap)) {
                        foreach ($rows as &$row) {
                            $email = $row['email'] ?? null;
                            if ($email && isset($emailRemap[$email])) {
                                $row['email'] = $emailRemap[$email];
                            }
                        }
                        unset($row);
                    }

                    // Cross-company: remap UUIDs and company_id
                    $rows = $this->remapRows($table, $rows, $uuidRemap, $companyId, $config['company_id_type']);

                    // Rewrite file paths containing old company ID
                    foreach ($rows as &$row) {
                        foreach ($row as $col => &$val) {
                            if (is_string($val) && strpos($val, $sourceCompanyId) !== false) {
                                $val = str_replace($sourceCompanyId, $companyId, $val);
                            }
                        }
                        unset($val);
                    }
                    unset($row);
                } else {
                    // Same-company restore: just update company_id (should already match)
                    $cidType = $config['company_id_type'];
                    foreach ($rows as &$row) {
                        $row['company_id'] = ($cidType === 'uuid') ? $companyId : (string)$companyId;
                    }
                    unset($row);
                }

                $insertResult = $this->bulkInsert($table, $rows);
                $tablesImported[$table] = $insertResult['inserted'];
                if (!empty($insertResult['errors'])) {
                    $importErrors[$table] = $insertResult['errors'];
                }
            }

            // INSERT Tier 2 in forward order
            foreach ($this->tier2Tables as $table => $config) {
                $jsonFile = $tempDir . "/data/{$table}.json";
                if (!file_exists($jsonFile)) continue;

                $rows = json_decode(file_get_contents($jsonFile), true);
                if (empty($rows)) continue;

                if ($isCrossCompany) {
                    // Cross-company: remap UUIDs (no company_id in tier2)
                    $rows = $this->remapRows($table, $rows, $uuidRemap, $companyId, null);

                    // Rewrite file paths
                    foreach ($rows as &$row) {
                        foreach ($row as $col => &$val) {
                            if (is_string($val) && strpos($val, $sourceCompanyId) !== false) {
                                $val = str_replace($sourceCompanyId, $companyId, $val);
                            }
                        }
                        unset($val);
                    }
                    unset($row);
                }

                $insertResult = $this->bulkInsert($table, $rows);
                $tablesImported[$table] = $insertResult['inserted'];
                if (!empty($insertResult['errors'])) {
                    $importErrors[$table] = $insertResult['errors'];
                }
            }

            $this->db->commit();

            // Media files
            if ($includeMedia && is_dir($tempDir . '/media')) {
                $targetMediaDir = $storageBase . '/companies/' . $companyId;
                if (is_dir($targetMediaDir)) {
                    $this->removeDirectory($targetMediaDir);
                }
                @mkdir($targetMediaDir, 0755, true);
                $this->copyDirectory($tempDir . '/media', $targetMediaDir);
            }

            // Recalculate storage
            $this->recalculateStorage($companyId);

            // Cleanup
            $this->removeDirectory($tempDir);

            Logger::info('TenantBackupService: Import overwrite completed', [
                'company_id'    => $companyId,
                'cross_company' => $isCrossCompany,
                'tables'        => count($tablesImported),
                'total_rows'    => array_sum($tablesImported),
                'errors_count'  => count($importErrors),
            ]);

            return [
                'success'         => true,
                'mode'            => 'overwrite',
                'company_id'      => $companyId,
                'cross_company'   => $isCrossCompany,
                'tables_imported' => $tablesImported,
                'total_rows'      => array_sum($tablesImported),
                'errors'          => $importErrors,
            ];

        } catch (Exception $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            $this->removeDirectory($tempDir);

            Logger::error('TenantBackupService: Import overwrite failed', [
                'company_id' => $companyId,
                'error'      => $e->getMessage(),
            ]);

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // =========================================================================
    //  IMPORT — NEW COMPANY MODE
    // =========================================================================

    /**
     * Import archive data as a NEW company (UUID remap mode).
     * Creates a new company record and remaps all UUIDs.
     *
     * @param string $archivePath   Path to .tar.gz file
     * @param string $newCompanyName Display name for the new company
     * @param array  $options       ['include_media' => bool]
     * @return array
     */
    public function importAsNewCompany(string $archivePath, string $newCompanyName, array $options = []): array
    {
        $includeMedia = $options['include_media'] ?? true;

        $storageBase = defined('STORAGE_PATH') ? STORAGE_PATH : (dirname(__DIR__) . '/storage');
        $tempDir = $storageBase . '/backups/import_' . uniqid();

        try {
            if (!$this->extractTarGz($archivePath, $tempDir)) {
                throw new Exception('Failed to extract archive');
            }

            $manifest = $this->readManifest($tempDir);
            if (!$manifest) {
                throw new Exception('Invalid archive: manifest.json not found or invalid');
            }

            if (!$this->verifyChecksums($tempDir . '/data', $manifest['checksums'] ?? [])) {
                throw new Exception('Archive integrity check failed');
            }

            $oldCompanyId = $manifest['company']['id'] ?? null;
            if (!$oldCompanyId) {
                throw new Exception('Archive does not contain company ID');
            }

            // Set SuperAdmin context
            $this->db->setAppContext(null, null, 'SuperAdmin');

            // Create new company
            $newCompanyId = $this->db->generateUuid();
            $slug = $this->generateSlug($newCompanyName);

            $this->db->insert('companies', [
                'id'     => $newCompanyId,
                'name'   => $newCompanyName,
                'slug'   => $slug,
                'status' => 'active',
            ]);

            // Build UUID remap dictionary
            $uuidRemap = [$oldCompanyId => $newCompanyId];

            // First pass: scan all JSON files to collect old UUIDs and generate new ones
            $allTables = array_merge(array_keys($this->tier1Tables), array_keys($this->tier2Tables));
            foreach ($allTables as $table) {
                $jsonFile = $tempDir . "/data/{$table}.json";
                if (!file_exists($jsonFile)) continue;

                $rows = json_decode(file_get_contents($jsonFile), true);
                if (empty($rows)) continue;

                $uuidCols = $this->uuidColumnsMap[$table] ?? [];

                foreach ($rows as $row) {
                    // Always remap 'id' column for UUID PK tables
                    $config = $this->tier1Tables[$table] ?? $this->tier2Tables[$table] ?? [];
                    $idType = $config['id_type'] ?? 'uuid';
                    if ($idType === 'uuid' && !in_array('id', $uuidCols)) {
                        $oldId = $row['id'] ?? null;
                        if ($oldId && !isset($uuidRemap[$oldId]) && $this->isUuid($oldId)) {
                            $uuidRemap[$oldId] = $this->db->generateUuid();
                        }
                    }

                    foreach ($uuidCols as $col) {
                        if ($col === 'company_id') continue; // already mapped
                        $oldVal = $row[$col] ?? null;
                        if ($oldVal && !isset($uuidRemap[$oldVal]) && $this->isUuid($oldVal)) {
                            $uuidRemap[$oldVal] = $this->db->generateUuid();
                        }
                    }
                }
            }

            // Handle user email conflicts: check which emails already exist
            $emailRemap = [];
            $usersJsonFile = $tempDir . "/data/users.json";
            if (file_exists($usersJsonFile)) {
                $usersData = json_decode(file_get_contents($usersJsonFile), true);
                if (!empty($usersData)) {
                    $emails = array_filter(array_column($usersData, 'email'));
                    if (!empty($emails)) {
                        $placeholders = implode(',', array_fill(0, count($emails), '?'));
                        $existingEmails = $this->db->fetchAll(
                            "SELECT email FROM users WHERE email IN ({$placeholders})",
                            array_values($emails)
                        );
                        $existingSet = array_column($existingEmails, 'email');
                        $suffix = substr(uniqid(), -6);
                        foreach ($existingSet as $email) {
                            // user@example.com → user+imp_abc123@example.com
                            $parts = explode('@', $email);
                            if (count($parts) === 2) {
                                $emailRemap[$email] = $parts[0] . '+imp_' . $suffix . '@' . $parts[1];
                            }
                        }
                    }
                }
            }

            $this->db->beginTransaction();

            // INSERT Tier 1 (skip_on_new tables excluded)
            $tablesImported = [];
            $importErrors = [];
            foreach ($this->tier1Tables as $table => $config) {
                if (!empty($config['skip_on_new'])) continue;

                $jsonFile = $tempDir . "/data/{$table}.json";
                if (!file_exists($jsonFile)) continue;

                $rows = json_decode(file_get_contents($jsonFile), true);
                if (empty($rows)) continue;

                // Apply email remap for users table
                if ($table === 'users' && !empty($emailRemap)) {
                    foreach ($rows as &$row) {
                        $email = $row['email'] ?? null;
                        if ($email && isset($emailRemap[$email])) {
                            $row['email'] = $emailRemap[$email];
                        }
                    }
                    unset($row);
                }

                $remappedRows = $this->remapRows($table, $rows, $uuidRemap, $newCompanyId, $config['company_id_type']);

                // Rewrite file paths containing old company ID
                foreach ($remappedRows as &$row) {
                    foreach ($row as $col => &$val) {
                        if (is_string($val) && strpos($val, $oldCompanyId) !== false) {
                            $val = str_replace($oldCompanyId, $newCompanyId, $val);
                        }
                    }
                    unset($val);
                }
                unset($row);

                $insertResult = $this->bulkInsert($table, $remappedRows);
                $tablesImported[$table] = $insertResult['inserted'];
                if (!empty($insertResult['errors'])) {
                    $importErrors[$table] = $insertResult['errors'];
                }
            }

            // INSERT Tier 2
            foreach ($this->tier2Tables as $table => $config) {
                if (!empty($config['skip_on_new'])) continue;

                $jsonFile = $tempDir . "/data/{$table}.json";
                if (!file_exists($jsonFile)) continue;

                $rows = json_decode(file_get_contents($jsonFile), true);
                if (empty($rows)) continue;

                $remappedRows = $this->remapRows($table, $rows, $uuidRemap, $newCompanyId, null);

                // Rewrite file paths containing old company ID
                foreach ($remappedRows as &$row) {
                    foreach ($row as $col => &$val) {
                        if (is_string($val) && strpos($val, $oldCompanyId) !== false) {
                            $val = str_replace($oldCompanyId, $newCompanyId, $val);
                        }
                    }
                    unset($val);
                }
                unset($row);

                $insertResult = $this->bulkInsert($table, $remappedRows);
                $tablesImported[$table] = $insertResult['inserted'];
                if (!empty($insertResult['errors'])) {
                    $importErrors[$table] = $insertResult['errors'];
                }
            }

            $this->db->commit();

            // Media files
            if ($includeMedia && is_dir($tempDir . '/media')) {
                $targetMediaDir = $storageBase . '/companies/' . $newCompanyId;
                @mkdir($targetMediaDir, 0755, true);
                $this->copyDirectory($tempDir . '/media', $targetMediaDir);
            }

            // Create storage dirs and calculate usage
            $this->ensureCompanyDirs($newCompanyId);
            $this->recalculateStorage($newCompanyId);

            // Cleanup
            $this->removeDirectory($tempDir);

            Logger::info('TenantBackupService: Import as new company completed', [
                'new_company_id' => $newCompanyId,
                'new_name'       => $newCompanyName,
                'tables'         => count($tablesImported),
                'total_rows'     => array_sum($tablesImported),
                'errors_count'   => count($importErrors),
            ]);

            $result = [
                'success'         => true,
                'mode'            => 'new_company',
                'company_id'      => $newCompanyId,
                'company_name'    => $newCompanyName,
                'tables_imported' => $tablesImported,
                'total_rows'      => array_sum($tablesImported),
            ];

            if (!empty($emailRemap)) {
                $result['email_remaps'] = $emailRemap;
            }
            if (!empty($importErrors)) {
                $result['import_errors'] = $importErrors;
            }

            return $result;

        } catch (Exception $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            $this->removeDirectory($tempDir);

            Logger::error('TenantBackupService: Import as new company failed', [
                'error' => $e->getMessage(),
            ]);

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // =========================================================================
    //  SETTINGS
    // =========================================================================

    /**
     * Get backup settings (system-wide, SuperAdmin only).
     */
    public function getBackupSettings(): array
    {
        $defaults = [
            'enabled'                => false,
            'cycle'                  => 'daily',   // daily | weekly | monthly
            'retention_count'        => 7,
            'include_media_default'  => false,
            'last_cron_run'          => null,
        ];

        $row = $this->db->fetch(
            "SELECT data FROM settings WHERE id = ? AND company_id IS NULL AND user_id IS NULL",
            [self::SETTINGS_KEY]
        );

        if ($row && !empty($row['data'])) {
            $saved = json_decode($row['data'], true) ?: [];
            return array_merge($defaults, $saved);
        }

        return $defaults;
    }

    /**
     * Save backup settings.
     */
    public function saveBackupSettings(array $settings): bool
    {
        $existing = $this->db->fetch(
            "SELECT id FROM settings WHERE id = ? AND company_id IS NULL AND user_id IS NULL",
            [self::SETTINGS_KEY]
        );

        $data = json_encode($settings);

        if ($existing) {
            $this->db->update('settings', [
                'data'       => $data,
                'updated_at' => date('c'),
            ], "id = ? AND company_id IS NULL AND user_id IS NULL", [self::SETTINGS_KEY]);
        } else {
            $this->db->query(
                "INSERT INTO settings (id, company_id, user_id, data, created_at, updated_at) VALUES (?, NULL, NULL, ?, ?, ?)",
                [self::SETTINGS_KEY, $data, date('c'), date('c')]
            );
        }

        return true;
    }

    // =========================================================================
    //  LIST / STATUS / DELETE / RETENTION
    // =========================================================================

    /**
     * List backups. If companyId is null, list all (SuperAdmin).
     */
    public function listBackups(?string $companyId = null, int $limit = 50, int $offset = 0): array
    {
        if ($companyId) {
            $rows = $this->db->fetchAll(
                "SELECT tb.*, c.name as company_name
                 FROM tenant_backups tb
                 LEFT JOIN companies c ON c.id = tb.company_id
                 WHERE tb.company_id = ?
                 ORDER BY tb.created_at DESC
                 LIMIT ? OFFSET ?",
                [$companyId, $limit, $offset]
            );
            $total = $this->db->fetch(
                "SELECT COUNT(*) as cnt FROM tenant_backups WHERE company_id = ?",
                [$companyId]
            );
        } else {
            $rows = $this->db->fetchAll(
                "SELECT tb.*, c.name as company_name
                 FROM tenant_backups tb
                 LEFT JOIN companies c ON c.id = tb.company_id
                 ORDER BY tb.created_at DESC
                 LIMIT ? OFFSET ?",
                [$limit, $offset]
            );
            $total = $this->db->fetch("SELECT COUNT(*) as cnt FROM tenant_backups");
        }

        return [
            'items' => $rows,
            'total' => (int)($total['cnt'] ?? 0),
        ];
    }

    /**
     * Get backup status/details.
     */
    public function getBackupStatus(string $backupId): ?array
    {
        return $this->db->fetch(
            "SELECT tb.*, c.name as company_name
             FROM tenant_backups tb
             LEFT JOIN companies c ON c.id = tb.company_id
             WHERE tb.id = ?",
            [$backupId]
        );
    }

    /**
     * Delete a backup (file + DB record).
     */
    public function deleteBackup(string $backupId): bool
    {
        $backup = $this->db->fetch("SELECT file_path FROM tenant_backups WHERE id = ?", [$backupId]);
        if (!$backup) {
            return false;
        }

        // Delete file
        if (!empty($backup['file_path']) && file_exists($backup['file_path'])) {
            @unlink($backup['file_path']);
        }

        // Delete record
        $this->db->delete('tenant_backups', 'id = ?', [$backupId]);
        return true;
    }

    /**
     * Apply retention policy: keep only $retentionCount most recent backups per company.
     */
    public function applyRetention(string $companyId, int $retentionCount): int
    {
        $deleted = 0;
        $backups = $this->db->fetchAll(
            "SELECT id, file_path FROM tenant_backups
             WHERE company_id = ? AND status = 'completed'
             ORDER BY created_at DESC",
            [$companyId]
        );

        // Keep first $retentionCount, delete the rest
        $toDelete = array_slice($backups, $retentionCount);
        foreach ($toDelete as $backup) {
            if (!empty($backup['file_path']) && file_exists($backup['file_path'])) {
                @unlink($backup['file_path']);
            }
            $this->db->delete('tenant_backups', 'id = ?', [$backup['id']]);
            $deleted++;
        }

        return $deleted;
    }

    /**
     * Get summary stats for all companies.
     */
    public function getCompanyBackupSummary(): array
    {
        return $this->db->fetchAll(
            "SELECT
                c.id as company_id,
                c.name as company_name,
                c.status as company_status,
                (SELECT COUNT(*) FROM tenant_backups WHERE company_id = c.id) as backup_count,
                (SELECT MAX(created_at) FROM tenant_backups WHERE company_id = c.id) as last_backup_at,
                COALESCE((SELECT SUM(file_size) FROM tenant_backups WHERE company_id = c.id AND status = 'completed'), 0) as total_size,
                (SELECT status FROM tenant_backups WHERE company_id = c.id ORDER BY created_at DESC LIMIT 1) as last_status,
                (SELECT COUNT(*) FROM products WHERE company_id = c.id) as product_count,
                (SELECT COUNT(*) FROM devices WHERE company_id = c.id) as device_count,
                (SELECT COUNT(*) FROM templates WHERE company_id = c.id) as template_count
             FROM companies c
             WHERE c.status != 'deleted'
             ORDER BY c.name"
        );
    }

    // =========================================================================
    //  HELPERS — Archive
    // =========================================================================

    private function createTarGz(string $sourceDir, string $outputPath): bool
    {
        try {
            if (class_exists('PharData')) {
                $tarPath = str_replace('.tar.gz', '.tar', $outputPath);

                // Remove existing files
                if (file_exists($tarPath)) @unlink($tarPath);
                if (file_exists($outputPath)) @unlink($outputPath);

                $phar = new PharData($tarPath);
                $phar->buildFromDirectory($sourceDir);
                $phar->compress(Phar::GZ);

                // PharData creates .tar.gz but also leaves .tar
                if (file_exists($tarPath)) @unlink($tarPath);

                return file_exists($outputPath);
            }
        } catch (Exception $e) {
            Logger::warning('TenantBackupService: PharData failed, trying ZipArchive', [
                'error' => $e->getMessage()
            ]);
        }

        // Fallback: ZipArchive
        try {
            $zipPath = str_replace('.tar.gz', '.zip', $outputPath);
            $zip = new ZipArchive();
            if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) === true) {
                $this->addDirectoryToZip($zip, $sourceDir, '');
                $zip->close();

                // Rename to expected path (still .tar.gz name but actually zip)
                // Better: keep as .zip
                $outputPath = str_replace('.tar.gz', '.zip', $outputPath);
                return file_exists($zipPath);
            }
        } catch (Exception $e) {
            Logger::error('TenantBackupService: ZipArchive also failed', [
                'error' => $e->getMessage()
            ]);
        }

        return false;
    }

    private function extractTarGz(string $archivePath, string $targetDir): bool
    {
        @mkdir($targetDir, 0755, true);

        try {
            if (class_exists('PharData')) {
                $phar = new PharData($archivePath);
                $phar->decompress();

                $tarPath = str_replace('.tar.gz', '.tar', $archivePath);
                if (file_exists($tarPath)) {
                    $tar = new PharData($tarPath);
                    $tar->extractTo($targetDir);
                    @unlink($tarPath);
                } else {
                    $phar->extractTo($targetDir);
                }
                return true;
            }
        } catch (Exception $e) {
            Logger::warning('TenantBackupService: PharData extract failed', [
                'error' => $e->getMessage()
            ]);
        }

        // Fallback: try as zip
        try {
            $zip = new ZipArchive();
            if ($zip->open($archivePath) === true) {
                $zip->extractTo($targetDir);
                $zip->close();
                return true;
            }
        } catch (Exception $e) {
            Logger::error('TenantBackupService: ZipArchive extract also failed');
        }

        return false;
    }

    private function addDirectoryToZip(ZipArchive $zip, string $dir, string $prefix): void
    {
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($files as $file) {
            $filePath = $file->getRealPath();
            $relativePath = $prefix ? ($prefix . '/' . substr($filePath, strlen($dir) + 1)) : substr($filePath, strlen($dir) + 1);
            $relativePath = str_replace('\\', '/', $relativePath);
            $zip->addFile($filePath, $relativePath);
        }
    }

    // =========================================================================
    //  HELPERS — File Operations
    // =========================================================================

    private function writeJsonFile(string $path, $data): void
    {
        file_put_contents($path, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    private function readManifest(string $tempDir): ?array
    {
        $path = $tempDir . '/manifest.json';
        if (!file_exists($path)) return null;

        $data = json_decode(file_get_contents($path), true);
        if (!$data || !isset($data['version'])) return null;

        return $data;
    }

    private function computeChecksums(string $dataDir): array
    {
        $checksums = [];
        if (!is_dir($dataDir)) return $checksums;

        foreach (glob($dataDir . '/*.json') as $file) {
            $name = basename($file);
            $checksums[$name] = md5_file($file);
        }
        return $checksums;
    }

    private function verifyChecksums(string $dataDir, array $expectedChecksums): bool
    {
        foreach ($expectedChecksums as $filename => $expectedMd5) {
            $filePath = $dataDir . '/' . $filename;
            if (!file_exists($filePath)) return false;
            if (md5_file($filePath) !== $expectedMd5) return false;
        }
        return true;
    }

    private function copyDirectory(string $src, string $dst): int
    {
        $count = 0;
        if (!is_dir($src)) return $count;

        @mkdir($dst, 0755, true);

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($src, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $item) {
            $relative = substr($item->getPathname(), strlen($src) + 1);
            $target = $dst . '/' . str_replace('\\', '/', $relative);

            if ($item->isDir()) {
                @mkdir($target, 0755, true);
            } else {
                @copy($item->getPathname(), $target);
                $count++;
            }
        }

        return $count;
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) return;

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($iterator as $item) {
            if ($item->isDir()) {
                @rmdir($item->getPathname());
            } else {
                @unlink($item->getPathname());
            }
        }
        @rmdir($dir);
    }

    // =========================================================================
    //  HELPERS — Database Operations
    // =========================================================================

    /**
     * Bulk insert rows into a table.
     * Uses individual INSERT for safety (handles varying column sets).
     *
     * @return array ['inserted' => int, 'skipped' => int, 'errors' => array]
     */
    private function bulkInsert(string $table, array $rows): array
    {
        $result = ['inserted' => 0, 'skipped' => 0, 'errors' => []];
        if (empty($rows)) return $result;

        // Get column info from database (names + types) for filtering and sanitization
        $columnInfo = $this->getTableColumnInfo($table);
        $actualColumns = array_keys($columnInfo);

        // Classify columns by type for sanitization
        $textTypes = ['text', 'character varying', 'character', 'USER-DEFINED', 'ARRAY', 'json', 'jsonb'];
        $textCols = [];
        $booleanCols = [];
        $numericCols = [];
        foreach ($columnInfo as $col => $type) {
            if (in_array($type, $textTypes)) $textCols[] = $col;
            if ($type === 'boolean') $booleanCols[] = $col;
            if (in_array($type, ['integer', 'bigint', 'smallint', 'double precision', 'real', 'numeric'])) $numericCols[] = $col;
        }

        foreach ($rows as $row) {
            // Filter out null keys and ensure clean data
            $cleanRow = [];
            foreach ($row as $key => $value) {
                if ($key !== null && $key !== '') {
                    // Skip columns that don't exist in the current schema
                    if (!empty($actualColumns) && !in_array($key, $actualColumns)) {
                        continue;
                    }
                    $cleanRow[$key] = $value;
                }
            }

            if (empty($cleanRow)) {
                $result['skipped']++;
                continue;
            }

            // Sanitize values for PostgreSQL type compatibility
            // NOTE: PDO execute() binds all params as PDO::PARAM_STR by default.
            // PHP false → '' (empty string) which PostgreSQL rejects for boolean columns.
            // So we must use 't'/'f' string representations, not PHP true/false.
            foreach ($cleanRow as $col => &$val) {
                // Arrays/objects must be JSON-encoded for text/json columns
                if (is_array($val) || is_object($val)) {
                    $val = json_encode($val, JSON_UNESCAPED_UNICODE);
                }
                // Boolean columns: convert to PostgreSQL-safe 't'/'f' strings
                // Must be BEFORE the empty string check since false === '' after PDO stringify
                if (in_array($col, $booleanCols)) {
                    if ($val === null || $val === '') {
                        $val = null;
                    } elseif ($val === true || $val === 't' || $val === '1' || $val === 1 || $val === 'true') {
                        $val = 't';  // PostgreSQL accepts 't' for boolean
                    } else {
                        $val = 'f';  // PostgreSQL accepts 'f' for boolean
                    }
                    continue; // Skip further checks for boolean cols
                }
                if ($val === '') {
                    // Empty string is only valid for text-type columns.
                    // For numeric, uuid, timestamp, etc. it must be null.
                    if (!in_array($col, $textCols)) {
                        $val = null;
                    }
                }
            }
            unset($val);

            $columns = array_keys($cleanRow);
            $placeholders = array_fill(0, count($columns), '?');
            $quotedCols = array_map(fn($c) => "\"$c\"", $columns);

            $sql = "INSERT INTO {$table} (" . implode(', ', $quotedCols) . ") VALUES (" . implode(', ', $placeholders) . ") ON CONFLICT DO NOTHING";

            try {
                // Use SAVEPOINT to prevent single-row failure from aborting entire transaction
                $this->db->query("SAVEPOINT bulk_row");
                $stmt = $this->db->query($sql, array_values($cleanRow));
                $this->db->query("RELEASE SAVEPOINT bulk_row");

                if ($stmt->rowCount() > 0) {
                    $result['inserted']++;
                } else {
                    $result['skipped']++;
                    if (count($result['errors']) < 3) {
                        $result['errors'][] = [
                            'type' => 'conflict_skip',
                            'row_id' => $cleanRow['id'] ?? 'unknown',
                            'message' => 'Row skipped due to ON CONFLICT (unique constraint)',
                        ];
                    }
                }
            } catch (Exception $e) {
                // Rollback the savepoint to allow subsequent inserts to continue
                try {
                    $this->db->query("ROLLBACK TO SAVEPOINT bulk_row");
                } catch (Exception $ignored) {}

                $result['skipped']++;
                $errMsg = $e->getMessage();
                Logger::warning("TenantBackupService: Insert failed for {$table}", [
                    'error' => $errMsg,
                    'row_id' => $cleanRow['id'] ?? 'unknown',
                ]);
                if (count($result['errors']) < 5) {
                    $result['errors'][] = [
                        'type' => 'exception',
                        'row_id' => $cleanRow['id'] ?? 'unknown',
                        'message' => mb_substr($errMsg, 0, 200),
                    ];
                }
            }
        }

        return $result;
    }

    /**
     * Get column names and types for a table from information_schema.
     * Filters by our application schemas to avoid ambiguity in multi-schema setups.
     * @return array ['column_name' => 'data_type', ...]
     */
    private function getTableColumnInfo(string $table): array
    {
        static $cache = [];
        if (isset($cache[$table])) return $cache[$table];

        $appSchemas = ['core', 'license', 'catalog', 'branch', 'labels', 'media', 'devices', 'signage', 'integration', 'audit', 'legacy'];

        try {
            $placeholders = implode(',', array_fill(0, count($appSchemas), '?'));
            $rows = $this->db->fetchAll(
                "SELECT column_name, data_type FROM information_schema.columns
                 WHERE table_name = ? AND table_schema IN ({$placeholders})
                 ORDER BY ordinal_position",
                array_merge([$table], $appSchemas)
            );
            $cache[$table] = [];
            foreach ($rows as $row) {
                $cache[$table][$row['column_name']] = $row['data_type'];
            }
        } catch (Exception $e) {
            $cache[$table] = [];
        }

        return $cache[$table];
    }

    /**
     * Remap UUID columns in rows for "new company" import.
     */
    private function remapRows(string $table, array $rows, array &$uuidRemap, string $newCompanyId, ?string $companyIdType): array
    {
        $uuidCols = $this->uuidColumnsMap[$table] ?? [];
        $config = $this->tier1Tables[$table] ?? $this->tier2Tables[$table] ?? [];
        $idType = $config['id_type'] ?? 'uuid';
        $remapped = [];

        foreach ($rows as $row) {
            // Remap company_id if present
            if (isset($row['company_id']) && $companyIdType !== null) {
                $row['company_id'] = ($companyIdType === 'uuid') ? $newCompanyId : (string)$newCompanyId;
            }

            // Always remap 'id' for uuid PK tables (even if not in uuidColumnsMap)
            if ($idType === 'uuid' && isset($row['id']) && !in_array('id', $uuidCols)) {
                $oldId = $row['id'];
                if ($this->isUuid($oldId) && isset($uuidRemap[$oldId])) {
                    $row['id'] = $uuidRemap[$oldId];
                }
            }

            // Remap UUID columns from the explicit map
            foreach ($uuidCols as $col) {
                if ($col === 'company_id') continue; // already handled
                $oldVal = $row[$col] ?? null;
                if ($oldVal && isset($uuidRemap[$oldVal])) {
                    $row[$col] = $uuidRemap[$oldVal];
                }
            }

            // For user-reference FK columns pointing to non-existing users (e.g. SuperAdmin
            // who created records but isn't in the company backup), null them out.
            // Also null FK columns for other records not in the backup.
            $nullableRefCols = [
                'user_id', 'created_by', 'updated_by', 'deleted_by', 'changed_by',
                'granted_by', 'assigned_by', 'uploaded_by', 'approved_by',
                'current_template_id', 'parent_template_id',
            ];
            foreach ($nullableRefCols as $col) {
                if (!isset($row[$col]) || !$row[$col]) continue;
                $oldVal = $row[$col];
                if (!$this->isUuid($oldVal)) continue;

                // If this UUID is NOT in the remap keys → record isn't in the backup → null it
                if (!isset($uuidRemap[$oldVal])) {
                    $row[$col] = null;
                }
                // If it IS in the remap keys, the earlier remap code already replaced it
            }

            $remapped[] = $row;
        }

        return $remapped;
    }

    private function isUuid(string $value): bool
    {
        return (bool)preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value);
    }

    private function updateProgress(string $backupId, int $progress): void
    {
        $this->db->update('tenant_backups', ['progress' => $progress], 'id = ?', [$backupId]);
    }

    private function generateSlug(string $name): string
    {
        $slug = mb_strtolower($name);
        $slug = preg_replace('/[^a-z0-9\s-]/', '', $slug);
        $slug = preg_replace('/[\s-]+/', '-', $slug);
        $slug = trim($slug, '-');
        return $slug ?: 'imported-' . substr(uniqid(), -6);
    }

    private function ensureCompanyDirs(string $companyId): void
    {
        $storageBase = defined('STORAGE_PATH') ? STORAGE_PATH : (dirname(__DIR__) . '/storage');
        $dirs = ['media', 'avatars', 'templates', 'exports', 'logs'];
        foreach ($dirs as $dir) {
            $path = $storageBase . '/companies/' . $companyId . '/' . $dir;
            if (!is_dir($path)) {
                @mkdir($path, 0755, true);
            }
        }
    }

    private function recalculateStorage(string $companyId): void
    {
        $storageBase = defined('STORAGE_PATH') ? STORAGE_PATH : (dirname(__DIR__) . '/storage');
        $companyDir = $storageBase . '/companies/' . $companyId;
        $totalBytes = 0;

        if (is_dir($companyDir)) {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($companyDir, RecursiveDirectoryIterator::SKIP_DOTS)
            );
            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $totalBytes += $file->getSize();
                }
            }
        }

        // Upsert company_storage_usage
        $existing = $this->db->fetch(
            "SELECT id FROM company_storage_usage WHERE company_id = ?",
            [$companyId]
        );

        if ($existing) {
            $this->db->update('company_storage_usage', [
                'total_bytes'        => $totalBytes,
                'last_calculated_at' => date('c'),
                'updated_at'         => date('c'),
            ], 'company_id = ?', [$companyId]);
        } else {
            $this->db->insert('company_storage_usage', [
                'company_id'         => $companyId,
                'total_bytes'        => $totalBytes,
                'last_calculated_at' => date('c'),
            ]);
        }
    }

    /**
     * Check if cron should run based on cycle settings.
     *
     * @return bool
     */
    public function shouldCronRun(): bool
    {
        $settings = $this->getBackupSettings();
        if (!($settings['enabled'] ?? false)) {
            return false;
        }

        $lastRun = $settings['last_cron_run'] ?? null;
        if (!$lastRun) {
            return true; // never ran
        }

        $lastRunTime = strtotime($lastRun);
        $now = time();
        $cycle = $settings['cycle'] ?? 'daily';

        $intervals = [
            'daily'   => 86400,      // 24h
            'weekly'  => 604800,     // 7d
            'monthly' => 2592000,    // 30d
        ];

        $interval = $intervals[$cycle] ?? 86400;
        return ($now - $lastRunTime) >= $interval;
    }
}
