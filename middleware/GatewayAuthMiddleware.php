<?php
/**
 * Gateway Authentication Middleware
 *
 * Gateway API isteklerini dogrular.
 * API Key + Timestamp + Signature zorunludur.
 */

class GatewayAuthMiddleware
{
    private static ?array $gateway = null;

    /**
     * Handle the request
     */
    public function handle(Request $request, callable $next): void
    {
        $apiKey = $_SERVER['HTTP_X_GATEWAY_KEY'] ?? $request->input('api_key') ?? null;
        $signature = $_SERVER['HTTP_X_GATEWAY_SIGNATURE'] ?? null;
        $timestampRaw = $_SERVER['HTTP_X_GATEWAY_TIMESTAMP'] ?? null;

        if (!$apiKey) {
            Response::json([
                'success' => false,
                'message' => 'Gateway API key gerekli',
                'error_code' => 'MISSING_API_KEY'
            ], 401);
            return;
        }

        if (!$signature || !$timestampRaw) {
            Response::json([
                'success' => false,
                'message' => 'Signature ve timestamp gerekli',
                'error_code' => 'MISSING_SIGNATURE'
            ], 401);
            return;
        }

        if (!ctype_digit((string)$timestampRaw)) {
            Response::json([
                'success' => false,
                'message' => 'Timestamp gecersiz',
                'error_code' => 'INVALID_TIMESTAMP'
            ], 401);
            return;
        }

        $timestamp = (int)$timestampRaw;

        $db = Database::getInstance();
        $gateway = $db->fetch(
            "SELECT * FROM gateways WHERE api_key = ?",
            [$apiKey]
        );

        if (!$gateway) {
            Response::json([
                'success' => false,
                'message' => 'Gecersiz API key',
                'error_code' => 'INVALID_API_KEY'
            ], 401);
            return;
        }

        // Timestamp 5 dakikadan eski/yeni olmamali
        if (abs(time() - $timestamp) > 300) {
            Response::json([
                'success' => false,
                'message' => 'Timestamp gecersiz veya suresi dolmus',
                'error_code' => 'INVALID_TIMESTAMP'
            ], 401);
            return;
        }

        // Signature dogrula: HMAC-SHA256(api_key + timestamp, api_secret)
        $expectedSignature = hash_hmac('sha256', $apiKey . $timestamp, $gateway['api_secret']);
        if (!hash_equals($expectedSignature, $signature)) {
            Response::json([
                'success' => false,
                'message' => 'Gecersiz signature',
                'error_code' => 'INVALID_SIGNATURE'
            ], 401);
            return;
        }

        // Gateway'i sakla
        self::$gateway = $gateway;

        // Son gorulme guncelle
        $db->update('gateways', [
            'last_heartbeat' => date('Y-m-d H:i:s'),
            'public_ip' => $_SERVER['REMOTE_ADDR'] ?? null,
            'status' => 'online'
        ], 'id = ?', [$gateway['id']]);

        // Continue to next middleware/handler
        $next();
    }

    /**
     * Dogrulanmis gateway'i dondur
     */
    public static function gateway(): ?array
    {
        return self::$gateway;
    }

    /**
     * Gateway ID'sini dondur
     */
    public static function gatewayId(): ?string
    {
        return self::$gateway['id'] ?? null;
    }

    /**
     * Company ID'sini dondur
     */
    public static function companyId(): ?string
    {
        return self::$gateway['company_id'] ?? null;
    }
}

