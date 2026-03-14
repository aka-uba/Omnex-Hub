<?php
/**
 * StreamChannelService
 *
 * Professional live stream pipeline:
 * - Build a single timeline program file from playlist media.
 * - Apply server-side transitions while stitching.
 * - Run a continuous FFmpeg HLS encoder per token/profile.
 *
 * This service is intentionally independent from session/auth flow and is safe
 * to use from public stream endpoints and CLI workers.
 */

class StreamChannelService
{
    private Database $db;
    private string $channelsBaseDir;
    private string $requestsDir;
    private string $ffmpegPath;
    private string $ffprobePath;
    private int $segmentDuration;
    private int $playlistSize;
    private int $idleTimeout;

    public function __construct(?Database $db = null)
    {
        $this->db = $db ?: Database::getInstance();
        $streamBase = defined('STREAM_STORAGE_PATH') ? STREAM_STORAGE_PATH : (defined('STORAGE_PATH') ? STORAGE_PATH . '/streams' : 'storage/streams');
        $this->channelsBaseDir = rtrim($streamBase, '/\\') . '/channels';
        $this->requestsDir = $this->channelsBaseDir . '/requests';
        $this->ffmpegPath = defined('FFMPEG_PATH') ? FFMPEG_PATH : 'ffmpeg';
        $this->ffprobePath = defined('FFMPEG_PROBE_PATH') ? FFMPEG_PROBE_PATH : 'ffprobe';
        $this->segmentDuration = defined('STREAM_SEGMENT_DURATION') ? max(2, (int)STREAM_SEGMENT_DURATION) : 6;
        $this->playlistSize = max(6, (int)(getenv('STREAM_CHANNEL_PLAYLIST_SIZE') ?: 12));
        $this->idleTimeout = max(60, (int)(getenv('STREAM_CHANNEL_IDLE_TIMEOUT') ?: 300));

        $this->ensureDir($this->channelsBaseDir);
        $this->ensureDir($this->requestsDir);
    }

    public static function isChannelModeEnabled(): bool
    {
        $raw = strtolower(trim((string)(getenv('STREAM_CHANNEL_MODE') ?: '1')));
        return !in_array($raw, ['0', 'false', 'no', 'off'], true);
    }

    public function normalizeProfile(string $profile): string
    {
        $allowed = array_keys(HlsTranscoder::PROFILES);
        $p = strtolower(trim($profile));
        if ($p === '' || !in_array($p, $allowed, true)) {
            return defined('STREAM_DEFAULT_PROFILE') ? STREAM_DEFAULT_PROFILE : '720p';
        }
        return $p;
    }

    public function queueBuildRequest(array $device, string $profile, bool $force = false): void
    {
        $token = (string)($device['stream_token'] ?? '');
        if ($token === '') {
            return;
        }

        $profile = $this->normalizeProfile($profile);
        $requestPath = $this->getRequestPath($token, $profile);
        $payload = [
            'token' => $token,
            'profile' => $profile,
            'force' => $force,
            'device_id' => (string)($device['id'] ?? ''),
            'company_id' => (string)($device['company_id'] ?? ''),
            'requested_at' => time(),
        ];
        $this->safeWriteJson($requestPath, $payload);
    }

    public function consumeBuildRequests(): array
    {
        $requests = [];
        if (!is_dir($this->requestsDir)) {
            return $requests;
        }

        $files = glob($this->requestsDir . '/*.json') ?: [];
        sort($files, SORT_STRING);
        foreach ($files as $file) {
            $raw = @file_get_contents($file);
            if (!is_string($raw) || trim($raw) === '') {
                @unlink($file);
                continue;
            }
            $data = json_decode($raw, true);
            if (!is_array($data) || empty($data['token']) || empty($data['profile'])) {
                @unlink($file);
                continue;
            }
            $requests[] = $data;
            @unlink($file);
        }

        return $requests;
    }

