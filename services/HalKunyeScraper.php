<?php
/**
 * HAL Künye Sorgulama - Web Scraping Servisi
 *
 * hal.gov.tr künye sorgulama sayfasından veri çeker.
 * Bu servis, HAL API kimlik bilgileri olmadan çalışır.
 *
 * @version 1.0.0
 */

class HalKunyeScraper
{
    private const BASE_URL = 'https://www.hal.gov.tr';
    private const KUNYE_PAGE = '/Sayfalar/KunyeSorgulama.aspx';

    private string $cookieFile;
    private ?string $requestDigest = null;
    private array $lastError = [];

    public function __construct()
    {
        $this->cookieFile = sys_get_temp_dir() . '/hal_kunye_cookies_' . md5(__FILE__) . '.txt';
    }

    /**
     * Künye numarası ile sorgulama yap
     *
     * @param string $kunyeNo 19 haneli künye numarası
     * @return array Sorgu sonucu
     */
    public function query(string $kunyeNo): array
    {
        // Künye numarasını temizle
        $kunyeNo = preg_replace('/[^0-9]/', '', $kunyeNo);

        if (strlen($kunyeNo) !== 19) {
            return [
                'success' => false,
                'error' => 'Künye numarası 19 haneli olmalıdır',
                'kunye_no' => $kunyeNo
            ];
        }

        try {
            // Yöntem 1: Direkt sayfa sorgusu dene
            $result = $this->queryDirect($kunyeNo);
            if ($result['success']) {
                return $result;
            }

            // Yöntem 2: SharePoint search API dene
            $result = $this->queryViaSearch($kunyeNo);
            if ($result['success']) {
                return $result;
            }

            // Yöntem 3: Form submit dene
            $result = $this->queryViaForm($kunyeNo);
            if ($result['success']) {
                return $result;
            }

            return [
                'success' => false,
                'error' => 'Künye sorgulanamadı. HAL sistemi CAPTCHA (robot doğrulama) gerektiriyor.',
                'kunye_no' => $kunyeNo,
                'requires_captcha' => true,
                'manual_query_url' => 'https://www.hal.gov.tr/Sayfalar/KunyeSorgulama.aspx',
                'hint' => 'HAL kimlik bilgilerinizi Ayarlar > Entegrasyonlar bölümünden girerek SOAP API ile sorgulama yapabilirsiniz.',
                'details' => $this->lastError
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => 'Sorgu hatası: ' . $e->getMessage(),
                'kunye_no' => $kunyeNo
            ];
        }
    }

    /**
     * Direkt URL ile künye sorgula
     */
    private function queryDirect(string $kunyeNo): array
    {
        // Künye numarasını URL parametresi olarak dene
        $urls = [
            self::BASE_URL . self::KUNYE_PAGE . '?kunye=' . $kunyeNo,
            self::BASE_URL . self::KUNYE_PAGE . '?kunyeNo=' . $kunyeNo,
            self::BASE_URL . self::KUNYE_PAGE . '?no=' . $kunyeNo,
            self::BASE_URL . '/Sayfalar/KunyeDetay.aspx?kunye=' . $kunyeNo,
            self::BASE_URL . '/_layouts/15/KunyeSorgula.aspx?kunye=' . $kunyeNo
        ];

        foreach ($urls as $url) {
            $response = $this->makeRequest($url);

            if ($response['success'] && !empty($response['body'])) {
                $data = $this->parseKunyeHtml($response['body'], $kunyeNo);
                if ($data) {
                    return [
                        'success' => true,
                        'method' => 'direct',
                        'data' => $data
                    ];
                }
            }
        }

        return ['success' => false];
    }

    /**
     * SharePoint Search API ile sorgula
     */
    private function queryViaSearch(string $kunyeNo): array
    {
        // SharePoint REST Search API
        $searchUrl = self::BASE_URL . '/_api/search/query?querytext=%27' . $kunyeNo . '%27';

        $response = $this->makeRequest($searchUrl, [
            'Accept' => 'application/json;odata=verbose'
        ]);

        if ($response['success'] && !empty($response['body'])) {
            $json = json_decode($response['body'], true);

            if (isset($json['d']['query']['PrimaryQueryResult']['RelevantResults']['Table']['Rows'])) {
                $rows = $json['d']['query']['PrimaryQueryResult']['RelevantResults']['Table']['Rows'];

                foreach ($rows as $row) {
                    $cells = $row['Cells'];
                    $data = $this->parseSearchResult($cells, $kunyeNo);
                    if ($data) {
                        return [
                            'success' => true,
                            'method' => 'search',
                            'data' => $data
                        ];
                    }
                }
            }
        }

        return ['success' => false];
    }

