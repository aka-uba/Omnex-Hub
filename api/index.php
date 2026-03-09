<?php
/**
 * Omnex Display Hub - API Entry Point
 *
 * @package OmnexDisplayHub
 */

// Guard against accidental output (BOM/whitespace) in included API files.
// Keep output buffered so headers/json can still be sent safely.
if (ob_get_level() === 0) {
    ob_start();
}

// Load configuration first for PRODUCTION_MODE
require_once dirname(__DIR__) . '/config.php';

// Error reporting based on environment (config.php already sets this, but ensure API consistency)
if (defined('PRODUCTION_MODE') && PRODUCTION_MODE) {
    error_reporting(E_ALL);
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    ini_set('html_errors', 0);
} else {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
    ini_set('log_errors', 1);
    ini_set('html_errors', 0);
}

// Custom error handler to catch all errors
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    // Log the error
    error_log("PHP Error [$errno]: $errstr in $errfile on line $errline");

    header('Content-Type: application/json');
    http_response_code(500);

    $response = ['success' => false];
    if (defined('PRODUCTION_MODE') && PRODUCTION_MODE) {
        $response['message'] = 'Internal server error';
    } else {
        $response['message'] = "PHP Error: $errstr";
        $response['file'] = $errfile;
        $response['line'] = $errline;
        $response['errno'] = $errno;
    }
    echo json_encode($response);
    exit;
});

// Register shutdown function to catch fatal errors
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        // Log the error
        error_log("Fatal Error [{$error['type']}]: {$error['message']} in {$error['file']} on line {$error['line']}");

        if (!headers_sent()) {
            header('Content-Type: application/json');
            http_response_code(500);
        }

        $response = ['success' => false];
        if (defined('PRODUCTION_MODE') && PRODUCTION_MODE) {
            $response['message'] = 'Internal server error';
        } else {
            $response['message'] = 'Fatal Error: ' . $error['message'];
            $response['file'] = $error['file'];
            $response['line'] = $error['line'];
        }
        echo json_encode($response);
    }
});

// HTTPS enforcement in production
if (defined('FORCE_HTTPS') && FORCE_HTTPS) {
    $trustedProxies = ['127.0.0.1', '::1'];
    $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '';
    $isFromTrustedProxy = in_array($remoteAddr, $trustedProxies);

    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');

    // Only trust X-Forwarded-Proto from known proxies
    if ($isFromTrustedProxy && !empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
        $isHttps = $isHttps || ($_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    }

    if (!$isHttps && php_sapi_name() !== 'cli') {
        header('Location: https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'], true, 301);
        exit;
    }
}

// Initialize database and run migrations if needed
try {
    $db = Database::getInstance();
    // Runtime requests should not run schema migrations.
    // Apply migrations explicitly via deployment/maintenance workflow.
} catch (Exception $e) {
    Logger::error('Database initialization failed', ['error' => $e->getMessage()]);
}

// Create router
$router = new Router();
$request = new Request();
$GLOBALS['request'] = $request;  // Global request for API files that use route params

// Keep Docker/monitoring health checks independent from global middleware.
if ($request->getPath() === '/api/health') {
    require API_PATH . '/health.php';
}

// Measure API request duration even when Response::json exits early.
$apiRequestStart = microtime(true);
$apiRequestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$apiRequestUri = $_SERVER['REQUEST_URI'] ?? '/';
register_shutdown_function(function() use ($apiRequestStart, $apiRequestMethod, $apiRequestUri, $request) {
    if (!class_exists('Logger')) {
        return;
    }

    $duration = microtime(true) - $apiRequestStart;
    $path = $request instanceof Request
        ? $request->getPath()
        : (parse_url($apiRequestUri, PHP_URL_PATH) ?: $apiRequestUri);

    Logger::api($apiRequestMethod, $path, http_response_code(), $duration);
});

// Register middleware
$router->registerMiddleware('auth', 'AuthMiddleware');
$router->registerMiddleware('admin', 'AdminMiddleware');
$router->registerMiddleware('rate', 'RateLimitMiddleware');
$router->registerMiddleware('csrf', 'CsrfMiddleware');
$router->registerMiddleware('device', 'DeviceAuthMiddleware');
$router->registerMiddleware('guard', 'ApiGuardMiddleware');
$router->registerMiddleware('sanitize', 'InputSanitizeMiddleware');
$router->registerMiddleware('gateway', 'GatewayAuthMiddleware');
$router->registerMiddleware('license', 'LicenseMiddleware');

// Handle CORS preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ApiGuardMiddleware::handlePreflight();
}

// Apply API Guard and Input Sanitization globally
if (!ApiGuardMiddleware::handle($request)) {
    exit; // Response already sent
}
if (!InputSanitizeMiddleware::handle($request)) {
    exit; // Response already sent
}

// =====================================================
// CSRF Token Route (Public)
// =====================================================
$router->get('/api/csrf-token', function($request) {
    Response::success([
        'token' => CsrfMiddleware::getToken()
    ]);
});

// API Routes

// =====================================================
// Auth Routes (Public)
// =====================================================
$router->group(['prefix' => '/api/auth'], function($router) {
    $router->post('/login', function($request) {
        require API_PATH . '/auth/login.php';
    });

    $router->post('/register', function($request) {
        require API_PATH . '/auth/register.php';
    });

    $router->post('/refresh-token', function($request) {
        require API_PATH . '/auth/refresh-token.php';
    });

    $router->post('/forgot-password', function($request) {
        require API_PATH . '/auth/forgot-password.php';
    });

    $router->post('/reset-password', function($request) {
        require API_PATH . '/auth/reset-password.php';
    });
});

// =====================================================
// Auth Routes (Protected)
// =====================================================
$router->group(['prefix' => '/api/auth', 'middleware' => ['auth']], function($router) {
    $router->get('/session', function($request) {
        require API_PATH . '/auth/session.php';
    });

    $router->post('/logout', function($request) {
        require API_PATH . '/auth/logout.php';
    });

    $router->post('/change-password', function($request) {
        require API_PATH . '/auth/change-password.php';
    });
});

// =====================================================
// User Routes
// =====================================================
$router->group(['prefix' => '/api/users', 'middleware' => ['auth']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/users/index.php';
    });

    // Static routes before dynamic ones
    $router->put('/profile', function($request) {
        require API_PATH . '/users/profile.php';
    });

    $router->post('/upload-avatar', function($request) {
        require API_PATH . '/users/upload-avatar.php';
    });

    // Dynamic routes after static ones
    $router->get('/{id}', function($request) {
        require API_PATH . '/users/show.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/users/create.php';
    });

    $router->put('/{id}', function($request) {
        require API_PATH . '/users/update.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/users/delete.php';
    });
});

