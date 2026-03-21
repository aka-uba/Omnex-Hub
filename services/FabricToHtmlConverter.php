<?php
/**
 * FabricToHtmlConverter
 *
 * Fabric.js şablon JSON verisini (design_data) bağımsız HTML sayfasına dönüştürür.
 * Dinamik alanlar ürün verileriyle doldurulur, videolar native <video> elementi olur.
 * Oluşan HTML, playlist'e eklenip signage cihazlarında oynatılabilir.
 *
 * Mevcut render akışına (process.php / RenderQueueWorker) DOKUNMAZ.
 */
class FabricToHtmlConverter
{
    /** Base path for resolving relative media URLs */
    private $basePath;

    /** Company ID for media URL resolution */
    private $companyId;

    /** Print mode: video'ları poster/placeholder olarak render et */
    private $printMode = false;

    /**
     * Label text → field key mapping.
     * Fabric.js v7 bug: dynamicField/fieldBinding props are not saved.
     * We match the text content (lowercase) to determine which product field it represents.
     * Mirrors TemplateEditorV7.js _repairDynamicFieldProps() labelToFieldMap.
     */
    private static $labelToFieldMap = [
        'ürün adı' => 'product_name', 'urun adi' => 'product_name', 'ürün ad' => 'product_name',
        'sku' => 'sku', 'stok kodu' => 'sku', 'ürün kodu' => 'sku', 'urun kodu' => 'sku',
        'barkod' => 'barcode', 'barcode' => 'barcode',
        'açıklama' => 'description', 'aciklama' => 'description', 'description' => 'description',
        'güncel fiyat' => 'current_price', 'guncel fiyat' => 'current_price', 'fiyat' => 'current_price',
        'satış fiyatı' => 'current_price', 'satis fiyati' => 'current_price', 'price' => 'current_price',
        'eski fiyat' => 'previous_price', 'önceki fiyat' => 'previous_price',
        'fiyat + tl' => 'price_with_currency', 'fiyat + ₺' => 'price_with_currency',
        'kdv oranı' => 'vat_rate', 'kdv orani' => 'vat_rate', 'kdv' => 'vat_rate',
        'indirim %' => 'discount_percent', 'indirim' => 'discount_percent',
        'kampanya metni' => 'campaign_text', 'kampanya' => 'campaign_text',
        'kategori' => 'category', 'category' => 'category',
        'alt kategori' => 'subcategory', 'subcategory' => 'subcategory',
        'marka' => 'brand', 'brand' => 'brand',
        'birim' => 'unit', 'unit' => 'unit',
        'ağırlık' => 'weight', 'agirlik' => 'weight', 'weight' => 'weight',
        'stok miktarı' => 'stock', 'stok miktari' => 'stock', 'stok' => 'stock',
        'menşei' => 'origin', 'mensei' => 'origin', 'origin' => 'origin',
        'üretim şekli' => 'production_type', 'uretim sekli' => 'production_type',
        'raf konumu' => 'shelf_location',
        'tedarikçi kodu' => 'supplier_code', 'tedarikci kodu' => 'supplier_code',
        'künye no' => 'kunye_no', 'kunye no' => 'kunye_no',
        'bugünün tarihi' => 'date_today', 'bugunun tarihi' => 'date_today', 'tarih' => 'date_today',
        'tarih ve saat' => 'date_time',
        'product name' => 'product_name', 'name' => 'product_name',
        'current price' => 'current_price', 'previous price' => 'previous_price',
        'üretici adı' => 'uretici_adi', 'uretici adi' => 'uretici_adi',
        'malın adı' => 'malin_adi', 'malin adi' => 'malin_adi',
        'malın cinsi' => 'malin_cinsi', 'malin cinsi' => 'malin_cinsi',
        'malın türü' => 'malin_turu', 'malin turu' => 'malin_turu',
        'üretim yeri' => 'uretim_yeri', 'uretim yeri' => 'uretim_yeri',
        'işletme adı' => 'isletme_adi', 'isletme adi' => 'isletme_adi',
        'malın sahibi' => 'malin_sahibi', 'malin sahibi' => 'malin_sahibi',
        'tüketim yeri' => 'tuketim_yeri', 'tuketim yeri' => 'tuketim_yeri',
        'sertifikasyon kuruluşu' => 'sertifikasyon_kurulusu',
        'sertifika no' => 'sertifika_no',
        'miktar' => 'miktar',
        'alış fiyatı' => 'alis_fiyati', 'alis fiyati' => 'alis_fiyati',
    ];

    public function __construct(string $companyId, string $basePath = '')
    {
        $this->companyId = $companyId;
        $this->basePath = $basePath ?: $this->detectBasePath();
    }

    /**
     * Ana dönüşüm metodu.
     *
     * @param array  $template   templates tablosundan gelen satır (design_data, width, height, grid_layout vs.)
     * @param array  $products   Ürün dizisi. Tekli şablonda 1 eleman, çoklu grid'de N eleman.
     * @param array  $options    Opsiyonel: width, height, title, locale, currency
     * @return array ['html' => string, 'title' => string, 'width' => int, 'height' => int]
     */
    public function convert(array $template, array $products, array $options = []): array
    {
        $designData = $this->parseDesignData($template['design_data'] ?? '');
        if (empty($designData)) {
            throw new \Exception('Şablon design_data boş veya geçersiz');
        }

        $canvasWidth  = (int)($options['width']  ?? $template['width']  ?? $designData['width']  ?? 1920);
        $canvasHeight = (int)($options['height'] ?? $template['height'] ?? $designData['height'] ?? 1080);
        $title = $options['title'] ?? $template['name'] ?? 'Omnex Template';
        $currency = $options['currency'] ?? '₺';

        // Grid layout varsa bölgeleri çöz
        $gridLayout = $template['grid_layout'] ?? 'single';
        $regionsConfig = $this->parseDesignData($template['regions_config'] ?? '');

        $objects = $designData['objects'] ?? [];

        // Her ürün için field values ön-hesapla
        $productFieldValues = [];
        foreach ($products as $idx => $p) {
            $productFieldValues[$idx] = $this->buildFieldValues($p, $currency);
        }

        // ── Multi-product-frame slot → ürün eşleştirme ──────
        // Slot ID'leri 1'den başlar, ürünler sırayla eşlenir
        $slotProductMap = [];
        $hasMultiProductFrame = false;
        foreach ($objects as $obj) {
            $ct = $obj['customType'] ?? '';
            if ($ct === 'multi-product-frame' || (!empty($obj['frameCols']) && !empty($obj['frameRows']))) {
                $hasMultiProductFrame = true;
                $cols = (int)($obj['frameCols'] ?? 1);
                $rows = (int)($obj['frameRows'] ?? 1);
                $slotNo = 1;
                for ($r = 0; $r < $rows; $r++) {
                    for ($c = 0; $c < $cols; $c++) {
                        if (isset($products[$slotNo - 1])) {
                            $slotProductMap[$slotNo] = $slotNo - 1; // slotId → product index
                        }
                        $slotNo++;
                    }
                }
                break; // İlk frame yeterli
            }
        }

        // Her objeyi HTML elementine dönüştür
        $htmlElements = [];
        foreach ($objects as $obj) {
            // slotId varsa (multi-product slot objesi) — doğru ürünü eşle
            $slotId = isset($obj['slotId']) ? (int)$obj['slotId'] : 0;

            if ($slotId > 0 && $hasMultiProductFrame) {
                $productIndex = $slotProductMap[$slotId] ?? 0;
            } else {
                $regionId = $obj['regionId'] ?? null;
                $productIndex = $this->resolveProductIndex($regionId, $regionsConfig, $gridLayout);
            }

            $product = $products[$productIndex] ?? ($products[0] ?? []);
            $fieldValues = $productFieldValues[$productIndex] ?? ($productFieldValues[0] ?? []);

            $element = $this->convertObject($obj, $product, $fieldValues, $canvasWidth, $canvasHeight, $currency);
            if ($element !== null) {
                $htmlElements[] = $element;
            }
        }

        // Kullanılan fontları topla
        $usedFonts = $this->collectFonts($objects);

        // Tam HTML sayfası oluştur
        $html = $this->buildFullHtml($htmlElements, $canvasWidth, $canvasHeight, $title, $designData, $usedFonts);

        return [
            'html'   => $html,
            'title'  => $title,
            'width'  => $canvasWidth,
            'height' => $canvasHeight,
        ];
    }

