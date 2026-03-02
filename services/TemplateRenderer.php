<?php
/**
 * Template Renderer Service
 *
 * HTML şablonlarını ürün verileriyle render eder ve
 * PavoDisplay cihazlarına göndermek için görsel oluşturur.
 */

class TemplateRenderer
{
    private $templatePath;
    private $outputPath;

    public function __construct()
    {
        $this->templatePath = STORAGE_PATH . '/templates';
        $this->outputPath = STORAGE_PATH . '/renders';

        // Output dizini yoksa oluştur
        if (!is_dir($this->outputPath)) {
            mkdir($this->outputPath, 0755, true);
        }
    }

    /**
     * Şablonu ürün verileriyle render et
     *
     * @param string $templateFile Şablon dosya adı (örn: premium_vertical_product_label.html)
     * @param array $product Ürün verileri
     * @param array $options Ek seçenekler (width, height, company vb.)
     * @return string Render edilmiş HTML
     */
    public function renderHtml($templateFile, $product, $options = [])
    {
        $templateFilePath = $this->templatePath . '/' . $templateFile;

        if (!file_exists($templateFilePath)) {
            throw new Exception("Template file not found: {$templateFile}");
        }

        $html = file_get_contents($templateFilePath);

        // Fiyatı parçala
        $price = floatval($product['current_price'] ?? 0);
        $priceMain = floor($price);
        $priceDecimal = str_pad(round(($price - $priceMain) * 100), 2, '0', STR_PAD_LEFT);

        // QR Code URL oluştur (dinamik veya placeholder)
        $qrCodeUrl = $this->generateQrCodeUrl($product);

        // Barcode URL oluştur
        $barcodeUrl = $this->generateBarcodeUrl($product['barcode'] ?? $product['sku'] ?? '');

        // İndirim yüzdesi hesapla
        $currentPrice = floatval($product['current_price'] ?? 0);
        $previousPrice = floatval($product['previous_price'] ?? 0);
        $discountPercent = '';
        if ($previousPrice > 0 && $currentPrice < $previousPrice) {
            $discountPercent = '%' . round((($previousPrice - $currentPrice) / $previousPrice) * 100);
        }

        // Değişkenleri hazırla
        $variables = [
            // Boyutlar
            '{{width}}' => $options['width'] ?? 800,
            '{{height}}' => $options['height'] ?? 1280,

            // Temel Ürün bilgileri
            '{{product_name}}' => $this->escapeHtml($product['name'] ?? ''),
            '{{sku}}' => $this->escapeHtml($product['sku'] ?? ''),
            '{{barcode}}' => $this->escapeHtml($product['barcode'] ?? ''),
            '{{description}}' => $this->escapeHtml($product['description'] ?? ''),
            '{{slug}}' => $this->escapeHtml($product['slug'] ?? ''),

            // Fiyat bilgileri
            '{{current_price}}' => number_format($price, 2, ',', '.'),
            '{{price_main}}' => $priceMain,
            '{{price_decimal}}' => $priceDecimal,
            '{{previous_price}}' => number_format($previousPrice, 2, ',', '.'),
            '{{currency}}' => $options['currency'] ?? '₺',
            '{{vat_rate}}' => $this->escapeHtml($product['vat_rate'] ?? ''),
            '{{discount_percent}}' => $discountPercent,
            '{{price_updated_at}}' => $this->formatDate($product['price_updated_at'] ?? ''),
            '{{campaign_text}}' => $this->escapeHtml($product['campaign_text'] ?? ''),
            '{{price_valid_until}}' => $this->formatDate($product['price_valid_until'] ?? ''),

            // Kategori ve Marka
            '{{category}}' => $this->escapeHtml($product['category'] ?? $product['category_name'] ?? ''),
            '{{subcategory}}' => $this->escapeHtml($product['subcategory'] ?? ''),
            '{{brand}}' => $this->escapeHtml($product['brand'] ?? ''),

            // Ürün Detayları
            '{{unit}}' => $this->escapeHtml($product['unit'] ?? ''),
            '{{weight}}' => $this->escapeHtml($product['weight'] ?? ''),
            '{{stock}}' => $this->escapeHtml($product['stock'] ?? ''),
            '{{origin}}' => $this->escapeHtml($product['origin'] ?? ''),
            '{{production_type}}' => $this->escapeHtml($product['production_type'] ?? ''),
            '{{storage_info}}' => $this->escapeHtml($product['storage_info'] ?? ''),

            // Konum ve Lojistik
            '{{shelf_location}}' => $this->escapeHtml($product['shelf_location'] ?? ''),
            '{{supplier_code}}' => $this->escapeHtml($product['supplier_code'] ?? ''),

            // HAL Künye alanları
            '{{kunye_no}}' => $this->escapeHtml($product['kunye_no'] ?? ''),
            '{{uretici_adi}}' => $this->escapeHtml($product['uretici_adi'] ?? ''),
            '{{malin_adi}}' => $this->escapeHtml($product['malin_adi'] ?? ''),
            '{{malin_cinsi}}' => $this->escapeHtml($product['malin_cinsi'] ?? ''),
            '{{malin_turu}}' => $this->escapeHtml($product['malin_turu'] ?? ''),
            '{{uretim_yeri}}' => $this->escapeHtml($product['uretim_yeri'] ?? ''),
            '{{ilk_bildirim_tarihi}}' => $this->formatDate($product['ilk_bildirim_tarihi'] ?? ''),
            '{{malin_sahibi}}' => $this->escapeHtml($product['malin_sahibi'] ?? ''),
            '{{tuketim_yeri}}' => $this->escapeHtml($product['tuketim_yeri'] ?? ''),
            '{{tuketim_bildirim_tarihi}}' => $this->formatDate($product['tuketim_bildirim_tarihi'] ?? ''),
            '{{gumruk_kapisi}}' => $this->escapeHtml($product['gumruk_kapisi'] ?? ''),
            '{{uretim_ithal_tarihi}}' => $this->formatDate($product['uretim_ithal_tarihi'] ?? ''),
            '{{miktar}}' => $this->escapeHtml($product['miktar'] ?? ''),
            '{{alis_fiyati}}' => isset($product['alis_fiyati']) && $product['alis_fiyati'] !== '' ? number_format(floatval($product['alis_fiyati']), 2, ',', '.') : '',
            '{{isletme_adi}}' => $this->escapeHtml($product['isletme_adi'] ?? ''),
            '{{uretim_sekli}}' => $this->escapeHtml($product['uretim_sekli'] ?? $product['production_type'] ?? ''),
            '{{sertifikasyon_kurulusu}}' => $this->escapeHtml($product['sertifikasyon_kurulusu'] ?? ''),
            '{{sertifika_no}}' => $this->escapeHtml($product['sertifika_no'] ?? ''),
            '{{diger_bilgiler}}' => $this->escapeHtml($product['diger_bilgiler'] ?? ''),
            '{{kalan_miktar}}' => $this->escapeHtml($product['kalan_miktar'] ?? ''),
            '{{birim}}' => $this->escapeHtml($product['birim'] ?? ''),
            '{{bildirim_turu}}' => $this->escapeHtml($product['bildirim_turu'] ?? ''),
            '{{belge_no}}' => $this->escapeHtml($product['belge_no'] ?? ''),
            '{{belge_tipi}}' => $this->escapeHtml($product['belge_tipi'] ?? ''),
            '{{analiz_status}}' => $this->escapeHtml($product['analiz_status'] ?? ''),

            // Görseller ve Medya
            '{{image_url}}' => $this->getImageUrl($product),
            '{{video_url}}' => $this->escapeHtml($product['video_url'] ?? ''),
            '{{videos}}' => $this->escapeHtml($product['videos'] ?? ''),
            '{{qr_code_url}}' => $qrCodeUrl,
            '{{barcode_url}}' => $barcodeUrl,

            // Özel Alanlar
            '{{date_today}}' => date('d.m.Y'),
            '{{date_time}}' => date('d.m.Y H:i'),

            // Paket/Koli/Menü Alanları
            '{{bundle_name}}' => $this->escapeHtml($product['bundle_name'] ?? ''),
            '{{bundle_type}}' => $this->escapeHtml($product['bundle_type'] ?? ''),
            '{{bundle_description}}' => $this->escapeHtml($product['bundle_description'] ?? ''),
            '{{bundle_sku}}' => $this->escapeHtml($product['bundle_sku'] ?? ''),
            '{{bundle_barcode}}' => $this->escapeHtml($product['bundle_barcode'] ?? ''),
            '{{bundle_category}}' => $this->escapeHtml($product['bundle_category'] ?? ''),
            '{{bundle_total_price}}' => isset($product['bundle_total_price']) ? number_format(floatval($product['bundle_total_price']), 2, ',', '.') : '',
            '{{bundle_discount_percent}}' => isset($product['bundle_discount_percent']) ? '%' . round(floatval($product['bundle_discount_percent'])) : '',
            '{{bundle_final_price}}' => isset($product['bundle_final_price']) ? number_format(floatval($product['bundle_final_price']), 2, ',', '.') : '',
            '{{bundle_item_count}}' => $this->escapeHtml($product['bundle_item_count'] ?? ''),
            '{{bundle_items_list}}' => $this->escapeHtml($product['bundle_items_list'] ?? ''),
            '{{bundle_valid_from}}' => $this->formatDate($product['bundle_valid_from'] ?? ''),
            '{{bundle_valid_until}}' => $this->formatDate($product['bundle_valid_until'] ?? ''),
            '{{bundle_image_url}}' => $this->escapeHtml($product['bundle_image_url'] ?? ''),

            // Firma bilgileri
            '{{company_name}}' => $this->escapeHtml($options['company_name'] ?? 'OMNEX'),
            '{{company_logo}}' => $options['company_logo'] ?? '',

            // Cihaz bilgileri (opsiyonel)
            '{{device_ip}}' => $options['device_ip'] ?? '',
            '{{device_id}}' => $options['device_id'] ?? ''
        ];

        // Değişkenleri yerine koy
        foreach ($variables as $key => $value) {
            $html = str_replace($key, $value, $html);
        }

        return $html;
    }

