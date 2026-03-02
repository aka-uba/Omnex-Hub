/**
 * About Page Component
 * Displays application information, branding, and changelog
 *
 * @version 2.0.0
 */

import { Logger } from '../core/Logger.js';
import { Toast } from '../components/Toast.js';

export class AboutPage {
    constructor(app) {
        this.app = app;
        this.data = null;
        this.changelogExpanded = false;
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('about');
    }

    render() {
        const basePath = window.OmnexConfig?.basePath || '';

        return `
<div class="page-header">
    <div class="page-header-breadcrumb">
        <a href="#/dashboard">${this.__('breadcrumb.panel')}</a>
        <span class="breadcrumb-separator">›</span>
        <span class="breadcrumb-current">${this.__('title')}</span>
    </div>
    <div class="page-header-main">
        <div class="page-header-left">
            <div class="page-header-icon indigo">
                <i class="ti ti-info-circle"></i>
            </div>
            <div class="page-header-info">
                <h1 class="page-title">${this.__('title')}</h1>
                <p class="page-subtitle">${this.__('subtitle')}</p>
            </div>
        </div>
    </div>
</div>

<!-- Main Info Card -->
<div class="card about-main-card">
    <div class="card-body">
        <div class="about-hero">
            <div class="about-logo-container">
                <img src="${basePath}/branding/logo-light.png" alt="Omnex Display Hub" class="about-logo light-logo" onerror="this.style.display='none'">
                <img src="${basePath}/branding/logo.png" alt="Omnex Display Hub" class="about-logo dark-logo" onerror="this.style.display='none'">
            </div>
            <div class="about-version-badge" id="version-badge">
                <span class="version-label">v</span>
                <span class="version-number" id="version-number">-</span>
            </div>
        </div>

        <div class="about-description">
            <p>Omnex Display Hub, dijital ekran ve etiket yönetimini tek bir merkezde toplayan, sektör bağımsız ve yüksek ölçekli operasyonlar için tasarlanmış bütüncül bir platformdur. Otellerden zincir gıda firmalarına, perakendeden kurumsal kampüslere kadar; dijital içeriğin yönetildiği her ortamda esnek ve güçlü bir altyapı sunar.</p>

            <p>Platform, farklı cihaz türlerini ve kullanım senaryolarını tek bir sistem altında birleştirir. Küçük ekranlardan büyük format dijital tabelalara, elektronik etiketlerden interaktif ekranlara kadar tüm dijital yüzeyler merkezi olarak yönetilebilir. İçerikler yalnızca yayınlanmaz; planlanır, denetlenir ve ölçülebilir hale getirilir.</p>

            <p>Omnex Display Hub, çok dilli yapı ve cihaz bağımsız uyumluluk prensibiyle geliştirilmiştir. Farklı ülkelerde, farklı ekipler ve farklı cihazlar aynı sistem üzerinden sorunsuz şekilde çalışabilir. Hem sunucu üzerinden hem de yerel ağlarda çalışan cihazlarla uyumlu yapısı sayesinde; bulut ve yerel kullanım senaryoları birlikte veya ayrı ayrı kullanılabilir.</p>

            <p>Güvenlik, sistemin temel yapı taşlarından biridir. Cihazların platforma güvenli şekilde dahil edilmesi, yetkilendirilmesi ve yönetilmesi kontrollü bir aktivasyon süreciyle gerçekleşir. Bu sayede hem merkezi kontrol korunur hem de sahadaki cihazlar güvenli biçimde sisteme entegre edilir.</p>

            <p>Platform, veriyle çalışan tüm organizasyonlar için esnek bir altyapı sunar. Farklı kaynaklardan gelen dosyalar tek bir merkezde toplanabilir; ürünler, içerikler ve bilgiler toplu olarak içe aktarılabilir. Aynı şekilde, ihtiyaç duyulan tüm veriler merkezi bir yapı üzerinden dışa aktarılabilir. Bu yaklaşım, manuel süreçleri azaltır ve operasyonel sürekliliği garanti altına alır.</p>

            <p>Omnex Display Hub'ın en güçlü yönlerinden biri, tasarım ve içerik üretim sürecini herkes için erişilebilir hale getirmesidir. Gelişmiş şablon sistemi ve görsel tasarım alanı sayesinde; dijital etiketler ve ekran içerikleri sürükle–bırak mantığıyla oluşturulabilir. Tasarımlar, farklı ekran türlerine ve kullanım senaryolarına kolayca uyarlanabilir.</p>

            <p>Sistem; web sayfalarından görsellere, videolardan dinamik içeriklere kadar her tür içeriğin cihazlara doğrudan gönderilmesine olanak tanır. Bu sayede ekranlar yalnızca statik bir yayın aracı değil, dinamik ve yaşayan bir iletişim kanalı haline gelir.</p>

            <p>Çoklu tema ve yerleşim düzeni desteği sayesinde, her marka kendi kurumsal kimliğine uygun arayüz ve görünümle sistemi kullanabilir. Farklı kullanıcı profilleri, farklı ihtiyaçlara göre özelleştirilebilir; tek bir platform içinde çok sayıda yapı bir arada yönetilebilir.</p>

            <p>Omnex Display Hub, bugün karşılaşılan ihtiyaçlar için değil; büyüyen, genişleyen ve dönüşen organizasyonlar için geliştirilmiş bir altyapıdır. Sürekli gelişen yapısı, yeni özelliklerle güçlenen mimarisi ve uzun vadeli vizyonuyla, dijital ekran yönetimini geleceğe taşır.</p>

            <p class="about-changelog-intro">Bu sayfanın devamında yer alan versiyon ve işlem geçmişi, platformun gelişim sürecini ve arkasındaki mühendislik yaklaşımını şeffaf bir şekilde ortaya koyar.</p>
        </div>

        <!-- Feature Icons -->
        <div class="about-features">
            <div class="about-feature">
                <div class="about-feature-icon blue">
                    <i class="ti ti-devices"></i>
                </div>
                <div class="about-feature-text">
                    <h4>${this.__('features.multiDevice')}</h4>
                    <p>${this.__('features.multiDeviceDesc')}</p>
                </div>
            </div>
            <div class="about-feature">
                <div class="about-feature-icon green">
                    <i class="ti ti-language"></i>
                </div>
                <div class="about-feature-text">
                    <h4>${this.__('features.multiLanguage')}</h4>
                    <p>${this.__('features.multiLanguageDesc')}</p>
                </div>
            </div>
            <div class="about-feature">
                <div class="about-feature-icon purple">
                    <i class="ti ti-shield-check"></i>
                </div>
                <div class="about-feature-text">
                    <h4>${this.__('features.security')}</h4>
                    <p>${this.__('features.securityDesc')}</p>
                </div>
            </div>
            <div class="about-feature">
                <div class="about-feature-icon orange">
                    <i class="ti ti-template"></i>
                </div>
                <div class="about-feature-text">
                    <h4>${this.__('features.templates')}</h4>
                    <p>${this.__('features.templatesDesc')}</p>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Changelog Card -->
<div class="card about-changelog-card">
    <div class="card-header" id="changelog-header">
        <h3 class="card-title">
            <i class="ti ti-git-branch"></i>
            ${this.__('changelog.title')}
        </h3>
        <button class="btn btn-ghost btn-sm" id="toggle-changelog-btn">
            <i class="ti ti-chevron-down" id="changelog-chevron"></i>
            <span id="changelog-toggle-text">${this.__('changelog.expand')}</span>
        </button>
    </div>
    <div class="card-body changelog-body" id="changelog-content" style="display: none;">
        <div class="changelog-loading" id="changelog-loading">
            <div class="spinner"></div>
            <span>${this.__('messages.loading')}</span>
        </div>
        <div class="changelog-content" id="changelog-markdown"></div>
    </div>
</div>

<!-- Footer -->
<div class="about-footer">
    <div class="about-copyright">
        <span id="copyright-text">© ${new Date().getFullYear()} Omnex Display Hub</span>
        <span class="about-separator">•</span>
        <span>${this.__('footer.allRightsReserved')}</span>
    </div>
    <div class="about-developer">
        <span>${this.__('footer.developedBy')}</span>
        <span class="about-developer-name">Uğur Bayram Akagündüz</span>
        <div class="about-developer-contact">
            <a href="https://omnexcore.com" target="_blank" rel="noopener">
                <i class="ti ti-world"></i>
                omnexcore.com
            </a>
            <a href="mailto:support@omnex.com">
                <i class="ti ti-mail"></i>
                support@omnex.com
            </a>
        </div>
    </div>
</div>
        `;
    }