    /**
     * Sadece canvas fragment'ı döner (tam HTML sayfası DEĞİL).
     * Print endpoint için kullanılır — wrapper sayfası dışarıda oluşturulur.
     *
     * @return array ['fragment' => string, 'fonts' => array, 'width' => int, 'height' => int, 'bg' => string]
     */
    public function convertToFragment(array $template, array $products, array $options = []): array
    {
        $designData = $this->parseDesignData($template['design_data'] ?? '');
        if (empty($designData)) {
            return ['fragment' => '', 'fonts' => [], 'width' => 0, 'height' => 0, 'bg' => '#fff'];
        }

        $canvasWidth  = (int)($options['width']  ?? $template['width']  ?? $designData['width']  ?? 800);
        $canvasHeight = (int)($options['height'] ?? $template['height'] ?? $designData['height'] ?? 1280);
        $currency = $options['currency'] ?? '₺';
        $this->printMode = !empty($options['print_mode']);

        $gridLayout = $template['grid_layout'] ?? 'single';
        $regionsConfig = $this->parseDesignData($template['regions_config'] ?? '');
        $objects = $designData['objects'] ?? [];

        // Her ürün için field values
        $productFieldValues = [];
        foreach ($products as $idx => $p) {
            $productFieldValues[$idx] = $this->buildFieldValues($p, $currency);
        }

        // Multi-product-frame slot eşleştirme
        $slotProductMap = [];
        $hasMultiProductFrame = false;
        foreach ($objects as $obj) {
            $ct = $obj['customType'] ?? '';
            if ($ct === 'multi-product-frame' || (!empty($obj['frameCols']) && !empty($obj['frameRows']))) {
                $hasMultiProductFrame = true;
                $cols = (int)($obj['frameCols'] ?? 1);
                $rows = (int)($obj['frameRows'] ?? 1);
                $slotNo = 1;
                for ($r = 0; $r < $rows; $r++) {
                    for ($c = 0; $c < $cols; $c++) {
                        if (isset($products[$slotNo - 1])) {
                            $slotProductMap[$slotNo] = $slotNo - 1;
                        }
                        $slotNo++;
                    }
                }
                break;
            }
        }

        // Objeleri HTML'e dönüştür
        $htmlElements = [];
        foreach ($objects as $obj) {
            $slotId = isset($obj['slotId']) ? (int)$obj['slotId'] : 0;
            if ($slotId > 0 && $hasMultiProductFrame) {
                $productIndex = $slotProductMap[$slotId] ?? 0;
            } else {
                $regionId = $obj['regionId'] ?? null;
                $productIndex = $this->resolveProductIndex($regionId, $regionsConfig, $gridLayout);
            }
            $product = $products[$productIndex] ?? ($products[0] ?? []);
            $fieldValues = $productFieldValues[$productIndex] ?? ($productFieldValues[0] ?? []);
            $element = $this->convertObject($obj, $product, $fieldValues, $canvasWidth, $canvasHeight, $currency);
            if ($element !== null) {
                $htmlElements[] = $element;
            }
        }

        $usedFonts = $this->collectFonts($objects);

        // Canvas arka planı
        $bg = $this->resolveCanvasBackground($designData);

        // Fragment: sadece canvas div
        $elementsHtml = implode("\n        ", $htmlElements);
        $fragment = "<div class=\"canvas-container\" style=\"position:relative;width:{$canvasWidth}px;height:{$canvasHeight}px;{$bg};overflow:hidden;\">\n        {$elementsHtml}\n    </div>";

        // printMode reset (sonraki convert() çağrılarını etkilemesin)
        $this->printMode = false;

        return [
            'fragment' => $fragment,
            'fonts'    => $usedFonts,
            'width'    => $canvasWidth,
            'height'   => $canvasHeight,
            'bg'       => $bg,
        ];
    }

    // ─────────────────────────────────────────────────────
    // Ürün Alan Değeri Oluşturma
    // ─────────────────────────────────────────────────────

