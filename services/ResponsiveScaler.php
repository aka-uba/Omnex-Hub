<?php
/**
 * ResponsiveScaler - Şablon Responsive Ölçekleme Servisi
 *
 * Şablon design_data'sını kaynak canvas boyutundan hedef cihaz boyutuna
 * oransal olarak ölçekler. Grid bölgeleri yüzde bazlı olduğu için
 * otomatik adapte olur; objeler bölge-içi relative koordinatlarla
 * yeniden konumlandırılır.
 *
 * KULLANIM:
 *   $scaler = new ResponsiveScaler();
 *   $scaledData = $scaler->scale($designData, 800, 1280, 400, 300, 'contain', $regionsConfig);
 *
 * @package OmnexDisplayHub\Services
 * @version 1.0.0
 */

class ResponsiveScaler
{
    /**
     * Standart grid layout tanımları (DevicePresets.js ile senkron)
     * Backend'de grid layout ID'sine göre bölge yüzdelerini çözmek için
     */
    private static $gridLayouts = [
        'single' => [
            ['id' => 'main', 'x' => 0, 'y' => 0, 'widthPercent' => 100, 'heightPercent' => 100]
        ],
        'split_horizontal' => [
            ['id' => 'left', 'x' => 0, 'y' => 0, 'widthPercent' => 50, 'heightPercent' => 100],
            ['id' => 'right', 'x' => 50, 'y' => 0, 'widthPercent' => 50, 'heightPercent' => 100]
        ],
        'split_vertical' => [
            ['id' => 'top', 'x' => 0, 'y' => 0, 'widthPercent' => 100, 'heightPercent' => 50],
            ['id' => 'bottom', 'x' => 0, 'y' => 50, 'widthPercent' => 100, 'heightPercent' => 50]
        ],
        'grid_2x2' => [
            ['id' => 'top-left', 'x' => 0, 'y' => 0, 'widthPercent' => 50, 'heightPercent' => 50],
            ['id' => 'top-right', 'x' => 50, 'y' => 0, 'widthPercent' => 50, 'heightPercent' => 50],
            ['id' => 'bottom-left', 'x' => 0, 'y' => 50, 'widthPercent' => 50, 'heightPercent' => 50],
            ['id' => 'bottom-right', 'x' => 50, 'y' => 50, 'widthPercent' => 50, 'heightPercent' => 50]
        ],
        'header_content' => [
            ['id' => 'header', 'x' => 0, 'y' => 0, 'widthPercent' => 100, 'heightPercent' => 20],
            ['id' => 'content', 'x' => 0, 'y' => 20, 'widthPercent' => 100, 'heightPercent' => 80]
        ],
        'header_content_footer' => [
            ['id' => 'header', 'x' => 0, 'y' => 0, 'widthPercent' => 100, 'heightPercent' => 15],
            ['id' => 'content', 'x' => 0, 'y' => 15, 'widthPercent' => 100, 'heightPercent' => 70],
            ['id' => 'footer', 'x' => 0, 'y' => 85, 'widthPercent' => 100, 'heightPercent' => 15]
        ],
        'sidebar_content' => [
            ['id' => 'sidebar', 'x' => 0, 'y' => 0, 'widthPercent' => 30, 'heightPercent' => 100],
            ['id' => 'content', 'x' => 30, 'y' => 0, 'widthPercent' => 70, 'heightPercent' => 100]
        ],
        'content_sidebar' => [
            ['id' => 'content', 'x' => 0, 'y' => 0, 'widthPercent' => 70, 'heightPercent' => 100],
            ['id' => 'sidebar', 'x' => 70, 'y' => 0, 'widthPercent' => 30, 'heightPercent' => 100]
        ],
        'media_labels' => [
            ['id' => 'media', 'x' => 0, 'y' => 0, 'widthPercent' => 100, 'heightPercent' => 40],
            ['id' => 'labels', 'x' => 0, 'y' => 40, 'widthPercent' => 100, 'heightPercent' => 60]
        ],
        'labels_media' => [
            ['id' => 'labels', 'x' => 0, 'y' => 0, 'widthPercent' => 100, 'heightPercent' => 60],
            ['id' => 'media', 'x' => 0, 'y' => 60, 'widthPercent' => 100, 'heightPercent' => 40]
        ],
        'triple_column' => [
            ['id' => 'left', 'x' => 0, 'y' => 0, 'widthPercent' => 33.33, 'heightPercent' => 100],
            ['id' => 'center', 'x' => 33.33, 'y' => 0, 'widthPercent' => 33.34, 'heightPercent' => 100],
            ['id' => 'right', 'x' => 66.67, 'y' => 0, 'widthPercent' => 33.33, 'heightPercent' => 100]
        ],
        'triple_row' => [
            ['id' => 'top', 'x' => 0, 'y' => 0, 'widthPercent' => 100, 'heightPercent' => 33.33],
            ['id' => 'middle', 'x' => 0, 'y' => 33.33, 'widthPercent' => 100, 'heightPercent' => 33.34],
            ['id' => 'bottom', 'x' => 0, 'y' => 66.67, 'widthPercent' => 100, 'heightPercent' => 33.33]
        ],
        'featured_grid' => [
            ['id' => 'featured', 'x' => 0, 'y' => 0, 'widthPercent' => 60, 'heightPercent' => 100],
            ['id' => 'top-right', 'x' => 60, 'y' => 0, 'widthPercent' => 40, 'heightPercent' => 50],
            ['id' => 'bottom-right', 'x' => 60, 'y' => 50, 'widthPercent' => 40, 'heightPercent' => 50]
        ],
    ];

