<?php
/**
 * XmlParser - XML File Parser
 *
 * @package OmnexDisplayHub
 */

class OmnexXmlParser extends OmnexBaseParser
{
    protected string $type = 'xml';
    protected ?string $itemPath = null;

    public function __construct()
    {
        $this->config = [
            'itemPath' => null,      // XPath to item elements (e.g., "//product")
            'encoding' => 'UTF-8'
        ];
    }

    /**
     * Configure parser
     */
    public function configure(array $options): self
    {
        parent::configure($options);
        $this->itemPath = $options['itemPath'] ?? null;
        return $this;
    }

    /**
     * Check if content is XML
     */
    public function supports(string $content): bool
    {
        $content = trim($content);
        return str_starts_with($content, '<?xml') || str_starts_with($content, '<');
    }

    /**
     * Parse XML content
     */
    public function parse(string $content): array
    {
        $this->clearMessages();

        // Ensure UTF-8
        $content = $this->ensureUtf8($content);

        // Suppress XML errors and use internal error handling
        $previousErrors = libxml_use_internal_errors(true);

        try {
            $xml = simplexml_load_string($content, 'SimpleXMLElement', LIBXML_NOCDATA);

            if ($xml === false) {
                foreach (libxml_get_errors() as $error) {
                    $this->errors[] = trim($error->message);
                }
                libxml_clear_errors();
                return [];
            }

            // Find items using XPath if specified
            if ($this->itemPath) {
                $items = $xml->xpath($this->itemPath);
                if ($items === false || empty($items)) {
                    $this->errors[] = "XPath not found: {$this->itemPath}";
                    return [];
                }
            } else {
                // Try to find items automatically
                $items = $this->findItems($xml);
            }

            // Convert to array
            $data = [];
            foreach ($items as $item) {
                $data[] = $this->xmlToArray($item);
            }

            return $data;

        } finally {
            libxml_use_internal_errors($previousErrors);
        }
    }

    /**
     * Find items in XML automatically
     */
    private function findItems(SimpleXMLElement $xml): array
    {
        // Check if root has direct children that look like items
        $children = $xml->children();

        if (count($children) === 0) {
            return [$xml];
        }

        // Check if all children have the same name (likely items)
        $childNames = [];
        foreach ($children as $child) {
            $name = $child->getName();
            $childNames[$name] = ($childNames[$name] ?? 0) + 1;
        }

        // Find most common child name
        arsort($childNames);
        $mostCommon = key($childNames);

        // If most common appears multiple times, those are likely items
        if ($childNames[$mostCommon] > 1) {
            return iterator_to_array($xml->{$mostCommon});
        }

        // Otherwise treat entire XML as single item
        return [$xml];
    }

    /**
     * Convert SimpleXMLElement to array
     */
    private function xmlToArray(SimpleXMLElement $xml): array
    {
        $result = [];

        // Get attributes
        foreach ($xml->attributes() as $name => $value) {
            $result['@' . $name] = (string) $value;
        }

        // Get children
        foreach ($xml->children() as $name => $child) {
            $childArray = $this->xmlToArray($child);

            // If child has no children and no attributes, just use string value
            if (empty($childArray) || (count($childArray) === 1 && isset($childArray['@value']))) {
                $value = (string) $child;
            } else {
                $value = $childArray;
            }

            // Handle multiple children with same name
            if (isset($result[$name])) {
                if (!is_array($result[$name]) || !isset($result[$name][0])) {
                    $result[$name] = [$result[$name]];
                }
                $result[$name][] = $value;
            } else {
                $result[$name] = $value;
            }
        }

        // If no children, use text content
        if (empty($result)) {
            $text = trim((string) $xml);
            if ($text !== '') {
                return ['@value' => $text];
            }
        }

        return $result;
    }
}