// =====================================================
// Product Routes
// =====================================================
$router->group(['prefix' => '/api/products', 'middleware' => ['auth']], function($router) {
    // Static routes MUST come before dynamic /{id} routes
    $router->get('', function($request) {
        require API_PATH . '/products/index.php';
    });

    $router->get('/export', function($request) {
        require API_PATH . '/products/export.php';
    });

    $router->post('/import', function($request) {
        require API_PATH . '/products/import.php';
    });

    $router->post('/import/preview', function($request) {
        require API_PATH . '/products/import-preview.php';
    });

    $router->post('/import/analyze', function($request) {
        require API_PATH . '/products/import-analyze.php';
    });

    $router->get('/groups', function($request) {
        require API_PATH . '/products/groups.php';
    });

    $router->get('/stats', function($request) {
        require API_PATH . '/products/stats.php';
    });

    // Dynamic routes with {id} parameter
    $router->get('/{id}', function($request) {
        require API_PATH . '/products/show.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/products/store.php';
    });

    $router->put('/{id}', function($request) {
        require API_PATH . '/products/update.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/products/delete.php';
    });

    $router->post('/bulk-delete', function($request) {
        require API_PATH . '/products/bulk-delete.php';
    });

    $router->post('/{id}/assign-label', function($request) {
        require API_PATH . '/products/assign-label.php';
    });

    $router->put('/{id}/labels/{labelId}', function($request) {
        require API_PATH . '/products/update-label.php';
    });

    $router->delete('/{id}/labels/{labelId}', function($request) {
        require API_PATH . '/products/remove-label.php';
    });
});

// =====================================================
// Template Routes
// =====================================================
$router->group(['prefix' => '/api/templates', 'middleware' => ['auth']], function($router) {
    // Static routes MUST come before dynamic /{id} routes
    $router->get('', function($request) {
        require API_PATH . '/templates/index.php';
    });

    // Template export - tek veya toplu export
    $router->get('/export', function($request) {
        require API_PATH . '/templates/export.php';
    });

    // Template import - dosya veya JSON import
    $router->post('/import', function($request) {
        require API_PATH . '/templates/import.php';
    });

    // Dynamic routes with {id} parameter
    $router->get('/{id}', function($request) {
        require API_PATH . '/templates/show.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/templates/create.php';
    });

    $router->put('/{id}', function($request) {
        require API_PATH . '/templates/update.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/templates/delete.php';
    });

    // Template render - ürün verileriyle şablonu render et
    $router->post('/{id}/render', function($request) {
        require API_PATH . '/templates/render.php';
    });

    // Template fork - sistem şablonunu firmaya kopyala
    $router->post('/{id}/fork', function($request) {
        require API_PATH . '/templates/fork.php';
    });
});

// =====================================================
// Web Template Routes (VvvebJs HTML Şablonları)
// =====================================================
$router->group(['prefix' => '/api/web-templates', 'middleware' => ['auth', 'csrf']], function($router) {
    // Liste
    $router->get('', function($request) {
        require API_PATH . '/web-templates/index.php';
    });

    // Detay
    $router->get('/{id}', function($request) {
        require API_PATH . '/web-templates/show.php';
    });

    // Oluştur
    $router->post('', function($request) {
        require API_PATH . '/web-templates/create.php';
    });

    // Güncelle
    $router->put('/{id}', function($request) {
        require API_PATH . '/web-templates/update.php';
    });

    // Sil
    $router->delete('/{id}', function($request) {
        require API_PATH . '/web-templates/delete.php';
    });
});

// =====================================================
// Media Routes (Public - No Auth Required)
// =====================================================
// Thumbnail endpoint - accessed via <img src>, no auth needed
$router->get('/api/media/thumbnail', function($request) {
    require API_PATH . '/media/thumbnail.php';
});

// Serve endpoint - accessed via <img src>, no auth needed
$router->get('/api/media/serve', function($request) {
    require API_PATH . '/media/serve.php';
});

// =====================================================
// Media Routes (Protected)
// =====================================================
$router->group(['prefix' => '/api/media', 'middleware' => ['auth']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/media/index.php';
    });

    $router->post('/upload', function($request) {
        require API_PATH . '/media/upload.php';
    });

    $router->post('/scan', function($request) {
        require API_PATH . '/media/scan.php';
    });

    $router->post('/browse', function($request) {
        require API_PATH . '/media/browse.php';
    });

    $router->post('/folders', function($request) {
        require API_PATH . '/media/folders.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/media/delete.php';
    });

    // Admin: diagnose and fix cross-platform path issues
    $router->get('/fix-paths', function($request) {
        require API_PATH . '/media/fix-paths.php';
    });
    $router->post('/fix-paths', function($request) {
        require API_PATH . '/media/fix-paths.php';
    });
});

// =====================================================
// Storage Routes (v2.0.14)
// =====================================================
$router->group(['prefix' => '/api/storage', 'middleware' => ['auth']], function($router) {
    // Get company storage usage
    $router->get('/usage', function($request) {
        require API_PATH . '/storage/usage.php';
    });
});

// Storage Admin Routes (v2.0.14)
$router->group(['prefix' => '/api/storage', 'middleware' => ['auth', 'admin']], function($router) {
    // Recalculate storage usage (disk scan)
    $router->post('/recalculate', function($request) {
        require API_PATH . '/storage/recalculate.php';
    });

    // Get all companies storage overview
    $router->get('/all', function($request) {
        require API_PATH . '/storage/all.php';
    });
});

// =====================================================
// Device Routes
// =====================================================
$router->group(['prefix' => '/api/devices', 'middleware' => ['auth']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/devices/index.php';
    });

    $router->get('/{id}', function($request) {
        require API_PATH . '/devices/show.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/devices/create.php';
    });

    $router->put('/{id}', function($request) {
        require API_PATH . '/devices/update.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/devices/delete.php';
    });

    // Assign playlist to device
    $router->post('/{id}/assign-playlist', function($request) {
        require API_PATH . '/devices/assign-playlist.php';
    });

    // Send command to device (start, stop, refresh, etc.)
    $router->post('/{id}/send-command', function($request) {
        require API_PATH . '/devices/send-command.php';
    });

    // Alias: /command -> /send-command (DeviceDetail.js uyumluluğu için)
    $router->post('/{id}/command', function($request) {
        require API_PATH . '/devices/send-command.php';
    });

    // Direct device control (PavoDisplay ESL: refresh, reboot, clear_memory)
    $router->post('/{id}/control', function($request) {
        require API_PATH . '/devices/control.php';
    });

    // Network configuration (Bluetooth commands for static IP, DHCP, WiFi)
    $router->post('/{id}/network-config', function($request) {
        require API_PATH . '/devices/network-config.php';
    });

    // Network scan for PavoDisplay devices
    $router->post('/scan', function($request) {
        require API_PATH . '/devices/scan.php';
    });

    // Upload device preview image (tenant-compatible)
    $router->post('/{id}/upload-preview', function($request) {
        require API_PATH . '/devices/upload-preview.php';
    });

    // Delete device preview image
    $router->delete('/{id}/preview', function($request) {
        require API_PATH . '/devices/delete-preview.php';
    });

    // Device products - assign/list/remove products from device
    $router->get('/{id}/products', function($request) {
        require API_PATH . '/devices/products.php';
    });

    $router->post('/{id}/products', function($request) {
        require API_PATH . '/devices/products.php';
    });

    $router->delete('/{id}/products/{productId}', function($request) {
        require API_PATH . '/devices/products.php';
    });

    // Device logs
    $router->get('/{id}/logs', function($request) {
        require API_PATH . '/devices/logs.php';
    });
});

