<?php
/**
 * PriceView template preset list (for admin/frontend forms)
 * GET /api/priceview/template-presets
 */

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

require_once __DIR__ . '/template-utils.php';

$presets = priceviewTemplatePresets();

Response::success([
    'presets' => $presets,
    'count' => count($presets),
]);

