<?php
/**
 * TxtParser - Delimited Text File Parser
 *
 * Supports auto-detection of delimiter (TAB, semicolon, comma, pipe)
 *
 * @package OmnexDisplayHub
 */

class OmnexTxtParser extends OmnexBaseParser
{
    protected string $type = 'txt';
    protected string $delimiter = ';';
    protected bool $hasHeader = true;
    protected int $skipLines = 0;
    protected ?string $enclosure = '"';
    protected ?string $escape = '\\';
    protected bool $autoDetectDelimiter = true;

    public function __construct()
    {
        $this->config = [
            'delimiter' => ';',
            'hasHeader' => true,
            'skipLines' => 0,
            'enclosure' => '"',
            'escape' => '\\',
            'autoDetectDelimiter' => true
        ];
    }

    /**
     * Configure parser
     */
    public function configure(array $options): self
    {
        parent::configure($options);

        $this->delimiter = $options['delimiter'] ?? ';';
        $this->hasHeader = $options['hasHeader'] ?? true;
        $this->skipLines = (int) ($options['skipLines'] ?? 0);
        $this->enclosure = $options['enclosure'] ?? '"';
        $this->escape = $options['escape'] ?? '\\';
        $this->autoDetectDelimiter = $options['autoDetectDelimiter'] ?? true;

        return $this;
    }

    /**
     * Check if content can be parsed as delimited text
     * Now supports auto-detection of delimiter
     */
    public function supports(string $content): bool
    {
        $firstLine = strtok(trim($content), "\n");

        // Try auto-detect delimiter
        $detectedDelimiter = self::detectDelimiter($content);

        // Check if any common delimiter exists
        return str_contains($firstLine, $detectedDelimiter) ||
               str_contains($firstLine, $this->delimiter) ||
               str_contains($firstLine, "\t") ||
               str_contains($firstLine, ";") ||
               str_contains($firstLine, ",") ||
               str_contains($firstLine, "|");
    }

    /**
     * Parse delimited text content
     */
    public function parse(string $content): array
    {
        $this->clearMessages();

        // Ensure UTF-8 and remove BOM
        $content = $this->ensureUtf8($content);
        $content = $this->removeBom($content);

        // Normalize line endings
        $content = str_replace(["\r\n", "\r"], "\n", $content);

        // Auto-detect delimiter if enabled
        if ($this->autoDetectDelimiter) {
            $this->delimiter = self::detectDelimiter($content);
        }

        // Split into lines
        $lines = explode("\n", $content);

        // Skip initial lines if configured
        if ($this->skipLines > 0) {
            $lines = array_slice($lines, $this->skipLines);
        }

        $data = [];
        $headers = [];
        $lineNumber = 0;

        foreach ($lines as $index => $line) {
            $line = trim($line);

            // Skip empty lines
            if (empty($line)) {
                continue;
            }

            $lineNumber++;

            // Parse line values
            $values = $this->parseLine($line);

            // First non-empty line is header if configured
            if ($this->hasHeader && empty($headers)) {
                $headers = array_map('trim', $values);
                // Clean header names
                $headers = array_map(function ($h) {
                    // Remove BOM and special chars from headers
                    $h = preg_replace('/[\x00-\x1F\x7F]/', '', $h);
                    return trim($h);
                }, $headers);
                continue;
            }

            // Create row data
            if ($this->hasHeader && !empty($headers)) {
                $row = [];
                foreach ($headers as $i => $header) {
                    if ($header !== '') {
                        $row[$header] = $values[$i] ?? null;
                    }
                }
                $data[] = $row;
            } else {
                $data[] = $values;
            }
        }

        return $data;
    }

    /**
     * Parse a single line respecting enclosure
     */
    protected function parseLine(string $line): array
    {
        // Use str_getcsv for proper parsing
        return str_getcsv($line, $this->delimiter, $this->enclosure, $this->escape);
    }

    /**
     * Auto-detect delimiter from content
     * Priority: TAB > Semicolon > Comma > Pipe (based on count)
     */
    public static function detectDelimiter(string $content): string
    {
        // Get first few lines for better detection
        $lines = explode("\n", trim($content));
        $sampleLines = array_slice($lines, 0, min(5, count($lines)));
        $firstLine = $sampleLines[0] ?? '';

        $delimiters = [
            "\t" => 0,  // TAB - most common in ERP exports
            ';' => 0,   // Semicolon
            ',' => 0,   // Comma
            '|' => 0    // Pipe
        ];

        // Count delimiters in first line
        foreach ($delimiters as $d => &$count) {
            $count = substr_count($firstLine, $d);
        }

        // Find delimiter with highest count
        arsort($delimiters);

        // Get the best delimiter
        $bestDelimiter = key($delimiters);
        $bestCount = current($delimiters);

        // If no delimiter found or count is 0, default to semicolon
        if ($bestCount === 0) {
            return ';';
        }

        return $bestDelimiter;
    }

    /**
     * Remove BOM (Byte Order Mark) from content
     */
    protected function removeBom(string $content): string
    {
        // UTF-8 BOM
        if (substr($content, 0, 3) === "\xEF\xBB\xBF") {
            $content = substr($content, 3);
        }
        // UTF-16 LE BOM
        elseif (substr($content, 0, 2) === "\xFF\xFE") {
            $content = substr($content, 2);
        }
        // UTF-16 BE BOM
        elseif (substr($content, 0, 2) === "\xFE\xFF") {
            $content = substr($content, 2);
        }
        // UTF-32 LE BOM
        elseif (substr($content, 0, 4) === "\xFF\xFE\x00\x00") {
            $content = substr($content, 4);
        }
        // UTF-32 BE BOM
        elseif (substr($content, 0, 4) === "\x00\x00\xFE\xFF") {
            $content = substr($content, 4);
        }

        return $content;
    }
}
