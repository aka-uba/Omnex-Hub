<?php
/**
 * Fabric.js Object Helpers
 *
 * Bu dosya, Fabric.js 5.3.0 için doğru formatta objeler oluşturmak için
 * helper fonksiyonları içerir. Tüm seed dosyalarında kullanılabilir.
 *
 * Kullanım:
 * require_once __DIR__ . '/helpers/FabricObjectHelpers.php';
 *
 * $text = FabricHelpers::text(['text' => 'Merhaba', 'fontSize' => 40]);
 * $rect = FabricHelpers::rect(['width' => 100, 'height' => 100, 'fill' => '#ff0000']);
 */

class FabricHelpers
{
    /**
     * Fabric.js versiyonu
     */
    const VERSION = '5.3.0';

    /**
     * Ortak temel özellikler (tüm objeler için)
     */
    private static function baseDefaults(): array
    {
        return [
            'version' => self::VERSION,
            'originX' => 'left',
            'originY' => 'top',
            'left' => 0,
            'top' => 0,
            'width' => 100,
            'height' => 100,
            'fill' => '#000000',
            'stroke' => null,
            'strokeWidth' => 1,
            'strokeDashArray' => null,
            'strokeLineCap' => 'butt',
            'strokeDashOffset' => 0,
            'strokeLineJoin' => 'miter',
            'strokeUniform' => false,
            'strokeMiterLimit' => 4,
            'scaleX' => 1,
            'scaleY' => 1,
            'angle' => 0,
            'flipX' => false,
            'flipY' => false,
            'opacity' => 1,
            'shadow' => null,
            'visible' => true,
            'backgroundColor' => '',
            'fillRule' => 'nonzero',
            'paintFirst' => 'fill',
            'globalCompositeOperation' => 'source-over',
            'skewX' => 0,
            'skewY' => 0
        ];
    }

    /**
     * i-text objesi oluştur
     *
     * @param array $props Özelleştirmeler
     * @return array Fabric.js i-text objesi
     *
     * Örnek:
     * FabricHelpers::text([
     *     'left' => 100,
     *     'top' => 100,
     *     'text' => '{{product_name}}',
     *     'fontSize' => 48,
     *     'fontWeight' => 'bold',
     *     'fill' => '#333333',
     *     'customType' => 'dynamic-text',
     *     'dynamicField' => 'product_name',
     *     'isDataField' => true
     * ])
     */
    public static function text(array $props = []): array
    {
        $textDefaults = [
            'type' => 'i-text',
            'text' => '',
            'fontSize' => 40,
            'fontWeight' => 'normal',
            'fontFamily' => 'Arial',
            'fontStyle' => 'normal',          // normal, italic, oblique
            'lineHeight' => 1.16,
            'underline' => false,
            'overline' => false,
            'linethrough' => false,
            'textAlign' => 'left',            // left, center, right, justify
            'textBackgroundColor' => '',
            'charSpacing' => 0,
            'styles' => [],                   // KRİTİK: Boş bile olsa MUTLAKA tanımlanmalı
            'direction' => 'ltr',             // ltr, rtl
            'path' => null,
            'pathStartOffset' => 0,
            'pathSide' => 'left',
            'pathAlign' => 'baseline'
        ];

        return array_merge(self::baseDefaults(), $textDefaults, $props);
    }

    /**
     * Dinamik metin alanı oluştur (kısayol)
     *
     * @param string $field Dinamik alan adı (product_name, current_price, vs.)
     * @param array $props Ek özellikler
     * @return array Fabric.js i-text objesi
     */
    public static function dynamicText(string $field, array $props = []): array
    {
        $dynamicProps = [
            'text' => '{{' . $field . '}}',
            'customType' => 'dynamic-text',
            'dynamicField' => $field,
            'isDataField' => true
        ];

        return self::text(array_merge($dynamicProps, $props));
    }

    /**
     * Fiyat alanı oluştur (kısayol)
     *
     * @param string $field Fiyat alanı (current_price, previous_price)
     * @param array $props Ek özellikler
     * @return array Fabric.js i-text objesi
     */
    public static function price(string $field = 'current_price', array $props = []): array
    {
        $priceDefaults = [
            'text' => '{{' . $field . '}}',
            'fontSize' => 72,
            'fontWeight' => 'bold',
            'customType' => 'price',
            'dynamicField' => $field,
            'isDataField' => true
        ];

        return self::text(array_merge($priceDefaults, $props));
    }

