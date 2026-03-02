<?php
/**
 * Signage Devices Tree API
 * Returns hierarchical data: Company > Region > Branch > Device
 * for the signage device management tree view.
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();
$isSuperAdmin = ($user['role'] === 'superadmin' || $user['role'] === 'SuperAdmin');
$assignmentPlaylistJoin = $db->isPostgres()
    ? "INNER JOIN playlists p ON CAST(dca.content_id AS TEXT) = CAST(p.id AS TEXT)"
    : "INNER JOIN playlists p ON dca.content_id = p.id";

// Filters
$search = $request->query('search', '');
$statusFilter = $request->query('status', '');
$filterCompanyId = $request->query('company_id', '');

// Determine which companies to fetch
$companyIds = [];

if ($isSuperAdmin && !$companyId && !$filterCompanyId) {
    // SuperAdmin with no company selected: get all companies that have signage devices
    $rows = $db->fetchAll(
        "SELECT DISTINCT d.company_id, c.name as company_name
         FROM devices d
         INNER JOIN companies c ON d.company_id = c.id
         WHERE d.type IN ('android_tv', 'web_display')
         ORDER BY c.name"
    );
    foreach ($rows as $row) {
        $companyIds[] = ['id' => $row['company_id'], 'name' => $row['company_name']];
    }
} else {
    // Single company context
    $cid = $filterCompanyId ?: $companyId;
    if ($cid) {
        $company = $db->fetch("SELECT id, name FROM companies WHERE id = ?", [$cid]);
        if ($company) {
            $companyIds[] = ['id' => $company['id'], 'name' => $company['name']];
        }
    }
}

if (empty($companyIds)) {
    Response::success([
        'summary' => ['total' => 0, 'online' => 0, 'offline' => 0, 'warning' => 0],
        'tree' => []
    ]);
    return;
}

$globalSummary = ['total' => 0, 'online' => 0, 'offline' => 0, 'warning' => 0];
$tree = [];

foreach ($companyIds as $companyInfo) {
    $cid = $companyInfo['id'];
    $companyName = $companyInfo['name'];

    // ---- Fetch all signage devices for this company ----
    $deviceQuery = "SELECT d.id, d.name, d.ip_address, d.type, d.model, d.status,
                           d.branch_id, d.last_seen, d.last_online, d.last_heartbeat,
                           d.last_sync, d.updated_at, d.metadata, d.current_content,
                           d.battery_level, d.signal_strength,
                           gd.status as gateway_status, gd.last_seen as gateway_last_seen,
                           gw.status as gateway_online_status
                    FROM devices d
                    LEFT JOIN gateway_devices gd ON d.id = gd.device_id
                    LEFT JOIN gateways gw ON gd.gateway_id = gw.id
                    WHERE d.company_id = ? AND d.type IN ('android_tv', 'web_display')";
    $deviceParams = [$cid];

    // Apply search filter
    if ($search) {
        $deviceQuery .= " AND (d.name LIKE ? OR d.ip_address LIKE ?)";
        $deviceParams[] = "%$search%";
        $deviceParams[] = "%$search%";
    }

    $deviceQuery .= " ORDER BY d.name";
    $rawDevices = $db->fetchAll($deviceQuery, $deviceParams);

    // ---- Enrich devices with realtime status + playlist info ----
    $offlineThreshold = 120; // 2 minutes

    // Batch-fetch playlist assignments
    $deviceIds = array_column($rawDevices, 'id');
    $playlistMap = [];
    if (!empty($deviceIds)) {
        $placeholders = implode(',', array_fill(0, count($deviceIds), '?'));
        $assignments = $db->fetchAll(
            "SELECT dca.device_id, p.id as playlist_id, p.name as playlist_name, p.orientation
             FROM device_content_assignments dca
             $assignmentPlaylistJoin
             WHERE dca.content_type = 'playlist' AND dca.status = 'active'
             AND dca.device_id IN ($placeholders)",
            $deviceIds
        );
        foreach ($assignments as $a) {
            $playlistMap[$a['device_id']] = [
                'id' => $a['playlist_id'],
                'name' => $a['playlist_name'],
                'orientation' => $a['orientation'] ?? 'landscape'
            ];
        }
    }

    // Batch-fetch heartbeat metadata for playlist info
    $heartbeatMap = [];
    if (!empty($deviceIds)) {
        $placeholders = implode(',', array_fill(0, count($deviceIds), '?'));
        $heartbeats = $db->fetchAll(
            "SELECT device_id, metadata, current_item
             FROM device_heartbeats
             WHERE device_id IN ($placeholders)
             ORDER BY created_at DESC",
            $deviceIds
        );
        foreach ($heartbeats as $hb) {
            if (!isset($heartbeatMap[$hb['device_id']])) {
                $meta = $hb['metadata'] ? json_decode($hb['metadata'], true) : [];
                $heartbeatMap[$hb['device_id']] = [
                    'playlist_id' => $meta['playlist_id'] ?? null,
                    'playlist_name' => $meta['playlist_name'] ?? null,
                    'current_index' => $meta['current_index'] ?? 0,
                    'total_items' => $meta['total_items'] ?? 0,
                    'current_item' => $hb['current_item'] ?? null
                ];
            }
        }
    }

    $devices = [];
    foreach ($rawDevices as $d) {
        // Realtime status calculation (same logic as api/devices/index.php)
        $lastActivity = $d['last_seen'] ?? $d['last_online'] ?? null;
        $secondsAgo = null;

        if ($lastActivity) {
            $secondsAgo = time() - strtotime($lastActivity);

            if ($d['status'] === 'online' && $secondsAgo > $offlineThreshold) {
                $d['status'] = 'offline';
            } elseif ($d['status'] === 'offline' && $secondsAgo <= $offlineThreshold) {
                $d['status'] = 'online';
            }
        }

        // Gateway-based status override
        if (!empty($d['gateway_status'])) {
            if ($d['gateway_status'] === 'active' && $d['gateway_online_status'] === 'online') {
                $d['status'] = 'online';
                if (!empty($d['gateway_last_seen'])) {
                    $lastActivity = $d['gateway_last_seen'];
                    $secondsAgo = time() - strtotime($lastActivity);
                }
            } elseif ($d['gateway_status'] === 'inactive') {
                $d['status'] = 'offline';
            } elseif ($d['gateway_status'] === 'unreachable') {
                $d['status'] = 'error';
            }
        }

        // Determine status category
        $statusCategory = 'offline';
        if ($d['status'] === 'online') {
            $statusCategory = 'online';
        } elseif ($d['status'] === 'error' || $d['status'] === 'maintenance') {
            $statusCategory = 'warning';
        }

        // Apply status filter
        if ($statusFilter && $statusCategory !== $statusFilter) {
            continue;
        }

        // Playlist info from heartbeat first, then from assignments
        $playlist = null;
        $hb = $heartbeatMap[$d['id']] ?? null;
        $assignedPlaylist = $playlistMap[$d['id']] ?? null;
        if ($hb && !empty($hb['playlist_name'])) {
            $playlist = [
                'id' => $hb['playlist_id'] ?? null,
                'name' => $hb['playlist_name'],
                'current_index' => (int)($hb['current_index'] ?? 0),
                'total_items' => (int)($hb['total_items'] ?? 0),
                'orientation' => $assignedPlaylist['orientation'] ?? ($hb['orientation'] ?? 'landscape')
            ];
        } elseif ($assignedPlaylist) {
            $playlist = $assignedPlaylist;
            $playlist['current_index'] = 0;
            $playlist['total_items'] = 0;
        }

        // Preview URL resolution
        $metadata = $d['metadata'] ? json_decode($d['metadata'], true) : [];
        $previewUrl = null;
        $previewImage = $metadata['preview_image'] ?? null;
        if ($previewImage && strlen($previewImage) < 500 && strpos($previewImage, 'data:') !== 0) {
            $previewUrl = $previewImage;
        } else {
            $cc = $d['current_content'] ?? null;
            if ($cc && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $cc)) {
                $mediaRow = $db->fetch("SELECT file_path FROM media WHERE id = ?", [$cc]);
                $previewUrl = $mediaRow ? ('storage/' . ltrim($mediaRow['file_path'], '/')) : null;
            } elseif ($cc && strlen($cc) < 500 && strpos($cc, 'data:') !== 0) {
                $previewUrl = $cc;
            }
        }

        // Device type display
        $deviceType = $d['model'] ?: $d['type'];

        $devices[] = [
            'type' => 'device',
            'id' => $d['id'],
            'name' => $d['name'],
            'ip_address' => $d['ip_address'],
            'status' => $statusCategory,
            'device_type' => $deviceType,
            'preview_url' => $previewUrl,
            'playlist' => $playlist,
            'last_seen' => $lastActivity ?? $d['last_heartbeat'] ?? $d['last_sync'] ?? $d['updated_at'],
            'seconds_ago' => $secondsAgo,
            'branch_id' => $d['branch_id']
        ];
    }

    // ---- Fetch branch hierarchy ----
    require_once __DIR__ . '/../../services/BranchService.php';
    $hierarchy = BranchService::getBranchHierarchy($cid);
    $regions = $hierarchy['regions'];
    $orphanBranches = $hierarchy['orphans'];

    // Group devices by branch_id
    $devicesByBranch = [];
    $unassignedDevices = [];
    foreach ($devices as $device) {
        if ($device['branch_id']) {
            $devicesByBranch[$device['branch_id']][] = $device;
        } else {
            $unassignedDevices[] = $device;
        }
    }

    // ---- Build tree ----
    $companyChildren = [];
    $companyStats = ['total' => 0, 'online' => 0, 'offline' => 0, 'warning' => 0];

    // Helper: calculate stats from device list
    $calcStats = function ($deviceList) {
        $stats = ['total' => 0, 'online' => 0, 'offline' => 0, 'warning' => 0];
        foreach ($deviceList as $d) {
            $stats['total']++;
            $stats[$d['status']]++;
        }
        return $stats;
    };

    // Helper: merge stats
    $mergeStats = function (&$target, $source) {
        $target['total'] += $source['total'];
        $target['online'] += $source['online'];
        $target['offline'] += $source['offline'];
        $target['warning'] += $source['warning'];
    };

    // Helper: build branch node with devices
    $buildBranchNode = function ($branch) use ($devicesByBranch, $calcStats, $search) {
        $branchDevices = $devicesByBranch[$branch['id']] ?? [];
        $stats = $calcStats($branchDevices);

        // If search is active and no devices match, check if branch name matches
        if ($search && $stats['total'] === 0) {
            if (stripos($branch['name'], $search) === false && stripos($branch['code'] ?? '', $search) === false) {
                return null; // Skip this branch entirely
            }
        }

        return [
            'type' => 'branch',
            'id' => $branch['id'],
            'name' => $branch['name'],
            'code' => $branch['code'] ?? '',
            'stats' => $stats,
            'children' => $branchDevices
        ];
    };

    // Build region nodes
    foreach ($regions as $region) {
        $regionChildren = [];
        $regionStats = ['total' => 0, 'online' => 0, 'offline' => 0, 'warning' => 0];

        // Add child branches (stores under this region)
        foreach ($region['children'] as $childBranch) {
            $branchNode = $buildBranchNode($childBranch);
            if ($branchNode) {
                $regionChildren[] = $branchNode;
                $mergeStats($regionStats, $branchNode['stats']);
            }
        }

        // Also add devices directly assigned to the region itself
        $regionDirectDevices = $devicesByBranch[$region['id']] ?? [];
        if (!empty($regionDirectDevices)) {
            $directStats = $calcStats($regionDirectDevices);
            $mergeStats($regionStats, $directStats);
            // Add them as a virtual "Direct" branch or append to children
            foreach ($regionDirectDevices as $rd) {
                $regionChildren[] = $rd;
            }
        }

        // Skip empty regions if search is active
        if ($search && $regionStats['total'] === 0 && stripos($region['name'], $search) === false) {
            continue;
        }

        if ($regionStats['total'] > 0 || !$search) {
            $companyChildren[] = [
                'type' => 'region',
                'id' => $region['id'],
                'name' => $region['name'],
                'stats' => $regionStats,
                'children' => $regionChildren
            ];
            $mergeStats($companyStats, $regionStats);
        }
    }

    // Build orphan branch nodes (branches with no region parent)
    foreach ($orphanBranches as $orphan) {
        $branchNode = $buildBranchNode($orphan);
        if ($branchNode && ($branchNode['stats']['total'] > 0 || !$search)) {
            $companyChildren[] = $branchNode;
            $mergeStats($companyStats, $branchNode['stats']);
        }
    }

    // Add unassigned devices node
    if (!empty($unassignedDevices)) {
        $unassignedStats = $calcStats($unassignedDevices);
        $companyChildren[] = [
            'type' => 'unassigned',
            'id' => 'unassigned-' . $cid,
            'name' => '__unassigned__', // Will be translated in frontend
            'stats' => $unassignedStats,
            'children' => $unassignedDevices
        ];
        $mergeStats($companyStats, $unassignedStats);
    }

    // Add company node (for SuperAdmin multi-company) or direct children
    if ($isSuperAdmin && count($companyIds) > 1) {
        $tree[] = [
            'type' => 'company',
            'id' => $cid,
            'name' => $companyName,
            'stats' => $companyStats,
            'children' => $companyChildren
        ];
    } else {
        // Single company - skip company level, add children directly
        $tree = $companyChildren;
    }

    $mergeStats($globalSummary, $companyStats);
}

Response::success([
    'summary' => $globalSummary,
    'tree' => $tree
]);