    /**
     * HTML'i PNG görsel olarak render et
     *
     * @param string $html Render edilmiş HTML
     * @param string $outputFileName Çıktı dosya adı
     * @param int $width Genişlik
     * @param int $height Yükseklik
     * @return string Oluşturulan dosyanın yolu
     */
    public function renderToImage($html, $outputFileName, $width = 800, $height = 1280)
    {
        $outputFile = $this->outputPath . '/' . $outputFileName;
        $htmlFile = $this->outputPath . '/' . pathinfo($outputFileName, PATHINFO_FILENAME) . '.html';

        // HTML'i geçici dosyaya kaydet
        file_put_contents($htmlFile, $html);

        // Chrome/Chromium ile render et (eğer varsa)
        $chromePath = $this->findChromePath();

        if ($chromePath) {
            $safeWidth = max(1, (int)$width);
            $safeHeight = max(1, (int)$height);
            $safeOutputFile = escapeshellarg($outputFile);
            $htmlRealPath = realpath($htmlFile);
            $safeHtmlFile = escapeshellarg('file://' . str_replace('\\', '/', $htmlRealPath ?: $htmlFile));
            $command = sprintf(
                '%s --headless --disable-gpu --screenshot=%s --window-size=%d,%d --hide-scrollbars %s',
                escapeshellarg($chromePath),
                $safeOutputFile,
                $safeWidth,
                $safeHeight,
                $safeHtmlFile
            );

            exec($command, $output, $returnCode);

            if ($returnCode === 0 && file_exists($outputFile)) {
                // Geçici HTML dosyasını sil
                unlink($htmlFile);
                return $outputFile;
            }
        }

        // Chrome yoksa HTML dosyasını döndür (manuel render gerekir)
        return $htmlFile;
    }

