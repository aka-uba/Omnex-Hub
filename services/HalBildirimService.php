<?php
/**
 * HAL Bildirim Listesi Sorgulama Servisi
 *
 * BildirimciyeYapilanBildirimListesi SOAP çağrısı ile
 * tarih aralığı + sıfat bazlı toplu bildirim sorgulama.
 *
 * HalKunyeService.php'deki sendCurlSoapRequest() pattern'ini kullanır.
 *
 * @version 1.0.0
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../core/Database.php';
require_once __DIR__ . '/../core/Auth.php';

class HalBildirimService
{
    private const BILDIRIM_SERVICE_ENDPOINT = 'https://hks.hal.gov.tr/WebServices/BildirimService.svc';
    private const SOAP_NAMESPACE = 'http://www.gtb.gov.tr//WebServices';
    private const SOAP_ACTION_BILDIRIM_LISTESI = 'http://www.gtb.gov.tr//WebServices/IBildirimService/BildirimServisBildirimciyeYapilanBildirimListesi';
    private const DC_NAMESPACE = 'http://schemas.datacontract.org/2004/07/GTB.HKS.Bildirim.ServiceContract';

    private ?array $settings = null;
    private Database $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->loadSettings();
    }

    /**
     * HAL entegrasyon ayarlarını yükle
     * HalKunyeService.php ile aynı pattern (SettingsResolver + eski sistem fallback)
     */
    private function loadSettings(): void
    {
        $companyId = Auth::getActiveCompanyId();

        // 1. YENİ SİSTEM: integration_settings tablosundan oku
        try {
            require_once __DIR__ . '/SettingsResolver.php';
            $resolver = new SettingsResolver();
            $effective = $resolver->getEffectiveSettings('hal', $companyId);

            if (!empty($effective['settings']) && $effective['source'] !== 'none') {
                $this->settings = $effective['settings'];
                return;
            }
        } catch (Exception $e) {
            error_log("HAL BildirimService SettingsResolver error: " . $e->getMessage());
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
     * Kimlik bilgilerinin ayarlanıp ayarlanmadığını kontrol et
     */
    public function hasCredentials(): bool
    {
        return !empty($this->settings['username'])
            && !empty($this->settings['password']);
    }

    /**
     * Ayarlara erişim
     */
    public function getSettings(): ?array
    {
        return $this->settings;
    }

    /**
     * cURL ile raw SOAP request gönder
     * (HalKunyeService.php ile aynı pattern)
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
            CURLOPT_TIMEOUT => 60,
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
     * Bildirimci'ye yapılan bildirim listesini sorgula
     *
     * @param string $startDate Başlangıç tarihi (Y-m-d)
     * @param string $endDate Bitiş tarihi (Y-m-d)
     * @param int $sifatId Sıfat ID (7=Market, 4=Üretici vb.)
     * @param bool $onlyRemaining Sadece kalan miktarı > 0 olanlar
     * @param int $kunyeTuru Künye türü (1 veya 2, varsayılan 1)
     * @return array Sorgu sonucu
     */
    public function fetchBildirimler(
        string $startDate,
        string $endDate,
        int $sifatId = 0,
        bool $onlyRemaining = true,
        int $kunyeTuru = 1
    ): array {
        if (!$this->hasCredentials()) {
            return [
                'success' => false,
                'error' => 'HAL kimlik bilgileri yapılandırılmamış',
                'error_code' => 'NO_CREDENTIALS'
            ];
        }

        // Tarih formatı: Y-m-dTH:i:s
        $startDateTime = $startDate . 'T00:00:00';
        $endDateTime = $endDate . 'T23:59:59';

        $onlyRemainingStr = $onlyRemaining ? 'true' : 'false';

        $soapBody = '<web:BaseRequestMessageOf_BildirimSorguIstek>
            <web:Istek xmlns:a="' . self::DC_NAMESPACE . '">
                <a:BaslangicTarihi>' . htmlspecialchars($startDateTime) . '</a:BaslangicTarihi>
                <a:BitisTarihi>' . htmlspecialchars($endDateTime) . '</a:BitisTarihi>
                <a:KalanMiktariSifirdanBuyukOlanlar>' . $onlyRemainingStr . '</a:KalanMiktariSifirdanBuyukOlanlar>
                <a:KunyeNo>0</a:KunyeNo>
                <a:KunyeTuru>' . $kunyeTuru . '</a:KunyeTuru>
                <a:Sifat>' . $sifatId . '</a:Sifat>
                <a:UniqueId></a:UniqueId>
            </web:Istek>
            <web:Password>' . htmlspecialchars($this->settings['password']) . '</web:Password>
            <web:ServicePassword>' . htmlspecialchars($this->settings['service_password'] ?? '') . '</web:ServicePassword>
            <web:UserName>' . htmlspecialchars($this->settings['username']) . '</web:UserName>
        </web:BaseRequestMessageOf_BildirimSorguIstek>';

        $result = $this->sendCurlSoapRequest(self::SOAP_ACTION_BILDIRIM_LISTESI, $soapBody);

        if (!$result['success']) {
            return [
                'success' => false,
                'error' => $result['error'],
                'error_code' => 'SOAP_ERROR'
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

                return [
                    'success' => false,
                    'error' => $errorMessage ?: "HAL Hatası (Kod: {$errorCode})",
                    'error_code' => 'HAL_ERROR_' . $errorCode,
                    'hal_error_code' => (int)$errorCode
                ];
            }
        }

        // Bildirim listesini parse et
        $bildirimler = $this->parseBildirimlerResponse($response);

        return [
            'success' => true,
            'data' => $bildirimler,
            'total' => count($bildirimler)
        ];
    }

    /**
     * SOAP yanıtından bildirim listesini parse et
     * Çoklu BildirimSorguDTO elementlerini çıkarır
     *
     * @param string $xmlResponse HAL XML yanıtı
     * @return array Parse edilmiş bildirim listesi
     */
    public function parseBildirimlerResponse(string $xmlResponse): array
    {
        $bildirimler = [];

        // Tüm BildirimSorguDTO elementlerini bul
        if (!preg_match_all('/<[^:]*:?BildirimSorguDTO[^>]*>(.*?)<\/[^:]*:?BildirimSorguDTO>/s', $xmlResponse, $matches)) {
            return $bildirimler;
        }

        $extractValue = function($xml, $tagName) {
            if (preg_match('/<[^:]*:?' . $tagName . '[^>]*>([^<]*)</', $xml, $match)) {
                return html_entity_decode($match[1], ENT_QUOTES | ENT_XML1, 'UTF-8');
            }
            return null;
        };

        foreach ($matches[1] as $bildirimXml) {
            $bildirimler[] = [
                'KunyeNo' => $extractValue($bildirimXml, 'KunyeNo'),
                'MalinAdi' => $extractValue($bildirimXml, 'MalinAdi'),
                'MalinCinsi' => $extractValue($bildirimXml, 'MalinCinsi'),
                'MalinTuru' => $extractValue($bildirimXml, 'MalinTuru'),
                'MalinMiktari' => $extractValue($bildirimXml, 'MalinMiktari'),
                'KalanMiktar' => $extractValue($bildirimXml, 'KalanMiktar'),
                'MiktarBirimiAd' => $extractValue($bildirimXml, 'MiktarBirimiAd'),
                'MiktarBirimId' => $extractValue($bildirimXml, 'MiktarBirimId'),
                'BildirimTarihi' => $extractValue($bildirimXml, 'BildirimTarihi'),
                'BelgeNo' => $extractValue($bildirimXml, 'BelgeNo'),
                'BelgeTipi' => $extractValue($bildirimXml, 'BelgeTipi'),
                'AracPlakaNo' => $extractValue($bildirimXml, 'AracPlakaNo'),
                'MalinSahibiTcKimlikVergiNo' => $extractValue($bildirimXml, 'MalinSahibiTcKimlikVergiNo'),
                'UreticiTcKimlikVergiNo' => $extractValue($bildirimXml, 'UreticiTcKimlikVergiNo'),
                'BildirimciTcKimlikVergiNo' => $extractValue($bildirimXml, 'BildirimciTcKimlikVergiNo'),
                'MalinCinsKodNo' => $extractValue($bildirimXml, 'MalinCinsKodNo'),
                'MalinKodNo' => $extractValue($bildirimXml, 'MalinKodNo'),
                'MalinTuruKodNo' => $extractValue($bildirimXml, 'MalinTuruKodNo'),
                'MalinSatisFiyati' => $extractValue($bildirimXml, 'MalinSatisFiyati'),
                'Sifat' => $extractValue($bildirimXml, 'Sifat'),
                'UniqueId' => $extractValue($bildirimXml, 'UniqueId'),
                'GidecekIsyeriId' => $extractValue($bildirimXml, 'GidecekIsyeriId'),
                'GidecekYerTuruId' => $extractValue($bildirimXml, 'GidecekYerTuruId'),
                'AnalizStatus' => $extractValue($bildirimXml, 'AnalizStatus'),
                'RusumMiktari' => $extractValue($bildirimXml, 'RusumMiktari'),
                'BildirimTuru' => $extractValue($bildirimXml, 'BildirimTuru'),
            ];
        }

        return $bildirimler;
    }

    /**
     * Bildirim listesini BelgeNo + AracPlakaNo bazında grupla
     *
     * @param array $bildirimler Bildirim listesi
     * @return array Gruplanmış bildirimler
     */
    public function groupByBelge(array $bildirimler): array
    {
        $grouped = [];

        foreach ($bildirimler as $bildirim) {
            $belgeNo = $bildirim['BelgeNo'] ?? 'Belgesiz';
            $plaka = $bildirim['AracPlakaNo'] ?? '';
            $key = $belgeNo . ($plaka ? ' (' . $plaka . ')' : '');

            if (!isset($grouped[$key])) {
                $grouped[$key] = [
                    'belge_no' => $belgeNo,
                    'plaka' => $plaka,
                    'items' => [],
                    'total_miktar' => 0,
                    'total_kalan' => 0,
                ];
            }

            $grouped[$key]['items'][] = $bildirim;
            $grouped[$key]['total_miktar'] += floatval($bildirim['MalinMiktari'] ?? 0);
            $grouped[$key]['total_kalan'] += floatval($bildirim['KalanMiktar'] ?? 0);
        }

        return $grouped;
    }
}
