<?php
/**
 * PriceView template utility helpers.
 */

if (!function_exists('priceviewTemplateDirectory')) {
    function priceviewTemplateDirectory(): string
    {
        return rtrim((string)BASE_PATH, '/\\') . '/public/priceview-templates';
    }
}

if (!function_exists('priceviewNormalizeTemplateName')) {
    function priceviewNormalizeTemplateName($value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $trimmed = trim($value);
        if ($trimmed === '' || strcasecmp($trimmed, 'default') === 0 || strcasecmp($trimmed, 'null') === 0) {
            return null;
        }

        // Allow only safe filename chars used by template naming.
        if (!preg_match('/^[a-z0-9_-]+$/i', $trimmed)) {
            return null;
        }

        return strtolower($trimmed);
    }
}

if (!function_exists('priceviewTemplateLabel')) {
    function priceviewTemplateLabel(string $name): string
    {
        return ucwords(str_replace(['-', '_'], ' ', $name));
    }
}

if (!function_exists('priceviewTemplatePresets')) {
    function priceviewTemplatePresets(): array
    {
        $dir = priceviewTemplateDirectory();
        if (!is_dir($dir)) {
            return [];
        }

        $presets = [];
        $foundFiles = glob($dir . '/*-view-overlay.html') ?: [];

        foreach ($foundFiles as $file) {
            $base = basename($file);
            $name = preg_replace('/-view-overlay\.html$/', '', $base);
            $normalized = priceviewNormalizeTemplateName($name);
            if ($normalized === null || $normalized === 'universal-notfound') {
                continue;
            }

            $notFoundPath = $dir . '/' . $normalized . '-overlay-not-found.html';
            $presets[$normalized] = [
                'name' => $normalized,
                'label' => priceviewTemplateLabel($normalized),
                'has_not_found' => is_file($notFoundPath),
            ];
        }

        if (empty($presets)) {
            return [];
        }

        uasort($presets, static function (array $a, array $b): int {
            return strnatcasecmp($a['label'], $b['label']);
        });

        return array_values($presets);
    }
}

if (!function_exists('priceviewFetchCompanySettings')) {
    function priceviewFetchCompanySettings(Database $db, string $companyId): array
    {
        $row = $db->fetch(
            "SELECT data
             FROM settings
             WHERE company_id = ? AND user_id IS NULL
             ORDER BY updated_at DESC NULLS LAST
             LIMIT 1",
            [$companyId]
        );

        if (empty($row['data'])) {
            return [];
        }

        $decoded = json_decode((string)$row['data'], true);
        return is_array($decoded) ? $decoded : [];
    }
}

if (!function_exists('priceviewParseMetadata')) {
    function priceviewParseMetadata($rawMetadata): array
    {
        if (is_array($rawMetadata)) {
            return $rawMetadata;
        }
        if (is_object($rawMetadata)) {
            return (array)$rawMetadata;
        }
        if (!is_string($rawMetadata) || trim($rawMetadata) === '') {
            return [];
        }
        $decoded = json_decode($rawMetadata, true);
        return is_array($decoded) ? $decoded : [];
    }
}

if (!function_exists('priceviewReadDeviceTemplateOverride')) {
    function priceviewReadDeviceTemplateOverride(array $metadata): ?string
    {
        $nested = $metadata['priceview'] ?? null;
        if (is_array($nested) && array_key_exists('display_template_override', $nested)) {
            return priceviewNormalizeTemplateName($nested['display_template_override']);
        }

        if (array_key_exists('priceview_display_template_override', $metadata)) {
            return priceviewNormalizeTemplateName($metadata['priceview_display_template_override']);
        }

        return null;
    }
}

if (!function_exists('priceviewResolveDeviceUuid')) {
    function priceviewResolveDeviceUuid(Database $db, string $companyId, array $device): ?string
    {
        $candidates = [];
        foreach (['device_id', 'id'] as $key) {
            $value = $device[$key] ?? null;
            if (!is_string($value)) {
                continue;
            }
            $value = trim($value);
            if ($value !== '') {
                $candidates[] = $value;
            }
        }

        if (empty($candidates)) {
            return null;
        }

        $candidates = array_values(array_unique($candidates));

        foreach ($candidates as $candidateId) {
            $row = $db->fetch(
                "SELECT id
                 FROM devices
                 WHERE id = ? AND company_id = ?
                 LIMIT 1",
                [$candidateId, $companyId]
            );

            if (!empty($row['id'])) {
                return (string)$row['id'];
            }
        }

        return null;
    }
}

if (!function_exists('priceviewWriteDeviceTemplateOverride')) {
    function priceviewWriteDeviceTemplateOverride(array $metadata, ?string $override): array
    {
        if (!isset($metadata['priceview']) || !is_array($metadata['priceview'])) {
            $metadata['priceview'] = [];
        }

        if ($override === null) {
            unset($metadata['priceview']['display_template_override']);
            unset($metadata['priceview_display_template_override']);
            if (empty($metadata['priceview'])) {
                unset($metadata['priceview']);
            }
            return $metadata;
        }

        $metadata['priceview']['display_template_override'] = $override;
        $metadata['priceview_display_template_override'] = $override; // Legacy-friendly duplicate key.
        return $metadata;
    }
}