    /**
     * rect objesi oluştur
     *
     * @param array $props Özelleştirmeler
     * @return array Fabric.js rect objesi
     */
    public static function rect(array $props = []): array
    {
        $rectDefaults = [
            'type' => 'rect',
            'fill' => '#ffffff',
            'rx' => 0,
            'ry' => 0
        ];

        return array_merge(self::baseDefaults(), $rectDefaults, $props);
    }

    /**
     * circle objesi oluştur
     *
     * @param array $props Özelleştirmeler
     * @return array Fabric.js circle objesi
     */
    public static function circle(array $props = []): array
    {
        $circleDefaults = [
            'type' => 'circle',
            'fill' => '#ffffff',
            'radius' => 50,
            'startAngle' => 0,
            'endAngle' => 360
        ];

        return array_merge(self::baseDefaults(), $circleDefaults, $props);
    }

    /**
     * line objesi oluştur
     *
     * @param array $props Özelleştirmeler
     * @return array Fabric.js line objesi
     */
    public static function line(array $props = []): array
    {
        $lineDefaults = [
            'type' => 'line',
            'fill' => '#000000',
            'stroke' => '#000000',
            'height' => 0,
            'x1' => 0,
            'y1' => 0,
            'x2' => 100,
            'y2' => 0
        ];

        return array_merge(self::baseDefaults(), $lineDefaults, $props);
    }

    /**
     * image objesi oluştur
     *
     * @param array $props Özelleştirmeler
     * @return array Fabric.js image objesi
     */
    public static function image(array $props = []): array
    {
        $imageDefaults = [
            'type' => 'image',
            'fill' => 'rgb(0,0,0)',
            'strokeWidth' => 0,
            'cropX' => 0,
            'cropY' => 0,
            'src' => '',
            'crossOrigin' => null,
            'filters' => []
        ];

        return array_merge(self::baseDefaults(), $imageDefaults, $props);
    }

    /**
     * Barkod placeholder oluştur
     *
     * @param array $props Ek özellikler
     * @return array Fabric.js image objesi (barkod olarak işaretli)
     */
    public static function barcode(array $props = []): array
    {
        $barcodeDefaults = [
            'width' => 200,
            'height' => 80,
            'customType' => 'barcode',
            'dynamicField' => 'barcode',
            'isDataField' => true,
            'barcodeFormat' => 'EAN13',
            'barcodeValue' => '{{barcode}}'
        ];

        return self::image(array_merge($barcodeDefaults, $props));
    }

    /**
     * QR kod placeholder oluştur
     *
     * @param string $field Dinamik alan (varsayılan: kunye_no)
     * @param array $props Ek özellikler
     * @return array Fabric.js image objesi (QR kod olarak işaretli)
     */
    public static function qrcode(string $field = 'kunye_no', array $props = []): array
    {
        $qrDefaults = [
            'width' => 100,
            'height' => 100,
            'customType' => 'qrcode',
            'dynamicField' => $field,
            'isDataField' => true,
            'qrValue' => '{{' . $field . '}}'
        ];

        return self::image(array_merge($qrDefaults, $props));
    }

    /**
     * Dinamik görsel placeholder oluştur
     *
     * @param array $props Ek özellikler
     * @return array Fabric.js image objesi
     */
    public static function dynamicImage(array $props = []): array
    {
        $imgDefaults = [
            'width' => 300,
            'height' => 300,
            'customType' => 'dynamic-image',
            'dynamicField' => 'image_url',
            'isDataField' => true,
            'src' => '{{image_url}}'
        ];

        return self::image(array_merge($imgDefaults, $props));
    }

    /**
     * group objesi oluştur
     *
     * @param array $objects Grup içindeki objeler
     * @param array $props Grup özellikleri
     * @return array Fabric.js group objesi
     */
    public static function group(array $objects, array $props = []): array
    {
        $groupDefaults = [
            'type' => 'group',
            'fill' => 'rgb(0,0,0)',
            'strokeWidth' => 0,
            'objects' => $objects
        ];

        return array_merge(self::baseDefaults(), $groupDefaults, $props);
    }

