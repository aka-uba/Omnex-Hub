<?php
/**
 * SmartFieldMapper - Intelligent Field Mapping Service
 *
 * Automatically detects and maps source fields to target fields
 * using fuzzy matching, aliases, and heuristics
 *
 * @package OmnexDisplayHub
 */

class SmartFieldMapper
{
    /**
     * Target field definitions with aliases
     * Key: target field name
     * Value: array of possible source field names (case-insensitive)
     */
    private static array $fieldAliases = [
        'sku' => [
            // Exact DB field name (JSON export)
            'sku',
            // Turkish variants
            'kod', 'code', 'stok_kodu', 'stok kodu', 'stokkodu',
            'urun_kodu', 'ürün kodu', 'ürün_kodu', 'product_code',
            'item_code', 'article_code', 'ref', 'referans',
            // Export başlıkları
            'STOK_KODU'
        ],
        'name' => [
            // Exact DB field name (JSON export)
            'name',
            // Turkish variants
            'adı', 'adi', 'ad', 'urun_adi', 'ürün adı', 'ürün_adı',
            'urun adi', 'product_name', 'productname', 'title', 'baslik',
            'başlık',
            // Export başlıkları
            'URUN_ADI'
        ],
        'barcode' => [
            // Exact DB field name (JSON export)
            'barcode',
            // Turkish variants
            'barkod', 'ean', 'ean13', 'upc', 'gtin',
            'barkod_no', 'barkodno', 'bar_code', 'barcodeno',
            // Export başlıkları
            'BARKOD'
        ],
        'current_price' => [
            // Exact DB field name (JSON export)
            'current_price',
            // Turkish variants
            'fiyat', 'price', 'satis_fiyati', 'satış fiyatı', 'satış_fiyatı',
            'satis fiyati', 'tutar', 'amount', 'birim_fiyat', 'birim fiyat',
            'perakende', 'perakende_fiyat', 'perakende fiyat', 'retail_price',
            'unit_price', 'liste_fiyati', 'liste fiyatı',
            // Export başlıkları
            'SATIS_FIYATI'
        ],
        'previous_price' => [
            // Exact DB field name (JSON export)
            'previous_price',
            // Turkish variants
            'eski_fiyat', 'eski fiyat', 'eskifiyat', 'old_price', 'oldprice',
            'onceki_fiyat', 'önceki fiyat', 'önceki_fiyat', 'original_price',
            'liste_fiyati',
            // Export başlıkları
            'ESKI_FIYAT'
        ],
        'campaign_price' => [
            // Exact DB field name (JSON export)
            'campaign_price',
            // Turkish variants
            'kampanyalı fiyat', 'kampanyali fiyat', 'kampanyali_fiyat', 'promo_price',
            'indirimli_fiyat', 'indirimli fiyat', 'sale_price', 'promosyon fiyatı',
            'promosyon_fiyati', 'indirimli satis fiyati',
            // Export başlıkları
            'KAMPANYA_FIYATI'
        ],
        'unit' => [
            // Exact DB field name (JSON export)
            'unit',
            // Turkish variants
            'birim', 'olcu', 'ölçü', 'olcu_birimi', 'ölçü birimi',
            'uom', 'unit_of_measure', 'satış birimi', 'satis_birimi',
            // Export başlıkları
            'BIRIM'
        ],
        'category' => [
            // Exact DB field name (JSON export)
            'category',
            // Turkish variants
            'kategori', 'cat', 'department', 'bolum', 'bölüm',
            // Export başlıkları
            'KATEGORI'
        ],
        'subcategory' => [
            // Exact DB field name (JSON export)
            'subcategory',
            // Turkish variants
            'alt_kategori', 'alt kategori', 'altkategori',
            'subcat', 'sub_group', 'alt_grup', 'alt grup',
            // Export başlıkları
            'ALT_KATEGORI'
        ],
        'brand' => [
            // Exact DB field name (JSON export)
            'brand',
            // Turkish variants
            'marka', 'uretici', 'üretici', 'manufacturer',
            'brand_name', 'markaadi', 'marka_adi',
            // Export başlıkları
            'MARKA'
        ],
        'origin' => [
            // Exact DB field name (JSON export)
            'origin',
            // Turkish variants
            'menşei', 'mensei', 'country', 'ulke', 'ülke',
            'mense', 'kaynak', 'source_country', 'coo',
            // Export başlıkları
            'MENSEI'
        ],
        'stock' => [
            // Exact DB field name (JSON export)
            'stock',
            // Turkish variants
            'stok', 'miktar', 'quantity', 'qty', 'adet',
            'eldeki_miktar', 'eldeki miktar', 'kalan', 'available',
            // Export başlıkları
            'STOK'
        ],
        'vat_rate' => [
            // Exact DB field name (JSON export)
            'vat_rate',
            // Turkish variants
            'kdv', 'kdv_orani', 'kdv oranı', 'vat', 'tax', 'vergi',
            'tax_rate', 'perakende_kdv', 'perakende kdv', 'toptan_kdv',
            // Export başlıkları
            'KDV_ORANI'
        ],
        'kunye_no' => [
            // Exact DB field name (JSON export)
            'kunye_no',
            // Turkish variants
            'künye numarası', 'kunye_numarasi', 'künye_numarası',
            'kunye no', 'kunyeno', 'tanitim_no', 'tanıtım no', 'label_id',
            'esl_id', 'etiket_no',
            // Export başlıkları
            'KUNYE_NO'
        ],
        'weight' => [
            // Exact DB field name (JSON export)
            'weight',
            // Turkish variants
            'agirlik', 'ağırlık', 'kilo', 'kg', 'gram',
            'net_agirlik', 'net ağırlık', 'gross_weight',
            // Export başlıkları
            'AGIRLIK'
        ],
        'description' => [
            // Exact DB field name (JSON export)
            'description',
            // Turkish variants
            'detay', 'details', 'note', 'not', 'notlar', 'notes',
            'ek_bilgi', 'ek bilgi', 'info', 'bilgi', 'aciklama', 'açıklama',
            'tanim', 'tanım',
            // Export başlıkları
            'ACIKLAMA'
        ],
        'image_url' => [
            // Exact DB field name (JSON export)
            'image_url',
            // Turkish variants
            'resim', 'image', 'img', 'photo', 'gorsel', 'görsel',
            'picture', 'foto', 'fotoğraf', 'imageurl',
            // Export başlıkları
            'RESIM'
        ],
        'discount_percent' => [
            // Exact DB field name (JSON export)
            'discount_percent',
            // Turkish variants
            'iskonto oranı', 'iskonto_orani', 'indirim_orani', 'indirim oranı',
            'discount', 'iskonto yüzdesi',
            // Export başlıkları
            'INDIRIM_ORANI'
        ],
        'campaign_text' => [
            // Exact DB field name (JSON export)
            'campaign_text',
            // Turkish variants
            'iskonto', 'indirim', 'kampanya', 'promosyon', 'promo',
            'campaign', 'indirimli', 'kampanyalı mı',
            // Export başlıkları
            'KAMPANYA'
        ],
        'shelf_location' => [
            // Exact DB field name (JSON export)
            'shelf_location',
            // Turkish variants
            'raf', 'raf_konum', 'raf konumu', 'shelf', 'location',
            'konum', 'position', 'pozisyon',
            // Export başlıkları
            'RAF_KONUM'
        ],
        'supplier_code' => [
            // Exact DB field name (JSON export)
            'supplier_code',
            // Turkish variants
            'tedarikci', 'tedarikçi', 'supplier', 'vendor', 'tedarikci_kodu',
            'vendor_code',
            // Export başlıkları
            'TEDARIKCI_KODU'
        ],
        'price_updated_at' => [
            // Exact DB field name (JSON export)
            'price_updated_at',
            // Turkish variants
            'fiyat değişiklik tarihi', 'fiyat_degisiklik_tarihi',
            'price_date', 'price_updated', 'fiyat_tarihi', 'fiyat tarihi',
            // Export başlıkları
            'FIYAT_GUNCELLEME'
        ],
        'previous_price_updated_at' => [
            // Exact DB field name (JSON export)
            'previous_price_updated_at',
            // Turkish variants
            'kampanyalı fiyat değişiklik tarihi', 'kampanyali fiyat degisiklik tarihi',
            'kampanyalı fiyat tarihi', 'promo_price_date', 'campaign_price_date',
            'indirimli fiyat tarihi', 'eski fiyat tarihi',
            // Export başlıkları
            'ESKI_FIYAT_GUNCELLEME'
        ],
        'production_type' => [
            // Exact DB field name (JSON export)
            'production_type',
            // Turkish variants
            'üretim şekli', 'uretim sekli', 'üretim_şekli', 'uretim_sekli',
            'üretim tipi', 'uretim tipi', 'tarim türü',
            'organik', 'konvansiyonel',
            // Export başlıkları
            'URETIM_SEKLI'
        ],
        'valid_from' => [
            // Exact DB field name (JSON export)
            'valid_from',
            // Turkish variants
            'geçerlilik başlangıç', 'gecerlilik baslangic',
            'start_date', 'baslangic_tarihi', 'başlangıç tarihi',
            // Export başlıkları
            'GECERLILIK_BASLANGIC'
        ],
        'valid_until' => [
            // Exact DB field name (JSON export)
            'valid_until',
            // Turkish variants
            'geçerlilik bitiş', 'gecerlilik bitis',
            'end_date', 'bitis_tarihi', 'bitiş tarihi', 'son tarih',
            // Export başlıkları
            'GECERLILIK_BITIS'
        ],
        'is_featured' => [
            // Exact DB field name (JSON export)
            'is_featured',
            // Turkish variants
            'öne çıkan', 'one cikan', 'featured',
            'vitrin', 'özel', 'special',
            // Export başlıkları
            'ONE_CIKAN'
        ],
        'slug' => [
            // Exact DB field name (JSON export)
            'slug',
            // Turkish variants
            'url', 'seo_url', 'friendly_url', 'permalink',
            'link', 'sayfa_linki',
            // Export başlıkları
            'SLUG'
        ],
        'status' => [
            // Exact DB field name (JSON export)
            'status',
            // Turkish variants
            'durum', 'aktif', 'active', 'etkin',
            'yayinda', 'yayın durumu',
            // Export başlıkları
            'DURUM'
        ],
        'price_valid_until' => [
            // Exact DB field name (JSON export)
            'price_valid_until',
            // Turkish variants
            'fiyat geçerlilik', 'fiyat_gecerlilik', 'fiyat son tarih',
            'price_expiry', 'price_end_date', 'fiyat_bitis',
            // Export başlıkları
            'FIYAT_GECERLILIK'
        ],
        'erp_id' => [
            // Exact DB field name (JSON export)
            'erp_id',
            // Turkish variants
            'erp_kodu', 'erp kodu', 'external_id', 'dis_kaynak_id',
            'entegrasyon_id', 'integration_id', 'system_id',
            // Export başlıkları
            'ERP_ID'
        ],
        'group' => [
            // Exact DB field name (JSON export)
            'group',
            // Turkish variants
            'grup', 'ana_grup', 'ana grup', 'ana_kategori', 'ana kategori',
            'main_group', 'main_category', 'product_group', 'urun_grubu', 'ürün grubu',
            'ust_kategori', 'üst kategori', 'parent_category',
            // Export başlıkları
            'GRUP', 'ANA_GRUP', 'ANA_KATEGORI'
        ],
        'images' => [
            // Exact DB field name (JSON export)
            'images',
            // Turkish variants
            'resimler', 'görseller', 'gorseller', 'pictures', 'photos',
            'fotolar', 'fotoğraflar', 'image_list', 'gorsel_listesi',
            // Export başlıkları
            'RESIMLER'
        ],
        'videos' => [
            // Exact DB field name (JSON export)
            'videos',
            // Turkish variants
            'videolar', 'video_list', 'video_listesi', 'klip', 'klipler',
            // Export başlıkları
            'VIDEOLAR'
        ],
        'video_url' => [
            // Exact DB field name (JSON export)
            'video_url',
            // Turkish variants
            'video_linki', 'video linki', 'video_link', 'videourl',
            'youtube', 'youtube_url', 'vimeo', 'video_adresi',
            // Export başlıkları
            'VIDEO_URL'
        ],
        'storage_info' => [
            // Exact DB field name (JSON export)
            'storage_info',
            // Turkish variants
            'saklama', 'saklama_bilgisi', 'saklama bilgisi', 'depolama',
            'muhafaza', 'saklama_kosullari', 'saklama koşulları',
            'storage', 'storage_conditions',
            // Export başlıkları
            'SAKLAMA_BILGISI'
        ]
    ];

