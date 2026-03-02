/**
 * QueueMetrics - Kuyruk Metrikleri ve Utility Modülü (SIFIR DOM)
 *
 * QueueDashboard'dan ayrılmış bağımsız utility modülü.
 * Format fonksiyonları, hesaplama metodları ve yardımcı fonksiyonlar sağlar.
 *
 * ÖNEMLİ: Bu modül SIFIR DOM manipülasyonu yapar. Sadece pure fonksiyonlar içerir.
 *
 * @version 1.0.0
 * @example
 * import {
 *     formatNumber,
 *     formatTime,
 *     formatDateShort,
 *     formatDuration,
 *     formatFileSize,
 *     calculateProgress,
 *     getStatusColor,
 *     getPriorityWeight
 * } from './dashboard/QueueMetrics.js';
 *
 * const formatted = formatNumber(1234567);  // "1.234.567"
 * const time = formatTime('2026-01-24T10:30:00');  // "24.01 10:30"
 * const progress = calculateProgress(75, 100);  // 75
 */

// ==================== Locale Ayarları ====================

const DEFAULT_LOCALE = 'tr-TR';

// ==================== Sayı Formatlama ====================

/**
 * Sayıyı binlik ayraçlı formata çevir
 * @param {number|string|null|undefined} num - Sayı
 * @param {string} locale - Locale (varsayılan: tr-TR)
 * @returns {string} Formatlanmış sayı
 * @example
 * formatNumber(1234567) // "1.234.567"
 * formatNumber(null) // "0"
 */
export function formatNumber(num, locale = DEFAULT_LOCALE) {
    if (num === null || num === undefined || num === '') return '0';
    const parsed = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(parsed)) return '0';
    return new Intl.NumberFormat(locale).format(parsed);
}

/**
 * Yüzde değerini formatla
 * @param {number} value - Yüzde değeri (0-100)
 * @param {number} decimals - Ondalık basamak sayısı
 * @returns {string} Formatlanmış yüzde
 * @example
 * formatPercent(75.5) // "75.5%"
 * formatPercent(100) // "100%"
 */
export function formatPercent(value, decimals = 1) {
    if (value === null || value === undefined) return '0%';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0%';
    return `${num.toFixed(decimals)}%`;
}

/**
 * Para birimini formatla
 * @param {number} amount - Tutar
 * @param {string} currency - Para birimi kodu
 * @param {string} locale - Locale
 * @returns {string} Formatlanmış tutar
 */
export function formatCurrency(amount, currency = 'TRY', locale = DEFAULT_LOCALE) {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
    }).format(amount);
}

// ==================== Tarih/Zaman Formatlama ====================

/**
 * Tarih/saati formatla
 * @param {string|Date|null} dateStr - Tarih string veya Date objesi
 * @param {Object} options - Intl.DateTimeFormat seçenekleri
 * @returns {string} Formatlanmış tarih/saat
 * @example
 * formatTime('2026-01-24T10:30:00') // "24.01 10:30"
 */
export function formatTime(dateStr, options = {}) {
    if (!dateStr) return '-';
    try {
        const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
        if (isNaN(date.getTime())) return '-';

        const defaultOptions = {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        };

        return date.toLocaleString(DEFAULT_LOCALE, { ...defaultOptions, ...options });
    } catch {
        return String(dateStr);
    }
}

/**
 * Kısa tarih formatla (gün.ay)
 * @param {string|Date|null} dateStr - Tarih
 * @returns {string} Formatlanmış kısa tarih
 * @example
 * formatDateShort('2026-01-24') // "24.01"
 */
export function formatDateShort(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
        if (isNaN(date.getTime())) return '-';

        return date.toLocaleDateString(DEFAULT_LOCALE, {
            day: '2-digit',
            month: '2-digit'
        });
    } catch {
        return String(dateStr);
    }
}

/**
 * Tam tarih formatla (gün.ay.yıl)
 * @param {string|Date|null} dateStr - Tarih
 * @returns {string} Formatlanmış tam tarih
 * @example
 * formatDateFull('2026-01-24') // "24.01.2026"
 */
export function formatDateFull(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
        if (isNaN(date.getTime())) return '-';

        return date.toLocaleDateString(DEFAULT_LOCALE, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return String(dateStr);
    }
}

