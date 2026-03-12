<?php
/**
 * Stream helper utilities shared by stream endpoints.
 */

if (!function_exists('streamNormalizeLabelPart')) {
    function streamNormalizeLabelPart(?string $value, string $fallback): string
    {
        $value = trim((string)$value);
        if ($value === '') {
            return $fallback;
        }

        if (function_exists('iconv')) {
            $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
            if (is_string($converted) && $converted !== '') {
                $value = $converted;
            }
        }

        $value = strtolower($value);
        $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
        $value = trim($value, '-');

        return $value !== '' ? $value : $fallback;
    }
}

if (!function_exists('streamBuildDisplayLabel')) {
    function streamBuildDisplayLabel(?string $companyName, ?string $deviceName): string
    {
        $companyPart = streamNormalizeLabelPart($companyName, 'company');
        $devicePart = streamNormalizeLabelPart($deviceName, 'player');

        return $companyPart . '-' . $devicePart . '-omnexplayer';
    }
}

if (!function_exists('streamBuildSafeFilename')) {
    function streamBuildSafeFilename(string $label, string $extension): string
    {
        $extension = ltrim($extension, '.');
        $filename = $label . '.' . $extension;

        if (class_exists('Security') && method_exists('Security', 'sanitizeFilename')) {
            $filename = Security::sanitizeFilename($filename);
        } else {
            $filename = preg_replace('/[^a-zA-Z0-9._-]/', '_', $filename) ?? 'stream.' . $extension;
        }

        return $filename !== '' ? $filename : ('stream.' . $extension);
    }
}

if (!function_exists('streamResolveBasePath')) {
    function streamResolveBasePath(): string
    {
        $basePath = '';
        $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
        if (preg_match('#^(.*)/api/#', $scriptName, $matches)) {
            $basePath = $matches[1];
        }

        if (!$basePath && defined('BASE_PATH')) {
            $docRoot = str_replace('\\', '/', rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/\\'));
            $fsBase = str_replace('\\', '/', BASE_PATH);
            if ($docRoot && strpos($fsBase, $docRoot) === 0) {
                $basePath = rtrim(substr($fsBase, strlen($docRoot)), '/');
            }
        }

        return $basePath;
    }
}

if (!function_exists('streamResolveBaseUrl')) {
    function streamResolveBaseUrl(): string
    {
        $forwardedProto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '';
        if ($forwardedProto !== '') {
            $scheme = strtolower(trim(explode(',', $forwardedProto)[0])) === 'https' ? 'https' : 'http';
        } else {
            $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        }

        $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $host = trim(explode(',', (string)$host)[0]);

        return $scheme . '://' . $host . streamResolveBasePath();
    }
}

if (!function_exists('streamResolveCompanyName')) {
    function streamResolveCompanyName($db, ?string $companyId): string
    {
        if (!$companyId) {
            return '';
        }

        try {
            $company = $db->fetch(
                "SELECT name FROM companies WHERE id = ? LIMIT 1",
                [$companyId]
            );
            if (!empty($company['name'])) {
                return (string)$company['name'];
            }
        } catch (\Throwable $e) {
            // Best effort only.
        }

        return '';
    }
}
