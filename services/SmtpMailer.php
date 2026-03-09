<?php
/**
 * SmtpMailer - Reusable SMTP email sender
 * Reads SMTP config from settings table and sends emails via raw socket.
 * Works on both local (XAMPP) and production servers without external dependencies.
 */

class SmtpMailer
{
    private string $host;
    private int $port;
    private string $username;
    private string $password;
    private string $encryption;
    private string $fromName;
    private string $fromEmail;
    private int $timeout = 15;

    private static ?self $instance = null;
    private static ?array $cachedConfig = null;

    private function __construct(array $config)
    {
        $this->host = $config['smtp_host'] ?? '';
        $this->port = intval($config['smtp_port'] ?? 587);
        $this->username = $config['smtp_username'] ?? '';
        $this->password = $config['smtp_password'] ?? '';
        $this->encryption = $config['smtp_encryption'] ?? 'tls';
        $this->fromName = $config['smtp_from_name'] ?? 'Omnex Display Hub';
        $this->fromEmail = $config['smtp_from_email'] ?? '';
    }

    /**
     * Get singleton instance with config from DB
     */
    public static function getInstance(): ?self
    {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $config = self::loadConfig();
        if (!$config || empty($config['smtp_host']) || empty($config['smtp_from_email'])) {
            return null; // SMTP not configured
        }

        self::$instance = new self($config);
        return self::$instance;
    }

    /**
     * Load SMTP config from settings table
     */
    private static function loadConfig(): ?array
    {
        if (self::$cachedConfig !== null) {
            return self::$cachedConfig;
        }

        try {
            // 1) Preferred source: integration_settings via SettingsResolver (system/company hierarchy)
            if (class_exists('SettingsResolver')) {
                $resolver = new SettingsResolver();
                $companyId = Auth::getActiveCompanyId();
                $effective = $resolver->getEffectiveSettings('smtp', $companyId);
                $normalized = self::normalizeConfig($effective['settings'] ?? []);
                $enabled = array_key_exists('enabled', $normalized) ? (bool)$normalized['enabled'] : true;

                if ($enabled && !empty($normalized['smtp_host']) && !empty($normalized['smtp_from_email'])) {
                    self::$cachedConfig = $normalized;
                    return self::$cachedConfig;
                }
            }

            $db = Database::getInstance();
            $row = null;

            // 1. Try active company settings (company scope)
            $companyId = Auth::getActiveCompanyId();
            if ($companyId) {
                $row = $db->fetch(
                    "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
                    [$companyId]
                );
                if ($row) {
                    $d = json_decode($row['data'] ?? '', true);
                    if (!$d || empty($d['smtp_host'])) {
                        $row = null;
                    }
                }
            }

            // 2. Try any settings row (including user-scope) with smtp_host
            if (!$row) {
                $rows = $db->fetchAll(
                    "SELECT data FROM settings WHERE data IS NOT NULL ORDER BY user_id ASC, company_id ASC"
                );
                foreach ($rows as $r) {
                    $d = json_decode($r['data'], true);
                    if ($d && !empty($d['smtp_host'])) {
                        $row = $r;
                        break;
                    }
                }
            }

            if ($row && !empty($row['data'])) {
                self::$cachedConfig = self::normalizeConfig(json_decode($row['data'], true) ?: []);
                return self::$cachedConfig;
            }
        } catch (Exception $e) {
            Logger::error('SmtpMailer: Failed to load config', ['error' => $e->getMessage()]);
        }

        // 3) Env fallback (deployment-friendly)
        $envConfig = [
            'smtp_host' => getenv('OMNEX_SMTP_HOST') ?: getenv('SMTP_HOST') ?: '',
            'smtp_port' => getenv('OMNEX_SMTP_PORT') ?: getenv('SMTP_PORT') ?: 587,
            'smtp_username' => getenv('OMNEX_SMTP_USERNAME') ?: getenv('SMTP_USERNAME') ?: '',
            'smtp_password' => getenv('OMNEX_SMTP_PASSWORD') ?: getenv('SMTP_PASSWORD') ?: '',
            'smtp_encryption' => getenv('OMNEX_SMTP_ENCRYPTION') ?: getenv('SMTP_ENCRYPTION') ?: 'tls',
            'smtp_from_name' => getenv('OMNEX_SMTP_FROM_NAME') ?: getenv('SMTP_FROM_NAME') ?: 'Omnex Display Hub',
            'smtp_from_email' => getenv('OMNEX_SMTP_FROM_EMAIL') ?: getenv('SMTP_FROM_EMAIL') ?: '',
            'enabled' => getenv('OMNEX_SMTP_ENABLED') !== false ? filter_var(getenv('OMNEX_SMTP_ENABLED'), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) : true,
        ];
        $envConfig = self::normalizeConfig($envConfig);
        $enabled = array_key_exists('enabled', $envConfig) ? (bool)$envConfig['enabled'] : true;
        if ($enabled && !empty($envConfig['smtp_host']) && !empty($envConfig['smtp_from_email'])) {
            self::$cachedConfig = $envConfig;
            return self::$cachedConfig;
        }

        return null;
    }

