<?php
/**
 * CsvParser - CSV File Parser
 *
 * Supports both comma (,) and semicolon (;) delimited CSV files
 * with auto-detection capability
 *
 * @package OmnexDisplayHub
 */

class OmnexCsvParser extends OmnexTxtParser
{
    protected string $type = 'csv';

    public function __construct()
    {
        parent::__construct();

        $this->config = [
            'delimiter' => ';',
            'autoDetectDelimiter' => true,
            'hasHeader' => true,
            'skipLines' => 0,
            'enclosure' => '"',
            'escape' => '\\'
        ];

        // Default to semicolon for Turkish Excel compatibility
        $this->delimiter = ';';
        $this->autoDetectDelimiter = true;
    }

    /**
     * Check if content is CSV (comma or semicolon delimited)
     */
    public function supports(string $content): bool
    {
        $firstLine = strtok(trim($content), "\n");

        // Count delimiters in first line
        $commaCount = substr_count($firstLine, ',');
        $semicolonCount = substr_count($firstLine, ';');

        // CSV should have either commas or semicolons
        return $commaCount > 0 || $semicolonCount > 0;
    }
}