// =====================================================
// Layout Routes
// =====================================================
$router->group(['prefix' => '/api/layout', 'middleware' => ['auth']], function($router) {
    $router->get('/config', function($request) {
        require API_PATH . '/layout/config.php';
    });

    $router->put('/config', function($request) {
        require API_PATH . '/layout/config.php';
    });

    $router->post('/config', function($request) {
        require API_PATH . '/layout/config.php';
    });

    $router->delete('/config', function($request) {
        require API_PATH . '/layout/config.php';
    });

    $router->get('/menu', function($request) {
        require API_PATH . '/layout/menu.php';
    });
});

// =====================================================
// Settings Routes
// =====================================================
$router->group(['prefix' => '/api/settings', 'middleware' => ['auth']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/settings/index.php';
    });

    $router->put('', function($request) {
        require API_PATH . '/settings/index.php';
    });

    $router->post('/test-smtp', function($request) {
        require API_PATH . '/settings/test-smtp.php';
    });

    // Default images for ESL devices
    $router->get('/default-images', function($request) {
        require API_PATH . '/settings/default-images.php';
    });

    $router->post('/default-images', function($request) {
        require API_PATH . '/settings/default-images.php';
    });

    $router->delete('/default-images/{filename}', function($request) {
        require API_PATH . '/settings/default-images.php';
    });
});

// =====================================================
// Branding Routes
// =====================================================
$router->group(['prefix' => '/api/branding', 'middleware' => ['auth']], function($router) {
    $router->post('/upload', function($request) {
        require API_PATH . '/branding/upload.php';
    });
});

// =====================================================
// Reports Routes
// =====================================================
$router->group(['prefix' => '/api/reports', 'middleware' => ['auth']], function($router) {
    $router->get('/dashboard-stats', function($request) {
        require API_PATH . '/reports/dashboard-stats.php';
    });

    $router->get('/recent-activities', function($request) {
        require API_PATH . '/reports/recent-activities.php';
    });

    $router->get('/device-activity', function($request) {
        require API_PATH . '/reports/device-activity.php';
    });

    $router->get('/export', function($request) {
        require API_PATH . '/reports/export.php';
    });
});

// =====================================================
// Categories Routes
// =====================================================
$router->group(['prefix' => '/api/categories', 'middleware' => ['auth']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/categories/index.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/categories/create.php';
    });

    $router->put('/{id}', function($request) {
        require API_PATH . '/categories/update.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/categories/delete.php';
    });
});

// =====================================================
// Production Types Routes
// =====================================================
$router->group(['prefix' => '/api/production-types', 'middleware' => ['auth']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/production-types/index.php';
    });

    $router->get('/{id}', function($request) {
        require API_PATH . '/production-types/index.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/production-types/index.php';
    });

    $router->put('/{id}', function($request) {
        require API_PATH . '/production-types/index.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/production-types/index.php';
    });
});

// =====================================================
// Label Sizes Routes
// =====================================================
$router->group(['prefix' => '/api/label-sizes', 'middleware' => ['auth']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/label-sizes/index.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/label-sizes/create.php';
    });

    $router->put('/{id}', function($request) {
        require API_PATH . '/label-sizes/update.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/label-sizes/delete.php';
    });
});

// =====================================================
// Playlists Routes
// =====================================================
$router->group(['prefix' => '/api/playlists', 'middleware' => ['auth']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/playlists/index.php';
    });

    $router->get('/{id}', function($request) {
        require API_PATH . '/playlists/show.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/playlists/create.php';
    });

    $router->put('/{id}', function($request) {
        require API_PATH . '/playlists/update.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/playlists/delete.php';
    });

    $router->post('/{id}/assign-devices', function($request) {
        require API_PATH . '/playlists/assign-devices.php';
    });
});

// =====================================================
// Signage Device Tree Routes
// =====================================================
$router->group(['prefix' => '/api/signage', 'middleware' => ['auth']], function($router) {
    $router->get('/devices-tree', function($request) {
        require API_PATH . '/signage/devices-tree.php';
    });
});

// =====================================================
// Schedules Routes
// =====================================================
$router->group(['prefix' => '/api/schedules', 'middleware' => ['auth']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/schedules/index.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/schedules/create.php';
    });

    $router->put('/{id}', function($request) {
        require API_PATH . '/schedules/update.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/schedules/delete.php';
    });
});

// =====================================================
// Companies Routes (Admin)
// =====================================================
$router->group(['prefix' => '/api/companies', 'middleware' => ['auth', 'admin']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/companies/index.php';
    });

    // Static routes before dynamic ones
    $router->post('/upload-branding', function($request) {
        require API_PATH . '/companies/upload-branding.php';
    });

    $router->post('/cleanup-temp', function($request) {
        require API_PATH . '/companies/cleanup-temp.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/companies/create.php';
    });

    // Dynamic routes after static ones
    $router->get('/{id}', function($request) {
        require API_PATH . '/companies/show.php';
    });

    $router->put('/{id}', function($request) {
        require API_PATH . '/companies/update.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/companies/delete.php';
    });
});

// =====================================================
// Licenses Routes (Admin)
// =====================================================
$router->group(['prefix' => '/api/licenses', 'middleware' => ['auth', 'admin']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/licenses/index.php';
    });

    $router->get('/{id}', function($request) {
        require API_PATH . '/licenses/show.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/licenses/create.php';
    });

    $router->put('/{id}', function($request) {
        require API_PATH . '/licenses/update.php';
    });

    $router->post('/{id}/revoke', function($request) {
        require API_PATH . '/licenses/revoke.php';
    });

    $router->get('/{id}/device-pricing', function($request) {
        require API_PATH . '/licenses/device-pricing.php';
    });

    $router->put('/{id}/device-pricing', function($request) {
        require API_PATH . '/licenses/device-pricing.php';
    });
});