    async init() {
        this.bindEvents();
        await this.loadData();
    }

    bindEvents() {
        // Toggle changelog
        document.getElementById('toggle-changelog-btn')?.addEventListener('click', () => {
            this.toggleChangelog();
        });

        document.getElementById('changelog-header')?.addEventListener('click', (e) => {
            if (e.target.closest('#toggle-changelog-btn')) return;
            this.toggleChangelog();
        });
    }

    async loadData() {
        try {
            const response = await this.app.api.get('/system/about');
            this.data = response.data;

            // Update version
            if (this.data?.version) {
                document.getElementById('version-number').textContent = this.data.version;
            }

            // Store changelog for later
            if (this.data?.changelog) {
                this.changelogContent = this.data.changelog;
            }
        } catch (error) {
            Logger.error('About data load error:', error);
            // Set fallback version
            document.getElementById('version-number').textContent = '1.0.0-beta';
        }
    }

    toggleChangelog() {
        const content = document.getElementById('changelog-content');
        const chevron = document.getElementById('changelog-chevron');
        const toggleText = document.getElementById('changelog-toggle-text');

        if (!content) return;

        this.changelogExpanded = !this.changelogExpanded;

        if (this.changelogExpanded) {
            content.style.display = 'block';
            chevron.classList.remove('ti-chevron-down');
            chevron.classList.add('ti-chevron-up');
            toggleText.textContent = this.__('changelog.collapse');

            // Load changelog if not already loaded
            if (!this.changelogLoaded) {
                this.renderChangelog();
            }
        } else {
            content.style.display = 'none';
            chevron.classList.remove('ti-chevron-up');
            chevron.classList.add('ti-chevron-down');
            toggleText.textContent = this.__('changelog.expand');
        }
    }

