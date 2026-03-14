<?php
/**
 * HlsTranscoder - FFmpeg ile video dosyalarini HLS segmentlerine cevirir
 *
 * Faz A: Tek profil (720p) destegi
 * Faz B: Multi-profil (360p/540p/720p/1080p) destegi icin hazir yapi
 *
 * @package OmnexDisplayHub
 */

class HlsTranscoder
{
    /**
     * Transcode profil tanimlari
     * Faz B'de hepsi aktif olacak, su an sadece 720p kullaniliyor
     */
    const PROFILES = [
        '360p'  => [
            'width' => 640, 'height' => 360,
            'bitrate' => 500, 'maxrate' => 600, 'bufsize' => 1000,
            'audio_bitrate' => 64,
            'profile' => 'baseline', 'level' => '3.0',
            'label' => 'Low'
        ],
        '540p'  => [
            'width' => 960, 'height' => 540,
            'bitrate' => 1000, 'maxrate' => 1200, 'bufsize' => 2000,
            'audio_bitrate' => 96,
            'profile' => 'main', 'level' => '3.1',
            'label' => 'Medium'
        ],
        '720p'  => [
            'width' => 1280, 'height' => 720,
            'bitrate' => 2500, 'maxrate' => 3000, 'bufsize' => 5000,
            'audio_bitrate' => 128,
            'profile' => 'main', 'level' => '3.1',
            'label' => 'High'
        ],
        '1080p' => [
            'width' => 1920, 'height' => 1080,
            'bitrate' => 5000, 'maxrate' => 6000, 'bufsize' => 10000,
            'audio_bitrate' => 192,
            'profile' => 'high', 'level' => '4.0',
            'label' => 'Full HD'
        ],
    ];

    private ?string $ffmpegPath = null;
    private ?string $ffprobePath = null;

    /**
     * Cross-platform shell arg quote helper.
     * Windows'ta escapeshellarg() "%" karakterini bosluga cevirdigi icin
     * HLS segment template (%04d) argumaninda preservePercent=true kullanilir.
     */
    private function quoteShellArg(string $value, bool $preservePercent = false): string
    {
        if (DIRECTORY_SEPARATOR === '\\') {
            $escaped = str_replace('"', '\"', $value);
            if (!$preservePercent) {
                $escaped = str_replace('%', '%%', $escaped);
            }
            return '"' . $escaped . '"';
        }

        return escapeshellarg($value);
    }

    public function __construct()
    {
        $this->ffmpegPath = defined('FFMPEG_PATH') ? FFMPEG_PATH : 'ffmpeg';
        $this->ffprobePath = defined('FFMPEG_PROBE_PATH') ? FFMPEG_PROBE_PATH : 'ffprobe';
    }

    /**
     * FFmpeg binary'sinin mevcut olup olmadigini kontrol eder
     * @return array ['available' => bool, 'path' => string, 'version' => string|null]
     */
    public function detectFfmpeg(): array
    {
        $result = ['available' => false, 'path' => $this->ffmpegPath, 'version' => null];

        // Windows ve Linux/Mac uyumlu
        $cmd = escapeshellarg($this->ffmpegPath) . ' -version 2>&1';
        $output = [];
        $returnCode = 0;
        exec($cmd, $output, $returnCode);

        if ($returnCode === 0 && !empty($output)) {
            $result['available'] = true;
            // "ffmpeg version X.X.X" satirindan versiyon cek
            if (preg_match('/ffmpeg version (\S+)/', $output[0], $matches)) {
                $result['version'] = $matches[1];
            }
        }

        // ffprobe kontrolu
        $cmd2 = escapeshellarg($this->ffprobePath) . ' -version 2>&1';
        $output2 = [];
        exec($cmd2, $output2, $returnCode2);
        $result['ffprobe_available'] = ($returnCode2 === 0);

        return $result;
    }