    /**
     * Design data'yı kaynak boyuttan hedef boyuta ölçekle.
     *
     * @param array  $designData      Canvas JSON objects dizisi
     * @param int    $srcW            Tasarım canvas genişliği (px)
     * @param int    $srcH            Tasarım canvas yüksekliği (px)
     * @param int    $dstW            Hedef cihaz genişliği (px)
     * @param int    $dstH            Hedef cihaz yüksekliği (px)
     * @param string $scalePolicy     'contain' | 'cover' | 'stretch'
     * @param string|null $gridLayoutId  Grid layout ID (bölge yüzdeleri için)
     * @param array|null  $regionsConfig Özel regions config (varsa gridLayoutId'yi override eder)
     * @return array Ölçeklenmiş design data
     */
    public function scale(
        array $designData,
        int $srcW,
        int $srcH,
        int $dstW,
        int $dstH,
        string $scalePolicy = 'contain',
        ?string $gridLayoutId = null,
        ?array $regionsConfig = null
    ): array {
        // Boyutlar aynıysa değişiklik yok
        if ($srcW === $dstW && $srcH === $dstH) {
            return $designData;
        }

        // Ölçek faktörlerini hesapla
        $scaleFactors = $this->computeScaleFactors($srcW, $srcH, $dstW, $dstH, $scalePolicy);

        // Bölge tanımlarını çöz
        $regions = $this->resolveRegions($gridLayoutId, $regionsConfig);

        // Her objeyi ölçekle
        $scaledObjects = [];
        foreach ($designData as $obj) {
            $scaledObjects[] = $this->scaleObject(
                $obj, $scaleFactors, $regions, $srcW, $srcH, $dstW, $dstH
            );
        }

        return $scaledObjects;
    }