    /**
     * Field importance weights for scoring
     */
    private static array $fieldWeights = [
        'sku' => 100,
        'name' => 100,
        'current_price' => 100,
        'barcode' => 80,
        'category' => 60,
        'unit' => 50,
        'stock' => 40,
        'origin' => 30,
        'brand' => 30,
        'vat_rate' => 20
    ];

    /**
     * Auto-detect field mappings from source data
     *
     * @param array $sourceHeaders List of header names from source file
     * @param array|null $sampleData Optional sample data rows for type detection
     * @return array Suggested mappings [targetField => sourceField]
     */
    public static function detectMappings(array $sourceHeaders, ?array $sampleData = null): array
    {
        $mappings = [];
        $usedSources = [];
        $scores = [];

        // Normalize source headers
        $normalizedHeaders = [];
        foreach ($sourceHeaders as $header) {
            $normalizedHeaders[$header] = self::normalize($header);
        }

        // Calculate scores for each source-target pair
        foreach (self::$fieldAliases as $targetField => $aliases) {
            foreach ($sourceHeaders as $sourceHeader) {
                $normalizedSource = $normalizedHeaders[$sourceHeader];
                $score = self::calculateMatchScore($normalizedSource, $aliases, $sourceHeader);

                if ($score > 0) {
                    $scores[$targetField][$sourceHeader] = $score;
                }
            }
        }

        // Sort target fields by importance
        $targetFields = array_keys(self::$fieldAliases);
        usort($targetFields, function ($a, $b) {
            $weightA = self::$fieldWeights[$a] ?? 10;
            $weightB = self::$fieldWeights[$b] ?? 10;
            return $weightB - $weightA;
        });

        // Assign mappings (greedy: highest score first, no duplicates)
        foreach ($targetFields as $targetField) {
            if (!isset($scores[$targetField])) {
                continue;
            }

            // Sort by score descending
            arsort($scores[$targetField]);

            foreach ($scores[$targetField] as $sourceHeader => $score) {
                if (!in_array($sourceHeader, $usedSources) && $score >= 50) {
                    $mappings[$targetField] = $sourceHeader;
                    $usedSources[] = $sourceHeader;
                    break;
                }
            }
        }

        // Data type heuristics from sample data
        if ($sampleData && !empty($sampleData)) {
            $mappings = self::refineWithSampleData($mappings, $sourceHeaders, $sampleData, $usedSources);
        }

        return $mappings;
    }