if (!function_exists('priceviewResolveTemplateSelection')) {
    function priceviewResolveTemplateSelection(?string $companyTemplate, ?string $deviceOverride, array $availableNames): array
    {
        $availableLookup = array_fill_keys($availableNames, true);
        $normalizedCompany = priceviewNormalizeTemplateName($companyTemplate);
        $normalizedDevice = priceviewNormalizeTemplateName($deviceOverride);

        $source = 'default';
        $resolved = null;

        if ($normalizedDevice !== null && isset($availableLookup[$normalizedDevice])) {
            $resolved = $normalizedDevice;
            $source = 'device';
        } elseif ($normalizedCompany !== null && isset($availableLookup[$normalizedCompany])) {
            $resolved = $normalizedCompany;
            $source = 'company';
        } elseif (isset($availableLookup['market'])) {
            $resolved = 'market';
        } elseif (!empty($availableNames)) {
            $resolved = $availableNames[0];
        }

        return [
            'template_name' => $resolved,
            'source' => $source,
            'company_template_name' => $normalizedCompany,
            'device_template_override' => $normalizedDevice,
        ];
    }
}

if (!function_exists('priceviewTemplateFileInfo')) {
    function priceviewTemplateFileInfo(?string $templateName): array
    {
        $dir = priceviewTemplateDirectory();
        $result = [
            'product_path' => null,
            'not_found_path' => null,
            'signature' => null,
        ];

        if ($templateName === null) {
            return $result;
        }

        $productPath = $dir . '/' . $templateName . '-view-overlay.html';
        if (is_file($productPath)) {
            $result['product_path'] = $productPath;
        }

        $notFoundPath = $dir . '/' . $templateName . '-overlay-not-found.html';
        $fallbackNotFoundPath = $dir . '/universal-notfound-view-overlay.html';
        if (is_file($notFoundPath)) {
            $result['not_found_path'] = $notFoundPath;
        } elseif (is_file($fallbackNotFoundPath)) {
            $result['not_found_path'] = $fallbackNotFoundPath;
        }

        $parts = [$templateName];
        foreach (['product_path', 'not_found_path'] as $key) {
            $path = $result[$key];
            if (is_string($path) && is_file($path)) {
                $parts[] = basename($path) . ':' . filesize($path) . ':' . filemtime($path);
            } else {
                $parts[] = $key . ':none';
            }
        }
        $result['signature'] = sha1(implode('|', $parts));

        return $result;
    }
}

if (!function_exists('priceviewReadTemplateFile')) {
    function priceviewReadTemplateFile(?string $path): ?string
    {
        if (!is_string($path) || !is_file($path)) {
            return null;
        }

        $content = file_get_contents($path);
        if ($content === false) {
            return null;
        }

        if (function_exists('mb_check_encoding') && !mb_check_encoding($content, 'UTF-8')) {
            $converted = @mb_convert_encoding($content, 'UTF-8', 'UTF-8, ISO-8859-9, Windows-1254');
            if (is_string($converted) && $converted !== '') {
                $content = $converted;
            }
        }

        return $content;
    }
}

if (!function_exists('priceviewDefaultProductTemplate')) {
    function priceviewDefaultProductTemplate(): string
    {
        return <<<'HTML'
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PriceView</title>
<style>
body{margin:0;font-family:Arial,sans-serif;background:#0f172a;color:#fff}
.wrap{padding:24px}
.name{font-size:42px;font-weight:700}
.price{font-size:64px;font-weight:800;color:#4ade80;margin-top:12px}
.meta{font-size:24px;margin-top:10px;color:#cbd5e1}
</style>
</head>
<body>
<div class="wrap">
  <div class="name">{{name}}</div>
  <div class="price">{{current_price}} {{currency}}</div>
  <div class="meta">{{barcode}}</div>
</div>
</body>
</html>
HTML;
    }
}

if (!function_exists('priceviewDefaultNotFoundTemplate')) {
    function priceviewDefaultNotFoundTemplate(): string
    {
        return <<<'HTML'
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PriceView - Bulunamadı</title>
<style>
body{margin:0;font-family:Arial,sans-serif;background:rgba(15,23,42,.94);color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh}
.wrap{text-align:center;padding:24px}
.title{font-size:46px;font-weight:700}
.meta{font-size:24px;margin-top:14px;color:#cbd5e1}
</style>
</head>
<body>
<div class="wrap">
  <div class="title">Ürün Bulunamadı</div>
  <div class="meta">{{barcode}}</div>
</div>
</body>
</html>
HTML;
    }
}