    /**
     * Ölçek faktörlerini hesapla.
     *
     * @param int    $srcW
     * @param int    $srcH
     * @param int    $dstW
     * @param int    $dstH
     * @param string $policy  'contain' | 'cover' | 'stretch'
     * @return array ['scaleX' => float, 'scaleY' => float, 'offsetX' => float, 'offsetY' => float]
     */
    public function computeScaleFactors(int $srcW, int $srcH, int $dstW, int $dstH, string $policy): array
    {
        $rawScaleX = $dstW / max(1, $srcW);
        $rawScaleY = $dstH / max(1, $srcH);

        switch ($policy) {
            case 'contain':
                // En küçük oranı kullan (letterbox)
                $uniformScale = min($rawScaleX, $rawScaleY);
                $effectiveW = $srcW * $uniformScale;
                $effectiveH = $srcH * $uniformScale;
                return [
                    'scaleX'  => $uniformScale,
                    'scaleY'  => $uniformScale,
                    'offsetX' => ($dstW - $effectiveW) / 2,
                    'offsetY' => ($dstH - $effectiveH) / 2,
                ];

            case 'cover':
                // En büyük oranı kullan (crop)
                $uniformScale = max($rawScaleX, $rawScaleY);
                $effectiveW = $srcW * $uniformScale;
                $effectiveH = $srcH * $uniformScale;
                return [
                    'scaleX'  => $uniformScale,
                    'scaleY'  => $uniformScale,
                    'offsetX' => ($dstW - $effectiveW) / 2,
                    'offsetY' => ($dstH - $effectiveH) / 2,
                ];

            case 'stretch':
            default:
                // Bağımsız X/Y ölçekleme
                return [
                    'scaleX'  => $rawScaleX,
                    'scaleY'  => $rawScaleY,
                    'offsetX' => 0,
                    'offsetY' => 0,
                ];
        }
    }

    /**
     * Grid layout ID veya regions_config'den bölge tanımlarını çöz.
     *
     * @param string|null $gridLayoutId
     * @param array|null  $regionsConfig
     * @return array  [{id, x, y, widthPercent, heightPercent}, ...]
     */
    private function resolveRegions(?string $gridLayoutId, ?array $regionsConfig): array
    {
        // Öncelik: regionsConfig (özel) > gridLayoutId (standart)
        if (!empty($regionsConfig) && is_array($regionsConfig)) {
            // regions_config dizisinden düzleştir
            $regions = [];
            foreach ($regionsConfig as $rc) {
                if (isset($rc['id'])) {
                    $regions[] = [
                        'id'            => $rc['id'],
                        'x'             => (float)($rc['x'] ?? 0),
                        'y'             => (float)($rc['y'] ?? 0),
                        'widthPercent'  => (float)($rc['widthPercent'] ?? 100),
                        'heightPercent' => (float)($rc['heightPercent'] ?? 100),
                    ];
                }
            }
            if (!empty($regions)) {
                return $regions;
            }
        }

        if ($gridLayoutId) {
            // Tire → alt çizgi dönüşümü (frontend 'header-content', backend 'header_content')
            $key = str_replace('-', '_', $gridLayoutId);
            if (isset(self::$gridLayouts[$key])) {
                return self::$gridLayouts[$key];
            }
        }

        // Fallback: tek bölge (tüm canvas)
        return [
            ['id' => 'main', 'x' => 0, 'y' => 0, 'widthPercent' => 100, 'heightPercent' => 100]
        ];
    }

    /**
     * Tek bir objeyi ölçekle.
     *
     * @param array $obj          Serialized Fabric.js obje
     * @param array $scaleFactors computeScaleFactors() çıktısı
     * @param array $regions      Bölge tanımları
     * @param int   $srcW         Kaynak genişlik
     * @param int   $srcH         Kaynak yükseklik
     * @param int   $dstW         Hedef genişlik
     * @param int   $dstH         Hedef yükseklik
     * @return array Ölçeklenmiş obje
     */
    private function scaleObject(
        array $obj,
        array $scaleFactors,
        array $regions,
        int $srcW,
        int $srcH,
        int $dstW,
        int $dstH
    ): array {
        // Export-dışı objeleri atla
        if (!empty($obj['excludeFromExport']) || !empty($obj['isTransient']) || !empty($obj['isHelper'])) {
            return $obj;
        }

        // Relative koordinatlar VARSA → bölge bazlı ölçekleme (responsive obje)
        if (isset($obj['relativeLeft']) && isset($obj['relativeTop'])) {
            return $this->scaleWithRelativeCoords($obj, $regions, $dstW, $dstH, $scaleFactors);
        }

        // Relative koordinatlar YOKSA → lineer ölçekleme (legacy obje)
        return $this->scaleLinear($obj, $scaleFactors);
    }