    /**
     * Form submit ile sorgula
     */
    private function queryViaForm(string $kunyeNo): array
    {
        // Önce sayfayı yükle ve form token'larını al
        $pageResponse = $this->makeRequest(self::BASE_URL . self::KUNYE_PAGE);

        if (!$pageResponse['success']) {
            $this->lastError = ['stage' => 'page_load', 'error' => $pageResponse['error'] ?? 'Sayfa yüklenemedi'];
            return ['success' => false];
        }

        $html = $pageResponse['body'];

        // __REQUESTDIGEST token'ı çıkar
        if (preg_match('/"FormDigestValue":"([^"]+)"/', $html, $match)) {
            $this->requestDigest = $match[1];
        }

        // __VIEWSTATE ve diğer hidden alanları çıkar
        $formData = $this->extractFormFields($html);
        $formData['ctl00$g_c10caf96_9e01_446b_94f9_e6a0341bb595$S5FE43DF8_InputKeywords'] = $kunyeNo;

        // Arama sayfasına POST yap
        $searchUrl = self::BASE_URL . '/Sayfalar/AramaSayfasi.aspx?k=' . urlencode($kunyeNo);

        $response = $this->makeRequest($searchUrl, [], 'GET');

        if ($response['success'] && !empty($response['body'])) {
            $data = $this->parseSearchResultsPage($response['body'], $kunyeNo);
            if ($data) {
                return [
                    'success' => true,
                    'method' => 'form',
                    'data' => $data
                ];
            }
        }

        return ['success' => false];
    }

    /**
     * HTML'den form alanlarını çıkar
     */
    private function extractFormFields(string $html): array
    {
        $fields = [];

        // Hidden input'ları bul
        preg_match_all('/<input[^>]+type=["\']hidden["\'][^>]*>/i', $html, $matches);

        foreach ($matches[0] as $input) {
            if (preg_match('/name=["\']([^"\']+)["\']/', $input, $nameMatch) &&
                preg_match('/value=["\']([^"\']*)["\']/', $input, $valueMatch)) {
                $fields[$nameMatch[1]] = $valueMatch[1];
            }
        }

        return $fields;
    }

