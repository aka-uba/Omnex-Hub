<?php
/**
 * TranscodeQueueService - Video transcode kuyruk yonetimi
 * RenderQueueService patternini takip eder
 *
 * @package OmnexDisplayHub
 */

class TranscodeQueueService
{
    private Database $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * Yeni transcode isi kuyruge ekler
     */
    public function enqueue(string $mediaId, string $companyId, ?array $profiles = null): string
    {
        // Media bilgisini al
        $media = $this->db->fetch(
            "SELECT * FROM media WHERE id = ? AND (company_id = ? OR company_id IS NULL)",
            [$mediaId, $companyId]
        );

        if (!$media) {
            throw new \Exception("Medya bulunamadi: $mediaId");
        }

        // Video olmali
        if (($media['file_type'] ?? '') !== 'video') {
            throw new \Exception("Sadece video dosyalari transcode edilebilir");
        }

        // Zaten kuyrukta mi kontrol et
        $existing = $this->db->fetch(
            "SELECT id, status FROM transcode_queue WHERE media_id = ? AND company_id = ? AND status IN ('pending','processing')",
            [$mediaId, $companyId]
        );

        if ($existing) {
            return $existing['id']; // Mevcut job ID dondur
        }

        // Dosya yolunu coz
        $inputPath = $this->resolveMediaPath($media);
        if (!file_exists($inputPath)) {
            throw new \Exception("Dosya bulunamadi: $inputPath");
        }

        $profiles = $this->resolveProfiles($profiles, $inputPath);

        $streamStoragePath = defined('STREAM_STORAGE_PATH') ? STREAM_STORAGE_PATH : (defined('STORAGE_PATH') ? STORAGE_PATH . '/streams' : 'storage/streams');
        $outputDir = $streamStoragePath . '/' . $companyId . '/' . $mediaId;

        $id = $this->db->generateUuid();

        $this->db->insert('transcode_queue', [
            'id' => $id,
            'company_id' => $companyId,
            'media_id' => $mediaId,
            'status' => 'pending',
            'priority' => 0,
            'input_path' => $inputPath,
            'output_dir' => $outputDir,
            'profiles' => json_encode($profiles),
            'progress' => 0,
            'file_size_bytes' => (int)($media['file_size'] ?? filesize($inputPath)),
            'retry_count' => 0,
            'max_retries' => 3,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        return $id;
    }

    /**
     * Kuyruktan islenmemis bir is alir (atomic claim)
     */
    public function dequeue(?string $companyId = null): ?array
    {
        // Concurrent transcode limiti kontrol
        $maxConcurrent = defined('STREAM_MAX_CONCURRENT_TRANSCODE') ? STREAM_MAX_CONCURRENT_TRANSCODE : 2;
        $processing = $this->db->fetch(
            "SELECT COUNT(*) as cnt FROM transcode_queue WHERE status = 'processing'",
            []
        );
        if (($processing['cnt'] ?? 0) >= $maxConcurrent) {
            return null;
        }

        // Sonraki isi al (priority DESC, created_at ASC)
        $params = [];
        $where = "status = 'pending'";
        if ($companyId) {
            $where .= " AND company_id = ?";
            $params[] = $companyId;
        }

        $job = $this->db->fetch(
            "SELECT * FROM transcode_queue WHERE $where ORDER BY priority DESC, created_at ASC LIMIT 1",
            $params
        );

        if (!$job) return null;

        // Atomic claim: pending -> processing
        $this->db->query(
            "UPDATE transcode_queue SET status = 'processing', started_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
            [date('Y-m-d H:i:s'), date('Y-m-d H:i:s'), $job['id']]
        );
        $affected = $this->db->rowCount();

        if (!$affected) return null; // Baska worker kapmis

        $job['status'] = 'processing';
        $job['profiles'] = json_decode($job['profiles'] ?? '["720p"]', true);

        return $job;
    }

    /**
     * Is ilerlemesini gunceller
     */
    public function updateProgress(string $queueId, int $progress): void
    {
        $this->db->query(
            "UPDATE transcode_queue SET progress = ?, updated_at = ? WHERE id = ?",
            [min(100, max(0, $progress)), date('Y-m-d H:i:s'), $queueId]
        );
    }

    /**
     * Isi basarili olarak tamamlar ve variant kayitlarini olusturur
     */
    public function markCompleted(string $queueId, array $results): void
    {
        $job = $this->db->fetch("SELECT * FROM transcode_queue WHERE id = ?", [$queueId]);
        if (!$job) return;

        // Variant kayitlarini olustur
        foreach ($results as $profileName => $result) {
            if (($result['status'] ?? '') !== 'completed') continue;

            // Onceki variant varsa guncelle, yoksa olustur
            $existingVariant = $this->db->fetch(
                "SELECT id FROM transcode_variants WHERE media_id = ? AND company_id = ? AND profile = ?",
                [$job['media_id'], $job['company_id'], $profileName]
            );

            $variantData = [
                'media_id' => $job['media_id'],
                'company_id' => $job['company_id'],
                'profile' => $profileName,
                'resolution' => $result['resolution'] ?? null,
                'bitrate' => $result['bitrate'] ?? null,
                'codec' => $result['codec'] ?? 'h264',
                'segment_duration' => $result['segment_duration'] ?? 6,
                'playlist_path' => $result['playlist_path'] ?? null,
                'segment_count' => $result['segment_count'] ?? 0,
                'total_size_bytes' => $result['total_size'] ?? 0,
                'status' => 'ready',
                'updated_at' => date('Y-m-d H:i:s'),
            ];

            if ($existingVariant) {
                $this->db->update('transcode_variants', $variantData, 'id = ?', [$existingVariant['id']]);
            } else {
                $variantData['id'] = $this->db->generateUuid();
                $variantData['created_at'] = date('Y-m-d H:i:s');
                $this->db->insert('transcode_variants', $variantData);
            }
        }

        // Queue job guncelle
        $this->db->update('transcode_queue', [
            'status' => 'completed',
            'progress' => 100,
            'completed_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ], 'id = ?', [$queueId]);
    }

    /**
     * Isi basarisiz olarak isaretler
     */
    public function markFailed(string $queueId, string $error): void
    {
        $job = $this->db->fetch("SELECT * FROM transcode_queue WHERE id = ?", [$queueId]);
        if (!$job) return;

        $retryCount = (int)($job['retry_count'] ?? 0) + 1;
        $maxRetries = (int)($job['max_retries'] ?? 3);

        if ($retryCount < $maxRetries) {
            // Retry: pending'e geri al (exponential backoff)
            $this->db->update('transcode_queue', [
                'status' => 'pending',
                'error_message' => $error,
                'retry_count' => $retryCount,
                'progress' => 0,
                'started_at' => null,
                'updated_at' => date('Y-m-d H:i:s'),
            ], 'id = ?', [$queueId]);
        } else {
            // Max retry asildi, kalici hata
            $this->db->update('transcode_queue', [
                'status' => 'failed',
                'error_message' => $error,
                'retry_count' => $retryCount,
                'completed_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ], 'id = ?', [$queueId]);
        }
    }

    /**
     * Belirli bir media icin transcode durumunu getirir
     */
    public function getStatus(string $mediaId): ?array
    {
        $job = $this->db->fetch(
            "SELECT * FROM transcode_queue WHERE media_id = ? ORDER BY created_at DESC LIMIT 1",
            [$mediaId]
        );

        if (!$job) return null;

        $variants = $this->db->fetchAll(
            "SELECT * FROM transcode_variants WHERE media_id = ? ORDER BY profile ASC",
            [$mediaId]
        );

        $job['variants'] = $variants;
        $job['profiles'] = json_decode($job['profiles'] ?? '[]', true);

        return $job;
    }

    /**
     * Media icin hazir HLS variant'lari getirir
     */
    public function getReadyVariants(string $mediaId): array
    {
        return $this->db->fetchAll(
            "SELECT * FROM transcode_variants WHERE media_id = ? AND status = 'ready' ORDER BY bitrate ASC",
            [$mediaId]
        );
    }

    /**
     * Kuyruk istatistiklerini getirir
     */
    public function getQueueStats(?string $companyId = null): array
    {
        $where = $companyId ? "WHERE company_id = ?" : "";
        $params = $companyId ? [$companyId] : [];

        $stats = $this->db->fetch(
            "SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
            FROM transcode_queue $where",
            $params
        );

        $variantStats = $this->db->fetch(
            "SELECT
                COUNT(*) as total_variants,
                SUM(CASE WHEN status='ready' THEN 1 ELSE 0 END) as ready_variants,
                SUM(total_size_bytes) as total_storage_bytes
            FROM transcode_variants " . ($companyId ? "WHERE company_id = ?" : ""),
            $params
        );

        return array_merge($stats ?? [], $variantStats ?? []);
    }

    /**
     * Video upload sonrasi otomatik transcode baslat
     */
    public function autoEnqueueOnUpload(string $mediaId, string $companyId): ?string
    {
        try {
            return $this->enqueue($mediaId, $companyId);
        } catch (\Exception $e) {
            error_log("Auto-enqueue failed for media $mediaId: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Basarisiz isi yeniden kuyruge al
     */
    public function retryFailed(string $queueId): bool
    {
        $job = $this->db->fetch(
            "SELECT * FROM transcode_queue WHERE id = ? AND status = 'failed'",
            [$queueId]
        );

        if (!$job) return false;

        $this->db->update('transcode_queue', [
            'status' => 'pending',
            'progress' => 0,
            'error_message' => null,
            'retry_count' => 0,
            'started_at' => null,
            'completed_at' => null,
            'updated_at' => date('Y-m-d H:i:s'),
        ], 'id = ?', [$queueId]);

        return true;
    }

    /**
     * Kuyruk isi icin profil listesini normalize eder.
     * Profil verilmezse kaynak video cozunurlugune gore otomatik profil secer.
     */
    private function resolveProfiles(?array $profiles, string $inputPath): array
    {
        $validProfiles = array_keys(HlsTranscoder::PROFILES);
        $defaultProfile = defined('STREAM_DEFAULT_PROFILE') ? STREAM_DEFAULT_PROFILE : '720p';

        if (!$profiles || empty($profiles)) {
            try {
                $transcoder = new HlsTranscoder();
                $ffInfo = $transcoder->detectFfmpeg();
                if ($ffInfo['available']) {
                    $videoInfo = $transcoder->getVideoInfo($inputPath);
                    $autoProfiles = $transcoder->getAvailableProfiles((int)($videoInfo['height'] ?? 0));
                    $profiles = array_values(array_unique($autoProfiles));
                }
            } catch (\Throwable $e) {
                error_log('Transcode auto-profile detection failed: ' . $e->getMessage());
            }
        }

        if (!$profiles || empty($profiles)) {
            $profiles = [$defaultProfile];
        }

        $profiles = array_values(array_unique(array_map(static function ($p) {
            return is_string($p) ? trim($p) : '';
        }, $profiles)));
        $profiles = array_values(array_filter($profiles, static function ($p) {
            return $p !== '';
        }));

        foreach ($profiles as $profile) {
            if (!in_array($profile, $validProfiles, true)) {
                throw new \Exception("Gecersiz profil: {$profile}");
            }
        }

        return $profiles;
    }

    /**
     * Medya dosya yolunu cozumler (Windows path, relative path vb.)
     */
    private function resolveMediaPath(array $media): string
    {
        $filePath = $media['file_path'] ?? '';

        // Absolute path (Windows)
        if (preg_match('/^[A-Za-z]:/', $filePath)) {
            return str_replace('/', DIRECTORY_SEPARATOR, $filePath);
        }

        // storage/ prefix ile
        if (strpos($filePath, 'storage/') === 0) {
            return defined('BASE_PATH') ? BASE_PATH . '/' . $filePath : $filePath;
        }

        // Relative path
        $basePath = defined('BASE_PATH') ? BASE_PATH : dirname(__DIR__);
        return $basePath . '/storage/' . ltrim($filePath, '/');
    }

    /**
     * Bir media'nin tum transcode verilerini temizler
     */
    public function cleanupMedia(string $mediaId): void
    {
        // Variant dosyalarini sil
        $variants = $this->db->fetchAll(
            "SELECT * FROM transcode_variants WHERE media_id = ?",
            [$mediaId]
        );

        foreach ($variants as $variant) {
            if (!empty($variant['playlist_path'])) {
                $dir = dirname($variant['playlist_path']);
                if (is_dir($dir)) {
                    $transcoder = new HlsTranscoder();
                    $transcoder->cleanup($dir);
                }
            }
        }

        // DB kayitlarini sil
        $this->db->query("DELETE FROM transcode_variants WHERE media_id = ?", [$mediaId]);
        $this->db->query("DELETE FROM transcode_queue WHERE media_id = ?", [$mediaId]);
    }
}
