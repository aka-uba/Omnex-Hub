<?php
/**
 * Device Network Scan API
 *
 * PavoDisplay cihazlar??n?? a??da tarar ve bulur.
 * Gateway varsa gateway ??zerinden, yoksa do??rudan tarar.
 *
 * POST /api/devices/scan
 * Body:
 *   - mode: 'single' | 'range' | 'subnet' | 'fast' | 'gateway'
 *   - gateway_id: Gateway ID (gateway ??zerinden tarama i??in)
 *   - ip: Tek IP tarama i??in
 *   - subnet: Alt a?? (??rn: 192.168.1)
 *   - start_ip: Ba??lang???? IP (varsay??lan: 1)
 *   - end_ip: Biti?? IP (varsay??lan: 254)
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

$mode = $request->input('mode', 'single');
$originalMode = $mode;
$gatewayId = $request->input('gateway_id');
$ip = $request->input('ip');
$subnetInputRaw = trim((string)$request->input('subnet', ''));
$normalizedSubnetInput = normalizeSubnet($subnetInputRaw);
$subnet = $normalizedSubnetInput ?: '192.168.1';
$subnetUsesFallback = ($subnetInputRaw === '' || $subnetInputRaw === '192.168.1' || $normalizedSubnetInput === null);
$startIp = (int)$request->input('start_ip', 1);
$endIp = (int)$request->input('end_ip', 254);

// Multi-subnet ve profil parametreleri
$subnetsInput = $request->input('subnets', []); // ['192.168.1', '192.168.2', ...]
$profiles = $request->input('profiles', ['pavodisplay']); // profil listesi
if (is_string($subnetsInput)) {
    $subnetsInput = array_filter(array_map('trim', explode(',', $subnetsInput)));
}
if (is_string($profiles)) {
    $profiles = array_filter(array_map('trim', explode(',', $profiles)));
}

// Validate
if ($mode === 'single' && !$ip) {
    Response::error('IP adresi gerekli', 400);
}

if ($startIp < 1 || $startIp > 254) $startIp = 1;
if ($endIp < 1 || $endIp > 254) $endIp = 254;
if ($startIp > $endIp) {
    $temp = $startIp;
    $startIp = $endIp;
    $endIp = $temp;
}

$devices = [];
$gatewayHeartbeatTimeoutSeconds = 120;
$shouldRegisterDiscoveredDevices = ($originalMode === 'fast');

// Gateway ayarini kontrol et (varsayilan: acik)
$gatewayEnabled = true;
$companySettings = $db->fetch(
    "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
    [$companyId]
);
if ($companySettings && !empty($companySettings['data'])) {
    $settingsData = json_decode($companySettings['data'], true);
    if (isset($settingsData['gateway_enabled'])) {
        $gatewayEnabled = (bool)$settingsData['gateway_enabled'];
    }
}
if ($user && !empty($user['id'])) {
    $userSettings = $db->fetch(
        "SELECT data FROM settings WHERE user_id = ?",
        [$user['id']]
    );
    if ($userSettings && !empty($userSettings['data'])) {
        $userSettingsData = json_decode($userSettings['data'], true);
        if (isset($userSettingsData['gateway_enabled'])) {
            $gatewayEnabled = (bool)$userSettingsData['gateway_enabled'];
        }
    }
}

try {
    if (!$gatewayEnabled && ($mode === 'gateway' || !empty($gatewayId))) {
        Response::error('Gateway tarama ayari devre disi (gateway_enabled=false)', 400);
    }

    // Cloud ortaminda private subnet taramasi istenirse gateway'e yonlendir
    // NOT: advanced, multi_subnet ve ping_sweep modlari dogrudan PavoDisplayGateway uzerinden calisir,
    // bu modlar gateway agent'a yonlendirilMEMELI (cunku gateway agent tek subnet destekler)
    $directScanModes = ['advanced', 'multi_subnet', 'ping_sweep'];
    if ($mode !== 'gateway' && !in_array($mode, $directScanModes) && $gatewayEnabled) {
        $isPrivateTarget = false;

        if ($mode === 'single' && $ip) {
            $singleSubnet = subnetFromIp($ip);
            if ($singleSubnet !== null) {
                $subnet = $singleSubnet;
                $ipOctets = explode('.', trim((string)$ip));
                $startIp = (int)$ipOctets[3];
                $endIp = (int)$ipOctets[3];
                $subnetUsesFallback = false;
                $isPrivateTarget = isPrivateSubnet($subnet);
            }
        } else {
            $isPrivateTarget = isPrivateSubnet($subnet);
        }

        if ($isPrivateTarget) {
            $gateway = $db->fetch(
                "SELECT * FROM gateways WHERE company_id = ? AND status = 'online' ORDER BY last_heartbeat DESC LIMIT 1",
                [$companyId]
            );
            if ($gateway) {
                $gatewayLastHeartbeat = !empty($gateway['last_heartbeat'])
                    ? strtotime(str_replace('T', ' ', $gateway['last_heartbeat']))
                    : false;
                $gatewayHeartbeatFresh = $gatewayLastHeartbeat
                    && ((time() - $gatewayLastHeartbeat) <= $gatewayHeartbeatTimeoutSeconds);

                // Sadece heartbeat tazeyse otomatik gateway taramaya gec.
                // Aksi halde stale gateway nedeniyle eski cache sonuclari donmesin.
                if (!$gatewayHeartbeatFresh) {
                    $gateway = null;
                }
            }
            if ($gateway) {
                $gatewayId = $gateway['id'];
                $mode = 'gateway';
            }
        }
    }

    // Gateway ??zerinden mi yoksa do??rudan m?? tarama yap??lacak?
    if ($gatewayId || $mode === 'gateway') {
        if (!$gatewayEnabled) {
            Response::error('Gateway tarama ayari devre disi (gateway_enabled=false)', 400);
        }
        // Gateway ??zerinden tarama
        $gateway = null;

        if ($gatewayId) {
            $gateway = $db->fetch(
                "SELECT * FROM gateways WHERE id = ? AND company_id = ?",
                [$gatewayId, $companyId]
            );
        } else {
            // Varsay??lan olarak online bir gateway bul
            $gateway = $db->fetch(
                "SELECT * FROM gateways WHERE company_id = ? AND status = 'online' ORDER BY last_heartbeat DESC LIMIT 1",
                [$companyId]
            );
        }

        if (!$gateway) {
            Response::error('Aktif gateway bulunamadi. Lutfen local gateway agent calistirin.', 404);
        }

        $gatewayLastHeartbeat = !empty($gateway['last_heartbeat'])
            ? strtotime(str_replace('T', ' ', $gateway['last_heartbeat']))
            : false;
        $gatewayHeartbeatFresh = $gatewayLastHeartbeat
            && ((time() - $gatewayLastHeartbeat) <= $gatewayHeartbeatTimeoutSeconds);
        if (!$gatewayHeartbeatFresh) {
            Response::error('Gateway heartbeat eski. Lutfen gateway agenti baslatin veya direct tarama kullanin.', 409);
        }
        $gatewaySubnet = subnetFromIp($gateway['local_ip'] ?? '');
        if ($gatewaySubnet && $subnetUsesFallback) {
            $subnet = $gatewaySubnet;
        }

        $subnet = normalizeSubnet($subnet);
        if ($subnet === null) {
            Response::error('Subnet formati gecersiz', 422);
        }

        // Gateway'e scan_network komutu gonder
        // Multi-subnet destegi: subnets array varsa gateway'e ilet
        $scanParams = [
            'subnet' => $subnet,
            'start_ip' => $startIp,
            'end_ip' => $endIp,
            // UI'de sync scan akisini hizlandirmak icin sadece fast modda register et.
            // Range/single scan'de kullanici zaten "cihaz ekle" adimini manuel tamamliyor.
            'register' => $shouldRegisterDiscoveredDevices
        ];
        if (!empty($subnetsInput) && is_array($subnetsInput)) {
            $scanParams['subnets'] = $subnetsInput;
        }
        $commandId = $db->generateUuid();
        $db->insert('gateway_commands', [
            'id' => $commandId,
            'gateway_id' => $gateway['id'],
            'command' => 'scan_network',
            'parameters' => json_encode($scanParams),
            'status' => 'pending',
            'created_at' => date('Y-m-d H:i:s')
        ]);

        // Fast mod: beklemeden mevcut cihazlar?? listele ve taramay?? arka planda ba??lat
        if ($originalMode === 'fast') {
            $devices = $db->fetchAll(
                "SELECT
                    d.ip_address as ip,
                    d.device_id as client_id,
                    d.screen_width,
                    d.screen_height
                 FROM gateway_devices gd
                 JOIN devices d ON d.id = gd.device_id
                 WHERE gd.gateway_id = ? AND d.company_id = ?
                 ORDER BY gd.last_seen DESC",
                [$gateway['id'], $companyId]
            );

            Response::success([
                'mode' => $originalMode,
                'via_gateway' => true,
                'gateway_enabled' => $gatewayEnabled,
                'subnet' => $subnet,
                'range' => "{$startIp}-{$endIp}",
                'found_count' => count($devices),
                'devices' => $devices,
                'async' => true
            ], 'Tarama baslatildi (fast). Mevcut cihazlar listelendi.');
        }

        // Gateway'in komutu al??p sonu?? g??ndermesini bekle (max 60 sn)
        $timeout = 60;
        $startTime = time();
        $result = null;

        while ((time() - $startTime) < $timeout) {
            $command = $db->fetch(
                "SELECT * FROM gateway_commands WHERE id = ?",
                [$commandId]
            );

            if ($command && $command['status'] === 'completed') {
                $result = json_decode($command['result'], true);
                break;
            } elseif ($command && $command['status'] === 'failed') {
                $error = $command['error_message'] ?? 'Bilinmeyen hata';
                Response::error("Gateway tarama hatasi: $error", 500);
            }

            sleep(1);
        }

        if (!$result) {
            Response::error('Gateway tarama zaman asimi. Gateway online ve calisiyor mu?', 408);
        }

        $devices = $result['devices'] ?? [];

    } else {
        $subnet = normalizeSubnet($subnet);
        if ($subnet === null) {
            Response::error('Subnet formati gecersiz', 422);
        }

        // Do??rudan tarama (local sunucu i??in)
        $pavoGatewayFile = BASE_PATH . '/services/PavoDisplayGateway.php';

        if (!file_exists($pavoGatewayFile)) {
            // PavoDisplayGateway yoksa, basit cURL tarama yap
            $devices = scanNetworkDirect($subnet, $startIp, $endIp, $mode, $ip);
        } else {
            require_once $pavoGatewayFile;

            $gateway = new PavoDisplayGateway();

            switch ($mode) {
                case 'single':
                    $result = $gateway->scanSingleIp($ip);
                    if ($result['found']) {
                        $devices[] = $result;
                    }
                    break;

                case 'multi_subnet':
                    // Multi-Subnet tarama: birden fazla subnet bloğunu tara
                    $subnetsToScan = !empty($subnetsInput) ? $subnetsInput : [$subnet];
                    // Validate each subnet
                    $validSubnets = [];
                    foreach ($subnetsToScan as $s) {
                        $normalized = normalizeSubnet($s);
                        if ($normalized !== null) {
                            $validSubnets[] = $normalized;
                        }
                    }
                    if (empty($validSubnets)) {
                        Response::error('Gecerli subnet bulunamadi', 422);
                    }
                    $devices = $gateway->scanMultipleSubnets($validSubnets, $startIp, $endIp, $profiles);
                    break;

                case 'advanced':
                    // Gelişmiş tarama: Profil bazlı + Ping Sweep
                    $subnetsToScan = !empty($subnetsInput) ? $subnetsInput : [$subnet];
                    $validSubnets = [];
                    foreach ($subnetsToScan as $s) {
                        $normalized = normalizeSubnet($s);
                        if ($normalized !== null) {
                            $validSubnets[] = $normalized;
                        }
                    }
                    if (empty($validSubnets)) {
                        Response::error('Gecerli subnet bulunamadi', 422);
                    }
                    // Tüm subnetleri tara
                    foreach ($validSubnets as $scanSubnet) {
                        $subnetDevices = $gateway->advancedScan($scanSubnet, $startIp, $endIp, $profiles);
                        foreach ($subnetDevices as &$sd) {
                            $sd['subnet'] = $scanSubnet;
                        }
                        $devices = array_merge($devices, $subnetDevices);
                    }
                    break;

                case 'ping_sweep':
                    // Sadece Ping Sweep: canlı IP'leri bul (HTTP kontrol yapmadan)
                    $subnetsToScan = !empty($subnetsInput) ? $subnetsInput : [$subnet];
                    foreach ($subnetsToScan as $s) {
                        $normalized = normalizeSubnet($s);
                        if ($normalized === null) continue;
                        $aliveHosts = $gateway->pingSweep($normalized, $startIp, $endIp);
                        foreach ($aliveHosts as &$host) {
                            $host['subnet'] = $normalized;
                            $host['type'] = 'unknown';
                            $host['profile'] = 'ping_only';
                            $host['profile_name'] = 'Ping Sweep';
                        }
                        $devices = array_merge($devices, $aliveHosts);
                    }
                    break;

                case 'fast':
                    $devices = $gateway->scanNetworkFast($subnet, $startIp, $endIp);
                    break;

                case 'range':
                case 'subnet':
                default:
                    // Range/subnet taramada sequential yerine paralel tarama kullan.
                    // Bu, "tarama bitti ama liste geç geliyor" gecikmesini ciddi azaltır.
                    $devices = $gateway->scanNetworkFast($subnet, $startIp, $endIp);
                    break;
            }
        }
    }

    // Mevcut cihazlar?? kontrol et (zaten kay??tl?? m???)
    $existingDevices = $db->fetchAll(
        "SELECT id, ip_address, device_id, name FROM devices WHERE company_id = ?",
        [$companyId]
    );

    $existingIps = array_column($existingDevices, 'ip_address');
    $existingClientIds = array_column($existingDevices, 'device_id');

    // Her cihaza kay??t durumu ekle
    foreach ($devices as &$device) {
        $deviceIp = $device['ip'] ?? $device['ip_address'] ?? null;
        $deviceClientId = $device['client_id'] ?? $device['device_id'] ?? null;

        $device['is_registered'] = in_array($deviceIp, $existingIps)
            || ($deviceClientId && in_array($deviceClientId, $existingClientIds));

        if ($device['is_registered']) {
            foreach ($existingDevices as $existing) {
                if ($existing['ip_address'] === $deviceIp ||
                    ($deviceClientId && $existing['device_id'] === $deviceClientId)) {
                    $device['registered_id'] = $existing['id'];
                    $device['registered_name'] = $existing['name'];
                    break;
                }
            }
        }
    }

    // Profil listesini dahil et
    $availableProfiles = [];
    if (file_exists(BASE_PATH . '/services/PavoDisplayGateway.php')) {
        require_once BASE_PATH . '/services/PavoDisplayGateway.php';
        $availableProfiles = PavoDisplayGateway::getDiscoveryProfiles();
        // Endpoint detaylarını frontend'e göndermemize gerek yok
        foreach ($availableProfiles as &$p) {
            unset($p['endpoints'], $p['info_endpoints']);
        }
    }

    Response::success([
        'mode' => $originalMode,
        'via_gateway' => !empty($gatewayId) || $mode === 'gateway',
        'gateway_enabled' => $gatewayEnabled,
        'subnet' => $subnet,
        'subnets' => !empty($subnetsInput) ? $subnetsInput : [$subnet],
        'profiles_used' => $profiles,
        'range' => "{$startIp}-{$endIp}",
        'found_count' => count($devices),
        'devices' => $devices,
        'available_profiles' => $availableProfiles,
    ], 'Tarama tamamlandi');

} catch (Exception $e) {
    Response::error('Tarama hatasi: ' . $e->getMessage(), 500);
}

/**
 * PavoDisplayGateway olmadan basit a?? taramas??
 */
