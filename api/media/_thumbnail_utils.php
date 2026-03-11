<?php
/**
 * Media thumbnail utility helpers.
 * Supports image thumbnails via GD and video thumbnails via ffmpeg.
 */

if (!function_exists('media_thumbnail_storage_path')) {
    function media_thumbnail_storage_path(): string
    {
        return defined('STORAGE_PATH')
            ? STORAGE_PATH
            : dirname(dirname(__DIR__)) . DIRECTORY_SEPARATOR . 'storage';
    }
}

if (!function_exists('media_thumbnail_resolve_full_path')) {
    function media_thumbnail_resolve_full_path(array $media): ?string
    {
        $filePath = (string)($media['file_path'] ?? '');
        if ($filePath === '') {
            return null;
        }

        if (preg_match('/^[A-Za-z]:[\\\\\/]/', $filePath) || strpos($filePath, '\\\\') === 0 || $filePath[0] === '/') {
            return str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $filePath);
        }

        return media_thumbnail_storage_path() . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $filePath);
    }
}

if (!function_exists('media_thumbnail_cache_dir')) {
    function media_thumbnail_cache_dir(): string
    {
        return media_thumbnail_storage_path() . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR . 'thumbnails';
    }
}

if (!function_exists('media_thumbnail_cache_file')) {
    function media_thumbnail_cache_file(array $media, int $size, ?string $fullPath = null): ?string
    {
        $mediaId = (string)($media['id'] ?? '');
        if ($mediaId === '') {
            return null;
        }

        if ($fullPath === null) {
            $fullPath = media_thumbnail_resolve_full_path($media);
        }
        if (!$fullPath || !is_file($fullPath)) {
            return null;
        }

        $size = max(50, min(800, (int)$size));
        $cacheDir = media_thumbnail_cache_dir();
        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0755, true);
        }

        $cacheKey = md5($mediaId . '_' . $size . '_' . @filemtime($fullPath));
        return $cacheDir . DIRECTORY_SEPARATOR . $cacheKey . '.jpg';
    }
}

if (!function_exists('media_thumbnail_ffmpeg_bin')) {
    function media_thumbnail_ffmpeg_bin(): string
    {
        if (defined('FFMPEG_PATH') && FFMPEG_PATH) {
            return (string)FFMPEG_PATH;
        }
        return 'ffmpeg';
    }
}

if (!function_exists('media_thumbnail_ffmpeg_available')) {
    function media_thumbnail_ffmpeg_available(): bool
    {
        static $available = null;
        if ($available !== null) {
            return $available;
        }

        $bin = media_thumbnail_ffmpeg_bin();
        $cmd = escapeshellarg($bin) . ' -version 2>&1';
        $output = [];
        $exitCode = 1;
        @exec($cmd, $output, $exitCode);
        $available = ($exitCode === 0);

        return $available;
    }
}

if (!function_exists('media_thumbnail_generate_image')) {
    function media_thumbnail_generate_image(string $fullPath, string $cacheFile, int $size, string $mimeType = ''): bool
    {
        if (!function_exists('imagecreatetruecolor')) {
            return false;
        }

        $mimeType = $mimeType !== '' ? strtolower($mimeType) : strtolower((string)@mime_content_type($fullPath));
        $sourceImage = null;
        switch ($mimeType) {
            case 'image/jpeg':
            case 'image/jpg':
                $sourceImage = @imagecreatefromjpeg($fullPath);
                break;
            case 'image/png':
                $sourceImage = @imagecreatefrompng($fullPath);
                break;
            case 'image/gif':
                $sourceImage = @imagecreatefromgif($fullPath);
                break;
            case 'image/webp':
                if (function_exists('imagecreatefromwebp')) {
                    $sourceImage = @imagecreatefromwebp($fullPath);
                }
                break;
            case 'image/bmp':
                if (function_exists('imagecreatefrombmp')) {
                    $sourceImage = @imagecreatefrombmp($fullPath);
                }
                break;
        }

        if (!$sourceImage) {
            return false;
        }

        $origWidth = imagesx($sourceImage);
        $origHeight = imagesy($sourceImage);
        if ($origWidth < 1 || $origHeight < 1) {
            @imagedestroy($sourceImage);
            return false;
        }

        if ($origWidth > $origHeight) {
            $newWidth = $size;
            $newHeight = (int)($origHeight * ($size / $origWidth));
        } else {
            $newHeight = $size;
            $newWidth = (int)($origWidth * ($size / $origHeight));
        }

        $newWidth = max(1, $newWidth);
        $newHeight = max(1, $newHeight);

        $thumbnail = imagecreatetruecolor($newWidth, $newHeight);
        if ($mimeType === 'image/png') {
            imagealphablending($thumbnail, false);
            imagesavealpha($thumbnail, true);
            $transparent = imagecolorallocatealpha($thumbnail, 255, 255, 255, 127);
            imagefilledrectangle($thumbnail, 0, 0, $newWidth, $newHeight, $transparent);
        }

        imagecopyresampled(
            $thumbnail,
            $sourceImage,
            0,
            0,
            0,
            0,
            $newWidth,
            $newHeight,
            $origWidth,
            $origHeight
        );

        $ok = @imagejpeg($thumbnail, $cacheFile, 85);
        @imagedestroy($sourceImage);
        @imagedestroy($thumbnail);

        return (bool)$ok && is_file($cacheFile);
    }
}

