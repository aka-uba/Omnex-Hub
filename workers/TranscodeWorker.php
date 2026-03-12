<?php
/**
 * TranscodeWorker - Arka plan video transcode worker
 * RenderQueueWorker patternini takip eder
 *
 * Kullanim:
 *   php workers/TranscodeWorker.php --daemon    # Surekli calis
 *   php workers/TranscodeWorker.php --once      # Tek is isle
 *   php workers/TranscodeWorker.php --status    # Kuyruk durumu
 *
 * @package OmnexDisplayHub
 */

require_once dirname(__DIR__) . '/config.php';

class TranscodeWorker
{
    private TranscodeQueueService $queueService;
    private HlsTranscoder $transcoder;
    private bool $running = true;
    private int $pollInterval = 5; // saniye
    private int $processedCount = 0;

    public function __construct()
    {
        $this->queueService = new TranscodeQueueService();
        $this->transcoder = new HlsTranscoder();
    }

    /**
     * Worker'i daemon modunda baslatir
     */
    public function runDaemon(): void
    {
        $this->log("TranscodeWorker baslatildi (daemon modu)");

        // FFmpeg kontrolu
        $ffInfo = $this->transcoder->detectFfmpeg();
        if (!$ffInfo['available']) {
            $this->log("HATA: FFmpeg bulunamadi! Path: {$ffInfo['path']}", 'error');
            exit(1);
        }
        $this->log("FFmpeg bulundu: {$ffInfo['version']}");

        // Graceful shutdown
        if (function_exists('pcntl_signal')) {
            pcntl_signal(SIGTERM, function () { $this->running = false; });
            pcntl_signal(SIGINT, function () { $this->running = false; });
        }

        while ($this->running) {
            try {
                $processed = $this->processOne();
                if (!$processed) {
                    sleep($this->pollInterval);
                }
            } catch (\Exception $e) {
                $this->log("Worker hata: " . $e->getMessage(), 'error');
                sleep($this->pollInterval * 2);
            }

            if (function_exists('pcntl_signal_dispatch')) {
                pcntl_signal_dispatch();
            }
        }

        $this->log("Worker durduruluyor. Toplam islenen: {$this->processedCount}");
    }

    /**
     * Tek bir is isle
     */
    public function processOne(): bool
    {
        $job = $this->queueService->dequeue();
        if (!$job) return false;

        $this->log("Is alindi: {$job['id']} (media: {$job['media_id']})");

        try {
            // Storage quota kontrolu
            if (class_exists('StorageService')) {
                $storageService = new StorageService();
                $videoInfo = $this->transcoder->getVideoInfo($job['input_path']);
                $estimatedSize = $this->transcoder->estimateOutputSize(
                    $videoInfo['duration'],
                    $job['profiles'] ?? ['720p']
                );
                $quotaCheck = $storageService->checkQuota($job['company_id'], $estimatedSize);
                if (!($quotaCheck['allowed'] ?? true)) {
                    throw new \Exception("Depolama kotasi yetersiz: " . ($quotaCheck['message'] ?? 'Quota exceeded'));
                }
            }

            // Transcode islemini baslat
            $this->queueService->updateProgress($job['id'], 5);

            $results = $this->transcoder->transcode(
                $job['input_path'],
                $job['output_dir'],
                $job['profiles'] ?? ['720p'],
                function ($pct, $profile) use ($job) {
                    // 5-95 arasi ilerleme (5=basladi, 95=bitmek uzere)
                    $mapped = 5 + (int)($pct * 0.9);
                    $this->queueService->updateProgress($job['id'], $mapped);
                    $this->log("  Profil {$profile}: %{$pct}");
                }
            );

            // Hata kontrolu
            $hasSuccess = false;
            $errors = [];
            foreach ($results as $profile => $result) {
                if ($result['status'] === 'completed') {
                    $hasSuccess = true;
                } elseif ($result['status'] === 'error') {
                    $errors[] = "{$profile}: {$result['message']}";
                }
            }

            if (!$hasSuccess) {
                throw new \Exception("Tum profiller basarisiz: " . implode('; ', $errors));
            }

            // Master playlist olustur
            $this->transcoder->generateMasterPlaylist($job['output_dir'], $results);
            $this->queueService->updateProgress($job['id'], 98);

            // Tamamla
            $this->queueService->markCompleted($job['id'], $results);
            $this->processedCount++;

            $this->log("Is tamamlandi: {$job['id']}");
            return true;

        } catch (\Exception $e) {
            $this->log("Is basarisiz: {$job['id']} - " . $e->getMessage(), 'error');
            $this->queueService->markFailed($job['id'], $e->getMessage());
            return true; // true dondur ki baska is denensin
        }
    }

    /**
     * Kuyruk durumunu goster
     */
    public function showStatus(): void
    {
        $stats = $this->queueService->getQueueStats();
        $ffInfo = $this->transcoder->detectFfmpeg();

        echo "\n=== Transcode Worker Durumu ===\n";
        echo "FFmpeg: " . ($ffInfo['available'] ? "OK ({$ffInfo['version']})" : "BULUNAMADI") . "\n";
        echo "Kuyruk:\n";
        echo "  Bekleyen:  " . ($stats['pending'] ?? 0) . "\n";
        echo "  Isleniyor: " . ($stats['processing'] ?? 0) . "\n";
        echo "  Tamamlanan: " . ($stats['completed'] ?? 0) . "\n";
        echo "  Basarisiz: " . ($stats['failed'] ?? 0) . "\n";
        echo "Variant'lar:\n";
        echo "  Hazir: " . ($stats['ready_variants'] ?? 0) . "\n";
        echo "  Toplam Boyut: " . $this->formatBytes((int)($stats['total_storage_bytes'] ?? 0)) . "\n";
        echo "================================\n\n";
    }

    private function log(string $message, string $level = 'info'): void
    {
        $ts = date('Y-m-d H:i:s');
        $prefix = strtoupper($level);
        echo "[{$ts}] [{$prefix}] {$message}\n";

        if (class_exists('Logger')) {
            try {
                $line = "[TranscodeWorker] {$message}";
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
                error_log('[TranscodeWorker] logger forward failed: ' . $e->getMessage());
            }
        }
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes >= 1073741824) return round($bytes / 1073741824, 2) . ' GB';
        if ($bytes >= 1048576) return round($bytes / 1048576, 2) . ' MB';
        if ($bytes >= 1024) return round($bytes / 1024, 2) . ' KB';
        return $bytes . ' B';
    }
}

// CLI calistirma
if (php_sapi_name() === 'cli') {
    $worker = new TranscodeWorker();
    $args = $argv ?? [];

    if (in_array('--status', $args)) {
        $worker->showStatus();
    } elseif (in_array('--once', $args)) {
        $result = $worker->processOne();
        echo $result ? "Bir is islendi.\n" : "Kuyrukta is yok.\n";
    } elseif (in_array('--daemon', $args) || count($args) <= 1) {
        $worker->runDaemon();
    } else {
        echo "Kullanim:\n";
        echo "  php TranscodeWorker.php --daemon   Surekli calis\n";
        echo "  php TranscodeWorker.php --once     Tek is isle\n";
        echo "  php TranscodeWorker.php --status   Kuyruk durumu\n";
    }
}