/**
 * Tam tarih ve saat formatla
 * @param {string|Date|null} dateStr - Tarih
 * @returns {string} Formatlanmış tarih ve saat
 * @example
 * formatDateTime('2026-01-24T10:30:00') // "24.01.2026 10:30"
 */
export function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
        if (isNaN(date.getTime())) return '-';

        return date.toLocaleString(DEFAULT_LOCALE, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return String(dateStr);
    }
}

/**
 * Süreyi insanca okunabilir formata çevir
 * @param {number} seconds - Saniye cinsinden süre
 * @returns {string} Formatlanmış süre
 * @example
 * formatDuration(90) // "1 dk 30 sn"
 * formatDuration(3665) // "1 saat 1 dk"
 */
export function formatDuration(seconds) {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return '-';

    seconds = Math.abs(Math.round(seconds));

    if (seconds < 60) {
        return `${seconds} sn`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
        return remainingSeconds > 0
            ? `${minutes} dk ${remainingSeconds} sn`
            : `${minutes} dk`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours < 24) {
        return remainingMinutes > 0
            ? `${hours} saat ${remainingMinutes} dk`
            : `${hours} saat`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    return remainingHours > 0
        ? `${days} gün ${remainingHours} saat`
        : `${days} gün`;
}

/**
 * Göreli zaman formatla (örn: "5 dakika önce")
 * @param {string|Date} dateStr - Tarih
 * @returns {string} Göreli zaman
 */
export function formatRelativeTime(dateStr) {
    if (!dateStr) return '-';

    try {
        const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
        if (isNaN(date.getTime())) return '-';

        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) return window.__?.('time.justNow') || 'Just now';
        if (diffMin < 60) return window.__?.('time.minutesAgo', { count: diffMin }) || `${diffMin} minutes ago`;
        if (diffHour < 24) return window.__?.('time.hoursAgo', { count: diffHour }) || `${diffHour} hours ago`;
        if (diffDay < 7) return window.__?.('time.daysAgo', { count: diffDay }) || `${diffDay} days ago`;

        return formatDateShort(date);
    } catch {
        return String(dateStr);
    }
}

// ==================== Dosya Boyutu Formatlama ====================

/**
 * Dosya boyutunu insanca okunabilir formata çevir
 * @param {number} bytes - Bayt cinsinden boyut
 * @param {number} decimals - Ondalık basamak sayısı
 * @returns {string} Formatlanmış boyut
 * @example
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(1536000) // "1.46 MB"
 */