// =====================================================
// Tenant Backup Routes (Admin)
// =====================================================
$router->group(['prefix' => '/api/tenant-backup', 'middleware' => ['auth', 'admin']], function($router) {
    $router->get('/settings', function($request) {
        require API_PATH . '/tenant-backup/settings.php';
    });

    $router->put('/settings', function($request) {
        require API_PATH . '/tenant-backup/update-settings.php';
    });

    $router->get('/list', function($request) {
        require API_PATH . '/tenant-backup/list.php';
    });

    $router->post('/export', function($request) {
        require API_PATH . '/tenant-backup/export.php';
    });

    $router->post('/import', function($request) {
        require API_PATH . '/tenant-backup/import.php';
    });

    $router->get('/table-groups', function($request) {
        require API_PATH . '/tenant-backup/table-groups.php';
    });

    $router->post('/peek-manifest', function($request) {
        require API_PATH . '/tenant-backup/peek-manifest.php';
    });

    $router->get('/download/{id}', function($request) {
        require API_PATH . '/tenant-backup/download.php';
    });

    $router->get('/status/{id}', function($request) {
        require API_PATH . '/tenant-backup/status.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/tenant-backup/delete.php';
    });
});

// =====================================================
// Device Groups Routes
// =====================================================
$router->group(['prefix' => '/api/device-groups', 'middleware' => ['auth']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/device-groups/index.php';
    });

    $router->get('/{id}', function($request) {
        require API_PATH . '/device-groups/show.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/device-groups/create.php';
    });

    $router->put('/{id}', function($request) {
        require API_PATH . '/device-groups/update.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/device-groups/delete.php';
    });

    $router->post('/{id}/bulk-action', function($request) {
        require API_PATH . '/device-groups/bulk-action.php';
    });
});

// =====================================================
// Audit Logs Routes (Admin)
// =====================================================
$router->group(['prefix' => '/api/audit-logs', 'middleware' => ['auth', 'admin']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/audit-logs/index.php';
    });

    $router->get('/{id}', function($request) {
        require API_PATH . '/audit-logs/show.php';
    });

    // Archive routes
    $router->get('/archive/stats', function($request) {
        require API_PATH . '/audit-logs/archive.php';
    });

    $router->post('/archive', function($request) {
        require API_PATH . '/audit-logs/archive.php';
    });

    // Delete route (SuperAdmin only - checked in file)
    $router->delete('/delete', function($request) {
        require API_PATH . '/audit-logs/delete.php';
    });

    $router->post('/delete', function($request) {
        require API_PATH . '/audit-logs/delete.php';
    });
});

// =====================================================
// System Status Routes (Admin)
// =====================================================
$router->group(['prefix' => '/api/system', 'middleware' => ['auth', 'admin']], function($router) {
    $router->get('/status', function($request) {
        require API_PATH . '/system/status.php';
    });
});

// =====================================================
// Log Management Routes (SuperAdmin)
// =====================================================
$router->group(['prefix' => '/api/logs', 'middleware' => ['auth', 'admin']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/logs/index.php';
    });

    $router->get('/read', function($request) {
        require API_PATH . '/logs/read.php';
    });

    $router->get('/download', function($request) {
        require API_PATH . '/logs/download.php';
    });

    $router->get('/notify-settings', function($request) {
        require API_PATH . '/logs/notify-settings.php';
    });

    $router->put('/notify-settings', function($request) {
        require API_PATH . '/logs/notify-settings.php';
    });

    $router->post('/cleanup', function($request) {
        require API_PATH . '/logs/cleanup.php';
    });

    $router->post('/send-report', function($request) {
        require API_PATH . '/logs/send-report.php';
    });
});

// =====================================================
// System About Route (All authenticated users)
// =====================================================
$router->group(['prefix' => '/api/system', 'middleware' => ['auth']], function($router) {
    $router->get('/about', function($request) {
        require API_PATH . '/system/about.php';
    });
});

// =====================================================
// Schedules Show Route (missing)
// =====================================================
$router->group(['prefix' => '/api/schedules', 'middleware' => ['auth']], function($router) {
    $router->get('/{id}', function($request) {
        require API_PATH . '/schedules/show.php';
    });
});

// =====================================================
// Notifications Routes
// =====================================================
$router->group(['prefix' => '/api/notifications', 'middleware' => ['auth']], function($router) {
    // Static routes MUST come before dynamic /{id} routes
    $router->get('', function($request) {
        require API_PATH . '/notifications/index.php';
    });

    $router->get('/unread-count', function($request) {
        require API_PATH . '/notifications/unread-count.php';
    });

    $router->get('/settings', function($request) {
        require API_PATH . '/notifications/settings.php';
    });

    $router->put('/settings', function($request) {
        require API_PATH . '/notifications/settings.php';
    });

    $router->put('/mark-all-read', function($request) {
        // Set the id param to 'mark-all-read' for the handler
        $request->setRouteParam('id', 'mark-all-read');
        require API_PATH . '/notifications/mark-read.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/notifications/create.php';
    });

    // Dynamic routes with {id} parameter
    $router->get('/{id}', function($request) {
        require API_PATH . '/notifications/read.php';
    });

    $router->put('/{id}/read', function($request) {
        require API_PATH . '/notifications/mark-read.php';
    });

    $router->put('/{id}/archive', function($request) {
        require API_PATH . '/notifications/archive.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/notifications/delete.php';
    });
});

// =====================================================
// ESL Device API Routes (Public + Device Auth)
// =====================================================

// Public ESL routes (no auth required)
$router->group(['prefix' => '/api/esl'], function($router) {
    // Device registration - returns sync code
    $router->post('/register', function($request) {
        require API_PATH . '/esl/register.php';
    });
});

// ESL Device authenticated routes (Device token required)
$router->group(['prefix' => '/api/esl', 'middleware' => ['device']], function($router) {
    // Heartbeat/ping - status update
    $router->post('/ping', function($request) {
        require API_PATH . '/esl/ping.php';
    });

    // Get device configuration
    $router->get('/config', function($request) {
        require API_PATH . '/esl/config.php';
    });

    // Content synchronization
    $router->get('/content', function($request) {
        require API_PATH . '/esl/content.php';
    });

    // Device logging
    $router->post('/log', function($request) {
        require API_PATH . '/esl/log.php';
    });

    // Device alerts
    $router->post('/alert', function($request) {
        require API_PATH . '/esl/alert.php';
    });
});