    /**
     * Normalize mixed SMTP config keys from legacy/settings resolver/env sources.
     */
    private static function normalizeConfig(array $raw): array
    {
        $norm = [
            'smtp_host' => (string)($raw['smtp_host'] ?? $raw['host'] ?? ''),
            'smtp_port' => (int)($raw['smtp_port'] ?? $raw['port'] ?? 587),
            'smtp_username' => (string)($raw['smtp_username'] ?? $raw['username'] ?? ''),
            'smtp_password' => (string)($raw['smtp_password'] ?? $raw['password'] ?? ''),
            'smtp_encryption' => (string)($raw['smtp_encryption'] ?? $raw['encryption'] ?? 'tls'),
            'smtp_from_name' => (string)($raw['smtp_from_name'] ?? $raw['from_name'] ?? 'Omnex Display Hub'),
            'smtp_from_email' => (string)($raw['smtp_from_email'] ?? $raw['from_email'] ?? ''),
        ];

        if (array_key_exists('enabled', $raw)) {
            $norm['enabled'] = (bool)$raw['enabled'];
        }

        return $norm;
    }

    /**
     * Check if SMTP is configured
     */
    public function isConfigured(): bool
    {
        return !empty($this->host) && !empty($this->fromEmail);
    }

    /**
     * Send an email
     *
     * @param string $toEmail Recipient email
     * @param string $subject Email subject
     * @param string $htmlBody HTML body content
     * @param string|null $textBody Plain text fallback (auto-generated if null)
     * @return bool Success
     */
    public function send(string $toEmail, string $subject, string $htmlBody, ?string $textBody = null): bool
    {
        if (!$this->isConfigured()) {
            Logger::warning('SmtpMailer: SMTP not configured');
            return false;
        }

        if (!$textBody) {
            $textBody = strip_tags(str_replace(['<br>', '<br/>', '<br />', '</p>', '</div>', '</li>'], "\n", $htmlBody));
            $textBody = html_entity_decode($textBody, ENT_QUOTES, 'UTF-8');
            $textBody = preg_replace('/\n{3,}/', "\n\n", $textBody);
            $textBody = trim($textBody);
        }

        try {
            $prefix = '';
            if ($this->encryption === 'ssl') {
                $prefix = 'ssl://';
            }

            $socketWarning = null;
            set_error_handler(function ($severity, $message) use (&$socketWarning) {
                $socketWarning = $message;
                return true;
            });
            try {
                $socket = fsockopen($prefix . $this->host, $this->port, $errno, $errstr, $this->timeout);
            } finally {
                restore_error_handler();
            }
            if (!$socket) {
                Logger::error('SmtpMailer: Connection failed', [
                    'host' => $this->host,
                    'error' => "$errstr ($errno)",
                    'warning' => $socketWarning
                ]);
                return false;
            }

            stream_set_timeout($socket, $this->timeout);

            // Read greeting
            $greeting = fgets($socket, 515);
            if (!is_string($greeting) || substr($greeting, 0, 3) !== '220') {
                fclose($socket);
                Logger::error('SmtpMailer: Bad greeting', ['response' => is_string($greeting) ? trim($greeting) : null]);
                return false;
            }

            // EHLO
            fwrite($socket, "EHLO localhost\r\n");
            $ehloComplete = false;
            while (($line = fgets($socket, 515)) !== false) {
                if (substr($line, 3, 1) === ' ') {
                    $ehloComplete = true;
                    break;
                }
            }
            if (!$ehloComplete) {
                fclose($socket);
                Logger::error('SmtpMailer: EHLO failed (no completion response)');
                return false;
            }

            // STARTTLS
            if ($this->encryption === 'tls') {
                fwrite($socket, "STARTTLS\r\n");
                $tlsResponse = fgets($socket, 515);
                if (!is_string($tlsResponse) || substr($tlsResponse, 0, 3) !== '220') {
                    fclose($socket);
                    Logger::error('SmtpMailer: STARTTLS failed', ['response' => is_string($tlsResponse) ? trim($tlsResponse) : null]);
                    return false;
                }

                $cryptoResult = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                if (!$cryptoResult) {
                    fclose($socket);
                    Logger::error('SmtpMailer: TLS crypto failed');
                    return false;
                }

                // EHLO again after TLS
                fwrite($socket, "EHLO localhost\r\n");
                $ehloTlsComplete = false;
                while (($line = fgets($socket, 515)) !== false) {
                    if (substr($line, 3, 1) === ' ') {
                        $ehloTlsComplete = true;
                        break;
                    }
                }
                if (!$ehloTlsComplete) {
                    fclose($socket);
                    Logger::error('SmtpMailer: EHLO after TLS failed (no completion response)');
                    return false;
                }
            }

            // AUTH LOGIN
            if ($this->username && $this->password) {
                fwrite($socket, "AUTH LOGIN\r\n");
                $authResponse = fgets($socket, 515);

                if (is_string($authResponse) && substr($authResponse, 0, 3) === '334') {
                    fwrite($socket, base64_encode($this->username) . "\r\n");
                    $userResponse = fgets($socket, 515);

                    if (is_string($userResponse) && substr($userResponse, 0, 3) === '334') {
                        fwrite($socket, base64_encode($this->password) . "\r\n");
                        $passResponse = fgets($socket, 515);

                        if (!is_string($passResponse) || substr($passResponse, 0, 3) !== '235') {
                            fclose($socket);
                            Logger::error('SmtpMailer: Auth failed', ['response' => is_string($passResponse) ? trim($passResponse) : null]);
                            return false;
                        }
                    } else {
                        fclose($socket);
                        Logger::error('SmtpMailer: Username step failed', ['response' => is_string($userResponse) ? trim($userResponse) : null]);
                        return false;
                    }
                } else {
                    fclose($socket);
                    Logger::error('SmtpMailer: AUTH LOGIN rejected', ['response' => is_string($authResponse) ? trim($authResponse) : null]);
                    return false;
                }
            }

            // MAIL FROM
            fwrite($socket, "MAIL FROM:<{$this->fromEmail}>\r\n");
            $mailFromResponse = fgets($socket, 515);
            if (!is_string($mailFromResponse) || substr($mailFromResponse, 0, 3) !== '250') {
                fclose($socket);
                Logger::error('SmtpMailer: MAIL FROM failed', ['response' => is_string($mailFromResponse) ? trim($mailFromResponse) : null]);
                return false;
            }

            // RCPT TO
            fwrite($socket, "RCPT TO:<$toEmail>\r\n");
            $rcptToResponse = fgets($socket, 515);
            if (!is_string($rcptToResponse) || (substr($rcptToResponse, 0, 3) !== '250' && substr($rcptToResponse, 0, 3) !== '251')) {
                fclose($socket);
                Logger::error('SmtpMailer: RCPT TO failed', ['response' => is_string($rcptToResponse) ? trim($rcptToResponse) : null]);
                return false;
            }

            // DATA
            fwrite($socket, "DATA\r\n");
            $dataResponse = fgets($socket, 515);
            if (!is_string($dataResponse) || substr($dataResponse, 0, 3) !== '354') {
                fclose($socket);
                Logger::error('SmtpMailer: DATA failed', ['response' => is_string($dataResponse) ? trim($dataResponse) : null]);
                return false;
            }

            // Build email
            $date = date('r');
            $messageId = '<' . uniqid() . '@' . gethostname() . '>';
            $boundary = '----=_Part_' . uniqid();
            $encodedSubject = "=?UTF-8?B?" . base64_encode($subject) . "?=";
            $encodedFromName = "=?UTF-8?B?" . base64_encode($this->fromName) . "?=";

            $emailContent = "Date: $date\r\n";
            $emailContent .= "From: $encodedFromName <{$this->fromEmail}>\r\n";
            $emailContent .= "To: <$toEmail>\r\n";
            $emailContent .= "Subject: $encodedSubject\r\n";
            $emailContent .= "Message-ID: $messageId\r\n";
            $emailContent .= "MIME-Version: 1.0\r\n";
            $emailContent .= "Content-Type: multipart/alternative; boundary=\"$boundary\"\r\n";
            $emailContent .= "\r\n";
            $emailContent .= "--$boundary\r\n";
            $emailContent .= "Content-Type: text/plain; charset=UTF-8\r\n";
            $emailContent .= "Content-Transfer-Encoding: base64\r\n";
            $emailContent .= "\r\n";
            $emailContent .= chunk_split(base64_encode($textBody));
            $emailContent .= "--$boundary\r\n";
            $emailContent .= "Content-Type: text/html; charset=UTF-8\r\n";
            $emailContent .= "Content-Transfer-Encoding: base64\r\n";
            $emailContent .= "\r\n";
            $emailContent .= chunk_split(base64_encode($htmlBody));
            $emailContent .= "--$boundary--\r\n";
            $emailContent .= ".\r\n";

            fwrite($socket, $emailContent);
            $sendResponse = fgets($socket, 515);

            fwrite($socket, "QUIT\r\n");
            fclose($socket);

            if (!is_string($sendResponse) || substr($sendResponse, 0, 3) !== '250') {
                Logger::error('SmtpMailer: Send failed', ['response' => is_string($sendResponse) ? trim($sendResponse) : null]);
                return false;
            }

            Logger::info('SmtpMailer: Email sent', ['to' => $toEmail, 'subject' => $subject]);
            return true;

        } catch (Throwable $e) {
            Logger::error('SmtpMailer: Exception', ['error' => $e->getMessage(), 'to' => $toEmail]);
            return false;
        }
    }

