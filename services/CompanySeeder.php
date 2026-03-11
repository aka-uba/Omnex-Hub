<?php
/**
 * CompanySeeder Service
 *
 * Automatically seeds default data when a new company is created.
 * Includes categories, production types, settings, layout config, and system template copies.
 *
 * @package Omnex Display Hub
 * @version 2.0.12
 */

class CompanySeeder
{
    private $db;
    private $companyId;

    /**
     * Constructor
     *
     * @param string $companyId The company ID to seed data for
     */
    public function __construct(string $companyId)
    {
        $this->db = Database::getInstance();
        $this->companyId = $companyId;
    }

    /**
     * Seed all default data for a new company
     *
     * @return array Results summary
     */
    public function seedAll(): array
    {
        $results = [
            'categories' => $this->seedCategories(),
            'production_types' => $this->seedProductionTypes(),
            'settings' => $this->seedDefaultSettings(),
            'layout_config' => $this->seedLayoutConfig(),
            'templates' => $this->seedTemplates(),
        ];

        // Log the seeding action
        if (class_exists('Logger')) {
            Logger::audit('seed', 'company', [
                'company_id' => $this->companyId,
                'results' => $results
            ]);
        }

        return $results;
    }

    /**
     * Seed default categories
     *
     * @return array ['created' => int, 'skipped' => int]
     */
    public function seedCategories(): array
    {
        $categories = [
            ['name' => 'Meyve-Sebze', 'slug' => 'meyve-sebze', 'color' => '#4CAF50', 'icon' => 'ti-apple'],
            ['name' => 'Et-Tavuk-Balık', 'slug' => 'et-tavuk-balik', 'color' => '#F44336', 'icon' => 'ti-meat'],
            ['name' => 'Süt Ürünleri', 'slug' => 'sut-urunleri', 'color' => '#2196F3', 'icon' => 'ti-droplet'],
            ['name' => 'Temel Gıda', 'slug' => 'temel-gida', 'color' => '#FF9800', 'icon' => 'ti-bread'],
            ['name' => 'İçecekler', 'slug' => 'icecekler', 'color' => '#9C27B0', 'icon' => 'ti-bottle'],
            ['name' => 'Atıştırmalıklar', 'slug' => 'atistirmaliklar', 'color' => '#795548', 'icon' => 'ti-cookie'],
            ['name' => 'Temizlik', 'slug' => 'temizlik', 'color' => '#00BCD4', 'icon' => 'ti-spray'],
            ['name' => 'Kişisel Bakım', 'slug' => 'kisisel-bakim', 'color' => '#E91E63', 'icon' => 'ti-user'],
        ];

        $created = 0;
        $skipped = 0;

        foreach ($categories as $cat) {
            $existing = $this->db->fetch(
                "SELECT 1 FROM categories WHERE company_id = ? AND slug = ?",
                [$this->companyId, $cat['slug']]
            );

            if (!$existing) {
                $this->db->insert('categories', [
                    'id' => $this->db->generateUuid(),
                    'company_id' => $this->companyId,
                    'name' => $cat['name'],
                    'slug' => $cat['slug'],
                    'color' => $cat['color'],
                    'icon' => $cat['icon'] ?? null,
                    'status' => 'active',
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
                $created++;
            } else {
                $skipped++;
            }
        }

        return ['created' => $created, 'skipped' => $skipped];
    }

    /**
     * Seed default production types
     *
     * @return array ['created' => int, 'skipped' => int]
     */
    public function seedProductionTypes(): array
    {
        $types = [
            ['name' => 'Konvansiyonel', 'slug' => 'konvansiyonel', 'color' => '#9E9E9E', 'description' => 'Standart tarım yöntemi ile üretilmiş'],
            ['name' => 'Organik', 'slug' => 'organik', 'color' => '#4CAF50', 'description' => 'Organik sertifikalı ürün'],
            ['name' => 'Naturel', 'slug' => 'naturel', 'color' => '#8BC34A', 'description' => 'Doğal yöntemlerle üretilmiş'],
            ['name' => 'İyi Tarım', 'slug' => 'iyi-tarim', 'color' => '#CDDC39', 'description' => 'İyi tarım uygulamaları sertifikalı'],
            ['name' => 'Geleneksel', 'slug' => 'geleneksel', 'color' => '#795548', 'description' => 'Geleneksel yöntemlerle üretilmiş'],
        ];

        $created = 0;
        $skipped = 0;

        foreach ($types as $type) {
            $existing = $this->db->fetch(
                "SELECT 1 FROM production_types WHERE company_id = ? AND slug = ?",
                [$this->companyId, $type['slug']]
            );

            if (!$existing) {
                $this->db->insert('production_types', [
                    'id' => $this->db->generateUuid(),
                    'company_id' => $this->companyId,
                    'name' => $type['name'],
                    'slug' => $type['slug'],
                    'color' => $type['color'],
                    'description' => $type['description'] ?? null,
                    'status' => 'active',
                    'sort_order' => 0,
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
                $created++;
            } else {
                $skipped++;
            }
        }

        return ['created' => $created, 'skipped' => $skipped];
    }

    /**
     * Seed default company settings
     *
     * @return array ['created' => bool, 'skipped' => bool]
     */
    public function seedDefaultSettings(): array
    {
        $existing = $this->db->fetch(
            "SELECT 1 FROM settings WHERE company_id = ? AND user_id IS NULL",
            [$this->companyId]
        );

        if (!$existing) {
            $this->db->insert('settings', [
                'id' => $this->db->generateUuid(),
                'company_id' => $this->companyId,
                'user_id' => null,
                'data' => json_encode([
                    'language' => 'tr',
                    'timezone' => 'Europe/Istanbul',
                    'date_format' => 'DD.MM.YYYY',
                    'time_format' => 'HH:mm',
                    'currency' => 'TRY',
                    'currency_symbol' => '₺',
                    'currency_position' => 'after', // after: "10 ₺", before: "₺ 10"
                    'decimal_separator' => ',',
                    'thousand_separator' => '.',
                    'gateway_enabled' => true,
                    'notify_email' => true,
                    'notify_browser' => true,
                    'weighing_flag_code' => '27',
                    'weighing_barcode_format' => 'CODE128'
                ]),
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ]);
            return ['created' => true, 'skipped' => false];
        }

        return ['created' => false, 'skipped' => true];
    }

    /**
     * Seed default layout configuration
     *
     * @return array ['created' => bool, 'skipped' => bool]
     */
    public function seedLayoutConfig(): array
    {
        $existing = $this->db->fetch(
            "SELECT 1 FROM layout_configs WHERE scope = 'company' AND scope_id = ?",
            [$this->companyId]
        );

        if (!$existing) {
            $this->db->insert('layout_configs', [
                'id' => $this->db->generateUuid(),
                'scope' => 'company',
                'scope_id' => $this->companyId,
                'config' => json_encode([
                    'themeMode' => 'light',
                    'direction' => 'ltr',
                    'language' => 'tr',
                    'sidebar' => [
                        'collapsed' => false,
                        'position' => 'left'
                    ],
                    'header' => [
                        'fixed' => true,
                        'showSearch' => true,
                        'showNotifications' => true
                    ],
                    'content' => [
                        'fullWidth' => false,
                        'maxWidth' => '1400px'
                    ]
                ]),
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ]);
            return ['created' => true, 'skipped' => false];
        }

        return ['created' => false, 'skipped' => true];
    }

    /**
     * Copy system templates to company as company-specific templates
     * This allows the company to have their own editable copies
     *
     * @return array ['created' => int, 'skipped' => int]
     */
    public function seedTemplates(): array
    {
        // Get system templates that are active
        $systemTemplates = $this->db->fetchAll(
            "SELECT * FROM templates WHERE (scope = 'system' OR company_id IS NULL) AND status = 'active'"
        );

        $created = 0;
        $skipped = 0;

        foreach ($systemTemplates as $template) {
            // Check if company already has a template with this name
            $existing = $this->db->fetch(
                "SELECT 1 FROM templates WHERE company_id = ? AND name = ?",
                [$this->companyId, $template['name']]
            );

            if (!$existing) {
                $newId = $this->db->generateUuid();
                $this->db->insert('templates', [
                    'id' => $newId,
                    'company_id' => $this->companyId,
                    'name' => $template['name'],
                    'description' => $template['description'],
                    'type' => $template['type'],
                    'category' => $template['category'],
                    'width' => $template['width'],
                    'height' => $template['height'],
                    'orientation' => $template['orientation'],
                    'design_data' => $template['design_data'],
                    'preview_image' => $template['preview_image'],
                    'render_image' => $template['render_image'],
                    'device_types' => $template['device_types'],
                    'target_device_type' => $template['target_device_type'],
                    'grid_layout' => $template['grid_layout'],
                    'regions_config' => $template['regions_config'],
                    'layout_type' => $template['layout_type'],
                    'template_file' => $template['template_file'],
                    'slots' => $template['slots'],
                    'version' => 1,
                    'parent_id' => $template['id'], // Link to original system template
                    'scope' => 'company',
                    'is_forked' => true,
                    'is_default' => false,
                    'is_public' => false,
                    'status' => 'active',
                    'created_by' => null, // System created
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
                $created++;
            } else {
                $skipped++;
            }
        }

        return ['created' => $created, 'skipped' => $skipped];
    }

    /**
     * Create storage directories for the company
     *
     * @return array ['created' => array, 'existing' => array, 'failed' => array]
     */
    public function createStorageDirectories(): array
    {
        $basePath = defined('STORAGE_PATH') ? STORAGE_PATH : dirname(__DIR__) . '/storage';

        $directories = [
            $basePath . '/companies/' . $this->companyId,
            $basePath . '/companies/' . $this->companyId . '/media',
            $basePath . '/companies/' . $this->companyId . '/media/' . date('Y'),
            $basePath . '/companies/' . $this->companyId . '/media/' . date('Y/m'),
            $basePath . '/companies/' . $this->companyId . '/renders',
            $basePath . '/companies/' . $this->companyId . '/exports',
            $basePath . '/companies/' . $this->companyId . '/imports',
            $basePath . '/companies/' . $this->companyId . '/imports/processed',
            $basePath . '/companies/' . $this->companyId . '/imports/failed',
            $basePath . '/companies/' . $this->companyId . '/temp',
        ];

        $created = [];
        $existing = [];
        $failed = [];

        foreach ($directories as $dir) {
            if (is_dir($dir)) {
                $existing[] = $dir;
            } else {
                if (@mkdir($dir, 0755, true)) {
                    $created[] = $dir;
                } else {
                    $failed[] = $dir;
                }
            }
        }

        return [
            'created' => $created,
            'existing' => $existing,
            'failed' => $failed
        ];
    }

    /**
     * Seed everything including storage directories and public media library
     *
     * @return array Complete results including storage
     */
    public function seedAllWithStorage(): array
    {
        $results = $this->seedAll();
        $results['storage'] = $this->createStorageDirectories();
        $results['public_media'] = $this->seedPublicMedia();
        return $results;
    }

    /**
     * Scan and import public media library (storage/public/samples) into database.
     * This is a global operation - public media is shared across all companies.
     * Files are only imported once (skipped if already in database).
     *
     * @return array ['imported' => int, 'skipped' => int, 'errors' => int]
     */
    public function seedPublicMedia(): array
    {
        $storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : dirname(__DIR__) . '/storage';
        $publicSamplesPath = $storagePath . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'samples';
        $publicMediaExpr = $this->db->isPostgres() ? 'is_public IS TRUE' : 'is_public = 1';

        // Normalize path
        $publicSamplesPath = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $publicSamplesPath);

        if (!is_dir($publicSamplesPath)) {
            return ['imported' => 0, 'skipped' => 0, 'errors' => 0, 'message' => 'Public samples directory not found'];
        }

        // Check if already scanned (has any public media in database)
        $existingCount = $this->db->fetch(
            "SELECT COUNT(*) as count FROM media WHERE $publicMediaExpr AND scope = 'public'"
        );
        if (($existingCount['count'] ?? 0) > 0) {
            return ['imported' => 0, 'skipped' => (int)$existingCount['count'], 'errors' => 0, 'message' => 'Already imported'];
        }

        // Allowed extensions
        $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
        $videoExtensions = ['mp4', 'webm', 'avi', 'mov', 'mkv'];
        $documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
        $allExtensions = array_merge($imageExtensions, $videoExtensions, $documentExtensions);

        // Recursively scan directory
        $files = [];
        $this->scanDirectory($publicSamplesPath, $files, $allExtensions);

        if (empty($files)) {
            return ['imported' => 0, 'skipped' => 0, 'errors' => 0, 'message' => 'No files found'];
        }

        // Create parent "Ortak Kütüphane" folder
        $parentFolderId = null;
        $publicFolder = $this->db->fetch(
            "SELECT id FROM media_folders WHERE path = ? AND company_id IS NULL",
            [$publicSamplesPath]
        );

        if (!$publicFolder) {
            $parentFolderId = $this->db->generateUuid();
            try {
                $this->db->insert('media_folders', [
                    'id' => $parentFolderId,
                    'company_id' => null,
                    'parent_id' => null,
                    'name' => 'Ortak Kütüphane',
                    'path' => $publicSamplesPath,
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
            } catch (Exception $e) {
                $publicFolder = $this->db->fetch(
                    "SELECT id FROM media_folders WHERE path = ? AND company_id IS NULL",
                    [$publicSamplesPath]
                );
                if ($publicFolder) {
                    $parentFolderId = $publicFolder['id'];
                }
            }
        } else {
            $parentFolderId = $publicFolder['id'];
        }

        $imported = 0;
        $skipped = 0;
        $errorCount = 0;
        $subfolderCache = []; // Cache subfolder IDs

        foreach ($files as $file) {
            try {
                // Check if already exists
                $existing = $this->db->fetch(
                    "SELECT id FROM media WHERE file_path = ? AND (company_id IS NULL OR $publicMediaExpr)",
                    [$file['path']]
                );

                if ($existing) {
                    $skipped++;
                    continue;
                }

                // Determine type
                $type = 'document';
                if (in_array($file['extension'], $imageExtensions)) {
                    $type = 'image';
                } elseif (in_array($file['extension'], $videoExtensions)) {
                    $type = 'video';
                }

                // Get mime type
                $mimeType = @mime_content_type($file['path']) ?: 'application/octet-stream';

                // Determine folder
                $folderId = $parentFolderId;
                $relativePath = substr($file['path'], strlen($publicSamplesPath) + 1);
                $pathParts = explode(DIRECTORY_SEPARATOR, $relativePath);

                if (count($pathParts) > 1) {
                    $subfolderName = $pathParts[0];

                    if (isset($subfolderCache[$subfolderName])) {
                        $folderId = $subfolderCache[$subfolderName];
                    } else {
                        $subfolderPath = $publicSamplesPath . DIRECTORY_SEPARATOR . $subfolderName;
                        $subfolder = $this->db->fetch(
                            "SELECT id FROM media_folders WHERE path = ? AND company_id IS NULL",
                            [$subfolderPath]
                        );

                        if (!$subfolder) {
                            $folderId = $this->db->generateUuid();
                            try {
                                $this->db->insert('media_folders', [
                                    'id' => $folderId,
                                    'company_id' => null,
                                    'parent_id' => $parentFolderId,
                                    'name' => $subfolderName,
                                    'path' => $subfolderPath,
                                    'created_at' => date('Y-m-d H:i:s'),
                                    'updated_at' => date('Y-m-d H:i:s')
                                ]);
                            } catch (Exception $e) {
                                $subfolder = $this->db->fetch(
                                    "SELECT id FROM media_folders WHERE path = ? AND company_id IS NULL",
                                    [$subfolderPath]
                                );
                                if ($subfolder) {
                                    $folderId = $subfolder['id'];
                                }
                            }
                        } else {
                            $folderId = $subfolder['id'];
                        }
                        $subfolderCache[$subfolderName] = $folderId;
                    }
                }

                // Insert media record
                $this->db->insert('media', [
                    'id' => $this->db->generateUuid(),
                    'company_id' => null,
                    'name' => pathinfo($file['name'], PATHINFO_FILENAME),
                    'original_name' => $file['name'],
                    'file_path' => $file['path'],
                    'file_type' => $type,
                    'mime_type' => $mimeType,
                    'file_size' => $file['size'],
                    'folder_id' => $folderId,
                    'is_public' => true,
                    'scope' => 'public',
                    'source' => 'seed',
                    'status' => 'active',
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);

                $imported++;
            } catch (Exception $e) {
                $errorCount++;
            }
        }

        return ['imported' => $imported, 'skipped' => $skipped, 'errors' => $errorCount];
    }

    /**
     * Recursively scan a directory for media files
     *
     * @param string $dir Directory to scan
     * @param array &$files Found files array (passed by reference)
     * @param array $allowedExtensions Allowed file extensions
     */
    private function scanDirectory(string $dir, array &$files, array $allowedExtensions): void
    {
        $items = @scandir($dir);
        if ($items === false) return;

        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;

            $fullPath = $dir . DIRECTORY_SEPARATOR . $item;

            if (is_dir($fullPath)) {
                $this->scanDirectory($fullPath, $files, $allowedExtensions);
            } else {
                $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
                if (in_array($ext, $allowedExtensions)) {
                    $files[] = [
                        'name' => $item,
                        'path' => $fullPath,
                        'extension' => $ext,
                        'size' => @filesize($fullPath) ?: 0
                    ];
                }
            }
        }
    }

    /**
     * Seed everything including demo products
     *
     * @param string $locale Locale code for demo data (default: 'tr')
     * @param int $productLimit Maximum number of demo products (0 = all)
     * @return array Complete results including demo data
     */
    public function seedAllWithDemoProducts(string $locale = 'tr', int $productLimit = 0): array
    {
        // First seed basic company data
        $results = $this->seedAllWithStorage();

        // Then seed demo products
        require_once dirname(__FILE__) . '/DemoProductSeeder.php';
        $demoSeeder = new DemoProductSeeder($this->companyId, $locale);

        if ($productLimit > 0) {
            $demoResults = $demoSeeder->seedQuickDemo($productLimit);
        } else {
            $demoResults = $demoSeeder->seedAll();
        }

        $results['demo_categories'] = $demoResults['categories'];
        $results['demo_production_types'] = $demoResults['production_types'];
        $results['demo_products'] = $demoResults['products'];

        return $results;
    }

    /**
     * Get seeding summary as a human-readable string
     *
     * @param array $results Results from seedAll() or seedAllWithStorage()
     * @return string Summary message
     */
    public static function getSummary(array $results): string
    {
        $parts = [];

        if (isset($results['categories'])) {
            $parts[] = "Categories: {$results['categories']['created']} created, {$results['categories']['skipped']} skipped";
        }

        if (isset($results['production_types'])) {
            $parts[] = "Production Types: {$results['production_types']['created']} created, {$results['production_types']['skipped']} skipped";
        }

        if (isset($results['settings'])) {
            $status = $results['settings']['created'] ? 'created' : 'already exists';
            $parts[] = "Settings: $status";
        }

        if (isset($results['layout_config'])) {
            $status = $results['layout_config']['created'] ? 'created' : 'already exists';
            $parts[] = "Layout Config: $status";
        }

        if (isset($results['templates'])) {
            $parts[] = "Templates: {$results['templates']['created']} copied, {$results['templates']['skipped']} skipped";
        }

        if (isset($results['storage'])) {
            $created = count($results['storage']['created']);
            $existing = count($results['storage']['existing']);
            $failed = count($results['storage']['failed']);
            $parts[] = "Storage: $created created, $existing existing, $failed failed";
        }

        if (isset($results['public_media'])) {
            $imported = $results['public_media']['imported'] ?? 0;
            $skipped = $results['public_media']['skipped'] ?? 0;
            $errors = $results['public_media']['errors'] ?? 0;
            if ($imported > 0 || $skipped > 0) {
                $parts[] = "Public Library: $imported imported, $skipped skipped" . ($errors > 0 ? ", $errors errors" : "");
            }
        }

        if (isset($results['demo_categories'])) {
            $parts[] = "Demo Categories: {$results['demo_categories']['created']} created, {$results['demo_categories']['skipped']} skipped";
        }

        if (isset($results['demo_production_types'])) {
            $parts[] = "Demo Production Types: {$results['demo_production_types']['created']} created, {$results['demo_production_types']['skipped']} skipped";
        }

        if (isset($results['demo_products'])) {
            $parts[] = "Demo Products: {$results['demo_products']['created']} created, {$results['demo_products']['skipped']} skipped";
            if ($results['demo_products']['errors'] > 0) {
                $parts[] = "  Errors: {$results['demo_products']['errors']}";
            }
        }

        return implode("\n", $parts);
    }
}