    /**
     * Calculate match score between source and target
     */
    private static function calculateMatchScore(string $normalizedSource, array $aliases, string $originalSource): int
    {
        $score = 0;

        // Exact match with alias
        foreach ($aliases as $alias) {
            $normalizedAlias = self::normalize($alias);

            // Exact match
            if ($normalizedSource === $normalizedAlias) {
                return 100;
            }

            // Contains match
            if (str_contains($normalizedSource, $normalizedAlias) || str_contains($normalizedAlias, $normalizedSource)) {
                $score = max($score, 70);
            }

            // Levenshtein distance for fuzzy match
            $distance = levenshtein($normalizedSource, $normalizedAlias);
            $maxLen = max(strlen($normalizedSource), strlen($normalizedAlias));
            if ($maxLen > 0) {
                $similarity = (1 - ($distance / $maxLen)) * 100;
                if ($similarity > 60) {
                    $score = max($score, (int) $similarity);
                }
            }
        }

        return $score;
    }

    /**
     * Normalize string for comparison
     */
    private static function normalize(string $str): string
    {
        // Turkish character map
        $map = [
            'ç' => 'c', 'Ç' => 'c', 'ğ' => 'g', 'Ğ' => 'g',
            'ı' => 'i', 'İ' => 'i', 'ö' => 'o', 'Ö' => 'o',
            'ş' => 's', 'Ş' => 's', 'ü' => 'u', 'Ü' => 'u'
        ];

        $str = strtr($str, $map);
        $str = strtolower($str);
        $str = preg_replace('/[^a-z0-9]/', '', $str);

        return $str;
    }

