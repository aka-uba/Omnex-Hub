<?php
/**
 * Playlists List API
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

$where = [];
$params = [];
$templateJoin = $db->isPostgres()
    ? 'LEFT JOIN templates t ON CAST(p.template_id AS TEXT) = CAST(t.id AS TEXT)'
    : 'LEFT JOIN templates t ON p.template_id = t.id';

if ($companyId) {
    $where[] = "p.company_id = ?";
    $params[] = $companyId;
}

$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$playlists = $db->fetchAll(
    "SELECT p.*,
            t.name as template_name,
            t.preview_image as template_preview,
            (SELECT COUNT(*) FROM playlist_items WHERE playlist_id = p.id) as items_count
     FROM playlists p
     $templateJoin
     $whereClause
     ORDER BY p.name ASC",
    $params
);

// Add assigned device info for each playlist
if ($playlists) {
    foreach ($playlists as &$playlist) {
        $normalizedCount = (int) ($playlist['items_count'] ?? 0);
        $jsonCount = 0;
        if (!empty($playlist['items'])) {
            $decodedItems = json_decode($playlist['items'], true);
            if (is_array($decodedItems)) {
                $jsonCount = count($decodedItems);
            }
        }
        $playlist['items_count'] = max($normalizedCount, $jsonCount);
        // Tüm atanan cihazları getir
        $assignments = $db->fetchAll(
            "SELECT dca.device_id, d.name as device_name, d.ip_address
             FROM device_content_assignments dca
             JOIN devices d ON dca.device_id = d.id
             WHERE dca.content_id = ? AND dca.content_type = 'playlist' AND dca.status = 'active'
             ORDER BY dca.created_at DESC",
            [$playlist['id']]
        );

        $assignmentCount = count($assignments);
        $playlist['assigned_device_count'] = $assignmentCount;

        if ($assignmentCount === 1) {
            // Tek cihaz - direkt bilgileri göster
            $playlist['assigned_device_id'] = $assignments[0]['device_id'];
            $playlist['assigned_device_name'] = $assignments[0]['device_name'];
            $playlist['assigned_device_ip'] = $assignments[0]['ip_address'];
            $playlist['assigned_devices'] = $assignments;
        } elseif ($assignmentCount > 1) {
            // Çoklu cihaz - listeyi de gönder (modal için)
            $playlist['assigned_device_id'] = null;
            $playlist['assigned_device_name'] = null;
            $playlist['assigned_device_ip'] = null;
            $playlist['assigned_devices'] = $assignments;
        } else {
            // Atama yok
            $playlist['assigned_device_id'] = null;
            $playlist['assigned_device_name'] = null;
            $playlist['assigned_device_ip'] = null;
            $playlist['assigned_devices'] = [];
        }
    }
}

Response::success($playlists ?? []);