    /**
     * Ürün verisinden formatlı alan değerleri oluştur.
     * PavoDisplayGateway::buildFieldValues() ile aynı mantık.
     */
    private function buildFieldValues(array $product, string $currency = '₺'): array
    {
        $currentPrice = $product['current_price'] ?? $product['price'] ?? 0;
        $previousPrice = $product['previous_price'] ?? $product['old_price'] ?? null;

        $formattedPrice = number_format((float)$currentPrice, 2, ',', '.');
        $formattedPrevPrice = $previousPrice ? number_format((float)$previousPrice, 2, ',', '.') : '';
        $formattedPriceWithCurrency = $formattedPrice . ' ' . $currency;
        $formattedPrevPriceWithCurrency = $formattedPrevPrice ? ($formattedPrevPrice . ' ' . $currency) : '';

        // İndirim hesapla
        $discountPercent = '';
        $cur = (float)$currentPrice;
        $prev = (float)($previousPrice ?? 0);
        if ($prev > 0 && $cur < $prev) {
            $discountPercent = '%' . round(($prev - $cur) / $prev * 100);
        }

        return [
            // Temel bilgiler
            'product_name' => $product['name'] ?? '',
            'name' => $product['name'] ?? '',
            'sku' => $product['sku'] ?? '',
            'barcode' => $product['barcode'] ?? $product['sku'] ?? '',
            'description' => $product['description'] ?? '',
            'slug' => $product['slug'] ?? '',

            // Fiyat bilgileri
            'current_price' => $formattedPriceWithCurrency,
            'price' => $formattedPriceWithCurrency,
            'price_with_currency' => $formattedPriceWithCurrency,
            'current_price_value' => $formattedPrice,
            'price_value' => $formattedPrice,
            'previous_price' => $formattedPrevPriceWithCurrency,
            'old_price' => $formattedPrevPriceWithCurrency,
            'previous_price_with_currency' => $formattedPrevPriceWithCurrency,
            'old_price_with_currency' => $formattedPrevPriceWithCurrency,
            'previous_price_value' => $formattedPrevPrice,
            'old_price_value' => $formattedPrevPrice,
            'vat_rate' => ($product['vat_rate'] ?? '18') . '%',
            'discount_percent' => $discountPercent ?: (($product['discount_percent'] ?? '') . '%'),
            'campaign_text' => $product['campaign_text'] ?? '',

            // Kategori ve marka
            'category' => $product['category'] ?? $product['category_name'] ?? '',
            'subcategory' => $product['subcategory'] ?? '',
            'brand' => $product['brand'] ?? '',

            // Detay bilgileri
            'unit' => $product['unit'] ?? 'adet',
            'weight' => $product['weight'] ?? '',
            'stock' => $product['stock'] ?? '',
            'origin' => $product['origin'] ?? $product['country'] ?? '',
            'production_type' => $product['production_type'] ?? '',

            // Konum ve kod
            'shelf_location' => $product['shelf_location'] ?? '',
            'supplier_code' => $product['supplier_code'] ?? '',

            // HAL Künye alanları
            'kunye_no' => $product['kunye_no'] ?? '',
            'uretici_adi' => $product['uretici_adi'] ?? '',
            'malin_adi' => $product['malin_adi'] ?? '',
            'malin_cinsi' => $product['malin_cinsi'] ?? '',
            'malin_turu' => $product['malin_turu'] ?? '',
            'uretim_yeri' => $product['uretim_yeri'] ?? '',
            'ilk_bildirim_tarihi' => $product['ilk_bildirim_tarihi'] ?? '',
            'malin_sahibi' => $product['malin_sahibi'] ?? '',
            'tuketim_yeri' => $product['tuketim_yeri'] ?? '',
            'tuketim_bildirim_tarihi' => $product['tuketim_bildirim_tarihi'] ?? '',
            'gumruk_kapisi' => $product['gumruk_kapisi'] ?? '',
            'uretim_ithal_tarihi' => $product['uretim_ithal_tarihi'] ?? '',
            'miktar' => $product['miktar'] ?? '',
            'alis_fiyati' => isset($product['alis_fiyati']) && $product['alis_fiyati'] !== '' ? number_format((float)$product['alis_fiyati'], 2, ',', '.') . ' ' . $currency : '',
            'isletme_adi' => $product['isletme_adi'] ?? '',
            'uretim_sekli' => $product['uretim_sekli'] ?? $product['production_type'] ?? '',
            'sertifikasyon_kurulusu' => $product['sertifikasyon_kurulusu'] ?? '',
            'sertifika_no' => $product['sertifika_no'] ?? '',
            'diger_bilgiler' => $product['diger_bilgiler'] ?? '',
            'kalan_miktar' => $product['kalan_miktar'] ?? '',
            'birim' => $product['birim'] ?? '',

            // Tarih bilgileri
            'price_updated_at' => $product['price_updated_at'] ?? '',
            'price_valid_until' => $product['price_valid_until'] ?? '',
            'date_today' => date('d.m.Y'),
            'date_time' => date('d.m.Y H:i'),
        ];
    }

    // ─────────────────────────────────────────────────────
    // Obje dönüşüm
    // ─────────────────────────────────────────────────────

    /**
     * Tek bir Fabric.js objesini HTML string'ine dönüştür.
     */
    private function convertObject(array $obj, array $product, array $fieldValues, int $cw, int $ch, string $currency): ?string
    {
        $type = strtolower($obj['type'] ?? '');
        $customType = $obj['customType'] ?? '';

        // Gizli veya sıfır ölçülü objeler atla
        if (($obj['visible'] ?? true) === false) return null;
        if (($obj['opacity'] ?? 1) <= 0) return null;

        // Export'tan hariç tutulacak objeler (region overlay, background, guide lines)
        if (!empty($obj['isRegionOverlay']) || !empty($obj['excludeFromExport']) || !empty($obj['isBackground'])) {
            return null;
        }

        // Multi-product-frame yardımcı objeleri (slot arka planı, slot etiketi, slot placeholder)
        if (!empty($obj['isSlotBackground']) || !empty($obj['isSlotLabel']) || !empty($obj['isSlotPlaceholder']) || !empty($obj['isTransient'])) {
            return null;
        }

        // Multi-product-frame kendisi (görsel çerçeve, render'da gizlenmeli)
        if ($customType === 'multi-product-frame' || (!empty($obj['frameCols']) && !empty($obj['frameRows']))) {
            return null;
        }

        // slot-label customType (editörde slot numarası göstergesi)
        if ($customType === 'slot-label') {
            return null;
        }

        // Pozisyon ve boyut
        $width  = round((float)($obj['width'] ?? 0) * (float)($obj['scaleX'] ?? 1), 2);
        $height = round((float)($obj['height'] ?? 0) * (float)($obj['scaleY'] ?? 1), 2);
        $angle  = (float)($obj['angle'] ?? 0);
        $opacity = (float)($obj['opacity'] ?? 1);

        // Fabric.js v7 center origin düzeltmesi
        $originX = $obj['originX'] ?? 'left';
        $originY = $obj['originY'] ?? 'top';
        $left = round((float)($obj['left'] ?? 0), 2);
        $top  = round((float)($obj['top'] ?? 0), 2);

        if ($originX === 'center') {
            $left = round($left - $width / 2, 2);
        } elseif ($originX === 'right') {
            $left = round($left - $width, 2);
        }
        if ($originY === 'center') {
            $top = round($top - $height / 2, 2);
        } elseif ($originY === 'bottom') {
            $top = round($top - $height, 2);
        }

        // Video placeholder? (hyphen, not underscore)
        if (in_array($customType, ['video-placeholder', 'video_placeholder', 'video'], true)) {
            return $this->convertVideo($obj, $product, $left, $top, $width, $height, $angle, $opacity);
        }

        // slot-media: Çoklu ürün çerçevesine elle eklenen medya (video veya görsel)
        // Video ise staticVideos/videoSrc'den çözümle, görsel ise convertImage'a yönlendir
        if ($customType === 'slot-media') {
            // staticVideos veya videoSrc varsa video olarak render et
            $staticVideos = $obj['staticVideos'] ?? [];
            $videoSrc = $obj['videoSrc'] ?? $obj['video_placeholder_url'] ?? '';
            $isVideoPlaceholder = !empty($obj['isVideoPlaceholder']) || !empty($obj['is_video_placeholder']);

            if (!empty($staticVideos) || !empty($videoSrc) || $isVideoPlaceholder) {
                return $this->convertVideo($obj, $product, $left, $top, $width, $height, $angle, $opacity);
            }

            // src varsa (image olarak eklenen medya) — convertImage'a yönlendir
            if (!empty($obj['src'])) {
                return $this->convertImage($obj, $product, $left, $top, $width, $height, $angle, $opacity);
            }
        }

        // Barkod objesi → SVG placeholder (JsBarcode ile render edilecek)
        // Not: Bazı şablonlarda barcode nesnesi dynamic-text/alias alanlarıyla gelebilir.
        if ($this->isBarcodeObject($obj)) {
            return $this->convertBarcode($obj, $fieldValues, $left, $top, $width, $height, $angle, $opacity);
        }

        // QR Kod objesi → div placeholder (qrcodejs ile render edilecek)
        if ($customType === 'qrcode' || ($obj['dynamicField'] ?? '') === 'kunye_no') {
            return $this->convertQrCode($obj, $fieldValues, $left, $top, $width, $height, $angle, $opacity);
        }

        // Metin mi?
        if (in_array($type, ['textbox', 'i-text', 'text'], true)) {
            return $this->convertText($obj, $product, $fieldValues, $left, $top, $width, $height, $angle, $opacity, $currency);
        }

        // Görsel mi?
        if ($type === 'image') {
            return $this->convertImage($obj, $product, $left, $top, $width, $height, $angle, $opacity);
        }

        // Dikdörtgen / Şekil
        if (in_array($type, ['rect'], true)) {
            return $this->convertRect($obj, $left, $top, $width, $height, $angle, $opacity);
        }

        // Circle
        if ($type === 'circle') {
            return $this->convertCircle($obj, $left, $top, $width, $height, $angle, $opacity);
        }

        // Grup (recursive)
        if ($type === 'group' && !empty($obj['objects'])) {
            return $this->convertGroup($obj, $product, $fieldValues, $cw, $ch, $left, $top, $width, $height, $angle, $opacity, $currency);
        }

        // Diğer objeler (line, polygon vb.) – basit div olarak
        if ($width > 0 && $height > 0) {
            $style = $this->buildBaseStyle($left, $top, $width, $height, $angle, $opacity);
            $bg = $this->resolveFill($obj['fill'] ?? 'transparent');
            $style .= "background:{$bg};";
            return "<div style=\"{$style}\"></div>";
        }

        return null;
    }