    /**
     * Video dosyasinin bilgilerini alir (ffprobe ile)
     * @param string $inputPath Kaynak video dosya yolu
     * @return array ['duration', 'width', 'height', 'codec', 'fps', 'bitrate', 'audio_codec', 'file_size']
     */
    public function getVideoInfo(string $inputPath): array
    {
        if (!file_exists($inputPath)) {
            throw new \Exception("Video dosyasi bulunamadi: $inputPath");
        }

        $cmd = sprintf(
            '%s -v quiet -print_format json -show_format -show_streams %s 2>&1',
            escapeshellarg($this->ffprobePath),
            escapeshellarg($inputPath)
        );

        $output = [];
        $returnCode = 0;
        exec($cmd, $output, $returnCode);

        if ($returnCode !== 0) {
            throw new \Exception("ffprobe calistirilamadi (code: $returnCode)");
        }

        $json = json_decode(implode("\n", $output), true);
        if (!$json) {
            throw new \Exception("ffprobe ciktisi parse edilemedi");
        }

        $videoStream = null;
        $audioStream = null;
        foreach (($json['streams'] ?? []) as $stream) {
            if ($stream['codec_type'] === 'video' && !$videoStream) {
                $videoStream = $stream;
            }
            if ($stream['codec_type'] === 'audio' && !$audioStream) {
                $audioStream = $stream;
            }
        }

        if (!$videoStream) {
            throw new \Exception("Video stream bulunamadi");
        }

        $format = $json['format'] ?? [];

        // FPS hesapla
        $fps = 30;
        if (!empty($videoStream['r_frame_rate'])) {
            $parts = explode('/', $videoStream['r_frame_rate']);
            if (count($parts) === 2 && (int)$parts[1] > 0) {
                $fps = round((int)$parts[0] / (int)$parts[1], 2);
            }
        }

        return [
            'duration' => (float)($format['duration'] ?? 0),
            'width' => (int)($videoStream['width'] ?? 0),
            'height' => (int)($videoStream['height'] ?? 0),
            'codec' => $videoStream['codec_name'] ?? 'unknown',
            'pixel_format' => $videoStream['pix_fmt'] ?? 'unknown',
            'fps' => $fps,
            'bitrate' => (int)($format['bit_rate'] ?? 0) / 1000, // kbps
            'audio_codec' => $audioStream['codec_name'] ?? null,
            'audio_channels' => (int)($audioStream['channels'] ?? 0),
            'audio_sample_rate' => (int)($audioStream['sample_rate'] ?? 0),
            'file_size' => (int)($format['size'] ?? filesize($inputPath)),
        ];
    }

