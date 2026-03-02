# CSS STİL ANALİZ RAPORU

**Oluşturulma Tarihi:** 2026-01-24 21:11:08

## 📊 ÖZET İSTATİSTİKLER

- **Toplam CSS Dosyası:** 34
- **Global Stiller:** 2 dosya
- **Component Stiller:** 11 dosya
- **Layout Stiller:** 4 dosya
- **Page Stiller:** 15 dosya
- **Diğer Stiller:** 2 dosya
- **Toplam CSS Kuralı:** 16901
- **Benzersiz Selector:** 5392
- **Benzersiz Property:** 364
- **Çakışan Stil:** 829
- **Inline Style (JS):** 20 kullanım
- **Inline Style (HTML):** 0 kullanım

## 📁 CSS DOSYA YAPISI

### Global Stiller
- `public/assets/css/global-dark.css` (8.45 KB)
- `public/assets/css/global.css` (27.96 KB)

### Component Stiller
- `public/assets/css/components/badges.css` (13.44 KB)
- `public/assets/css/components/buttons.css` (22.66 KB)
- `public/assets/css/components/cards.css` (12.75 KB)
- `public/assets/css/components/datatable.css` (20.44 KB)
- `public/assets/css/components/export.css` (6.78 KB)
- `public/assets/css/components/forms.css` (17.93 KB)
- `public/assets/css/components/index.css` (0.31 KB)
- `public/assets/css/components/modals.css` (12.61 KB)
- `public/assets/css/components/notifications.css` (30.91 KB)
- `public/assets/css/components/tables.css` (20.93 KB)
- `public/assets/css/components/toast.css` (16.12 KB)

### Layout Stiller
- `public/assets/css/layouts/content.css` (19.42 KB)
- `public/assets/css/layouts/header.css` (70.95 KB)
- `public/assets/css/layouts/index.css` (0.14 KB)
- `public/assets/css/layouts/sidebar.css` (14.55 KB)

### Page Stiller
- `public/assets/css/pages/about.css` (15.08 KB)
- `public/assets/css/pages/audit-log.css` (9.19 KB)
- `public/assets/css/pages/auth.css` (14.36 KB)
- `public/assets/css/pages/dashboard.css` (36.5 KB)
- `public/assets/css/pages/devices.css` (31.9 KB)
- `public/assets/css/pages/gateway.css` (9.33 KB)
- `public/assets/css/pages/index.css` (0.41 KB)
- `public/assets/css/pages/media.css` (15.85 KB)
- `public/assets/css/pages/payments.css` (8.72 KB)
- `public/assets/css/pages/products.css` (51.59 KB)
- `public/assets/css/pages/queue.css` (51.83 KB)
- `public/assets/css/pages/settings.css` (48.27 KB)
- `public/assets/css/pages/system-status.css` (14.96 KB)
- `public/assets/css/pages/template-editor.css` (69.72 KB)
- `public/assets/css/pages/templates.css` (22.86 KB)

## ⚠️ ÇAKIŞAN STİLLER

Aynı selector ve property için farklı değerler kullanan stiller:

### `.dark` → `--bg-secondary`

- **global** (`public/assets/css/global-dark.css`): `#141517`
- **other** (`public/assets/css/app.css`): `#111827`

### `.dark` → `--bg-tertiary`

- **global** (`public/assets/css/global-dark.css`): `#25262b`
- **other** (`public/assets/css/app.css`): `#374151`

### `.dark` → `--text-primary`

- **global** (`public/assets/css/global-dark.css`): `#f8f9fa`
- **other** (`public/assets/css/app.css`): `#f9fafb`

### `.dark` → `--text-secondary`

- **global** (`public/assets/css/global-dark.css`): `#ced4da`
- **other** (`public/assets/css/app.css`): `#d1d5db`

### `.dark` → `--text-muted`

- **global** (`public/assets/css/global-dark.css`): `#868e96`
- **other** (`public/assets/css/app.css`): `#9ca3af`

### `.dark` → `--border-color`