// ESL Admin routes (User auth required)
$router->group(['prefix' => '/api/esl', 'middleware' => ['auth']], function($router) {
    // List pending device registrations
    $router->get('/pending', function($request) {
        require API_PATH . '/esl/pending.php';
    });

    // Approve device registration
    $router->post('/approve', function($request) {
        require API_PATH . '/esl/approve.php';
    });

    // Reject device registration
    $router->post('/reject', function($request) {
        require API_PATH . '/esl/reject.php';
    });

    // Delete pending sync request
    $router->delete('/pending/{id}', function($request) {
        require API_PATH . '/esl/delete-pending.php';
    });
});

// =====================================================
// MQTT ESL Routes (Public + User Auth)
// =====================================================

// MQTT device routes (public - sign auth, no JWT required)
$router->group(['prefix' => '/api/esl/mqtt'], function($router) {
    // Device registration - MQTT mode initial handshake
    $router->post('/register', function($request) {
        require API_PATH . '/esl/mqtt/register.php';
    });

    // Device status report (heartbeat)
    $router->post('/report', function($request) {
        require API_PATH . '/esl/mqtt/report.php';
    });

    // Content synchronization
    $router->get('/content', function($request) {
        require API_PATH . '/esl/mqtt/content.php';
    });

    // Content sync via POST (some devices send POST)
    $router->post('/content', function($request) {
        require API_PATH . '/esl/mqtt/content.php';
    });
});

// =====================================================
// ESL HTTP Client Routes (Public - sign auth, no JWT required)
// HTTP modundaki cihazlar bu endpoint'leri kullanır (PULL mekanizması)
// =====================================================

$router->group(['prefix' => '/api/esl/http'], function($router) {
    // Content synchronization - cihaz içerik çeker (GET + POST)
    $router->get('/content', function($request) {
        require API_PATH . '/esl/http/content.php';
    });

    $router->post('/content', function($request) {
        require API_PATH . '/esl/http/content.php';
    });

    // Device info reporting - cihaz bilgilerini raporlar
    $router->post('/report-info', function($request) {
        require API_PATH . '/esl/http/report-info.php';
    });

    // GET ile de report-info destekle (bazı firmware'ler GET kullanır)
    $router->get('/report-info', function($request) {
        require API_PATH . '/esl/http/report-info.php';
    });
});

// MQTT admin routes (user auth required)
$router->group(['prefix' => '/api/esl/mqtt', 'middleware' => ['auth']], function($router) {
    // Get MQTT settings
    $router->get('/settings', function($request) {
        require API_PATH . '/esl/mqtt/settings.php';
    });

    // Update MQTT settings
    $router->put('/settings', function($request) {
        require API_PATH . '/esl/mqtt/settings-update.php';
    });

    // Test broker connection
    $router->post('/test', function($request) {
        require API_PATH . '/esl/mqtt/test-connection.php';
    });
});

// =====================================================
// PWA Player Routes (Public + Device Auth)
// =====================================================

// Public routes (no auth required)
$router->group(['prefix' => '/api/player'], function($router) {
    // Device registration - returns sync code
    $router->post('/register', function($request) {
        require API_PATH . '/player/register.php';
    });

    // Verify sync code - PWA polls this for approval
    $router->get('/verify', function($request) {
        require API_PATH . '/player/verify.php';
    });
});

// Device authenticated routes
$router->group(['prefix' => '/api/player', 'middleware' => ['device']], function($router) {
    // Player initialization - get playlist, template, items
    $router->get('/init', function($request) {
        require API_PATH . '/player/init.php';
    });

    // Get active content for device
    $router->get('/content', function($request) {
        require API_PATH . '/player/content.php';
    });

    // Content sync - check for updates since timestamp
    $router->get('/sync', function($request) {
        require API_PATH . '/player/sync.php';
    });

    // Heartbeat - status update and get commands
    $router->post('/heartbeat', function($request) {
        require API_PATH . '/player/heartbeat.php';
    });

    // Command acknowledge - mark command as completed
    $router->post('/command-ack', function($request) {
        require API_PATH . '/player/command-ack.php';
    });
});

// =====================================================
// Stream Mode Routes (HLS Signage - VLC/IPTV)
// =====================================================

// Public stream endpoints (token-based auth, no middleware)
$router->group(['prefix' => '/api/stream'], function($router) {
    // HLS master playlist (adaptive)
    $router->get('/{token}/master.m3u8', function($request) {
        require API_PATH . '/stream/master.php';
    });

    // Variant playlist (specific quality profile)
    $router->get('/{token}/variant/{profile}/playlist.m3u8', function($request) {
        require API_PATH . '/stream/variant.php';
    });

    // Segment serving (.ts files)
    $router->get('/{token}/segment/{mediaId}/{profile}/{filename}', function($request) {
        require API_PATH . '/stream/segment.php';
    });

    // Optional heartbeat for stream devices
    $router->get('/{token}/heartbeat', function($request) {
        require API_PATH . '/stream/heartbeat.php';
    });
});

// Stream management (user auth - admin panel)
$router->group(['prefix' => '/api/stream', 'middleware' => ['auth']], function($router) {
    // Stream device info & metrics
    $router->get('/{deviceId}/info', function($request) {
        require API_PATH . '/stream/info.php';
    });
});

// Transcode queue management (user auth)
$router->group(['prefix' => '/api/transcode', 'middleware' => ['auth']], function($router) {
    // List transcode jobs
    $router->get('', function($request) {
        require API_PATH . '/transcode/index.php';
    });

    // Enqueue new transcode job
    $router->post('', function($request) {
        require API_PATH . '/transcode/enqueue.php';
    });

    // Get job status
    $router->get('/{id}/status', function($request) {
        require API_PATH . '/transcode/status.php';
    });
});

// =====================================================
// ESL Gateway Routes (Direct device communication)
// =====================================================

$router->group(['prefix' => '/api/esl-gateway', 'middleware' => ['auth']], function($router) {
    // Ping device - check online status
    $router->get('/ping', function($request) {
        require API_PATH . '/esl-gateway/ping.php';
    });

    // Sync product to device
    $router->post('/sync', function($request) {
        require API_PATH . '/esl-gateway/sync.php';
    });

    // Scan network for devices (admin only - role check in file)
    $router->get('/scan', function($request) {
        require API_PATH . '/esl-gateway/scan.php';
    });

    // Demo sync
    $router->post('/sync-demo', function($request) {
        require API_PATH . '/esl-gateway/sync-demo.php';
    });

    // Sync with client ID (APK method simulation)
    $router->post('/sync-with-client', function($request) {
        require API_PATH . '/esl-gateway/sync-with-client.php';
    });

    // Sync via Bluetooth (WiFi + Bluetooth combination)
    $router->post('/sync-bluetooth', function($request) {
        require API_PATH . '/esl-gateway/sync-bluetooth.php';
    });

    // Sync like APK (mimics APK's sync button behavior)
    $router->post('/sync-like-apk', function($request) {
        require API_PATH . '/esl-gateway/sync-like-apk.php';
    });

    // Upload file to device
    $router->post('/upload', function($request) {
        require API_PATH . '/esl-gateway/upload.php';
    });

    // Check file on device
    $router->get('/check', function($request) {
        require API_PATH . '/esl-gateway/check.php';
    });

    // Start HTTP monitoring snapshot
    $router->get('/start-monitoring', function($request) {
        require API_PATH . '/esl-gateway/start-monitoring.php';
    });

    $router->post('/start-monitoring', function($request) {
        require API_PATH . '/esl-gateway/start-monitoring.php';
    });

});

