<?php
/**
 * HAL Kayıt Sistemi Künye Sorgulama Servisi
 *
 * Bu servis üç yöntemle künye sorgulama yapabilir:
 * 1. cURL SOAP (HAL'ın hatalı WSDL'i nedeniyle tercih edilen yöntem)
 * 2. PHP SoapClient (WSDL parse hatası verirse cURL'e fallback yapar)
 * 3. Web Scraping (public künye sorgulama sayfasından - sınırlı)
 *
 * NOT: HAL'ın WSDL dosyası 63+ duplicate element içeriyor ve PHP SoapClient
 * bu WSDL'i parse edemiyor. Bu nedenle cURL ile raw SOAP request gönderiyoruz.
 *
 * @version 2.0.0
 * @author Omnex Display Hub
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';

class HalKunyeService
{
    // SOAP Web Service URL'leri
    private const BILDIRIM_SERVICE_URL = 'https://hks.hal.gov.tr/WebServices/BildirimService.svc?wsdl';
    private const BILDIRIM_SERVICE_ENDPOINT = 'https://hks.hal.gov.tr/WebServices/BildirimService.svc';
    private const GENEL_SERVICE_URL = 'https://hks.hal.gov.tr/WebServices/GenelService.svc?wsdl';

    // SOAP Actions
    private const SOAP_ACTION_BILDIRIM_TURLERI = 'http://www.gtb.gov.tr//WebServices/IBildirimService/BildirimServisBildirimTurleri';
    private const SOAP_ACTION_REFERANS_KUNYELER = 'http://www.gtb.gov.tr//WebServices/IBildirimService/BildirimServisReferansKunyeler';

    // SOAP Namespace
    private const SOAP_NAMESPACE = 'http://www.gtb.gov.tr//WebServices';

    // Public künye sorgulama URL'si
    private const KUNYE_QUERY_URL = 'https://www.hal.gov.tr/Sayfalar/KunyeSorgulama.aspx';

    // Ayarlar
    private ?array $settings = null;
    private ?SoapClient $soapClient = null;
    private Database $db;

    // cURL SOAP tercih edilsin mi (HAL WSDL hatası nedeniyle varsayılan true)
    private bool $preferCurlSoap = true;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->loadSettings();
    }

    /**
     * HAL entegrasyon ayarlarını yükle
     *
     * YENİ SİSTEM: integration_settings tablosundan SettingsResolver ile okur
     * ESKİ SİSTEM (fallback): settings tablosundan hal_integration JSON key ile okur
     */
    private function loadSettings(): void
    {
        $companyId = Auth::getActiveCompanyId();

        // 1. YENİ SİSTEM: integration_settings tablosundan oku (SettingsResolver)
        try {
            require_once __DIR__ . '/SettingsResolver.php';
            $resolver = new SettingsResolver();
            $effective = $resolver->getEffectiveSettings('hal', $companyId);

            if (!empty($effective['settings']) && $effective['source'] !== 'none') {
                $this->settings = $effective['settings'];
                return;
            }
        } catch (Exception $e) {
            // SettingsResolver yoksa veya hata olursa eski sisteme fallback
            error_log("HAL SettingsResolver error: " . $e->getMessage());
        }

        // 2. ESKİ SİSTEM (fallback): settings tablosundan oku
        $settings = $this->db->fetch(
            "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
            [$companyId]
        );

        if ($settings && !empty($settings['data'])) {
            $data = json_decode($settings['data'], true);
            $this->settings = $data['hal_integration'] ?? null;
        }
    }

    /**
     * HAL kimlik bilgilerinin ayarlanıp ayarlanmadığını kontrol et
     *
     * NOT: service_password bazı HAL API metodları için gerekli olmayabilir,
     * bu nedenle sadece username ve password zorunlu tutulur.
     * service_password yoksa bazı metodlar çalışmayabilir ama temel bağlantı kurulabilir.
     */
    public function hasCredentials(): bool
    {
        return !empty($this->settings['username'])
            && !empty($this->settings['password']);
    }

    /**
     * Tam kimlik bilgilerinin (service_password dahil) ayarlanıp ayarlanmadığını kontrol et
     */
    public function hasFullCredentials(): bool
    {
        return $this->hasCredentials()
            && !empty($this->settings['service_password']);
    }

    /**
     * PHP SOAP extension'ın yüklü olup olmadığını kontrol et
     */
    public function isSoapAvailable(): bool
    {
        return extension_loaded('soap') && class_exists('SoapClient');
    }

    /**
     * SOAP Client oluştur (PHP SoapClient - WSDL hatası verebilir)
     */
    private function getSoapClient(): ?SoapClient
    {
        if ($this->soapClient !== null) {
            return $this->soapClient;
        }

        if (!$this->hasCredentials()) {
            return null;
        }

        // SOAP extension kontrolü
        if (!$this->isSoapAvailable()) {
            error_log("HAL SOAP Error: PHP SOAP extension is not loaded");
            return null;
        }

        try {
            $this->soapClient = new SoapClient(self::BILDIRIM_SERVICE_URL, [
                'trace' => true,
                'exceptions' => true,
                'connection_timeout' => 30,
                'cache_wsdl' => WSDL_CACHE_NONE,
                'soap_version' => SOAP_1_1,
                'stream_context' => stream_context_create([
                    'ssl' => [
                        'verify_peer' => false,
                        'verify_peer_name' => false,
                        'allow_self_signed' => true
                    ]
                ])
            ]);

            return $this->soapClient;
        } catch (Exception $e) {
            error_log("HAL SOAP Client Error: " . $e->getMessage());
            return null;
        }
    }

    /**
     * cURL ile raw SOAP request gönder
     *
     * HAL'ın WSDL dosyası 63+ duplicate element içeriyor ve PHP SoapClient
     * bu WSDL'i parse edemiyor. Bu metod cURL kullanarak raw SOAP request gönderir.
     *
     * @param string $soapAction SOAPAction header değeri
     * @param string $soapBody SOAP body içeriği (XML)
     * @return array ['success' => bool, 'response' => string|null, 'error' => string|null, 'http_code' => int]
     */
    private function sendCurlSoapRequest(string $soapAction, string $soapBody): array
    {
        $soapEnvelope = '<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="' . self::SOAP_NAMESPACE . '">
    <soap:Body>
        ' . $soapBody . '
    </soap:Body>
</soap:Envelope>';

        $ch = curl_init();

        curl_setopt_array($ch, [
            CURLOPT_URL => self::BILDIRIM_SERVICE_ENDPOINT,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $soapEnvelope,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_HTTPHEADER => [
                'Content-Type: text/xml; charset=utf-8',
                'SOAPAction: "' . $soapAction . '"',
                'Accept: text/xml',
                'Content-Length: ' . strlen($soapEnvelope)
            ]
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            return [
                'success' => false,
                'response' => null,
                'error' => 'cURL hatası: ' . $curlError,
                'http_code' => 0
            ];
        }

        if ($httpCode !== 200) {
            return [
                'success' => false,
                'response' => $response,
                'error' => 'HTTP hatası: ' . $httpCode,
                'http_code' => $httpCode
            ];
        }

        return [
            'success' => true,
            'response' => $response,
            'error' => null,
            'http_code' => $httpCode
        ];
    }

    /**
     * cURL SOAP ile BildirimTurleri sorgula (bağlantı testi için)
     *
     * WSDL xs:sequence sırasına uygun element düzeni:
     * 1. Istek (opsiyonel)
     * 2. Password
     * 3. ServicePassword
     * 4. UserName
     *
     * @return array Test sonucu
     */
    private function testConnectionViaCurl(): array
    {
        $startTime = microtime(true);

        // WSDL xs:sequence sırasına uygun: Istek, Password, ServicePassword, UserName
        // Istek elemanı DataContract namespace'inde boş complexType olmalı
        $dcNs = 'http://schemas.datacontract.org/2004/07/GTB.HKS.Bildirim.ServiceContract';
        $soapBody = '<web:BaseRequestMessageOf_BildirimTurleriIstek>
            <web:Istek xmlns:a="' . $dcNs . '" />
            <web:Password>' . $this->settings['password'] . '</web:Password>
            <web:ServicePassword>' . ($this->settings['service_password'] ?? '') . '</web:ServicePassword>
            <web:UserName>' . $this->settings['username'] . '</web:UserName>
        </web:BaseRequestMessageOf_BildirimTurleriIstek>';

        $result = $this->sendCurlSoapRequest(self::SOAP_ACTION_BILDIRIM_TURLERI, $soapBody);
        $responseTime = round((microtime(true) - $startTime) * 1000);

        if (!$result['success']) {
            return [
                'success' => false,
                'error_code' => 'SOAP_CONNECTION_FAILED',
                'error_detail' => $result['error'],
                'configured' => true,
                'response_time' => $responseTime,
                'debug' => [
                    'http_code' => $result['http_code'],
                    'method' => 'curl_soap'
                ]
            ];
        }

        // XML yanıtını parse et
        $response = $result['response'];

        // HataKodu kontrolü
        if (preg_match('/<[^:]*:?HataKodu>([^<]+)</', $response, $errorMatch)) {
            $errorCode = $errorMatch[1];

            // 0 = başarılı
            if ($errorCode === '0') {
                return [
                    'success' => true,
                    'configured' => true,
                    'response_time' => $responseTime,
                    'has_service_password' => !empty($this->settings['service_password']),
                    'debug' => [
                        'method' => 'curl_soap',
                        'hal_error_code' => $errorCode
                    ]
                ];
            }

            // Hata mesajını al
            $errorMessage = '';
            if (preg_match('/<[^:]*:?Mesaj>([^<]+)</', $response, $msgMatch)) {
                $errorMessage = $msgMatch[1];
            }

            // HAL hata koduna göre spesifik error_code döndür
            // HAL Hata Kodları (GTB Hal Kayıt Sistemi Servis Geliştirici Kılavuzu):
            //
            // Integer Kodlar (Response HataKodu alanı):
            // 0  = İşlem başarılı
            // 1  = Genel hata / İşlem başarısız
            // 11 = Kullanıcı bilgileri yanlış (bazı servislerde)
            // 12 = Web servis şifresi (ServicePassword) yanlış veya eksik
            // 13 = Kimlik doğrulama hatası (kullanıcı adı/şifre yanlış)
            //
            // String Kodlar (Response içinde İşlemKodu):
            // GTBWSRV0000001 = İşlem başarılı
            // GTBWSRV0000002 = İşlem başarısız
            // GTBGLB00000001 = Beklenmeyen hata oluştu
            // GTBGLB00000011 = Kullanıcı bilgileri yanlış
            // GTBGLB00000012 = Web servis şifresi yanlış
            //
            $frontendErrorCode = match($errorCode) {
                '0' => null, // Başarılı, hata yok
                '1', 'GTBWSRV0000002' => 'HAL_ERROR_1',
                '11', 'GTBGLB00000011' => 'HAL_ERROR_11',
                '12', 'GTBGLB00000012' => 'HAL_ERROR_12',
                '13' => 'HAL_ERROR_13',
                'GTBGLB00000001' => 'HAL_ERROR_UNEXPECTED',
                default => 'HAL_ERROR_GENERIC'
            };

            return [
                'success' => false,
                'error_code' => $frontendErrorCode,
                'error_detail' => $errorMessage ?: "Kod: {$errorCode}",
                'hal_error_code' => $errorCode,
                'configured' => true,
                'response_time' => $responseTime,
                'debug' => [
                    'method' => 'curl_soap',
                    'hal_error_code' => $errorCode,
                    'hal_message' => $errorMessage
                ]
            ];
        }

        // Beklenmeyen yanıt formatı
        return [
            'success' => false,
            'error_code' => 'UNEXPECTED_RESPONSE',
            'error_detail' => 'HAL yanıtı parse edilemedi',
            'configured' => true,
            'response_time' => $responseTime,
            'debug' => [
                'method' => 'curl_soap',
                'response_preview' => substr($response, 0, 500)
            ]
        ];
    }

    /**
     * cURL SOAP ile künye sorgula
     *
     * @param string $kunyeNo Künye numarası
     * @return array Sorgu sonucu
     */
    private function queryViaCurlSoap(string $kunyeNo): array
    {
        // WSDL xs:sequence sırasına uygun: Istek (Data), Password, ServicePassword, UserName
        // WSDL wrapper element: BaseRequestMessageOf_ReferansKunyeIstek (TEKİL - çoğul DEĞİL!)
        // İç elemanlar DataContract namespace kullanır (web: DEĞİL, a: prefix)
        // HAL kuralı: BitisTarihi, BaslangicTarihi'nden en fazla 1 ay büyük olabilir
        $dcNs = 'http://schemas.datacontract.org/2004/07/GTB.HKS.Bildirim.ServiceContract';

        // Tarih aralığı: Son 30 gün (HAL max 1 ay izin veriyor)
        $endDate = date('Y-m-d\TH:i:s');
        $startDate = date('Y-m-d\TH:i:s', strtotime('-30 days'));

        // MalinSahibiTcKimlikVergiNo: tc_vergi_no yoksa username (vergi no) kullan
        $vergiNo = $this->settings['tc_vergi_no'] ?? $this->settings['username'] ?? '';
        $sifatId = isset($this->settings['sifat_id']) ? (int)$this->settings['sifat_id'] : 0;

        $soapBody = '<web:BaseRequestMessageOf_ReferansKunyeIstek>
            <web:Istek xmlns:a="' . $dcNs . '">
                <a:BaslangicTarihi>' . $startDate . '</a:BaslangicTarihi>
                <a:BitisTarihi>' . $endDate . '</a:BitisTarihi>
                <a:KalanMiktariSifirdanBuyukOlanlar>true</a:KalanMiktariSifirdanBuyukOlanlar>
                <a:KisiSifat>' . $sifatId . '</a:KisiSifat>
                <a:KunyeNo>' . $kunyeNo . '</a:KunyeNo>
                <a:MalinSahibiTcKimlikVergiNo>' . $vergiNo . '</a:MalinSahibiTcKimlikVergiNo>
                <a:UrunId>0</a:UrunId>
            </web:Istek>
            <web:Password>' . $this->settings['password'] . '</web:Password>
            <web:ServicePassword>' . ($this->settings['service_password'] ?? '') . '</web:ServicePassword>
            <web:UserName>' . $this->settings['username'] . '</web:UserName>
        </web:BaseRequestMessageOf_ReferansKunyeIstek>';

        $result = $this->sendCurlSoapRequest(self::SOAP_ACTION_REFERANS_KUNYELER, $soapBody);

        if (!$result['success']) {
            return [
                'success' => false,
                'error' => $result['error'],
                'method' => 'curl_soap'
            ];
        }

        $response = $result['response'];

        // HataKodu kontrolü
        if (preg_match('/<[^:]*:?HataKodu>([^<]+)</', $response, $errorMatch)) {
            $errorCode = $errorMatch[1];

            if ($errorCode !== '0') {
                $errorMessage = '';
                if (preg_match('/<[^:]*:?Mesaj>([^<]+)</', $response, $msgMatch)) {
                    $errorMessage = $msgMatch[1];
                }

                // HataKodu 3: Kayıt bulunamadı veya yetki yok
                if ($errorCode === '3') {
                    return [
                        'success' => false,
                        'error' => 'Künye bulunamadı. Bu künye numarası vergi numaranıza ait olmayabilir veya belirtilen tarih aralığında kayıt yok.',
                        'error_code' => 3,
                        'method' => 'curl_soap'
                    ];
                }

                return [
                    'success' => false,
                    'error' => "HAL Hatası ({$errorCode}): " . ($errorMessage ?: 'Bilinmeyen hata'),
                    'error_code' => (int)$errorCode,
                    'method' => 'curl_soap'
                ];
            }
        }

        // Künye verilerini parse et
        $kunyeData = $this->parseKunyeXmlResponse($response);

        if (empty($kunyeData)) {
            return [
                'success' => false,
                'error' => 'Künye bulunamadı',
                'method' => 'curl_soap'
            ];
        }

        return [
            'success' => true,
            'method' => 'curl_soap',
            'data' => $kunyeData
        ];
    }

    /**
     * XML künye yanıtını parse et
     *
     * @param string $xmlResponse HAL XML yanıtı
     * @return array|null Parse edilmiş künye verisi
     */
    private function parseKunyeXmlResponse(string $xmlResponse): ?array
    {
        // ReferansKunyeDTO elementlerini bul
        if (!preg_match('/<[^:]*:?ReferansKunyeDTO[^>]*>(.*?)<\/[^:]*:?ReferansKunyeDTO>/s', $xmlResponse, $kunyeMatch)) {
            return null;
        }

        $kunyeXml = $kunyeMatch[1];

        // XML değerlerini extract et
        $extractValue = function($xml, $tagName) {
            if (preg_match('/<[^:]*:?' . $tagName . '[^>]*>([^<]*)</', $xml, $match)) {
                return html_entity_decode($match[1], ENT_QUOTES | ENT_XML1, 'UTF-8');
            }
            return null;
        };

        return [
            // DB şemasıyla uyumlu alan adları (product_hal_data tablosu)
            'kunye_no' => $extractValue($kunyeXml, 'KunyeNo'),
            'malin_adi' => $extractValue($kunyeXml, 'MalinAdi'),
            'malin_cinsi' => $extractValue($kunyeXml, 'MalinCinsi'),
            'malin_turu' => $extractValue($kunyeXml, 'MalinTuru'),
            'miktar' => $extractValue($kunyeXml, 'MalinMiktari'),
            'kalan_miktar' => $extractValue($kunyeXml, 'KalanMiktar'),
            'birim' => $extractValue($kunyeXml, 'MiktarBirimiAd'),
            'birim_id' => $extractValue($kunyeXml, 'MiktarBirimId'),
            'ilk_bildirim_tarihi' => $extractValue($kunyeXml, 'BildirimTarihi'),
            'bildirim_turu' => $extractValue($kunyeXml, 'BildirimTuru'),
            'uretici_tc_vergi_no' => $extractValue($kunyeXml, 'UreticiTcKimlikVergiNo'),
            'malin_sahibi_tc_vergi_no' => $extractValue($kunyeXml, 'MalinSahibiTcKimlikVergiNo'),
            'bildirimci_tc_vergi_no' => $extractValue($kunyeXml, 'BildirimciTcKimlikVergiNo'),
            'arac_plaka_no' => $extractValue($kunyeXml, 'AracPlakaNo'),
            'belge_no' => $extractValue($kunyeXml, 'BelgeNo'),
            'belge_tipi' => $extractValue($kunyeXml, 'BelgeTipi'),
            'malin_cins_kod_no' => $extractValue($kunyeXml, 'MalinCinsKodNo'),
            'malin_kod_no' => $extractValue($kunyeXml, 'MalinKodNo'),
            'malin_turu_kod_no' => $extractValue($kunyeXml, 'MalinTuruKodNo'),
            'gidecek_isyeri_id' => $extractValue($kunyeXml, 'GidecekIsyeriId'),
            'gidecek_yer_turu_id' => $extractValue($kunyeXml, 'GidecekYerTuruId'),
            'analiz_status' => $extractValue($kunyeXml, 'AnalizStatus'),

            // Geriye uyumluluk (scraper alan adları - frontend fallback için)
            'urun_adi' => $extractValue($kunyeXml, 'MalinAdi'),
            'urun_cinsi' => $extractValue($kunyeXml, 'MalinCinsi'),
            'urun_turu' => $extractValue($kunyeXml, 'MalinTuru'),
            'bildirim_tarihi' => $extractValue($kunyeXml, 'BildirimTarihi'),

            // Ham XML verisi
            'hal_raw_data' => $kunyeXml
        ];
    }

    /**
     * Künye numarası ile ürün bilgisi sorgula (SOAP API)
     *
     * @param string $kunyeNo Künye numarası (19 haneli)
     * @return array Sorgu sonucu
     */
    public function queryByKunyeNo(string $kunyeNo): array
    {
        // Künye numarasını temizle ve doğrula
        $kunyeNo = preg_replace('/[^0-9]/', '', $kunyeNo);

        if (strlen($kunyeNo) !== 19) {
            return [
                'success' => false,
                'error' => 'Künye numarası 19 haneli olmalıdır',
                'kunye_no' => $kunyeNo
            ];
        }

        // Önce SOAP API'yi dene
        if ($this->hasCredentials()) {
            $result = $this->queryViaSoapApi($kunyeNo);
            if ($result['success']) {
                return $result;
            }
        }

        // SOAP başarısızsa veya credentials yoksa, web scraping dene
        return $this->queryViaWebScraping($kunyeNo);
    }

    /**
     * SOAP API üzerinden künye sorgula
     *
     * NOT: HAL WSDL hatası nedeniyle önce cURL SOAP kullanılır,
     * başarısız olursa PHP SoapClient'a fallback yapılır.
     */
    private function queryViaSoapApi(string $kunyeNo): array
    {
        // ÖNCELİKLİ: cURL SOAP ile dene
        if ($this->preferCurlSoap) {
            $curlResult = $this->queryViaCurlSoap($kunyeNo);

            // cURL başarılı olduysa veya anlamlı hata verdiyse döndür
            if ($curlResult['success'] || !in_array($curlResult['error'] ?? '', ['cURL hatası', 'HTTP hatası'])) {
                return $curlResult;
            }

            // cURL bağlantı hatası verdiyse PHP SoapClient'a fallback yap
            error_log("HAL cURL SOAP query failed, trying PHP SoapClient");
        }

        // FALLBACK: PHP SoapClient
        $client = $this->getSoapClient();

        if (!$client) {
            return [
                'success' => false,
                'error' => 'SOAP bağlantısı kurulamadı (HAL WSDL hatası)',
                'method' => 'soap'
            ];
        }

        try {
            // BildirimServisReferansKunyeler metodunu çağır
            $params = [
                'UserName' => $this->settings['username'],
                'Password' => $this->settings['password'],
                'ServicePassword' => $this->settings['service_password'] ?? '',
                'KunyeNo' => (int) $kunyeNo,
                'MalinSahibiTcKimlikVergiNo' => $this->settings['tc_vergi_no'] ?? '',
                'BaslangicTarihi' => null,
                'BitisTarihi' => null,
                'KalanMiktariSifirdanBuyukOlanlar' => false,
                'KisiSifat' => 0,
                'UrunId' => 0
            ];

            $response = $client->BildirimServisReferansKunyeler($params);

            // Response'u parse et
            if (isset($response->BildirimServisReferansKunyelerResult)) {
                $result = $response->BildirimServisReferansKunyelerResult;

                // Hata kontrolü
                if (isset($result->Hata) && $result->Hata) {
                    return [
                        'success' => false,
                        'error' => $result->HataMesaji ?? 'Bilinmeyen hata',
                        'method' => 'php_soap'
                    ];
                }

                // Başarılı sonuç
                $kunyeData = $result->ReferansKunyeDTO ?? null;

                if ($kunyeData) {
                    return [
                        'success' => true,
                        'method' => 'php_soap',
                        'data' => $this->formatKunyeData($kunyeData)
                    ];
                }
            }

            return [
                'success' => false,
                'error' => 'Künye bulunamadı',
                'method' => 'php_soap'
            ];

        } catch (SoapFault $e) {
            error_log("HAL SOAP Fault: " . $e->getMessage());
            return [
                'success' => false,
                'error' => 'SOAP hatası: ' . $e->getMessage(),
                'method' => 'php_soap'
            ];
        } catch (Exception $e) {
            error_log("HAL Query Error: " . $e->getMessage());
            return [
                'success' => false,
                'error' => 'Sorgu hatası: ' . $e->getMessage(),
                'method' => 'php_soap'
            ];
        }
    }

    /**
     * Web scraping ile künye sorgula (public sayfa)
     *
     * NOT: Bu yöntem hal.gov.tr'nin yapısına bağlıdır ve
     * site güncellendiğinde çalışmayabilir.
     */
    private function queryViaWebScraping(string $kunyeNo): array
    {
        try {
            // İlk olarak sayfayı çek ve __REQUESTDIGEST token'ı al
            $ch = curl_init();

            curl_setopt_array($ch, [
                CURLOPT_URL => self::KUNYE_QUERY_URL,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => false,
                CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                CURLOPT_TIMEOUT => 30,
                CURLOPT_COOKIEJAR => sys_get_temp_dir() . '/hal_cookies.txt',
                CURLOPT_COOKIEFILE => sys_get_temp_dir() . '/hal_cookies.txt'
            ]);

            $html = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

            if ($httpCode !== 200) {
                curl_close($ch);
                return [
                    'success' => false,
                    'error' => 'Sayfa erişilemedi (HTTP ' . $httpCode . ')',
                    'method' => 'scraping'
                ];
            }

            // __REQUESTDIGEST token'ı bul
            preg_match('/"FormDigestValue":"([^"]+)"/', $html, $digestMatch);
            $requestDigest = $digestMatch[1] ?? null;

            // Künye arama input field'ını bul ve formu gönder
            // SharePoint search mekanizmasını kullan

            // NOT: hal.gov.tr SharePoint tabanlı ve oturum gerektiriyor
            // Public erişim sınırlı olduğundan bu yöntem tam çalışmayabilir

            curl_close($ch);

            return [
                'success' => false,
                'error' => 'Web scraping şu anda desteklenmiyor. HAL kullanıcı bilgilerini ayarlara ekleyin.',
                'method' => 'scraping',
                'hint' => 'Ayarlar > Entegrasyonlar > HAL Kayıt Sistemi bölümünden kimlik bilgilerinizi girin.'
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => 'Web scraping hatası: ' . $e->getMessage(),
                'method' => 'scraping'
            ];
        }
    }

    /**
     * Künye verisini standart formata dönüştür
     */
    private function formatKunyeData($kunyeData): array
    {
        // Nesne ise array'e çevir
        if (is_object($kunyeData)) {
            $kunyeData = json_decode(json_encode($kunyeData), true);
        }

        return [
            'kunye_no' => $kunyeData['KunyeNo'] ?? '',
            'urun_adi' => $kunyeData['MalinAdi'] ?? '',
            'urun_cinsi' => $kunyeData['MalinCinsi'] ?? '',
            'urun_turu' => $kunyeData['MalinTuru'] ?? '',
            'miktar' => $kunyeData['MalinMiktari'] ?? 0,
            'kalan_miktar' => $kunyeData['KalanMiktar'] ?? 0,
            'birim' => $kunyeData['MiktarBirimiAd'] ?? '',
            'uretici' => $kunyeData['MalinSahibi'] ?? '',
            'bildirimci' => $kunyeData['Bildirimci'] ?? '',
            'bildirim_tarihi' => $kunyeData['BildirimTarihi'] ?? '',
            'raw_data' => $kunyeData
        ];
    }

    /**
     * Toplu künye sorgula
     *
     * @param array $kunyeNumbers Künye numaraları dizisi
     * @return array Sorgu sonuçları
     */
    public function queryMultiple(array $kunyeNumbers): array
    {
        $results = [];

        foreach ($kunyeNumbers as $kunyeNo) {
            $results[$kunyeNo] = $this->queryByKunyeNo($kunyeNo);

            // Rate limiting - her istek arasında 500ms bekle
            usleep(500000);
        }

        return $results;
    }

    /**
     * HAL bağlantısını test et
     *
     * Hata kodları (i18n için):
     * - SETTINGS_NOT_CONFIGURED: Ayarlar yapılandırılmamış
     * - MISSING_CREDENTIALS: Kullanıcı adı veya şifre eksik
     * - SOAP_NOT_AVAILABLE: PHP SOAP extension yüklü değil
     * - SOAP_CONNECTION_FAILED: SOAP bağlantısı kurulamadı
     * - AUTH_ERROR: HAL kimlik doğrulama hatası
     * - UNEXPECTED_RESPONSE: Beklenmeyen yanıt
     * - SOAP_FAULT: SOAP protokol hatası
     * - CONNECTION_ERROR: Genel bağlantı hatası
     *
     * NOT: HAL'ın WSDL dosyası 63+ duplicate element içeriyor ve PHP SoapClient
     * bu WSDL'i parse edemiyor. Bu nedenle öncelikle cURL ile raw SOAP request
     * gönderiyoruz, başarısız olursa PHP SoapClient'a fallback yapıyoruz.
     */
    public function testConnection(): array
    {
        // Ayarlar yüklü mü kontrol et
        if (empty($this->settings)) {
            return [
                'success' => false,
                'error_code' => 'SETTINGS_NOT_CONFIGURED',
                'configured' => false,
                'debug' => [
                    'settings_loaded' => false
                ]
            ];
        }

        // Kullanıcı adı ve şifre kontrol et
        if (!$this->hasCredentials()) {
            return [
                'success' => false,
                'error_code' => 'MISSING_CREDENTIALS',
                'configured' => false,
                'debug' => [
                    'has_username' => !empty($this->settings['username']),
                    'has_password' => !empty($this->settings['password']),
                    'has_service_password' => !empty($this->settings['service_password'])
                ]
            ];
        }

        // Servis şifresi kontrolü (opsiyonel ama uyarı ver)
        $hasServicePassword = !empty($this->settings['service_password']);

        // ÖNCELİKLİ: cURL SOAP ile test et (HAL WSDL hatası nedeniyle)
        if ($this->preferCurlSoap) {
            $curlResult = $this->testConnectionViaCurl();

            // cURL başarılı olduysa veya HAL'dan anlamlı bir hata aldıysak sonucu döndür
            // HAL hata kodları: HAL_ERROR_1, HAL_ERROR_11, HAL_ERROR_13, HAL_ERROR_UNEXPECTED, HAL_ERROR_GENERIC
            // Bu durumda bağlantı kurulmuş demektir, sadece kimlik/yetki hatası var
            $halErrorCodes = ['HAL_ERROR_1', 'HAL_ERROR_11', 'HAL_ERROR_13', 'HAL_ERROR_UNEXPECTED', 'HAL_ERROR_GENERIC', 'AUTH_ERROR'];
            if ($curlResult['success'] || in_array($curlResult['error_code'] ?? '', $halErrorCodes)) {
                return $curlResult;
            }

            // cURL bağlantı hatası verdiyse PHP SoapClient'a fallback yap
            error_log("HAL cURL SOAP failed, trying PHP SoapClient: " . ($curlResult['error_detail'] ?? 'unknown error'));
        }

        // FALLBACK: PHP SoapClient ile dene
        // SOAP extension kontrolü
        if (!$this->isSoapAvailable()) {
            return [
                'success' => false,
                'error_code' => 'SOAP_NOT_AVAILABLE',
                'configured' => true,
                'debug' => [
                    'soap_extension_loaded' => extension_loaded('soap'),
                    'soap_class_exists' => class_exists('SoapClient')
                ]
            ];
        }

        try {
            $client = $this->getSoapClient();

            if (!$client) {
                return [
                    'success' => false,
                    'error_code' => 'SOAP_CONNECTION_FAILED',
                    'error_detail' => 'HAL WSDL parse edilemedi (duplicate element hatası). cURL SOAP da başarısız oldu.',
                    'configured' => true,
                    'debug' => [
                        'soap_client_created' => false,
                        'note' => 'HAL WSDL contains 63+ duplicate elements causing parse error'
                    ]
                ];
            }

            // Basit bir sorgu ile bağlantıyı test et
            $params = [
                'UserName' => $this->settings['username'],
                'Password' => $this->settings['password'],
                'ServicePassword' => $this->settings['service_password'] ?? ''
            ];

            // BildirimTurleri gibi basit bir metod çağır
            $response = $client->BildirimServisBildirimTurleri($params);

            if (isset($response->BildirimServisBildirimTurleriResult)) {
                $result = $response->BildirimServisBildirimTurleriResult;

                if (isset($result->Hata) && $result->Hata) {
                    return [
                        'success' => false,
                        'error_code' => 'AUTH_ERROR',
                        'error_detail' => $result->HataMesaji ?? null,
                        'configured' => true,
                        'debug' => [
                            'method' => 'php_soap',
                            'hal_error' => true,
                            'has_service_password' => $hasServicePassword
                        ]
                    ];
                }

                return [
                    'success' => true,
                    'configured' => true,
                    'has_service_password' => $hasServicePassword,
                    'debug' => [
                        'method' => 'php_soap'
                    ]
                ];
            }

            return [
                'success' => false,
                'error_code' => 'UNEXPECTED_RESPONSE',
                'configured' => true,
                'debug' => [
                    'method' => 'php_soap'
                ]
            ];

        } catch (SoapFault $e) {
            // WSDL parse hatası kontrolü
            $isWsdlError = stripos($e->getMessage(), 'WSDL') !== false
                || stripos($e->getMessage(), 'already defined') !== false
                || stripos($e->getMessage(), 'Parsing Schema') !== false;

            return [
                'success' => false,
                'error_code' => $isWsdlError ? 'SOAP_CONNECTION_FAILED' : 'SOAP_FAULT',
                'error_detail' => $isWsdlError
                    ? 'HAL WSDL dosyası hatalı (duplicate element). Lütfen HAL sistem yöneticisiyle iletişime geçin.'
                    : $e->getMessage(),
                'configured' => true,
                'debug' => [
                    'method' => 'php_soap',
                    'exception_type' => 'SoapFault',
                    'fault_code' => $e->faultcode ?? null,
                    'is_wsdl_error' => $isWsdlError
                ]
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'error_code' => 'CONNECTION_ERROR',
                'error_detail' => $e->getMessage(),
                'configured' => true,
                'debug' => [
                    'method' => 'php_soap',
                    'exception_type' => get_class($e)
                ]
            ];
        }
    }

    /**
     * Ürün tablosundaki künye numaralarını güncelle
     *
     * @param string $productId Ürün ID
     * @param string $kunyeNo Künye numarası
     * @return array Güncelleme sonucu
     */
    public function updateProductWithKunyeData(string $productId, string $kunyeNo): array
    {
        // Künye sorgula
        $kunyeResult = $this->queryByKunyeNo($kunyeNo);

        if (!$kunyeResult['success']) {
            return $kunyeResult;
        }

        $kunyeData = $kunyeResult['data'];

        // Ürünü güncelle
        try {
            $updateData = [
                'kunye_no' => $kunyeNo,
                'origin' => $kunyeData['uretici'] ?? null,
                'hal_urun_adi' => $kunyeData['urun_adi'] ?? null,
                'hal_urun_cinsi' => $kunyeData['urun_cinsi'] ?? null,
                'hal_data' => json_encode($kunyeData),
                'hal_sync_at' => date('Y-m-d H:i:s')
            ];

            $this->db->update('products', $updateData, 'id = ?', [$productId]);

            return [
                'success' => true,
                'message' => 'Ürün HAL verileriyle güncellendi',
                'data' => $kunyeData
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => 'Veritabanı güncellemesi başarısız: ' . $e->getMessage()
            ];
        }
    }
}