    /**
     * Refine mappings using sample data analysis
     */
    private static function refineWithSampleData(
        array $mappings,
        array $sourceHeaders,
        array $sampleData,
        array $usedSources
    ): array {
        // Analyze unmapped fields
        $unmappedSources = array_diff($sourceHeaders, $usedSources);
        $unmappedTargets = array_diff(array_keys(self::$fieldAliases), array_keys($mappings));

        foreach ($unmappedSources as $source) {
            $values = array_column($sampleData, $source);
            $type = self::detectDataType($values);

            // Try to match by data type
            foreach ($unmappedTargets as $target) {
                $expectedType = self::getExpectedType($target);

                if ($type === $expectedType && !isset($mappings[$target])) {
                    // Additional validation
                    if (self::validateTypeMatch($target, $values)) {
                        $mappings[$target] = $source;
                        break;
                    }
                }
            }
        }

        return $mappings;
    }

    /**
     * Detect data type from sample values
     */
    private static function detectDataType(array $values): string
    {
        $values = array_filter($values, fn($v) => $v !== null && $v !== '');

        if (empty($values)) {
            return 'unknown';
        }

        $numericCount = 0;
        $dateCount = 0;
        $barcodePattern = 0;

        foreach ($values as $value) {
            $value = (string) $value;

            // Check numeric
            if (is_numeric(str_replace([',', ' '], ['.', ''], $value))) {
                $numericCount++;
            }

            // Check date pattern
            if (preg_match('/^\d{4}-\d{2}-\d{2}/', $value) ||
                preg_match('/^\d{2}[.\/]\d{2}[.\/]\d{4}/', $value)) {
                $dateCount++;
            }

            // Check barcode pattern (8-14 digits)
            if (preg_match('/^\d{8,14}$/', preg_replace('/\D/', '', $value))) {
                $barcodePattern++;
            }
        }

        $total = count($values);

        if ($barcodePattern / $total > 0.8) {
            return 'barcode';
        }
        if ($dateCount / $total > 0.8) {
            return 'date';
        }
        if ($numericCount / $total > 0.8) {
            return 'numeric';
        }

        return 'string';
    }

