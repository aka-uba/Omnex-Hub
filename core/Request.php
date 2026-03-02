<?php
/**
 * Request - HTTP Request Handler
 *
 * @package OmnexDisplayHub
 */

class Request
{
    private string $method;
    private string $uri;
    private string $path;
    private array $query;
    private array $body;
    private array $headers;
    private array $files;
    private array $routeParams = [];
    private ?string $tenantId = null;

    public function __construct()
    {
        $this->method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $this->uri = $_SERVER['REQUEST_URI'] ?? '/';
        $this->query = $_GET ?? [];
        $this->headers = $this->parseHeaders();
        $this->files = $_FILES ?? [];

        // Parse path dynamically
        // Use BASE_PATH constant set in config.php for accurate base path detection
        $basePath = '';
        if (defined('BASE_PATH')) {
            // Calculate web base path from filesystem BASE_PATH
            $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
            $docRoot = str_replace('\\', '/', rtrim($docRoot, '/\\'));
            $fsBasePath = str_replace('\\', '/', BASE_PATH);

            if ($docRoot && strpos($fsBasePath, $docRoot) === 0) {
                $basePath = substr($fsBasePath, strlen($docRoot));
                $basePath = rtrim($basePath, '/');
            }
        }

        // Fallback: detect from REQUEST_URI by finding /api/ position
        if (!$basePath) {
            $uri = $_SERVER['REQUEST_URI'] ?? '/';
            $path = parse_url($uri, PHP_URL_PATH);

            // If path contains /api/, base path is everything before /api/
            $apiPos = strpos($path, '/api/');
            if ($apiPos !== false) {
                $basePath = substr($path, 0, $apiPos);
            }
        }

        $path = parse_url($this->uri, PHP_URL_PATH);

        // Remove base path from the beginning of the path
        if ($basePath && strpos($path, $basePath) === 0) {
            $path = substr($path, strlen($basePath));
        }

        $this->path = '/' . trim($path, '/');

        // Parse body
        $this->body = $this->parseBody();
    }

    /**
     * Get HTTP method
     */
    public function getMethod(): string
    {
        // Support method override
        $override = $this->header('X-HTTP-Method-Override')
            ?? $this->input('_method');

        if ($override && in_array(strtoupper($override), ['PUT', 'DELETE', 'PATCH'])) {
            return strtoupper($override);
        }

        return $this->method;
    }

    /**
     * Get request path
     */
    public function getPath(): string
    {
        return $this->path;
    }

    /**
     * Get full URI
     */
    public function getUri(): string
    {
        return $this->uri;
    }

    /**
     * Get query parameter
     */
    public function query(string $key, mixed $default = null): mixed
    {
        return $this->query[$key] ?? $default;
    }

    /**
     * Get all query parameters
     */
    public function queryAll(): array
    {
        return $this->query;
    }

