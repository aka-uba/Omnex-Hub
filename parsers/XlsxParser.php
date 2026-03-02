<?php
/**
 * XlsxParser - Excel XLSX Parser (Native PHP, no dependencies)
 *
 * Reads XLSX files by extracting XML from the ZIP archive
 *
 * @package OmnexDisplayHub
 */

class OmnexXlsxParser extends OmnexBaseParser
{
    protected string $type = 'xlsx';
    private array $sharedStrings = [];
    private int $sheetIndex = 0;

    public function __construct()
    {
        $this->config = [
            'sheetIndex' => 0,
            'hasHeader' => true,
            'skipEmptyRows' => true,
            'maxRows' => 10000
        ];
    }

    /**
     * Parse XLSX file content
     */
    public function parse(string $content): array
    {
        // XLSX is a ZIP file, we need to save it temporarily
        $tempFile = tempnam(sys_get_temp_dir(), 'xlsx_');
        file_put_contents($tempFile, $content);

        try {
            $data = $this->parseFile($tempFile);
        } finally {
            @unlink($tempFile);
        }

        return $data;
    }

    /**
     * Parse XLSX from file path
     */
    public function parseFile(string $filepath): array
    {
        if (!file_exists($filepath)) {
            throw new Exception("XLSX dosyası bulunamadı: $filepath");
        }

        $zip = new ZipArchive();
        if ($zip->open($filepath) !== true) {
            throw new Exception("XLSX dosyası açılamadı (geçersiz format)");
        }

        try {
            // Load shared strings (text values are stored here)
            $this->loadSharedStrings($zip);

            // Get sheet name/path
            $sheetPath = $this->getSheetPath($zip, (int) $this->config['sheetIndex']);

            // Parse the sheet
            $sheetXml = $zip->getFromName($sheetPath);
            if ($sheetXml === false) {
                throw new Exception("Çalışma sayfası bulunamadı");
            }

            $data = $this->parseSheet($sheetXml);

        } finally {
            $zip->close();
        }

        return $data;
    }

    /**
     * Load shared strings from XLSX
     */
    private function loadSharedStrings(ZipArchive $zip): void
    {
        $this->sharedStrings = [];

        $stringsXml = $zip->getFromName('xl/sharedStrings.xml');
        if ($stringsXml === false) {
            return; // Some XLSX files don't have shared strings
        }

        $xml = simplexml_load_string($stringsXml);
        if ($xml === false) {
            return;
        }

        foreach ($xml->si as $si) {
            if (isset($si->t)) {
                $this->sharedStrings[] = (string) $si->t;
            } elseif (isset($si->r)) {
                // Rich text - concatenate all text parts
                $text = '';
                foreach ($si->r as $r) {
                    if (isset($r->t)) {
                        $text .= (string) $r->t;
                    }
                }
                $this->sharedStrings[] = $text;
            } else {
                $this->sharedStrings[] = '';
            }
        }
    }

    /**
     * Get sheet path from workbook
     */
    private function getSheetPath(ZipArchive $zip, int $index): string
    {
        $workbookXml = $zip->getFromName('xl/workbook.xml');
        if ($workbookXml === false) {
            throw new Exception("Workbook bulunamadı");
        }

        $xml = simplexml_load_string($workbookXml);
        if ($xml === false) {
            throw new Exception("Workbook XML okunamadı");
        }

        // Get sheet rId
        $sheets = $xml->sheets->sheet;
        if (!isset($sheets[$index])) {
            throw new Exception("Sayfa bulunamadı: index $index");
        }

        // Read relationships to find actual sheet path
        $relsXml = $zip->getFromName('xl/_rels/workbook.xml.rels');
        if ($relsXml === false) {
            // Default path
            return 'xl/worksheets/sheet' . ($index + 1) . '.xml';
        }

        $relsXmlObj = simplexml_load_string($relsXml);
        $ns = $sheets[$index]->attributes('r', true);
        $rId = (string) $ns['id'];

        foreach ($relsXmlObj->Relationship as $rel) {
            if ((string) $rel['Id'] === $rId) {
                return 'xl/' . (string) $rel['Target'];
            }
        }

        return 'xl/worksheets/sheet' . ($index + 1) . '.xml';
    }

