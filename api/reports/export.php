<?php
/**
 * Dashboard Report Export API
 * Exports dashboard statistics as CSV or PDF
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

$format = $request->query('format', 'csv');

// Build company filter
$companyFilter = '';
$params = [];

if ($companyId) {
    $companyFilter = ' AND company_id = ?';
    $params[] = $companyId;
}

// Get all statistics
$startOfMonth = date('Y-m-01 00:00:00');
$fiveMinutesAgo = date('Y-m-d H:i:s', strtotime('-5 minutes'));

// Products
$products = $db->fetch(
    "SELECT COUNT(*) as count FROM products WHERE status != 'deleted'" . $companyFilter,
    $params
)['count'] ?? 0;

// Devices
$devices = $db->fetch(
    "SELECT COUNT(*) as count FROM devices WHERE status IN ('online', 'offline')" . $companyFilter,
    $params
)['count'] ?? 0;

$onlineDevices = $db->fetch(
    "SELECT COUNT(*) as count FROM devices WHERE last_seen >= ? AND status = 'online'" . $companyFilter,
    $companyId ? [$fiveMinutesAgo, $companyId] : [$fiveMinutesAgo]
)['count'] ?? 0;

// Templates
$templates = $db->fetch(
    "SELECT COUNT(*) as count FROM templates WHERE status = 'active'" . $companyFilter,
    $params
)['count'] ?? 0;

// Categories
$categories = $db->fetch(
    "SELECT COUNT(*) as count FROM categories WHERE 1=1" . $companyFilter,
    $params
)['count'] ?? 0;

// Media files
$mediaCount = $db->fetch(
    "SELECT COUNT(*) as count FROM media WHERE 1=1" . $companyFilter,
    $params
)['count'] ?? 0;

$mediaSize = $db->fetch(
    "SELECT COALESCE(SUM(file_size), 0) as total FROM media" . ($companyId ? " WHERE company_id = ?" : ""),
    $companyId ? [$companyId] : []
)['total'] ?? 0;

// Licenses
$activeLicenses = 0;
$expiringLicenses = 0;
try {
    $activeLicenses = $db->fetch(
        "SELECT COUNT(*) as count FROM licenses WHERE status = 'active'"
    )['count'] ?? 0;

    $thirtyDaysLater = date('Y-m-d', strtotime('+30 days'));
    $expiringLicenses = $db->fetch(
        "SELECT COUNT(*) as count FROM licenses WHERE status = 'active' AND valid_until <= ?",
        [$thirtyDaysLater]
    )['count'] ?? 0;
} catch (Exception $e) {
    // Ignore
}

// Recent activities count
$recentActivities = 0;
try {
    $recentActivities = $db->fetch(
        "SELECT COUNT(*) as count FROM audit_logs WHERE created_at >= ?" . ($companyId ? " AND company_id = ?" : ""),
        $companyId ? [$startOfMonth, $companyId] : [$startOfMonth]
    )['count'] ?? 0;
} catch (Exception $e) {
    // Ignore
}

// Get company name
$companyName = 'Tüm Firmalar';
if ($companyId) {
    $company = $db->fetch("SELECT name FROM companies WHERE id = ?", [$companyId]);
    $companyName = $company['name'] ?? 'Bilinmeyen Firma';
}

// Build report data
$reportData = [
    ['Metrik', 'Değer', 'Açıklama'],
    ['Rapor Tarihi', date('d.m.Y H:i'), 'Rapor oluşturulma zamanı'],
    ['Firma', $companyName, 'Raporun ait olduğu firma'],
    ['', '', ''],
    ['=== ÜRÜN İSTATİSTİKLERİ ===', '', ''],
    ['Toplam Ürün', $products, 'Sistemdeki aktif ürün sayısı'],
    ['Kategori Sayısı', $categories, 'Toplam kategori sayısı'],
    ['', '', ''],
    ['=== CİHAZ İSTATİSTİKLERİ ===', '', ''],
    ['Toplam Cihaz', $devices, 'Kayıtlı cihaz sayısı'],
    ['Çevrimiçi Cihaz', $onlineDevices, 'Şu an aktif olan cihazlar'],
    ['Çevrimdışı Cihaz', $devices - $onlineDevices, 'Şu an pasif olan cihazlar'],
    ['Çevrimiçi Oranı', $devices > 0 ? round(($onlineDevices / $devices) * 100, 1) . '%' : '0%', 'Aktif cihaz yüzdesi'],
    ['', '', ''],
    ['=== ŞABLON VE MEDYA ===', '', ''],
    ['Aktif Şablon', $templates, 'Kullanımda olan şablonlar'],
    ['Medya Dosyası', $mediaCount, 'Yüklü medya dosyası sayısı'],
    ['Depolama Kullanımı', round($mediaSize / (1024 * 1024), 2) . ' MB', 'Toplam dosya boyutu'],
    ['', '', ''],
    ['=== LİSANS DURUMU ===', '', ''],
    ['Aktif Lisans', $activeLicenses, 'Geçerli lisans sayısı'],
    ['Süresi Dolacak Lisans', $expiringLicenses, '30 gün içinde süresi dolacak'],
    ['', '', ''],
    ['=== AKTİVİTE ===', '', ''],
    ['Bu Ay Aktivite', $recentActivities, 'Bu ay yapılan işlem sayısı']
];

if ($format === 'csv') {
    // CSV Export
    $filename = 'dashboard_raporu_' . date('Y-m-d_H-i') . '.csv';

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Pragma: no-cache');
    header('Expires: 0');

    // UTF-8 BOM for Excel
    echo "\xEF\xBB\xBF";

    $output = fopen('php://output', 'w');

    foreach ($reportData as $row) {
        fputcsv($output, $row, ';');
    }

    fclose($output);
    exit;
} else {
    // JSON response for other purposes
    Response::success([
        'report_date' => date('Y-m-d H:i:s'),
        'company' => $companyName,
        'statistics' => [
            'products' => $products,
            'categories' => $categories,
            'devices' => $devices,
            'online_devices' => $onlineDevices,
            'templates' => $templates,
            'media_count' => $mediaCount,
            'storage_mb' => round($mediaSize / (1024 * 1024), 2),
            'active_licenses' => $activeLicenses,
            'expiring_licenses' => $expiringLicenses,
            'monthly_activities' => $recentActivities
        ]
    ]);
}
