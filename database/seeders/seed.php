<?php
/**
 * Universal Seeder CLI Script
 *
 * Kullanım:
 *   php seed.php [options]
 *
 * Options:
 *   --all              Tüm seeder'ları çalıştır
 *   --categories       Sadece kategorileri seed et
 *   --products         Sadece ürünleri seed et
 *   --production-types Sadece üretim tiplerini seed et
 *   --templates        Sadece şablonları seed et
 *   --settings         Sadece ayarları seed et
 *   --label-sizes      Sadece etiket boyutlarını seed et
 *   --menu-items       Sadece menü öğelerini seed et
 *   --layout-config    Sadece layout ayarlarını seed et
 *   --locale=XX        Dil kodu (tr, en, ru, az, de, nl, fr) [varsayılan: tr]
 *   --company=UUID     Firma ID
 *   --user=UUID        Oluşturan kullanıcı ID
 *   --demo-only        Sadece demo verileri
 *   --default-only     Sadece varsayılan verileri
 *   --dry-run          Veritabanına yazmadan simülasyon
 *   --verbose, -v      Detaylı çıktı
 *   --clear-demo       Demo verilerini temizle
 *   --clear-all        TÜM verileri temizle (dikkat!)
 *   --help, -h         Bu yardım mesajı
 *
 * Örnekler:
 *   php seed.php --all --locale=tr --verbose
 *   php seed.php --categories --company=abc123 --dry-run
 *   php seed.php --products --demo-only --verbose
 *   php seed.php --templates --locale=en --verbose
 *   php seed.php --clear-demo --categories
 *
 * @version 2.0.0
 * @since 2026-01-25
 */

// Proje kök dizini
$rootPath = dirname(dirname(__DIR__));

// Config yükle
require_once $rootPath . '/config.php';

// Seeder sınıfları yükle
require_once __DIR__ . '/BaseSeeder.php';
require_once __DIR__ . '/LicensePlanSeeder.php';
require_once __DIR__ . '/CategorySeeder.php';
require_once __DIR__ . '/ProductionTypeSeeder.php';
require_once __DIR__ . '/ProductSeeder.php';
require_once __DIR__ . '/TemplateSeeder.php';
require_once __DIR__ . '/SettingsSeeder.php';
require_once __DIR__ . '/LabelSizeSeeder.php';
require_once __DIR__ . '/MenuItemSeeder.php';
require_once __DIR__ . '/LayoutConfigSeeder.php';

// CLI kontrolü
if (php_sapi_name() !== 'cli') {
    die("Bu script sadece CLI'dan çalıştırılabilir.\n");
}