export function formatFileSize(bytes, decimals = 2) {
    if (bytes === null || bytes === undefined || bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

// ==================== İlerleme Hesaplama ====================

/**
 * İlerleme yüzdesini hesapla
 * @param {number} completed - Tamamlanan
 * @param {number} total - Toplam
 * @returns {number} Yüzde (0-100)
 * @example
 * calculateProgress(75, 100) // 75
 * calculateProgress(3, 10) // 30
 */
export function calculateProgress(completed, total) {
    if (!total || total === 0) return 0;
    const progress = (completed / total) * 100;
    return Math.min(100, Math.max(0, Math.round(progress)));
}

/**
 * İlerleme durumunu metin olarak al
 * @param {number} completed - Tamamlanan
 * @param {number} total - Toplam
 * @returns {string} İlerleme metni
 * @example
 * getProgressText(75, 100) // "75 / 100 (75%)"
 */
export function getProgressText(completed, total) {
    const percent = calculateProgress(completed, total);
    return `${formatNumber(completed)} / ${formatNumber(total)} (${percent}%)`;
}

// ==================== Durum ve Öncelik ====================

/**
 * Durum için renk sınıfı al
 * @param {string} status - Durum kodu
 * @returns {string} CSS renk sınıfı
 */
export function getStatusColor(status) {
    const colors = {
        pending: 'warning',
        processing: 'info',
        completed: 'success',
        failed: 'danger',
        cancelled: 'secondary',
        scheduled: 'primary',
        retrying: 'warning'
    };
    return colors[status] || 'secondary';
}

/**
 * Durum için ikon al
 * @param {string} status - Durum kodu
 * @returns {string} Tabler icon sınıfı
 */
export function getStatusIcon(status) {
    const icons = {
        pending: 'ti-clock',
        processing: 'ti-loader',
        completed: 'ti-check',
        failed: 'ti-x',
        cancelled: 'ti-ban',
        scheduled: 'ti-calendar-time',
        retrying: 'ti-refresh'
    };
    return icons[status] || 'ti-circle';
}

/**
 * Öncelik için ağırlık al (sıralama için)
 * @param {string} priority - Öncelik kodu
 * @returns {number} Ağırlık değeri
 */
export function getPriorityWeight(priority) {
    const weights = {
        urgent: 100,
        high: 75,
        normal: 50,
        low: 25
    };
    return weights[priority] || 50;
}

/**
 * Öncelik için renk sınıfı al
 * @param {string} priority - Öncelik kodu
 * @returns {string} CSS renk sınıfı
 */
export function getPriorityColor(priority) {
    const colors = {
        urgent: 'danger',
        high: 'warning',
        normal: 'primary',
        low: 'secondary'
    };
    return colors[priority] || 'secondary';
}

/**
 * Öncelik için ikon al
 * @param {string} priority - Öncelik kodu
 * @returns {string} Tabler icon sınıfı
 */
export function getPriorityIcon(priority) {
    const icons = {
        urgent: 'ti-alert-triangle',
        high: 'ti-arrow-up',
        normal: 'ti-minus',
        low: 'ti-arrow-down'
    };
    return icons[priority] || 'ti-minus';
}

// ==================== Hata Tipi ====================

/**
 * Hata tipi için renk sınıfı al
 * @param {string} errorType - Hata tipi
 * @returns {string} CSS renk sınıfı
 */
export function getErrorTypeColor(errorType) {
    const colors = {
        timeout: 'warning',
        connection: 'danger',
        device_offline: 'secondary',
        upload_failed: 'danger',
        unknown: 'secondary'
    };
    return colors[errorType] || 'secondary';
}

/**
 * Hata tipi için ikon al
 * @param {string} errorType - Hata tipi
 * @returns {string} Tabler icon sınıfı
 */
export function getErrorTypeIcon(errorType) {
    const icons = {
        timeout: 'ti-clock-x',
        connection: 'ti-wifi-off',
        device_offline: 'ti-device-desktop-off',
        upload_failed: 'ti-upload-x',
        unknown: 'ti-help-circle'
    };
    return icons[errorType] || 'ti-alert-circle';
}

// ==================== Cihaz Tipi ====================

/**
 * Cihaz tipi için ikon al
 * @param {string} deviceType - Cihaz tipi
 * @returns {string} Tabler icon sınıfı
 */
export function getDeviceTypeIcon(deviceType) {
    const icons = {
        esl: 'ti-tag',
        esl_android: 'ti-device-tablet',
        android_tv: 'ti-device-tv',
        tv: 'ti-device-tv',
        tablet: 'ti-device-tablet',
        web_display: 'ti-browser',
        pwa_player: 'ti-player-play',
        panel: 'ti-layout-board'
    };
    return icons[deviceType] || 'ti-device-desktop';
}

// ==================== Backoff Hesaplama ====================

/**
 * Exponential backoff süresini hesapla
 * @param {number} retryCount - Mevcut deneme sayısı
 * @param {number} baseDelay - Temel bekleme süresi (ms)
 * @param {number} multiplier - Çarpan
 * @param {number} maxDelay - Maksimum bekleme süresi (ms)
 * @returns {number} Hesaplanan bekleme süresi (ms)
 */
export function calculateBackoff(retryCount, baseDelay = 1000, multiplier = 2, maxDelay = 30000) {
    const delay = baseDelay * Math.pow(multiplier, retryCount);
    return Math.min(delay, maxDelay);
}

/**
 * Sonraki retry zamanını hesapla
 * @param {number} retryCount - Mevcut deneme sayısı
 * @param {string} errorType - Hata tipi
 * @returns {Date} Sonraki retry zamanı
 */
export function calculateNextRetryTime(retryCount, errorType = 'unknown') {
    const policies = {
        timeout: { baseDelay: 30000, multiplier: 2, maxDelay: 300000 },
        connection: { baseDelay: 10000, multiplier: 1.5, maxDelay: 120000 },
        device_offline: { baseDelay: 60000, multiplier: 2, maxDelay: 600000 },
        upload_failed: { baseDelay: 15000, multiplier: 2, maxDelay: 180000 },
        unknown: { baseDelay: 30000, multiplier: 2, maxDelay: 120000 }
    };

    const policy = policies[errorType] || policies.unknown;
    const delayMs = calculateBackoff(retryCount, policy.baseDelay, policy.multiplier, policy.maxDelay);

    return new Date(Date.now() + delayMs);
}

// ==================== Veri Dönüşümleri ====================

/**
 * Job verisini normalleştir (API tutarsızlıklarını düzelt)
 * @param {Object} job - Ham job verisi
 * @returns {Object} Normalleştirilmiş job
 */
export function normalizeJobData(job) {
    if (!job) return null;

    return {
        ...job,
        // Alan adı tutarsızlıklarını düzelt
        total_devices: job.total_devices ?? job.devices_total ?? 0,
        completed_devices: job.completed_devices ?? job.devices_completed ?? 0,
        failed_devices: job.failed_devices ?? job.devices_failed ?? 0,
        skipped_devices: job.skipped_devices ?? job.devices_skipped ?? 0,
        progress_percent: job.progress_percent ?? job.progress ?? 0,
        // Status normalizasyonu
        status: normalizeStatus(job.status),
        // Priority normalizasyonu
        priority: normalizePriority(job.priority)
    };
}

/**
 * Durum değerini normalleştir
 * @param {string} status - Ham durum değeri
 * @returns {string} Normalleştirilmiş durum
 */
export function normalizeStatus(status) {
    const statusMap = {
        'pending': 'pending',
        'queued': 'pending',
        'waiting': 'pending',
        'processing': 'processing',
        'running': 'processing',
        'in_progress': 'processing',
        'completed': 'completed',
        'done': 'completed',
        'success': 'completed',
        'failed': 'failed',
        'error': 'failed',
        'cancelled': 'cancelled',
        'canceled': 'cancelled',
        'aborted': 'cancelled'
    };
    return statusMap[String(status).toLowerCase()] || status;
}

/**
 * Öncelik değerini normalleştir
 * @param {string|number} priority - Ham öncelik değeri
 * @returns {string} Normalleştirilmiş öncelik
 */
export function normalizePriority(priority) {
    // Sayısal değerler için
    if (typeof priority === 'number') {
        if (priority >= 90) return 'urgent';
        if (priority >= 70) return 'high';
        if (priority >= 40) return 'normal';
        return 'low';
    }

    const priorityMap = {
        'urgent': 'urgent',
        'critical': 'urgent',
        'high': 'high',
        'important': 'high',
        'normal': 'normal',
        'medium': 'normal',
        'default': 'normal',
        'low': 'low',
        'background': 'low'
    };
    return priorityMap[String(priority).toLowerCase()] || 'normal';
}

// ==================== Doğrulama ====================

/**
 * Job verisinin geçerli olup olmadığını kontrol et
 * @param {Object} job - Job verisi
 * @returns {boolean} Geçerli mi
 */
export function isValidJob(job) {
    return job &&
           typeof job === 'object' &&
           job.id &&
           job.status;
}

/**
 * Tarihin geçerli olup olmadığını kontrol et
 * @param {string|Date} dateStr - Tarih
 * @returns {boolean} Geçerli mi
 */
export function isValidDate(dateStr) {
    if (!dateStr) return false;
    const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
    return !isNaN(date.getTime());
}

// ==================== Sıralama ====================

/**
 * Job listesini önceliğe göre sırala
 * @param {Array} jobs - Job listesi
 * @param {string} direction - 'asc' veya 'desc'
 * @returns {Array} Sıralanmış liste
 */
export function sortByPriority(jobs, direction = 'desc') {
    return [...jobs].sort((a, b) => {
        const weightA = getPriorityWeight(a.priority);
        const weightB = getPriorityWeight(b.priority);
        return direction === 'desc' ? weightB - weightA : weightA - weightB;
    });
}

/**
 * Job listesini tarihe göre sırala
 * @param {Array} jobs - Job listesi
 * @param {string} field - Tarih alanı adı
 * @param {string} direction - 'asc' veya 'desc'
 * @returns {Array} Sıralanmış liste
 */
export function sortByDate(jobs, field = 'created_at', direction = 'desc') {
    return [...jobs].sort((a, b) => {
        const dateA = new Date(a[field] || 0);
        const dateB = new Date(b[field] || 0);
        return direction === 'desc' ? dateB - dateA : dateA - dateB;
    });
}

// ==================== Filtreleme ====================

/**
 * Job listesini duruma göre filtrele
 * @param {Array} jobs - Job listesi
 * @param {string|string[]} status - Durum veya durum dizisi
 * @returns {Array} Filtrelenmiş liste
 */
export function filterByStatus(jobs, status) {
    if (!status || status === 'all') return jobs;
    const statuses = Array.isArray(status) ? status : [status];
    return jobs.filter(job => statuses.includes(normalizeStatus(job.status)));
}

/**
 * Job listesini önceliğe göre filtrele
 * @param {Array} jobs - Job listesi
 * @param {string|string[]} priority - Öncelik veya öncelik dizisi
 * @returns {Array} Filtrelenmiş liste
 */
export function filterByPriority(jobs, priority) {
    if (!priority || priority === 'all') return jobs;
    const priorities = Array.isArray(priority) ? priority : [priority];
    return jobs.filter(job => priorities.includes(normalizePriority(job.priority)));
}

// ==================== İstatistik Hesaplama ====================

/**
 * Job listesinden istatistikleri hesapla
 * @param {Array} jobs - Job listesi
 * @returns {Object} İstatistikler
 */
export function calculateJobStats(jobs) {
    if (!jobs || !Array.isArray(jobs)) {
        return {
            total: 0,
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            successRate: 0
        };
    }

    const stats = {
        total: jobs.length,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
    };

    jobs.forEach(job => {
        const status = normalizeStatus(job.status);
        if (stats.hasOwnProperty(status)) {
            stats[status]++;
        }
    });

    const finished = stats.completed + stats.failed;
    stats.successRate = finished > 0
        ? Math.round((stats.completed / finished) * 100)
        : 0;

    return stats;
}

/**
 * Cihaz istatistiklerini hesapla
 * @param {Array} jobs - Job listesi
 * @returns {Object} Cihaz istatistikleri
 */
export function calculateDeviceStats(jobs) {
    if (!jobs || !Array.isArray(jobs)) {
        return {
            total: 0,
            completed: 0,
            failed: 0,
            pending: 0,
            successRate: 0
        };
    }

    let total = 0, completed = 0, failed = 0;

    jobs.forEach(job => {
        const normalized = normalizeJobData(job);
        total += normalized.total_devices;
        completed += normalized.completed_devices;
        failed += normalized.failed_devices;
    });

    const finished = completed + failed;

    return {
        total,
        completed,
        failed,
        pending: total - completed - failed,
        successRate: finished > 0 ? Math.round((completed / finished) * 100) : 0
    };
}

// ==================== Export Default ====================

export default {
    // Sayı formatlama
    formatNumber,
    formatPercent,
    formatCurrency,

    // Tarih/Zaman formatlama
    formatTime,
    formatDateShort,
    formatDateFull,
    formatDateTime,
    formatDuration,
    formatRelativeTime,

    // Dosya boyutu
    formatFileSize,

    // İlerleme
    calculateProgress,
    getProgressText,

    // Durum
    getStatusColor,
    getStatusIcon,

    // Öncelik
    getPriorityWeight,
    getPriorityColor,
    getPriorityIcon,

    // Hata tipi
    getErrorTypeColor,
    getErrorTypeIcon,

    // Cihaz tipi
    getDeviceTypeIcon,

    // Backoff
    calculateBackoff,
    calculateNextRetryTime,

    // Veri dönüşümleri
    normalizeJobData,
    normalizeStatus,
    normalizePriority,

    // Doğrulama
    isValidJob,
    isValidDate,

    // Sıralama
    sortByPriority,
    sortByDate,

    // Filtreleme
    filterByStatus,
    filterByPriority,

    // İstatistikler
    calculateJobStats,
    calculateDeviceStats
};
