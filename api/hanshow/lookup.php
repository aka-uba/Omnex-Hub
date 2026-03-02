<?php
/**
 * Hanshow ESL Lookup by ID/Barcode
 *
 * GET /api/hanshow/lookup?esl_id=XX-XX-XX-XX
 *
 * Barkod/ESL ID ile tek bir ESL cihazının bilgilerini ESL-Working'den sorgular
 *
 * Desteklenen formatlar:
 * - 149A0027 (CODE128 barkod değeri)
 * - 14-9A-00-27 (tireli format)
 * - 149a0027 (küçük harf)
 */

require_once __DIR__ . '/../../services/HanshowGateway.php';

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    Response::methodNotAllowed('İzin verilmeyen method');
}

$eslId = $_GET['esl_id'] ?? '';

if (empty($eslId)) {
    Response::badRequest('ESL ID gerekli');
}

// ESL ID formatını temizle
$searchId = strtoupper(trim($eslId));
// Tireleri kaldır (arama için normalize)
$searchIdNoDash = str_replace('-', '', $searchId);

$db = Database::getInstance();
$gateway = new HanshowGateway();

try {
    $foundEsl = null;

    // Yöntem 1: Önce doğrudan API sorgusu dene (birkaç format)
    $formatsToTry = [
        $searchId,                                           // Orijinal (büyük harf)
        $searchIdNoDash,                                     // Tiresiz
        implode('-', str_split($searchIdNoDash, 2)),        // Tireli: XX-XX-XX-XX
    ];

    foreach ($formatsToTry as $tryId) {
        if (strlen($tryId) < 6) continue;

        $eslResult = $gateway->getESL($tryId);

        $isSuccess = (isset($eslResult['errno']) && $eslResult['errno'] === 0) ||
                     (isset($eslResult['status_no']) && $eslResult['status_no'] === 0);

        if ($isSuccess && !empty($eslResult['data'])) {
            $foundEsl = $eslResult['data'];
            break;
        }
    }

    // Yöntem 2: Bulunamadıysa tüm ESL listesinde ara
    if (!$foundEsl) {
        $eslListResult = $gateway->getESLs(1, 1000);

        $isListSuccess = (isset($eslListResult['errno']) && $eslListResult['errno'] === 0) ||
                         (isset($eslListResult['status_no']) && $eslListResult['status_no'] === 0);

        // v2.5.3 format: result.esl_list
        $eslList = $eslListResult['result']['esl_list'] ?? $eslListResult['data'] ?? [];

        if ($isListSuccess && !empty($eslList)) {
            foreach ($eslList as $esl) {
                $eslIdFromList = $esl['esl_id'] ?? $esl['id'] ?? '';
                $eslIdNormalized = strtoupper(str_replace('-', '', $eslIdFromList));

                // Tam eşleşme veya kısmi eşleşme (barkod son 8 karakter olabilir)
                if ($eslIdNormalized === $searchIdNoDash ||
                    str_ends_with($eslIdNormalized, $searchIdNoDash) ||
                    str_starts_with($eslIdNormalized, $searchIdNoDash)) {
                    $foundEsl = $esl;
                    break;
                }
            }
        }
    }

    if (!$foundEsl) {
        Response::success([
            'found' => false,
            'searched_id' => $searchId,
            'message' => "ESL bulunamadı: {$searchId}"
        ]);
        return;
    }

    // Normalize ESL data
    $esl = normalizeEslData($foundEsl);

    // 2. Firmware bilgilerini al (ekran boyutları için)
    $firmwareResult = $gateway->getFirmwares();
    $firmwareMap = [];
    // v2.5.3 format: firmwares objesi
    if (isset($firmwareResult['firmwares'])) {
        foreach ($firmwareResult['firmwares'] as $id => $fw) {
            $firmwareMap[$id] = $fw;
        }
    } elseif (isset($firmwareResult['data'])) {
        foreach ($firmwareResult['data'] as $fw) {
            $firmwareMap[$fw['id']] = $fw;
        }
    }

    // Firmware bilgisinden ekran boyutlarını al
    $fwId = $esl['firmware_id'] ?? null;
    if (!empty($fwId) && isset($firmwareMap[$fwId])) {
        $firmware = $firmwareMap[$fwId];
        // v2.5.3: resolution_x, resolution_y kullanılıyor
        $esl['screen_width'] = $firmware['resolution_x'] ?? $firmware['width'] ?? 152;
        $esl['screen_height'] = $firmware['resolution_y'] ?? $firmware['height'] ?? 152;
        $esl['screen_color'] = $firmware['screen_color'] ?? $firmware['color'] ?? 'BW';
        $esl['screen_type'] = $firmware['screen_type'] ?? $firmware['type'] ?? 'EPD';
        $esl['model_name'] = $firmware['name'] ?? 'Unknown';
        $esl['has_led'] = !empty($firmware['led']);
        $esl['max_pages'] = $firmware['max_page_num'] ?? $firmware['max_pages'] ?? 1;
        $esl['screen_size'] = $firmware['screen_size'] ?? null;
        $esl['esl_model'] = $firmware['esl_model'] ?? null;
    }

    // 3. Veritabanında kayıtlı mı kontrol et (hanshow_esls + devices tabloları)
    // ESL-Working'den dönen gerçek ESL ID'yi kullan
    $actualEslId = $esl['esl_id'];
    $actualEslIdNoDash = strtoupper(str_replace('-', '', $actualEslId));

    // Önce hanshow_esls tablosunda ara
    $registeredEsl = $db->fetch(
        "SELECT id, esl_id, model_name, status FROM hanshow_esls
         WHERE (UPPER(REPLACE(esl_id, '-', '')) = ? OR esl_id = ? OR esl_id = ?)
         AND company_id = ?",
        [$actualEslIdNoDash, $actualEslId, $searchIdNoDash, $user['company_id']]
    );

    // Bulunamadıysa devices tablosunda da ara
    if (!$registeredEsl) {
        $registeredEsl = $db->fetch(
            "SELECT id, device_id as esl_id, model_name, status FROM devices
             WHERE device_id = ? AND company_id = ?",
            [$actualEslId, $user['company_id']]
        );
    }

    if ($registeredEsl) {
        $esl['is_registered'] = true;
        $esl['db_id'] = $registeredEsl['id'];
        $esl['db_status'] = $registeredEsl['status'];
    } else {
        $esl['is_registered'] = false;
    }

    Response::success([
        'found' => true,
        'esl' => $esl
    ]);

} catch (Exception $e) {
    Response::error('ESL arama hatası: ' . $e->getMessage());
}

