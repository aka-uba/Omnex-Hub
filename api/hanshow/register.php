<?php
/**
 * Hanshow ESL Register/Bind
 *
 * POST /api/hanshow/register
 *
 * Barkod/ESL ID ile ESL cihazını ESL-Working'e kaydeder
 *
 * Request:
 * {
 *   "esl_id": "149A0027",   // Barkod değeri
 *   "ap_mac": "AA:BB:CC:DD:EE:FF"  // Opsiyonel: Hangi AP'ye bağlanacağı
 * }
 */

require_once __DIR__ . '/../../services/HanshowGateway.php';

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    Response::methodNotAllowed('İzin verilmeyen method');
}

$data = $request->body();
$eslId = $data['esl_id'] ?? '';
$apMac = $data['ap_mac'] ?? null;

if (empty($eslId)) {
    Response::badRequest('ESL ID gerekli');
}

// ESL ID formatını temizle
$eslId = strtoupper(trim($eslId));
// Tireleri kaldır ve normalize et
$eslIdNoDash = str_replace('-', '', $eslId);

// 8 karakterse tireli formata çevir (ESL-Working genellikle bu formatı bekler)
if (strlen($eslIdNoDash) === 8) {
    $eslIdFormatted = implode('-', str_split($eslIdNoDash, 2));
} else {
    $eslIdFormatted = $eslId;
}

$db = Database::getInstance();
$gateway = new HanshowGateway();

try {
    // 1. Önce ESL-Working'de zaten kayıtlı mı kontrol et
    $existingEsl = $gateway->getESL($eslIdFormatted);
    $alreadyExists = (isset($existingEsl['errno']) && $existingEsl['errno'] === 0) ||
                     (isset($existingEsl['status_no']) && $existingEsl['status_no'] === 0);

    if ($alreadyExists && !empty($existingEsl['data'])) {
        // Zaten ESL-Working'de kayıtlı
        Response::success([
            'registered' => true,
            'already_existed' => true,
            'esl_id' => $eslIdFormatted,
            'esl' => normalizeEslData($existingEsl['data']),
            'message' => 'ESL zaten ESL-Working\'de kayıtlı'
        ]);
        return;
    }

    // 2. AP yoksa mevcut AP'leri al
    if (!$apMac) {
        $apsResult = $gateway->getAPs();
        if (isset($apsResult['ap_list'])) {
            foreach ($apsResult['ap_list'] as $generation => $apGroup) {
                foreach ($apGroup as $ap) {
                    if (!empty($ap['online'])) {
                        $apMac = $ap['mac'] ?? null;
                        break 2;
                    }
                }
            }
        }
    }

    // 3. ESL'i ESL-Working'e kaydet
    $registerResult = $gateway->registerESL($eslIdFormatted, $apMac);

    $isSuccess = (isset($registerResult['errno']) && $registerResult['errno'] === 0) ||
                 (isset($registerResult['status_no']) && $registerResult['status_no'] === 0);

    if (!$isSuccess) {
        $errorMsg = $registerResult['errmsg'] ?? $registerResult['message'] ?? 'Kayıt başarısız';
        Response::error("ESL kaydedilemedi: {$errorMsg}", 400);
        return;
    }

    // 4. Kayıt sonrası bilgileri al
    $newEslResult = $gateway->getESL($eslIdFormatted);
    $eslData = [];
    if ((isset($newEslResult['errno']) && $newEslResult['errno'] === 0) && !empty($newEslResult['data'])) {
        $eslData = normalizeEslData($newEslResult['data']);
    } else {
        // API'den alınamadıysa basit veri döndür
        $eslData = [
            'esl_id' => $eslIdFormatted,
            'online' => false,
            'battery' => null,
            'rssi' => null
        ];
    }

    Response::success([
        'registered' => true,
        'already_existed' => false,
        'esl_id' => $eslIdFormatted,
        'esl' => $eslData,
        'message' => 'ESL başarıyla ESL-Working\'e kaydedildi'
    ]);

} catch (Exception $e) {
    Response::error('ESL kayıt hatası: ' . $e->getMessage());
}

/**
 * ESL verisini standart formata dönüştür
 */
function normalizeEslData($esl)
{
    // v2.5.3 status: 1=online, 0=offline (loose comparison for int/string)
    $isOnline = isset($esl['status']) ? ((int)$esl['status'] === 1) : (!empty($esl['online']) || !empty($esl['is_online']));

    // Battery: API returns voltage (e.g. 3.0V, 3.2V). Convert to percentage.
    // CR2450: 3.0V=full(100%), 2.8V=good(70%), 2.6V=medium(40%), 2.4V=low(15%), <2.0V=dead(0%)
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