// Yardım metni
function showHelp() {
    echo <<<HELP
╔══════════════════════════════════════════════════════════════════╗
║                  Omnex Universal Seeder v2.0                     ║
╚══════════════════════════════════════════════════════════════════╝

KULLANIM:
  php seed.php [options]

SEEDER SEÇENEKLERİ:
  --all              Tüm seeder'ları çalıştır (önerilen)
  --categories       Sadece kategorileri seed et
  --products         Sadece ürünleri seed et
  --production-types Sadece üretim tiplerini seed et
  --templates        Sadece şablonları seed et
  --settings         Sadece firma ayarlarını seed et
  --label-sizes      Sadece etiket boyutlarını seed et
  --menu-items       Sadece menü öğelerini seed et
  --layout-config    Sadece layout ayarlarını seed et

KONFIGÜRASYON:
  --locale=XX        Dil kodu (tr, en, ru, az, de, nl, fr) [varsayılan: tr]
  --company=UUID     Firma ID (bazı seeder'lar için zorunlu)
  --user=UUID        Oluşturan kullanıcı ID

FİLTRELER:
  --demo-only        Sadece is_demo=true verileri
  --default-only     Sadece is_default=true verileri

TEMİZLEME:
  --clear-demo       Seçili seeder için demo verilerini temizle
  --clear-all        Seçili seeder için TÜM verileri temizle (DİKKAT!)

DİĞER:
  --dry-run          Simülasyon modu (veritabanına yazmaz)
  --verbose, -v      Detaylı çıktı
  --help, -h         Bu yardım mesajını göster

ÖRNEKLER:
  # Türkçe tüm demo verilerini yükle
  php seed.php --all --locale=tr --verbose

  # Sadece kategorileri dry-run modunda test et
  php seed.php --categories --dry-run --verbose

  # Belirli firmaya ürün ve şablon ekle
  php seed.php --products --templates --company=abc-123-uuid --verbose

  # İngilizce şablonları yükle
  php seed.php --templates --locale=en --verbose

  # Shared verileri yükle (label-sizes, menu-items, layout-config)
  php seed.php --label-sizes --menu-items --layout-config --verbose

  # Demo verilerini temizle
  php seed.php --clear-demo --all --company=abc-123-uuid


HELP;
}

// Argümanları parse et
$options = getopt('hvH', [
    'all',
    'license-plans',
    'categories',
    'products',
    'production-types',
    'templates',
    'settings',
    'label-sizes',
    'menu-items',
    'layout-config',
    'locale:',
    'company:',
    'user:',
    'demo-only',
    'default-only',
    'dry-run',
    'verbose',
    'clear-demo',
    'clear-all',
    'help'
]);

// Yardım
if (isset($options['help']) || isset($options['h']) || isset($options['H'])) {
    showHelp();
    exit(0);
}

// Seeder seçim kontrolü
$hasSeederOption = isset($options['all']) ||
    isset($options['license-plans']) ||
    isset($options['categories']) ||
    isset($options['products']) ||
    isset($options['production-types']) ||
    isset($options['templates']) ||
    isset($options['settings']) ||
    isset($options['label-sizes']) ||
    isset($options['menu-items']) ||
    isset($options['layout-config']);

// Argüman yoksa yardım göster
if (count($options) === 0 || !$hasSeederOption) {
    echo "Hata: En az bir seeder seçmelisiniz\n\n";
    showHelp();
    exit(1);
}

// Konfigürasyon
$locale = $options['locale'] ?? 'tr';
$companyId = $options['company'] ?? null;
$userId = $options['user'] ?? null;
$demoOnly = isset($options['demo-only']);
$defaultOnly = isset($options['default-only']);
$dryRun = isset($options['dry-run']);
$verbose = isset($options['verbose']) || isset($options['v']);
$clearDemo = isset($options['clear-demo']);
$clearAll = isset($options['clear-all']);

// Hangi seeder'ları çalıştır
$runLicensePlans = isset($options['all']) || isset($options['license-plans']);
$runCategories = isset($options['all']) || isset($options['categories']);
$runProducts = isset($options['all']) || isset($options['products']);
$runProductionTypes = isset($options['all']) || isset($options['production-types']);
$runTemplates = isset($options['all']) || isset($options['templates']);
$runSettings = isset($options['all']) || isset($options['settings']);
$runLabelSizes = isset($options['all']) || isset($options['label-sizes']);
$runMenuItems = isset($options['all']) || isset($options['menu-items']);
$runLayoutConfig = isset($options['all']) || isset($options['layout-config']);

// Başlık
echo "\n";
echo "╔══════════════════════════════════════════════════════════════════╗\n";
echo "║                  Omnex Universal Seeder v2.0                     ║\n";
echo "╚══════════════════════════════════════════════════════════════════╝\n\n";

echo "Konfigürasyon:\n";
echo "  Dil:           {$locale}\n";
echo "  Firma ID:      " . ($companyId ?: '(tümü/gerekli değil)') . "\n";
echo "  Demo Only:     " . ($demoOnly ? 'Evet' : 'Hayır') . "\n";
echo "  Default Only:  " . ($defaultOnly ? 'Evet' : 'Hayır') . "\n";
echo "  Dry-Run:       " . ($dryRun ? 'Evet' : 'Hayır') . "\n";
echo "  Verbose:       " . ($verbose ? 'Evet' : 'Hayır') . "\n";

if ($clearDemo) {
    echo "  İşlem:         DEMO VERİLERİNİ TEMİZLE\n";
} elseif ($clearAll) {
    echo "  İşlem:         TÜM VERİLERİ TEMİZLE (DİKKAT!)\n";
} else {
    echo "  İşlem:         Seed Et\n";
}

echo "\nSeeder'lar:\n";
echo "  License Plans:    " . ($runLicensePlans ? '✓' : '✗') . "\n";
echo "  Categories:       " . ($runCategories ? '✓' : '✗') . "\n";
echo "  Production Types: " . ($runProductionTypes ? '✓' : '✗') . "\n";
echo "  Products:         " . ($runProducts ? '✓' : '✗') . "\n";
echo "  Templates:        " . ($runTemplates ? '✓' : '✗') . "\n";
echo "  Settings:         " . ($runSettings ? '✓' : '✗') . "\n";
echo "  Label Sizes:      " . ($runLabelSizes ? '✓' : '✗') . "\n";
echo "  Menu Items:       " . ($runMenuItems ? '✓' : '✗') . "\n";
echo "  Layout Config:    " . ($runLayoutConfig ? '✓' : '✗') . "\n";
echo "\n";

// Onay iste (clear-all için)
if ($clearAll && !$dryRun) {
    echo "⚠️  DİKKAT: TÜM veriler silinecek! Devam etmek istiyor musunuz? (yes/no): ";
    $handle = fopen("php://stdin", "r");
    $line = fgets($handle);
    if (trim($line) !== 'yes') {
        echo "İptal edildi.\n";
        exit(0);
    }
    fclose($handle);
}

// İstatistikler
$totalStats = [
    'created' => 0,
    'updated' => 0,
    'skipped' => 0,
    'errors' => 0,
    'deleted' => 0
];

// Seeder'ı yapılandır
function configureSeeder(BaseSeeder $seeder, $locale, $companyId, $userId, $demoOnly, $defaultOnly, $dryRun, $verbose) {
    return $seeder
        ->setLocale($locale)
        ->setCompanyId($companyId ?? '')
        ->setCreatedBy($userId ?? '')
        ->setDemoOnly($demoOnly)
        ->setDefaultOnly($defaultOnly)
        ->setDryRun($dryRun)
        ->setVerbose($verbose);
}

// Seeder çalıştırma fonksiyonu
function runSeeder($seederClass, &$totalStats, $locale, $companyId, $userId, $demoOnly, $defaultOnly, $dryRun, $verbose, $clearDemo, $clearAll) {
    echo "────────────────────────────────────────────────────────────────────\n";
    $seeder = new $seederClass();
    configureSeeder($seeder, $locale, $companyId, $userId, $demoOnly, $defaultOnly, $dryRun, $verbose);

    if ($clearAll) {
        $deleted = $seeder->clearAllData();
        $totalStats['deleted'] += $deleted;
    } elseif ($clearDemo) {
        $deleted = $seeder->clearDemoData();
        $totalStats['deleted'] += $deleted;
    } else {
        $seeder->run();
        $stats = $seeder->getStats();
        $totalStats['created'] += $stats['created'];
        $totalStats['updated'] += $stats['updated'];
        $totalStats['skipped'] += $stats['skipped'];
        $totalStats['errors'] += $stats['errors'];
    }
}

// 0. License Plans
if ($runLicensePlans) {
    runSeeder('LicensePlanSeeder', $totalStats, $locale, $companyId, $userId, $demoOnly, $defaultOnly, $dryRun, $verbose, $clearDemo, $clearAll);
}

// 1. Categories
if ($runCategories) {
    runSeeder('CategorySeeder', $totalStats, $locale, $companyId, $userId, $demoOnly, $defaultOnly, $dryRun, $verbose, $clearDemo, $clearAll);
}

// 2. Production Types
if ($runProductionTypes) {
    runSeeder('ProductionTypeSeeder', $totalStats, $locale, $companyId, $userId, $demoOnly, $defaultOnly, $dryRun, $verbose, $clearDemo, $clearAll);
}

// 3. Products
if ($runProducts) {
    runSeeder('ProductSeeder', $totalStats, $locale, $companyId, $userId, $demoOnly, $defaultOnly, $dryRun, $verbose, $clearDemo, $clearAll);
}

// 4. Templates
if ($runTemplates) {
    runSeeder('TemplateSeeder', $totalStats, $locale, $companyId, $userId, $demoOnly, $defaultOnly, $dryRun, $verbose, $clearDemo, $clearAll);
}

// 5. Settings (firma ID gerekli)
if ($runSettings) {
    if (!$companyId && !$dryRun && !$clearDemo && !$clearAll) {
        echo "────────────────────────────────────────────────────────────────────\n";
        echo "⚠️  SettingsSeeder için --company parametresi gerekli, atlanıyor.\n";
    } else {
        runSeeder('SettingsSeeder', $totalStats, $locale, $companyId, $userId, $demoOnly, $defaultOnly, $dryRun, $verbose, $clearDemo, $clearAll);
    }
}

// 6. Label Sizes (shared - dil bağımsız)
if ($runLabelSizes) {
    runSeeder('LabelSizeSeeder', $totalStats, $locale, $companyId, $userId, $demoOnly, $defaultOnly, $dryRun, $verbose, $clearDemo, $clearAll);
}

// 7. Menu Items (shared - dil bağımsız)
if ($runMenuItems) {
    runSeeder('MenuItemSeeder', $totalStats, $locale, $companyId, $userId, $demoOnly, $defaultOnly, $dryRun, $verbose, $clearDemo, $clearAll);
}

// 8. Layout Config (shared - dil bağımsız)
if ($runLayoutConfig) {
    runSeeder('LayoutConfigSeeder', $totalStats, $locale, $companyId, $userId, $demoOnly, $defaultOnly, $dryRun, $verbose, $clearDemo, $clearAll);
}

// Toplam özet
echo "════════════════════════════════════════════════════════════════════\n";
echo "                         TOPLAM ÖZET\n";
echo "════════════════════════════════════════════════════════════════════\n";
if ($clearDemo || $clearAll) {
    echo "  Silinen:     {$totalStats['deleted']}\n";
} else {
    echo "  Eklenen:     {$totalStats['created']}\n";
    echo "  Güncellenen: {$totalStats['updated']}\n";
    echo "  Atlanan:     {$totalStats['skipped']}\n";
}
echo "  Hata:        {$totalStats['errors']}\n";
echo "════════════════════════════════════════════════════════════════════\n";

if ($dryRun) {
    echo "\n⚠️  DRY-RUN modu aktifti - hiçbir değişiklik yapılmadı.\n";
}

if ($totalStats['errors'] > 0) {
    echo "\n❌ İşlem hatalarla tamamlandı.\n";
    exit(1);
} else {
    echo "\n✅ İşlem başarıyla tamamlandı.\n";
    exit(0);
}
