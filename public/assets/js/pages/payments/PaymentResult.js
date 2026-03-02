/**
 * Payment Result Page
 *
 * 3D Secure ödeme işlemi sonrası gösterilen sayfa.
 * URL parametrelerinden işlem sonucunu okur ve kullanıcıya gösterir.
 */

export class PaymentResult {
    constructor(app) {
        this.app = app;
        this.transactionId = null;
        this.status = null;
        this.transactionData = null;
    }

    __(key, params = {}) {
        return this.app.i18n.t(key, params);
    }

    async preload() {
        await this.app.i18n.loadPageTranslations('payments');
    }

    render() {
        return `
            <div class="payment-result-page">
                <div class="payment-result-container">
                    <div id="payment-result-content">
                        <div class="payment-loading">
                            <div class="spinner"></div>
                            <p>${this.__('result.loading')}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async init() {
        // URL parametrelerini al
        this.parseUrlParams();

        // İşlem durumunu kontrol et
        await this.checkTransactionStatus();
    }

    parseUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        this.transactionId = urlParams.get('transaction_id') || urlParams.get('id');
        this.status = urlParams.get('status');

        // Hash'den de kontrol et
        const hash = window.location.hash;
        const hashParams = new URLSearchParams(hash.split('?')[1] || '');
        if (!this.transactionId) {
            this.transactionId = hashParams.get('transaction_id') || hashParams.get('id');
        }
        if (!this.status) {
            this.status = hashParams.get('status');
        }
    }

    async checkTransactionStatus() {
        const contentEl = document.getElementById('payment-result-content');

        if (!this.transactionId) {
            this.renderError(contentEl, this.__('result.noTransaction'));
            return;
        }

        try {
            const response = await this.app.api.get(`/payments/status/${this.transactionId}`);

            if (response.success && response.data) {
                this.transactionData = response.data;
                this.renderResult(contentEl, response.data);
            } else {
                this.renderError(contentEl, response.message || this.__('result.fetchError'));
            }
        } catch (error) {
            console.error('Payment status error:', error);
            this.renderError(contentEl, this.__('result.fetchError'));
        }
    }

    renderResult(container, transaction) {
        const isSuccess = transaction.status === 'completed';
        const isFailed = transaction.status === 'failed';
        const isPending = transaction.status === 'pending' || transaction.status === 'processing';

        let iconClass, iconColor, statusText, statusClass;

        if (isSuccess) {
            iconClass = 'ti-circle-check';
            iconColor = 'var(--color-success)';
            statusText = this.__('result.success');
            statusClass = 'success';
        } else if (isFailed) {
            iconClass = 'ti-circle-x';
            iconColor = 'var(--color-danger)';
            statusText = this.__('result.failed');
            statusClass = 'failed';
        } else {
            iconClass = 'ti-clock';
            iconColor = 'var(--color-warning)';
            statusText = this.__('result.pending');
            statusClass = 'pending';
        }

        container.innerHTML = `
            <div class="payment-result ${statusClass}">
                <div class="payment-result-icon" style="color: ${iconColor}">
                    <i class="ti ${iconClass}"></i>
                </div>

                <h1 class="payment-result-title">${statusText}</h1>

                ${isSuccess ? `
                    <p class="payment-result-message">
                        ${this.__('result.successMessage')}
                    </p>
                ` : ''}

                ${isFailed ? `
                    <p class="payment-result-message error">
                        ${transaction.error_message || this.__('result.failedMessage')}
                    </p>
                    ${transaction.error_code ? `
                        <p class="payment-error-code">
                            ${this.__('result.errorCode')}: ${transaction.error_code}
                        </p>
                    ` : ''}
                ` : ''}

                ${isPending ? `
                    <p class="payment-result-message">
                        ${this.__('result.pendingMessage')}
                    </p>
                    <div class="payment-pending-spinner">
                        <div class="spinner"></div>
                    </div>
                ` : ''}

                <div class="payment-result-details">
                    <div class="detail-row">
                        <span class="detail-label">${this.__('result.transactionId')}:</span>
                        <span class="detail-value">${transaction.transaction_id || transaction.id}</span>
                    </div>

                    ${transaction.reference_no ? `
                        <div class="detail-row">
                            <span class="detail-label">${this.__('result.referenceNo')}:</span>
                            <span class="detail-value">${transaction.reference_no}</span>
                        </div>
                    ` : ''}

                    <div class="detail-row">
                        <span class="detail-label">${this.__('result.amount')}:</span>
                        <span class="detail-value amount">${this.formatAmount(transaction.amount, transaction.currency)}</span>
                    </div>

                    ${transaction.installment > 1 ? `
                        <div class="detail-row">
                            <span class="detail-label">${this.__('result.installment')}:</span>
                            <span class="detail-value">${transaction.installment} ${this.__('result.installmentSuffix')}</span>
                        </div>
                    ` : ''}

                    ${transaction.card_masked_pan ? `
                        <div class="detail-row">
                            <span class="detail-label">${this.__('result.card')}:</span>
                            <span class="detail-value">${transaction.card_masked_pan}</span>
                        </div>
                    ` : ''}

                    ${transaction.license_plan ? `
                        <div class="detail-row">
                            <span class="detail-label">${this.__('result.plan')}:</span>
                            <span class="detail-value">${this.getPlanLabel(transaction.license_plan)}</span>
                        </div>
                    ` : ''}

                    ${transaction.license_period ? `
                        <div class="detail-row">
                            <span class="detail-label">${this.__('result.period')}:</span>
                            <span class="detail-value">${this.getPeriodLabel(transaction.license_period)}</span>
                        </div>
                    ` : ''}

                    ${transaction.license_extension_days > 0 ? `
                        <div class="detail-row highlight">
                            <span class="detail-label">${this.__('result.extension')}:</span>
                            <span class="detail-value">${transaction.license_extension_days} ${this.__('result.days')}</span>
                        </div>
                    ` : ''}

                    <div class="detail-row">
                        <span class="detail-label">${this.__('result.date')}:</span>
                        <span class="detail-value">${this.formatDate(transaction.created_at)}</span>
                    </div>
                </div>

                <div class="payment-result-actions">
                    ${isSuccess ? `
                        <a href="#/admin/licenses" class="btn btn-primary">
                            <i class="ti ti-license"></i>
                            ${this.__('result.viewLicenses')}
                        </a>
                    ` : ''}

                    ${isFailed ? `
                        <a href="#/admin/licenses" class="btn btn-primary">
                            <i class="ti ti-refresh"></i>
                            ${this.__('result.tryAgain')}
                        </a>
                    ` : ''}

                    <a href="#/dashboard" class="btn btn-outline">
                        <i class="ti ti-home"></i>
                        ${this.__('result.backToDashboard')}
                    </a>
                </div>
            </div>
        `;

        // Pending durumunda periyodik kontrol yap
        if (isPending) {
            this.startPendingCheck();
        }
    }

    renderError(container, message) {
        container.innerHTML = `
            <div class="payment-result error">
                <div class="payment-result-icon" style="color: var(--color-danger)">
                    <i class="ti ti-alert-circle"></i>
                </div>

                <h1 class="payment-result-title">${this.__('result.error')}</h1>

                <p class="payment-result-message error">${message}</p>

                <div class="payment-result-actions">
                    <a href="#/admin/licenses" class="btn btn-primary">
                        <i class="ti ti-license"></i>
                        ${this.__('result.viewLicenses')}
                    </a>

                    <a href="#/dashboard" class="btn btn-outline">
                        <i class="ti ti-home"></i>
                        ${this.__('result.backToDashboard')}
                    </a>
                </div>
            </div>
        `;
    }

    startPendingCheck() {
        this.pendingCheckInterval = setInterval(async () => {
            try {
                const response = await this.app.api.get(`/payments/status/${this.transactionId}`);

                if (response.success && response.data) {
                    const newStatus = response.data.status;

                    if (newStatus !== 'pending' && newStatus !== 'processing') {
                        clearInterval(this.pendingCheckInterval);
                        this.transactionData = response.data;
                        const contentEl = document.getElementById('payment-result-content');
                        this.renderResult(contentEl, response.data);
                    }
                }
            } catch (error) {
                console.error('Pending check error:', error);
            }
        }, 3000); // Her 3 saniyede bir kontrol et
    }

    formatAmount(amount, currency = 'TRY') {
        const numAmount = Number(amount) / 100; // Kuruştan TL'ye çevir
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: currency
        }).format(numAmount);
    }

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    getPlanLabel(plan) {
        const labels = {
            'starter': this.__('plans.starter'),
            'professional': this.__('plans.professional'),
            'enterprise': this.__('plans.enterprise')
        };
        return labels[plan] || plan;
    }

    getPeriodLabel(period) {
        const labels = {
            'monthly': this.__('periods.monthly'),
            'yearly': this.__('periods.yearly'),
            'lifetime': this.__('periods.lifetime')
        };
        return labels[period] || period;
    }

    destroy() {
        if (this.pendingCheckInterval) {
            clearInterval(this.pendingCheckInterval);
        }
        this.app.i18n.clearPageTranslations();
    }
}

export default PaymentResult;
