<?php
/**
 * TAMSOFT ERP Gateway Service
 *
 * TAMSOFT ERP sistemi ile entegrasyon için kullanılır.
 * Token tabanlı OAuth2 authentication kullanır.
 *
 * @version 1.0.0
 * @author Omnex Display Hub
 */

class TamsoftGateway
{
    private $baseUrl;
    private $username;
    private $password;
    private $defaultDepoId;
    private $timeout;
    private $db;
    private $companyId;
    private $settings;
    private $renderCacheService;

    /**
     * Constructor
     *
     * @param string|null $companyId Firma ID (null ise Auth'dan alınır)
     * @param array|null $settings Ayarlar (null ise veritabanından yükler)
     */
    public function __construct($companyId = null, $settings = null)
    {
        $this->db = Database::getInstance();

        // Company ID belirleme
        if ($companyId === null) {
            $user = Auth::user();
            $companyId = $user['company_id'] ?? null;
        }
        $this->companyId = $companyId;

        // Ayarları yükle
        if ($settings === null) {
            $settings = $this->loadSettings();
        }
        $this->settings = $settings;

        $this->baseUrl = rtrim($settings['api_url'] ?? 'http://tamsoftintegration.camlica.com.tr', '/');
        $this->username = $settings['username'] ?? '';
        $this->password = $settings['password'] ?? '';
        $this->defaultDepoId = $settings['default_depo_id'] ?? 1;
        $this->timeout = $settings['timeout'] ?? 30;

        // RenderCacheService yükle (ürün güncellemelerinde otomatik render için)
        require_once __DIR__ . '/RenderCacheService.php';
        $this->renderCacheService = new RenderCacheService();
    }

    /**
     * Ayarları veritabanından yükle
     */
    private function loadSettings()
    {
        if (!$this->companyId) {
            return $this->getDefaultSettings();
        }

        $settings = $this->db->fetch(
            "SELECT * FROM tamsoft_settings WHERE company_id = ?",
            [$this->companyId]
        );

        if ($settings) {
            return $settings;
        }

        return $this->getDefaultSettings();
    }

    /**
     * Varsayılan ayarları döndür
     */
    private function getDefaultSettings()
    {
        return [
            'api_url' => 'http://tamsoftintegration.camlica.com.tr',
            'username' => '',
            'password' => '',
            'default_depo_id' => 1,
            'sync_interval' => 30,
            'only_stock_positive' => 0,
            'only_ecommerce' => 0,
            'single_barcode' => 1,
            'enabled' => 0
        ];
    }

    /**
     * API yanıtını unwrap et
     * TAMSOFT API bazen sonucu bir obje içinde sarabilir
     * Örn: {"Result": [...], "Success": true} veya {"data": [...]}
     */
    private function unwrapApiResponse($data)
    {
        if (!is_array($data)) {
            return $data;
        }

        // Zaten düz bir dizi ise (numeric indexed), olduğu gibi döndür
        if (array_values($data) === $data) {
            return $data;
        }

        // Associative array ise, bilinen wrapper key'leri kontrol et
        $wrapperKeys = ['Result', 'result', 'Data', 'data', 'Items', 'items', 'Records', 'records', 'List', 'list', 'Rows', 'rows', 'Content', 'content', 'Value', 'value'];
        foreach ($wrapperKeys as $key) {
            if (isset($data[$key]) && is_array($data[$key])) {
                error_log("[TAMSOFT unwrap] Found wrapper key '$key' with " . count($data[$key]) . " items");
                return $data[$key];
            }
        }

        // Tek key'li associative array ise ve değer array ise, unwrap et
        if (count($data) === 1) {
            $firstKey = array_key_first($data);
            $firstValue = $data[$firstKey];
            if (is_array($firstValue)) {
                error_log("[TAMSOFT unwrap] Single key '$firstKey' with " . count($firstValue) . " items, unwrapping");
                return $firstValue;
            }
        }

        error_log("[TAMSOFT unwrap] No wrapper detected, returning as-is. Keys: " . implode(',', array_keys($data)));
        return $data;
    }

    /**
     * OAuth2 token al
     * Token 1 saat geçerli, cache'de saklanır
     */
    public function getAccessToken($forceRefresh = false)
    {
        if (!$this->companyId) {
            throw new Exception('Company ID required');
        }

        // Önce cache'den kontrol et
        if (!$forceRefresh) {
            $cached = $this->db->fetch(
                "SELECT * FROM tamsoft_tokens
                 WHERE company_id = ? AND expires_at > CURRENT_TIMESTAMP
                 ORDER BY created_at DESC LIMIT 1",
                [$this->companyId]
            );

            if ($cached) {
                return $cached['access_token'];
            }
        }

        // Yeni token al
        $response = $this->requestToken();

        if (!isset($response['access_token'])) {
            throw new Exception('Token alınamadı: ' . ($response['error_description'] ?? 'Bilinmeyen hata'));
        }

        // Token'ı cache'e kaydet
        $expiresIn = $response['expires_in'] ?? 3600; // Varsayılan 1 saat
        $expiresAt = date('Y-m-d H:i:s', time() + $expiresIn - 60); // 1 dk erken expire et

        // Eski token'ları temizle
        $this->db->query(
            "DELETE FROM tamsoft_tokens WHERE company_id = ?",
            [$this->companyId]
        );

        // Yeni token'ı kaydet
        $this->db->insert('tamsoft_tokens', [
            'id' => $this->db->generateUuid(),
            'company_id' => $this->companyId,
            'access_token' => $response['access_token'],
            'token_type' => $response['token_type'] ?? 'bearer',
            'expires_at' => $expiresAt
        ]);

        return $response['access_token'];
    }