    /**
     * Çoklu ürün çerçevesi oluştur
     *
     * @param int $cols Sütun sayısı
     * @param int $rows Satır sayısı
     * @param array $props Ek özellikler
     * @return array Fabric.js group objesi (multi-product-frame olarak işaretli)
     */
    public static function multiProductFrame(int $cols, int $rows, array $props = []): array
    {
        $frameDefaults = [
            'customType' => 'multi-product-frame',
            'frameCols' => $cols,
            'frameRows' => $rows,
            'activeSlotId' => 1,
            'slots' => []
        ];

        return self::group([], array_merge($frameDefaults, $props));
    }

    /**
     * Slot içi metin oluştur
     *
     * @param int $slotId Slot ID
     * @param string $field Dinamik alan
     * @param array $props Ek özellikler
     * @return array Fabric.js i-text objesi
     */
    public static function slotText(int $slotId, string $field, array $props = []): array
    {
        $slotProps = [
            'text' => '{{' . $field . '}}',
            'customType' => 'slot-text',
            'slotId' => $slotId,
            'inMultiFrame' => true,
            'dynamicField' => $field,
            'isDataField' => true
        ];

        return self::text(array_merge($slotProps, $props));
    }

    /**
     * Slot içi barkod oluştur
     *
     * @param int $slotId Slot ID
     * @param array $props Ek özellikler
     * @return array Fabric.js image objesi
     */
    public static function slotBarcode(int $slotId, array $props = []): array
    {
        $slotProps = [
            'customType' => 'slot-barcode',
            'slotId' => $slotId,
            'inMultiFrame' => true
        ];

        return self::barcode(array_merge($slotProps, $props));
    }

    /**
     * Slot içi QR kod oluştur
     *
     * @param int $slotId Slot ID
     * @param string $field Dinamik alan
     * @param array $props Ek özellikler
     * @return array Fabric.js image objesi
     */
    public static function slotQRCode(int $slotId, string $field = 'kunye_no', array $props = []): array
    {
        $slotProps = [
            'customType' => 'slot-qrcode',
            'slotId' => $slotId,
            'inMultiFrame' => true
        ];

        return self::qrcode($field, array_merge($slotProps, $props));
    }

    /**
     * Gölge objesi oluştur
     *
     * @param array $props Gölge özellikleri
     * @return array Fabric.js shadow objesi
     */
    public static function shadow(array $props = []): array
    {
        $defaults = [
            'color' => 'rgba(0,0,0,0.3)',
            'blur' => 10,
            'offsetX' => 0,
            'offsetY' => 5,
            'affectStroke' => false,
            'nonScaling' => false
        ];

        return array_merge($defaults, $props);
    }

    /**
     * Tam canvas JSON yapısı oluştur
     *
     * @param array $objects Canvas objeleri
     * @param string $background Arka plan rengi
     * @return array Fabric.js canvas JSON
     */
    public static function canvas(array $objects, string $background = '#ffffff'): array
    {
        return [
            'version' => self::VERSION,
            'objects' => $objects,
            'background' => $background,
            'backgroundImage' => null
        ];
    }

    /**
     * Şablon veritabanı kaydı için tam veri oluştur
     *
     * @param array $templateData Şablon verileri
     * @param array $canvasObjects Canvas objeleri
     * @param string $background Arka plan rengi
     * @return array Veritabanına kaydedilecek veri
     */
    public static function templateRecord(array $templateData, array $canvasObjects, string $background = '#ffffff'): array
    {
        $defaults = [
            'type' => 'label',
            'category' => 'etiket',
            'width' => 800,
            'height' => 1280,
            'orientation' => 'portrait',
            'version' => 1,
            'is_default' => 0,
            'is_public' => 1,
            'status' => 'active',
            'scope' => 'system',
            'is_forked' => 0,
            'is_demo' => 0,
            'target_device_type' => 'esl_101_portrait',
            'background_type' => 'color',
            'background_value' => $background
        ];

        $templateData['design_data'] = json_encode(self::canvas($canvasObjects, $background));

        return array_merge($defaults, $templateData);
    }
}

// Global helper fonksiyonları (geriye uyumluluk için)

function createTextObject($props) {
    return FabricHelpers::text($props);
}

function createRectObject($props) {
    return FabricHelpers::rect($props);
}

function createCircleObject($props) {
    return FabricHelpers::circle($props);
}

function createLineObject($props) {
    return FabricHelpers::line($props);
}

function createImageObject($props) {
    return FabricHelpers::image($props);
}
