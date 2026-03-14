<?php
/**
 * Shared i18n folder name key mapping for Media API
 *
 * Maps normalized (ASCII-lowercase) folder paths under storage/public/samples
 * to i18n translation keys in common.json -> mediaLibrary.folders.
 *
 * HOW TO ADD A NEW FOLDER:
 * 1. Add the folder to storage/public/samples/ on disk
 * 2. Add a mapping below: 'public/samples/<ascii_lowercase_name>' => 'mediaLibrary.folders.<camelCaseKey>'
 * 3. Add translations for <camelCaseKey> in ALL locale files: locales/{lang}/common.json -> mediaLibrary.folders
 *    Currently supported languages: tr, en, ru, az, de, nl, fr, ar
 * 4. Run media scan from the admin panel to import files
 *
 * HOW TO ADD A NEW LANGUAGE:
 * 1. Create locales/{newLang}/common.json with full content (copy from en and translate)
 * 2. Ensure mediaLibrary.folders section has ALL folder keys translated
 * 3. Add the locale code to i18n.js availableLocales array
 * 4. No backend changes needed — folder mapping is language-agnostic
 */

$FOLDER_NAME_KEY_MAP = [
    'public/samples' => 'mediaLibrary.folders.publicLibrary',
    'public/samples/manav' => 'mediaLibrary.folders.produce',
    'public/samples/atistirmalik' => 'mediaLibrary.folders.snacks',
    'public/samples/baharat' => 'mediaLibrary.folders.spices',
    'public/samples/bakliyat' => 'mediaLibrary.folders.legumes',
    'public/samples/deniz urunleri' => 'mediaLibrary.folders.seafood',
    'public/samples/dondurma' => 'mediaLibrary.folders.iceCream',
    'public/samples/firin' => 'mediaLibrary.folders.bakery',
    'public/samples/kasap' => 'mediaLibrary.folders.butcher',
    'public/samples/sivi grubu' => 'mediaLibrary.folders.liquids',
    'public/samples/tatli' => 'mediaLibrary.folders.dessert',
    'public/samples/video' => 'mediaLibrary.folders.video',
    'public/samples/cerez' => 'mediaLibrary.folders.nuts',
    'public/samples/icecek' => 'mediaLibrary.folders.beverages',
    'public/samples/sarkuteri' => 'mediaLibrary.folders.deli',
];

/**
 * Resolve i18n name_key from a folder path.
 * Normalizes Turkish characters to ASCII for matching.
 *
 * @param string|null $path Folder path (relative or absolute)
 * @return string|null i18n key or null if no match
 */
function getFolderNameKey(?string $path): ?string {
    global $FOLDER_NAME_KEY_MAP;
    if (!$path) return null;
    // Normalize: lowercase, forward slashes
    $normalized = mb_strtolower(str_replace('\\', '/', trim($path)), 'UTF-8');
    // Replace Turkish special chars with ASCII equivalents
    // Note: mb_strtolower('İ') produces 'i' + U+0307 (combining dot above)
    // We must also strip that combining character for correct ASCII matching
    $ascii = str_replace(
        ['ı', 'ğ', 'ü', 'ş', 'ö', 'ç', 'İ', 'Ğ', 'Ü', 'Ş', 'Ö', 'Ç'],
        ['i', 'g', 'u', 's', 'o', 'c', 'i', 'g', 'u', 's', 'o', 'c'],
        $normalized
    );
    // Remove Unicode combining marks (U+0300-U+036F) left by mb_strtolower
    $ascii = preg_replace('/\x{0300}-\x{036F}/u', '', $ascii);
    // Also remove combining dot above (U+0307) specifically - İ -> i̇ artifact
    $ascii = str_replace("\xCC\x87", '', $ascii);
    return $FOLDER_NAME_KEY_MAP[$ascii] ?? null;
}
