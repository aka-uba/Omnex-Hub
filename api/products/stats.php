<?php
/**
 * Products Stats API
 * GET - Returns real statistics for product list page stats cards
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

if (!$companyId) {
    Response::error('Firma seçimi gerekli', 400);
}

try {
    // 1. Total products (active only)
    $totalResult = $db->fetch(
        "SELECT COUNT(*) as count FROM products WHERE company_id = ? AND status != 'deleted'",
        [$companyId]
    );
    $totalProducts = (int)($totalResult['count'] ?? 0);

    // 2. Assigned products (products with both device AND template assigned)
    $assignedResult = $db->fetch(
        "SELECT COUNT(*) as count FROM products
         WHERE company_id = ?
         AND status != 'deleted'
         AND assigned_device_id IS NOT NULL AND assigned_device_id != ''
         AND assigned_template_id IS NOT NULL AND assigned_template_id != ''",
        [$companyId]
    );
    $assignedProducts = (int)($assignedResult['count'] ?? 0);

    // 3. Total categories (distinct non-empty categories for this company)
    $categoriesResult = $db->fetch(
        "SELECT COUNT(DISTINCT category) as count FROM products
         WHERE company_id = ? AND category IS NOT NULL AND category != '' AND status != 'deleted'",
        [$companyId]
    );
    $totalCategories = (int)($categoriesResult['count'] ?? 0);

    // 4. Last sent date - check multiple sources
    $lastSentAt = null;

    // Check render_queue for last completed send
    try {
        $renderResult = $db->fetch(
            "SELECT MAX(completed_at) as last_sent FROM render_queue
             WHERE company_id = ? AND status = 'completed' AND product_id IS NOT NULL",
            [$companyId]
        );
        if (!empty($renderResult['last_sent'])) {
            $lastSentAt = $renderResult['last_sent'];
        }
    } catch (Exception $e) {
        // Table might not exist
    }

    // Check hanshow_queue for last completed send
    try {
        $hanshowResult = $db->fetch(
            "SELECT MAX(completed_at) as last_sent FROM hanshow_queue
             WHERE company_id = ? AND status = 'completed' AND product_id IS NOT NULL",
            [$companyId]
        );
        if (!empty($hanshowResult['last_sent']) && (!$lastSentAt || $hanshowResult['last_sent'] > $lastSentAt)) {
            $lastSentAt = $hanshowResult['last_sent'];
        }
    } catch (Exception $e) {
        // Table might not exist
    }

    // Check tamsoft_sync_logs for last completed sync
    try {
        $syncResult = $db->fetch(
            "SELECT MAX(completed_at) as last_sent FROM tamsoft_sync_logs
             WHERE company_id = ? AND status = 'completed'",
            [$companyId]
        );
        if (!empty($syncResult['last_sent']) && (!$lastSentAt || $syncResult['last_sent'] > $lastSentAt)) {
            $lastSentAt = $syncResult['last_sent'];
        }
    } catch (Exception $e) {
        // Table might not exist
    }

    // Check audit_logs for recent product-related send actions
    try {
        $auditResult = $db->fetch(
            "SELECT MAX(created_at) as last_sent FROM audit_logs
             WHERE company_id = ?
             AND action IN ('send_to_device', 'render_send', 'sync_products', 'import')
             AND entity_type = 'product'",
            [$companyId]
        );
        if (!empty($auditResult['last_sent']) && (!$lastSentAt || $auditResult['last_sent'] > $lastSentAt)) {
            $lastSentAt = $auditResult['last_sent'];
        }
    } catch (Exception $e) {
        // Table might not exist
    }

    Response::success([
        'total_products' => $totalProducts,
        'assigned_products' => $assignedProducts,
        'total_categories' => $totalCategories,
        'last_sent_at' => $lastSentAt
    ]);

} catch (Exception $e) {
    Response::error('İstatistikler yüklenemedi: ' . $e->getMessage());
}