    /**
     * Ürün için tam render işlemi
     *
     * @param string $templateFile Şablon dosyası
     * @param array $product Ürün verileri
     * @param string $deviceId Cihaz ID
     * @param array $options Ek seçenekler
     * @return array ['html' => ..., 'image' => ..., 'filename' => ...]
     */
    public function renderForDevice($templateFile, $product, $deviceId, $options = [])
    {
        $width = $options['width'] ?? 800;
        $height = $options['height'] ?? 1280;

        // HTML render et
        $html = $this->renderHtml($templateFile, $product, array_merge($options, [
            'width' => $width,
            'height' => $height,
            'device_id' => $deviceId
        ]));

        // Dosya adı oluştur
        $timestamp = date('YmdHis');
        $productSlug = $this->slugify($product['name'] ?? 'product');
        $filename = "{$deviceId}_{$productSlug}_{$timestamp}";

        // Görsel oluştur
        $imagePath = $this->renderToImage($html, $filename . '.png', $width, $height);

        return [
            'html' => $html,
            'html_file' => $this->outputPath . '/' . $filename . '.html',
            'image_file' => $imagePath,
            'filename' => $filename,
            'width' => $width,
            'height' => $height
        ];
    }

    /**
     * HTML'den Base64 PNG oluştur (GD ile basit render)
     * Chrome olmadan basit bir görsel oluşturur
     *
     * @param array $product Ürün verileri
     * @param int $width Genişlik
     * @param int $height Yükseklik
     * @return string Base64 encoded PNG
     */
    public function renderSimpleImage($product, $width = 800, $height = 1280, $options = [])
    {
        // GD ile basit görsel oluştur
        $image = imagecreatetruecolor($width, $height);

        // Renkler
        $white = imagecolorallocate($image, 255, 255, 255);
        $black = imagecolorallocate($image, 30, 41, 59);
        $gray = imagecolorallocate($image, 100, 116, 139);
        $red = imagecolorallocate($image, 225, 29, 72);
        $lightGray = imagecolorallocate($image, 241, 245, 249);

        // Arkaplan
        imagefill($image, 0, 0, $white);

        // Üst kısım (görsel alanı - koyu arkaplan)
        $imageAreaHeight = (int)($height * 0.6);
        $darkBg = imagecolorallocate($image, 26, 26, 46);
        imagefilledrectangle($image, 0, 0, $width, $imageAreaHeight, $darkBg);

        // Ürün görseli varsa yükle
        $productImageUrl = $this->getImageUrl($product);
        if ($productImageUrl && filter_var($productImageUrl, FILTER_VALIDATE_URL)) {
            $productImage = @imagecreatefromstring(file_get_contents($productImageUrl));
            if ($productImage) {
                $srcWidth = imagesx($productImage);
                $srcHeight = imagesy($productImage);

                // Aspect ratio koru
                $ratio = min($width / $srcWidth, $imageAreaHeight / $srcHeight);
                $newWidth = (int)($srcWidth * $ratio);
                $newHeight = (int)($srcHeight * $ratio);
                $x = (int)(($width - $newWidth) / 2);
                $y = (int)(($imageAreaHeight - $newHeight) / 2);

                imagecopyresampled($image, $productImage, $x, $y, 0, 0, $newWidth, $newHeight, $srcWidth, $srcHeight);
                imagedestroy($productImage);
            }
        }

        // Alt kısım başlangıcı
        $infoY = $imageAreaHeight + 24;
        $paddingX = 32;

        // Font (varsayılan)
        $fontFile = null; // TrueType font dosyası yoksa varsayılan kullan

        // Kategori
        $category = strtoupper($product['category'] ?? $product['category_name'] ?? 'ÜRÜN');
        if ($fontFile && file_exists($fontFile)) {
            imagettftext($image, 11, 0, $paddingX, $infoY, $red, $fontFile, $category);
        } else {
            imagestring($image, 3, $paddingX, $infoY - 10, $category, $red);
        }
        $infoY += 24;

        // Ürün adı
        $productName = $product['name'] ?? 'Ürün Adı';
        if ($fontFile && file_exists($fontFile)) {
            imagettftext($image, 28, 0, $paddingX, $infoY + 28, $black, $fontFile, $productName);
        } else {
            imagestring($image, 5, $paddingX, $infoY, $productName, $black);
        }
        $infoY += 60;

        // Fiyat
        $price = floatval($product['current_price'] ?? 0);
        $priceMain = floor($price);
        $priceDecimal = str_pad(round(($price - $priceMain) * 100), 2, '0', STR_PAD_LEFT);
        $currencySymbol = $options['currency'] ?? '₺';
        $priceText = "{$currencySymbol} {$priceMain}.{$priceDecimal}";

        $priceY = $infoY + 80;
        if ($fontFile && file_exists($fontFile)) {
            imagettftext($image, 48, 0, $width - 200, $priceY, $black, $fontFile, $priceText);
        } else {
            // Büyük font ile fiyat
            imagestring($image, 5, $width - 150, $priceY - 20, $priceText, $black);
        }

        // Ayırıcı çizgi
        $lineY = $height - 180;
        imageline($image, $paddingX, $lineY, $width - $paddingX, $lineY, $lightGray);

        // Detaylar
        $detailY = $lineY + 20;
        $details = [
            'Menşei: ' . ($product['origin'] ?? 'Türkiye'),
            'Ağırlık: ' . ($product['weight'] ?? $product['unit'] ?? '1 Adet'),
            'Saklama: ' . ($product['storage_info'] ?? 'Normal koşullar')
        ];

        foreach ($details as $detail) {
            imagestring($image, 2, $paddingX, $detailY, $detail, $gray);
            $detailY += 18;
        }

        // Barcode text
        $barcode = $product['barcode'] ?? $product['sku'] ?? '';
        if ($barcode) {
            imagestring($image, 2, $width - 150, $height - 80, $barcode, $gray);
        }

        // PNG olarak çıktı al
        ob_start();
        imagepng($image);
        $imageData = ob_get_clean();
        imagedestroy($image);

        return base64_encode($imageData);
    }