    /**
     * Parse sheet XML
     */
    private function parseSheet(string $xml): array
    {
        $sheet = simplexml_load_string($xml);
        if ($sheet === false) {
            throw new Exception("Sayfa XML okunamadı");
        }

        $rows = [];
        $headers = [];
        $maxCol = 0;
        $rowIndex = 0;

        foreach ($sheet->sheetData->row as $row) {
            $rowData = [];

            foreach ($row->c as $cell) {
                $cellRef = (string) $cell['r'];
                $colIndex = $this->columnToIndex($cellRef);
                $maxCol = max($maxCol, $colIndex);

                $value = $this->getCellValue($cell);
                $rowData[$colIndex] = $value;
            }

            // Fill empty cells
            for ($i = 0; $i <= $maxCol; $i++) {
                if (!isset($rowData[$i])) {
                    $rowData[$i] = '';
                }
            }
            ksort($rowData);
            $rowData = array_values($rowData);

            // Skip empty rows
            if ($this->config['skipEmptyRows'] && $this->isEmptyRow($rowData)) {
                continue;
            }

            if ($rowIndex === 0 && $this->config['hasHeader']) {
                $headers = $rowData;
            } else {
                if ($this->config['hasHeader'] && !empty($headers)) {
                    $assocRow = [];
                    foreach ($headers as $idx => $header) {
                        $key = trim((string) $header) ?: "column_$idx";
                        $assocRow[$key] = $rowData[$idx] ?? '';
                    }
                    $rows[] = $assocRow;
                } else {
                    $rows[] = $rowData;
                }
            }

            $rowIndex++;

            if (count($rows) >= (int) $this->config['maxRows']) {
                break;
            }
        }

        return $rows;
    }

    /**
     * Get cell value
     */
    private function getCellValue(SimpleXMLElement $cell): string
    {
        $type = (string) ($cell['t'] ?? '');
        $rawValue = isset($cell->v) ? (string) $cell->v : '';

        // Shared string - type 's' means index into shared strings table
        if ($type === 's') {
            // Shared string index must be integer
            // Direct cast - XLSX spec guarantees integer indices
            if ($rawValue === '' || !is_numeric($rawValue)) {
                return '';
            }
            $index = intval($rawValue);
            return $this->sharedStrings[$index] ?? '';
        }

        // Inline string
        if ($type === 'inlineStr') {
            if (isset($cell->is->t)) {
                return (string) $cell->is->t;
            }
            // Rich text inline string
            if (isset($cell->is->r)) {
                $text = '';
                foreach ($cell->is->r as $r) {
                    if (isset($r->t)) {
                        $text .= (string) $r->t;
                    }
                }
                return $text;
            }
            return '';
        }

        // String type (str) - formula result that is a string
        if ($type === 'str') {
            return $rawValue;
        }

        // Boolean
        if ($type === 'b') {
            return $rawValue === '1' ? 'Evet' : 'Hayır';
        }

        // Error
        if ($type === 'e') {
            return '';
        }

        // Number (no type or 'n') or formula result
        if ($rawValue !== '') {
            return $rawValue;
        }

        return '';
    }

    /**
     * Convert column reference to index (A=0, B=1, ..., AA=26, etc.)
     */
    private function columnToIndex(string $cellRef): int
    {
        preg_match('/^([A-Z]+)/', $cellRef, $matches);
        $col = $matches[1] ?? 'A';

        $index = 0;
        $length = strlen($col);

        for ($i = 0; $i < $length; $i++) {
            $index = $index * 26 + (ord($col[$i]) - ord('A') + 1);
        }

        return $index - 1;
    }

    /**
     * Check if row is empty
     */
    private function isEmptyRow(array $row): bool
    {
        foreach ($row as $value) {
            if (trim($value) !== '') {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if content is XLSX
     */
    public function supports(string $content): bool
    {
        // XLSX files start with PK (ZIP signature)
        return str_starts_with($content, "PK");
    }

    /**
     * Get available sheets
     */
    public function getSheets(string $filepath): array
    {
        $zip = new ZipArchive();
        if ($zip->open($filepath) !== true) {
            return [];
        }

        $sheets = [];
        $workbookXml = $zip->getFromName('xl/workbook.xml');

        if ($workbookXml !== false) {
            $xml = simplexml_load_string($workbookXml);
            if ($xml !== false) {
                $sheetIndex = 0;
                foreach ($xml->sheets->sheet as $sheet) {
                    $sheets[] = [
                        'index' => $sheetIndex,
                        'name' => (string) $sheet['name']
                    ];
                    $sheetIndex++;
                }
            }
        }

        $zip->close();
        return $sheets;
    }
}
