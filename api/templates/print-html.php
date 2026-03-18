<?php
/**
 * Template Print HTML
 * POST /api/templates/:id/print-html
 *
 * Fabric.js şablonunu ürün/paket verileriyle birleştirerek yazdırmaya hazır
 * tam HTML sayfası döner. Grid layout (A4, A3) ve tek etiket/sayfa destekler.
 *
 * Body Parameters (JSON):
 *   product_ids[]     - Ürün ID dizisi (type=product ise)
 *   bundle_ids[]      - Paket ID dizisi (type=bundle ise)
 *   type              - 'product' veya 'bundle'
 *   copies            - Kopya sayısı (1-100)
 *   label_width_mm    - Etiket genişliği (mm)
 *   label_height_mm   - Etiket yüksekliği (mm)
 *   paper_width_mm    - Kağıt genişliği (mm, 0=tek etiket/sayfa)
 *   paper_height_mm   - Kağıt yüksekliği (mm, 0=tek etiket/sayfa)
 */

set_time_limit(60);

require_once BASE_PATH . '/services/FabricToHtmlConverter.php';

$db = Database::getInstance();
$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$companyId = Auth::getActiveCompanyId();
$request = $GLOBALS['request'] ?? new Request();
$templateId = $request->getRouteParam('id');

// ── Body parse ──────────────────────────────────────────
$body = json_decode(file_get_contents('php://input'), true) ?? [];

$type = $body['type'] ?? 'product';
$itemIds = ($type === 'bundle') ? ($body['bundle_ids'] ?? []) : ($body['product_ids'] ?? []);
$copies = max(1, min(100, (int)($body['copies'] ?? 1)));
$labelWidthMm = (float)($body['label_width_mm'] ?? 50);
$labelHeightMm = (float)($body['label_height_mm'] ?? 80);
$paperWidthMm = (float)($body['paper_width_mm'] ?? 0);
$paperHeightMm = (float)($body['paper_height_mm'] ?? 0);

// ── Validasyon ──────────────────────────────────────────
if (empty($templateId)) {
    Response::error('Template ID gerekli', 400);
}
if (empty($itemIds) || !is_array($itemIds)) {
    Response::error('Ürün/paket ID listesi gerekli', 400);
}
if ($labelWidthMm <= 0 || $labelHeightMm <= 0) {
    Response::error('Etiket boyutları geçersiz', 400);
}

// ── Şablon yükle ────────────────────────────────────────
$template = $db->fetch(
    "SELECT id, name, company_id, design_data, type, width, height, grid_layout, regions_config,
            responsive_mode, scale_policy, design_width, design_height
     FROM templates WHERE id = ?",
    [$templateId]
);

if (!$template) {
    Response::error('Şablon bulunamadı', 404);
}

// ── Ürünleri/paketleri yükle ────────────────────────────
$items = [];
$placeholders = implode(',', array_fill(0, count($itemIds), '?'));

if ($type === 'bundle') {
    $items = $db->fetchAll(
        "SELECT * FROM bundles WHERE id IN ({$placeholders}) AND company_id = ?",
        array_merge($itemIds, [$companyId])
    );
} else {
    $items = $db->fetchAll(
        "SELECT * FROM products WHERE id IN ({$placeholders}) AND company_id = ?",
        array_merge($itemIds, [$companyId])
    );

    // HAL Künye verileri
    if (!empty($items)) {
        $productIdList = array_column($items, 'id');
        $halPlaceholders = implode(',', array_fill(0, count($productIdList), '?'));
        $halData = $db->fetchAll(
            "SELECT * FROM product_hal_data WHERE product_id IN ({$halPlaceholders})",
            $productIdList
        );
        $halMap = [];
        foreach ($halData as $h) {
            $halMap[$h['product_id']] = $h;
        }
        // HAL verilerini ürünlere merge et
        foreach ($items as &$item) {
            if (isset($halMap[$item['id']])) {
                $hal = $halMap[$item['id']];
                foreach ($hal as $key => $val) {
                    if (!in_array($key, ['id', 'product_id', 'company_id', 'created_at', 'updated_at']) && $val !== null) {
                        $item[$key] = $val;
                    }
                }
            }
        }
        unset($item);
    }
}

