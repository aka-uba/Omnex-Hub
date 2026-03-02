<?php
/**
 * ParserFactory - Parser Auto-Detection and Creation
 *
 * @package OmnexDisplayHub
 */

class OmnexParserFactory
{
    /**
     * Registered parsers
     */
    private static array $parsers = [
        'json' => OmnexJsonParser::class,
        'txt' => OmnexTxtParser::class,
        'csv' => OmnexCsvParser::class,
        'xml' => OmnexXmlParser::class,
        'xlsx' => OmnexXlsxParser::class,
    ];

    /**
     * Create parser by type
     */
    public static function create(string $type): OmnexBaseParser
    {
        $type = strtolower($type);

        if (!isset(self::$parsers[$type])) {
            throw new Exception("Unsupported parser type: $type");
        }

        $class = self::$parsers[$type];
        return new $class();
    }

    /**
     * Auto-detect format and create appropriate parser
     */
    public static function autoDetect(string $content, ?string $filename = null): OmnexBaseParser
    {
        // 1. Try to detect from filename extension
        if ($filename) {
            $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

            // Direct mapping for known extensions
            $extMap = [
                'json' => 'json',
                'xml' => 'xml',
                'csv' => 'csv',
                'txt' => 'txt',
                'tsv' => 'txt',
                'dat' => 'txt',
                'xlsx' => 'xlsx',
                'xls' => 'xlsx'
            ];

            if (isset($extMap[$ext])) {
                $parser = self::create($extMap[$ext]);

                // Configure TSV specifically
                if ($ext === 'tsv') {
                    $parser->configure(['delimiter' => "\t"]);
                }

                return $parser;
            }
        }

        // 2. Detect from content
        $content = trim($content);

        // XLSX detection (ZIP file starting with PK)
        if (str_starts_with($content, "PK")) {
            return self::create('xlsx');
        }

        // JSON detection
        if (self::isJson($content)) {
            return self::create('json');
        }

        // XML detection
        if (self::isXml($content)) {
            return self::create('xml');
        }

        // Delimiter-based (CSV/TXT) detection
        $delimiter = self::detectDelimiter($content);

        if ($delimiter === ',') {
            return self::create('csv');
        }

        $parser = self::create('txt');
        $parser->configure(['delimiter' => $delimiter]);
        return $parser;
    }

    /**
     * Check if content is valid JSON
     */
    private static function isJson(string $content): bool
    {
        if (!str_starts_with($content, '{') && !str_starts_with($content, '[')) {
            return false;
        }

        json_decode($content);
        return json_last_error() === JSON_ERROR_NONE;
    }

    /**
     * Check if content is XML
     */
    private static function isXml(string $content): bool
    {
        if (str_starts_with($content, '<?xml')) {
            return true;
        }

        // Check if starts with a tag
        if (preg_match('/^<[a-zA-Z]/', $content)) {
            // Quick validation
            libxml_use_internal_errors(true);
            $result = simplexml_load_string($content);
            libxml_clear_errors();
            return $result !== false;
        }

        return false;
    }

    /**
     * Detect delimiter from content
     */
    private static function detectDelimiter(string $content): string
    {
        // Get first few lines for analysis
        $lines = array_slice(explode("\n", $content), 0, 5);
        $firstLine = $lines[0] ?? '';

        $delimiters = [
            ';' => 0,
            ',' => 0,
            "\t" => 0,
            '|' => 0
        ];

        // Count occurrences in first line
        foreach ($delimiters as $d => &$count) {
            $count = substr_count($firstLine, $d);
        }

        // Find delimiter with most consistent count across lines
        $scores = [];
        foreach ($delimiters as $d => $firstCount) {
            if ($firstCount === 0) {
                continue;
            }

            $consistent = true;
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line)) continue;

                $lineCount = substr_count($line, $d);
                // Allow some variance for quoted fields
                if (abs($lineCount - $firstCount) > 2) {
                    $consistent = false;
                    break;
                }
            }

            $scores[$d] = $consistent ? $firstCount : 0;
        }

        arsort($scores);
        $best = key($scores);

        return $best && $scores[$best] > 0 ? $best : ';';
    }

    /**
     * Register a custom parser
     */
    public static function register(string $type, string $parserClass): void
    {
        if (!is_subclass_of($parserClass, OmnexBaseParser::class)) {
            throw new Exception("Parser must extend OmnexBaseParser: $parserClass");
        }

        self::$parsers[strtolower($type)] = $parserClass;
    }

    /**
     * Get all registered parser types
     */
    public static function getTypes(): array
    {
        return array_keys(self::$parsers);
    }

    /**
     * Check if parser type is supported
     */
    public static function supports(string $type): bool
    {
        return isset(self::$parsers[strtolower($type)]);
    }
}