function scanNetworkDirect(string $subnet, int $startIp, int $endIp, string $mode, ?string $singleIp): array
{
    $devices = [];
    $mh = curl_multi_init();
    $handles = [];

    if ($mode === 'single' && $singleIp) {
        $ipsToScan = [$singleIp];
    } else {
        $ipsToScan = [];
        for ($i = $startIp; $i <= $endIp; $i++) {
            $ipsToScan[] = "$subnet.$i";
        }
    }

    // Batch halinde tara
    $batchSize = 50;
    foreach (array_chunk($ipsToScan, $batchSize) as $batch) {
        $handles = [];

        foreach ($batch as $ip) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, "http://$ip/Iotags");
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 2);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 1);
            curl_multi_add_handle($mh, $ch);
            $handles[$ip] = $ch;
        }

        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh);
        } while ($running > 0);

        foreach ($handles as $ip => $ch) {
            $response = curl_multi_getcontent($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

            if ($httpCode === 200 && $response) {
                $info = json_decode($response, true);
                if ($info && isset($info['clientid'])) {
                    $devices[] = [
                        'ip' => $ip,
                        'client_id' => $info['clientid'] ?? null,
                        'name' => $info['name'] ?? 'PavoDisplay',
                        'model' => $info['model'] ?? null,
                        'firmware' => $info['version'] ?? null,
                        'screen_width' => $info['lcd_screen_width'] ?? 800,
                        'screen_height' => $info['lcd_screen_height'] ?? 1280,
                        'found' => true,
                        'type' => 'esl_android',
                        'is_pavo_display' => true
                    ];
                }
            }

            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
        }
    }

    curl_multi_close($mh);
    return $devices;
}