    /**
     * Build a styled HTML email body from content sections
     */
    public static function buildHtmlEmail(string $title, string $bodyHtml, ?string $footerText = null): string
    {
        $year = date('Y');
        $footer = $footerText ?: "Bu otomatik bir bildirim e-postasıdır.";

        return '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #228be6, #1971c2); color: #fff; padding: 24px 30px; }
        .header h1 { margin: 0; font-size: 20px; }
        .content { padding: 24px 30px; color: #212529; font-size: 14px; line-height: 1.6; }
        .content h2 { color: #1971c2; font-size: 18px; margin-top: 0; }
        .info-box { background: #e7f5ff; border-left: 4px solid #228be6; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
        .info-box p { margin: 4px 0; color: #495057; font-size: 13px; }
        .code-block { background: #1e1e2e; color: #cdd6f4; padding: 12px; border-radius: 8px; font-family: Consolas, monospace; font-size: 12px; max-height: 400px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
        .warning-badge { display: inline-block; background: #fff3bf; color: #e67700; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
        .footer { background: #f8f9fa; padding: 16px 30px; text-align: center; color: #868e96; font-size: 12px; }
        table.detail-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        table.detail-table td { padding: 6px 10px; border-bottom: 1px solid #e9ecef; font-size: 13px; }
        table.detail-table td:first-child { font-weight: 600; color: #495057; white-space: nowrap; width: 140px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>' . htmlspecialchars($title) . '</h1>
        </div>
        <div class="content">
            ' . $bodyHtml . '
        </div>
        <div class="footer">
            <p>' . htmlspecialchars($footer) . '</p>
            <p>&copy; ' . $year . ' Omnex Display Hub</p>
        </div>
    </div>
</body>
</html>';
    }
}