    public function touchChannelAccess(string $token, string $profile): void
    {
        $profile = $this->normalizeProfile($profile);
        $channelDir = $this->getChannelDir($token, $profile);
        $this->ensureDir($channelDir);
        @file_put_contents($channelDir . '/last_request_at.txt', (string)time(), LOCK_EX);
    }

    public function getPublicChannelPlaylist(string $token, string $profile, string $baseUrl): ?string
    {
        $profile = $this->normalizeProfile($profile);
        $playlistPath = $this->getChannelPlaylistPath($token, $profile);
        if (!is_file($playlistPath)) {
            return null;
        }

        $content = @file_get_contents($playlistPath);
        if (!is_string($content) || trim($content) === '') {
            return null;
        }

        $prefix = rtrim($baseUrl, '/') . '/api/stream/' . rawurlencode($token) . '/channel/' . rawurlencode($profile) . '/';
        $lines = preg_split('/\r\n|\r|\n/', $content) ?: [];
        $out = [];

        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '') {
                $out[] = '';
                continue;
            }

            if ($trimmed[0] === '#') {
                if (str_starts_with($trimmed, '#EXT-X-MAP:URI=')) {
                    if (preg_match('/URI="([^"]+)"/', $trimmed, $matches)) {
                        $fname = basename($matches[1]);
                        $mapped = $prefix . rawurlencode($fname);
                        $trimmed = preg_replace('/URI="([^"]+)"/', 'URI="' . $mapped . '"', $trimmed);
                    }
                }
                $out[] = $trimmed;
                continue;
            }

