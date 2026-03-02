<?php
/**
 * Hanshow ESL Tarama/Keşif
 *
 * GET /api/hanshow/scan - ESL-Working'den bağlı ESL'leri al ve veritabanı ile karşılaştır
 *
 * Response:
 * {
 *   "discovered": [...],      // ESL-Working'de bulunan tüm ESL'ler
 *   "new_devices": [...],     // Veritabanında kayıtlı olmayan ESL'ler
 *   "registered": [...],      // Zaten kayıtlı olan ESL'ler
 *   "online_count": 5,
 *   "offline_count": 2,
 *   "new_count": 3
 * }
 */

require_once __DIR__ . '/../../services/HanshowGateway.php';

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    Response::methodNotAllowed('Izin verilmeyen method');
}

$db = Database::getInstance();
$gateway = new HanshowGateway();

try {
    // 1. ESL-Working'den ESL listesini al
    $eslResult = $gateway->getESLs(1, 1000); // Max 1000 ESL

    // Check for error
    $isSuccess = (isset($eslResult['errno']) && $eslResult['errno'] === 0) ||
                 (isset($eslResult['status_no']) && $eslResult['status_no'] === 0);

    if (!$isSuccess) {
        // Fallback: Try via /aps endpoint to get ESLs per AP
        $apResult = $gateway->getAPs();
        $apSuccess = (isset($apResult['errno']) && $apResult['errno'] === 0) ||
                     (isset($apResult['status_no']) && $apResult['status_no'] === 0);

        if (!$apSuccess) {
            Response::error('ESL-Working bağlantısı başarısız: ' . ($eslResult['errmsg'] ?? 'Bilinmeyen hata'), 503);
        }

        // Extract ESLs from AP data if available
        $discoveredEsls = extractEslsFromAps($apResult);
    } else {
        // Parse ESL list from response
        $discoveredEsls = parseEslList($eslResult);
    }

    // 2. Veritabanından kayıtlı ESL'leri al (hanshow_esls + devices tabloları)
    $registeredMap = [];

    // hanshow_esls tablosu
    $hanshowEsls = $db->fetchAll(
        "SELECT esl_id, id, model_name, status FROM hanshow_esls WHERE company_id = ?",
        [$user['company_id']]
    );
    foreach ($hanshowEsls as $esl) {
        $registeredMap[$esl['esl_id']] = $esl;
    }

    // devices tablosu (device_id = esl_id formatında kaydedilenler)
    $deviceEsls = $db->fetchAll(
        "SELECT device_id as esl_id, id, model_name, status FROM devices WHERE company_id = ? AND device_id IS NOT NULL AND device_id != ''",
        [$user['company_id']]
    );
    foreach ($deviceEsls as $esl) {
        // Sadece ESL ID formatına uyanları ekle (XX-XX-XX-XX)
        if (preg_match('/^[0-9A-Fa-f]{2}(-[0-9A-Fa-f]{2}){3}$/', $esl['esl_id']) && !isset($registeredMap[$esl['esl_id']])) {
            $registeredMap[$esl['esl_id']] = $esl;
        }
    }

    // 3. Firmware bilgilerini al (cihaz özellikleri için)
    $firmwareResult = $gateway->getFirmwares();
    $firmwareMap = [];
    // v2.5.3 format: firmwares objesi (ID key'leri ile)
    if (isset($firmwareResult['firmwares']) && is_array($firmwareResult['firmwares'])) {
        foreach ($firmwareResult['firmwares'] as $id => $fw) {
            $firmwareMap[$id] = $fw;
        }
    }
    // Alternative format: data array
    elseif (isset($firmwareResult['data']) && is_array($firmwareResult['data'])) {
        foreach ($firmwareResult['data'] as $fw) {
            $firmwareMap[$fw['id']] = $fw;
        }
    }

    // 4. Sonuçları kategorize et
    $newDevices = [];
    $registered = [];
    $onlineCount = 0;
    $offlineCount = 0;
    $enrichedEsls = [];

    foreach ($discoveredEsls as $esl) {
        $eslId = $esl['esl_id'] ?? $esl['id'] ?? '';
        if (empty($eslId)) continue;

        // Online/offline sayısı
        if (!empty($esl['online'])) {
            $onlineCount++;
        } else {
            $offlineCount++;
        }

        // Firmware bilgisinden ekran boyutlarını al
        $firmware = null;
        $fwId = $esl['firmware_id'] ?? $esl['firmware'] ?? null;
        // firmwareMap keys may be int or string - try both
        if (!empty($fwId) && (isset($firmwareMap[$fwId]) || isset($firmwareMap[(int)$fwId]))) {
            $firmware = $firmwareMap[$fwId] ?? $firmwareMap[(int)$fwId];
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

        // Kayıtlı mı kontrol et
        if (isset($registeredMap[$eslId])) {
            $esl['is_registered'] = true;
            $esl['db_id'] = $registeredMap[$eslId]['id'];
            $esl['db_status'] = $registeredMap[$eslId]['status'];
            $registered[] = $esl;
        } else {
            $esl['is_registered'] = false;
            $newDevices[] = $esl;
        }

        $enrichedEsls[] = $esl;
    }

    Response::success([
        'discovered' => $enrichedEsls,
        'new_devices' => $newDevices,
        'registered' => $registered,
        'online_count' => $onlineCount,
        'offline_count' => $offlineCount,
        'new_count' => count($newDevices),
        'total_count' => count($discoveredEsls)
    ]);

} catch (Exception $e) {
    Response::error('Tarama hatası: ' . $e->getMessage());
}

/**
 * ESL-Working ESL listesini parse et
 */
function parseEslList($result)
{
    $esls = [];

    // v2.5.3 format - result.esl_list içinde geliyor
    if (isset($result['result']['esl_list']) && is_array($result['result']['esl_list'])) {
        foreach ($result['result']['esl_list'] as $esl) {
            $esls[] = normalizeEslData($esl);
        }
        return $esls;
    }

    // Alternative format: data array
    if (isset($result['data']) && is_array($result['data'])) {
        foreach ($result['data'] as $esl) {
            $esls[] = normalizeEslData($esl);
        }
        return $esls;
    }

    // Alternative format: direct esl_list
    if (isset($result['esl_list']) && is_array($result['esl_list'])) {
        foreach ($result['esl_list'] as $esl) {
            $esls[] = normalizeEslData($esl);
        }
    }

    return $esls;
}

/**
 * AP verilerinden ESL'leri çıkar
 */
function extractEslsFromAps($result)
{
    $esls = [];

    if (isset($result['ap_list'])) {
        foreach ($result['ap_list'] as $generation => $apGroup) {
            foreach ($apGroup as $ap) {
                // Some AP responses include connected ESLs
                if (isset($ap['esls']) && is_array($ap['esls'])) {
                    foreach ($ap['esls'] as $esl) {
                        $esl['ap_mac'] = $ap['mac'] ?? '';
                        $esl['ap_ip'] = $ap['ip'] ?? '';
                        $esls[] = normalizeEslData($esl);
                    }
                }
            }
        }
    }

    return $esls;
}

/**
 * ESL verisini standart formata dönüştür
 *
 * v2.5.3 format örneği:
 * {
 *   "version": 3,
 *   "firmware": 91,
 *   "subnet": 1,
 *   "battery": 3.0,
 *   "rom": 16,
 *   "status": 1,
 *   "esl_id": "50-F5-07-05",
 *   "set_id": "50-41-00-66",
 *   "set_channel": 165,
 *   "group_id": 1,
 *   "group_channel": 165,
 *   "data_channel": 165,
 *   "ap_mac": "DC:07:C1:01:A8:96"
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