    /**
     * Künye HTML içeriğini parse et
     */
    private function parseKunyeHtml(string $html, string $kunyeNo): ?array
    {
        // Künye numarası sayfada var mı kontrol et
        if (strpos($html, $kunyeNo) === false) {
            return null;
        }

        $data = [
            'kunye_no' => $kunyeNo,
            // Üretim Yeri Bilgileri
            'uretici_adi' => '',
            'malin_adi' => '',
            'malin_cinsi' => '',
            'malin_turu' => '',
            'ilk_bildirim_tarihi' => '',
            'uretim_yeri' => '',
            // Tüketim Yeri Bilgileri
            'malin_sahibi' => '',
            'tuketim_bildirim_tarihi' => '',
            'tuketim_yeri' => '',
            // Etiket Bilgileri
            'gumruk_kapisi' => '',
            'uretim_ithal_tarihi' => '',
            'miktar' => '',
            'alis_fiyati' => null,
            'isletme_adi' => '',
            'diger_bilgiler' => '',
            // Organik Sertifika
            'sertifikasyon_kurulusu' => '',
            'sertifika_no' => '',
            // Geçmiş Bildirimler
            'gecmis_bildirimler' => [],
            // Geriye uyumluluk için eski alanlar
            'urun_adi' => '',
            'urun_cinsi' => '',
            'urun_turu' => '',
            'uretici' => '',
            'bildirim_tarihi' => ''
        ];

        // DOM Parser kullan
        libxml_use_internal_errors(true);
        $dom = new DOMDocument();
        $dom->loadHTML('<?xml encoding="UTF-8">' . $html);
        $xpath = new DOMXPath($dom);

        // Üretim Yeri Bilgileri tablosunu bul
        $tables = $xpath->query('//table');

        foreach ($tables as $table) {
            $tableHtml = $dom->saveHTML($table);

            // Üretim Yeri Bilgileri
            if (strpos($tableHtml, 'Üretici') !== false || strpos($tableHtml, 'Malın Adı') !== false) {
                $rows = $xpath->query('.//tr', $table);
                foreach ($rows as $row) {
                    $cells = $xpath->query('.//td', $row);
                    if ($cells->length >= 2) {
                        $label = trim($cells->item(0)->textContent);
                        $value = trim($cells->item(1)->textContent);

                        switch (true) {
                            case stripos($label, 'Üretici') !== false:
                            case stripos($label, 'Ad Soyad') !== false:
                                $data['uretici_adi'] = $value;
                                $data['uretici'] = $value; // Geriye uyumluluk
                                break;
                            case stripos($label, 'Malın Adı') !== false:
                                $data['malin_adi'] = $value;
                                $data['urun_adi'] = $value; // Geriye uyumluluk
                                break;
                            case stripos($label, 'Malın Cinsi') !== false:
                                $data['malin_cinsi'] = $value;
                                $data['urun_cinsi'] = $value; // Geriye uyumluluk
                                break;
                            case stripos($label, 'Malın Türü') !== false:
                                $data['malin_turu'] = $value;
                                $data['urun_turu'] = $value; // Geriye uyumluluk
                                break;
                            case stripos($label, 'Üretim Yeri') !== false:
                            case stripos($label, 'Malın Üretim Yeri') !== false:
                                $data['uretim_yeri'] = $value;
                                break;
                            case stripos($label, 'İlk Bildirim Tarihi') !== false:
                                $data['ilk_bildirim_tarihi'] = $value;
                                $data['bildirim_tarihi'] = $value; // Geriye uyumluluk
                                break;
                            case stripos($label, 'Bildirim Tarihi') !== false:
                                if (empty($data['ilk_bildirim_tarihi'])) {
                                    $data['ilk_bildirim_tarihi'] = $value;
                                    $data['bildirim_tarihi'] = $value;
                                }
                                break;
                            case stripos($label, 'Gümrük Kapısı') !== false:
                                $data['gumruk_kapisi'] = $value;
                                break;
                            case stripos($label, 'Üretim/İthal Tarihi') !== false:
                            case stripos($label, 'Üretim Tarihi') !== false:
                            case stripos($label, 'İthal Tarihi') !== false:
                                $data['uretim_ithal_tarihi'] = $value;
                                break;
                            case stripos($label, 'Miktar') !== false:
                                $data['miktar'] = $value;
                                break;
                            case stripos($label, 'Alış Fiyatı') !== false:
                                $data['alis_fiyati'] = $this->parsePrice($value);
                                break;
                            case stripos($label, 'İşletme Adı') !== false:
                                $data['isletme_adi'] = $value;
                                break;
                            case stripos($label, 'Diğer Bilgiler') !== false:
                                $data['diger_bilgiler'] = $value;
                                break;
                            case stripos($label, 'Sertifikasyon Kuruluşu') !== false:
                                $data['sertifikasyon_kurulusu'] = $value;
                                break;
                            case stripos($label, 'Sertifika No') !== false:
                                $data['sertifika_no'] = $value;
                                break;
                        }
                    }
                }
            }

            // Tüketim Yeri Bilgileri
            if (strpos($tableHtml, 'Tüketim') !== false || strpos($tableHtml, 'Malın Sahibi') !== false) {
                $rows = $xpath->query('.//tr', $table);
                foreach ($rows as $row) {
                    $cells = $xpath->query('.//td', $row);
                    if ($cells->length >= 2) {
                        $label = trim($cells->item(0)->textContent);
                        $value = trim($cells->item(1)->textContent);

                        if (stripos($label, 'Malın Sahibi') !== false) {
                            $data['malin_sahibi'] = $value;
                        } elseif (stripos($label, 'Bildirim Tarihi') !== false) {
                            $data['tuketim_bildirim_tarihi'] = $value;
                        } elseif (stripos($label, 'Tüketim Yeri') !== false) {
                            $data['tuketim_yeri'] = $value;
                        }
                    }
                    // Eski format için 3 hücreli satır desteği
                    if ($cells->length >= 3) {
                        $location = trim($cells->item(2)->textContent);
                        if (!empty($location) && empty($data['tuketim_yeri'])) {
                            $data['tuketim_yeri'] = $location;
                        }
                    }
                }
            }

            // Geçmiş Bildirimler tablosu
            if (strpos($tableHtml, 'Geçmiş') !== false || strpos($tableHtml, 'Sıfat') !== false) {
                $rows = $xpath->query('.//tr', $table);
                $isHeader = true;
                foreach ($rows as $row) {
                    if ($isHeader) {
                        $isHeader = false;
                        continue;
                    }
                    $cells = $xpath->query('.//td', $row);
                    if ($cells->length >= 4) {
                        $data['gecmis_bildirimler'][] = [
                            'adi_soyadi' => trim($cells->item(0)->textContent),
                            'sifat' => trim($cells->item(1)->textContent),
                            'islem_turu' => trim($cells->item(2)->textContent),
                            'satis_fiyati' => $this->parsePrice(trim($cells->item(3)->textContent))
                        ];
                    }
                }
            }
        }

        libxml_clear_errors();

        // En az ürün adı veya üretici varsa veri döndür
        if (!empty($data['malin_adi']) || !empty($data['uretici_adi']) || !empty($data['urun_adi']) || !empty($data['uretici'])) {
            return $data;
        }

        return null;
    }