/**
 * ESL verisini standart formata dönüştür
 *
 * v2.5.3 format örneği:
 * {
 *   "version": 3, "firmware": 91, "subnet": 1, "battery": 3.0,
 *   "rom": 16, "status": 1, "esl_id": "50-F5-07-05",
 *   "set_id": "50-41-00-66", "ap_mac": "DC:07:C1:01:A8:96"
 * }
 */
function normalizeEslData($esl)
{
    // v2.5.3 status: 1=online, 0=offline (loose comparison for int/string)
    $isOnline = isset($esl['status']) ? ((int)$esl['status'] === 1) : (!empty($esl['online']) || !empty($esl['is_online']));

    // Battery: API returns voltage (e.g. 3.0V, 3.2V). Convert to percentage.
    // CR2450: 3.0V=full(100%), 2.8V=good(70%), 2.6V=medium(40%), 2.4V=low(15%), 2.2V=critical(5%), <2.0V=dead(0%)
    $batteryVoltage = $esl['battery'] ?? $esl['battery_level'] ?? null;
    $batteryPercent = null;
    if ($batteryVoltage !== null && is_numeric($batteryVoltage)) {
        $v = (float)$batteryVoltage;
        if ($v >= 3.0) {
            $batteryPercent = 100;
        } elseif ($v >= 2.8) {
            $batteryPercent = 70 + (($v - 2.8) / 0.2) * 30;
        } elseif ($v >= 2.6) {
            $batteryPercent = 40 + (($v - 2.6) / 0.2) * 30;
        } elseif ($v >= 2.4) {
            $batteryPercent = 15 + (($v - 2.4) / 0.2) * 25;
        } elseif ($v >= 2.0) {
            $batteryPercent = (($v - 2.0) / 0.4) * 15;
        } else {
            $batteryPercent = 0;
        }
        $batteryPercent = (int)round($batteryPercent);
    }

    return [
        'esl_id' => $esl['esl_id'] ?? $esl['id'] ?? '',
        'firmware_id' => $esl['firmware'] ?? $esl['firmware_id'] ?? $esl['type_id'] ?? null,
        'online' => $isOnline,
        'battery' => $batteryPercent,
        'battery_voltage' => $batteryVoltage,
        'rssi' => $esl['rssi'] ?? $esl['signal'] ?? null,
        'temperature' => $esl['temperature'] ?? null,
        'last_update' => $esl['last_update_time'] ?? $esl['update_time'] ?? null,
        'last_heartbeat' => $esl['last_heartbeat_time'] ?? $esl['heartbeat_time'] ?? null,
        'ap_mac' => $esl['ap_mac'] ?? $esl['gateway_mac'] ?? '',
        'ap_ip' => $esl['ap_ip'] ?? '',
        'screen_width' => $esl['width'] ?? 152,
        'screen_height' => $esl['height'] ?? 152,
        'screen_color' => $esl['color'] ?? 'BW',
        'screen_type' => $esl['screen_type'] ?? 'EPD',
        'model_name' => $esl['model'] ?? $esl['name'] ?? 'Unknown',
        'has_led' => !empty($esl['led']) || !empty($esl['has_led']),
        'max_pages' => $esl['max_pages'] ?? 1,
        'version' => $esl['version'] ?? $esl['rom_version'] ?? '',
        'rom' => $esl['rom'] ?? null,
        'subnet' => $esl['subnet'] ?? null,
        'set_id' => $esl['set_id'] ?? null,
        'group_id' => $esl['group_id'] ?? null
    ];
}
