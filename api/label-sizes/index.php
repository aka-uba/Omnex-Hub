<?php
/**
 * Label Sizes API - List all
 *
 * GET /api/label-sizes
 * GET /api/label-sizes?all=1 (yönetim sayfası için tüm kayıtlar)
 * Returns global + company-specific label sizes
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../core/Database.php';
require_once __DIR__ . '/../../core/Auth.php';
require_once __DIR__ . '/../../core/Response.php';

// Auth kontrolü
$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$db = Database::getInstance();
$companyId = Auth::getActiveCompanyId();
$activeExpr = $db->isPostgres() ? 'is_active IS TRUE' : 'is_active = 1';

// Yönetim sayfası için tüm kayıtları getir (all=1 parametresi ile)
$includeAll = isset($_GET['all']) && $_GET['all'] === '1';

if ($includeAll) {
    // Yönetim sayfası: tüm kayıtlar (aktif + pasif)
    $labelSizes = $db->fetchAll(
        "SELECT * FROM label_sizes
         WHERE (company_id IS NULL OR company_id = ?)
         ORDER BY sort_order ASC, name ASC",
        [$companyId]
    );
} else {
    // Normal kullanım: sadece aktif olanlar
    $labelSizes = $db->fetchAll(
        "SELECT * FROM label_sizes
         WHERE (company_id IS NULL OR company_id = ?)
         AND $activeExpr
         ORDER BY sort_order ASC, name ASC",
        [$companyId]
    );
}

Response::success($labelSizes);