    renderChangelog() {
        const loading = document.getElementById('changelog-loading');
        const markdown = document.getElementById('changelog-markdown');

        if (!markdown) return;

        // Hide loading, show content
        if (loading) loading.style.display = 'none';

        if (this.changelogContent) {
            // Parse markdown to HTML
            markdown.innerHTML = this.parseMarkdown(this.changelogContent);
            this.changelogLoaded = true;
        } else {
            markdown.innerHTML = `<p class="text-muted">${this.__('changelog.noContent')}</p>`;
        }
    }

    parseMarkdown(md) {
        if (!md) return '';

        // Simple markdown parser
        let html = md
            // Escape HTML
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Headers
            .replace(/^### (.*$)/gim, '<h4 class="changelog-h4">$1</h4>')
            .replace(/^## \[(.*?)\] - (.*$)/gim, '<h3 class="changelog-version"><span class="version-tag">$1</span><span class="version-date">$2</span></h3>')
            .replace(/^## (.*$)/gim, '<h3 class="changelog-h3">$1</h3>')
            .replace(/^# (.*$)/gim, '<h2 class="changelog-h2">$1</h2>')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Code blocks
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="changelog-code"><code>$2</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code class="changelog-inline-code">$1</code>')
            // Checkboxes
            .replace(/- \[x\] (.*)/gi, '<div class="changelog-checkbox checked"><i class="ti ti-check"></i> $1</div>')
            .replace(/- \[ \] (.*)/gi, '<div class="changelog-checkbox"><i class="ti ti-square"></i> $1</div>')
            // List items
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            // Horizontal rules
            .replace(/^---$/gim, '<hr class="changelog-hr">')
            // Paragraphs (wrap loose text)
            .replace(/\n\n/g, '</p><p>')
            // Line breaks
            .replace(/\n/g, '<br>');

        // Wrap list items in ul
        html = html.replace(/(<li>.*<\/li>)/gs, (match) => {
            if (!match.startsWith('<ul>')) {
                return '<ul class="changelog-list">' + match + '</ul>';
            }
            return match;
        });

        // Fix multiple consecutive uls
        html = html.replace(/<\/ul>\s*<ul class="changelog-list">/g, '');

        return `<div class="changelog-parsed">${html}</div>`;
    }

    destroy() {
        this.app.i18n.clearPageTranslations();
    }
}

export default AboutPage;
