Sunucuya atmaniz gereken tum dizinleri listeleyeyim. Lokal yapiniz soyle:

market-etiket-sistemi/
??? api/                 ? /signage/api/
??? core/                ? /signage/core/
??? middleware/          ? /signage/middleware/
??? database/            ? /signage/database/
??? storage/             ? /signage/storage/
??? locales/             ? /signage/locales/
??? parsers/             ? /signage/parsers/
??? mappings/            ? /signage/mappings/
??? config.php           ? /signage/config.php
??? public/              ? /signage/ (icerigi dogrudan)
    ??? index.html       ? /signage/index.html
    ??? index.php        ? /signage/index.php
    ??? sw.js            ? /signage/sw.js
    ??? manifest.json    ? /signage/manifest.json
    ??? .htaccess        ? /signage/.htaccess
    ??? branding/        ? /signage/branding/
    ??? assets/          ? /signage/assets/

Sunucu Dizin Yapisi (/signage/)
signage/
??? api/
??? core/
??? middleware/
??? database/
??? storage/
??? locales/
??? parsers/
??? mappings/
??? config.php
??? index.html          (public/ icinden)
??? index.php           (public/ icinden)
??? sw.js               (public/ icinden)
??? manifest.json       (public/ icinden)
??? .htaccess           (public/ icinden)
??? branding/           (public/ icinden)
??? assets/             (public/ icinden)

Onemli: public/ klasorunu sunucuya klasor olarak atmayin. Icindeki dosyalari dogrudan /signage/ kok dizinine atin.

Yani FTP'de soyle gorunmeli:

/signage/api/ ?
/signage/core/ ?
/signage/assets/ ? (public/assets degil!)
/signage/index.html ? (public/index.html degil!)