// ID sırasını koru (SQL sıra garantisi vermez)
$itemMap = [];
foreach ($items as $item) {
    $itemMap[$item['id']] = $item;
}
$orderedItems = [];
foreach ($itemIds as $id) {
    if (isset($itemMap[$id])) {
        $orderedItems[] = $itemMap[$id];
    }
}
$items = $orderedItems;

if (empty($items)) {
    Response::error('Hiçbir ürün/paket bulunamadı', 404);
}

// ── Converter oluştur ───────────────────────────────────
$basePath = defined('BASE_PATH') ? basename(BASE_PATH) : 'market-etiket-sistemi';
$converter = new FabricToHtmlConverter($companyId, '/' . $basePath);

// ── Her ürün için fragment oluştur ──────────────────────
$fragments = [];
$allFonts = [];

foreach ($items as $item) {
    // Bundle ise pseudo-product'a dönüştür
    if ($type === 'bundle') {
        $discountPercent = (float)($item['discount_percent'] ?? 0);
        $totalPrice = (float)($item['total_price'] ?? 0);
        $finalPrice = (float)($item['final_price'] ?? $totalPrice);
        $product = [
            'name' => $item['name'] ?? '',
            'current_price' => $finalPrice,
            'previous_price' => ($discountPercent > 0 && $totalPrice > $finalPrice) ? $totalPrice : null,
            'barcode' => $item['barcode'] ?? '',
            'sku' => $item['sku'] ?? '',
            'category' => $item['category'] ?? '',
            'description' => $item['description'] ?? '',
            'unit' => $item['type'] ?? '',
            'image_url' => $item['image_url'] ?? '',
            'discount_percent' => $discountPercent > 0 ? ('-' . round($discountPercent) . '%') : '',
            'campaign_text' => $discountPercent > 0 ? ('-' . round($discountPercent) . '%') : '',
        ];
    } else {
        $product = $item;
    }

    $result = $converter->convertToFragment($template, [$product], ['print_mode' => true]);

    // copies kadar tekrarla
    for ($c = 0; $c < $copies; $c++) {
        $fragments[] = $result;
    }

    // Fontları birleştir (key=font name, value=font info array)
    foreach ($result['fonts'] as $fontName => $fontInfo) {
        $allFonts[$fontName] = true;
    }
}

// ── Grid hesaplama ──────────────────────────────────────
$isGridMode = ($paperWidthMm > 0 && $paperHeightMm > 0);
$marginMm = 2;
$cols = 1;
$rows = 1;
$labelsPerPage = 1;

if ($isGridMode) {
    $cols = max(1, floor(($paperWidthMm - $marginMm * 2) / $labelWidthMm));
    $rows = max(1, floor(($paperHeightMm - $marginMm * 2) / $labelHeightMm));
    $labelsPerPage = $cols * $rows;
}

$totalLabels = count($fragments);
$totalPages = $isGridMode ? ceil($totalLabels / $labelsPerPage) : $totalLabels;

// ── Scale hesaplama ─────────────────────────────────────
// Canvas px → label mm dönüşümü
$canvasW = $fragments[0]['width'] ?? 800;
$canvasH = $fragments[0]['height'] ?? 1280;
$labelPxW = $labelWidthMm / 25.4 * 96;
$labelPxH = $labelHeightMm / 25.4 * 96;
$scaleX = round($labelPxW / $canvasW, 6);
$scaleY = round($labelPxH / $canvasH, 6);

