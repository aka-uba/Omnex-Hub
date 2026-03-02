/**
 * VvvebJs Turkish Language Pack
 * Türkçe Dil Dosyası
 *
 * Bu dosya VvvebJs arayüzünü Türkçeleştirir.
 * DOM yüklendikten sonra çalışır.
 */

(function() {
    'use strict';

    // Turkish translations
    const translations = {
        // Panel headers
        'Components': 'Bileşenler',
        'Sections': 'Bölümler',
        'Blocks': 'Bloklar',
        'Styling': 'Stil',
        'Properties': 'Özellikler',
        'Pages': 'Sayfalar',
        'Layers': 'Katmanlar',
        'File Manager': 'Dosya Yöneticisi',

        // Component groups
        'Omnex': 'Omnex Widgetları',
        'Bootstrap': 'Bootstrap',
        'HTML': 'HTML',
        'Basic': 'Temel',
        'Elements': 'Elemanlar',
        'Typography': 'Tipografi',
        'Layout': 'Düzen',
        'Content': 'İçerik',
        'Media': 'Medya',
        'Form': 'Form',
        'Widgets': 'Widgetlar',
        'Embeds': 'Gömülü',
        'Landing': 'Açılış Sayfası',
        'Common': 'Genel',

        // Component names
        'Text': 'Metin',
        'Button': 'Buton',
        'Image': 'Görsel',
        'Video': 'Video',
        'Link': 'Bağlantı',
        'Heading': 'Başlık',
        'Paragraph': 'Paragraf',
        'Container': 'Kapsayıcı',
        'Row': 'Satır',
        'Column': 'Sütun',
        'Section': 'Bölüm',
        'Card': 'Kart',
        'Table': 'Tablo',
        'Alert': 'Uyarı',
        'Badge': 'Rozet',
        'Progress': 'İlerleme',
        'Carousel': 'Carousel',
        'Tabs': 'Sekmeler',
        'Accordion': 'Akordeon',
        'Modal': 'Modal',
        'Navbar': 'Navbar',
        'Nav': 'Gezinme',
        'Footer': 'Alt Bilgi',
        'Header': 'Üst Bilgi',
        'Form': 'Form',
        'Input': 'Giriş',
        'Select': 'Seçim',
        'Checkbox': 'Onay Kutusu',
        'Radio': 'Radyo Buton',
        'Textarea': 'Metin Alanı',
        'List': 'Liste',
        'Divider': 'Ayırıcı',
        'Blockquote': 'Alıntı',
        'Code': 'Kod',
        'Embed': 'Gömülü',
        'Map': 'Harita',
        'Icon': 'İkon',
        'Social Icons': 'Sosyal İkonlar',
        'Youtube': 'Youtube',
        'Google Map': 'Google Harita',
        'Slider': 'Kaydırıcı',
        'Gallery': 'Galeri',
        'Pricing': 'Fiyatlandırma',
        'Testimonial': 'Referans',
        'Team': 'Ekip',
        'Features': 'Özellikler',
        'Services': 'Hizmetler',
        'About': 'Hakkında',
        'Contact': 'İletişim',
        'Call to action': 'Harekete Geçirici',
        'Hero': 'Hero Bölümü',
        'Countdown': 'Geri Sayım',
        'Subscribe': 'Abone Ol',
        'Newsletter': 'Bülten',
        'Search': 'Arama',
        'Menu': 'Menü',
        'Logo': 'Logo',
        'Breadcrumbs': 'Breadcrumb',
        'Pagination': 'Sayfalama',

        // Omnex components (already in Turkish in components-omnex.js)
        'Product Card': 'Ürün Kartı',
        'Price List': 'Fiyat Listesi',
        'Ticker': 'Kayan Yazı',
        'Clock': 'Saat',
        'QR Code': 'QR Kod',
        'Media Image': 'Medya Görseli',
        'Dynamic Text': 'Dinamik Metin',

        // Toolbar buttons
        'Undo': 'Geri Al',
        'Redo': 'Yinele',
        'Preview': 'Önizleme',
        'Download': 'İndir',
        'Save': 'Kaydet',
        'Export': 'Dışa Aktar',
        'Import': 'İçe Aktar',
        'Clear': 'Temizle',
        'Fullscreen': 'Tam Ekran',
        'Code editor': 'Kod Düzenleyici',
        'Device': 'Cihaz',
        'Desktop': 'Masaüstü',
        'Tablet': 'Tablet',
        'Mobile': 'Mobil',

        // Properties panel
        'ID': 'ID',
        'Class': 'Sınıf',
        'Style': 'Stil',
        'Name': 'Ad',
        'Value': 'Değer',
        'Placeholder': 'Yer Tutucu',
        'Title': 'Başlık',
        'Alt': 'Alt Metin',
        'Href': 'Bağlantı',
        'Target': 'Hedef',
        'Type': 'Tür',
        'Action': 'Aksiyon',
        'Method': 'Metot',
        'Width': 'Genişlik',
        'Height': 'Yükseklik',
        'Margin': 'Dış Boşluk',
        'Padding': 'İç Boşluk',
        'Border': 'Kenarlık',
        'Background': 'Arka Plan',
        'Color': 'Renk',
        'Font': 'Yazı Tipi',
        'Font Size': 'Yazı Boyutu',
        'Font Weight': 'Yazı Kalınlığı',
        'Text Align': 'Metin Hizalama',
        'Line Height': 'Satır Yüksekliği',
        'Letter Spacing': 'Harf Aralığı',
        'Text Transform': 'Metin Dönüşümü',
        'Text Decoration': 'Metin Süslemesi',
        'Display': 'Görüntüleme',
        'Position': 'Konum',
        'Flex': 'Flex',
        'Grid': 'Grid',
        'Opacity': 'Opaklık',
        'Visibility': 'Görünürlük',
        'Overflow': 'Taşma',
        'Z-Index': 'Z-Index',
        'Transform': 'Dönüşüm',
        'Transition': 'Geçiş',
        'Animation': 'Animasyon',
        'Filter': 'Filtre',
        'Shadow': 'Gölge',
        'Radius': 'Yarıçap',
        'None': 'Yok',
        'Auto': 'Otomatik',
        'Inherit': 'Miras Al',
        'Initial': 'Başlangıç',

        // Text alignment
        'Left': 'Sol',
        'Center': 'Orta',
        'Right': 'Sağ',
        'Justify': 'Yasla',

        // Font weights
        'Normal': 'Normal',
        'Bold': 'Kalın',
        'Light': 'İnce',
        'Thin': 'Çok İnce',
        'Medium': 'Orta',
        'Semibold': 'Yarı Kalın',
        'Black': 'Siyah',

        // Display values
        'Block': 'Blok',
        'Inline': 'Satır İçi',
        'Inline Block': 'Satır İçi Blok',
        'Flex': 'Flex',
        'Grid': 'Grid',
        'Hidden': 'Gizli',

        // Position values
        'Static': 'Statik',
        'Relative': 'Göreceli',
        'Absolute': 'Mutlak',
        'Fixed': 'Sabit',
        'Sticky': 'Yapışkan',

        // Colors
        'Primary': 'Birincil',
        'Secondary': 'İkincil',
        'Success': 'Başarı',
        'Danger': 'Tehlike',
        'Warning': 'Uyarı',
        'Info': 'Bilgi',
        'Light': 'Açık',
        'Dark': 'Koyu',
        'White': 'Beyaz',
        'Transparent': 'Şeffaf',

        // Sizes
        'Small': 'Küçük',
        'Medium': 'Orta',
        'Large': 'Büyük',
        'Extra Small': 'Çok Küçük',
        'Extra Large': 'Çok Büyük',

        // Actions
        'Add': 'Ekle',
        'Edit': 'Düzenle',
        'Delete': 'Sil',
        'Remove': 'Kaldır',
        'Copy': 'Kopyala',
        'Paste': 'Yapıştır',
        'Cut': 'Kes',
        'Duplicate': 'Çoğalt',
        'Move Up': 'Yukarı Taşı',
        'Move Down': 'Aşağı Taşı',
        'Select': 'Seç',
        'Cancel': 'İptal',
        'Close': 'Kapat',
        'OK': 'Tamam',
        'Apply': 'Uygula',
        'Reset': 'Sıfırla',
        'Browse': 'Gözat',
        'Upload': 'Yükle',
        'Load': 'Yükle',
        'Refresh': 'Yenile',

        // Messages
        'Loading...': 'Yükleniyor...',
        'Saving...': 'Kaydediliyor...',
        'Saved': 'Kaydedildi',
        'Error': 'Hata',
        'Success': 'Başarılı',
        'Warning': 'Uyarı',
        'Are you sure?': 'Emin misiniz?',
        'Confirm': 'Onayla',
        'No results found': 'Sonuç bulunamadı',
        'Drop files here': 'Dosyaları buraya bırakın',
        'or click to browse': 'veya göz atmak için tıklayın',
        'File uploaded': 'Dosya yüklendi',
        'Upload failed': 'Yükleme başarısız',
        'Page saved': 'Sayfa kaydedildi',
        'Page exported': 'Sayfa dışa aktarıldı',

        // Media modal
        'Media': 'Medya',
        'Media Library': 'Medya Kütüphanesi',
        'Upload file': 'Dosya Yükle',
        'Drop or choose files to upload': 'Dosyaları sürükleyin veya seçin',
        'Find a file..': 'Dosya ara..',
        'No files here.': 'Burada dosya yok.',
        'Add selected': 'Seçileni Ekle',

        // Page management
        'New page': 'Yeni Sayfa',
        'Rename': 'Yeniden Adlandır',
        'Page name': 'Sayfa adı',
        'Page url': 'Sayfa URL',

        // AI Assistant
        'AI Assistant': 'AI Asistan',
        'Ask AI': 'AI\'ya Sor',
        'Generate': 'Oluştur',
        'Generating...': 'Oluşturuluyor...',

        // Responsive
        'Responsive': 'Duyarlı',
        'Show on all devices': 'Tüm cihazlarda göster',
        'Hide on mobile': 'Mobilde gizle',
        'Hide on tablet': 'Tablette gizle',
        'Hide on desktop': 'Masaüstünde gizle',

        // Other
        'Default': 'Varsayılan',
        'Custom': 'Özel',
        'Advanced': 'Gelişmiş',
        'General': 'Genel',
        'Options': 'Seçenekler',
        'Settings': 'Ayarlar',
        'Content': 'İçerik',
        'Appearance': 'Görünüm',
        'Layout': 'Düzen',
        'Spacing': 'Boşluk',
        'Size': 'Boyut',
        'Effects': 'Efektler',
        'Extra': 'Ekstra',
        'Attributes': 'Öznitelikler',
        'Events': 'Olaylar',
        'Data': 'Veri'
    };

    /**
     * Check if an element is an icon element that should not be translated
     */
    function isIconElement(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }
        // Check for common icon class patterns
        const iconClassPatterns = /^(icon-|ti-|la-|la |fa-|fa |fas |far |fab |bi-|bi |material-icons|ionicons)/i;
        const classList = element.className || '';
        if (iconClassPatterns.test(classList)) {
            return true;
        }
        // Check tag name for <i> elements with icon classes
        if (element.tagName === 'I' && classList) {
            return true;
        }
        // Check for SVG icons
        if (element.tagName === 'SVG' || element.closest('svg')) {
            return true;
        }
        return false;
    }

    /**
     * Apply translations to DOM
     */
    function applyTranslations() {
        // Translate text content
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    // Skip text nodes inside icon elements
                    const parent = node.parentElement;
                    if (parent && isIconElement(parent)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    // Skip text nodes inside elements with icon parent
                    if (parent && parent.closest('[class*="icon-"], [class*="ti-"], [class*="la-"], [class*="fa-"], svg, i[class]')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            },
            false
        );

        let node;
        while (node = walker.nextNode()) {
            const text = node.textContent.trim();
            if (text && translations[text]) {
                node.textContent = node.textContent.replace(text, translations[text]);
            }
        }

        // Translate placeholders
        document.querySelectorAll('[placeholder]').forEach(el => {
            const ph = el.getAttribute('placeholder');
            if (translations[ph]) {
                el.setAttribute('placeholder', translations[ph]);
            }
        });

        // Translate titles
        document.querySelectorAll('[title]').forEach(el => {
            const title = el.getAttribute('title');
            if (translations[title]) {
                el.setAttribute('title', translations[title]);
            }
        });

        // Translate aria-labels
        document.querySelectorAll('[aria-label]').forEach(el => {
            const label = el.getAttribute('aria-label');
            if (translations[label]) {
                el.setAttribute('aria-label', translations[label]);
            }
        });
    }

    /**
     * Translate specific panel headers
     * IMPORTANT: These selectors target <a> elements that contain icon children.
     * The visible content is just the icon - text is only in the title attribute.
     * We translate the title attribute, NOT the textContent (which would destroy icons).
     */
    function translatePanelHeaders() {
        const panels = {
            '#components-tab': 'Bileşenler',
            '#sections-tab': 'Bölümler',
            '#blocks-tab': 'Bloklar',
            '#properties-tab': 'Özellikler',
            '#pages-tab': 'Sayfalar',
            '#layers-tab': 'Katmanlar',
            '#filemanager-tab': 'Dosyalar'
        };

        Object.keys(panels).forEach(selector => {
            const el = document.querySelector(selector);
            if (el) {
                // These tabs only show icons - translate the title attribute instead
                const currentTitle = el.getAttribute('title');
                if (currentTitle) {
                    // Get the translation for the current title
                    const translatedTitle = translations[currentTitle] || panels[selector];
                    el.setAttribute('title', translatedTitle);
                }

                // Also check if there are any <small> or <span> or <div> children with text
                // that should be translated (some tabs have text labels)
                const textContainers = el.querySelectorAll('small, span, div');
                textContainers.forEach(container => {
                    // Skip containers that have icon elements inside
                    if (container.querySelector('i, svg, [class*="icon-"]')) {
                        return;
                    }
                    const text = container.textContent.trim();
                    if (text && translations[text]) {
                        container.textContent = translations[text];
                    }
                });

                // DO NOT set el.textContent directly - this would destroy icon children!
            }
        });
    }

    /**
     * Translate component group names in sidebar
     */
    function translateComponentGroups() {
        document.querySelectorAll('.components-list .header label, .sections-list .header label, .blocks-list .header label').forEach(el => {
            // Collect all child elements (icons, arrows, etc.) to preserve
            const childElements = Array.from(el.children);

            // Find only direct text nodes
            let hasTranslatedText = false;
            el.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    if (text && translations[text]) {
                        node.textContent = ' ' + translations[text] + ' ';
                        hasTranslatedText = true;
                    }
                }
            });

            // If no text node was found/translated, try the full textContent approach
            // but preserve all child elements
            if (!hasTranslatedText) {
                const text = el.textContent.trim();
                if (translations[text]) {
                    // Clear and rebuild: translation text + all preserved children
                    el.textContent = translations[text] + ' ';
                    childElements.forEach(child => el.appendChild(child));
                }
            }
        });

        // Component names - only target span elements that contain just text
        document.querySelectorAll('.components-list li[data-component] label span').forEach(el => {
            // Skip if this span contains icon elements
            if (el.querySelector('i, svg, [class*="icon-"], [class*="ti-"], [class*="la-"], [class*="fa-"]')) {
                return;
            }
            const text = el.textContent.trim();
            if (translations[text]) {
                el.textContent = translations[text];
            }
        });
    }

    // Store observer reference for cleanup
    let domObserver = null;

    /**
     * Observe DOM for dynamic content
     */
    function observeDOM() {
        // Don't create observer if Turkish is not active
        if (!shouldApplyTurkish()) {
            return;
        }

        // Disconnect existing observer if any
        if (domObserver) {
            domObserver.disconnect();
        }

        domObserver = new MutationObserver((mutations) => {
            // Re-check if Turkish is still active
            if (!shouldApplyTurkish()) {
                domObserver.disconnect();
                domObserver = null;
                return;
            }

            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    setTimeout(() => {
                        if (shouldApplyTurkish()) {
                            translateComponentGroups();
                        }
                    }, 100);
                }
            });
        });

        const componentsPanel = document.querySelector('#components');
        if (componentsPanel) {
            domObserver.observe(componentsPanel, { childList: true, subtree: true });
        }

        const rightPanel = document.querySelector('#right-panel');
        if (rightPanel) {
            domObserver.observe(rightPanel, { childList: true, subtree: true });
        }
    }

    /**
     * Stop observing DOM (called when switching away from Turkish)
     */
    function stopObserving() {
        if (domObserver) {
            domObserver.disconnect();
            domObserver = null;
        }
    }

    /**
     * Check if Turkish should be applied
     */
    function shouldApplyTurkish() {
        // Check i18n system first
        if (window.VvvebI18n && window.VvvebI18n.currentLocale) {
            return window.VvvebI18n.currentLocale === 'tr';
        }
        // Fallback: check localStorage
        const savedLocale = localStorage.getItem('vvveb_locale');
        if (savedLocale) {
            return savedLocale === 'tr';
        }
        // Fallback: check browser language
        return navigator.language.startsWith('tr');
    }

    /**
     * Initialize translations
     */
    function init() {
        // Register translations with i18n system
        if (window.VvvebI18n) {
            window.VvvebI18n.registerTranslations('tr', translations);
        }

        // Only apply Turkish translations if Turkish is selected
        if (!shouldApplyTurkish()) {
            console.log('VvvebJs Turkish language pack loaded (not active)');
            return;
        }

        // Wait for VvvebJs to load
        if (typeof Vvveb === 'undefined') {
            setTimeout(init, 100);
            return;
        }

        // Initial translation
        applyTranslations();
        translatePanelHeaders();
        translateComponentGroups();

        // Observe for dynamic content
        observeDOM();

        // Re-apply after Vvveb GUI loads
        if (Vvveb.Gui && Vvveb.Gui.init) {
            const originalInit = Vvveb.Gui.init;
            Vvveb.Gui.init = function() {
                originalInit.apply(this, arguments);
                setTimeout(() => {
                    if (shouldApplyTurkish()) {
                        applyTranslations();
                        translatePanelHeaders();
                        translateComponentGroups();
                    }
                }, 500);
            };
        }

        console.log('VvvebJs Turkish language pack loaded (active)');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Also run after window load for any late-loaded content
    window.addEventListener('load', () => {
        if (shouldApplyTurkish()) {
            setTimeout(() => {
                applyTranslations();
                translatePanelHeaders();
                translateComponentGroups();
            }, 1000);
        }
    });

    // Expose translations for external use
    window.VvvebTranslations = translations;
    window.VvvebTranslate = function(text) {
        return translations[text] || text;
    };

})();
