<?php
/**
 * Web Page Proxy - Fetches external pages for iframe display
 * Bypasses X-Frame-Options by serving content from our domain
 *
 * Usage: /api/proxy/fetch.php?url=https://example.com
 */

// Allow from player
header('X-Frame-Options: ALLOWALL');
header_remove('X-Frame-Options');

$url = $_GET['url'] ?? '';

if (empty($url)) {
    http_response_code(400);
    echo '<!DOCTYPE html><html><body style="background:#1a1a2e;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h2>URL Gerekli</h2><p>Lütfen bir URL belirtin</p></div></body></html>';
    exit;
}

// F3.2 - URL Domain Whitelist (SSRF Protection)
$allowedDomains = ['hal.gov.tr', 'www.hal.gov.tr'];
$parsedHostUrl = parse_url($url);
$host = $parsedHostUrl['host'] ?? '';

if (!in_array($host, $allowedDomains)) {
    http_response_code(403);
    echo '<!DOCTYPE html><html><body style="background:#1a1a2e;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h2>Erişim Engellendi</h2><p>Bu domain\'e erişim izni yok</p></div></body></html>';
    exit;
}

// F3.2 - SSRF Protection: Block internal/private IP ranges
$resolvedIp = gethostbyname($host);
if ($resolvedIp === $host) {
    http_response_code(400);
    echo '<!DOCTYPE html><html><body style="background:#1a1a2e;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h2>DNS Hatası</h2><p>Domain çözümlenemedi</p></div></body></html>';
    exit;
}

if (filter_var($resolvedIp, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
    http_response_code(403);
    echo '<!DOCTYPE html><html><body style="background:#1a1a2e;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h2>Erişim Engellendi</h2><p>Dahili IP adreslerine erişim engellendi</p></div></body></html>';
    exit;
}

// Validate URL
if (!filter_var($url, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    echo '<!DOCTYPE html><html><body style="background:#1a1a2e;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h2>Geçersiz URL</h2><p>'.htmlspecialchars($url).'</p></div></body></html>';
    exit;
}

// Only allow http/https
$scheme = parse_url($url, PHP_URL_SCHEME);
if (!in_array($scheme, ['http', 'https'])) {
    http_response_code(400);
    echo '<!DOCTYPE html><html><body style="background:#1a1a2e;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h2>Desteklenmeyen Protokol</h2><p>Sadece HTTP/HTTPS desteklenir</p></div></body></html>';
    exit;
}

// Fetch the page
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_MAXREDIRS => 0,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    CURLOPT_HTTPHEADER => [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language: tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    ]
]);

if (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTP') && defined('CURLPROTO_HTTPS')) {
    curl_setopt($ch, CURLOPT_PROTOCOLS, CURLPROTO_HTTP | CURLPROTO_HTTPS);
}
if (defined('CURLOPT_REDIR_PROTOCOLS') && defined('CURLPROTO_HTTP') && defined('CURLPROTO_HTTPS')) {
    curl_setopt($ch, CURLOPT_REDIR_PROTOCOLS, CURLPROTO_HTTP | CURLPROTO_HTTPS);
}

$content = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$finalUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
$error = curl_error($ch);
curl_close($ch);

if ($error || $httpCode >= 400) {
    http_response_code(502);
    echo '<!DOCTYPE html><html><body style="background:#1a1a2e;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h2>Sayfa Yüklenemedi</h2><p>'.htmlspecialchars($url).'</p><p style="color:#888;">Hata: '.htmlspecialchars($error ?: "HTTP $httpCode").'</p></div></body></html>';
    exit;
}

// Get base URL for relative path conversion
$parsedUrl = parse_url($finalUrl);
$baseUrl = $parsedUrl['scheme'] . '://' . $parsedUrl['host'];
if (isset($parsedUrl['port'])) {
    $baseUrl .= ':' . $parsedUrl['port'];
}
$basePath = isset($parsedUrl['path']) ? dirname($parsedUrl['path']) : '';
if ($basePath === '/' || $basePath === '\\' || $basePath === '.') {
    $basePath = '';
}

// Convert relative URLs to absolute
$content = preg_replace_callback(
    '/(href|src|action)=["\'](?!(?:https?:|data:|javascript:|#|mailto:))([^"\']+)["\']/i',
    function($matches) use ($baseUrl, $basePath) {
        $attr = $matches[1];
        $path = $matches[2];

        if (strpos($path, '//') === 0) {
            // Protocol-relative URL
            return $attr . '="https:' . $path . '"';
        } elseif (strpos($path, '/') === 0) {
            // Absolute path
            return $attr . '="' . $baseUrl . $path . '"';
        } else {
            // Relative path
            return $attr . '="' . $baseUrl . $basePath . '/' . $path . '"';
        }
    },
    $content
);

// Also fix url() in CSS
$content = preg_replace_callback(
    '/url\(["\']?(?!(?:https?:|data:))([^"\'()]+)["\']?\)/i',
    function($matches) use ($baseUrl, $basePath) {
        $path = $matches[1];

        if (strpos($path, '//') === 0) {
            return 'url("https:' . $path . '")';
        } elseif (strpos($path, '/') === 0) {
            return 'url("' . $baseUrl . $path . '")';
        } else {
            return 'url("' . $baseUrl . $basePath . '/' . $path . '")';
        }
    },
    $content
);

// Add base tag for any remaining relative URLs
$baseTag = '<base href="' . htmlspecialchars($baseUrl . $basePath . '/') . '" target="_self">';
if (stripos($content, '<head') !== false) {
    $content = preg_replace('/(<head[^>]*>)/i', '$1' . $baseTag, $content, 1);
} else {
    $content = $baseTag . $content;
}

// Set content type
if (strpos($contentType, 'text/html') !== false || empty($contentType)) {
    header('Content-Type: text/html; charset=utf-8');
} else {
    header('Content-Type: ' . $contentType);
}

echo $content;
