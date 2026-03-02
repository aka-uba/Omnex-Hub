<?php
/**
 * TAMSOFT Debug - StokListesi API yanıtını görüntüle
 * GET - Stok listesi ham yanıtını döndür
 *
 * Bu endpoint debug amaçlıdır, production'da kaldırılmalıdır.
 */

require_once __DIR__ . '/../../config.php';
require_once BASE_PATH . '/core/Database.php';
require_once BASE_PATH . '/core/Response.php';
require_once BASE_PATH . '/core/Auth.php';
require_once BASE_PATH . '/services/TamsoftGateway.php';

$db = Database::getInstance();
$user = Auth::user();

if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

if (($user['role'] ?? '') !== 'SuperAdmin') {
    Response::forbidden('Bu debug endpointine sadece SuperAdmin erisebilir');
}

$companyId = Auth::getActiveCompanyId();

try {
    $gateway = new TamsoftGateway($companyId);

    $depoId = intval($_GET['depoid'] ?? 1);
    $tarih = $_GET['tarih'] ?? '1900-01-01';

    // 1. Ham cURL isteği - API'nin gerçekten ne döndürdüğünü görmek için
    $token = $gateway->getAccessToken();

    $settings = $db->fetch(
        "SELECT * FROM tamsoft_settings WHERE company_id = ?",
        [$companyId]
    );

    $baseUrl = rtrim($settings['api_url'] ?? 'http://tamsoftintegration.camlica.com.tr', '/');

    $params = [
        'tarih' => $tarih,
        'depoid' => $depoId,
        'miktarsifirdanbuyukstoklarlistelensin' => 'False',
        'urununsonbarkodulistelensin' => 'True',
        'sadeceeticaretstoklarigetir' => 'False'
    ];
    $url = $baseUrl . '/api/Integration/StokListesi?' . http_build_query($params);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
            'Accept: application/json'
        ]
    ]);

    $rawResponse = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    $curlInfo = curl_getinfo($ch);
    curl_close($ch);

    // Yanıtı parse et
    $parsed = json_decode($rawResponse, true);
    $jsonError = json_last_error_msg();

    // Çift JSON kontrolü
    $doubleDecoded = null;
    if (is_string($parsed)) {
        $doubleDecoded = json_decode($parsed, true);
    }

    // İlk öğeyi al
    $firstItem = null;
    if (is_array($parsed) && !empty($parsed)) {
        if (array_values($parsed) === $parsed) {
            // Numeric array - direkt ilk elemanı al
            $firstItem = $parsed[0];
        } else {
            // Associative array - wrapper olabilir
            $firstKey = array_key_first($parsed);
            $firstVal = $parsed[$firstKey];
            $firstItem = [
                '_wrapper_key' => $firstKey,
                '_wrapper_value_type' => gettype($firstVal),
                '_wrapper_value_count' => is_array($firstVal) ? count($firstVal) : null,
                '_wrapper_first_item' => is_array($firstVal) && !empty($firstVal)
                    ? (array_values($firstVal) === $firstVal ? $firstVal[0] : array_slice($firstVal, 0, 1, true))
                    : $firstVal
            ];
        }
    }

    // 2. Gateway üzerinden getStokListesi() sonucu
    $gatewayResult = null;
    $gatewayError = null;
    try {
        $stokListesi = $gateway->getStokListesi([
            'tarih' => $tarih,
            'depoid' => $depoId
        ]);
        $gatewayResult = [
            'type' => gettype($stokListesi),
            'is_array' => is_array($stokListesi),
            'count' => is_array($stokListesi) ? count($stokListesi) : null,
            'is_numeric_array' => is_array($stokListesi) && !empty($stokListesi) && array_values($stokListesi) === $stokListesi,
            'first_item' => is_array($stokListesi) && !empty($stokListesi) ? (array_values($stokListesi) === $stokListesi ? $stokListesi[0] : array_slice($stokListesi, 0, 1, true)) : $stokListesi,
            'keys_sample' => is_array($stokListesi) && !empty($stokListesi) ? array_slice(array_keys($stokListesi), 0, 10) : null,
        ];
    } catch (Exception $e) {
        $gatewayError = $e->getMessage();
    }

    // 3. Depo listesi ile karşılaştırma
    $depoResult = null;
    try {
        $depolar = $gateway->getDepolar();
        $depoResult = [
            'type' => gettype($depolar),
            'count' => is_array($depolar) ? count($depolar) : null,
            'first_item' => is_array($depolar) && !empty($depolar) ? $depolar[0] : null,
            'available_depo_ids' => is_array($depolar) ? array_map(function($d) {
                return [
                    'id' => $d['Depoid'] ?? $d['ID'] ?? $d['DepoID'] ?? '?',
                    'name' => $d['Adi'] ?? $d['DepoAdi'] ?? $d['Kod'] ?? '?'
                ];
            }, $depolar) : null
        ];
    } catch (Exception $e) {
        $depoResult = ['error' => $e->getMessage()];
    }

    // 4. Tamsoft settings
    $tamsoftSettings = [
        'api_url' => $settings['api_url'] ?? null,
        'default_depo_id' => $settings['default_depo_id'] ?? null,
        'only_stock_positive' => $settings['only_stock_positive'] ?? null,
        'only_ecommerce' => $settings['only_ecommerce'] ?? null,
        'single_barcode' => $settings['single_barcode'] ?? null,
        'last_sync_date' => $settings['last_sync_date'] ?? null,
    ];

    Response::success([
        'query' => [
            'depoId_requested' => $depoId,
            'tarih' => $tarih,
        ],
        'settings' => $tamsoftSettings,
        'raw_api_response' => [
            'url' => $url,
            'http_code' => $httpCode,
            'curl_error' => $curlError ?: null,
            'content_type' => $curlInfo['content_type'] ?? null,
            'response_length' => strlen($rawResponse),
            'response_first_500' => substr($rawResponse, 0, 500),
            'response_last_200' => strlen($rawResponse) > 500 ? substr($rawResponse, -200) : null,
            'json_parse_success' => $parsed !== null || $rawResponse === 'null',
            'json_error' => $jsonError,
            'parsed_type' => gettype($parsed),
            'parsed_is_array' => is_array($parsed),
            'parsed_count' => is_array($parsed) ? count($parsed) : null,
            'parsed_keys' => is_array($parsed) && !empty($parsed) ? array_slice(array_keys($parsed), 0, 10) : null,
            'is_numeric_array' => is_array($parsed) && !empty($parsed) && array_values($parsed) === $parsed,
            'double_decoded' => $doubleDecoded !== null ? [
                'type' => gettype($doubleDecoded),
                'is_array' => is_array($doubleDecoded),
                'count' => is_array($doubleDecoded) ? count($doubleDecoded) : null
            ] : null,
            'first_item' => $firstItem,
        ],
        'gateway_getStokListesi' => $gatewayResult ?? ['error' => $gatewayError],
        'depo_info' => $depoResult,
    ]);

} catch (Exception $e) {
    Response::error('Debug hatası: ' . $e->getMessage(), 500);
}
