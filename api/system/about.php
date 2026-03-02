<?php
/**
 * About Page API - Get application info and changelog
 *
 * @version 1.0.0
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

// Get CHANGELOG.md content
$changelogPath = BASE_PATH . '/CHANGELOG.md';
$changelog = '';

if (file_exists($changelogPath)) {
    $changelog = file_get_contents($changelogPath);
}

// Get application version from config or package
$version = '2.0.0';

// Get branding images
$brandingPath = '/branding';
$branding = [
    'logo' => $brandingPath . '/logo.png',
    'logo_light' => $brandingPath . '/logo-light.png',
    'logo_dark' => $brandingPath . '/logo-dark.jpg',
    'favicon' => $brandingPath . '/favicon.png',
    'pwa_icon' => $brandingPath . '/pwa.png',
    'icon_192' => $brandingPath . '/icon-192.png',
    'icon_512' => $brandingPath . '/icon-512.png'
];

// Get system stats for footer
$stats = [
    'total_users' => 0,
    'total_companies' => 0,
    'total_devices' => 0,
    'total_products' => 0,
    'total_templates' => 0
];

try {
    // Count users
    $result = $db->fetch("SELECT COUNT(*) as count FROM users");
    $stats['total_users'] = $result['count'] ?? 0;

    // Count companies
    $result = $db->fetch("SELECT COUNT(*) as count FROM companies");
    $stats['total_companies'] = $result['count'] ?? 0;

    // Count devices
    $result = $db->fetch("SELECT COUNT(*) as count FROM devices");
    $stats['total_devices'] = $result['count'] ?? 0;

    // Count products
    $result = $db->fetch("SELECT COUNT(*) as count FROM products");
    $stats['total_products'] = $result['count'] ?? 0;

    // Count templates
    $result = $db->fetch("SELECT COUNT(*) as count FROM templates");
    $stats['total_templates'] = $result['count'] ?? 0;
} catch (Exception $e) {
    // Ignore errors, keep default values
}

Response::success([
    'version' => $version,
    'build' => '1',
    'name' => 'Omnex Display Hub',
    'description' => 'Dijital Ekran ve Etiket Yönetim Platformu',
    'branding' => $branding,
    'changelog' => $changelog,
    'stats' => $stats,
    'copyright' => '© ' . date('Y') . ' Omnex Display Hub',
    'developer' => 'Omnex Technologies'
]);
