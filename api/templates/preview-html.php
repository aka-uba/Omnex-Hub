<?php
/**
 * Template Preview as HTML
 * GET /api/templates/:id/preview-html?product_id=xxx
 *
 * Fabric.js şablonunu ürün verileriyle birleştirerek canlı HTML önizleme döner.
 * Web template kaydı oluşturmaz — her istekte anlık render yapar.
 * Auth gerektirmez — cihazlar ve iframe'ler doğrudan erişebilmeli.
 *
 * Query Parameters:
 *   product_id  - Tek ürün ID'si (zorunlu — en az product_id veya product_ids)
 *   product_ids - Virgülle ayrılmış ürün ID'leri (multi-product şablonlar için)
 *   width       - Opsiyonel hedef genişlik
 *   height      - Opsiyonel hedef yükseklik
 *   currency    - Para birimi (varsayılan: ₺)
 */

require_once BASE_PATH . '/services/FabricToHtmlConverter.php';

$db = Database::getInstance();
$request = $GLOBALS['request'] ?? new Request();
$id = $request->getRouteParam('id');

// ── Validasyon ───────────────────────────────────────────
if (empty($id) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $id)) {
    http_response_code(400);
    echo '<!DOCTYPE html><html><body><h1>Template ID gerekli</h1></body></html>';
    exit;
}

// Ürün ID'lerini topla
$productIds = [];
if (!empty($_GET['product_ids'])) {
    $productIds = array_filter(explode(',', $_GET['product_ids']));
} elseif (!empty($_GET['product_id'])) {
    $productIds = [$_GET['product_id']];
}

if (empty($productIds)) {
    http_response_code(400);
    echo '<!DOCTYPE html><html><body><h1>product_id veya product_ids gerekli</h1></body></html>';
    exit;
}

// ── Şablon yükle ─────────────────────────────────────────
$template = $db->fetch(
    "SELECT id, name, company_id, design_data, type, width, height, grid_layout, regions_config,
            responsive_mode, scale_policy, design_width, design_height
     FROM templates WHERE id = ?",
    [$id]
);

if (!$template || empty($template['design_data'])) {
    http_response_code(404);
    echo '<!DOCTYPE html><html><body><h1>Şablon bulunamadı veya design_data boş</h1></body></html>';
    exit;
}

$companyId = $template['company_id'];

// ── Ürünleri yükle ───────────────────────────────────────
$products = [];
foreach ($productIds as $pid) {
    $pid = trim($pid);
    if (empty($pid)) continue;

    $product = $db->fetch("SELECT * FROM products WHERE id = ?", [$pid]);
    if (!$product) continue;

    // HAL Künye verileri ekle
    $halData = $db->fetch(
        "SELECT * FROM product_hal_data WHERE product_id = ?",
        [$pid]
    );
    if ($halData) {
        foreach ($halData as $field => $value) {
            if (in_array($field, ['id', 'product_id', 'company_id', 'created_at', 'updated_at', 'deleted_at'], true)) {
                continue;
            }
            if (($product[$field] ?? null) === null || ($product[$field] ?? '') === '') {
                if ($value !== null && $value !== '') {
                    $product[$field] = $value;
                }
            }
        }
    }

    $products[] = $product;
}

if (empty($products)) {
    http_response_code(404);
    echo '<!DOCTYPE html><html><body><h1>Ürün bulunamadı</h1></body></html>';
    exit;
}

// ── Dönüşüm ─────────────────────────────────────────────
try {
    $converter = new FabricToHtmlConverter($companyId);

    $options = [
        'title' => $template['name'] . ' - ' . ($products[0]['name'] ?? 'Önizleme')
    ];

    if (!empty($_GET['width']))    $options['width']    = (int)$_GET['width'];
    if (!empty($_GET['height']))   $options['height']   = (int)$_GET['height'];
    if (!empty($_GET['currency'])) $options['currency'] = $_GET['currency'];

    $result = $converter->convert($template, $products, $options);

    // HTML çıktısını sun
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('X-Content-Type-Options: nosniff');
    echo $result['html'];
    exit;

} catch (Throwable $e) {
    Logger::error('Preview HTML render error', [
        'template_id' => $id,
        'product_ids' => $productIds,
        'error' => $e->getMessage()
    ]);
    http_response_code(500);
    echo '<!DOCTYPE html><html><body><h1>Render hatası: ' . htmlspecialchars($e->getMessage()) . '</h1></body></html>';
    exit;
}