- **global** (`public/assets/css/global-dark.css`): `#373d43`
- **other** (`public/assets/css/app.css`): `#374151`

### `.dark` → `--shadow-color`

- **global** (`public/assets/css/global-dark.css`): `rgba(0, 0, 0, 0.4)`
- **other** (`public/assets/css/app.css`): `rgba(0, 0, 0, 0.3)`

### `[data-theme="dark"]` → `--bg-secondary`

- **global** (`public/assets/css/global-dark.css`): `#141517`
- **other** (`public/assets/css/app.css`): `#111827`

### `[data-theme="dark"]` → `--bg-tertiary`

- **global** (`public/assets/css/global-dark.css`): `#25262b`
- **other** (`public/assets/css/app.css`): `#374151`

### `[data-theme="dark"]` → `--text-primary`

- **global** (`public/assets/css/global-dark.css`): `#f8f9fa`
- **other** (`public/assets/css/app.css`): `#f9fafb`

### `[data-theme="dark"]` → `--text-secondary`

- **global** (`public/assets/css/global-dark.css`): `#ced4da`
- **other** (`public/assets/css/app.css`): `#d1d5db`

### `[data-theme="dark"]` → `--text-muted`

- **global** (`public/assets/css/global-dark.css`): `#868e96`
- **other** (`public/assets/css/app.css`): `#9ca3af`

### `[data-theme="dark"]` → `--border-color`

- **global** (`public/assets/css/global-dark.css`): `#373d43`
- **other** (`public/assets/css/app.css`): `#374151`

### `[data-theme="dark"]` → `--shadow-color`

- **global** (`public/assets/css/global-dark.css`): `rgba(0, 0, 0, 0.4)`
- **other** (`public/assets/css/app.css`): `rgba(0, 0, 0, 0.3)`

### `:root` → `--transition-normal`

- **global** (`public/assets/css/global.css`): `300ms ease`
- **other** (`public/assets/css/app.css`): `300ms`

### `:root` → `--transition-slow`

- **global** (`public/assets/css/global.css`): `500ms ease`
- **other** (`public/assets/css/app.css`): `500ms`

### `body` → `font-family`

- **global** (`public/assets/css/global.css`): `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
- **other** (`public/assets/css/app.css`): `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

### `body` → `line-height`

- **global** (`public/assets/css/global.css`): `var(--leading-normal)`
- **other** (`public/assets/css/app.css`): `1.5`

### `body` → `max-width`

- **global** (`public/assets/css/global.css`): `100%`
- **other** (`public/assets/css/app.css`): `100vw`

### `h1` → `font-weight`

- **global** (`public/assets/css/global.css`): `var(--font-semibold)`
- **other** (`public/assets/css/app.css`): `600`

### `h1` → `line-height`

- **global** (`public/assets/css/global.css`): `var(--leading-tight)`
- **other** (`public/assets/css/app.css`): `1.3`

### `h2` → `font-weight`

- **global** (`public/assets/css/global.css`): `var(--font-semibold)`
- **other** (`public/assets/css/app.css`): `600`

### `h2` → `line-height`

- **global** (`public/assets/css/global.css`): `var(--leading-tight)`
- **other** (`public/assets/css/app.css`): `1.3`

### `h3` → `font-weight`

- **global** (`public/assets/css/global.css`): `var(--font-semibold)`
- **other** (`public/assets/css/app.css`): `600`

### `h3` → `line-height`

- **global** (`public/assets/css/global.css`): `var(--leading-tight)`
- **other** (`public/assets/css/app.css`): `1.3`

### `h4` → `font-weight`

- **global** (`public/assets/css/global.css`): `var(--font-semibold)`
- **other** (`public/assets/css/app.css`): `600`

### `h4` → `line-height`

- **global** (`public/assets/css/global.css`): `var(--leading-tight)`
- **other** (`public/assets/css/app.css`): `1.3`

### `h5` → `font-weight`

- **global** (`public/assets/css/global.css`): `var(--font-semibold)`
- **other** (`public/assets/css/app.css`): `600`

### `h5` → `line-height`