    /**
     * Kaynak videoyu belirtilen profil(ler) icin HLS segmentlerine cevirir
     *
     * @param string $inputPath Kaynak video
     * @param string $outputDir Cikti dizini
     * @param array $profiles Profil listesi ['720p'] veya ['360p','720p','1080p']
     * @param callable|null $onProgress Ilerleme callback (0-100)
     * @return array Profil bazli sonuclar
     */
    public function transcode(
        string $inputPath,
        string $outputDir,
        array $profiles = ['720p'],
        ?callable $onProgress = null
    ): array {
        if (!file_exists($inputPath)) {
            throw new \Exception("Kaynak dosya bulunamadi: $inputPath");
        }

        // Cikti dizinini olustur
        if (!is_dir($outputDir)) {
            mkdir($outputDir, 0755, true);
        }

        $videoInfo = $this->getVideoInfo($inputPath);
        $results = [];
        $totalProfiles = count($profiles);

        foreach ($profiles as $index => $profileName) {
            if (!isset(self::PROFILES[$profileName])) {
                $results[$profileName] = ['status' => 'error', 'message' => "Bilinmeyen profil: $profileName"];
                continue;
            }

            $profile = self::PROFILES[$profileName];

            // Kaynak cozunurluk kontrolu: kaynak daha dusukse bu profili atla
            if ($videoInfo['height'] < $profile['height'] && $profileName !== STREAM_DEFAULT_PROFILE) {
                $results[$profileName] = [
                    'status' => 'skipped',
                    'message' => "Kaynak cozunurluk ({$videoInfo['width']}x{$videoInfo['height']}) yetersiz"
                ];
                continue;
            }

            try {
                $profileDir = $outputDir . '/' . $profileName;
                if (!is_dir($profileDir)) {
                    mkdir($profileDir, 0755, true);
                }

                $segmentDuration = defined('STREAM_SEGMENT_DURATION') ? STREAM_SEGMENT_DURATION : 6;

                // Olceklendirme: en-boy oranini koru, cift piksel zorunlulugu
                $scaleFilter = sprintf(
                    "scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2",
                    $profile['width'], $profile['height'],
                    $profile['width'], $profile['height']
                );

                // GOP/keyframe normalization: Tum videolarin ayni keyframe yapisina
                // sahip olmasi, discontinuity tag'i olmadan segment'lerin sorunsuz
                // birlestirilmesini saglar. VLC donma/takılma sorununu cozer.
                // GOP = segment_duration * 24fps (yaklasik), sc_threshold=0 scene change kapatir
                $gopSize = $segmentDuration * 24;
                $forceKeyframes = sprintf('expr:gte(t,n_forced*%d)', $segmentDuration);

                // FFmpeg komutu
                $cmd = sprintf(
                    '%s -y -i %s ' .
                    '-vf "%s" ' .
                    '-c:v libx264 -preset medium -profile:v %s -level %s ' .
                    '-b:v %dk -maxrate %dk -bufsize %dk ' .
                    '-g %d -keyint_min %d -sc_threshold 0 ' .
                    '-force_key_frames "%s" ' .
                    '-c:a aac -b:a %dk -ar 44100 -ac 2 ' .
                    '-f hls -hls_time %d -hls_list_size 0 ' .
                    '-hls_segment_type mpegts ' .
                    '-hls_segment_filename %s ' .
                    '-hls_flags delete_segments+independent_segments ' .
                    '%s 2>&1',
                    escapeshellarg($this->ffmpegPath),
                    escapeshellarg($inputPath),
                    $scaleFilter,
                    $profile['profile'],
                    $profile['level'],
                    $profile['bitrate'],
                    $profile['maxrate'],
                    $profile['bufsize'],
                    $gopSize,
                    $gopSize,
                    $forceKeyframes,
                    $profile['audio_bitrate'],
                    $segmentDuration,
                    $this->quoteShellArg($profileDir . '/segment_%04d.ts', true),
                    escapeshellarg($profileDir . '/playlist.m3u8')
                );

                // FFmpeg calistir
                $ffOutput = [];
                $ffReturn = 0;
                exec($cmd, $ffOutput, $ffReturn);

                if ($ffReturn !== 0) {
                    $errorOutput = implode("\n", array_slice($ffOutput, -10));
                    throw new \Exception("FFmpeg hata (code $ffReturn): $errorOutput");
                }

                // Segment dosyalarini say ve boyut hesapla
                $segmentFiles = glob($profileDir . '/segment_*.ts');
                $totalSize = 0;
                foreach ($segmentFiles as $sf) {
                    $totalSize += filesize($sf);
                }
                // playlist.m3u8 boyutu da ekle
                $playlistFile = $profileDir . '/playlist.m3u8';
                if (file_exists($playlistFile)) {
                    $totalSize += filesize($playlistFile);
                }

                $results[$profileName] = [
                    'status' => 'completed',
                    'profile' => $profileName,
                    'resolution' => $profile['width'] . 'x' . $profile['height'],
                    'bitrate' => $profile['bitrate'],
                    'codec' => 'h264',
                    'playlist_path' => $profileDir . '/playlist.m3u8',
                    'segment_count' => count($segmentFiles),
                    'segment_duration' => $segmentDuration,
                    'total_size' => $totalSize,
                ];

                // Ilerleme bildirimi
                if ($onProgress) {
                    $pct = (int)(($index + 1) / $totalProfiles * 100);
                    $onProgress($pct, $profileName);
                }

            } catch (\Exception $e) {
                $results[$profileName] = [
                    'status' => 'error',
                    'message' => $e->getMessage()
                ];
            }
        }

        return $results;
    }