    /**
     * Get body input
     */
    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $default;
    }

    /**
     * Get all body inputs
     */
    public function all(): array
    {
        return array_merge($this->query, $this->body);
    }

    /**
     * Get only specific inputs
     */
    public function only(array $keys): array
    {
        $data = $this->all();
        return array_intersect_key($data, array_flip($keys));
    }

    /**
     * Get all except specific inputs
     */
    public function except(array $keys): array
    {
        $data = $this->all();
        return array_diff_key($data, array_flip($keys));
    }

    /**
     * Check if input exists
     */
    public function has(string $key): bool
    {
        return isset($this->body[$key]) || isset($this->query[$key]);
    }

    /**
     * Get JSON body as array
     */
    public function json(): array
    {
        return $this->body;
    }

    /**
     * Get header
     */
    public function header(string $key, mixed $default = null): mixed
    {
        $key = strtolower($key);
        return $this->headers[$key] ?? $default;
    }

    /**
     * Get all headers
     */
    public function headers(): array
    {
        return $this->headers;
    }

    /**
     * Get bearer token from Authorization header
     */
    public function bearerToken(): ?string
    {
        $auth = $this->header('authorization');
        if ($auth && preg_match('/Bearer\s+(.+)$/i', $auth, $matches)) {
            return $matches[1];
        }
        return null;
    }

    /**
     * Get uploaded file
     */
    public function file(string $key): ?array
    {
        return $this->files[$key] ?? null;
    }

    /**
     * Get all uploaded files
     */
    public function files(): array
    {
        return $this->files;
    }

    /**
     * Set route parameter
     */
    public function setRouteParam(string $key, mixed $value): void
    {
        $this->routeParams[$key] = $value;
    }

    /**
     * Get route parameter
     */
    public function routeParam(string $key, mixed $default = null): mixed
    {
        return $this->routeParams[$key] ?? $default;
    }

    /**
     * Get route parameter (alias for routeParam)
     */
    public function getRouteParam(string $key, mixed $default = null): mixed
    {
        return $this->routeParam($key, $default);
    }

    /**
     * Get all route parameters
     */
    public function routeParams(): array
    {
        return $this->routeParams;
    }

    /**
     * Set tenant ID
     */
    public function setTenantId(string $id): void
    {
        $this->tenantId = $id;
    }

    /**
     * Get tenant ID
     */
    public function getTenantId(): ?string
    {
        return $this->tenantId;
    }

    /**
     * Get client IP
     */
    public function ip(): string
    {
        $headers = [
            'HTTP_CF_CONNECTING_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'REMOTE_ADDR'
        ];

        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ip = $_SERVER[$header];
                if (strpos($ip, ',') !== false) {
                    $ip = trim(explode(',', $ip)[0]);
                }
                return $ip;
            }
        }

        return '127.0.0.1';
    }

    /**
     * Get user agent
     */
    public function userAgent(): string
    {
        return $_SERVER['HTTP_USER_AGENT'] ?? '';
    }

    /**
     * Check if AJAX request
     */
    public function isAjax(): bool
    {
        return strtolower($this->header('x-requested-with', '')) === 'xmlhttprequest';
    }

    /**
     * Check if JSON request
     */
    public function isJson(): bool
    {
        $contentType = $this->header('content-type', '');
        return str_contains($contentType, 'application/json');
    }

    /**
     * Check if expecting JSON response
     */
    public function wantsJson(): bool
    {
        $accept = $this->header('accept', '');
        return str_contains($accept, 'application/json');
    }

    /**
     * Parse request headers
     */
    private function parseHeaders(): array
    {
        $headers = [];

        if (function_exists('getallheaders')) {
            foreach (getallheaders() as $key => $value) {
                $headers[strtolower($key)] = $value;
            }
        } else {
            foreach ($_SERVER as $key => $value) {
                if (str_starts_with($key, 'HTTP_')) {
                    $header = strtolower(str_replace('_', '-', substr($key, 5)));
                    $headers[$header] = $value;
                }
            }
        }

        return $headers;
    }

    /**
     * Parse request body
     */
    private function parseBody(): array
    {
        $contentType = $this->header('content-type', '');

        // JSON body
        if (str_contains($contentType, 'application/json')) {
            $raw = file_get_contents('php://input');
            $data = json_decode($raw, true);
            return is_array($data) ? $data : [];
        }

        // Form data
        if ($this->method === 'POST') {
            return $_POST ?? [];
        }

        // PUT/PATCH/DELETE with form data
        if (in_array($this->method, ['PUT', 'PATCH', 'DELETE'])) {
            $raw = file_get_contents('php://input');
            if (str_contains($contentType, 'application/x-www-form-urlencoded')) {
                parse_str($raw, $data);
                return $data;
            }
            $data = json_decode($raw, true);
            return is_array($data) ? $data : [];
        }

        return [];
    }

    /**
     * Get parsed body (alias for json())
     */
    public function body(): array
    {
        return $this->body;
    }

    /**
     * Get query parameter (alias for query())
     */
    public function get(string $key, mixed $default = null): mixed
    {
        return $this->query[$key] ?? $default;
    }
}