- **global** (`public/assets/css/global.css`): `var(--leading-tight)`
- **other** (`public/assets/css/app.css`): `1.3`

### `h6` → `font-weight`

- **global** (`public/assets/css/global.css`): `var(--font-semibold)`
- **other** (`public/assets/css/app.css`): `600`

### `h6` → `line-height`

- **global** (`public/assets/css/global.css`): `var(--leading-tight)`
- **other** (`public/assets/css/app.css`): `1.3`

### `h1` → `font-size`

- **global** (`public/assets/css/global.css`): `var(--text-4xl)`
- **other** (`public/assets/css/app.css`): `2rem`

### `h2` → `font-size`

- **global** (`public/assets/css/global.css`): `var(--text-3xl)`
- **other** (`public/assets/css/app.css`): `1.5rem`

### `h3` → `font-size`

- **global** (`public/assets/css/global.css`): `var(--text-2xl)`
- **other** (`public/assets/css/app.css`): `1.25rem`

### `h4` → `font-size`

- **global** (`public/assets/css/global.css`): `var(--text-xl)`
- **other** (`public/assets/css/app.css`): `1.125rem`

### `h5` → `font-size`

- **global** (`public/assets/css/global.css`): `var(--text-lg)`
- **other** (`public/assets/css/app.css`): `1rem`

### `h6` → `font-size`

- **global** (`public/assets/css/global.css`): `var(--text-base)`
- **other** (`public/assets/css/app.css`): `0.875rem`

### `a` → `color`

- **global** (`public/assets/css/global.css`): `var(--color-primary)`
- **other** (`public/assets/css/app.css`): `var(--brand-primary)`

### `a:hover` → `color`

- **global** (`public/assets/css/global.css`): `var(--color-primary-hover)`
- **other** (`public/assets/css/app.css`): `var(--brand-primary-hover)`

### `.mt-3` → `margin-top`

- **global** (`public/assets/css/global.css`): `var(--space-3)`
- **pages** (`public/assets/css/pages/system-status.css`): `1rem`

### `.mt-4` → `margin-top`

- **global** (`public/assets/css/global.css`): `var(--space-4)`
- **pages** (`public/assets/css/pages/system-status.css`): `1.5rem`

### `.gap-1` → `gap`

- **global** (`public/assets/css/global.css`): `var(--space-1)`
- **other** (`public/assets/css/app.css`): `4px`

### `.gap-2` → `gap`

- **global** (`public/assets/css/global.css`): `var(--space-2)`
- **other** (`public/assets/css/app.css`): `8px`

### `.gap-3` → `gap`

- **global** (`public/assets/css/global.css`): `var(--space-3)`
- **other** (`public/assets/css/app.css`): `12px`

### `.gap-4` → `gap`

- **global** (`public/assets/css/global.css`): `var(--space-4)`
- **other** (`public/assets/css/app.css`): `16px`

### `.text-brand` → `color`

- **global** (`public/assets/css/global.css`): `var(--color-primary)`
- **other** (`public/assets/css/app.css`): `var(--brand-primary)`

### `.text-success` → `color`

- **global** (`public/assets/css/global.css`): `var(--color-success)`
- **other** (`public/assets/css/app.css`): `#22c55e`

### `.text-danger` → `color`

- **global** (`public/assets/css/global.css`): `var(--color-danger)`
- **pages** (`public/assets/css/pages/audit-log.css`): `#fa5252`
- **other** (`public/assets/css/app.css`): `#ef4444`

### `.text-warning` → `color`

- **global** (`public/assets/css/global.css`): `var(--color-warning)`
- **other** (`public/assets/css/app.css`): `#f59e0b`

### `.shadow` → `box-shadow`

- **global** (`public/assets/css/global.css`): `0 1px 3px 0 var(--shadow-color), 0 1px 2px -1px var(--shadow-color)`
- **other** (`public/assets/css/app.css`): `0 1px 3px var(--shadow-color)`


*... ve 779 çakışma daha*
## 📈 EN ÇOK KULLANILAN SELECTOR'LAR

