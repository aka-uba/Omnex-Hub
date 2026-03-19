/**
 * DeviceRegistry - Merkezi cihaz tipi tanimlari
 *
 * Tum cihaz tipleri, ikonlari, badge'leri, yetenekleri ve aksiyonlari
 * burada tanimlanir. Frontend genelinde cihaz tipi kontrolu icin
 * tek kaynak (single source of truth).
 *
 * Yeni cihaz markasi eklemek icin sadece types objesine giriş ekle.
 *
 * @module DeviceRegistry
 * @version 1.0.0
 */

export const DeviceRegistry = {

    // ================================================================
    // Cihaz Tipi Tanimlari
    // ================================================================
    types: {

        // --- ESL Kategorisi ---

        esl: {
            id: 'esl',
            dbType: 'esl',
            label: 'ESL',
            icon: 'ti-device-tablet',
            badge: 'badge-warning',
            category: 'esl',
            adapter: 'pavodisplay',
            capabilities: ['ping', 'send_image', 'reboot', 'clear_storage', 'device_info', 'brightness'],
            requiresIp: true,
        },

        esl_android: {
            id: 'esl_android',
            dbType: 'esl',
            label: 'ESL Tablet',
            icon: 'ti-device-tablet',
            badge: 'badge-cyan',
            category: 'esl',
            adapter: 'pavodisplay',
            capabilities: [
                'ping', 'send_image', 'send_video', 'delta_check', 'reboot',
                'clear_storage', 'brightness', 'device_info', 'firmware_update',
                'bluetooth_provision', 'network_config', 'batch_send', 'gateway_bridge'
            ],
            requiresIp: true,
            ble: {
                namePrefix: '@',
                serviceUuid: '0000fff0-0000-1000-8000-00805f9b34fb',
                writeUuid: '0000fff2-0000-1000-8000-00805f9b34fb',
                notifyUuid: '0000fff1-0000-1000-8000-00805f9b34fb',
            },
        },

        esl_rtos: {
            id: 'esl_rtos',
            dbType: 'esl',
            label: 'ESL RTOS',
            icon: 'ti-device-tablet',
            badge: 'badge-info',
            category: 'esl',
            adapter: 'pavodisplay',
            capabilities: ['ping', 'send_image'],
            requiresIp: true,
        },

        hanshow_esl: {
            id: 'hanshow_esl',
            dbType: 'esl',
            label: 'Hanshow ESL',
            icon: 'ti-device-tablet',
            badge: 'badge-teal',
            category: 'esl',
            adapter: 'hanshow',
            capabilities: ['ping', 'send_image', 'led_flash', 'page_switch', 'batch_send'],
            requiresIp: false,
        },

        // --- Signage Kategorisi ---

        android_tv: {
            id: 'android_tv',
            dbType: 'android_tv',
            label: 'Android TV',
            icon: 'ti-device-tv',
            badge: 'badge-purple',
            category: 'signage',
            capabilities: ['ping', 'send_image', 'send_video', 'playlist_assign'],
            requiresIp: true,
        },

        tv: {
            id: 'tv',
            dbType: 'android_tv',
            label: 'TV',
            icon: 'ti-device-tv',
            badge: 'badge-purple',
            category: 'signage',
            capabilities: ['ping', 'send_image', 'send_video', 'playlist_assign'],
            requiresIp: true,
        },

        pwa_player: {
            id: 'pwa_player',
            dbType: 'android_tv',
            label: 'PWA Player',
            icon: 'ti-device-tv',
            badge: 'badge-blue',
            category: 'signage',
            adapter: 'pwa_player',
            capabilities: ['ping', 'send_image', 'send_video', 'playlist_assign'],
            requiresIp: false,
        },

        stream_player: {
            id: 'stream_player',
            dbType: 'android_tv',
            label: 'Stream Player',
            icon: 'ti-broadcast',
            badge: 'badge-indigo',
            category: 'signage',
            capabilities: ['ping', 'send_video', 'playlist_assign'],
            requiresIp: true,
        },

        tablet: {
            id: 'tablet',
            dbType: 'android_tv',
            label: 'Tablet',
            icon: 'ti-device-tablet',
            badge: 'badge-grape',
            category: 'signage',
            capabilities: ['ping', 'send_image', 'send_video', 'playlist_assign'],
            requiresIp: true,
        },

        mobile: {
            id: 'mobile',
            dbType: 'android_tv',
            label: 'Mobile',
            icon: 'ti-device-mobile',
            badge: 'badge-orange',
            category: 'signage',
            capabilities: ['ping', 'send_image', 'send_video'],
            requiresIp: true,
        },

        web_display: {
            id: 'web_display',
            dbType: 'web_display',
            label: 'Web Display',
            icon: 'ti-browser',
            badge: 'badge-secondary',
            category: 'signage',
            capabilities: ['send_image', 'send_video', 'playlist_assign'],
            requiresIp: false,
        },

        priceview: {
            id: 'priceview',
            dbType: 'android_tv',
            label: 'PriceView',
            icon: 'ti-tag',
            badge: 'badge-amber',
            category: 'signage',
            adapter: 'pwa_player',
            capabilities: ['ping', 'send_image', 'send_video', 'product_sync', 'barcode_scan', 'print'],
            requiresIp: false,
        },

        // --- Panel Kategorisi ---

        panel: {
            id: 'panel',
            dbType: 'panel',
            label: 'Panel',
            icon: 'ti-layout-dashboard',
            badge: 'badge-dark',
            category: 'panel',
            capabilities: [],
            requiresIp: false,
        },
    },

    // ================================================================
    // Cozumleme (Resolve) Metodlari
    // ================================================================

    /**
     * Cihaz satirindan tip tanimini coz.
     * Oncelik: model > original_type > type > fallback
     *
     * @param {Object} device - Cihaz nesnesi (API'den gelen)
     * @returns {Object} Tip tanimi
     */
    resolve(device) {
        if (!device) return this.types.esl;

        const model = device.model || device.device_model || '';
        const type = device.type || device.device_type || '';
        const originalType = device.original_type || '';

        // 1. model alani (veritabaninda saklanan orijinal tip)
        if (model && this.types[model]) return this.types[model];

        // 2. original_type (bazi API sorgulari bunu doner)
        if (originalType && this.types[originalType]) return this.types[originalType];

        // 3. type alani
        if (type && this.types[type]) return this.types[type];

        // 4. Manufacturer bazli fallback
        const manufacturer = (device.manufacturer || '').toLowerCase();
        if (manufacturer.includes('hanshow')) return this.types.hanshow_esl;
        if (manufacturer.includes('pavodisplay') || manufacturer.includes('pavo')) return this.types.esl_android;

        // 5. device_brand bazli fallback
        const brand = (device.device_brand || '').toLowerCase();
        if (brand.includes('hanshow')) return this.types.hanshow_esl;
        if (brand.includes('pavo')) return this.types.esl_android;

        // 6. Varsayilan
        return this.types[type] || this.types.esl;
    },

    // ================================================================
    // Yetenek Kontrol Metodlari
    // ================================================================

    /**
     * Cihazin belirli bir yetenegi var mi?
     *
     * @param {Object} device
     * @param {string} capability - 'ping', 'send_image', 'led_flash', vb.
     * @returns {boolean}
     */
    hasCapability(device, capability) {
        const def = this.resolve(device);
        return (def.capabilities || []).includes(capability);
    },

    /**
     * Cihazin birden fazla yetenekten en az birine sahip mi?
     *
     * @param {Object} device
     * @param {string[]} capabilities
     * @returns {boolean}
     */
    hasAnyCapability(device, capabilities) {
        const def = this.resolve(device);
        const caps = def.capabilities || [];
        return capabilities.some(c => caps.includes(c));
    },

    // ================================================================
    // Gorunum Metodlari
    // ================================================================

    /**
     * Cihaz ikon sinifini doner.
     */
    getIcon(device) {
        return this.resolve(device).icon;
    },

    /**
     * Cihaz badge bilgisini doner.
     *
     * @returns {{ label: string, class: string }}
     */
    getBadge(device) {
        const def = this.resolve(device);
        return {
            label: def.label,
            class: def.badge,
        };
    },

    /**
     * Cihaz badge HTML'ini doner.
     */
    getBadgeHtml(device) {
        const badge = this.getBadge(device);
        return `<span class="badge ${badge.class}">${badge.label}</span>`;
    },

    // ================================================================
    // Kategori Metodlari
    // ================================================================

    /**
     * Cihaz ESL kategorisinde mi?
     */
    isEsl(device) {
        return this.resolve(device).category === 'esl';
    },

    /**
     * Cihaz signage kategorisinde mi?
     */
    isSignage(device) {
        return this.resolve(device).category === 'signage';
    },

    /**
     * Cihaz PriceView mi?
     */
    isPriceView(device) {
        return this.resolve(device).id === 'priceview';
    },

    /**
     * Belirli bir kategorideki tum tip ID'lerini doner.
     */
    getTypesByCategory(category) {
        return Object.values(this.types)
            .filter(t => t.category === category)
            .map(t => t.id);
    },

    /**
     * Tum ESL tip ID'lerini doner.
     */
    getEslTypes() {
        return this.getTypesByCategory('esl');
    },

    /**
     * Tum signage tip ID'lerini doner.
     */
    getSignageTypes() {
        return this.getTypesByCategory('signage');
    },

    // ================================================================
    // Tip Donusum Metodlari
    // ================================================================

    /**
     * Frontend tipi -> DB tipi donusumu (SQLite CHECK constraint).
     */
    getDbType(frontendType) {
        return (this.types[frontendType] || {}).dbType || frontendType;
    },

    /**
     * Cihaz IP gerektiriyor mu?
     */
    requiresIp(device) {
        const def = this.resolve(device);
        return def.requiresIp !== false;
    },

    /**
     * Cihazin BLE profili var mi?
     */
    hasBleProfile(device) {
        const def = this.resolve(device);
        return !!def.ble;
    },

    /**
     * Cihazin BLE profilini doner.
     */
    getBleProfile(device) {
        return this.resolve(device).ble || null;
    },

    // ================================================================
    // Liste Metodlari
    // ================================================================

    /**
     * Tum tipleri select options formatinda doner.
     *
     * @param {string} [category] - Opsiyonel kategori filtresi
     * @returns {Array<{value: string, label: string}>}
     */
    getOptions(category = null) {
        return Object.values(this.types)
            .filter(t => !category || t.category === category)
            .map(t => ({
                value: t.id,
                label: t.label,
            }));
    },

    /**
     * BLE destekleyen tum tipleri doner.
     */
    getBleTypes() {
        return Object.values(this.types)
            .filter(t => !!t.ble)
            .map(t => t.id);
    },

    /**
     * Belirli adapter'a ait tum tipleri doner.
     */
    getTypesByAdapter(adapterId) {
        return Object.values(this.types)
            .filter(t => t.adapter === adapterId)
            .map(t => t.id);
    },
};

// Global erişim icin (non-module contextlerde kullanilabilir)
if (typeof window !== 'undefined') {
    window.DeviceRegistry = DeviceRegistry;
}
