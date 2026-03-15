<?php
/**
 * Web Templates - Serve HTML Content
 * GET /api/web-templates/:id/serve
 *
 * Web template'in HTML içeriğini doğrudan sunar.
 * Fabric.js şablonundan oluşturulmuş ise her istekte güncel ürün verileriyle
 * yeniden render eder — ürün değişikliklerinin otomatik yansıması sağlanır.
 *
 * Auth middleware devre dışı — cihazlar doğrudan erişebilmeli.
 */

$db = Database::getInstance();
$request = $GLOBALS['request'] ?? new Request();
$id = $request->getRouteParam('id');

if (empty($id) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $id)) {
    http_response_code(400);
    echo '<!DOCTYPE html><html><body><h1>Template ID gerekli</h1></body></html>';
    exit;
}

$template = $db->fetch(
    "SELECT html_content, name, width, height, data_sources, company_id FROM web_templates WHERE id = ? AND deleted_at IS NULL",
    [$id]
);

if (!$template) {
    http_response_code(404);
    echo '<!DOCTYPE html><html><body><h1>Template bulunamadı</h1></body></html>';
    exit;
}

// ── Fabric.js kaynağı varsa dinamik render ──────────────────
$dataSources = !empty($template['data_sources']) ? json_decode($template['data_sources'], true) : null;
$htmlContent = $template['html_content'];

if ($dataSources && ($dataSources['source'] ?? '') === 'fabric_template') {
    $fabricTemplateId = $dataSources['fabric_template_id'] ?? null;
    $productIds = $dataSources['product_ids'] ?? [];

    if ($fabricTemplateId && !empty($productIds)) {
        try {
            // Kaynak Fabric.js şablonunu yükle
            $fabricTemplate = $db->fetch(
                "SELECT id, name, design_data, type, width, height, grid_layout, regions_config,
                        responsive_mode, scale_policy, design_width, design_height
                 FROM templates WHERE id = ?",
                [$fabricTemplateId]
            );

            if ($fabricTemplate && !empty($fabricTemplate['design_data'])) {
                $companyId = $template['company_id'];

                // Güncel ürün verilerini yükle
                $products = [];
                foreach ($productIds as $pid) {
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

                // Ürünler hala mevcutsa taze render yap
                if (!empty($products)) {
                    require_once BASE_PATH . '/services/FabricToHtmlConverter.php';
                    $converter = new FabricToHtmlConverter($companyId);

                    $options = [
                        'title' => $template['name']
                    ];

                    $result = $converter->convert($fabricTemplate, $products, $options);
                    $htmlContent = $result['html'];
                }
            }
        } catch (Throwable $e) {
            // Dinamik render başarısız olursa kayıtlı static HTML'i kullan
            Logger::warning('Dynamic serve render failed, using cached HTML', [
                'web_template_id' => $id,
                'error' => $e->getMessage()
            ]);
        }
    }
}

if (empty($htmlContent)) {
    http_response_code(404);
    echo '<!DOCTYPE html><html><body><h1>İçerik bulunamadı</h1></body></html>';
    exit;
}

// HTML içeriğini doğrudan sun
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('X-Content-Type-Options: nosniff');
echo $htmlContent;
exit;