    /**
     * QR Code URL oluştur
     */
    private function generateQrCodeUrl($product)
    {
        $data = $product['barcode'] ?? $product['sku'] ?? $product['id'] ?? '';
        if (empty($data)) return '';

        // Google Charts QR API (basit çözüm)
        return 'https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=' . urlencode($data);
    }

    /**
     * Barcode URL oluştur
     */
    private function generateBarcodeUrl($barcode)
    {
        if (empty($barcode)) return '';

        // Barcode görsel API
        return 'https://barcodeapi.org/api/128/' . urlencode($barcode);
    }

    /**
     * Ürün görsel URL'si
     */
    private function getImageUrl($product)
    {
        $imageUrl = $product['image_url'] ?? $product['image'] ?? '';

        if (empty($imageUrl)) {
            // Varsayılan placeholder
            return 'https://via.placeholder.com/800x768/1a1a2e/ffffff?text=' . urlencode($product['name'] ?? 'Ürün');
        }

        // Göreceli yol ise tam yola çevir
        if (!filter_var($imageUrl, FILTER_VALIDATE_URL)) {
            $basePath = defined('BASE_URL') ? BASE_URL : '';
            return $basePath . '/' . ltrim($imageUrl, '/');
        }

        return $imageUrl;
    }

    /**
     * Chrome/Chromium yolunu bul
     */
    private function findChromePath()
    {
        $paths = [
            // Windows
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            // Linux
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            // macOS
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        ];

        foreach ($paths as $path) {
            if (file_exists($path)) {
                return $path;
            }
        }

        return null;
    }

    /**
     * HTML karakterlerini escape et
     */
    private function escapeHtml($string)
    {
        return htmlspecialchars($string ?? '', ENT_QUOTES, 'UTF-8');
    }

    /**
     * Tarih formatlama
     */
    private function formatDate($date)
    {
        if (empty($date)) {
            return '';
        }
        try {
            $dateObj = new DateTime($date);
            return $dateObj->format('d.m.Y');
        } catch (Exception $e) {
            return $date; // Parse edilemezse olduğu gibi döndür
        }
    }

    /**
     * Slug oluştur
     */
    private function slugify($string)
    {
        $string = mb_strtolower($string, 'UTF-8');
        $string = preg_replace('/[^a-z0-9]+/u', '-', $string);
        return trim($string, '-');
    }

    /**
     * Mevcut şablonları listele
     */
    public function getAvailableTemplates()
    {
        $templates = [];
        $files = glob($this->templatePath . '/*.html');

        foreach ($files as $file) {
            $filename = basename($file);
            $name = pathinfo($filename, PATHINFO_FILENAME);
            $templates[] = [
                'file' => $filename,
                'name' => ucwords(str_replace('_', ' ', $name)),
                'path' => $file
            ];
        }

        return $templates;
    }
}