    /**
     * Metin objesi → HTML div
     */
    private function convertText(array $obj, array $product, array $fieldValues, float $left, float $top, float $width, float $height, float $angle, float $opacity, string $currency): string
    {
        $text = $obj['text'] ?? '';
        $customType = $obj['customType'] ?? '';
        $dynamicField = $obj['dynamicField'] ?? $obj['dynamic_field'] ?? null;
        $fieldBinding = $obj['fieldBinding'] ?? null;

        // Dinamik alan çözümleme - 4 kademeli
        // 1. dynamicField prop varsa (editor tarafından repair edilmiş olabilir)
        if ($dynamicField) {
            $fieldName = trim($dynamicField, '{} ');
            if (isset($fieldValues[$fieldName]) && $fieldValues[$fieldName] !== '') {
                $text = $fieldValues[$fieldName];
            }
        }
        // 2. fieldBinding varsa (v5 tarzı)
        elseif ($fieldBinding && !empty($fieldBinding['source'])) {
            $fieldName = str_replace('product.', '', $fieldBinding['source']);
            if (isset($fieldValues[$fieldName]) && $fieldValues[$fieldName] !== '') {
                $text = $fieldValues[$fieldName];
            }
        }
        // 3. {{placeholder}} pattern
        elseif (is_string($text) && strpos($text, '{{') !== false) {
            $text = preg_replace_callback('/\{\{([^}]+)\}\}/', function ($m) use ($fieldValues) {
                $key = trim($m[1]);
                return $fieldValues[$key] ?? '';
            }, $text);
        }
        // 4. customType='dynamic-text' + text content eşleştirme (v7 fallback)
        elseif (in_array($customType, ['dynamic-text', 'slot-text', 'dynamic_text'], true)) {
            $textLower = mb_strtolower(trim($text), 'UTF-8');
            if (isset(self::$labelToFieldMap[$textLower])) {
                $fieldName = self::$labelToFieldMap[$textLower];
                if (isset($fieldValues[$fieldName]) && $fieldValues[$fieldName] !== '') {
                    $text = $fieldValues[$fieldName];
                }
            }
        }

        // Font boyutu: Fabric.js'te fontSize scale'den bağımsızdır
        // scaleX/scaleY sadece nesne kutusunu (width/height) etkiler, font boyutunu DEĞİL
        $fontSize   = round((float)($obj['fontSize'] ?? 16), 1);
        $fontFamily = $obj['fontFamily'] ?? 'Arial, sans-serif';
        $fontWeight = $obj['fontWeight'] ?? 'normal';
        $fontStyle  = $obj['fontStyle'] ?? 'normal';
        $fill       = is_string($obj['fill'] ?? '') ? ($obj['fill'] ?? '#000000') : '#000000';
        $textAlign  = $obj['textAlign'] ?? 'left';
        $lineHeight = $obj['lineHeight'] ?? 1.16;
        $charSpacing = (float)($obj['charSpacing'] ?? 0);
        $letterSpacing = $charSpacing !== 0 ? round($charSpacing / 1000, 3) . 'em' : 'normal';

        // Text decoration (birden fazla olabilir)
        $decorations = [];
        if (!empty($obj['underline'])) $decorations[] = 'underline';
        if (!empty($obj['overline'])) $decorations[] = 'overline';
        if (!empty($obj['linethrough'])) $decorations[] = 'line-through';
        $textDecoration = !empty($decorations) ? 'text-decoration:' . implode(' ', $decorations) . ';' : '';

        // backgroundColor (text highlight)
        $bgColor = !empty($obj['backgroundColor']) ? "background-color:{$obj['backgroundColor']};" : '';

        // Stroke (text outline)
        $strokeCss = '';
        $stroke = $obj['stroke'] ?? null;
        $strokeWidth = (float)($obj['strokeWidth'] ?? 0);
        if ($stroke && $strokeWidth > 0) {
            $strokeCss = "-webkit-text-stroke:{$strokeWidth}px {$stroke};paint-order:stroke fill;";
        }

        // Shadow
        $shadowCss = '';
        $shadow = $obj['shadow'] ?? null;
        if ($shadow) {
            if (is_string($shadow) && !empty($shadow)) {
                // Fabric.js string format: "offsetX offsetY blur color"
                $shadowCss = "text-shadow:{$shadow};";
            } elseif (is_array($shadow)) {
                $sx = (float)($shadow['offsetX'] ?? 0);
                $sy = (float)($shadow['offsetY'] ?? 0);
                $sb = (float)($shadow['blur'] ?? 0);
                $sc = $shadow['color'] ?? 'rgba(0,0,0,0.3)';
                $shadowCss = "text-shadow:{$sx}px {$sy}px {$sb}px {$sc};";
            }
        }

        $style = $this->buildBaseStyle($left, $top, $width, $height, $angle, $opacity);
        $style .= "font-size:{$fontSize}px;";
        $style .= "font-family:{$this->escAttr($fontFamily)};";
        $style .= "font-weight:{$fontWeight};";
        $style .= "font-style:{$fontStyle};";
        $style .= "color:{$fill};";
        $style .= "text-align:{$textAlign};";
        $style .= "line-height:{$lineHeight};";
        $style .= "letter-spacing:{$letterSpacing};";
        $style .= "overflow:hidden;word-wrap:break-word;white-space:pre-wrap;";
        $style .= $textDecoration . $bgColor . $strokeCss . $shadowCss;

        // Dikey hizalama: Fabric.js'te metin üstten başlar
        $style .= "display:flex;align-items:flex-start;";

        $escapedText = nl2br($this->esc($text));

        return "<div style=\"{$style}\"><span>{$escapedText}</span></div>";
    }

