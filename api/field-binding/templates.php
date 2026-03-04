<?php
/**
 * Field Binding Templates API
 *
 * Returns a scored list of templates suitable for a given device type
 * and optional screen dimensions. Templates are ranked by relevance
 * so the frontend can suggest the best match.
 *
 * GET /api/field-binding/templates?device_type=esl&screen_width=1280&screen_height=960&device_id=...
 *
 * Query params:
 *   - device_type   (required)  Device type string (e.g. esl, android_tv, tablet)
 *   - screen_width  (optional)  Target screen width in pixels
 *   - screen_height (optional)  Target screen height in pixels
 *   - device_id     (optional)  Device UUID - auto-resolves screen dimensions
 *
 * @package OmnexDisplayHub
 */

$db = Database::getInstance();
$user = Auth::user();
$companyId = Auth::getActiveCompanyId();

$deviceType   = trim($request->query('device_type', ''));
$screenWidth  = $request->query('screen_width');
$screenHeight = $request->query('screen_height');
$deviceId     = $request->query('device_id');

// --- Validation ---

if ($deviceType === '') {
    Response::badRequest('device_type parametresi gerekli');
}

// If device_id is provided, resolve screen dimensions from the device record
if (!empty($deviceId)) {
    $device = $db->fetch(
        "SELECT screen_width, screen_height, type FROM devices WHERE id = ? AND company_id = ?",
        [$deviceId, $companyId]
    );

    if ($device) {
        // Use device screen dimensions if not explicitly provided
        if (empty($screenWidth) && !empty($device['screen_width'])) {
            $screenWidth = (int)$device['screen_width'];
        }
        if (empty($screenHeight) && !empty($device['screen_height'])) {
            $screenHeight = (int)$device['screen_height'];
        }
        // Fall back to device type from record if not provided
        if ($deviceType === '' && !empty($device['type'])) {
            $deviceType = $device['type'];
        }
    }
}

// Cast to int (may be null)
$screenWidth  = $screenWidth  !== null ? (int)$screenWidth  : null;
$screenHeight = $screenHeight !== null ? (int)$screenHeight : null;

// =====================================================
// Fetch candidate templates
// =====================================================

// Templates visible to this company: own templates + system + unowned
$templates = $db->fetchAll(
    "SELECT id, name, preview_image, width, height, device_types, scope,
            company_id, updated_at
     FROM templates
     WHERE status = 'active'
       AND (company_id = ? OR scope = 'system' OR company_id IS NULL)",
    [$companyId]
);

// =====================================================
// Score and filter
// =====================================================

$now = time();
$sevenDaysAgo = $now - (7 * 86400);
$scored = [];

foreach ($templates as $tpl) {
    $score = 0;
    $deviceTypes = $tpl['device_types'] ?? '';

    // --- Device type match (+10) ---
    $typeMatched = false;
    if (!empty($deviceTypes)) {
        // device_types may be JSON array or comma-separated string
        $decoded = json_decode($deviceTypes, true);

        if (is_array($decoded)) {
            // JSON array - check membership
            $typeMatched = in_array($deviceType, $decoded, true);
        } else {
            // Comma-separated string
            $parts = array_map('trim', explode(',', $deviceTypes));
            $typeMatched = in_array($deviceType, $parts, true);
        }
    }

    if ($typeMatched) {
        $score += 10;
    } else {
        // Skip templates that do not match the device type at all
        continue;
    }

    // --- Screen dimensions match (+5) ---
    if ($screenWidth !== null && $screenHeight !== null) {
        $tplWidth  = (int)($tpl['width']  ?? 0);
        $tplHeight = (int)($tpl['height'] ?? 0);

        if ($tplWidth > 0 && $tplHeight > 0
            && $tplWidth === $screenWidth
            && $tplHeight === $screenHeight
        ) {
            $score += 5;
        }
    }

    // --- Company template bonus (+3) ---
    if (!empty($tpl['company_id']) && $tpl['company_id'] === $companyId) {
        $score += 3;
    }

    // --- Recently updated bonus (+2) ---
    if (!empty($tpl['updated_at'])) {
        $updatedTs = strtotime($tpl['updated_at']);
        if ($updatedTs !== false && $updatedTs >= $sevenDaysAgo) {
            $score += 2;
        }
    }

    $scored[] = [
        'id'           => $tpl['id'],
        'name'         => $tpl['name'],
        'thumbnail'    => $tpl['preview_image'],
        'width'        => (int)$tpl['width'],
        'height'       => (int)$tpl['height'],
        'score'        => $score,
        'device_types' => $deviceTypes,
        'scope'        => $tpl['scope'],
    ];
}

// Sort by score descending, then by name ascending for ties
usort($scored, function ($a, $b) {
    if ($b['score'] !== $a['score']) {
        return $b['score'] - $a['score'];
    }
    return strcasecmp($a['name'], $b['name']);
});

// Return top 10
$result = array_slice($scored, 0, 10);

Response::success($result);