// =====================================================
// Local Gateway API Routes (Gateway Agent Authentication)
// =====================================================

// Public gateway routes (registration with user auth)
$router->group(['prefix' => '/api/gateway'], function($router) {
    // Gateway registration - requires user login for first registration
    $router->post('/register', function($request) {
        require API_PATH . '/gateway/register.php';
    });
});

// Gateway authenticated routes (API key auth)
$router->group(['prefix' => '/api/gateway', 'middleware' => ['gateway']], function($router) {
    // Heartbeat - status update and get pending commands
    $router->post('/heartbeat', function($request) {
        require API_PATH . '/gateway/heartbeat.php';
    });

    // Report command result
    $router->post('/command-result', function($request) {
        require API_PATH . '/gateway/command-result.php';
    });

    // Device sync - list and sync local devices
    $router->get('/devices', function($request) {
        require API_PATH . '/gateway/devices.php';
    });

    $router->post('/devices', function($request) {
        require API_PATH . '/gateway/devices.php';
    });

    $router->post('/devices/sync', function($request) {
        require API_PATH . '/gateway/devices.php';
    });

    // Register discovered devices from gateway scan
    $router->post('/devices/register', function($request) {
        require API_PATH . '/gateway/devices-register.php';
    });
});

// Gateway admin routes (User auth required) - manage gateways from panel
$router->group(['prefix' => '/api/gateways', 'middleware' => ['auth']], function($router) {
    // List company gateways
    $router->get('', function($request) {
        require API_PATH . '/gateways/index.php';
    });

    // Get single gateway
    $router->get('/{id}', function($request) {
        require API_PATH . '/gateways/show.php';
    });

    // Create gateway (manual)
    $router->post('', function($request) {
        require API_PATH . '/gateways/create.php';
    });

    // Update gateway
    $router->put('/{id}', function($request) {
        require API_PATH . '/gateways/update.php';
    });

    // Delete gateway
    $router->delete('/{id}', function($request) {
        require API_PATH . '/gateways/delete.php';
    });

    // Send command to gateway
    $router->post('/{id}/command', function($request) {
        require API_PATH . '/gateways/send-command.php';
    });

    // Get gateway devices
    $router->get('/{id}/devices', function($request) {
        require API_PATH . '/gateways/devices.php';
    });
});

// =====================================================
// Hanshow ESL Integration Routes
// =====================================================

// Hanshow callback endpoint (no auth - called by ESL-Working)
$router->group(['prefix' => '/api/hanshow'], function($router) {
    // Callback from ESL-Working async operations
    $router->post('/callback', function($request) {
        require API_PATH . '/hanshow/callback.php';
    });
});

// Hanshow protected routes
$router->group(['prefix' => '/api/hanshow', 'middleware' => ['auth']], function($router) {
    // ESL-Working connection test
    $router->get('/ping', function($request) {
        require API_PATH . '/hanshow/ping.php';
    });

    // AP (Gateway) list from ESL-Working
    $router->get('/aps', function($request) {
        require API_PATH . '/hanshow/aps.php';
    });

    // Scan/Discover ESLs from ESL-Working
    $router->get('/scan', function($request) {
        require API_PATH . '/hanshow/scan.php';
    });

    // Lookup single ESL by ID/Barcode
    $router->get('/lookup', function($request) {
        require API_PATH . '/hanshow/lookup.php';
    });

    // Register/Bind ESL to ESL-Working by barcode
    $router->post('/register', function($request) {
        require API_PATH . '/hanshow/register.php';
    });

    // ESL device management
    $router->get('/esls', function($request) {
        require API_PATH . '/hanshow/esls.php';
    });
    $router->get('/esls/{id}', function($request) {
        require API_PATH . '/hanshow/esls.php';
    });
    $router->post('/esls', function($request) {
        require API_PATH . '/hanshow/esls.php';
    });
    $router->put('/esls/{id}', function($request) {
        require API_PATH . '/hanshow/esls.php';
    });
    $router->delete('/esls/{id}', function($request) {
        require API_PATH . '/hanshow/esls.php';
    });

    // Send design to ESL
    $router->post('/send', function($request) {
        require API_PATH . '/hanshow/send.php';
    });

    // Firmware list
    $router->get('/firmwares', function($request) {
        require API_PATH . '/hanshow/firmwares.php';
    });

    // LED control
    $router->post('/control/led', function($request) {
        require API_PATH . '/hanshow/control.php';
    });

    // Page switch
    $router->post('/control/page', function($request) {
        require API_PATH . '/hanshow/control.php';
    });

    // Settings
    $router->get('/settings', function($request) {
        require API_PATH . '/hanshow/settings.php';
    });
    $router->put('/settings', function($request) {
        require API_PATH . '/hanshow/settings.php';
    });
    $router->delete('/settings', function($request) {
        require API_PATH . '/hanshow/settings.php';
    });
});

// =====================================================
// TAMSOFT ERP Routes
// =====================================================
$router->group(['prefix' => '/api/tamsoft', 'middleware' => ['auth']], function($router) {
    // Settings
    $router->get('/settings', function($request) {
        require API_PATH . '/tamsoft/settings.php';
    });
    $router->put('/settings', function($request) {
        require API_PATH . '/tamsoft/settings.php';
    });

    // Connection test
    $router->get('/test', function($request) {
        require API_PATH . '/tamsoft/test.php';
    });

    // Depolar (Warehouses)
    $router->get('/depolar', function($request) {
        require API_PATH . '/tamsoft/depolar.php';
    });

    // Sync
    $router->get('/sync', function($request) {
        require API_PATH . '/tamsoft/sync.php';
    });
    $router->post('/sync', function($request) {
        require API_PATH . '/tamsoft/sync.php';
    });

    // Stok Detay
    $router->get('/stok-detay', function($request) {
        require API_PATH . '/tamsoft/stok-detay.php';
    });

    // Debug - SuperAdmin only
    $router->get('/debug-stok', function($request) {
        require API_PATH . '/tamsoft/debug-stok.php';
    });
});

