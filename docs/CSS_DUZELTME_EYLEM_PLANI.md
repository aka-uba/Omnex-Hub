# CSS DÜZELTME EYLEM PLANI

**Oluşturulma Tarihi:** 2026-01-27
**Referans:** CSS_KAPSAMLI_DENETIM_RAPORU.md

---

## HIZLI DÜZELTME KOMUTLARI

Bu dokümanda, CSS denetim raporundaki sorunları düzeltmek için adım adım talimatlar yer almaktadır.

---

## 1. @KEYFRAMES SPIN DUPLIKASYONLARINI KALDIR

### Silinecek Dosyalar ve Satırlar

```bash
# auth.css - satır 609-613 arası sil
# about.css - satır 312-316 arası sil
# dashboard.css - satır 419-423 arası sil
# products.css - satır 2434-2438 arası sil
# payments.css - satır 187-191 arası sil
# queue.css - satır 1489-1493 VE 2541-2545 arası sil (2 yer)
# setup-wizard.css - satır 96-99 arası sil
# settings.css - satır 1182-1185 arası sil
# system-status.css - satır 696-700 arası sil
```

### Silinecek Kod Bloğu (Tüm Dosyalarda Aynı)

```css
/* BU BLOĞU SİL */
@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
```

### global.css'e Yorum Ekle (satır 806)

```css
/*
 * Master spinner animasyonu - BAŞKA DOSYALARDA DUPLIKE ETME
 * Tüm .spinner, .loading-spinner sınıfları bu animasyonu kullanır
 */
@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
```

---

## 2. @KEYFRAMES SKELETON-LOADING KONSOLIDE ET

### Silinecek Dosyalar

```bash
# content.css - satır 598-605 arası sil
# tables.css - satır 488-495 arası sil
# media.css - satır 429-436 arası sil
# templates.css - satır 367-374 arası sil
```

### global.css'e Ekle (satır 840 civarı)

```css
/*
 * Skeleton loading animasyonu - BAŞKA DOSYALARDA DUPLIKE ETME
 */
@keyframes skeleton-loading {
    0% {
        background-position: -200px 0;
    }
    100% {
        background-position: calc(200px + 100%) 0;
    }
}
```

---

## 3. @KEYFRAMES FADEIN DUPLIKASYONUNU KALDIR

### Silinecek

```bash
# settings.css - satır 72-76 arası sil
```

### Silinecek Kod

```css
/* BU BLOĞU SİL */
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
```

---

## 4. @KEYFRAMES PULSE DUPLIKASYONUNU KALDIR

### Silinecek

```bash
# queue.css - satır 412-421 arası sil
```

---

## 5. Z-INDEX DÜZELTMELERİ

### toast.css (satır 12)

```css
/* ÖNCE */
.toast-container {
    z-index: 9999; /* Must be above modal (1000) */
}

/* SONRA */
.toast-container {
    z-index: var(--z-notification); /* 700 - global.css'de tanımlı */
}
```

### devices.css (satır 305)

```css
/* ÖNCE */
.device-preview-popup {
    z-index: 9999;
}

/* SONRA */
.device-preview-popup {
    z-index: var(--z-notification); /* 700 */
}
```

### products.css (satır 1621)

```css
/* ÖNCE */
.product-image-preview-popup {
    z-index: 9999;
}

/* SONRA */
.product-image-preview-popup {
    z-index: var(--z-notification); /* 700 */
}
```

### media.css (satır 489)

```css
/* ÖNCE */
.image-hover-popup {
    z-index: 9999;
}

/* SONRA */
.image-hover-popup {
    z-index: var(--z-notification); /* 700 */
}
```

### templates.css (satır 492)

```css
/* ÖNCE */
.image-hover-popup {
    z-index: 9999;
}

/* SONRA */
.image-hover-popup {
    z-index: var(--z-notification); /* 700 */
}
```

### modals.css (satır 13)

```css
/* ÖNCE */
.modal-overlay {
    z-index: 1000;
}

/* SONRA */
.modal-overlay {
    z-index: var(--z-modal); /* 600 */
}
```

### notifications.css (satır 148)

```css
/* ÖNCE */
.notification-dropdown {
    z-index: 1000;
}

/* SONRA */
.notification-dropdown {
    z-index: var(--z-tooltip); /* 500 */
}
```

---

## 6. --card-bg DEĞİŞKENİ EKLE

### global.css'e Ekle (:root bloğuna)

```css
:root {
    /* ... mevcut değişkenler ... */

    /* Card arka plan rengi */
    --card-bg: var(--bg-primary);
}
```

### global-dark.css'e Ekle

```css
.dark,
[data-theme="dark"] {
    /* ... mevcut değişkenler ... */

    --card-bg: #1f2937;
}
```

---

## 7. EKSİK RENK DEĞİŞKENLERİ EKLE

### global.css'e Ekle (:root bloğuna)