    /**
     * Barkod objesi → SVG placeholder (JsBarcode ile client-side render edilir)
     */
    private function convertBarcode(array $obj, array $fieldValues, float $left, float $top, float $width, float $height, float $angle, float $opacity): string
    {
        $value = $this->resolveDynamicFieldValue($obj, $fieldValues);
        $valueLower = mb_strtolower(trim((string)$value), 'UTF-8');
        if (empty($value) || in_array($valueLower, ['barkod', 'barcode'], true)) {
            $fallbackText = trim((string)($obj['text'] ?? ''));
            $fallbackTextLower = mb_strtolower($fallbackText, 'UTF-8');

            // Etiket metni barkod/barcode ise gerçek alan değeriyle değiştir.
            if (in_array($fallbackTextLower, ['barkod', 'barcode'], true) || strpos($fallbackText, '{{') !== false) {
                $value = $fieldValues['barcode'] ?? $fieldValues['sku'] ?? $fallbackText;
            } else {
                $value = $fallbackText ?: ($fieldValues['barcode'] ?? $fieldValues['sku'] ?? '');
            }
        }
        $escapedVal = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
        $style = $this->buildBaseStyle($left, $top, $width, $height, $angle, $opacity);
        $style .= "display:flex;align-items:center;justify-content:center;background:#fff;overflow:hidden;";
        $uid = 'bc_' . substr(md5(uniqid()), 0, 8);
        return "<div style=\"{$style}\"><svg id=\"{$uid}\" class=\"print-barcode\" data-barcode=\"{$escapedVal}\" data-width=\"{$width}\" data-height=\"{$height}\" style=\"max-width:100%;max-height:100%;\"></svg></div>";
    }

    /**
     * Barkod nesnesini customType/type/dynamicField/fieldBinding/text üzerinden tespit et.
     */
    private function isBarcodeObject(array $obj): bool
    {
        $customType = mb_strtolower((string)($obj['customType'] ?? ''), 'UTF-8');
        $type = mb_strtolower((string)($obj['type'] ?? ''), 'UTF-8');

        if (in_array($customType, ['barcode', 'barkod', 'dynamic-barcode', 'dynamic_barcode'], true)) {
            return true;
        }
        if ($type === 'barcode') {
            return true;
        }

        $dynamicField = $this->normalizeFieldKey((string)($obj['dynamicField'] ?? $obj['dynamic_field'] ?? ''));
        if ($dynamicField === 'barcode') {
            return true;
        }

        $fieldBinding = $obj['fieldBinding'] ?? null;
        if (is_array($fieldBinding)) {
            $source = $this->normalizeFieldKey((string)($fieldBinding['source'] ?? ''));
            if ($source === 'barcode') {
                return true;
            }
        }

        $text = trim((string)($obj['text'] ?? ''));
        if ($text !== '') {
            if (preg_match('/\{\{\s*([^}]+)\s*\}\}/u', $text, $m)) {
                $placeholderKey = $this->normalizeFieldKey($m[1] ?? '');
                if ($placeholderKey === 'barcode') {
                    return true;
                }
            }
            $textKey = $this->normalizeFieldKey($text);
            if ($textKey === 'barcode') {
                return true;
            }
        }

        return false;
    }

    /**
     * Dinamik alan adını normalize et ve alias map ile gerçek alana çevir.
     */
    private function normalizeFieldKey(string $raw): string
    {
        $key = trim((string)$raw);
        if ($key === '') return '';

        $key = str_replace(['{{', '}}', 'product.'], '', $key);
        $key = preg_replace('/\s+/u', ' ', $key);
        $lower = mb_strtolower(trim($key), 'UTF-8');

        if (isset(self::$labelToFieldMap[$lower])) {
            return self::$labelToFieldMap[$lower];
        }

        $underscore = str_replace(' ', '_', $lower);
        if (isset(self::$labelToFieldMap[$underscore])) {
            return self::$labelToFieldMap[$underscore];
        }

        return $underscore;
    }

    /**
     * QR kod objesi → div placeholder (qrcodejs ile client-side render edilir)
     */
    private function convertQrCode(array $obj, array $fieldValues, float $left, float $top, float $width, float $height, float $angle, float $opacity): string
    {
        $value = $this->resolveDynamicFieldValue($obj, $fieldValues);
        if (empty($value)) {
            $value = $obj['text'] ?? $fieldValues['kunye_no'] ?? $fieldValues['barcode'] ?? '';
        }
        $escapedVal = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
        $style = $this->buildBaseStyle($left, $top, $width, $height, $angle, $opacity);
        $style .= "display:flex;align-items:center;justify-content:center;background:#fff;overflow:hidden;";
        $uid = 'qr_' . substr(md5(uniqid()), 0, 8);
        return "<div id=\"{$uid}\" class=\"print-qrcode\" data-qrcode=\"{$escapedVal}\" style=\"{$style}\"></div>";
    }

    /**
     * Dinamik alan değerini çöz (4-tier cascade)
     */
    private function resolveDynamicFieldValue(array $obj, array $fieldValues): string
    {
        // 1. dynamicField prop
        $dynamicField = $obj['dynamicField'] ?? $obj['dynamic_field'] ?? null;
        if ($dynamicField) {
            $key = $this->normalizeFieldKey((string)$dynamicField);
            if (isset($fieldValues[$key])) return (string)$fieldValues[$key];
        }

        // 2. fieldBinding
        $fieldBinding = $obj['fieldBinding'] ?? null;
        if ($fieldBinding && is_array($fieldBinding)) {
            $source = $this->normalizeFieldKey((string)($fieldBinding['source'] ?? ''));
            if ($source && isset($fieldValues[$source])) return (string)$fieldValues[$source];
        }

        // 3. {{placeholder}} in text
        $text = $obj['text'] ?? '';
        if (preg_match('/\{\{\s*([^}]+?)\s*\}\}/u', (string)$text, $m)) {
            $placeholderKey = $this->normalizeFieldKey((string)($m[1] ?? ''));
            if ($placeholderKey !== '' && isset($fieldValues[$placeholderKey])) {
                return (string)$fieldValues[$placeholderKey];
            }
        }

        return '';
    }

    /**
     * Görsel objesi → HTML img (veya video URL ise video elementi)
     */
    private function convertImage(array $obj, array $product, float $left, float $top, float $width, float $height, float $angle, float $opacity): string
    {
        $src = $obj['src'] ?? '';
        $fieldBinding = $obj['fieldBinding'] ?? null;
        $customType = $obj['customType'] ?? '';
        $dynamicField = $obj['dynamicField'] ?? $obj['dynamic_field'] ?? null;

        // Dinamik ürün görseli — product image placeholder customType'ları
        $imageCustomTypes = ['product_image', 'image-placeholder', 'dynamic-image', 'slot-image'];
        $isDataField = !empty($obj['isDataField']) || !empty($obj['isDynamicField']);
        if (in_array($customType, $imageCustomTypes, true)
            || ($isDataField && ($customType === 'image' || stripos($dynamicField ?? '', 'image') !== false))
            || ($dynamicField && stripos($dynamicField, 'image') !== false)
            || ($fieldBinding && stripos($fieldBinding['source'] ?? '', 'image') !== false)) {
            $productImage = $this->resolveProductImageUrl($product);
            if ($productImage) {
                $src = $productImage;
            }
        }

        // Base64 data URL veya görece yol çözümle
        $src = $this->resolveMediaUrl($src);

        if (empty($src)) return '';

        // Video URL ise <video> olarak render et (editörde image olarak eklenen videolar)
        if ($this->isVideoUrl($src)) {
            $style = $this->buildBaseStyle($left, $top, $width, $height, $angle, $opacity);
            $style .= "object-fit:cover;background:#000;";
            return "<video src=\"{$this->escAttr($src)}\" style=\"{$style}\" autoplay muted loop playsinline></video>";
        }

        $style = $this->buildBaseStyle($left, $top, $width, $height, $angle, $opacity);
        $style .= "object-fit:contain;";

        $alt = $this->esc($product['name'] ?? 'Image');

        return "<img src=\"{$this->escAttr($src)}\" alt=\"{$alt}\" style=\"{$style}\" loading=\"lazy\">";
    }

