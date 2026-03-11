<?php
/**
 * CompanyStorageService
 *
 * Ensures company storage directories and metadata file exist.
 */

class CompanyStorageService
{
    /**
     * Ensure company storage path and metadata file exist.
     *
     * @return array{company_id:string,base_path:string,created:array,existing:array,failed:array,meta_written:bool,meta_path:string}
     */
    public static function ensureForCompany(string $companyId): array
    {
        $companyId = trim($companyId);
        if ($companyId === '') {
            throw new InvalidArgumentException('Company ID is required');
        }

        $basePath = rtrim((string)STORAGE_PATH, '/\\') . DIRECTORY_SEPARATOR . 'companies' . DIRECTORY_SEPARATOR . $companyId;

        $directories = [
            $basePath,
            $basePath . DIRECTORY_SEPARATOR . 'branding',
            $basePath . DIRECTORY_SEPARATOR . 'media',
            $basePath . DIRECTORY_SEPARATOR . 'media' . DIRECTORY_SEPARATOR . date('Y'),
            $basePath . DIRECTORY_SEPARATOR . 'media' . DIRECTORY_SEPARATOR . date('Y') . DIRECTORY_SEPARATOR . date('m'),
            $basePath . DIRECTORY_SEPARATOR . 'templates',
            $basePath . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'renders',
            $basePath . DIRECTORY_SEPARATOR . 'renders',
            $basePath . DIRECTORY_SEPARATOR . 'exports',
            $basePath . DIRECTORY_SEPARATOR . 'imports',
            $basePath . DIRECTORY_SEPARATOR . 'imports' . DIRECTORY_SEPARATOR . 'processed',
            $basePath . DIRECTORY_SEPARATOR . 'imports' . DIRECTORY_SEPARATOR . 'failed',
            $basePath . DIRECTORY_SEPARATOR . 'temp',
        ];

        $created = [];
        $existing = [];
        $failed = [];

        foreach ($directories as $directory) {
            if (is_dir($directory)) {
                $existing[] = $directory;
                continue;
            }

            if (@mkdir($directory, 0755, true)) {
                $created[] = $directory;
            } else {
                $failed[] = $directory;
            }
        }

        $metaPath = $basePath . DIRECTORY_SEPARATOR . 'company.meta.json';
        $metaWritten = self::writeMetaFile($companyId, $metaPath);

        return [
            'company_id' => $companyId,
            'base_path' => $basePath,
            'created' => $created,
            'existing' => $existing,
            'failed' => $failed,
            'meta_written' => $metaWritten,
            'meta_path' => $metaPath,
        ];
    }

    /**
     * Write/update company meta file.
     */
    private static function writeMetaFile(string $companyId, string $metaPath): bool
    {
        $company = null;
        try {
            $db = Database::getInstance();
            $company = $db->fetch(
                "SELECT id, name, slug, status, created_at, updated_at FROM companies WHERE id = ?",
                [$companyId]
            );
        } catch (Throwable $e) {
            // Keep metadata write resilient even if DB read fails.
        }

        $payload = [
            'schema' => 'company-storage-meta-v1',
            'generated_at' => date('c'),
            'company' => [
                'id' => $companyId,
                'name' => $company['name'] ?? null,
                'slug' => $company['slug'] ?? null,
                'status' => $company['status'] ?? null,
                'created_at' => $company['created_at'] ?? null,
                'updated_at' => $company['updated_at'] ?? null,
            ],
        ];

        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            return false;
        }

        return @file_put_contents($metaPath, $json . PHP_EOL) !== false;
    }
}