    /**
     * Bölge-içi relative koordinatlarla ölçekle (responsive obje).
     *
     * @param array $obj
     * @param array $regions
     * @param int   $dstW
     * @param int   $dstH
     * @param array $scaleFactors
     * @return array
     */
    private function scaleWithRelativeCoords(
        array $obj,
        array $regions,
        int $dstW,
        int $dstH,
        array $scaleFactors
    ): array {
        $regionId = $obj['regionId'] ?? null;
        $region = null;

        if ($regionId) {
            foreach ($regions as $r) {
                if ($r['id'] === $regionId) {
                    $region = $r;
                    break;
                }
            }
        }

        // Bölge bulunamazsa lineer fallback
        if (!$region) {
            return $this->scaleLinear($obj, $scaleFactors);
        }

        // Hedef boyutta bölge piksel sınırları (yüzdeler değişmez)
        $regionX = ($region['x'] / 100) * $dstW;
        $regionY = ($region['y'] / 100) * $dstH;
        $regionW = ($region['widthPercent'] / 100) * $dstW;
        $regionH = ($region['heightPercent'] / 100) * $dstH;

        // Relative yüzdeler → piksel
        $relLeft   = (float)($obj['relativeLeft'] ?? 50);
        $relTop    = (float)($obj['relativeTop'] ?? 50);
        $relWidth  = (float)($obj['relativeWidth'] ?? 0);
        $relHeight = (float)($obj['relativeHeight'] ?? 0);

        // Yeni piksel pozisyonu
        $obj['left'] = round($regionX + ($relLeft / 100) * $regionW, 2);
        $obj['top']  = round($regionY + ($relTop / 100) * $regionH, 2);

        // Obje boyutunu bölge oranıyla ölçekle
        if ($relWidth > 0 && isset($obj['width']) && $obj['width'] > 0) {
            $newEffectiveW = ($relWidth / 100) * $regionW;
            $obj['scaleX'] = round($newEffectiveW / $obj['width'], 6);
        }
        if ($relHeight > 0 && isset($obj['height']) && $obj['height'] > 0) {
            $newEffectiveH = ($relHeight / 100) * $regionH;
            $obj['scaleY'] = round($newEffectiveH / $obj['height'], 6);
        }

        // Font ölçekleme (metin objeleri)
        if (isset($obj['fontSize'])) {
            // Bölge yükseklik oranı ile ölçekle
            $heightRatio = $regionH / max(1, $dstH);
            $originalHeightRatio = ($region['heightPercent'] / 100);
            // Oranlar aynı olduğundan asıl ölçek min(scaleX, scaleY) kullanılır
            $fontScale = min($scaleFactors['scaleX'], $scaleFactors['scaleY']);
            $newFontSize = round($obj['fontSize'] * $fontScale, 1);

            // Text fit: shrink mode
            $textFit = $obj['textFit'] ?? 'none';
            $minFontSize = (int)($obj['minFontSize'] ?? 8);

            if ($textFit === 'shrink' && $newFontSize < $minFontSize) {
                $newFontSize = $minFontSize;
            }

            $obj['fontSize'] = max($minFontSize, $newFontSize);
        }

        // Anchor bazlı offset (opsiyonel, ileri seviye)
        $this->applyAnchorOffset($obj, $regionX, $regionY, $regionW, $regionH);

        return $obj;
    }