    /**
     * Get expected data type for target field
     */
    private static function getExpectedType(string $field): string
    {
        $numericFields = [
            'current_price', 'previous_price', 'stock', 'weight',
            'vat_rate', 'discount_percent', 'campaign_price'
        ];

        $dateFields = [
            'price_updated_at', 'previous_price_updated_at',
            'valid_from', 'valid_until', 'price_valid_until'
        ];

        $barcodeFields = ['barcode'];
        $booleanFields = ['is_featured'];

        if (in_array($field, $numericFields)) {
            return 'numeric';
        }
        if (in_array($field, $dateFields)) {
            return 'date';
        }
        if (in_array($field, $barcodeFields)) {
            return 'barcode';
        }
        if (in_array($field, $booleanFields)) {
            return 'boolean';
        }

        return 'string';
    }

    /**
     * Validate type match with additional checks
     */
    private static function validateTypeMatch(string $target, array $values): bool
    {
        switch ($target) {
            case 'current_price':
            case 'previous_price':
                // Prices should be positive and reasonable
                foreach (array_slice($values, 0, 5) as $v) {
                    $num = floatval(str_replace([',', ' '], ['.', ''], $v));
                    if ($num < 0 || $num > 1000000) {
                        return false;
                    }
                }
                return true;

            case 'vat_rate':
                // VAT should be 0-100
                foreach (array_slice($values, 0, 5) as $v) {
                    $num = floatval($v);
                    if ($num < 0 || $num > 100) {
                        return false;
                    }
                }
                return true;

            case 'barcode':
                // Barcodes should be 8-14 digits
                foreach (array_slice($values, 0, 5) as $v) {
                    $digits = preg_replace('/\D/', '', $v);
                    if (strlen($digits) < 8 || strlen($digits) > 14) {
                        return false;
                    }
                }
                return true;

            default:
                return true;
        }
    }

