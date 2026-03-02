<?php
/**
 * Device Products API
 * GET /api/devices/:id/products - Cihaza atanmış ürünleri listele
 * POST /api/devices/:id/products - Cihaza ürün ata
 * DELETE /api/devices/:id/products/:productId - Cihazdan ürün kaldır
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Get route parameters from global $request instance
global $request;
$deviceId = $request ? $request->routeParam('id') : null;
$productId = $request ? $request->routeParam('productId') : null;
$method = $_SERVER['REQUEST_METHOD'];
$templateJoin = $db->isPostgres()
    ? 'LEFT JOIN templates t ON CAST(p.assigned_template_id AS TEXT) = CAST(t.id AS TEXT)'
    : 'LEFT JOIN templates t ON p.assigned_template_id = t.id';

// Cihazı kontrol et
$device = $db->fetch("SELECT * FROM devices WHERE id = ?", [$deviceId]);
if (!$device) {
    Response::error('Cihaz bulunamadı', 404);
}

// Yetki kontrolü - aynı firmaya ait mi
$companyId = Auth::getActiveCompanyId();
if ($device['company_id'] !== $companyId && $user['role'] !== 'SuperAdmin') {
    Response::error('Bu cihaza erişim yetkiniz yok', 403);
}

switch ($method) {
    case 'GET':
        // Cihaza atanmış ürünleri getir
        $products = $db->fetchAll(
            "SELECT p.*, t.name as template_name
             FROM products p
             $templateJoin
             WHERE p.assigned_device_id = ? AND p.company_id = ? AND p.status != 'deleted'
             ORDER BY p.name",
            [$deviceId, $companyId]
        );
        Response::success($products);
        break;

    case 'POST':
        // Cihaza ürün ata
        $data = $request->body();
        $productId = $data['product_id'] ?? null;
        $templateId = $data['template_id'] ?? null;

        if (!$productId) {
            Response::error('product_id gerekli');
        }

        // Ürünü kontrol et
        $product = $db->fetch(
            "SELECT * FROM products WHERE id = ? AND company_id = ?",
            [$productId, $companyId]
        );
        if (!$product) {
            Response::error('Ürün bulunamadı', 404);
        }

        // Template kontrolü (varsa)
        if ($templateId) {
            $template = $db->fetch(
                "SELECT * FROM templates WHERE id = ? AND (company_id = ? OR scope = 'system')",
                [$templateId, $companyId]
            );
            if (!$template) {
                Response::error('Şablon bulunamadı', 404);
            }
        }

        // Ürünü cihaza ata
        $db->update('products', [
            'assigned_device_id' => $deviceId,
            'assigned_template_id' => $templateId,
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$productId]);

        // Şablon atandıysa render cache job oluştur
        $renderJobCreated = false;
        if ($templateId) {
            require_once BASE_PATH . '/services/RenderCacheService.php';
            $cacheService = new RenderCacheService();
            $jobId = $cacheService->createRenderJob([
                'product_id' => $productId,
                'template_id' => $templateId,
                'company_id' => $companyId,
                'job_type' => 'assign',
                'source' => 'device_products',
                'priority' => 'high',
                'created_by' => $user['id']
            ]);
            $renderJobCreated = !empty($jobId);
        }

        // Audit log
        if (class_exists('AuditLogger')) {
            AuditLogger::log('assign_label', 'product', $productId, [
                'device_id' => $deviceId,
                'template_id' => $templateId,
                'product_name' => $product['name']
            ]);
        }

        Response::success([
            'message' => 'Ürün cihaza atandı',
            'product_id' => $productId,
            'device_id' => $deviceId,
            'render_job_created' => $renderJobCreated
        ]);
        break;

    case 'DELETE':
        // Cihazdan ürün kaldır
        if (!$productId) {
            Response::error('product_id gerekli', 400);
        }

        // Ürünü kontrol et ve cihaza atanmış mı bak
        $product = $db->fetch(
            "SELECT * FROM products WHERE id = ? AND assigned_device_id = ? AND company_id = ?",
            [$productId, $deviceId, $companyId]
        );
        if (!$product) {
            Response::error('Ürün bulunamadı veya bu cihaza atanmamış', 404);
        }

        // Atamayı kaldır
        $db->update('products', [
            'assigned_device_id' => null,
            'assigned_template_id' => null,
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$productId]);

        // Audit log
        if (class_exists('AuditLogger')) {
            AuditLogger::log('remove_label', 'product', $productId, [
                'device_id' => $deviceId,
                'product_name' => $product['name']
            ]);
        }

        Response::success([
            'message' => 'Ürün cihazdan kaldırıldı',
            'product_id' => $productId
        ]);
        break;

    default:
        Response::error('Method not allowed', 405);
}