    /**
     * Video placeholder → HTML5 video elementi
     */
    private function convertVideo(array $obj, array $product, float $left, float $top, float $width, float $height, float $angle, float $opacity): string
    {
        $videoSrc = '';

        // 1. Obje üzerindeki video kaynağı
        if (!empty($obj['videoSrc'])) {
            $videoSrc = $obj['videoSrc'];
        } elseif (!empty($obj['video_placeholder_url'])) {
            $videoSrc = $obj['video_placeholder_url'];
        } elseif (!empty($obj['src']) && $this->isVideoUrl($obj['src'])) {
            $videoSrc = $obj['src'];
        }

        // 1b. staticVideos dizisinden ilk video (slot-media objeleri)
        if (empty($videoSrc) && !empty($obj['staticVideos'])) {
            $staticVideos = $obj['staticVideos'];
            if (is_string($staticVideos)) {
                $staticVideos = json_decode($staticVideos, true) ?: [];
            }
            if (is_array($staticVideos) && !empty($staticVideos)) {
                $first = $staticVideos[0];
                $videoSrc = is_string($first) ? $first : ($first['url'] ?? $first['path'] ?? '');
            }
        }

        // 2. dynamicField ile ürün videosu
        $dynamicField = $obj['dynamicField'] ?? $obj['dynamic_field'] ?? null;
        if (empty($videoSrc) && $dynamicField && stripos($dynamicField, 'video') !== false) {
            $videoSrc = $this->resolveProductVideoUrl($product);
        }

        // 3. fieldBinding ile ürün videosu
        $fieldBinding = $obj['fieldBinding'] ?? null;
        if (empty($videoSrc) && $fieldBinding && stripos($fieldBinding['source'] ?? '', 'video') !== false) {
            $videoSrc = $this->resolveProductVideoUrl($product);
        }

        // 4. Ürünün genel video alanı
        if (empty($videoSrc)) {
            $videoSrc = $this->resolveProductVideoUrl($product);
        }

        if (empty($videoSrc)) return '';

        $videoSrc = $this->resolveMediaUrl($videoSrc);

        $style = $this->buildBaseStyle($left, $top, $width, $height, $angle, $opacity);
        $style .= "object-fit:cover;background:#000;";

        // Print modunda video yerine poster/placeholder göster (video print'te oynatılamaz)
        if ($this->printMode) {
            $style .= "display:flex;align-items:center;justify-content:center;";
            // Video poster varsa onu göster, yoksa placeholder
            $poster = $obj['poster'] ?? $obj['posterUrl'] ?? '';
            if (!empty($poster)) {
                $posterSrc = $this->resolveMediaUrl($poster);
                return "<div style=\"{$style}\">"
                    . "<img src=\"{$this->escAttr($posterSrc)}\" style=\"position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;\" />"
                    . "</div>";
            }
            // Poster yoksa: koyu arka plan + video ikonu (print-friendly)
            return "<div style=\"{$style}background:#1a1a2e;\">"
                . "<div style=\"position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#666;font-size:40px;\">&#9654;</div>"
                . "<div style=\"position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.6);color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;\">Video</div>"
                . "</div>";
        }

        return "<video src=\"{$this->escAttr($videoSrc)}\" style=\"{$style}\" autoplay muted loop playsinline></video>";
    }

    /**
     * Dikdörtgen → HTML div
     */
    private function convertRect(array $obj, float $left, float $top, float $width, float $height, float $angle, float $opacity): string
    {
        $style = $this->buildBaseStyle($left, $top, $width, $height, $angle, $opacity);
        $bg = $this->resolveFill($obj['fill'] ?? 'transparent');
        $style .= "background:{$bg};";

        $rx = (float)($obj['rx'] ?? 0);
        if ($rx > 0) {
            $style .= "border-radius:{$rx}px;";
        }

        $stroke = $obj['stroke'] ?? '';
        $strokeWidth = (float)($obj['strokeWidth'] ?? 0);
        if ($stroke && $strokeWidth > 0) {
            $style .= "border:{$strokeWidth}px solid {$stroke};box-sizing:border-box;";
        }

        return "<div style=\"{$style}\"></div>";
    }

    /**
     * Daire → HTML div border-radius:50%
     */
    private function convertCircle(array $obj, float $left, float $top, float $width, float $height, float $angle, float $opacity): string
    {
        $radius = (float)($obj['radius'] ?? 50) * (float)($obj['scaleX'] ?? 1);
        $diameter = $radius * 2;

        // Circle için center origin düzeltmesi zaten convertObject'de yapıldı
        // Burada width/height yerine diameter kullan
        $style = $this->buildBaseStyle($left, $top, $diameter, $diameter, $angle, $opacity);
        $bg = $this->resolveFill($obj['fill'] ?? 'transparent');
        $style .= "background:{$bg};border-radius:50%;";

        $stroke = $obj['stroke'] ?? '';
        $strokeWidth = (float)($obj['strokeWidth'] ?? 0);
        if ($stroke && $strokeWidth > 0) {
            $style .= "border:{$strokeWidth}px solid {$stroke};box-sizing:border-box;";
        }

        return "<div style=\"{$style}\"></div>";
    }

    /**
     * Grup → iç içe div
     */
    private function convertGroup(array $obj, array $product, array $fieldValues, int $cw, int $ch, float $left, float $top, float $width, float $height, float $angle, float $opacity, string $currency): string
    {
        $style = $this->buildBaseStyle($left, $top, $width, $height, $angle, $opacity);
        $style .= "overflow:hidden;";

        $innerHtml = '';
        foreach ($obj['objects'] as $child) {
            // Grup içindeki objelerin koordinatları grubun merkezine göre
            // Center origin varsayılır — grup içi göreceli konum
            $childLeft = (float)($child['left'] ?? 0) + $width / 2;
            $childTop  = (float)($child['top'] ?? 0) + $height / 2;

            // Child objenin boyutunu hesapla
            $childWidth = (float)($child['width'] ?? 0) * (float)($child['scaleX'] ?? 1);
            $childHeight = (float)($child['height'] ?? 0) * (float)($child['scaleY'] ?? 1);

            // Child center origin düzeltmesi
            $childOriginX = $child['originX'] ?? 'center';
            $childOriginY = $child['originY'] ?? 'center';
            if ($childOriginX === 'center') {
                $childLeft -= $childWidth / 2;
            }
            if ($childOriginY === 'center') {
                $childTop -= $childHeight / 2;
            }

            // Override child position — originX/Y'yi left/top olarak ayarla
            $child['left'] = $childLeft;
            $child['top']  = $childTop;
            $child['originX'] = 'left';
            $child['originY'] = 'top';

            $el = $this->convertObject($child, $product, $fieldValues, $cw, $ch, $currency);
            if ($el) $innerHtml .= $el;
        }

        return "<div style=\"{$style}\">{$innerHtml}</div>";
    }

    // ─────────────────────────────────────────────────────
    // Dinamik Alan Çözümleme
    // ─────────────────────────────────────────────────────

