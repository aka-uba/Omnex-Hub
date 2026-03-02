<?php
/**
 * JsonParser - JSON File Parser
 *
 * @package OmnexDisplayHub
 */

class OmnexJsonParser extends OmnexBaseParser
{
    protected string $type = 'json';
    protected ?string $dataPath = null;

    public function __construct()
    {
        $this->config = [
            'dataPath' => null,      // JSON path to data array (e.g., "data.products")
            'encoding' => 'UTF-8'
        ];
    }

    /**
     * Configure parser
     */
    public function configure(array $options): self
    {
        parent::configure($options);
        $this->dataPath = $options['dataPath'] ?? null;
        return $this;
    }

    /**
     * Check if content is JSON
     */
    public function supports(string $content): bool
    {
        $content = trim($content);
        if (!str_starts_with($content, '{') && !str_starts_with($content, '[')) {
            return false;
        }

        json_decode($content);
        return json_last_error() === JSON_ERROR_NONE;
    }

    /**
     * Parse JSON content
     */
    public function parse(string $content): array
    {
        $this->clearMessages();

        // Ensure UTF-8
        $content = $this->ensureUtf8($content);

        // Decode JSON
        $data = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->errors[] = 'JSON parse error: ' . json_last_error_msg();
            return [];
        }

        // Navigate to data path if specified
        if ($this->dataPath) {
            $data = $this->getNestedValue($data, $this->dataPath);
            if ($data === null) {
                $this->errors[] = "Data path not found: {$this->dataPath}";
                return [];
            }
        }

        // Ensure we have an array of items
        if (!is_array($data)) {
            $this->errors[] = 'JSON data must be an array';
            return [];
        }

        // Check if it's an associative array (single item)
        if ($this->isAssociative($data)) {
            $data = [$data];
        }

        return $data;
    }

    /**
     * Get nested value using dot notation
     */
    private function getNestedValue(array $data, string $path): mixed
    {
        $keys = explode('.', $path);

        foreach ($keys as $key) {
            if (!is_array($data) || !isset($data[$key])) {
                return null;
            }
            $data = $data[$key];
        }

        return $data;
    }

    /**
     * Check if array is associative
     */
    private function isAssociative(array $arr): bool
    {
        if (empty($arr)) {
            return false;
        }
        return array_keys($arr) !== range(0, count($arr) - 1);
    }
}