- `:root`: 182 dosyada kullanılıyor
- `.dark`: 69 dosyada kullanılıyor
- `[data-theme="dark"]`: 63 dosyada kullanılıyor
- `.user-dropdown`: 40 dosyada kullanılıyor
- `to`: 37 dosyada kullanılıyor
- `.header-btn`: 33 dosyada kullanılıyor
- `.header-btn .badge`: 31 dosyada kullanılıyor
- `.header`: 30 dosyada kullanılıyor
- `.filter-tab`: 27 dosyada kullanılıyor
- `}

@media (max-width: 640px)`: 27 dosyada kullanılıyor
- `.toggle-slider`: 27 dosyada kullanılıyor
- `.top-nav-dropdown-menu`: 27 dosyada kullanılıyor
- `.user-dropdown-item`: 26 dosyada kullanılıyor
- `.image-hover-popup`: 26 dosyada kullanılıyor
- `.gateway-icon`: 25 dosyada kullanılıyor
- `.stat-icon`: 25 dosyada kullanılıyor
- `.data-table-footer`: 24 dosyada kullanılıyor
- `.stat-card`: 23 dosyada kullanılıyor
- `.main-content`: 23 dosyada kullanılıyor
- `.header-dropdown-menu`: 23 dosyada kullanılıyor

## 📈 EN ÇOK KULLANILAN PROPERTY'LER

- `color`: 1875 dosyada kullanılıyor
- `background`: 1386 dosyada kullanılıyor
- `display`: 1203 dosyada kullanılıyor
- `font-size`: 1180 dosyada kullanılıyor
- `padding`: 813 dosyada kullanılıyor
- `gap`: 771 dosyada kullanılıyor
- `border-radius`: 714 dosyada kullanılıyor
- `align-items`: 694 dosyada kullanılıyor
- `width`: 663 dosyada kullanılıyor
- `background-color`: 630 dosyada kullanılıyor
- `height`: 547 dosyada kullanılıyor
- `border-color`: 492 dosyada kullanılıyor
- `justify-content`: 413 dosyada kullanılıyor
- `font-weight`: 412 dosyada kullanılıyor
- `border`: 381 dosyada kullanılıyor
- `transition`: 340 dosyada kullanılıyor
- `margin-bottom`: 296 dosyada kullanılıyor
- `box-shadow`: 292 dosyada kullanılıyor
- `position`: 254 dosyada kullanılıyor
- `transform`: 243 dosyada kullanılıyor

## 🎨 INLINE STİL KULLANIMI

### JS Dosyalarında Inline Stiller

En çok kullanılan inline property'ler:

- `display`: 6 kullanım
- `width`: 4 kullanım
- `color`: 2 kullanım
- `${col.width ? `width`: 1 kullanım
- `animation-duration`: 1 kullanım
- `margin-right`: 1 kullanım
- `font-size`: 1 kullanım
- `margin`: 1 kullanım
- `background-color`: 1 kullanım
- `min-width`: 1 kullanım
- `--percent`: 1 kullanım

### HTML Dosyalarında Inline Stiller

✅ HTML dosyalarında inline stil bulunamadı.

## 💡 ÖNERİLER

⚠️ **Çok fazla çakışan stil:** 829 çakışma tespit edildi. Stil öncelikleri gözden geçirilmeli.

⚠️ **Kategori çapında selector kullanımı:** 219 selector birden fazla kategoride kullanılıyor. Bu selector'lar global.css'e taşınabilir.

### Önerilen İyileştirmeler

1. **Inline Stilleri CSS'e Taşıma:** Dinamik değerler dışındaki inline stiller CSS sınıflarına dönüştürülmeli
2. **Çakışan Stilleri Düzenleme:** Aynı selector için farklı değerler kullanan stiller birleştirilmeli
3. **Selector Öncelikleri:** CSS specificity kurallarına göre öncelikler belirlenmeli
4. **Kategori Çapında Selector'lar:** Birden fazla kategoride kullanılan selector'lar global.css'e taşınmalı
5. **CSS Variables Kullanımı:** Tekrar eden değerler CSS variable'larına dönüştürülmeli