    /**
     * Get mapping suggestions with confidence scores
     *
     * @param array $sourceHeaders Source field headers
     * @param array|null $sampleData Sample data for analysis
     * @return array Array of suggestions [targetField => [sourceField, confidence, alternatives]]
     */
    public static function getSuggestions(array $sourceHeaders, ?array $sampleData = null): array
    {
        $suggestions = [];
        $normalizedHeaders = [];

        foreach ($sourceHeaders as $header) {
            $normalizedHeaders[$header] = self::normalize($header);
        }

        foreach (self::$fieldAliases as $targetField => $aliases) {
            $candidates = [];

            foreach ($sourceHeaders as $sourceHeader) {
                $score = self::calculateMatchScore(
                    $normalizedHeaders[$sourceHeader],
                    $aliases,
                    $sourceHeader
                );

                if ($score > 0) {
                    $candidates[] = [
                        'field' => $sourceHeader,
                        'confidence' => $score
                    ];
                }
            }

            // Sort by confidence
            usort($candidates, fn($a, $b) => $b['confidence'] - $a['confidence']);

            $suggestions[$targetField] = [
                'required' => in_array($targetField, ['sku', 'name', 'current_price']),
                'weight' => self::$fieldWeights[$targetField] ?? 10,
                'best_match' => $candidates[0] ?? null,
                'alternatives' => array_slice($candidates, 1, 3)
            ];
        }

        return $suggestions;
    }

    /**
     * Get all target field definitions
     */
    public static function getTargetFields(): array
    {
        $fields = [];

        foreach (self::$fieldAliases as $field => $aliases) {
            $fields[$field] = [
                'name' => self::getFieldLabel($field),
                'required' => in_array($field, ['sku', 'name', 'current_price']),
                'type' => self::getExpectedType($field),
                'aliases' => $aliases
            ];
        }

        return $fields;
    }

    /**
     * Get human-readable field label
     */
    public static function getFieldLabel(string $field): string
    {
        $labels = [
            'sku' => 'SKU / Stok Kodu',
            'name' => 'Ürün Adı',
            'barcode' => 'Barkod',
            'current_price' => 'Satış Fiyatı',
            'previous_price' => 'Eski Fiyat',
            'campaign_price' => 'Kampanya Fiyatı',
            'unit' => 'Birim',
            'category' => 'Kategori',
            'subcategory' => 'Alt Kategori / Grup',
            'brand' => 'Marka',
            'origin' => 'Menşei',
            'stock' => 'Stok Miktarı',
            'vat_rate' => 'KDV Oranı',
            'kunye_no' => 'Künye Numarası',
            'weight' => 'Ağırlık',
            'description' => 'Açıklama',
            'image_url' => 'Görsel URL',
            'discount_percent' => 'İskonto Oranı',
            'campaign_text' => 'Kampanya Metni',
            'shelf_location' => 'Raf Konumu',
            'supplier_code' => 'Tedarikçi Kodu',
            'price_updated_at' => 'Fiyat Değişiklik Tarihi',
            'previous_price_updated_at' => 'Eski Fiyat Değişiklik Tarihi',
            'production_type' => 'Üretim Şekli',
            'valid_from' => 'Geçerlilik Başlangıç',
            'valid_until' => 'Geçerlilik Bitiş',
            'status' => 'Durum',
            'is_featured' => 'Öne Çıkan',
            'slug' => 'Slug / SEO URL',
            'price_valid_until' => 'Fiyat Geçerlilik Tarihi',
            'erp_id' => 'ERP ID',
            'group' => 'Grup',
            'images' => 'Görseller (JSON)',
            'videos' => 'Videolar (JSON)',
            'video_url' => 'Video URL',
            'storage_info' => 'Saklama Bilgisi'
        ];

        return $labels[$field] ?? ucfirst(str_replace('_', ' ', $field));
    }
}