    /**
     * Ürün görsel URL çözümle
     */
    private function resolveProductImageUrl(array $product): string
    {
        $img = $product['image_url'] ?? $product['image'] ?? '';
        if (empty($img)) {
            // images JSON dizisinden ilk görseli al
            $images = $product['images'] ?? '';
            if (is_string($images) && !empty($images)) {
                $decoded = json_decode($images, true);
                if (is_array($decoded) && !empty($decoded)) {
                    $img = is_string($decoded[0]) ? $decoded[0] : ($decoded[0]['url'] ?? '');
                }
            } elseif (is_array($images) && !empty($images)) {
                $img = is_string($images[0]) ? $images[0] : ($images[0]['url'] ?? '');
            }
        }
        return $img ? $this->resolveMediaUrl($img) : '';
    }

    /**
     * Ürün video URL çözümle
     */
    private function resolveProductVideoUrl(array $product): string
    {
        $video = $product['video_url'] ?? '';
        if (empty($video)) {
            $videos = $product['videos'] ?? '';
            if (is_string($videos) && !empty($videos)) {
                $decoded = json_decode($videos, true);
                if (is_array($decoded) && !empty($decoded)) {
                    $video = is_string($decoded[0]) ? $decoded[0] : ($decoded[0]['url'] ?? '');
                }
            } elseif (is_array($videos) && !empty($videos)) {
                $video = is_string($videos[0]) ? $videos[0] : ($videos[0]['url'] ?? '');
            }
        }
        return $video ? $this->resolveMediaUrl($video) : '';
    }

    // ─────────────────────────────────────────────────────
    // Grid / Bölge Çözümleme
    // ─────────────────────────────────────────────────────

    /**
     * regionId → ürün dizisindeki index
     */
    private function resolveProductIndex(?string $regionId, $regionsConfig, string $gridLayout): int
    {
        if ($gridLayout === 'single' || $regionId === null) return 0;

        // "region-0", "region-1" vb. formatı
        if (preg_match('/region-(\d+)/', $regionId, $m)) {
            return (int)$m[1];
        }

        // regions_config varsa ona göre çöz
        if (is_array($regionsConfig)) {
            foreach ($regionsConfig as $idx => $region) {
                if (($region['id'] ?? '') === $regionId) {
                    return $idx;
                }
            }
        }

        return 0;
    }

    // ─────────────────────────────────────────────────────
    // HTML Oluşturma
    // ─────────────────────────────────────────────────────

    /**
     * Tam bağımsız HTML sayfası oluştur
     */
    /**
     * Tüm nesnelerden kullanılan font ailelerini topla
     */
    private function collectFonts(array $objects): array
    {
        $systemFonts = [
            'arial', 'helvetica', 'times new roman', 'times', 'courier new', 'courier',
            'georgia', 'verdana', 'tahoma', 'trebuchet ms', 'impact', 'comic sans ms',
            'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'
        ];

        $fonts = [];
        foreach ($objects as $obj) {
            $type = strtolower($obj['type'] ?? '');
            if (!in_array($type, ['textbox', 'i-text', 'text'], true)) continue;

            $fontFamily = $obj['fontFamily'] ?? 'Arial';
            // İlk font adını al (virgüllü listeden)
            $primaryFont = trim(explode(',', $fontFamily)[0], " '\"");
            $fontLower = strtolower($primaryFont);

            if (!empty($primaryFont) && !in_array($fontLower, $systemFonts, true)) {
                $fontWeight = $obj['fontWeight'] ?? 'normal';
                $fontStyle = $obj['fontStyle'] ?? 'normal';

                $key = $primaryFont;
                if (!isset($fonts[$key])) {
                    $fonts[$key] = ['weights' => []];
                }

                // Ağırlık topla (Google Fonts formatı)
                $w = ($fontWeight === 'bold' || (int)$fontWeight >= 700) ? '700' : '400';
                if ($fontStyle === 'italic') $w .= 'italic';
                $fonts[$key]['weights'][$w] = true;
            }

            // Grup içindeki nesneleri de tara
            if (!empty($obj['objects'])) {
                $subFonts = $this->collectFonts($obj['objects']);
                foreach ($subFonts as $fk => $fv) {
                    if (!isset($fonts[$fk])) {
                        $fonts[$fk] = $fv;
                    } else {
                        $fonts[$fk]['weights'] = array_merge($fonts[$fk]['weights'], $fv['weights']);
                    }
                }
            }
        }

        return $fonts;
    }

    /**
     * Google Fonts link etiketi oluştur
     */
    private function buildGoogleFontsLink(array $fonts): string
    {
        if (empty($fonts)) return '';

        $families = [];
        foreach ($fonts as $fontName => $info) {
            $weights = array_keys($info['weights']);
            sort($weights);

            $hasItalic = false;
            $weightList = [];
            foreach ($weights as $w) {
                if (strpos($w, 'italic') !== false) {
                    $hasItalic = true;
                    $weightList[] = '1,' . str_replace('italic', '', $w);
                } else {
                    $weightList[] = '0,' . $w;
                }
            }

            $safeName = str_replace(' ', '+', $fontName);
            if ($hasItalic) {
                $families[] = "family={$safeName}:ital,wght@" . implode(';', $weightList);
            } else {
                $wgts = array_map(function($w) { return str_replace('italic', '', $w); }, $weights);
                $families[] = "family={$safeName}:wght@" . implode(';', $wgts);
            }
        }

        if (empty($families)) return '';

        $url = 'https://fonts.googleapis.com/css2?' . implode('&', $families) . '&display=swap';
        return "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n    <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n    <link href=\"{$url}\" rel=\"stylesheet\">";
    }

    private function buildFullHtml(array $elements, int $width, int $height, string $title, array $designData, array $usedFonts = []): string
    {
        $bg = $this->resolveCanvasBackground($designData);
        $elementsHtml = implode("\n        ", $elements);
        $fontsLink = $this->buildGoogleFontsLink($usedFonts);

        $html = <<<HTML
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="Omnex Display Hub - FabricToHtml">
    <title>{$this->esc($title)}</title>
    {$fontsLink}
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #000;
        }
        .canvas-container {
            position: absolute;
            left: 0; top: 0;
            width: {$width}px;
            height: {$height}px;
            {$bg}
            overflow: hidden;
            transform-origin: top left;
            visibility: hidden;
        }
        img {
            display: block;
        }
        video {
            display: block;
            object-fit: cover;
        }
    </style>
</head>
<body>
    <div class="canvas-container" id="canvas">
        {$elementsHtml}
    </div>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
    <script>
        // Barcode render (align with print-html behavior)
        document.querySelectorAll('.print-barcode').forEach(function(svg) {
            var val = (svg.getAttribute('data-barcode') || '').trim();
            if (!val) return;

            var w = parseInt(svg.getAttribute('data-width')) || 100;
            var h = parseInt(svg.getAttribute('data-height')) || 60;
            var cleaned = val.replace(/[^0-9]/g, '');
            var format = 'CODE128';
            if (/^\d{13}$/.test(cleaned)) format = 'EAN13';
            else if (/^\d{8}$/.test(cleaned)) format = 'EAN8';
            else if (/^\d{12}$/.test(cleaned)) format = 'UPC';

            // Keep value text inside the allocated object height.
            var barsHeight = Math.max(20, Math.round(h * 0.7));
            var fontSize = Math.max(8, Math.min(14, Math.round(h * 0.15)));
            var lineWidth = Math.max(1, w / 80);

            try {
                JsBarcode(svg, val, {
                    format: format,
                    displayValue: true,
                    fontSize: fontSize,
                    width: lineWidth,
                    height: barsHeight,
                    margin: 0,
                    textMargin: 2
                });
            } catch(e) {
                try { JsBarcode(svg, val, { format: 'CODE128', displayValue: true }); } catch(e2) {}
            }
        });
        // Ekrana sığdırma (contain)
        function fitToScreen() {
            var c = document.getElementById('canvas');
            if (!c) return;
            var sw = window.innerWidth, sh = window.innerHeight;
            var cw = {$width}, ch = {$height};
            var scale = Math.min(sw / cw, sh / ch);
            var ox = (sw - cw * scale) / 2;
            var oy = (sh - ch * scale) / 2;
            c.style.transform = 'translate(' + ox + 'px,' + oy + 'px) scale(' + scale + ')';
        }
        fitToScreen();
        document.getElementById('canvas').style.visibility = 'visible';
        window.addEventListener('resize', fitToScreen);
    </script>
</body>
</html>
HTML;