    /**
     * Fiyat değerini parse et
     */
    private function parsePrice(?string $value): ?float
    {
        if (empty($value)) {
            return null;
        }
        // TL, ₺, TRY gibi para birimi işaretlerini kaldır
        $cleaned = preg_replace('/[^0-9,.]/', '', $value);
        // Virgülü noktaya çevir
        $cleaned = str_replace(',', '.', $cleaned);
        $price = floatval($cleaned);
        return $price > 0 ? $price : null;
    }

    /**
     * Search API sonuçlarını parse et
     */
    private function parseSearchResult(array $cells, string $kunyeNo): ?array
    {
        $data = ['kunye_no' => $kunyeNo];

        foreach ($cells as $cell) {
            $key = $cell['Key'] ?? '';
            $value = $cell['Value'] ?? '';

            // Künye ile ilgili alanları eşleştir
            switch ($key) {
                case 'Title':
                    $data['baslik'] = $value;
                    break;
                case 'Path':
                    $data['url'] = $value;
                    break;
                case 'HitHighlightedSummary':
                    $data['ozet'] = strip_tags($value);
                    break;
            }
        }

        return !empty($data['baslik']) ? $data : null;
    }

    /**
     * Arama sonuçları sayfasını parse et
     */
    private function parseSearchResultsPage(string $html, string $kunyeNo): ?array
    {
        if (strpos($html, $kunyeNo) === false) {
            return null;
        }

        // Arama sonuçlarından künye detay linkini bul
        if (preg_match('/href="([^"]*' . preg_quote($kunyeNo, '/') . '[^"]*)"/i', $html, $match)) {
            $detailUrl = $match[1];
            if (strpos($detailUrl, 'http') !== 0) {
                $detailUrl = self::BASE_URL . $detailUrl;
            }

            // Detay sayfasını yükle
            $detailResponse = $this->makeRequest($detailUrl);
            if ($detailResponse['success']) {
                return $this->parseKunyeHtml($detailResponse['body'], $kunyeNo);
            }
        }

        return null;
    }

    /**
     * HTTP isteği yap
     */
    private function makeRequest(string $url, array $headers = [], string $method = 'GET', ?array $postData = null): array
    {
        $ch = curl_init();

        $defaultHeaders = [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language: tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Connection: keep-alive',
            'Upgrade-Insecure-Requests: 1'
        ];

        foreach ($headers as $key => $value) {
            $defaultHeaders[] = "$key: $value";
        }

        if ($this->requestDigest) {
            $defaultHeaders[] = 'X-RequestDigest: ' . $this->requestDigest;
        }

        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER => $defaultHeaders,
            CURLOPT_COOKIEJAR => $this->cookieFile,
            CURLOPT_COOKIEFILE => $this->cookieFile,
            CURLOPT_ENCODING => 'gzip, deflate'
        ]);

        if ($method === 'POST' && $postData) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);

        curl_close($ch);

        if ($error) {
            $this->lastError = ['curl_error' => $error];
            return ['success' => false, 'error' => $error];
        }

        return [
            'success' => $httpCode >= 200 && $httpCode < 400,
            'http_code' => $httpCode,
            'body' => $response
        ];
    }

    /**
     * Toplu künye sorgula
     */
    public function queryMultiple(array $kunyeNumbers): array
    {
        $results = [];

        foreach ($kunyeNumbers as $kunyeNo) {
            $results[$kunyeNo] = $this->query($kunyeNo);

            // Rate limiting
            usleep(1000000); // 1 saniye bekle
        }

        return $results;
    }

    /**
     * Cookie dosyasını temizle
     */
    public function clearSession(): void
    {
        if (file_exists($this->cookieFile)) {
            unlink($this->cookieFile);
        }
        $this->requestDigest = null;
    }
}