// ── Google Fonts link ───────────────────────────────────
$fontsLink = '';
if (!empty($allFonts)) {
    $systemFonts = ['Arial', 'Helvetica', 'Helvetica Neue', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New', 'Tahoma', 'Trebuchet MS', 'Impact', 'sans-serif', 'serif', 'monospace'];
    $googleFonts = [];
    foreach (array_keys($allFonts) as $font) {
        $clean = trim(str_replace(["'", '"'], '', $font));
        if ($clean && !in_array($clean, $systemFonts)) {
            $googleFonts[] = urlencode($clean) . ':wght@300;400;500;600;700;800;900';
        }
    }
    if (!empty($googleFonts)) {
        $fontsLink = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=' . implode('&family=', $googleFonts) . '&display=swap" rel="stylesheet">';
    }
}

// ── Label HTML oluştur ──────────────────────────────────
$labelsHtml = '';

if ($isGridMode) {
    // Grid modu: sayfalara böl
    $pages = array_chunk($fragments, $labelsPerPage);
    foreach ($pages as $pageIdx => $pageFragments) {
        $labelsHtml .= "<div class=\"page\">\n<div class=\"page-grid\">\n";
        foreach ($pageFragments as $frag) {
            $labelsHtml .= "<div class=\"label-wrapper\">\n";
            // Scale uygula
            $fragHtml = str_replace(
                'class="canvas-container"',
                'class="canvas-container" ',
                $frag['fragment']
            );
            // canvas-container'a scale ekle
            $fragHtml = preg_replace(
                '/style="position:relative;/',
                'style="transform-origin:top left;transform:scale(' . $scaleX . ',' . $scaleY . ');position:relative;',
                $fragHtml,
                1
            );
            $labelsHtml .= $fragHtml;
            $labelsHtml .= "\n</div>\n";
        }
        // Boş hücreleri doldur
        $remaining = $labelsPerPage - count($pageFragments);
        for ($e = 0; $e < $remaining; $e++) {
            $labelsHtml .= "<div class=\"label-wrapper empty\"></div>\n";
        }
        $labelsHtml .= "</div>\n</div>\n";
    }
} else {
    // Tek etiket/sayfa modu
    foreach ($fragments as $frag) {
        $labelsHtml .= "<div class=\"label-wrapper\">\n";
        $fragHtml = preg_replace(
            '/style="position:relative;/',
            'style="transform-origin:top left;transform:scale(' . $scaleX . ',' . $scaleY . ');position:relative;',
            $frag['fragment'],
            1
        );
        $labelsHtml .= $fragHtml;
        $labelsHtml .= "\n</div>\n";
    }
}

// ── Tam HTML sayfası ────────────────────────────────────
$itemCount = count($items);
$typeLabel = ($type === 'bundle') ? 'paket' : 'ürün';
$paperInfo = $isGridMode ? "{$paperWidthMm}×{$paperHeightMm}mm" : 'Tek etiket/sayfa';
$gridInfo = $isGridMode ? "{$cols}×{$rows}" : '-';

// @page CSS
if ($isGridMode) {
    $pageCss = "@page { size: {$paperWidthMm}mm {$paperHeightMm}mm; margin: {$marginMm}mm; }";
} else {
    $pageCss = "@page { size: {$labelWidthMm}mm {$labelHeightMm}mm; margin: 0; }";
}

$html = <<<HTML
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Baskı Önizleme - {$itemCount} {$typeLabel}</title>
{$fontsLink}
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
{$pageCss}

body {
    background: #e5e7eb;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
}

/* Toolbar */
.print-toolbar {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    background: linear-gradient(135deg, #1a1a2e, #16213e);
    color: #fff;
    font-size: 13px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
.print-toolbar button {
    padding: 6px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
}
.print-toolbar .btn-print {
    background: #228be6;
    color: #fff;
}
.print-toolbar .btn-print:hover { background: #1c7ed6; }
.print-toolbar .btn-close {
    background: rgba(255,255,255,0.15);
    color: #fff;
}
.print-toolbar .btn-close:hover { background: rgba(255,255,255,0.25); }
.print-toolbar .stats {
    margin-left: auto;
    display: flex;
    gap: 16px;
    font-size: 12px;
    opacity: 0.85;
}
.print-toolbar .stat-item {
    display: flex;
    align-items: center;
    gap: 4px;
}
.print-toolbar .stat-value {
    font-weight: 700;
    color: #74c0fc;
}

/* Label container */
.labels-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 20px;
}

/* Page (grid mode) */
.page {
    background: #fff;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    padding: {$marginMm}mm;
    width: {$paperWidthMm}mm;
    min-height: {$paperHeightMm}mm;
}
.page-grid {
    display: grid;
    grid-template-columns: repeat({$cols}, {$labelWidthMm}mm);
    grid-template-rows: repeat({$rows}, {$labelHeightMm}mm);
    gap: 0;
}

/* Label wrapper */
.label-wrapper {
    width: {$labelWidthMm}mm;
    height: {$labelHeightMm}mm;
    overflow: hidden;
    position: relative;
    border: 1px dashed #ddd;
}
.label-wrapper.empty {
    border-color: transparent;
}

/* Canvas container scale override handled inline */
.canvas-container img {
    display: block;
    max-width: none;
}

/* Print styles */
@media print {
    .print-toolbar { display: none !important; }
    body { background: #fff; }
    .labels-container { padding: 0; gap: 0; }
    .page {
        box-shadow: none;
        page-break-after: always;
        margin: 0;
        padding: {$marginMm}mm;
    }
    .page:last-child { page-break-after: auto; }
    .label-wrapper {
        border: none;
        page-break-inside: avoid;
    }
HTML;

// Tek etiket/sayfa modunda her label bir sayfa
if (!$isGridMode) {
    $html .= "
    .label-wrapper {
        page-break-after: always;
    }
    .label-wrapper:last-child {
        page-break-after: auto;
    }";
}

$html .= <<<HTML
}
</style>
</head>
<body>
<div class="print-toolbar">
    <button class="btn-print" onclick="window.print()">🖨️ Yazdır</button>
    <button class="btn-close" onclick="window.close()">✕ Kapat</button>
    <div class="stats">
        <span class="stat-item">{$typeLabel}: <span class="stat-value">{$itemCount}</span></span>
        <span class="stat-item">Kopya: <span class="stat-value">{$copies}</span></span>
        <span class="stat-item">Toplam etiket: <span class="stat-value">{$totalLabels}</span></span>
        <span class="stat-item">Sayfa: <span class="stat-value">{$totalPages}</span></span>
        <span class="stat-item">Etiket: <span class="stat-value">{$labelWidthMm}×{$labelHeightMm}mm</span></span>
        <span class="stat-item">Kağıt: <span class="stat-value">{$paperInfo}</span></span>
HTML;

if ($isGridMode) {
    $html .= "\n        <span class=\"stat-item\">Grid: <span class=\"stat-value\">{$gridInfo}</span></span>";
}

$html .= <<<HTML

    </div>
</div>
<div class="labels-container">
{$labelsHtml}
</div>

<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
    // Barkodları render et
    document.querySelectorAll('.print-barcode').forEach(function(svg) {
        var val = svg.getAttribute('data-barcode');
        var w = parseFloat(svg.getAttribute('data-width')) || 100;
        var h = parseFloat(svg.getAttribute('data-height')) || 60;
        if (!val || !val.trim()) return;
        val = val.trim();
        try {
            var format = 'CODE128';
            var cleaned = val.replace(/[^0-9]/g, '');
            if (/^\d{13}$/.test(cleaned)) format = 'EAN13';
            else if (/^\d{8}$/.test(cleaned)) format = 'EAN8';
            else if (/^\d{12}$/.test(cleaned)) format = 'UPC';
            JsBarcode(svg, val, {
                format: format,
                width: Math.max(1, w / 80),
                height: Math.max(20, h * 0.7),
                displayValue: true,
                fontSize: Math.max(8, Math.min(14, h * 0.15)),
                margin: 2,
                textMargin: 1
            });
        } catch(e) {
            try {
                JsBarcode(svg, val, { format: 'CODE128', width: 1, height: Math.max(20, h * 0.7), displayValue: true, fontSize: 10, margin: 2 });
            } catch(e2) {
                svg.parentElement.innerHTML = '<span style="font-size:10px;font-family:monospace;">' + val + '</span>';
            }
        }
    });

    // QR kodları render et
    document.querySelectorAll('.print-qrcode').forEach(function(el) {
        var val = el.getAttribute('data-qrcode');
        if (!val || !val.trim()) return;
        var w = parseInt(el.style.width) || 80;
        var h = parseInt(el.style.height) || 80;
        var size = Math.min(w, h);
        el.innerHTML = '';
        try {
            new QRCode(el, {
                text: val.trim(),
                width: size,
                height: size,
                correctLevel: QRCode.CorrectLevel.M,
                colorDark: '#000000',
                colorLight: '#ffffff'
            });
        } catch(e) {
            el.innerHTML = '<span style="font-size:8px;word-break:break-all;">' + val + '</span>';
        }
    });
});
</script>
</body>
</html>
HTML;

// ── HTML olarak dön ─────────────────────────────────────
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
echo $html;
exit;