// =====================================================
// SMTP Routes (Email Integration)
// =====================================================
$router->group(['prefix' => '/api/smtp', 'middleware' => ['auth']], function($router) {
    // Settings (3-level config: system -> company)
    $router->get('/settings', function($request) {
        require API_PATH . '/smtp/settings.php';
    });
    $router->put('/settings', function($request) {
        require API_PATH . '/smtp/settings.php';
    });
    $router->delete('/settings', function($request) {
        require API_PATH . '/smtp/settings.php';
    });
});

// =====================================================
// Integration Settings Routes (ERP, POS, WMS, API)
// =====================================================
$router->group(['prefix' => '/api/integrations', 'middleware' => ['auth']], function($router) {
    // Settings (3-level config: system -> company)
    $router->get('/settings', function($request) {
        require API_PATH . '/integrations/settings.php';
    });
    $router->put('/settings', function($request) {
        require API_PATH . '/integrations/settings.php';
    });
    $router->delete('/settings', function($request) {
        require API_PATH . '/integrations/settings.php';
    });
});

// =====================================================
// Payment Routes (Iyzico + Paynet)
// =====================================================

// Public routes (no auth)
$router->group(['prefix' => '/api/payments'], function($router) {
    // License plans list (no auth needed for pricing display)
    $router->get('/plans', function($request) {
        require API_PATH . '/payments/plans.php';
    });

    // 3D Secure callback (no auth - called by Iyzico)
    $router->post('/callback', function($request) {
        require API_PATH . '/payments/callback.php';
    });
    $router->get('/callback', function($request) {
        require API_PATH . '/payments/callback.php';
    });
    $router->post('/callback-paynet', function($request) {
        require API_PATH . '/payments/callback-paynet.php';
    });
    $router->get('/callback-paynet', function($request) {
        require API_PATH . '/payments/callback-paynet.php';
    });
});

// Protected routes (requires auth)
$router->group(['prefix' => '/api/payments', 'middleware' => ['auth']], function($router) {
    // Payment operations
    $router->post('/init', function($request) {
        require API_PATH . '/payments/init.php';
    });
    $router->post('/installments', function($request) {
        require API_PATH . '/payments/installments.php';
    });
    $router->get('/status/{id}', function($request) {
        require API_PATH . '/payments/status.php';
    });
    $router->get('/history', function($request) {
        require API_PATH . '/payments/history.php';
    });

    // Settings (auth check, role check inside)
    $router->get('/settings', function($request) {
        require API_PATH . '/payments/settings.php';
    });
    $router->put('/settings', function($request) {
        require API_PATH . '/payments/settings.php';
    });

    // Connection test
    $router->get('/ping', function($request) {
        require API_PATH . '/payments/ping.php';
    });

    // License plans CRUD (Admin only)
    $router->get('/license-plans', function($request) {
        require API_PATH . '/payments/license-plans.php';
    });
    $router->get('/license-plans/{id}', function($request) {
        require API_PATH . '/payments/license-plans.php';
    });
    $router->post('/license-plans', function($request) {
        require API_PATH . '/payments/license-plans.php';
    });
    $router->put('/license-plans/{id}', function($request) {
        require API_PATH . '/payments/license-plans.php';
    });
    $router->delete('/license-plans/{id}', function($request) {
        require API_PATH . '/payments/license-plans.php';
    });
});

// =====================================================
// Render Cache Routes (Arka Plan Render Sistemi)
// =====================================================
$router->group(['prefix' => '/api/render-cache', 'middleware' => ['auth']], function($router) {
    // Liste ve istatistikler
    $router->get('', function($request) {
        require API_PATH . '/render-cache/index.php';
    });

    // Toplu gönderim öncesi cache durumu kontrolü
    $router->post('/check', function($request) {
        require API_PATH . '/render-cache/check.php';
    });

    // Render job işleme (frontend'den çağrılır)
    $router->get('/process', function($request) {
        require API_PATH . '/render-cache/process.php';
    });

    // Render sonucunu kaydet
    $router->post('/process', function($request) {
        require API_PATH . '/render-cache/process.php';
    });
});

// =====================================================
// Render Queue Routes (Phase 2)
// =====================================================
$router->group(['prefix' => '/api/render-queue', 'middleware' => ['auth']], function($router) {
    // Liste ve istatistikler
    $router->get('', function($request) {
        require API_PATH . '/render-queue/index.php';
    });

    // Kuyruk analitiği (Operational Visibility)
    $router->get('/analytics', function($request) {
        require API_PATH . '/render-queue/analytics.php';
    });

    // Yeni job oluştur
    $router->post('', function($request) {
        require API_PATH . '/render-queue/create.php';
    });

    // Otomatik toplu gönderim (pre-assigned products)
    $router->post('/auto', function($request) {
        require API_PATH . '/render-queue/auto.php';
    });

    // Eski kayıtları temizle (admin only)
    $router->post('/cleanup', function($request) {
        require API_PATH . '/render-queue/cleanup.php';
    });

    // Bekleyen işleri işle (worker alternatifi)
    $router->post('/process', function($request) {
        require API_PATH . '/render-queue/process.php';
    });

    // Batch retry (grup)
    $router->post('/batch/{batchId}/retry', function($request) {
        require API_PATH . '/render-queue/retry-batch.php';
    });

    // Job durumu
    $router->get('/{id}/status', function($request) {
        require API_PATH . '/render-queue/status.php';
    });

    // Job iptal
    $router->post('/{id}/cancel', function($request) {
        require API_PATH . '/render-queue/cancel.php';
    });

    // Job retry
    $router->post('/{id}/retry', function($request) {
        require API_PATH . '/render-queue/retry.php';
    });

    // Job reschedule (zamanlama değiştir veya hemen başlat)
    $router->post('/{id}/reschedule', function($request) {
        require API_PATH . '/render-queue/reschedule.php';
    });

    // Job silme (tek)
    $router->delete('/{id}', function($request) {
        require API_PATH . '/render-queue/delete.php';
    });

    // Job silme (POST alternatifi)
    $router->post('/{id}/delete', function($request) {
        require API_PATH . '/render-queue/delete.php';
    });

    // Toplu silme
    $router->post('/bulk-delete', function($request) {
        require API_PATH . '/render-queue/delete.php';
    });
});

// =====================================================
// Web Proxy Routes (For iframe content)
// =====================================================

$router->group(['prefix' => '/api/proxy', 'middleware' => ['auth']], function($router) {
    // Fetch external web page for iframe display
    $router->get('/fetch', function($request) {
        require API_PATH . '/proxy/fetch.php';
    });
});