    /**
     * Token endpoint'ine istek at
     */
    private function requestToken()
    {
        $url = $this->baseUrl . '/token';

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query([
                'grant_type' => 'password',
                'username' => $this->username,
                'password' => $this->password
            ]),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/x-www-form-urlencoded'
            ]
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('CURL Error: ' . $error);
        }

        $data = json_decode($response, true);

        if ($httpCode !== 200) {
            throw new Exception('HTTP Error ' . $httpCode . ': ' . ($data['error_description'] ?? $response));
        }

        return $data;
    }

    /**
     * API isteği gönder (authenticated)
     */
    private function request($method, $endpoint, $params = [], $token = null)
    {
        if ($token === null) {
            $token = $this->getAccessToken();
        }

        $url = $this->baseUrl . $endpoint;

        // GET parametrelerini URL'e ekle
        if ($method === 'GET' && !empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'Content-Type: application/json',
                'Accept: application/json'
            ]
        ]);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($params));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('CURL Error: ' . $error);
        }

        // Debug: Raw response logla
        error_log("[TAMSOFT API] $method $endpoint HTTP/$httpCode response_length=" . strlen($response) . " first_200=" . substr($response, 0, 200));

        $data = json_decode($response, true);

        // Çift JSON kodlama durumunu handle et
        // TAMSOFT API bazen JSON stringi içinde JSON döndürüyor
        if (is_string($data)) {
            $innerData = json_decode($data, true);
            if ($innerData !== null) {
                $data = $innerData;
            }
        }

        // Token expired ise yenile ve tekrar dene
        if ($httpCode === 401) {
            $newToken = $this->getAccessToken(true);
            return $this->request($method, $endpoint, $params, $newToken);
        }

        if ($httpCode >= 400) {
            throw new Exception('HTTP Error ' . $httpCode . ': ' . ($data['Message'] ?? $response));
        }

        // Debug: Parsed response tipini logla
        error_log("[TAMSOFT API] $endpoint parsed_type=" . gettype($data) . " is_array=" . (is_array($data) ? 'yes' : 'no') . " count=" . (is_array($data) ? count($data) : 'N/A') . " keys=" . (is_array($data) && !empty($data) ? implode(',', array_slice(array_keys($data), 0, 5)) : 'none'));

        return $data;
    }

    /**
     * Bağlantı testi
     */
    public function ping()
    {
        $startTime = microtime(true);

        try {
            // Token alarak bağlantıyı test et
            $token = $this->getAccessToken(true);
            $responseTime = round((microtime(true) - $startTime) * 1000);

            // Depo listesi ile API'nin çalıştığını doğrula
            $depolar = $this->getDepolar();

            return [
                'success' => true,
                'response_time' => $responseTime,
                'message' => 'Bağlantı başarılı',
                'depo_count' => is_array($depolar) ? count($depolar) : 0
            ];
        } catch (Exception $e) {
            $responseTime = round((microtime(true) - $startTime) * 1000);

            return [
                'success' => false,
                'response_time' => $responseTime,
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Depo listesini getir
     */
    public function getDepolar()
    {
        return $this->request('GET', '/api/Integration/DepoListesi');
    }

    /**
     * Stok grup (kategori) listesini getir
     */
    public function getStokGruplari()
    {
        return $this->request('GET', '/api/Integration/StokGrupListesi');
    }

    /**
     * Stok listesini getir
     *
     * @param array $options Filtre seçenekleri
     * @return array Ürün listesi
     */
    public function getStokListesi($options = [])
    {
        // A2 FIX: force_all_stock varsa stok filtresini devre dışı bırak (sync sırasında TÜM ürünler çekilmeli)
        $forceAllStock = !empty($options['force_all_stock']);
        $onlyStockPositive = $forceAllStock ? false : ($options['only_stock_positive'] ?? $this->settings['only_stock_positive'] ?? 0);

        $params = [
            'tarih' => $options['tarih'] ?? '1900-01-01',
            'depoid' => $options['depoid'] ?? $this->defaultDepoId,
            'miktarsifirdanbuyukstoklarlistelensin' => $onlyStockPositive ? 'True' : 'False',
            'urununsonbarkodulistelensin' => ($options['single_barcode'] ?? $this->settings['single_barcode'] ?? 1) ? 'True' : 'False',
            'sadeceeticaretstoklarigetir' => ($options['only_ecommerce'] ?? $this->settings['only_ecommerce'] ?? 0) ? 'True' : 'False'
        ];

        error_log("[TAMSOFT StokListesi] params=" . json_encode($params));

        $data = $this->request('GET', '/api/Integration/StokListesi', $params);

        // Response unwrapping: TAMSOFT API bazen sonucu bir obje içinde sarabilir
        $data = $this->unwrapApiResponse($data);

        return $data;
    }

    /**
     * E-ticaret stok listesini getir
     */
    public function getEticaretStokListesi($options = [])
    {
        $params = [
            'tarih' => $options['tarih'] ?? '1900-01-01',
            'depoid' => $options['depoid'] ?? $this->defaultDepoId,
            'miktarsifirdanbuyukstoklarlistelensin' => ($options['only_stock_positive'] ?? false) ? 'True' : 'False'
        ];

        return $this->request('GET', '/api/Integration/EticaretStokListesi', $params);
    }

    /**
     * Tekil stok detayı getir
     *
     * @param string $stokKodu Ürün kodu veya barkod
     * @param int|null $depoId Depo ID
     */
    public function getStokDetay($stokKodu, $depoId = null)
    {
        $params = [
            'stokkodu' => $stokKodu,
            'depoid' => $depoId ?? $this->defaultDepoId
        ];

        return $this->request('GET', '/api/Integration/StokDetay', $params);
    }

    /**
     * TAMSOFT ürün verisini Omnex products formatına dönüştür
     *
     * @param array $tamsoftProduct TAMSOFT ürün verisi
     * @return array Omnex product formatı
     */
    public function mapToOmnexProduct($tamsoftProduct)
    {
        // Ana barkod ve birim belirleme
        $barcode = null;
        $unit = null;
        if (!empty($tamsoftProduct['Barkodlar']) && is_array($tamsoftProduct['Barkodlar'])) {
            $barcode = $tamsoftProduct['Barkodlar'][0]['Barkodu'] ?? null;
            $unit = $tamsoftProduct['Barkodlar'][0]['Birim'] ?? null;
        }

        // Fiyat mantığı:
        // - Tutar = Normal fiyat
        // - IndirimliTutar = Kampanyalı fiyat
        // - Eğer IndirimliTutar < Tutar ise kampanya var
        $normalFiyat = floatval($tamsoftProduct['Tutar'] ?? 0);
        $indirimFiyat = floatval($tamsoftProduct['IndirimliTutar'] ?? 0);

        $currentPrice = $normalFiyat;
        $previousPrice = null;
        $discountPercent = null;

        if ($indirimFiyat > 0 && $indirimFiyat < $normalFiyat) {
            // Kampanya aktif
            $currentPrice = $indirimFiyat;
            $previousPrice = $normalFiyat;
            $discountPercent = round((($normalFiyat - $indirimFiyat) / $normalFiyat) * 100, 1);
        }

        // Kategori ve grup hiyerarşisi belirleme
        // Gruplar hiyerarşik yapıda gelebilir: [SüperMarket, Atıştırmalık, Çikolata]
        // İlk grup = group (üst kategori), son grup = subcategory
        $category = $tamsoftProduct['Kategori'] ?? null;
        $group = null;
        $subcategory = null;
        if (!empty($tamsoftProduct['Gruplar']) && is_array($tamsoftProduct['Gruplar'])) {
            $gruplar = $tamsoftProduct['Gruplar'];
            $group = $gruplar[0]['Tanim'] ?? null;
            // Birden fazla grup varsa son grubu subcategory olarak kullan
            if (count($gruplar) > 1) {
                $subcategory = $gruplar[count($gruplar) - 1]['Tanim'] ?? null;
            }
        }

        // Marka (UreticiFirmaAdi)
        $brand = $tamsoftProduct['UreticiFirmaAdi'] ?? null;
        if ($brand) {
            $brand = trim($brand);
            if ($brand === '') $brand = null;
        }

        // ERP resmi (fallback olarak kullanılacak - ilk resim)
        $erpImageUrl = null;
        if (!empty($tamsoftProduct['Resimler']) && is_array($tamsoftProduct['Resimler'])) {
            $erpImageUrl = $tamsoftProduct['Resimler'][0] ?? null;
        }

        // Çoklu resimler - tüm ERP resim URL'leri (JSON array olarak saklanacak)
        $images = null;
        if (!empty($tamsoftProduct['Resimler']) && is_array($tamsoftProduct['Resimler']) && count($tamsoftProduct['Resimler']) > 0) {
            $imageArray = [];
            foreach ($tamsoftProduct['Resimler'] as $imgUrl) {
                if (!empty($imgUrl)) {
                    $imageArray[] = ['url' => $imgUrl, 'source' => 'erp'];
                }
            }
            if (!empty($imageArray)) {
                $images = json_encode($imageArray, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
        }

        // HTML temizleme: TAMSOFT'tan gelen alanlar HTML etiketleri içerebilir
        $name = $tamsoftProduct['UrunAdi'] ?? null;
        if ($name) {
            $name = trim(strip_tags(html_entity_decode($name, ENT_QUOTES | ENT_HTML5, 'UTF-8')));
            // Birden fazla boşluğu tek boşluğa indir
            $name = preg_replace('/\s+/', ' ', $name);
        }

        $description = $tamsoftProduct['UrunAciklamasi'] ?? null;
        if ($description) {
            $description = trim(strip_tags(html_entity_decode($description, ENT_QUOTES | ENT_HTML5, 'UTF-8')));
            // &nbsp; ve benzeri kalıntıları temizle
            $description = preg_replace('/\s+/', ' ', $description);
            // Boş kalmışsa null yap
            if ($description === '' || $description === ' ') {
                $description = null;
            }
        }

        // ERP data: Marketplace fiyatları, e-ticaret bilgileri, çoklu barkodlar, gruplar
        $erpData = [];

        // Marketplace fiyatları
        $marketplaceFields = ['n11', 'trendyol', 'hepsiburada', 'amazon', 'getir', 'ggidiyor', 'eptt', 'trendyol_marketplace', 'pazarama_marketplace'];
        $marketplacePrices = [];
        foreach ($marketplaceFields as $field) {
            $val = $tamsoftProduct[$field] ?? 0;
            if (floatval($val) > 0) {
                $marketplacePrices[$field] = floatval($val);
            }
        }
        if (!empty($marketplacePrices)) {
            $erpData['marketplace_prices'] = $marketplacePrices;
        }

        // E-ticaret görünürlük durumu
        if (isset($tamsoftProduct['EticaretteGoruntulensin'])) {
            $erpData['ecommerce_visible'] = (bool) $tamsoftProduct['EticaretteGoruntulensin'];
        }
        if (!empty($tamsoftProduct['EticaretKategoriId'])) {
            $erpData['ecommerce_category_id'] = $tamsoftProduct['EticaretKategoriId'];
        }
        if (!empty($tamsoftProduct['EticaretMarkaId'])) {
            $erpData['ecommerce_brand_id'] = $tamsoftProduct['EticaretMarkaId'];
        }

        // Çoklu barkodlar (birim bazlı fiyat bilgisi dahil)
        if (!empty($tamsoftProduct['Barkodlar']) && is_array($tamsoftProduct['Barkodlar']) && count($tamsoftProduct['Barkodlar']) > 0) {
            $erpData['barcodes'] = $tamsoftProduct['Barkodlar'];
        }

        // Grup hiyerarşisi (tam yapı)
        if (!empty($tamsoftProduct['Gruplar']) && is_array($tamsoftProduct['Gruplar']) && count($tamsoftProduct['Gruplar']) > 0) {
            $erpData['groups'] = $tamsoftProduct['Gruplar'];
        }

        $erpDataJson = !empty($erpData) ? json_encode($erpData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;

        return [
            'sku' => $tamsoftProduct['UrunKodu'] ?? null,
            'barcode' => $barcode,
            'name' => $name,
            'description' => $description,
            'current_price' => $currentPrice,
            'previous_price' => $previousPrice,
            'discount_percent' => $discountPercent,
            'vat_rate' => floatval($tamsoftProduct['KDVOrani'] ?? 0),
            'unit' => $unit,
            'stock' => floatval($tamsoftProduct['Envanter'] ?? 0),
            'category' => $category,
            'subcategory' => $subcategory,
            'group' => $group,
            'brand' => $brand,
            'erp_image_url' => $erpImageUrl,
            'images' => $images,
            'erp_data' => $erpDataJson,
            'erp_product_id' => strval($tamsoftProduct['ID'] ?? null),
            'erp_updated_at' => $tamsoftProduct['GuncellemeTarihi'] ?? null,
            'supplier_code' => $tamsoftProduct['UreticiFirmaAdi'] ?? null,
            // Ham veri (debug için)
            '_raw_barkodlar' => $tamsoftProduct['Barkodlar'] ?? [],
            '_raw_gruplar' => $tamsoftProduct['Gruplar'] ?? [],
            '_raw_resimler' => $tamsoftProduct['Resimler'] ?? []
        ];
    }

    /**
     * Ürünleri senkronize et
     *
     * @param array $options Senkronizasyon seçenekleri
     * @param callable|null $progressCallback İlerleme callback'i
     * @return array Senkronizasyon sonucu
     */
    public function syncProducts($options = [], $progressCallback = null)
    {
        if (!$this->companyId) {
            throw new Exception('Company ID required');
        }

        $syncLogId = $this->db->generateUuid();
        $startedAt = date('Y-m-d H:i:s');

        // Log kaydı oluştur
        $this->db->insert('tamsoft_sync_logs', [
            'id' => $syncLogId,
            'company_id' => $this->companyId,
            'sync_type' => 'products',
            'status' => 'running',
            'started_at' => $startedAt
        ]);

        $result = [
            'success' => false,
            'total' => 0,
            'inserted' => 0,
            'updated' => 0,
            'failed' => 0,
            'errors' => [],
            'render_jobs_created' => 0
        ];

        // Değişen ürün ID'lerini takip et (toplu render için)
        $changedProductIds = [];

        try {
            // Son senkronizasyon tarihini al
            $lastSyncDate = $options['full_sync'] ?? false
                ? '1900-01-01'
                : ($this->settings['last_sync_date'] ?? '1900-01-01');

            // Stok listesini çek
            // A1 FIX: PHP'de !empty(0) = false olduğu için isset kontrolü kullan
            $depoId = (isset($options['depoid']) && $options['depoid'] !== null && $options['depoid'] !== '')
                ? intval($options['depoid'])
                : $this->defaultDepoId;

            error_log("[TAMSOFT syncProducts] Starting sync: depoId=$depoId, lastSyncDate=$lastSyncDate, full_sync=" . ($options['full_sync'] ?? 'false'));

            // A2 FIX: Sync sırasında stok filtresi devre dışı - TÜM ürünleri çek
            $stockList = $this->getStokListesi([
                'tarih' => $lastSyncDate,
                'depoid' => $depoId,
                'force_all_stock' => true
            ]);

            error_log("[TAMSOFT syncProducts] getStokListesi returned: type=" . gettype($stockList) . " is_array=" . (is_array($stockList) ? 'yes' : 'no') . " count=" . (is_array($stockList) ? count($stockList) : 'N/A'));

            if (is_array($stockList) && !empty($stockList)) {
                $firstItem = reset($stockList);
                $firstKey = key($stockList);
                error_log("[TAMSOFT syncProducts] First item key=$firstKey type=" . gettype($firstItem) . " keys=" . (is_array($firstItem) ? implode(',', array_slice(array_keys($firstItem), 0, 10)) : substr(json_encode($firstItem), 0, 200)));
            }

            if (!is_array($stockList)) {
                error_log("[TAMSOFT syncProducts] ERROR: stockList is not array! value=" . substr(json_encode($stockList), 0, 500));
                throw new Exception('Geçersiz stok listesi yanıtı: ' . gettype($stockList));
            }

            $result['total'] = count($stockList);

            // AUTO FULL SYNC: API 0 ürün döndürdüyse ve full_sync değilse,
            // lokalde bu firma için aktif ürün sayısını kontrol et.
            // 0 ürün varsa muhtemelen ürünler silinmiş, full_sync ile tekrar dene.
            if (count($stockList) === 0 && !($options['full_sync'] ?? false)) {
                $localProductCount = $this->db->fetch(
                    "SELECT COUNT(*) as cnt FROM products WHERE company_id = ? AND status = 'active'",
                    [$this->companyId]
                );
                $localCount = intval($localProductCount['cnt'] ?? 0);

                error_log("[TAMSOFT syncProducts] API returned 0 products (incremental). Local active products: $localCount");

                if ($localCount === 0) {
                    error_log("[TAMSOFT syncProducts] Auto-retrying with full_sync=true (no local products, API returned 0)");

                    // last_sync_date'i sıfırla ve full_sync ile tekrar çağır
                    $options['full_sync'] = true;
                    return $this->syncProducts($options, $progressCallback);
                }
            }

            // Her ürünü işle
            foreach ($stockList as $index => $tamsoftProduct) {
                try {
                    $omnexProduct = $this->mapToOmnexProduct($tamsoftProduct);

                    // E3: SKU boş ise ürünü atla
                    if (empty($omnexProduct['sku'])) {
                        $result['failed']++;
                        $result['errors'][] = [
                            'product' => $tamsoftProduct['UrunKodu'] ?? 'Unknown',
                            'error' => 'SKU boş - ürün atlandı'
                        ];
                        continue;
                    }

                    // E1: Mevcut ürünü kontrol et (SKU veya ERP ID ile) - deleted ürünleri hariç tut
                    $existing = $this->db->fetch(
                        "SELECT id, status FROM products
                         WHERE company_id = ? AND (sku = ? OR erp_product_id = ?) AND status != 'deleted'",
                        [$this->companyId, $omnexProduct['sku'], $omnexProduct['erp_product_id']]
                    );

                    if ($existing) {
                        // Güncelle
                        $updateData = [
                            'name' => $omnexProduct['name'],
                            'barcode' => $omnexProduct['barcode'],
                            'description' => $omnexProduct['description'],
                            'current_price' => $omnexProduct['current_price'],
                            'previous_price' => $omnexProduct['previous_price'],
                            'discount_percent' => $omnexProduct['discount_percent'],
                            'vat_rate' => $omnexProduct['vat_rate'],
                            'unit' => $omnexProduct['unit'],
                            'stock' => $omnexProduct['stock'],
                            'category' => $omnexProduct['category'],
                            'subcategory' => $omnexProduct['subcategory'],
                            'group' => $omnexProduct['group'],
                            'brand' => $omnexProduct['brand'],
                            'supplier_code' => $omnexProduct['supplier_code'],
                            'erp_product_id' => $omnexProduct['erp_product_id'],
                            'erp_updated_at' => $omnexProduct['erp_updated_at'],
                            'erp_data' => $omnexProduct['erp_data'],
                            'status' => 'active',  // E2: Sync ile gelen ürünleri aktif yap
                            'updated_at' => date('Y-m-d H:i:s')
                        ];

                        // ERP resmi ve çoklu resimler sadece kullanıcı atamadıysa güncelle
                        $currentProduct = $this->db->fetch(
                            "SELECT image_url, images FROM products WHERE id = ?",
                            [$existing['id']]
                        );

                        if (empty($currentProduct['image_url']) && empty($currentProduct['images'])) {
                            $updateData['erp_image_url'] = $omnexProduct['erp_image_url'];
                            if (!empty($omnexProduct['images'])) {
                                $updateData['images'] = $omnexProduct['images'];
                            }
                        }

                        $this->db->update('products', $updateData, 'id = ?', [$existing['id']]);
                        $result['updated']++;
                        $changedProductIds[] = $existing['id'];

                        // C2: Depo bazlı branch override yaz
                        $this->syncBranchOverride($existing['id'], $tamsoftProduct, $depoId);
                    } else {
                        // Yeni ekle
                        $newProductId = $this->db->generateUuid();
                        $insertData = [
                            'id' => $newProductId,
                            'company_id' => $this->companyId,
                            'sku' => $omnexProduct['sku'],
                            'barcode' => $omnexProduct['barcode'],
                            'name' => $omnexProduct['name'],
                            'description' => $omnexProduct['description'],
                            'current_price' => $omnexProduct['current_price'],
                            'previous_price' => $omnexProduct['previous_price'],
                            'discount_percent' => $omnexProduct['discount_percent'],
                            'vat_rate' => $omnexProduct['vat_rate'],
                            'unit' => $omnexProduct['unit'],
                            'stock' => $omnexProduct['stock'],
                            'category' => $omnexProduct['category'],
                            'subcategory' => $omnexProduct['subcategory'],
                            'group' => $omnexProduct['group'],
                            'brand' => $omnexProduct['brand'],
                            'supplier_code' => $omnexProduct['supplier_code'],
                            'erp_product_id' => $omnexProduct['erp_product_id'],
                            'erp_image_url' => $omnexProduct['erp_image_url'],
                            'erp_updated_at' => $omnexProduct['erp_updated_at'],
                            'erp_data' => $omnexProduct['erp_data'],
                            'status' => 'active',
                            'created_at' => date('Y-m-d H:i:s'),
                            'updated_at' => date('Y-m-d H:i:s')
                        ];
                        if (!empty($omnexProduct['images'])) {
                            $insertData['images'] = $omnexProduct['images'];
                        }
                        $this->db->insert('products', $insertData);
                        $result['inserted']++;
                        $changedProductIds[] = $newProductId;

                        // C2: Depo bazlı branch override yaz
                        $this->syncBranchOverride($newProductId, $tamsoftProduct, $depoId);
                    }

                    // Progress callback
                    if ($progressCallback && is_callable($progressCallback)) {
                        $progressCallback($index + 1, $result['total'], $omnexProduct['name']);
                    }
                } catch (Exception $e) {
                    $result['failed']++;
                    $result['errors'][] = [
                        'product' => $tamsoftProduct['UrunKodu'] ?? 'Unknown',
                        'error' => $e->getMessage()
                    ];
                }
            }

            // Son senkronizasyon tarihini sadece gerçekten ürün işlendiyse güncelle
            // 0 ürün geldiğinde tarihi güncelleme - yoksa silme sonrası tekrar sync çalışmaz
            if ($result['inserted'] > 0 || $result['updated'] > 0) {
                $this->db->query(
                    "UPDATE tamsoft_settings SET last_sync_date = ?, updated_at = CURRENT_TIMESTAMP WHERE company_id = ?",
                    [date('Y-m-d H:i:s'), $this->companyId]
                );
            }

            // Değişen ürünler için arka planda render job'ları oluştur
            if (!empty($changedProductIds)) {
                try {
                    $renderResult = $this->renderCacheService->onBulkProductsUpdated(
                        $changedProductIds,
                        $this->companyId,
                        'erp', // kaynak: ERP senkronizasyonu
                        ['priority' => 'low'] // ERP sync düşük öncelikli
                    );
                    $result['render_jobs_created'] = $renderResult['total_jobs'] ?? 0;

                    // Kullanıcıya bildirim gönder (render job'ları oluşturuldu)
                    if ($result['render_jobs_created'] > 0) {
                        $user = Auth::user();
                        if ($user && !empty($user['id'])) {
                            require_once __DIR__ . '/NotificationTriggers.php';
                            NotificationTriggers::onRenderJobsComplete(
                                $user['id'],
                                'tamsoft',
                                $result['render_jobs_created'],
                                count($changedProductIds),
                                ['erp_name' => 'TAMSOFT']
                            );
                        }
                    }
                } catch (Exception $e) {
                    // Render job oluşturma başarısız olsa bile sync devam etsin
                    $result['errors'][] = [
                        'type' => 'render_job_error',
                        'error' => $e->getMessage()
                    ];
                }
            }

            $result['success'] = true;
        } catch (Exception $e) {
            $result['errors'][] = ['error' => $e->getMessage()];
        }

        // Log kaydını güncelle
        $this->db->update('tamsoft_sync_logs', [
            'status' => $result['success'] ? 'completed' : 'failed',
            'total_items' => $result['total'],
            'inserted' => $result['inserted'],
            'updated' => $result['updated'],
            'failed' => $result['failed'],
            'error_message' => !empty($result['errors']) ? json_encode($result['errors']) : null,
            'completed_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$syncLogId]);

        return $result;
    }

    /**
     * Tüm depolardan ürünleri senkronize et
     *
     * @param array $options Senkronizasyon seçenekleri
     * @param callable|null $progressCallback İlerleme callback'i
     * @return array Birleştirilmiş senkronizasyon sonucu
     */
    public function syncAllProducts($options = [], $progressCallback = null)
    {
        if (!$this->companyId) {
            throw new Exception('Company ID required');
        }

        // Tüm depoları al
        $depolar = $this->getDepolar();
        if (!is_array($depolar) || empty($depolar)) {
            throw new Exception('Depo listesi alınamadı veya boş');
        }

        $combinedResult = [
            'success' => false,
            'total' => 0,
            'inserted' => 0,
            'updated' => 0,
            'failed' => 0,
            'errors' => [],
            'render_jobs_created' => 0,
            'depo_count' => count($depolar),
            'depo_results' => []
        ];

        foreach ($depolar as $depo) {
            $depoId = $depo['Depoid'] ?? $depo['ID'] ?? $depo['DepoID'] ?? 0;
            $depoName = $depo['Adi'] ?? $depo['DepoAdi'] ?? ('Depo ' . $depoId);

            if (!$depoId) continue;

            try {
                $depoOptions = array_merge($options, ['depoid' => $depoId]);
                $result = $this->syncProducts($depoOptions, $progressCallback);

                $combinedResult['total'] += $result['total'] ?? 0;
                $combinedResult['inserted'] += $result['inserted'] ?? 0;
                $combinedResult['updated'] += $result['updated'] ?? 0;
                $combinedResult['failed'] += $result['failed'] ?? 0;
                $combinedResult['render_jobs_created'] += $result['render_jobs_created'] ?? 0;

                if (!empty($result['errors'])) {
                    foreach ($result['errors'] as $err) {
                        $err['depo'] = $depoName;
                        $combinedResult['errors'][] = $err;
                    }
                }

                $combinedResult['depo_results'][] = [
                    'depo_id' => $depoId,
                    'depo_name' => $depoName,
                    'total' => $result['total'] ?? 0,
                    'inserted' => $result['inserted'] ?? 0,
                    'updated' => $result['updated'] ?? 0,
                    'failed' => $result['failed'] ?? 0,
                    'success' => $result['success'] ?? false
                ];

                if ($result['success']) {
                    $combinedResult['success'] = true;
                }
            } catch (Exception $e) {
                $combinedResult['errors'][] = [
                    'depo' => $depoName,
                    'error' => $e->getMessage()
                ];
                $combinedResult['depo_results'][] = [
                    'depo_id' => $depoId,
                    'depo_name' => $depoName,
                    'total' => 0,
                    'inserted' => 0,
                    'updated' => 0,
                    'failed' => 0,
                    'success' => false,
                    'error' => $e->getMessage()
                ];
            }
        }

        // En az bir depo başarılıysa success = true
        if (empty($combinedResult['depo_results'])) {
            $combinedResult['errors'][] = ['error' => 'Hiçbir depo işlenemedi'];
        }

        return $combinedResult;
    }

    /**
     * Senkronizasyon loglarını getir
     */
    public function getSyncLogs($limit = 10)
    {
        if (!$this->companyId) {
            return [];
        }

        return $this->db->fetchAll(
            "SELECT * FROM tamsoft_sync_logs
             WHERE company_id = ?
             ORDER BY created_at DESC
             LIMIT ?",
            [$this->companyId, $limit]
        );
    }

    /**
     * Ayarları kaydet
     */
    public function saveSettings($data)
    {
        if (!$this->companyId) {
            throw new Exception('Company ID required');
        }

        $existing = $this->db->fetch(
            "SELECT id FROM tamsoft_settings WHERE company_id = ?",
            [$this->companyId]
        );

        $settingsData = [
            'api_url' => $data['api_url'] ?? 'http://tamsoftintegration.camlica.com.tr',
            'username' => $data['username'] ?? '',
            'password' => $data['password'] ?? '',
            'default_depo_id' => intval($data['default_depo_id'] ?? 1),
            'sync_interval' => intval($data['sync_interval'] ?? 30),
            'only_stock_positive' => !empty($data['only_stock_positive']) ? 1 : 0,
            'only_ecommerce' => !empty($data['only_ecommerce']) ? 1 : 0,
            'single_barcode' => !empty($data['single_barcode']) ? 1 : 0,
            'auto_sync_enabled' => !empty($data['auto_sync_enabled']) ? 1 : 0,
            'enabled' => !empty($data['enabled']) ? 1 : 0,
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if ($existing) {
            $this->db->update('tamsoft_settings', $settingsData, 'id = ?', [$existing['id']]);
        } else {
            $settingsData['id'] = $this->db->generateUuid();
            $settingsData['company_id'] = $this->companyId;
            $settingsData['created_at'] = date('Y-m-d H:i:s');
            $this->db->insert('tamsoft_settings', $settingsData);
        }

        // Instance ayarlarını güncelle
        $this->settings = array_merge($this->settings, $settingsData);
        $this->baseUrl = rtrim($settingsData['api_url'], '/');
        $this->username = $settingsData['username'];
        $this->password = $settingsData['password'];
        $this->defaultDepoId = $settingsData['default_depo_id'];

        return true;
    }

    /**
     * Mevcut ayarları getir
     */
    public function getSettings()
    {
        $settings = $this->loadSettings();

        // Şifreyi maskele
        if (!empty($settings['password'])) {
            $settings['password_masked'] = 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢';
        }

        return $settings;
    }

    // =========================================================================
    // B2: Depo → Şube (Branch) Eşleştirme Metodları
    // =========================================================================

    /**
     * Varsayılan bölge (region) oluştur veya mevcut olanı döndür
     *
     * @param string $companyId Firma ID
     * @return string Region branch ID
     */
    public function ensureDefaultRegion(string $companyId): string
    {
        // Mevcut region var mı kontrol et
        $existing = $this->db->fetch(
            "SELECT id FROM branches WHERE company_id = ? AND type = 'region' AND code = 'DEFAULT_REGION'",
            [$companyId]
        );

        if ($existing) {
            return $existing['id'];
        }

        // Yoksa oluştur
        require_once __DIR__ . '/BranchService.php';
        $result = BranchService::create([
            'company_id' => $companyId,
            'code' => 'DEFAULT_REGION',
            'external_code' => 'DEFAULT_REGION',
            'name' => 'Varsayılan Bölge',
            'type' => 'region',
            'is_active' => 1
        ]);

        if (!$result['success']) {
            error_log("[TAMSOFT] Default region oluşturulamadı: " . ($result['error'] ?? 'Bilinmeyen hata'));
            throw new Exception('Varsayılan bölge oluşturulamadı: ' . ($result['error'] ?? ''));
        }

        error_log("[TAMSOFT] Default region oluşturuldu: " . $result['data']['id']);
        return $result['data']['id'];
    }

    /**
     * TAMSOFT depolarını şubelere (branch) eşle
     *
     * @param array $depolar TAMSOFT API'den gelen depo listesi
     * @param string $companyId Firma ID
     * @return array Eşleştirme sonucu
     */
    public function mapDepotsToBranches(array $depolar, string $companyId): array
    {
        require_once __DIR__ . '/BranchService.php';

        $result = [
            'mapped' => 0,
            'created' => 0,
            'existing' => 0,
            'failed' => 0,
            'mappings' => [],
            'errors' => []
        ];

        // Varsayılan bölgeyi hazırla
        try {
            $regionId = $this->ensureDefaultRegion($companyId);
        } catch (Exception $e) {
            $result['errors'][] = 'Varsayılan bölge oluşturulamadı: ' . $e->getMessage();
            return $result;
        }

        foreach ($depolar as $depo) {
            $depoId = $depo['Depoid'] ?? $depo['ID'] ?? $depo['DepoID'] ?? null;
            $depoKod = $depo['Kod'] ?? null;
            $depoAdi = $depo['Adi'] ?? $depo['DepoAdi'] ?? ('Depo ' . $depoId);

            if ($depoId === null) {
                $result['errors'][] = "Depo ID bulunamadı: " . json_encode($depo);
                $result['failed']++;
                continue;
            }

            $depoId = intval($depoId);

            try {
                // 1. Zaten eşleşme var mı?
                $existingMapping = $this->db->fetch(
                    "SELECT id, branch_id FROM tamsoft_depo_mapping WHERE company_id = ? AND tamsoft_depo_id = ?",
                    [$companyId, $depoId]
                );

                if ($existingMapping) {
                    $result['existing']++;
                    $result['mappings'][] = [
                        'depo_id' => $depoId,
                        'depo_adi' => $depoAdi,
                        'branch_id' => $existingMapping['branch_id'],
                        'status' => 'existing'
                    ];
                    continue;
                }

                // 2. external_code ile mevcut branch ara
                $searchCode = $depoKod ?: "TAMSOFT_{$depoId}";
                $existingBranch = BranchService::findByCode($companyId, $searchCode);

                if ($existingBranch) {
                    // Mevcut branch'e eşle
                    $branchId = $existingBranch['id'];
                } else {
                    // 3. Yeni branch oluştur - sort_order otomatik ata
                    $branchCode = $depoKod ?: "TAMSOFT_{$depoId}";
                    $maxSort = $this->db->fetch(
                        "SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM branches WHERE company_id = ?",
                        [$companyId]
                    );
                    $nextSort = ($maxSort['max_sort'] ?? 0) + 1;

                    $createResult = BranchService::create([
                        'company_id' => $companyId,
                        'code' => $branchCode,
                        'external_code' => "TAMSOFT_{$depoId}",
                        'name' => $depoAdi,
                        'type' => 'store',
                        'parent_id' => $regionId,
                        'is_active' => 1,
                        'sort_order' => $nextSort
                    ]);

                    if (!$createResult['success']) {
                        $result['errors'][] = "Branch oluşturulamadı (Depo: {$depoAdi}): " . ($createResult['error'] ?? '');
                        $result['failed']++;
                        continue;
                    }

                    $branchId = $createResult['data']['id'];
                    $result['created']++;
                }

                // 4. Eşleştirme tablosuna kaydet
                $this->db->insert('tamsoft_depo_mapping', [
                    'id' => $this->db->generateUuid(),
                    'company_id' => $companyId,
                    'tamsoft_depo_id' => $depoId,
                    'tamsoft_depo_kod' => $depoKod,
                    'tamsoft_depo_adi' => $depoAdi,
                    'branch_id' => $branchId
                ]);

                $result['mapped']++;
                $result['mappings'][] = [
                    'depo_id' => $depoId,
                    'depo_adi' => $depoAdi,
                    'branch_id' => $branchId,
                    'status' => $existingBranch ? 'mapped_existing' : 'created'
                ];

                error_log("[TAMSOFT] Depo→Branch eşleştirildi: {$depoAdi} (ID:{$depoId}) → Branch:{$branchId}");
            } catch (Exception $e) {
                $result['errors'][] = "Depo eşleştirme hatası ({$depoAdi}): " . $e->getMessage();
                $result['failed']++;
            }
        }

        return $result;
    }

    /**
     * Depo ID'den branch ID döndür
     *
     * @param int $depoId TAMSOFT depo ID
     * @param string|null $companyId Firma ID (null ise instance'dan alınır)
     * @return string|null Branch ID veya null
     */
    public function getBranchIdForDepo(int $depoId, ?string $companyId = null): ?string
    {
        $companyId = $companyId ?? $this->companyId;

        $mapping = $this->db->fetch(
            "SELECT branch_id FROM tamsoft_depo_mapping WHERE company_id = ? AND tamsoft_depo_id = ?",
            [$companyId, $depoId]
        );

        return $mapping ? $mapping['branch_id'] : null;
    }

    // =========================================================================
    // C1: Depo Bazlı Ürün Branch Override
    // =========================================================================

    /**
     * Ürün için depo bazlı branch override yaz
     *
     * @param string $productId Ürün ID
     * @param array $tamsoftProduct TAMSOFT ham ürün verisi
     * @param int $depoId Depo ID
     */
    private function syncBranchOverride(string $productId, array $tamsoftProduct, int $depoId): void
    {
        try {
            $branchId = $this->getBranchIdForDepo($depoId);
            if (!$branchId) {
                // Eşleşme yapılmamış, override atla
                return;
            }

            // Fiyat hesapla (kampanya mantığı)
            $tutar = floatval($tamsoftProduct['Tutar'] ?? 0);
            $indirimliTutar = floatval($tamsoftProduct['IndirimliTutar'] ?? 0);
            $envanter = intval($tamsoftProduct['Envanter'] ?? 0);

            if ($indirimliTutar > 0 && $indirimliTutar < $tutar) {
                $currentPrice = $indirimliTutar;
                $previousPrice = $tutar;
            } else {
                $currentPrice = $tutar;
                $previousPrice = null;
            }

            // Mevcut override var mı kontrol et
            $existing = $this->db->fetch(
                "SELECT id FROM product_branch_overrides WHERE product_id = ? AND branch_id = ?",
                [$productId, $branchId]
            );

            $overrideData = [
                'current_price' => $currentPrice,
                'previous_price' => $previousPrice,
                'stock_quantity' => $envanter,
                'override_scope' => 'full',
                'source' => 'sync',
                'is_active' => 1,
                'updated_at' => date('Y-m-d H:i:s')
            ];

            if ($existing) {
                $this->db->update('product_branch_overrides', $overrideData, 'id = ?', [$existing['id']]);
            } else {
                $overrideData['id'] = $this->db->generateUuid();
                $overrideData['product_id'] = $productId;
                $overrideData['branch_id'] = $branchId;
                $overrideData['company_id'] = $this->companyId;
                $overrideData['created_at'] = date('Y-m-d H:i:s');
                $this->db->insert('product_branch_overrides', $overrideData);
            }
        } catch (Exception $e) {
            // Override hatası sync'i durdurmamalı
            error_log("[TAMSOFT] Branch override hatası (product:{$productId}, depo:{$depoId}): " . $e->getMessage());
        }
    }
}

