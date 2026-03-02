<?php
/**
 * Hanshow ESL Listesi ve Yonetimi
 *
 * GET  /api/hanshow/esls           - Tum ESL'leri listele
 * GET  /api/hanshow/esls/:id       - Tek ESL detayi
 * POST /api/hanshow/esls           - Yeni ESL ekle
 * PUT  /api/hanshow/esls/:id       - ESL guncelle
 * DELETE /api/hanshow/esls/:id     - ESL sil
 */

require_once __DIR__ . '/../../services/HanshowGateway.php';

$user = Auth::user();
if (!$user) {
    Response::unauthorized('Oturum gerekli');
}

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];

// Route param'i URL'den cikart (basit parsing)
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$id = null;
$templateJoin = $db->isPostgres()
    ? 'LEFT JOIN templates t ON CAST(e.current_template_id AS TEXT) = CAST(t.id AS TEXT)'
    : 'LEFT JOIN templates t ON e.current_template_id = t.id';
if (preg_match('/\/hanshow\/esls\/([a-zA-Z0-9\-]+)/', $uri, $matches)) {
    $id = $matches[1];
}

switch ($method) {
    case 'GET':
        if ($id) {
            // Tek ESL detayi
            $esl = $db->fetch(
                "SELECT e.*,
                    p.name as product_name,
                    p.sku as product_sku,
                    t.name as template_name
                FROM hanshow_esls e
                LEFT JOIN products p ON e.current_product_id = p.id
                $templateJoin
                WHERE e.id = ? AND e.company_id = ?",
                [$id, $user['company_id']]
            );

            if (!$esl) {
                Response::notFound('ESL bulunamadi');
            }

            Response::success($esl);
        } else {
            // ESL listesi
            $status = $_GET['status'] ?? null;
            $search = $_GET['search'] ?? null;
            $page = (int)($_GET['page'] ?? 1);
            $perPage = (int)($_GET['per_page'] ?? 20);
            $offset = ($page - 1) * $perPage;

            $where = ['e.company_id = ?'];
            $params = [$user['company_id']];

            if ($status) {
                $where[] = 'e.status = ?';
                $params[] = $status;
            }

            if ($search) {
                $where[] = '(e.esl_id LIKE ? OR e.model_name LIKE ? OR p.name LIKE ?)';
                $searchParam = '%' . $search . '%';
                $params = array_merge($params, [$searchParam, $searchParam, $searchParam]);
            }

            $whereClause = implode(' AND ', $where);

            // Toplam sayisi
            $countQuery = "SELECT COUNT(*) as total FROM hanshow_esls e
                LEFT JOIN products p ON e.current_product_id = p.id
                WHERE {$whereClause}";
            $total = $db->fetch($countQuery, $params)['total'];

            // ESL listesi
            $query = "SELECT e.*,
                p.name as product_name,
                p.sku as product_sku,
                t.name as template_name
            FROM hanshow_esls e
            LEFT JOIN products p ON e.current_product_id = p.id
            $templateJoin
            WHERE {$whereClause}
            ORDER BY e.updated_at DESC, e.created_at DESC
            LIMIT ? OFFSET ?";

            $params[] = $perPage;
            $params[] = $offset;

            $esls = $db->fetchAll($query, $params);

            Response::success([
                'items' => $esls,
                'pagination' => [
                    'total' => $total,
                    'page' => $page,
                    'per_page' => $perPage,
                    'total_pages' => ceil($total / $perPage)
                ]
            ]);
        }
        break;

    case 'POST':
        // Yeni ESL ekle
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($data['esl_id'])) {
            Response::badRequest('ESL ID gerekli');
        }

        // Ayni ID ile kayit var mi kontrol et
        $existing = $db->fetch(
            "SELECT id FROM hanshow_esls WHERE esl_id = ?",
            [$data['esl_id']]
        );

        if ($existing) {
            Response::conflict('Bu ESL ID zaten kayitli');
        }

        $eslData = [
            'id' => $db->generateUuid(),
            'company_id' => $user['company_id'],
            'esl_id' => $data['esl_id'],
            'firmware_id' => $data['firmware_id'] ?? null,
            'model_name' => $data['model_name'] ?? null,
            'screen_width' => $data['screen_width'] ?? 152,
            'screen_height' => $data['screen_height'] ?? 152,
            'screen_color' => $data['screen_color'] ?? 'BW',
            'screen_type' => $data['screen_type'] ?? 'EPD',
            'max_pages' => $data['max_pages'] ?? 1,
            'has_led' => !empty($data['has_led']),
            'has_magnet' => !empty($data['has_magnet']),
            'sales_no' => $data['sales_no'] ?? null,
            'status' => 'unknown'
        ];

        $db->insert('hanshow_esls', $eslData);

        Response::created($eslData, 'ESL eklendi');
        break;

    case 'PUT':
        if (!$id) {
            Response::badRequest('ESL ID gerekli');
        }

        $esl = $db->fetch(
            "SELECT * FROM hanshow_esls WHERE id = ? AND company_id = ?",
            [$id, $user['company_id']]
        );

        if (!$esl) {
            Response::notFound('ESL bulunamadi');
        }

        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        $updateData = [
            'model_name' => $data['model_name'] ?? $esl['model_name'],
            'screen_width' => $data['screen_width'] ?? $esl['screen_width'],
            'screen_height' => $data['screen_height'] ?? $esl['screen_height'],
            'screen_color' => $data['screen_color'] ?? $esl['screen_color'],
            'screen_type' => $data['screen_type'] ?? $esl['screen_type'],
            'max_pages' => $data['max_pages'] ?? $esl['max_pages'],
            'has_led' => isset($data['has_led']) ? !empty($data['has_led']) : $esl['has_led'],
            'has_magnet' => isset($data['has_magnet']) ? !empty($data['has_magnet']) : $esl['has_magnet'],
            'sales_no' => $data['sales_no'] ?? $esl['sales_no'],
            'updated_at' => date('Y-m-d H:i:s')
        ];

        $db->update('hanshow_esls', $updateData, 'id = ?', [$id]);

        Response::success(array_merge($esl, $updateData), 'ESL guncellendi');
        break;

    case 'DELETE':
        if (!$id) {
            Response::badRequest('ESL ID gerekli');
        }

        $esl = $db->fetch(
            "SELECT * FROM hanshow_esls WHERE id = ? AND company_id = ?",
            [$id, $user['company_id']]
        );

        if (!$esl) {
            Response::notFound('ESL bulunamadi');
        }

        $db->delete('hanshow_esls', 'id = ?', [$id]);

        Response::success(null, 'ESL silindi');
        break;

    default:
        Response::methodNotAllowed('Izin verilmeyen method');
}
