<?php
/**
 * Dashboard Stats API
 * Optimized: Combined multiple queries into fewer queries for better performance
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

// Build company filter
$companyFilter = '';
$params = [];

if ($companyId) {
    $companyFilter = ' AND company_id = ?';
    $params[] = $companyId;
}

// Combine main counts into single query using UNION ALL
$startOfMonth = date('Y-m-01 00:00:00');
$yesterday = date('Y-m-d H:i:s', strtotime('-24 hours'));

// Build the combined query
// Note: online_devices now only checks status field to match devices page behavior
$unionParams = [];
$unionQuery = "
    SELECT 'products' as metric, COUNT(*) as count FROM products WHERE status != 'deleted'" . $companyFilter . "
    UNION ALL
    SELECT 'devices', COUNT(*) FROM devices WHERE status IN ('online', 'offline')" . $companyFilter . "
    UNION ALL
    SELECT 'total_devices', COUNT(*) FROM devices WHERE 1=1" . $companyFilter . "
    UNION ALL
    SELECT 'templates', COUNT(*) FROM templates WHERE status = 'active'" . ($companyId ? " AND (company_id = ? OR scope = 'system')" : "") . "
    UNION ALL
    SELECT 'online_devices', COUNT(*) FROM devices WHERE status = 'online'" . $companyFilter . "
    UNION ALL
    SELECT 'categories', COUNT(*) FROM categories WHERE 1=1" . $companyFilter . "
    UNION ALL
    SELECT 'media', COUNT(*) FROM media WHERE 1=1" . $companyFilter;

// Build params array (repeat for each UNION)
if ($companyId) {
    $unionParams = [$companyId, $companyId, $companyId, $companyId, $companyId, $companyId, $companyId];
} else {
    $unionParams = [];
}

$counts = $db->fetchAll($unionQuery, $unionParams);

// Convert to associative array
$stats = [
    'products' => 0,
    'devices' => 0,
    'total_devices' => 0,
    'templates' => 0,
    'online_devices' => 0,
    'categories' => 0,
    'media' => 0
];

foreach ($counts as $row) {
    $stats[$row['metric']] = (int)$row['count'];
}

// Get audit updates count (separate query for clarity)
$updateCount = 0;
try {
    $result = $db->fetch(
        "SELECT COUNT(*) as count FROM audit_logs
         WHERE created_at >= ? AND action IN ('create', 'update', 'import')" .
        ($companyId ? " AND company_id = ?" : ""),
        $companyId ? [$startOfMonth, $companyId] : [$startOfMonth]
    );
    $updateCount = $result['count'] ?? 0;
} catch (Exception $e) {
    // Table might not exist
}

// Get today's updates for trend
$todayUpdates = 0;
try {
    $result = $db->fetch(
        "SELECT COUNT(*) as count FROM audit_logs
         WHERE created_at >= ? AND action IN ('create', 'update')" .
        ($companyId ? " AND company_id = ?" : ""),
        $companyId ? [$yesterday, $companyId] : [$yesterday]
    );
    $todayUpdates = $result['count'] ?? 0;
} catch (Exception $e) {
    // Table might not exist
}

// Get pending imports (import_logs table may not exist)
$pendingImports = 0;
try {
    $result = $db->fetch(
        "SELECT COUNT(*) as count FROM import_logs WHERE status = 'pending'" . $companyFilter,
        $params
    );
    $pendingImports = $result['count'] ?? 0;
} catch (Exception $e) {
    // Table doesn't exist, ignore
}

// Get license stats
$activeLicenses = 0;
$expiringLicenses = 0;
try {
    // Active licenses
    $result = $db->fetch(
        "SELECT COUNT(*) as count FROM licenses WHERE status = 'active'"
    );
    $activeLicenses = $result['count'] ?? 0;

    // Licenses expiring in 30 days
    $thirtyDaysLater = date('Y-m-d', strtotime('+30 days'));
    $result = $db->fetch(
        "SELECT COUNT(*) as count FROM licenses WHERE status = 'active' AND valid_until <= ?"
        , [$thirtyDaysLater]
    );
    $expiringLicenses = $result['count'] ?? 0;
} catch (Exception $e) {
    // Table might not exist
}

// Get storage usage with quota info
$storageUsed = 0;
$storageLimit = 0;
$storageUnlimited = false;
$storageUsage = [];
$mediaSize = $db->fetch(
    "SELECT COALESCE(SUM(file_size), 0) as total FROM media" . ($companyId ? " WHERE company_id = ?" : ""),
    $companyId ? [$companyId] : []
)['total'] ?? 0;
$storageUsed = round($mediaSize / (1024 * 1024), 2); // Convert to MB

// Get detailed storage quota if company exists
if ($companyId) {
    try {
        $storageService = new StorageService();
        $storageUsage = $storageService->getUsage($companyId);
        $storageLimit = $storageService->getLimit($companyId);
        $storageUnlimited = ($storageLimit <= 0);
        // Use StorageService total if available (more accurate - includes renders/templates)
        if (!empty($storageUsage['total_bytes'])) {
            $storageUsed = round($storageUsage['total_bytes'] / (1024 * 1024), 2);
        }

        // Depolama eşik bildirimi kontrolü
        $storageService->checkStorageNotification($companyId);
    } catch (Exception $e) {
        // StorageService not available, use media-only calculation
    }
}

// Calculate error rate from recent sync failures
$errorRate = 0;
$errorTrend = 0;
try {
    $totalSyncs = $db->fetch(
        "SELECT COUNT(*) as count FROM device_sync_requests WHERE created_at >= ?",
        [$startOfMonth]
    )['count'] ?? 0;

    $failedSyncs = $db->fetch(
        "SELECT COUNT(*) as count FROM device_sync_requests WHERE status = 'failed' AND created_at >= ?",
        [$startOfMonth]
    )['count'] ?? 0;

    if ($totalSyncs > 0) {
        $errorRate = round(($failedSyncs / $totalSyncs) * 100, 2);
    }
} catch (Exception $e) {
    // Table might not exist
}

// Calculate product trend (compare with last month)
$productTrend = 0;
try {
    $lastMonthStart = date('Y-m-01 00:00:00', strtotime('-1 month'));
    $thisMonthStart = date('Y-m-01 00:00:00');

    $lastMonthProducts = $db->fetch(
        "SELECT COUNT(*) as count FROM products WHERE created_at < ? AND status != 'deleted'" . $companyFilter,
        $companyId ? [$thisMonthStart, $companyId] : [$thisMonthStart]
    )['count'] ?? 0;

    if ($lastMonthProducts > 0) {
        $productTrend = round((($stats['products'] - $lastMonthProducts) / $lastMonthProducts) * 100, 1);
    }
} catch (Exception $e) {
    // Ignore
}

// =============================================
// CRM Dashboard Extended Data
// =============================================

// Offline devices list (max 20)
$offlineDevices = [];
try {
    $offlineDevices = $db->fetchAll(
        "SELECT id, name, ip_address, type, model, updated_at as last_online
         FROM devices WHERE status = 'offline'" . $companyFilter . "
         ORDER BY updated_at DESC LIMIT 20",
        $params
    );
} catch (Exception $e) {}

// Devices by type
$devicesByType = [];
try {
    $devicesByType = $db->fetchAll(
        "SELECT type, model, COUNT(*) as count FROM devices WHERE 1=1" . $companyFilter . "
         GROUP BY type, model ORDER BY count DESC",
        $params
    );
} catch (Exception $e) {}

// Devices by branch
$devicesByBranch = [];
try {
    $devicesByBranch = $db->fetchAll(
        "SELECT COALESCE(b.name, 'Atanmamış') as branch_name, COUNT(d.id) as count
         FROM devices d LEFT JOIN branches b ON d.branch_id = b.id
         WHERE 1=1" . str_replace('company_id', 'd.company_id', $companyFilter) . "
         GROUP BY b.name ORDER BY count DESC LIMIT 10",
        $params
    );
} catch (Exception $e) {}

// Product assignments
$productDeviceAssigned = 0;
try {
    $result = $db->fetch(
        "SELECT COUNT(DISTINCT product_id) as count FROM render_queue WHERE status = 'completed'" .
        ($companyId ? " AND company_id = ?" : ""),
        $companyId ? [$companyId] : []
    );
    $productDeviceAssigned = (int)($result['count'] ?? 0);
} catch (Exception $e) {}

$productTemplateAssigned = 0;
try {
    $result = $db->fetch(
        "SELECT COUNT(DISTINCT product_id) as count FROM render_queue WHERE 1=1" .
        ($companyId ? " AND company_id = ?" : ""),
        $companyId ? [$companyId] : []
    );
    $productTemplateAssigned = (int)($result['count'] ?? 0);
} catch (Exception $e) {}

// Last updated product
$lastUpdatedProduct = null;
try {
    $lastUpdatedProduct = $db->fetch(
        "SELECT name, updated_at FROM products WHERE status != 'deleted'" . $companyFilter . "
         ORDER BY updated_at DESC LIMIT 1",
        $params
    );
} catch (Exception $e) {}

// System templates count
$systemTemplates = 0;
try {
    $result = $db->fetch(
        "SELECT COUNT(*) as count FROM templates WHERE scope = 'system' AND status = 'active'"
    );
    $systemTemplates = (int)($result['count'] ?? 0);
} catch (Exception $e) {}

// Templates by device type
$templatesByType = [];
try {
    $templatesByType = $db->fetchAll(
        "SELECT COALESCE(device_types, 'label') as type, COUNT(*) as count
         FROM templates WHERE status = 'active'" . ($companyId ? " AND (company_id = ? OR scope = 'system')" : "") . "
         GROUP BY device_types ORDER BY count DESC",
        $params
    );
} catch (Exception $e) {}

// Media scope counts
$publicMedia = 0;
$companyMedia = 0;
try {
    // Public media: count ALL public/shared media (not filtered by company)
    $publicResult = $db->fetch(
        "SELECT COUNT(*) as count FROM media WHERE (scope = 'public' OR is_public = true)"
    );
    $publicMedia = (int)($publicResult['count'] ?? 0);

    // Company media: count only this company's own media (excluding public)
    if ($companyId) {
        $companyResult = $db->fetch(
            "SELECT COUNT(*) as count FROM media WHERE company_id = ? AND (scope IS NULL OR scope = 'company') AND (is_public IS NULL OR is_public = false)",
            [$companyId]
        );
        $companyMedia = (int)($companyResult['count'] ?? 0);
    } else {
        $companyResult = $db->fetch(
            "SELECT COUNT(*) as count FROM media WHERE (scope IS NULL OR scope = 'company') AND (is_public IS NULL OR is_public = false)"
        );
        $companyMedia = (int)($companyResult['count'] ?? 0);
    }
} catch (Exception $e) {}

// Signage stats
$signageDevices = [];
try {
    $signageDevices = $db->fetchAll(
        "SELECT type, model, COUNT(*) as count FROM devices
         WHERE type IN ('android_tv', 'web_display')" . $companyFilter . "
         GROUP BY type, model",
        $params
    );
} catch (Exception $e) {}

// Playlist stats
$playlistStats = ['total' => 0, 'active' => 0, 'inactive' => 0];
$playlistItemCount = 0;
$playlistDeviceCount = 0;
try {
    $result = $db->fetch(
        "SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN status != 'active' THEN 1 ELSE 0 END) as inactive
         FROM playlists WHERE 1=1" . $companyFilter,
        $params
    );
    $playlistStats = [
        'total' => (int)($result['total'] ?? 0),
        'active' => (int)($result['active'] ?? 0),
        'inactive' => (int)($result['inactive'] ?? 0)
    ];
} catch (Exception $e) {}

try {
    $result = $db->fetch(
        "SELECT COUNT(*) as count FROM playlist_items pi
         JOIN playlists p ON pi.playlist_id = p.id WHERE 1=1" .
        str_replace('company_id', 'p.company_id', $companyFilter),
        $params
    );
    $playlistItemCount = (int)($result['count'] ?? 0);
} catch (Exception $e) {}

try {
    $result = $db->fetch(
        "SELECT COUNT(DISTINCT sd.device_id) as count FROM schedule_devices sd
         JOIN schedules s ON sd.schedule_id = s.id WHERE 1=1" .
        str_replace('company_id', 's.company_id', $companyFilter),
        $params
    );
    $playlistDeviceCount = (int)($result['count'] ?? 0);
} catch (Exception $e) {}

// Company info
$companyInfo = [];
try {
    if ($companyId) {
        $companyInfo = $db->fetch(
            "SELECT name, status FROM companies WHERE id = ?",
            [$companyId]
        ) ?: [];
    }
} catch (Exception $e) {}

// Branch count
$branchCount = 0;
try {
    $result = $db->fetch(
        "SELECT COUNT(*) as count FROM branches WHERE 1=1" . $companyFilter,
        $params
    );
    $branchCount = (int)($result['count'] ?? 0);
} catch (Exception $e) {}

// User count
$userCount = 0;
try {
    $result = $db->fetch(
        "SELECT COUNT(*) as count FROM users WHERE status = 'active'" . $companyFilter,
        $params
    );
    $userCount = (int)($result['count'] ?? 0);
} catch (Exception $e) {}

// Active sessions
$activeSessions = 0;
try {
    $result = $db->fetch(
        "SELECT COUNT(*) as count FROM sessions WHERE expires_at > ?",
        [date('Y-m-d H:i:s')]
    );
    $activeSessions = (int)($result['count'] ?? 0);
} catch (Exception $e) {}

// License info for current company (JOIN with license_plans for limits)
$licenseInfo = [];
try {
    if ($companyId) {
        try {
            $licenseInfo = $db->fetch(
                "SELECT l.plan_id, l.valid_until as end_date, l.status, l.valid_from,
                        COALESCE(lp.name, 'standard') as type,
                        lp.max_devices as device_limit,
                        lp.max_users as user_limit,
                        lp.max_branches as branch_limit,
                        lp.max_storage as storage_limit,
                        lp.is_unlimited
                 FROM licenses l
                 LEFT JOIN license_plans lp ON l.plan_id = lp.id
                 WHERE l.company_id = ? AND l.status = 'active'
                 ORDER BY l.valid_until DESC LIMIT 1",
                [$companyId]
            ) ?: [];
        } catch (Exception $e) {
            // Fallback: basic license query without plan join
            $licenseInfo = $db->fetch(
                "SELECT valid_until as end_date, status, 'standard' as type
                 FROM licenses WHERE company_id = ? AND status = 'active'
                 ORDER BY valid_until DESC LIMIT 1",
                [$companyId]
            ) ?: [];
        }
    }
} catch (Exception $e) {}

// Integrations status
$integrations = [
    'tamsoft' => ['active' => false, 'configured' => false, 'last_sync' => null],
    'hal' => ['active' => false, 'configured' => false],
    'hanshow' => ['active' => false, 'configured' => false],
    'payment' => ['active' => false, 'configured' => false]
];

if ($companyId) {
    // TAMSOFT (separate try/catch per integration)
    try {
        $tamsoft = $db->fetch(
            "SELECT api_url, auto_sync_enabled FROM tamsoft_settings WHERE company_id = ?",
            [$companyId]
        );
        if ($tamsoft) {
            $integrations['tamsoft']['configured'] = !empty($tamsoft['api_url']);
            $integrations['tamsoft']['active'] = !empty($tamsoft['api_url']) && !empty($tamsoft['auto_sync_enabled']);
        }
        $lastSync = $db->fetch(
            "SELECT created_at FROM tamsoft_sync_logs WHERE company_id = ? ORDER BY created_at DESC LIMIT 1",
            [$companyId]
        );
        if ($lastSync) {
            $integrations['tamsoft']['last_sync'] = $lastSync['created_at'];
        }
    } catch (Exception $e) {}

    // HAL
    try {
        $settings = $db->fetch(
            "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
            [$companyId]
        );
        if ($settings) {
            $settingsData = json_decode($settings['data'] ?? '{}', true) ?: [];
            $halIntegration = $settingsData['hal_integration'] ?? [];
            $integrations['hal']['configured'] = !empty($halIntegration['username']);
            $integrations['hal']['active'] = !empty($halIntegration['enabled']) && !empty($halIntegration['username']);
        }
    } catch (Exception $e) {}

    // Hanshow
    try {
        $hanshow = $db->fetch(
            "SELECT eslworking_url, enabled FROM hanshow_settings WHERE company_id = ?",
            [$companyId]
        );
        if ($hanshow) {
            $integrations['hanshow']['configured'] = !empty($hanshow['eslworking_url']);
            $integrations['hanshow']['active'] = !empty($hanshow['eslworking_url']) && !empty($hanshow['enabled']);
        }
    } catch (Exception $e) {}

    // Payment (payment_settings has no company_id column)
    try {
        $payment = $db->fetch(
            "SELECT provider, is_active FROM payment_settings LIMIT 1"
        );
        if ($payment) {
            $integrations['payment']['configured'] = !empty($payment['provider']);
            $integrations['payment']['active'] = !empty($payment['provider']) && !empty($payment['is_active']);
        }
    } catch (Exception $e) {}
}

// Render queue summary
$renderQueueSummary = [
    'total' => 0,
    'pending' => 0,
    'processing' => 0,
    'completed' => 0,
    'failed' => 0,
    'by_priority' => [],
    'success_rate' => 0,
    'avg_completion_seconds' => 0
];

try {
    $rqResult = $db->fetch(
        "SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
         FROM render_queue WHERE 1=1" . $companyFilter,
        $params
    );
    if ($rqResult) {
        $renderQueueSummary['total'] = (int)($rqResult['total'] ?? 0);
        $renderQueueSummary['pending'] = (int)($rqResult['pending'] ?? 0);
        $renderQueueSummary['processing'] = (int)($rqResult['processing'] ?? 0);
        $renderQueueSummary['completed'] = (int)($rqResult['completed'] ?? 0);
        $renderQueueSummary['failed'] = (int)($rqResult['failed'] ?? 0);

        $totalFinished = $renderQueueSummary['completed'] + $renderQueueSummary['failed'];
        if ($totalFinished > 0) {
            $renderQueueSummary['success_rate'] = round(($renderQueueSummary['completed'] / $totalFinished) * 100, 1);
        }
    }

    $byPriority = $db->fetchAll(
        "SELECT priority, COUNT(*) as count FROM render_queue WHERE 1=1" . $companyFilter . "
         GROUP BY priority ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 ELSE 5 END",
        $params
    );
    $renderQueueSummary['by_priority'] = $byPriority ?: [];

    $avgResult = $db->fetch(
        "SELECT AVG(
            EXTRACT(EPOCH FROM (completed_at - created_at))
         ) as avg_seconds
         FROM render_queue WHERE status = 'completed' AND completed_at IS NOT NULL" . $companyFilter,
        $params
    );
    $renderQueueSummary['avg_completion_seconds'] = round((float)($avgResult['avg_seconds'] ?? 0), 1);
} catch (Exception $e) {}

// Gateway stats
$gatewayStats = [
    'total' => 0,
    'online' => 0,
    'offline' => 0,
    'error' => 0
];

try {
    $gatewayCountsQuery = "
        SELECT 'total' as metric, COUNT(*) as count FROM gateways WHERE 1=1" . $companyFilter . "
        UNION ALL
        SELECT status, COUNT(*) FROM gateways WHERE 1=1" . $companyFilter . " GROUP BY status
    ";
    $gatewayCounts = $db->fetchAll($gatewayCountsQuery, $params ? array_merge($params, $params) : []);

    foreach ($gatewayCounts as $row) {
        $metric = $row['metric'] ?? $row['status'];
        $gatewayStats[$metric] = (int)$row['count'];
    }
} catch (Exception $e) {
    // Gateway table might not exist
}

Response::success([
    'products' => $stats['products'],
    'devices' => $stats['devices'],
    'total_devices' => $stats['total_devices'],
    'templates' => $stats['templates'],
    'categories' => $stats['categories'],
    'media' => $publicMedia + $companyMedia,
    'updates' => (int)$updateCount,
    'today_updates' => (int)$todayUpdates,
    'online_devices' => $stats['online_devices'],
    'pending_imports' => (int)$pendingImports,
    'active_licenses' => $activeLicenses,
    'expiring_licenses' => $expiringLicenses,
    'storage_used_mb' => $storageUsed,
    'storage_limit_mb' => $storageLimit,
    'storage_unlimited' => $storageUnlimited,
    'storage_breakdown' => [
        'media_mb' => round(($storageUsage['media_bytes'] ?? 0) / (1024 * 1024), 2),
        'templates_mb' => round(($storageUsage['templates_bytes'] ?? 0) / (1024 * 1024), 2),
        'renders_mb' => round(($storageUsage['renders_bytes'] ?? 0) / (1024 * 1024), 2),
    ],
    'error_rate' => $errorRate,
    'error_trend' => $errorTrend,
    'product_trend' => $productTrend,

    // Gateway Stats
    'gateways' => $gatewayStats,

    // CRM Extended Data
    'offline_devices' => $offlineDevices,
    'devices_by_type' => $devicesByType,
    'devices_by_branch' => $devicesByBranch,
    'product_device_assigned' => $productDeviceAssigned,
    'product_template_assigned' => $productTemplateAssigned,
    'last_updated_product' => $lastUpdatedProduct,
    'system_templates' => $systemTemplates,
    'templates_by_type' => $templatesByType,
    'public_media' => $publicMedia,
    'company_media' => $companyMedia,
    'signage_devices' => $signageDevices,
    'playlists' => $playlistStats,
    'playlist_item_count' => $playlistItemCount,
    'playlist_device_count' => $playlistDeviceCount,
    'company_info' => $companyInfo,
    'branch_count' => $branchCount,
    'user_count' => $userCount,
    'active_sessions' => $activeSessions,
    'license_info' => $licenseInfo,
    'integrations' => $integrations,
    'render_queue_summary' => $renderQueueSummary
]);
