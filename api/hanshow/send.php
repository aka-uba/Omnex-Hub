<?php
/**
 * Hanshow ESL'e Tasarim Gonder
 *
 * POST /api/hanshow/send
 *
 * Body:
 * {
 *   "esl_id": "55-3D-5F-67",       // Zorunlu: ESL ID
 *   "product_id": "uuid",           // Opsiyonel: Urun ID
 *   "template_id": "uuid",          // Opsiyonel: Template ID
 *   "content_type": "image",        // "image" veya "template"
 *   "image_base64": "...",          // content_type=image ise
 *   "flash_light": true,            // LED yanip sonsun mu
 *   "priority": 10                  // Oncelik (0=en dusuk)
 * }
 */

require_once __DIR__ . '/../../services/HanshowGateway.php';

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$data = json_decode(file_get_contents('php://input'), true) ?? [];

// Zorunlu alan kontrolu
if (empty($data['esl_id'])) {
    Response::badRequest('ESL ID gerekli');
}

$eslId = $data['esl_id'];
$contentType = $data['content_type'] ?? 'image';
$priority = $data['priority'] ?? 10;
$flashLight = !empty($data['flash_light']);

$db = Database::getInstance();
$gateway = new HanshowGateway();

// Urun bilgilerini al
$product = null;
if (!empty($data['product_id'])) {
    $product = $db->fetch(
        "SELECT * FROM products WHERE id = ? AND company_id = ?",
        [$data['product_id'], $user['company_id']]
    );
    if (!$product) {
        Response::notFound('Urun bulunamadi');
    }
}

// Template bilgilerini al
$template = null;
if (!empty($data['template_id'])) {
    $template = $db->fetch(
        "SELECT * FROM templates WHERE id = ? AND (company_id = ? OR scope = 'system' OR company_id IS NULL)",
        [$data['template_id'], $user['company_id']]
    );
    if (!$template) {
        Response::notFound('Template bulunamadi');
    }
}

// ESL bilgilerini al (varsa)
$esl = $db->fetch(
    "SELECT * FROM hanshow_esls WHERE esl_id = ? AND company_id = ?",
    [$eslId, $user['company_id']]
);

// Ekran boyutlarini belirle
$width = $esl['screen_width'] ?? $template['width'] ?? 152;
$height = $esl['screen_height'] ?? $template['height'] ?? 152;
$screenColor = $esl['screen_color'] ?? 'BWR';

// Icerik olustur
$options = [
    'priority' => $priority
];

// LED flash ayari
if ($flashLight) {
    $options['flash_light'] = [
        'colors' => ['green'],
        'on_time' => 50,
        'off_time' => 50,
        'flash_count' => 2,
        'sleep_time' => 100,
        'loop_count' => 1
    ];
}

try {
    if ($contentType === 'image') {
        // Gorsel gonder
        if (!empty($data['image_base64'])) {
            // Hazir gorsel
            $imageBase64 = $data['image_base64'];
        } elseif ($product) {
            // Urun bilgilerinden gorsel olustur
            $imageBase64 = $gateway->renderImage($product, $template ?? [], $width, $height, $screenColor);
        } else {
            Response::badRequest('image_base64 veya product_id gerekli');
        }

        $result = $gateway->sendImageToESL($eslId, $imageBase64, $options);
    } else {
        // Template/Layout gonder
        if (!$product) {
            Response::badRequest('Template gondermek icin product_id gerekli');
        }

        $layout = $gateway->createLayout($product, $template ?? [], $width, $height);

        $content = [
            'name' => 'omnex_' . time(),
            'pages' => [
                [
                    'id' => 0,
                    'name' => 'main',
                    'layout' => $layout
                ]
            ]
        ];

        $result = $gateway->sendToESL($eslId, $content, $options);
    }

    // ESL kaydini guncelle/olustur
    if ($esl) {
        $db->update('hanshow_esls', [
            'current_product_id' => $product['id'] ?? null,
            'current_template_id' => $template['id'] ?? null,
            'status' => 'updating',
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$esl['id']]);
    } else {
        // Yeni ESL kaydi olustur
        $db->insert('hanshow_esls', [
            'id' => $db->generateUuid(),
            'company_id' => $user['company_id'],
            'esl_id' => $eslId,
            'screen_width' => $width,
            'screen_height' => $height,
            'screen_color' => $screenColor,
            'current_product_id' => $product['id'] ?? null,
            'current_template_id' => $template['id'] ?? null,
            'status' => 'updating'
        ]);
    }

    if ($result['success']) {
        Response::success([
            'esl_id' => $eslId,
            'sid' => $result['sid'] ?? null,
            'status' => 'processing',
            'message' => 'Tasarim gonderildi, islem devam ediyor'
        ]);
    } else {
        Response::error('Gonderim basarisiz: ' . ($result['errmsg'] ?? 'Bilinmeyen hata'));
    }
} catch (Exception $e) {
    Response::error('Hata: ' . $e->getMessage());
}