    /**
     * Coklu profil icin master.m3u8 (adaptive) playlist olusturur
     *
     * @param string $outputDir Temel cikti dizini
     * @param array $variants transcode() sonuclarindan basarili olanlar
     * @return string Master playlist dosya yolu
     */
    public function generateMasterPlaylist(string $outputDir, array $variants): string
    {
        $lines = ["#EXTM3U", "#EXT-X-VERSION:3", ""];

        foreach ($variants as $profileName => $variant) {
            if (($variant['status'] ?? '') !== 'completed') {
                continue;
            }

            $profile = self::PROFILES[$profileName] ?? null;
            if (!$profile) continue;

            $bandwidth = $profile['bitrate'] * 1000; // bps
            $resolution = $profile['width'] . 'x' . $profile['height'];

            // H.264 codec string: profile + level
            $codecMap = [
                'baseline' => '42e0',
                'main' => '4d40',
                'high' => '6400',
            ];
            $profileHex = $codecMap[$profile['profile']] ?? '4d40';
            $levelHex = str_replace('.', '', $profile['level']);
            $codecStr = "avc1.{$profileHex}{$levelHex},mp4a.40.2";

            $lines[] = "#EXT-X-STREAM-INF:BANDWIDTH={$bandwidth},RESOLUTION={$resolution},CODECS=\"{$codecStr}\",NAME=\"{$profileName}\"";
            $lines[] = "{$profileName}/playlist.m3u8";
            $lines[] = "";
        }

        $masterPath = $outputDir . '/master.m3u8';
        file_put_contents($masterPath, implode("\n", $lines));

        return $masterPath;
    }

    /**
     * Belirtilen cikti dizinindeki tum HLS dosyalarini siler
     */
    public function cleanup(string $outputDir): void
    {
        if (!is_dir($outputDir)) return;

        // Alt dizinlerdeki segment ve playlist dosyalarini sil
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($outputDir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($iterator as $file) {
            if ($file->isDir()) {
                @rmdir($file->getPathname());
            } else {
                @unlink($file->getPathname());
            }
        }

        @rmdir($outputDir);
    }

    /**
     * Belirtilen profil icin uygun olup olmadigini kontrol eder
     * (Faz B'de cihaz profili bazli filtreleme icin kullanilacak)
     */
    public function getAvailableProfiles(int $sourceHeight, ?array $deviceProfile = null): array
    {
        $available = [];
        foreach (self::PROFILES as $name => $profile) {
            // Kaynak yeterince buyuk olmali
            if ($sourceHeight >= $profile['height'] || $name === STREAM_DEFAULT_PROFILE) {
                // Cihaz profili kisitlamasi (Faz B)
                if ($deviceProfile && !empty($deviceProfile['max_res'])) {
                    $maxHeight = (int)str_replace('p', '', $deviceProfile['max_res']);
                    if ($profile['height'] > $maxHeight) {
                        continue;
                    }
                }
                $available[] = $name;
            }
        }

        // En az varsayilan profil olmali
        if (empty($available)) {
            $available[] = STREAM_DEFAULT_PROFILE;
        }

        return $available;
    }

    /**
     * Video suresi icin tahmini dosya boyutu hesaplar
     * Storage quota kontrolu icin kullanilir
     */
    public function estimateOutputSize(float $durationSeconds, array $profiles): int
    {
        $totalBytes = 0;
        foreach ($profiles as $profileName) {
            if (isset(self::PROFILES[$profileName])) {
                $bitrate = self::PROFILES[$profileName]['bitrate']; // kbps
                $audioBitrate = self::PROFILES[$profileName]['audio_bitrate'];
                $totalBitrate = ($bitrate + $audioBitrate) * 1000; // bps
                $totalBytes += (int)(($totalBitrate / 8) * $durationSeconds);
            }
        }
        return $totalBytes;
    }
}