        return $html;
    }

    /**
     * Canvas arkaplan çözümle (renk, gradient veya görsel)
     */
    private function resolveCanvasBackground(array $designData): string
    {
        $bg = $designData['background'] ?? $designData['backgroundColor'] ?? '#ffffff';

        if (is_array($bg)) {
            // Gradient objesi
            if (($bg['type'] ?? '') === 'linear') {
                $stops = [];
                foreach ($bg['colorStops'] ?? [] as $stop) {
                    $offset = round(((float)($stop['offset'] ?? 0)) * 100);
                    $color = $stop['color'] ?? '#fff';
                    $stops[] = "{$color} {$offset}%";
                }
                $angle = (float)($bg['angle'] ?? 0) + 90;
                return "background: linear-gradient({$angle}deg, " . implode(', ', $stops) . ");";
            }
            if (($bg['type'] ?? '') === 'radial') {
                $stops = [];
                foreach ($bg['colorStops'] ?? [] as $stop) {
                    $offset = round(((float)($stop['offset'] ?? 0)) * 100);
                    $color = $stop['color'] ?? '#fff';
                    $stops[] = "{$color} {$offset}%";
                }
                return "background: radial-gradient(circle, " . implode(', ', $stops) . ");";
            }
            return "background: #ffffff;";
        }

        if (is_string($bg) && !empty($bg)) {
            // Görsel URL mü?
            if (preg_match('/\.(jpg|jpeg|png|gif|webp|svg)$/i', $bg) || strpos($bg, 'data:image') === 0) {
                $resolved = $this->resolveMediaUrl($bg);
                return "background: url('{$this->escAttr($resolved)}') center/cover no-repeat;";
            }
            return "background: {$bg};";
        }

        return "background: #ffffff;";
    }

    // ─────────────────────────────────────────────────────
    // Yardımcı Metodlar
    // ─────────────────────────────────────────────────────

    private function buildBaseStyle(float $left, float $top, float $width, float $height, float $angle, float $opacity): string
    {
        $style = "position:absolute;";
        $style .= "left:{$left}px;top:{$top}px;";
        $style .= "width:{$width}px;height:{$height}px;";

        if ($angle !== 0.0) {
            $style .= "transform:rotate({$angle}deg);transform-origin:center center;";
        }
        if ($opacity < 1) {
            $style .= "opacity:{$opacity};";
        }

        return $style;
    }

    /**
     * Fabric.js fill → CSS background
     * String renk veya gradient objesi olabilir.
     */
    private function resolveFill($fill): string
    {
        if (is_string($fill)) {
            return empty($fill) ? 'transparent' : $fill;
        }
        if (is_array($fill)) {
            if (($fill['type'] ?? '') === 'linear') {
                $stops = [];
                foreach ($fill['colorStops'] ?? [] as $s) {
                    $offset = round(((float)($s['offset'] ?? 0)) * 100);
                    $stops[] = ($s['color'] ?? '#fff') . " {$offset}%";
                }
                $angle = (float)($fill['angle'] ?? 0) + 90;
                return "linear-gradient({$angle}deg, " . implode(', ', $stops) . ")";
            }
            if (($fill['type'] ?? '') === 'radial') {
                $stops = [];
                foreach ($fill['colorStops'] ?? [] as $s) {
                    $offset = round(((float)($s['offset'] ?? 0)) * 100);
                    $stops[] = ($s['color'] ?? '#fff') . " {$offset}%";
                }
                return "radial-gradient(circle, " . implode(', ', $stops) . ")";
            }
        }
        return 'transparent';
    }

    /**
     * Medya URL çözümle (relative → absolute)
     */
    private function resolveMediaUrl(string $url): string
    {
        if (empty($url)) return '';

        // data: URL olduğu gibi bırak
        if (strpos($url, 'data:') === 0) return $url;

        // Tam URL ise olduğu gibi
        if (preg_match('#^https?://#', $url)) return $url;

        // Windows absolute path → serve.php proxy
        if (preg_match('/^[A-Za-z]:[\\\\\/]/', $url)) {
            return $this->basePath . '/api/media/serve.php?path=' . urlencode($url);
        }

        // Zaten basePath ile başlıyorsa tekrar ekleme
        if ($this->basePath && strpos($url, $this->basePath . '/') === 0) {
            return $url;
        }

        // Absolute path (/ ile başlayan) — basePath zaten içinde olabilir
        if (strpos($url, '/') === 0) {
            return $url;
        }

        // Göreceli yol → basePath ekle
        return $this->basePath . '/' . ltrim($url, '/');
    }

    private function isVideoUrl(string $url): bool
    {
        return (bool)preg_match('/\.(mp4|webm|ogg|mov|m3u8)(\?.*)?$/i', $url);
    }

    private function detectBasePath(): string
    {
        // 1. config.php BASE_PATH + DOCUMENT_ROOT ile web yolu hesapla
        if (defined('BASE_PATH')) {
            $docRoot = str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT'] ?? '');
            $fsBasePath = str_replace('\\', '/', BASE_PATH);
            if ($docRoot && strpos($fsBasePath, $docRoot) === 0) {
                return rtrim(substr($fsBasePath, strlen($docRoot)), '/');
            }
        }

        // 2. SCRIPT_NAME'den tespit et
        $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
        if ($scriptName) {
            $dir = dirname(dirname($scriptName)); // /market-etiket-sistemi
            return rtrim($dir, '/');
        }

        // 3. Fallback — proje dizin adı
        return '/market-etiket-sistemi';
    }

    private function parseDesignData($data): array
    {
        if (is_array($data)) return $data;
        if (is_string($data) && !empty($data)) {
            $decoded = json_decode($data, true);
            return is_array($decoded) ? $decoded : [];
        }
        return [];
    }

    private function formatDate(string $date): string
    {
        if (empty($date)) return '';
        try {
            return (new \DateTime($date))->format('d.m.Y');
        } catch (\Exception $e) {
            return $date;
        }
    }

    private function esc(string $str): string
    {
        return htmlspecialchars($str, ENT_QUOTES, 'UTF-8');
    }

    private function escAttr(string $str): string
    {
        return htmlspecialchars($str, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}