            $out[] = $prefix . rawurlencode(basename($trimmed));
        }

        return implode("\n", $out) . "\n";
    }

    public function getChannelFilePath(string $token, string $profile, string $filename): string
    {
        $profile = $this->normalizeProfile($profile);
        return $this->getChannelDir($token, $profile) . '/' . $filename;
    }

    public function getDeviceByToken(string $token): ?array
    {
        $device = $this->db->fetch(
            "SELECT * FROM devices WHERE stream_token = ? AND stream_mode = true",
            [$token]
        );

        return is_array($device) ? $device : null;
    }

    public function ensureChannel(array $device, string $profile, bool $force = false): array
    {
        $token = (string)($device['stream_token'] ?? '');
        if ($token === '') {
            return ['ok' => false, 'reason' => 'missing_token'];
        }

        $profile = $this->normalizeProfile($profile);
        $prepared = $this->prepareProgram($device, $profile, $force);
        if (!($prepared['ok'] ?? false)) {
            return $prepared;
        }

        $started = $this->ensureEncoderRunning(
            $token,
            $profile,
            (string)$prepared['program_path'],
            (string)$prepared['playlist_hash'],
            (bool)($prepared['rebuild'] ?? false)
        );

        return array_merge($prepared, $started);
    }

    public function listChannelStates(): array
    {
        $states = [];
        if (!is_dir($this->channelsBaseDir)) {
            return $states;
        }

        $tokenDirs = glob($this->channelsBaseDir . '/*', GLOB_ONLYDIR) ?: [];
        foreach ($tokenDirs as $tokenDir) {
            if (basename($tokenDir) === 'requests') {
                continue;
            }
            $profileDirs = glob($tokenDir . '/*', GLOB_ONLYDIR) ?: [];
            foreach ($profileDirs as $profileDir) {
                $token = basename($tokenDir);
                $profile = basename($profileDir);
                $state = $this->readState($token, $profile);
                if (!is_array($state)) {
                    continue;
                }
                $state['token'] = $token;
                $state['profile'] = $profile;
                $state['is_running'] = $this->isLikelyRunning($token, $profile, $state);
                $states[] = $state;
            }
        }

        return $states;
    }

    public function pruneIdleChannels(): int
    {
        $stopped = 0;
        $now = time();
        foreach ($this->listChannelStates() as $state) {
            $token = (string)($state['token'] ?? '');
            $profile = (string)($state['profile'] ?? '');
            if ($token === '' || $profile === '') {
                continue;
            }

            $lastRequestAt = $this->readLastRequestAt($token, $profile);
            if ($lastRequestAt <= 0 || ($now - $lastRequestAt) <= $this->idleTimeout) {
                continue;
            }

            if ($this->stopEncoder((int)($state['pid'] ?? 0), $token, $profile)) {
                $state['pid'] = 0;
                $state['stopped_at'] = date('c');
                $this->writeState($token, $profile, $state);
                $stopped++;
            }
        }

        return $stopped;
    }

    public function getChannelDir(string $token, string $profile): string
    {
        return $this->channelsBaseDir . '/' . $token . '/' . $this->normalizeProfile($profile);
    }

    public function getChannelPlaylistPath(string $token, string $profile): string
    {
        return $this->getChannelDir($token, $profile) . '/playlist.m3u8';
    }

    private function prepareProgram(array $device, string $profile, bool $force): array
    {
        $token = (string)($device['stream_token'] ?? '');
        $channelDir = $this->getChannelDir($token, $profile);
        $this->ensureDir($channelDir);

        $active = $this->resolveActivePlaylist($device);
        if (empty($active['items']) || !is_array($active['items'])) {
            return ['ok' => false, 'reason' => 'playlist_empty'];
        }

        $sources = $this->resolveVideoSources($active['items'], (string)($device['company_id'] ?? ''));
        if (count($sources) === 0) {
            return ['ok' => false, 'reason' => 'no_video_source'];
        }

        $transition = $this->normalizeTransition((string)($active['transition'] ?? 'none'));
        $transitionDuration = $this->normalizeTransitionDuration($active['transition_duration'] ?? 0);
        if (count($sources) <= 1) {
            $transition = 'none';
            $transitionDuration = 0.0;
        }

        $hashPayload = [
            'playlist_id' => (string)($active['playlist_id'] ?? ''),
            'profile' => $profile,
            'transition' => $transition,
            'transition_duration' => $transitionDuration,
            'sources' => array_map(static function ($src) {
                return [
                    'media_id' => $src['media_id'],
                    'path' => $src['path'],
                    'duration' => $src['duration'],
                ];
            }, $sources),
        ];
        $playlistHash = hash('sha256', json_encode($hashPayload));

        $state = $this->readState($token, $profile) ?: [];
        $programPath = $channelDir . '/program.mp4';
        $sameHash = (($state['playlist_hash'] ?? '') === $playlistHash) && is_file($programPath);
        if (!$force && $sameHash) {
            return [
                'ok' => true,
                'rebuild' => false,
                'program_path' => $programPath,
                'playlist_hash' => $playlistHash,
                'source_count' => count($sources),
                'transition' => $transition,
                'transition_duration' => $transitionDuration,
            ];
        }

        $tmpProgramPath = $channelDir . '/program.tmp.mp4';
        @unlink($tmpProgramPath);

        $buildResult = $this->buildProgramWithTransitions($sources, $profile, $transition, $transitionDuration, $tmpProgramPath);
        if (!($buildResult['ok'] ?? false)) {
            $buildResult = $this->buildProgramConcat($sources, $profile, $tmpProgramPath);
            $buildResult['fallback_used'] = true;
        }
        if (!($buildResult['ok'] ?? false)) {
            return ['ok' => false, 'reason' => 'program_build_failed', 'error' => (string)($buildResult['error'] ?? '')];
        }

        if (is_file($programPath)) {
            @unlink($programPath);
        }
        if (!@rename($tmpProgramPath, $programPath)) {
            return ['ok' => false, 'reason' => 'program_replace_failed'];
        }

        $state['playlist_hash'] = $playlistHash;
        $state['program_updated_at'] = date('c');
        $state['source_count'] = count($sources);
        $state['transition'] = $transition;
        $state['transition_duration'] = $transitionDuration;
        $this->writeState($token, $profile, $state);

        return [
            'ok' => true,
            'rebuild' => true,
            'program_path' => $programPath,
            'playlist_hash' => $playlistHash,
            'source_count' => count($sources),
            'transition' => $transition,
            'transition_duration' => $transitionDuration,
            'fallback_used' => (bool)($buildResult['fallback_used'] ?? false),
        ];
    }

    private function ensureEncoderRunning(string $token, string $profile, string $programPath, string $playlistHash, bool $forceRestart): array
    {
        $state = $this->readState($token, $profile) ?: [];
        $pid = (int)($state['pid'] ?? 0);
        $sameHash = (($state['encoder_hash'] ?? '') === $playlistHash);
        $isRunning = $this->isLikelyRunning($token, $profile, $state);

        if ($isRunning && !$forceRestart && $sameHash) {
            return [
                'ok' => true,
                'running' => true,
                'started' => false,
                'pid' => $pid,
            ];
        }

        if ($isRunning) {
            $this->stopEncoder($pid, $token, $profile);
            usleep(300000);
        }

        $channelDir = $this->getChannelDir($token, $profile);
        $playlistPath = $channelDir . '/playlist.m3u8';
        $segmentPattern = $channelDir . '/segment_%06d.ts';
        $logPath = $channelDir . '/encoder.log';
        $gop = max(24, $this->segmentDuration * 24);
        $programArg = $this->escapeArg($programPath);
        $playlistArg = $this->escapeArg($playlistPath);
        $segmentPatternArg = $this->escapeSegmentPatternArg($segmentPattern);

        if (is_file($playlistPath)) {
            @unlink($playlistPath);
        }
        foreach (glob($channelDir . '/segment_*.ts') ?: [] as $oldSeg) {
            if (is_file($oldSeg)) {
                @unlink($oldSeg);
            }
        }

        $cmd = implode(' ', [
            escapeshellarg($this->ffmpegPath),
            '-hide_banner -nostats -loglevel warning -re -stream_loop -1 -fflags +genpts -avoid_negative_ts make_zero',
            '-i ' . $programArg,
            '-c:v libx264 -preset veryfast -profile:v main -level 3.1 -pix_fmt yuv420p',
            '-r 24 -g ' . $gop . ' -keyint_min ' . $gop . ' -sc_threshold 0',
            '-force_key_frames ' . escapeshellarg('expr:gte(t,n_forced*' . $this->segmentDuration . ')'),
            '-an',
            '-f hls -hls_time ' . (int)$this->segmentDuration . ' -hls_list_size ' . (int)$this->playlistSize,
            '-hls_flags delete_segments+append_list+omit_endlist+program_date_time+independent_segments',
            '-hls_segment_type mpegts',
            '-hls_segment_filename ' . $segmentPatternArg,
            $playlistArg
        ]);

        $newPid = $this->startDetachedProcess($cmd, $logPath, $token, $profile);
        if ($newPid < 0) {
            return ['ok' => false, 'reason' => 'encoder_start_failed'];
        }

        $state['pid'] = $newPid;
        $state['encoder_hash'] = $playlistHash;
        $state['encoder_started_at'] = date('c');
        $state['last_started_command'] = $cmd;
        $this->writeState($token, $profile, $state);

        return [
            'ok' => true,
            'running' => true,
            'started' => true,
            'pid' => $newPid,
        ];
    }

    private function buildProgramWithTransitions(array $sources, string $profile, string $transition, float $transitionDuration, string $outputPath): array
    {
        if ($transition === 'none' || count($sources) < 2 || $transitionDuration <= 0.0) {
            return ['ok' => false, 'error' => 'transition_not_applicable'];
        }

        $profileDef = HlsTranscoder::PROFILES[$profile] ?? HlsTranscoder::PROFILES[(defined('STREAM_DEFAULT_PROFILE') ? STREAM_DEFAULT_PROFILE : '720p')];
        $scalePad = sprintf(
            'scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2,format=yuv420p,setsar=1',
            (int)$profileDef['width'],
            (int)$profileDef['height'],
            (int)$profileDef['width'],
            (int)$profileDef['height']
        );

        $inputs = [];
        $filters = [];
        foreach ($sources as $idx => $src) {
            $inputs[] = '-i ' . escapeshellarg($src['path']);
            $sourceDuration = max(0.1, (float)$src['duration']);
            $filters[] = sprintf(
                '[%d:v]trim=duration=%.3F,setpts=PTS-STARTPTS,%s[v%d]',
                $idx,
                $sourceDuration,
                $scalePad,
                $idx
            );
        }

        $ffTransition = $this->mapTransitionToXfade($transition);
        $timeline = max(0.1, (float)$sources[0]['duration']);
        $prev = 'v0';

        for ($idx = 1; $idx < count($sources); $idx++) {
            $offset = max(0.0, $timeline - $transitionDuration);
            $out = 'vx' . $idx;
            $filters[] = sprintf(
                '[%s][v%d]xfade=transition=%s:duration=%.3F:offset=%.3F[%s]',
                $prev,
                $idx,
                $ffTransition,
                $transitionDuration,
                $offset,
                $out
            );
            $prev = $out;
            $timeline += max(0.1, (float)$sources[$idx]['duration']) - $transitionDuration;
        }

        $filterComplex = implode(';', $filters);
        $gop = max(24, $this->segmentDuration * 24);
        $cmd = implode(' ', [
            escapeshellarg($this->ffmpegPath),
            '-hide_banner -loglevel warning -y',
            implode(' ', $inputs),
            '-filter_complex ' . escapeshellarg($filterComplex),
            '-map ' . escapeshellarg('[' . $prev . ']'),
            '-an',
            '-c:v libx264 -preset veryfast -profile:v main -level 3.1 -pix_fmt yuv420p',
            '-r 24 -g ' . $gop . ' -keyint_min ' . $gop . ' -sc_threshold 0',
            '-movflags +faststart',
            escapeshellarg($outputPath)
        ]);

        return $this->runCommand($cmd, dirname($outputPath) . '/build.log');
    }

    private function buildProgramConcat(array $sources, string $profile, string $outputPath): array
    {
        if (count($sources) === 0) {
            return ['ok' => false, 'error' => 'concat_no_source'];
        }

        $profileDef = HlsTranscoder::PROFILES[$profile] ?? HlsTranscoder::PROFILES[(defined('STREAM_DEFAULT_PROFILE') ? STREAM_DEFAULT_PROFILE : '720p')];
        $scalePad = sprintf(
            'scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2,format=yuv420p,setsar=1',
            (int)$profileDef['width'],
            (int)$profileDef['height'],
            (int)$profileDef['width'],
            (int)$profileDef['height']
        );

        $inputs = [];
        $filters = [];
        $concatInputs = [];
        foreach ($sources as $idx => $src) {
            $inputs[] = '-i ' . escapeshellarg($src['path']);
            $sourceDuration = max(0.1, (float)$src['duration']);
            $filters[] = sprintf(
                '[%d:v]trim=duration=%.3F,setpts=PTS-STARTPTS,%s[v%d]',
                $idx,
                $sourceDuration,
                $scalePad,
                $idx
            );
            $concatInputs[] = '[v' . $idx . ']';
        }
        $filters[] = implode('', $concatInputs) . 'concat=n=' . count($sources) . ':v=1:a=0[vout]';
        $filterComplex = implode(';', $filters);

        $gop = max(24, $this->segmentDuration * 24);
        $cmd = implode(' ', [
            escapeshellarg($this->ffmpegPath),
            '-hide_banner -loglevel warning -y',
            implode(' ', $inputs),
            '-filter_complex ' . escapeshellarg($filterComplex),
            '-map ' . escapeshellarg('[vout]'),
            '-an',
            '-c:v libx264 -preset veryfast -profile:v main -level 3.1 -pix_fmt yuv420p',
            '-r 24 -g ' . $gop . ' -keyint_min ' . $gop . ' -sc_threshold 0',
            '-movflags +faststart',
            escapeshellarg($outputPath)
        ]);

        return $this->runCommand($cmd, dirname($outputPath) . '/build.log');
    }

    private function resolveActivePlaylist(array $device): array
    {
        $assignmentPlaylistJoin = $this->db->isPostgres()
            ? "LEFT JOIN playlists p ON CAST(dca.content_id AS TEXT) = CAST(p.id AS TEXT)"
            : "LEFT JOIN playlists p ON dca.content_id = p.id";

        $schedulePlaylistJoin = $this->db->isPostgres()
            ? "LEFT JOIN playlists p ON CAST(s.content_id AS TEXT) = CAST(p.id AS TEXT)"
            : "LEFT JOIN playlists p ON s.content_id = p.id";

        $assignment = $this->db->fetch(
            "SELECT p.id AS playlist_id, p.items, p.transition, p.transition_duration
             FROM device_content_assignments dca
             {$assignmentPlaylistJoin}
             WHERE dca.device_id = ? AND dca.status = 'active' AND dca.content_type = 'playlist'
             ORDER BY dca.created_at DESC LIMIT 1",
            [$device['id']]
        );

        if ($assignment && !empty($assignment['playlist_id'])) {
            return [
                'playlist_id' => $assignment['playlist_id'],
                'items' => json_decode((string)($assignment['items'] ?? '[]'), true) ?: [],
                'transition' => $assignment['transition'] ?? 'none',
                'transition_duration' => $assignment['transition_duration'] ?? 0,
            ];
        }

        $now = date('Y-m-d H:i:s');
        $currentTime = date('H:i:s');
        $schedule = $this->db->fetch(
            "SELECT p.id AS playlist_id, p.items, p.transition, p.transition_duration
             FROM schedules s
             JOIN schedule_devices sd ON s.id = sd.schedule_id
             {$schedulePlaylistJoin}
             WHERE sd.device_id = ? AND s.status = 'active'
             AND (s.start_date IS NULL OR s.start_date <= ?)
             AND (s.end_date IS NULL OR s.end_date >= ?)
             AND (s.start_time IS NULL OR s.start_time <= ?)
             AND (s.end_time IS NULL OR s.end_time >= ?)
             ORDER BY s.priority DESC LIMIT 1",
            [$device['id'], $now, $now, $currentTime, $currentTime]
        );

        if ($schedule && !empty($schedule['playlist_id'])) {
            return [
                'playlist_id' => $schedule['playlist_id'],
                'items' => json_decode((string)($schedule['items'] ?? '[]'), true) ?: [],
                'transition' => $schedule['transition'] ?? 'none',
                'transition_duration' => $schedule['transition_duration'] ?? 0,
            ];
        }

        if (!empty($device['current_playlist_id'])) {
            $playlist = $this->db->fetch(
                "SELECT id AS playlist_id, items, transition, transition_duration FROM playlists WHERE id = ? LIMIT 1",
                [$device['current_playlist_id']]
            );
            if ($playlist) {
                return [
                    'playlist_id' => $playlist['playlist_id'] ?? $device['current_playlist_id'],
                    'items' => json_decode((string)($playlist['items'] ?? '[]'), true) ?: [],
                    'transition' => $playlist['transition'] ?? 'none',
                    'transition_duration' => $playlist['transition_duration'] ?? 0,
                ];
            }
        }

        return [
            'playlist_id' => null,
            'items' => [],
            'transition' => 'none',
            'transition_duration' => 0,
        ];
    }

    private function resolveVideoSources(array $items, string $companyId): array
    {
        $sources = [];
        foreach ($items as $item) {
            $itemType = strtolower((string)($item['type'] ?? ''));
            if ($itemType !== 'video') {
                continue;
            }

            $mediaId = (string)($item['media_id'] ?? $item['id'] ?? '');
            if ($mediaId === '') {
                continue;
            }

            $media = null;
            if ($companyId !== '') {
                $media = $this->db->fetch(
                    "SELECT id, company_id, file_path FROM media WHERE id = ? AND company_id = ?",
                    [$mediaId, $companyId]
                );
            }
            if (!$media) {
                // Legacy rows may not carry company_id consistently.
                $media = $this->db->fetch(
                    "SELECT id, company_id, file_path FROM media WHERE id = ?",
                    [$mediaId]
                );
            }
            if (!$media || empty($media['file_path'])) {
                continue;
            }

            $path = $this->resolveMediaPath((string)$media['file_path']);
            if (!is_file($path)) {
                continue;
            }

            $duration = 0.0;
            $itemDuration = (float)($item['duration'] ?? 0);
            if ($itemDuration > 0) {
                $duration = $itemDuration;
            } else {
                $duration = $this->probeDuration($path);
            }
            if ($duration <= 0) {
                $duration = 10.0;
            }

            $sources[] = [
                'media_id' => $mediaId,
                'path' => $path,
                'duration' => $duration,
            ];
        }

        return $sources;
    }

    private function resolveMediaPath(string $filePath): string
    {
        if (preg_match('/^[A-Za-z]:/', $filePath)) {
            return str_replace('/', DIRECTORY_SEPARATOR, $filePath);
        }

        if (str_starts_with($filePath, 'storage/')) {
            return (defined('BASE_PATH') ? BASE_PATH : dirname(__DIR__)) . '/' . ltrim($filePath, '/');
        }

        return (defined('BASE_PATH') ? BASE_PATH : dirname(__DIR__)) . '/storage/' . ltrim($filePath, '/');
    }

    private function probeDuration(string $path): float
    {
        $cmd = sprintf(
            '%s -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 %s 2>&1',
            escapeshellarg($this->ffprobePath),
            escapeshellarg($path)
        );
        $out = [];
        $code = 0;
        @exec($cmd, $out, $code);
        if ($code !== 0 || empty($out)) {
            return 0.0;
        }
        $raw = trim((string)$out[0]);
        $duration = (float)$raw;
        return $duration > 0 ? $duration : 0.0;
    }

    private function normalizeTransition(string $transition): string
    {
        $t = strtolower(trim($transition));
        if ($t === '' || $t === 'none') {
            return 'none';
        }

        $allowed = [
            'fade',
            'wipe-up',
            'wipe-down',
            'wipe-left',
            'wipe-right',
            'slide-left',
            'slide-right',
            'slide-up',
            'slide-down',
        ];

        return in_array($t, $allowed, true) ? $t : 'fade';
    }

    private function normalizeTransitionDuration($value): float
    {
        $raw = (float)$value;
        if ($raw <= 0) {
            return 0.0;
        }
        // Playlist UI commonly stores milliseconds.
        if ($raw > 20) {
            $raw /= 1000.0;
        }
        return min(3.0, max(0.2, $raw));
    }

    private function mapTransitionToXfade(string $transition): string
    {
        return match ($transition) {
            'wipe-up' => 'wipeup',
            'wipe-down' => 'wipedown',
            'wipe-left' => 'wipeleft',
            'wipe-right' => 'wiperight',
            'slide-left' => 'slideleft',
            'slide-right' => 'slideright',
            'slide-up' => 'slideup',
            'slide-down' => 'slidedown',
            'fade' => 'fade',
            default => 'fade',
        };
    }

    private function runCommand(string $cmd, string $logPath): array
    {
        $output = [];
        $code = 0;
        @exec($cmd, $output, $code);
        if (!empty($output)) {
            @file_put_contents($logPath, "[" . date('c') . "]\n" . implode("\n", $output) . "\n\n", FILE_APPEND);
        }
        return [
            'ok' => ($code === 0),
            'code' => $code,
            'error' => $code === 0 ? '' : implode("\n", array_slice($output, -12)),
        ];
    }

    private function startDetachedProcess(string $cmd, string $logPath, string $token, string $profile): int
    {
        if (DIRECTORY_SEPARATOR === '\\') {
            $title = 'omnex-channel-' . substr($token, 0, 16) . '-' . $profile;
            $runnerPath = dirname($logPath) . '/run_encoder.cmd';
            $runnerContent = "@echo off\r\n" .
                $cmd . ' >> "' . str_replace('/', '\\', $logPath) . "\" 2>&1\r\n";
            @file_put_contents($runnerPath, $runnerContent);

            $winCmd = 'start "' . $title . '" /B cmd /c "' . str_replace('/', '\\', $runnerPath) . '"';
            @pclose(@popen($winCmd, 'r'));
            // Windows detached mode does not provide stable PID here.
            return 0;
        }

        $wrapped = 'nohup ' . $cmd . ' >> ' . escapeshellarg($logPath) . ' 2>&1 & echo $!';
        $out = [];
        $code = 0;
        @exec($wrapped, $out, $code);
        if ($code !== 0 || empty($out)) {
            return -1;
        }

        $pid = (int)trim((string)$out[0]);
        return $pid > 0 ? $pid : -1;
    }

    private function stopEncoder(int $pid, string $token, string $profile): bool
    {
        if (DIRECTORY_SEPARATOR === '\\') {
            // Best-effort stop by image name on Windows host.
            @exec('taskkill /F /IM ffmpeg.exe >NUL 2>&1');
            return true;
        }

        if ($pid > 0) {
            @exec('kill -TERM ' . (int)$pid . ' 2>/dev/null');
            usleep(200000);
            if ($this->isPidRunning($pid)) {
                @exec('kill -KILL ' . (int)$pid . ' 2>/dev/null');
            }
        }
        return true;
    }

    private function isLikelyRunning(string $token, string $profile, array $state): bool
    {
        if (DIRECTORY_SEPARATOR === '\\') {
            $playlistPath = $this->getChannelPlaylistPath($token, $profile);
            if (!is_file($playlistPath)) {
                return false;
            }
            $age = time() - (int)@filemtime($playlistPath);
            return $age <= max(20, $this->segmentDuration * 3);
        }

        $pid = (int)($state['pid'] ?? 0);
        return $pid > 0 && $this->isPidRunning($pid);
    }

    private function isPidRunning(int $pid): bool
    {
        if ($pid <= 0) {
            return false;
        }
        @exec('kill -0 ' . (int)$pid . ' 2>/dev/null', $out, $code);
        return $code === 0;
    }

    private function readLastRequestAt(string $token, string $profile): int
    {
        $path = $this->getChannelDir($token, $profile) . '/last_request_at.txt';
        if (!is_file($path)) {
            return 0;
        }
        $raw = trim((string)@file_get_contents($path));
        return (int)$raw;
    }

    private function getRequestPath(string $token, string $profile): string
    {
        return $this->requestsDir . '/' . $token . '_' . $profile . '.json';
    }

    private function readState(string $token, string $profile): ?array
    {
        $path = $this->getChannelDir($token, $profile) . '/state.json';
        if (!is_file($path)) {
            return null;
        }
        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    private function writeState(string $token, string $profile, array $state): void
    {
        $state['updated_at'] = date('c');
        $path = $this->getChannelDir($token, $profile) . '/state.json';
        $this->safeWriteJson($path, $state);
    }

    private function safeWriteJson(string $path, array $payload): void
    {
        $tmp = $path . '.tmp';
        @file_put_contents($tmp, json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
        @rename($tmp, $path);
    }

    private function escapeArg(string $value): string
    {
        if (DIRECTORY_SEPARATOR === '\\') {
            return '"' . str_replace('"', '\"', $value) . '"';
        }
        return escapeshellarg($value);
    }

    private function escapeSegmentPatternArg(string $value): string
    {
        if (DIRECTORY_SEPARATOR === '\\') {
            // cmd.exe expands %VAR%; keep ffmpeg pattern literal.
            $value = str_replace('%', '%%', $value);
        }
        return $this->escapeArg($value);
    }

    private function ensureDir(string $dir): void
    {
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
    }
}
