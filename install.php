<?php
/**
 * Omnex Display Hub - Installation Script
 *
 * Run this script once to set up the database and initial data.
 * Access: http://localhost/market-etiket-sistemi/install.php
 *
 * @package OmnexDisplayHub
 */

// Load configuration
require_once __DIR__ . '/config.php';

// Check if already installed
$dbFile = DATABASE_PATH . '/omnex.db';
$installed = file_exists($dbFile) && filesize($dbFile) > 0;

// Handle form submission
$message = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Run migrations
        $db = Database::getInstance();
        $db->migrate();

        // Run seeds
        $db->seed();

        $message = 'Kurulum başarıyla tamamlandı! Şimdi uygulamaya giriş yapabilirsiniz.';
        $installed = true;

    } catch (Exception $e) {
        $error = 'Kurulum hatası: ' . $e->getMessage();
    }
}

?>
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Omnex Display Hub - Kurulum</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full">
        <div class="text-center mb-8">
            <div class="inline-flex items-center gap-3 mb-4">
                <div class="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center">
                    <i class="ti ti-devices text-3xl text-white"></i>
                </div>
            </div>
            <h1 class="text-2xl font-bold text-gray-900">Omnex Display Hub</h1>
            <p class="text-gray-500 mt-2">Kurulum Sihirbazı</p>
        </div>

        <?php if ($message): ?>
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div class="flex items-center gap-3">
                    <i class="ti ti-circle-check text-green-600 text-xl"></i>
                    <div>
                        <p class="text-green-800 font-medium"><?= htmlspecialchars($message) ?></p>
                        <p class="text-green-600 text-sm mt-1">
                            Varsayılan giriş bilgileri:<br>
                            E-posta: admin@omnex.local<br>
                            Şifre: Admin123!
                        </p>
                    </div>
                </div>
            </div>
            <a href="public/" class="btn bg-blue-600 text-white w-full py-3 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2">
                <i class="ti ti-arrow-right"></i>
                Uygulamaya Git
            </a>
        <?php elseif ($error): ?>
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div class="flex items-center gap-3">
                    <i class="ti ti-circle-x text-red-600 text-xl"></i>
                    <p class="text-red-800"><?= htmlspecialchars($error) ?></p>
                </div>
            </div>
            <form method="POST">
                <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2">
                    <i class="ti ti-refresh"></i>
                    Tekrar Dene
                </button>
            </form>
        <?php elseif ($installed): ?>
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div class="flex items-center gap-3">
                    <i class="ti ti-alert-triangle text-yellow-600 text-xl"></i>
                    <div>
                        <p class="text-yellow-800 font-medium">Uygulama zaten kurulu</p>
                        <p class="text-yellow-600 text-sm mt-1">Veritabanı dosyası mevcut. Yeniden kurmak için veritabanını silin.</p>
                    </div>
                </div>
            </div>
            <a href="public/" class="bg-blue-600 text-white w-full py-3 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2">
                <i class="ti ti-arrow-right"></i>
                Uygulamaya Git
            </a>
        <?php else: ?>
            <div class="space-y-4 mb-6">
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <i class="ti ti-check text-green-600"></i>
                    <span class="text-gray-700">PHP <?= phpversion() ?></span>
                </div>
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <i class="ti ti-<?= extension_loaded('pdo_sqlite') ? 'check text-green-600' : 'x text-red-600' ?>"></i>
                    <span class="text-gray-700">PDO SQLite Extension</span>
                </div>
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <i class="ti ti-<?= extension_loaded('json') ? 'check text-green-600' : 'x text-red-600' ?>"></i>
                    <span class="text-gray-700">JSON Extension</span>
                </div>
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <i class="ti ti-<?= extension_loaded('openssl') ? 'check text-green-600' : 'x text-red-600' ?>"></i>
                    <span class="text-gray-700">OpenSSL Extension</span>
                </div>
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <i class="ti ti-<?= is_writable(dirname($dbFile)) ? 'check text-green-600' : 'x text-red-600' ?>"></i>
                    <span class="text-gray-700">Database Directory Writable</span>
                </div>
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <i class="ti ti-<?= is_writable(STORAGE_PATH) ? 'check text-green-600' : 'x text-red-600' ?>"></i>
                    <span class="text-gray-700">Storage Directory Writable</span>
                </div>
            </div>

            <?php if (extension_loaded('pdo_sqlite') && is_writable(dirname($dbFile))): ?>
                <form method="POST">
                    <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2">
                        <i class="ti ti-database"></i>
                        Kurulumu Başlat
                    </button>
                </form>
            <?php else: ?>
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-800 text-sm">
                        Kurulum gereksinimlerini karşılamıyorsunuz. Lütfen eksik gereksinimleri tamamlayın.
                    </p>
                </div>
            <?php endif; ?>
        <?php endif; ?>

        <div class="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>&copy; <?= date('Y') ?> Omnex Display Hub</p>
        </div>
    </div>
</body>
</html>