```css
:root {
    /* ... mevcut değişkenler ... */

    /* Primary varyantları */
    --color-primary-light: #4dabf7;
    --color-primary-dark: #1c7ed6;

    /* Ek renkler */
    --color-info: #3b82f6;
    --color-purple: #8b5cf6;
}
```

### global-dark.css'e Ekle

```css
.dark,
[data-theme="dark"] {
    /* ... mevcut değişkenler ... */

    --color-primary-light: #79c0ff;
    --color-primary-dark: #58a6ff;
    --color-info: #58a6ff;
    --color-purple: #a78bfa;
}
```

---

## 8. BREAKPOINT DEĞİŞKENLERİ EKLE

### global.css'e Ekle (:root bloğuna)

```css
:root {
    /* ... mevcut değişkenler ... */

    /* Responsive breakpoint'ler */
    --breakpoint-xl: 1400px;
    --breakpoint-lg: 1200px;
    --breakpoint-md: 1024px;
    --breakpoint-sm: 768px;
    --breakpoint-xs: 640px;
    --breakpoint-xxs: 480px;
}
```

---

## 9. SETTINGS.CSS HARDCODED RENK DÜZELTMELERİ

### Gradient Düzeltmeleri

**satır 44:**
```css
/* ÖNCE */
.settings-tab.active {
    color: #ffffff;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    box-shadow: 0 4px 12px -2px rgba(99, 102, 241, 0.4);
}

/* SONRA */
.settings-tab.active {
    color: #ffffff;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
    box-shadow: 0 4px 12px -2px rgba(34, 139, 230, 0.4);
}
```

**satır 157:**
```css
/* ÖNCE */
.toggle-switch input:checked + .toggle-slider {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
}

/* SONRA */
.toggle-switch input:checked + .toggle-slider {
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
}
```

### Dark Mode Override'ları (global-dark.css'e ekle)

```css
/* Settings tab dark mode */
[data-theme="dark"] .settings-tab.active,
.dark .settings-tab.active {
    background: linear-gradient(135deg, #58a6ff 0%, #79c0ff 100%);
    box-shadow: 0 4px 12px -2px rgba(88, 166, 255, 0.4);
}

/* Toggle switch dark mode */
[data-theme="dark"] .toggle-switch input:checked + .toggle-slider,
.dark .toggle-switch input:checked + .toggle-slider {
    background: linear-gradient(135deg, #58a6ff 0%, #79c0ff 100%);
}
```

---

## 10. !IMPORTANT KALDIR (about.css)

### satır 95-98

```css
/* ÖNCE */
.about-changelog-intro {
    margin-top: 2rem !important;
    color: var(--text-secondary) !important;
}

/* SONRA */
.about > .about-changelog-intro {
    margin-top: 2rem;
    color: var(--text-secondary);
}
```

---

## DOĞRULAMA KONTROL LİSTESİ

### Faz 1 Tamamlandıktan Sonra

- [ ] Tüm @keyframes spin duplikeleri kaldırıldı
- [ ] Spinner animasyonları hala çalışıyor (test et)
- [ ] Z-index değişiklikleri uygulandı
- [ ] Modal'lar düzgün katmanlanıyor (test et)
- [ ] Toast'lar modal'ların üzerinde görünüyor (test et)
- [ ] --card-bg değişkeni eklendi
- [ ] stat-card'lar düzgün render ediliyor (test et)

### Faz 2 Tamamlandıktan Sonra

- [ ] Eksik renk değişkenleri eklendi
- [ ] settings.css hardcoded renkler düzeltildi
- [ ] Dark mode'da gradient'ler düzgün görünüyor (test et)
- [ ] @keyframes skeleton-loading konsolide edildi
- [ ] Skeleton loading animasyonları çalışıyor (test et)

### Faz 3 Tamamlandıktan Sonra

- [ ] Breakpoint değişkenleri eklendi
- [ ] !important kullanımları temizlendi
- [ ] Responsive tasarım düzgün çalışıyor (test et)
- [ ] About sayfası düzgün render ediliyor (test et)

---

## TEST SENARYOLARI

### Z-Index Test

1. Modal aç
2. Toast bildirim tetikle
3. Toast modal'ın üzerinde görünmeli
4. Dropdown menü aç
5. Dropdown modal'ın arkasında kalmalı

### Dark Mode Test

1. Dark mode'a geç
2. Settings sayfasını aç
3. Aktif tab gradient'i düzgün görünmeli
4. Toggle switch'ler düzgün görünmeli
5. Tüm metin kontrast yeterli olmalı

### Animasyon Test

1. Yükleme spinner'ı tetikle
2. Spinner döndürülmeli
3. Skeleton loading tetikle
4. Skeleton animasyonu çalışmalı
5. FadeIn animasyonu tetikle
6. Eleman düzgün görünür olmalı

---

**Eylem Planı Sonu**
*Son Güncelleme: 2026-01-27*