/**
 * RFC1918 private subnet kontrol??
 */
function isPrivateSubnet(string $subnet): bool
{
    $parts = explode('.', $subnet);
    if (count($parts) < 2) return false;

    $first = (int)$parts[0];
    $second = (int)$parts[1];

    if ($first === 10) return true;
    if ($first === 192 && $second === 168) return true;
    if ($first === 172 && $second >= 16 && $second <= 31) return true;

    return false;
}

/**
 * Subnet girdisini normalize et (a.b.c)
 */
function normalizeSubnet(?string $subnet): ?string
{
    $value = trim((string)$subnet);
    if ($value === '') {
        return null;
    }

    $parts = explode('.', $value);
    if (count($parts) !== 3) {
        return null;
    }

    $normalized = [];
    foreach ($parts as $part) {
        if (!is_numeric($part)) {
            return null;
        }
        $octet = (int)$part;
        if ($octet < 0 || $octet > 255) {
            return null;
        }
        $normalized[] = (string)$octet;
    }

    return implode('.', $normalized);
}

/**
 * IP'den subnet çıkar (a.b.c)
 */
function subnetFromIp(?string $ip): ?string
{
    $value = trim((string)$ip);
    if (!filter_var($value, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        return null;
    }

    $parts = explode('.', $value);
    return $parts[0] . '.' . $parts[1] . '.' . $parts[2];
}