if (!function_exists('media_thumbnail_generate_video')) {
    function media_thumbnail_generate_video(string $fullPath, string $cacheFile, int $size): bool
    {
        if (!media_thumbnail_ffmpeg_available()) {
            return false;
        }

        $ffmpeg = media_thumbnail_ffmpeg_bin();
        $tmpFile = $cacheFile . '.tmp.jpg';
        @unlink($tmpFile);

        $runCapture = static function (string $seekTime) use ($ffmpeg, $fullPath, $tmpFile, $size): bool {
            $vf = 'scale=' . (int)$size . ':-1';
            $cmd = escapeshellarg($ffmpeg)
                . ' -y -hide_banner -loglevel error'
                . ' -ss ' . escapeshellarg($seekTime)
                . ' -i ' . escapeshellarg($fullPath)
                . ' -frames:v 1'
                . ' -vf ' . escapeshellarg($vf)
                . ' -q:v 4 '
                . escapeshellarg($tmpFile)
                . ' 2>&1';
            $output = [];
            $exitCode = 1;
            @exec($cmd, $output, $exitCode);
            return $exitCode === 0 && is_file($tmpFile) && filesize($tmpFile) > 0;
        };

        $ok = $runCapture('00:00:01') || $runCapture('00:00:00');
        if (!$ok) {
            @unlink($tmpFile);
            return false;
        }

        if (!@rename($tmpFile, $cacheFile)) {
            if (!@copy($tmpFile, $cacheFile)) {
                @unlink($tmpFile);
                return false;
            }
            @unlink($tmpFile);
        }

        return is_file($cacheFile) && filesize($cacheFile) > 0;
    }
}

if (!function_exists('media_thumbnail_ensure')) {
    function media_thumbnail_ensure(array $media, int $size = 200): ?string
    {
        $type = strtolower((string)($media['file_type'] ?? $media['type'] ?? ''));
        if (!in_array($type, ['image', 'video'], true)) {
            return null;
        }

        $fullPath = media_thumbnail_resolve_full_path($media);
        if (!$fullPath || !is_file($fullPath)) {
            return null;
        }

        $cacheFile = media_thumbnail_cache_file($media, $size, $fullPath);
        if (!$cacheFile) {
            return null;
        }

        if (is_file($cacheFile)) {
            return $cacheFile;
        }

        $ok = false;
        if ($type === 'image') {
            $ok = media_thumbnail_generate_image($fullPath, $cacheFile, $size, (string)($media['mime_type'] ?? ''));
        } elseif ($type === 'video') {
            $ok = media_thumbnail_generate_video($fullPath, $cacheFile, $size);
        }

        return $ok ? $cacheFile : null;
    }
}

if (!function_exists('media_thumbnail_signed_query')) {
    function media_thumbnail_signed_query(array $media): string
    {
        $isPublicMedia = ((int)($media['is_public'] ?? 0) === 1) || (($media['scope'] ?? '') === 'public');
        if ($isPublicMedia) {
            return '';
        }

        $storagePath = realpath(media_thumbnail_storage_path());
        $fullPath = media_thumbnail_resolve_full_path($media);
        $fullPathReal = $fullPath ? realpath($fullPath) : false;
        if (!$storagePath || !$fullPathReal) {
            return '';
        }

        $storageNorm = str_replace('\\', '/', rtrim($storagePath, '\\/'));
        $fullNorm = str_replace('\\', '/', $fullPathReal);
        $prefix = $storageNorm . '/';
        if (strtolower(substr($fullNorm, 0, strlen($prefix))) !== strtolower($prefix)) {
            return '';
        }

        $relativePath = substr($fullNorm, strlen($prefix));
        if ($relativePath === '' || !defined('JWT_SECRET') || JWT_SECRET === '') {
            return '';
        }

        $expiresAt = time() + 86400;
        $signature = hash_hmac('sha256', $relativePath . '|' . $expiresAt, JWT_SECRET);

        return '&exp=' . $expiresAt . '&sig=' . urlencode($signature);
    }
}

if (!function_exists('media_thumbnail_url')) {
    function media_thumbnail_url(array $media, string $basePath, int $size = 200): ?string
    {
        $type = strtolower((string)($media['file_type'] ?? $media['type'] ?? ''));
        $mediaId = (string)($media['id'] ?? '');
        if ($mediaId === '' || !in_array($type, ['image', 'video'], true)) {
            return null;
        }

        $size = max(50, min(800, (int)$size));

        if ($type === 'video') {
            $fullPath = media_thumbnail_resolve_full_path($media);
            $cacheFile = $fullPath ? media_thumbnail_cache_file($media, $size, $fullPath) : null;
            $hasCachedThumb = $cacheFile && is_file($cacheFile);

            // If ffmpeg is unavailable and there is no cached thumb,
            // avoid returning thumbnail URL so frontend can use video first-frame fallback.
            if (!$hasCachedThumb && !media_thumbnail_ffmpeg_available()) {
                return null;
            }
        }

        return rtrim($basePath, '/') . '/api/media/thumbnail.php?id=' . urlencode($mediaId) . '&size=' . $size . media_thumbnail_signed_query($media);
    }
}