    /**
     * Lineer ölçekleme (legacy obje, relative koordinatı yok).
     *
     * @param array $obj
     * @param array $scaleFactors
     * @return array
     */
    private function scaleLinear(array $obj, array $scaleFactors): array
    {
        $sx = $scaleFactors['scaleX'];
        $sy = $scaleFactors['scaleY'];
        $ox = $scaleFactors['offsetX'];
        $oy = $scaleFactors['offsetY'];

        // Pozisyon ölçekleme
        if (isset($obj['left'])) {
            $obj['left'] = round($obj['left'] * $sx + $ox, 2);
        }
        if (isset($obj['top'])) {
            $obj['top'] = round($obj['top'] * $sy + $oy, 2);
        }

        // Boyut ölçekleme (scaleX/scaleY üzerinden)
        if (isset($obj['scaleX'])) {
            $obj['scaleX'] = round($obj['scaleX'] * $sx, 6);
        }
        if (isset($obj['scaleY'])) {
            $obj['scaleY'] = round($obj['scaleY'] * $sy, 6);
        }

        // Font ölçekleme
        if (isset($obj['fontSize'])) {
            $fontScale = min($sx, $sy);
            $obj['fontSize'] = round($obj['fontSize'] * $fontScale, 1);

            $minFontSize = (int)($obj['minFontSize'] ?? 8);
            if ($obj['fontSize'] < $minFontSize) {
                $obj['fontSize'] = $minFontSize;
            }
        }

        // strokeWidth ölçekleme
        if (isset($obj['strokeWidth']) && $obj['strokeWidth'] > 0) {
            $obj['strokeWidth'] = round($obj['strokeWidth'] * min($sx, $sy), 2);
        }

        // rx/ry (rounded rect) ölçekleme
        if (isset($obj['rx'])) {
            $obj['rx'] = round($obj['rx'] * $sx, 2);
        }
        if (isset($obj['ry'])) {
            $obj['ry'] = round($obj['ry'] * $sy, 2);
        }

        return $obj;
    }

    /**
     * Anchor bazlı offset uygula.
     * Objenin çapa noktasına göre bölge içinde konumunu ayarla.
     *
     * @param array  &$obj
     * @param float  $regionX
     * @param float  $regionY
     * @param float  $regionW
     * @param float  $regionH
     */
    private function applyAnchorOffset(array &$obj, float $regionX, float $regionY, float $regionW, float $regionH): void
    {
        $anchorX = $obj['anchorX'] ?? 'left';
        $anchorY = $obj['anchorY'] ?? 'top';

        // Efektif obje boyutu
        $objW = ($obj['width'] ?? 0) * ($obj['scaleX'] ?? 1);
        $objH = ($obj['height'] ?? 0) * ($obj['scaleY'] ?? 1);

        // Fabric.js v7 center-origin: left/top = merkez noktası
        // Anchor'a göre pozisyonu ayarla
        switch ($anchorX) {
            case 'right':
                // Sağa dayalı: bölgenin sağ kenarından sabit mesafe
                $distFromRight = ($regionX + $regionW) - $obj['left'];
                $obj['left'] = ($regionX + $regionW) - $distFromRight;
                break;
            case 'center':
                // Yatay ortala: bölge merkezine göre
                // Mevcut relative pozisyonu koru (zaten yüzde bazlı)
                break;
            // 'left': varsayılan, değişiklik yok
        }

        switch ($anchorY) {
            case 'bottom':
                // Alta dayalı: bölgenin alt kenarından sabit mesafe
                $distFromBottom = ($regionY + $regionH) - $obj['top'];
                $obj['top'] = ($regionY + $regionH) - $distFromBottom;
                break;
            case 'center':
                // Dikey ortala: bölge merkezine göre
                // Mevcut relative pozisyonu koru
                break;
            // 'top': varsayılan, değişiklik yok
        }
    }

    /**
     * Text ellipsis uygula (maxLines sınırı).
     * NOT: Bu işlem render aşamasında GD ile yapılmalı, burada sadece
     * maxLines bilgisini koruyoruz. GD renderer bu bilgiyi kullanacak.
     *
     * @param array &$obj
     */
    public function applyTextEllipsis(array &$obj): void
    {
        $textFit = $obj['textFit'] ?? 'none';
        $maxLines = (int)($obj['maxLines'] ?? 0);

        if ($textFit !== 'ellipsis' || $maxLines <= 0) {
            return;
        }

        // Text içeriğini satırlara böl ve sınırla
        if (isset($obj['text'])) {
            $lines = explode("\n", $obj['text']);
            if (count($lines) > $maxLines) {
                $lines = array_slice($lines, 0, $maxLines);
                $lastLine = rtrim(end($lines));
                // Son satırı kısalt ve "..." ekle
                if (mb_strlen($lastLine) > 3) {
                    $lastLine = mb_substr($lastLine, 0, -3) . '...';
                }
                $lines[count($lines) - 1] = $lastLine;
                $obj['text'] = implode("\n", $lines);
            }
        }
    }
}
