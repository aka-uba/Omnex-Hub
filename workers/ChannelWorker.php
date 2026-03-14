<?php
/**
 * ChannelWorker - Continuous HLS channel pipeline worker
 *
 * Usage:
 *   php workers/ChannelWorker.php --daemon
 *   php workers/ChannelWorker.php --once
 *   php workers/ChannelWorker.php --status
 *   php workers/ChannelWorker.php --once --token=<stream_token> --profile=720p [--force]
 */

require_once dirname(__DIR__) . '/config.php';

class ChannelWorker
{
    private StreamChannelService $channelService;
    private bool $running = true;
    private int $pollInterval = 3;
    private int $processedCount = 0;

    public function __construct()
    {
        $this->channelService = new StreamChannelService();
    }

    public function runDaemon(): void
    {
        $this->log('ChannelWorker started (daemon mode)');
        $this->log('Channel mode: ' . (StreamChannelService::isChannelModeEnabled() ? 'enabled' : 'disabled'));

        if (function_exists('pcntl_signal')) {
            pcntl_signal(SIGTERM, function (): void { $this->running = false; });
            pcntl_signal(SIGINT, function (): void { $this->running = false; });
            // Auto-reap zombie child processes (ffmpeg)
            pcntl_signal(SIGCHLD, SIG_DFL);
        }

        while ($this->running) {
            try {
                // Reap any zombie child processes
                if (function_exists('pcntl_waitpid')) {
                    while (pcntl_waitpid(-1, $wstatus, WNOHANG) > 0) {
                        // reaped a zombie
                    }
                }

                $processed = $this->processQueuedRequests();
                $pruned = $this->channelService->pruneIdleChannels();

                // Always sleep - prevents tight CPU loop when channels are active
                sleep($this->pollInterval);
            } catch (\Throwable $e) {
                $this->log('Worker error: ' . $e->getMessage(), 'error');
                sleep($this->pollInterval * 2);
            }

            if (function_exists('pcntl_signal_dispatch')) {
                pcntl_signal_dispatch();
            }
        }

        $this->log('ChannelWorker stopped. processed=' . $this->processedCount);
    }

    public function runOnce(?string $token = null, ?string $profile = null, bool $force = false): void
    {
        if ($token !== null && $token !== '') {
            $processed = $this->ensureSingleChannel($token, $profile ?? '720p', $force);
            $pruned = $this->channelService->pruneIdleChannels();
            echo "Single ensure completed. processed={$processed}, pruned={$pruned}\n";
            return;
        }

        $processed = $this->processQueuedRequests();
        $pruned = $this->channelService->pruneIdleChannels();
        echo "Queued requests processed={$processed}, pruned={$pruned}\n";
    }

    public function showStatus(): void
    {
        $states = $this->channelService->listChannelStates();
        $running = 0;
        foreach ($states as $state) {
            if (!empty($state['is_running'])) {
                $running++;
            }
        }

        echo "\n=== Channel Worker Status ===\n";
        echo 'Channel mode: ' . (StreamChannelService::isChannelModeEnabled() ? 'enabled' : 'disabled') . "\n";
        echo 'Tracked channels: ' . count($states) . "\n";
        echo 'Running encoders: ' . $running . "\n";
        foreach ($states as $state) {
            $token = (string)($state['token'] ?? '');
            $profile = (string)($state['profile'] ?? '');
            $pid = (int)($state['pid'] ?? 0);
            $hash = (string)($state['playlist_hash'] ?? '');
            $hashShort = $hash !== '' ? substr($hash, 0, 12) : '-';
            $isRunning = !empty($state['is_running']) ? 'yes' : 'no';
            echo sprintf(
                "  - token=%s profile=%s running=%s pid=%d hash=%s\n",
                substr($token, 0, 16),
                $profile,
                $isRunning,
                $pid,
                $hashShort
            );
        }
        echo "=============================\n\n";
    }

    private function processQueuedRequests(): int
    {
        $requests = $this->channelService->consumeBuildRequests();
        if (empty($requests)) {
            return 0;
        }

        $processed = 0;
        foreach ($requests as $req) {
            $token = (string)($req['token'] ?? '');
            $profile = (string)($req['profile'] ?? '720p');
            $force = !empty($req['force']);
            if ($token === '') {
                continue;
            }

            $processed += $this->ensureSingleChannel($token, $profile, $force);
        }

        $this->processedCount += $processed;
        return $processed;
    }

    private function ensureSingleChannel(string $token, string $profile, bool $force): int
    {
        $device = $this->channelService->getDeviceByToken($token);
        if (!$device) {
            $this->log("Skip: invalid token {$token}", 'warning');
            return 0;
        }

        $result = $this->channelService->ensureChannel($device, $profile, $force);
        if (!empty($result['ok'])) {
            $pid = (int)($result['pid'] ?? 0);
            $rebuild = !empty($result['rebuild']) ? 'yes' : 'no';
            $started = !empty($result['started']) ? 'yes' : 'no';
            $this->log("Channel ensured token={$token} profile={$profile} rebuild={$rebuild} started={$started} pid={$pid}");
            return 1;
        }

        $reason = (string)($result['reason'] ?? 'unknown');
        $error = trim((string)($result['error'] ?? ''));
        $suffix = $error !== '' ? " error={$error}" : '';
        $this->log("Channel ensure failed token={$token} profile={$profile} reason={$reason}{$suffix}", 'warning');
        return 0;
    }

    private function log(string $message, string $level = 'info'): void
    {
        $ts = date('Y-m-d H:i:s');
        $prefix = strtoupper($level);
        echo "[{$ts}] [{$prefix}] {$message}\n";

        if (!class_exists('Logger')) {
            return;
        }

        try {
            $line = "[ChannelWorker] {$message}";
            if ($level === 'error') {
                Logger::error($line);
            } elseif ($level === 'warning' || $level === 'warn') {
                Logger::warning($line);
            } elseif ($level === 'debug') {
                Logger::debug($line);
            } else {
                Logger::info($line);
            }
        } catch (\Throwable $e) {
            error_log('[ChannelWorker] logger forward failed: ' . $e->getMessage());
        }
    }
}

if (php_sapi_name() === 'cli') {
    $worker = new ChannelWorker();
    $args = $argv ?? [];

    $token = null;
    $profile = null;
    foreach ($args as $arg) {
        if (str_starts_with($arg, '--token=')) {
            $token = (string)substr($arg, 8);
        } elseif (str_starts_with($arg, '--profile=')) {
            $profile = (string)substr($arg, 10);
        }
    }
    $force = in_array('--force', $args, true);

    if (in_array('--status', $args, true)) {
        $worker->showStatus();
    } elseif (in_array('--once', $args, true)) {
        $worker->runOnce($token, $profile, $force);
    } elseif (in_array('--daemon', $args, true) || count($args) <= 1) {
        $worker->runDaemon();
    } else {
        echo "Usage:\n";
        echo "  php workers/ChannelWorker.php --daemon\n";
        echo "  php workers/ChannelWorker.php --once\n";
        echo "  php workers/ChannelWorker.php --once --token=<token> --profile=720p [--force]\n";
        echo "  php workers/ChannelWorker.php --status\n";
    }
}