// =====================================================
// Branch Routes (v2.0.18 - Şube/Bölge Sistemi)
// =====================================================

$router->group(['prefix' => '/api/branches', 'middleware' => ['auth']], function($router) {
    // Liste - şube listesi (hiyerarşi, istatistik opsiyonel)
    $router->get('', function($request) {
        require API_PATH . '/branches/index.php';
    });

    // Static routes before dynamic
    // Override yönetimi
    $router->get('/overrides', function($request) {
        require API_PATH . '/branches/overrides.php';
    });

    $router->post('/overrides', function($request) {
        require API_PATH . '/branches/overrides.php';
    });

    $router->put('/overrides', function($request) {
        require API_PATH . '/branches/overrides.php';
    });

    $router->delete('/overrides', function($request) {
        require API_PATH . '/branches/overrides.php';
    });

    // Fiyat çözümleme
    $router->get('/prices', function($request) {
        require API_PATH . '/branches/prices.php';
    });

    $router->post('/prices', function($request) {
        require API_PATH . '/branches/prices.php';
    });

    // Şube import
    $router->post('/import', function($request) {
        require API_PATH . '/branches/import.php';
    });

    $router->post('/import/preview', function($request) {
        require API_PATH . '/branches/import.php';
    });

    // Kullanıcı erişim yönetimi
    $router->get('/access', function($request) {
        require API_PATH . '/branches/access.php';
    });

    $router->post('/access', function($request) {
        require API_PATH . '/branches/access.php';
    });

    $router->put('/access', function($request) {
        require API_PATH . '/branches/access.php';
    });

    $router->delete('/access', function($request) {
        require API_PATH . '/branches/access.php';
    });

    // Dynamic routes with {id}
    $router->get('/{id}', function($request) {
        require API_PATH . '/branches/show.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/branches/create.php';
    });

    $router->put('/{id}', function($request) {
        require API_PATH . '/branches/update.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/branches/delete.php';
    });
});

// =====================================================
// HAL Künye Sorgulama Routes
// =====================================================

$router->group(['prefix' => '/api/hal', 'middleware' => ['auth']], function($router) {
    // Ayarlar
    $router->get('/settings', function($request) {
        require API_PATH . '/hal/settings.php';
    });

    $router->put('/settings', function($request) {
        require API_PATH . '/hal/settings.php';
    });

    // Bağlantı testi
    $router->get('/test', function($request) {
        require API_PATH . '/hal/test.php';
    });

    // Tek künye sorgulama
    $router->get('/query', function($request) {
        require API_PATH . '/hal/query.php';
    });

    $router->post('/query', function($request) {
        require API_PATH . '/hal/query.php';
    });

    // Toplu künye sorgulama
    $router->post('/bulk-query', function($request) {
        require API_PATH . '/hal/bulk-query.php';
    });

    // HAL veri CRUD (GET/POST/DELETE)
    $router->get('/data', function($request) {
        require API_PATH . '/hal/data.php';
    });

    $router->post('/data', function($request) {
        require API_PATH . '/hal/data.php';
    });

    $router->delete('/data', function($request) {
        require API_PATH . '/hal/data.php';
    });

    // Bildirim listesi sorgulama
    $router->get('/bildirimler', function($request) {
        require API_PATH . '/hal/bildirimler.php';
    });

    // Künye dağıtım
    $router->post('/distribute', function($request) {
        require API_PATH . '/hal/distribute.php';
    });
});

// =====================================================
// Setup Wizard Routes (Admin Only)
// =====================================================

$router->group(['prefix' => '/api/setup', 'middleware' => ['auth', 'admin']], function($router) {
    // Sistem durumu - kategori, ürün, üretim tipi sayıları
    $router->get('/status', function($request) {
        require API_PATH . '/setup/status.php';
    });

    // Seed işlemi başlat
    $router->post('/seed', function($request) {
        require API_PATH . '/setup/seed.php';
    });
});

// =====================================================
// Bundle/Paket Routes
// =====================================================
$router->group(['prefix' => '/api/bundles', 'middleware' => ['auth']], function($router) {
    $router->get('', function($request) {
        require API_PATH . '/bundles/index.php';
    });

    $router->get('/export', function($request) {
        require API_PATH . '/bundles/export.php';
    });

    $router->post('', function($request) {
        require API_PATH . '/bundles/store.php';
    });

    $router->get('/{id}', function($request) {
        require API_PATH . '/bundles/show.php';
    });

    $router->put('/{id}', function($request) {
        require API_PATH . '/bundles/update.php';
    });

    $router->delete('/{id}', function($request) {
        require API_PATH . '/bundles/delete.php';
    });
});

// =====================================================
// ERP Import Routes (File-based import)
// =====================================================

// Public endpoint: ERP systems push files via API key (no session auth)
$router->post('/api/import/upload', function($request) {
    require API_PATH . '/import/upload.php';
});

// Protected endpoints: Import settings, history, files
$router->group(['prefix' => '/api/import', 'middleware' => ['auth']], function($router) {
    $router->get('/settings', function($request) {
        require API_PATH . '/import/settings.php';
    });
    $router->put('/settings', function($request) {
        require API_PATH . '/import/settings.php';
    });
    $router->get('/history', function($request) {
        require API_PATH . '/import/history.php';
    });
    $router->get('/files', function($request) {
        require API_PATH . '/import/files.php';
    });
    $router->post('/files/import', function($request) {
        require API_PATH . '/import/files.php';
    });
});

// Dispatch request
try {
    $router->dispatch($request);

} catch (Exception $e) {
    if (class_exists('Logger')) {
        Logger::error('API Error', [
            'path' => $request->getPath(),
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
    }

    $response = ['success' => false];
    if (defined('PRODUCTION_MODE') && PRODUCTION_MODE) {
        $response['message'] = 'Internal server error';
        error_log("API Exception: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");
    } else {
        $response['message'] = $e->getMessage();
        $response['file'] = $e->getFile();
        $response['line'] = $e->getLine();
    }
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode($response);
} catch (Error $e) {
    // Catch fatal errors too
    header('Content-Type: application/json');
    http_response_code(500);

    $response = ['success' => false];
    if (defined('PRODUCTION_MODE') && PRODUCTION_MODE) {
        $response['message'] = 'Internal server error';
        error_log("Fatal Error: {$e->getMessage()} in {$e->getFile()}:{$e->getLine()}");
    } else {
        $response['message'] = 'Fatal error: ' . $e->getMessage();
        $response['file'] = $e->getFile();
        $response['line'] = $e->getLine();
    }
    echo json_encode($response);
    exit;
}
