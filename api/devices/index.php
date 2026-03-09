<?php
/**
 * Devices List API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$activeBranchId = Auth::getActiveBranchId();

// Pagination
$page = (int)($request->query('page', 1));
$perPage = (int)($request->query('per_page', 20));
$offset = ($page - 1) * $perPage;

// Filters
$search = $request->query('search', '');
$type = $request->query('type', '');
$status = $request->query('status', '');
$groupId = $request->query('group_id', '');
$approvalStatus = $request->query('approval_status', '');
// Branch filter: use query param first, then header
$branchId = $request->query('branch_id', '') ?: $activeBranchId;

// Build query
$where = [];
$params = [];

// Helper: check if value is a valid file path (not base64/JSON)
function isValidImagePath($value) {
    if (empty($value)) return false;
    if (strlen($value) > 500) return false;
    if (strpos($value, 'data:') === 0) return false;
    if (preg_match('/^[A-Za-z0-9+\/=]{50,}$/', $value)) return false;
    if (strpos($value, '{') === 0 || strpos($value, '[') === 0) return false;
    return true;
}

// Company filter - apply for ALL users including SuperAdmin when a company is selected
if ($companyId) {
    $where[] = "d.company_id = ?";
    $params[] = $companyId;
}

if ($search) {
    $where[] = "(d.name LIKE ? OR d.device_id LIKE ? OR d.ip_address LIKE ? OR d.mac_address LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

if ($type) {
    // Map frontend type to database type
    $typeMap = ['tv' => 'android_tv', 'esl' => 'esl'];
    $dbType = $typeMap[$type] ?? $type;
    $where[] = "d.type = ?";
    $params[] = $dbType;
}

if ($status) {
    $where[] = "d.status = ?";
    $params[] = $status;
}

if ($groupId) {
    $where[] = "d.group_id = ?";
    $params[] = $groupId;
}

if ($approvalStatus) {
    $where[] = "d.approval_status = ?";
    $params[] = $approvalStatus;
}

if ($branchId) {
    // Check if selected branch is a region (has child branches)
    $selectedBranch = $db->fetch("SELECT id, type, parent_id FROM branches WHERE id = ?", [$branchId]);

    if ($selectedBranch && $selectedBranch['type'] === 'region') {
        // Get all child branches under this region
        $childBranches = $db->fetchAll(
            "SELECT id FROM branches WHERE parent_id = ?",
            [$branchId]
        );

        if (!empty($childBranches)) {
            // Filter by region itself OR any of its child branches
            $childIds = array_column($childBranches, 'id');
            $childIds[] = $branchId; // Include region itself in case devices are assigned directly
            $placeholders = implode(',', array_fill(0, count($childIds), '?'));
            $where[] = "d.branch_id IN ($placeholders)";
            $params = array_merge($params, $childIds);
        } else {
            // Region has no children, just filter by region id
            $where[] = "d.branch_id = ?";
            $params[] = $branchId;
        }
    } else {
        // Regular branch (store, warehouse, etc.) - filter by exact branch_id
        $where[] = "d.branch_id = ?";
        $params[] = $branchId;
    }
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

// Sorting
$sortBy = $request->query('sort_by', 'created_at');
$sortDir = strtoupper($request->query('sort_dir', 'DESC'));

// Validate sort direction
if (!in_array($sortDir, ['ASC', 'DESC'])) {
    $sortDir = 'DESC';
}

// Whitelist allowed sort columns to prevent SQL injection
// For 'type' sorting, use COALESCE to consider model field (which stores original type like hanshow_esl, esl_android)
// For 'last_activity' sorting, use COALESCE with all fallback fields (same as the mapping below)
$allowedSortColumns = [
    'name' => 'd.name',
    'type' => "COALESCE(NULLIF(d.model, ''), d.type)",
    'status' => 'd.status',
    'approval_status' => 'd.approval_status',
    'serial_number' => 'd.device_id',
    'ip_address' => 'd.ip_address',
    'location' => 'd.location',
    'last_activity' => "COALESCE(d.last_seen, d.last_online, d.last_heartbeat, d.last_sync, d.updated_at)",
    'created_at' => 'd.created_at',
    'group_name' => 'g.name'
];

$orderColumn = $allowedSortColumns[$sortBy] ?? 'd.created_at';
$orderClause = "ORDER BY $orderColumn $sortDir";

// Get total
$total = $db->fetchColumn("SELECT COUNT(*) FROM devices d $whereClause", $params);

// Get devices with gateway status
$devices = $db->fetchAll(
    "SELECT d.*, g.name as group_name, b.name as branch_name, b.type as branch_type,
            gd.status as gateway_status, gd.last_seen as gateway_last_seen,
            gw.name as gateway_name, gw.status as gateway_online_status
     FROM devices d
     LEFT JOIN device_groups g ON d.group_id = g.id
     LEFT JOIN branches b ON d.branch_id = b.id
     LEFT JOIN gateway_devices gd ON d.id = gd.device_id
     LEFT JOIN gateways gw ON gd.gateway_id = gw.id
     $whereClause
     $orderClause
     LIMIT ? OFFSET ?",
    array_merge($params, [$perPage, $offset])
);

// Hanshow ESL battery/status enrichment from ESL-Working API
$hanshowBatteryMap = [];
$hasHanshowDevices = false;
foreach ($devices as $d) {
    if (($d['model'] ?? '') === 'hanshow_esl' && !empty($d['device_id'])) {
        $hasHanshowDevices = true;
        break;
    }
}
if ($hasHanshowDevices) {
    $cacheDir = STORAGE_PATH . '/cache/api';
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0755, true);
    }

    $cacheCompanyKey = preg_replace('/[^a-zA-Z0-9_-]/', '_', (string)$companyId);
    $hanshowCacheFile = $cacheDir . '/hanshow_esl_status_' . $cacheCompanyKey . '.json';
    $hanshowCacheTtlSec = 30;

    $loadHanshowCache = static function(string $cacheFile): array {
        if (!is_file($cacheFile)) {
            return [];
        }
        $raw = @file_get_contents($cacheFile);
        if ($raw === false || $raw === '') {
            return [];
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded) || !isset($decoded['map']) || !is_array($decoded['map'])) {
            return [];
        }
        return $decoded['map'];
    };

    $saveHanshowCache = static function(string $cacheFile, array $map): void {
        if (empty($map)) {
            return;
        }
        $payload = json_encode([
            'generated_at' => time(),
            'map' => $map
        ], JSON_UNESCAPED_UNICODE);
        if ($payload !== false) {
            @file_put_contents($cacheFile, $payload, LOCK_EX);
        }
    };

    $cacheIsFresh = is_file($hanshowCacheFile) && ((time() - (int)@filemtime($hanshowCacheFile)) <= $hanshowCacheTtlSec);
    if ($cacheIsFresh) {
        $hanshowBatteryMap = $loadHanshowCache($hanshowCacheFile);
    }

    $fetchedFromRemote = false;
    try {
        if (empty($hanshowBatteryMap)) {
            $hanshowSettings = $db->fetch(
                "SELECT eslworking_url FROM hanshow_settings WHERE company_id = ? LIMIT 1",
                [$companyId]
            );
            if ($hanshowSettings && !empty($hanshowSettings['eslworking_url'])) {
                $eslUrl = rtrim($hanshowSettings['eslworking_url'], '/') . '/api2/esls?page=0&size=200';
                $ch = curl_init($eslUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 1);
                curl_setopt($ch, CURLOPT_TIMEOUT, 1);
                $eslResp = curl_exec($ch);
                curl_close($ch);
                $eslData = json_decode($eslResp, true);
                $eslList = $eslData['result']['esl_list'] ?? [];
                foreach ($eslList as $esl) {
                    $eslId = $esl['esl_id'] ?? '';
                    if (!$eslId) continue;
                    // CR2450 voltage to percentage
                    $voltage = (float)($esl['battery'] ?? 0);
                    $batteryPct = 0;
                    if ($voltage >= 3.0) $batteryPct = 100;
                    elseif ($voltage >= 2.8) $batteryPct = 70 + ($voltage - 2.8) / 0.2 * 30;
                    elseif ($voltage >= 2.6) $batteryPct = 40 + ($voltage - 2.6) / 0.2 * 30;
                    elseif ($voltage >= 2.4) $batteryPct = 15 + ($voltage - 2.4) / 0.2 * 25;
                    elseif ($voltage >= 2.0) $batteryPct = ($voltage - 2.0) / 0.4 * 15;

                    $hanshowBatteryMap[$eslId] = [
                        'battery_level' => (int)round($batteryPct),
                        'battery_voltage' => $voltage,
                        'esl_status' => (int)$esl['status'] === 1 ? 'online' : 'offline'
                    ];
                }
                $fetchedFromRemote = true;
            }
        }
    } catch (\Exception $e) {
        // ESL-Working unreachable - skip enrichment
    }

    if ($fetchedFromRemote) {
        $saveHanshowCache($hanshowCacheFile, $hanshowBatteryMap);
    } elseif (empty($hanshowBatteryMap)) {
        // Fallback to stale cache if remote fetch failed.
        $hanshowBatteryMap = $loadHanshowCache($hanshowCacheFile);
    }
}

// Map database fields to frontend expected fields
foreach ($devices as &$device) {
    $device['serial_number'] = $device['device_id'];
    $device['location'] = $device['location'] ?? '';

    // Get original_type from metadata if available
    $metadata = $device['metadata'] ? json_decode($device['metadata'], true) : [];

    // Keep db type for broadcast control checks
    $device['db_type'] = $device['type'];

    // Use original_type from metadata, model field, or map from db type
    // Priority: metadata.original_type > model > db type
    if (!empty($metadata['original_type'])) {
        $device['type'] = $metadata['original_type'];
        $device['original_type'] = $metadata['original_type'];
    } elseif (!empty($device['model']) && in_array($device['model'], ['esl_android', 'esl_rtos', 'hanshow_esl', 'pwa_player', 'stream_player'])) {
        // model alanında orijinal tip saklanıyor
        $device['type'] = $device['model'];
        $device['original_type'] = $device['model'];
    } else {
        // Default mapping for old records
        $typeMapReverse = ['android_tv' => 'android_tv', 'esl' => 'esl', 'panel' => 'panel', 'web_display' => 'web_display'];
        $device['type'] = $typeMapReverse[$device['type']] ?? $device['type'];
        $device['original_type'] = $device['type'];
    }

    // Hanshow ESL: enrich battery + status from ESL-Working
    if ($device['model'] === 'hanshow_esl' && !empty($device['device_id']) && isset($hanshowBatteryMap[$device['device_id']])) {
        $hData = $hanshowBatteryMap[$device['device_id']];
        $device['battery_level'] = $hData['battery_level'];
        $device['battery_voltage'] = $hData['battery_voltage'];
        $device['status'] = $hData['esl_status'];
    }

    // ✅ REALTIME STATUS: Calculate online/offline based on last_seen timeout
    $offlineThresholdSeconds = 120; // 2 minutes (heartbeat is 30s, so 4 missed beats)
    $lastActivity = $device['last_seen'] ?? $device['last_online'] ?? null;

    if ($lastActivity && in_array($device['type'], ['android_tv', 'web_display', 'esl'])) {
        $lastActivityTimestamp = strtotime($lastActivity);
        $nowTimestamp = time();
        $secondsAgo = $nowTimestamp - $lastActivityTimestamp;

        // Realtime status override based on heartbeat timeout
        if ($device['status'] === 'online' && $secondsAgo > $offlineThresholdSeconds) {
            $device['status'] = 'offline';
            $device['status_realtime'] = true; // Flag to indicate status was calculated realtime
        } elseif ($device['status'] === 'offline' && $secondsAgo <= $offlineThresholdSeconds) {
            $device['status'] = 'online';
            $device['status_realtime'] = true;
        }

        // Add connection quality indicator
        if ($secondsAgo <= 60) {
            $device['connection_quality'] = 'excellent'; // < 1 min
        } elseif ($secondsAgo <= 120) {
            $device['connection_quality'] = 'good'; // 1-2 min
        } elseif ($secondsAgo <= 300) {
            $device['connection_quality'] = 'poor'; // 2-5 min
        } else {
            $device['connection_quality'] = 'disconnected'; // > 5 min
        }

        $device['seconds_since_last_seen'] = $secondsAgo;
    }

    // Gateway-based status override (if gateway is reporting)
    if (!empty($device['gateway_status'])) {
        // Gateway durumunu device status'e yansıt
        if ($device['gateway_status'] === 'active' && $device['gateway_online_status'] === 'online') {
            $device['status'] = 'online';
            // Gateway last_seen'i varsa onu kullan
            if (!empty($device['gateway_last_seen'])) {
                $device['last_seen'] = $device['gateway_last_seen'];
            }
        } elseif ($device['gateway_status'] === 'inactive') {
            $device['status'] = 'offline';
        } elseif ($device['gateway_status'] === 'unreachable') {
            $device['status'] = 'error';
        }

        // Gateway bilgisi ekle (frontend için)
        $device['gateway_info'] = [
            'gateway_name' => $device['gateway_name'] ?? null,
            'gateway_status' => $device['gateway_status'],
            'gateway_online' => $device['gateway_online_status'] === 'online',
            'last_seen' => $device['gateway_last_seen'] ?? null
        ];
    }

    // Stream Mode: use last_stream_request_at for activity tracking
    // Last activity with multiple fallbacks
    $device['last_activity'] = $device['gateway_last_seen']
        ?? $device['last_stream_request_at']
        ?? $device['last_seen']
        ?? $device['last_online']
        ?? $device['last_heartbeat']
        ?? $device['last_sync']
        ?? $device['updated_at'];

    // New fields for device approval/registration system
    $device['approval_status'] = $device['approval_status'] ?? 'approved';
    $device['sync_code'] = $device['sync_code'] ?? null;
    $device['fingerprint'] = $device['fingerprint'] ?? null;
    $device['os_info'] = $device['os_info'] ?? null;
    $device['browser_info'] = $device['browser_info'] ?? null;
    $device['last_heartbeat'] = $device['last_heartbeat'] ?? null;

    // Preview URL - use current_content or generate from template
    $previewImage = $metadata['preview_image'] ?? null;
    if (isValidImagePath($previewImage)) {
        $device['preview_url'] = $previewImage;
    } else {
        $cc = $device['current_content'] ?? null;
        // If current_content is a UUID (media ID), resolve it to actual file_path
        if ($cc && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $cc)) {
            $mediaRow = $db->fetch("SELECT file_path FROM media WHERE id = ?", [$cc]);
            $device['preview_url'] = $mediaRow ? ('storage/' . ltrim($mediaRow['file_path'], '/')) : null;
        } elseif (isValidImagePath($cc)) {
            $device['preview_url'] = $cc;
        } else {
            $device['preview_url'] = null;
        }
    }
}

Response::paginated($devices, $total, $page, $perPage);
