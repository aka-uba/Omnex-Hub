<?php
/**
 * Log Management API - Send log report notification
 * Sends a detailed log report to selected IT staff via email + in-app notification.
 *
 * Integration with user notification preferences:
 * - Checks user_notification_preferences for email channel preference
 * - Respects quiet hours (DND) via NotificationService
 * - Uses NotificationService::sendToUser() for in-app notifications
 * - Sends SMTP email only if user has 'warning' type email enabled
 */

$db = Database::getInstance();
$user = Auth::user();

if (!$user || $user['role'] !== 'SuperAdmin') {
    Response::forbidden('Sadece SuperAdmin erişebilir');
}

$rawBody = file_get_contents('php://input');
$body = !empty($rawBody) ? json_decode($rawBody, true) ?: [] : [];

$filename = $body['filename'] ?? null;
$recipientIds = $body['recipient_ids'] ?? [];
$note = $body['note'] ?? '';
$includeContext = $body['include_context'] ?? true;
$lineNumbers = $body['line_numbers'] ?? [];

if (!$filename) {
    Response::error('Log dosyası belirtilmeli', 400);
}

if (empty($recipientIds)) {
    Response::error('En az bir alıcı seçilmeli', 400);
}

$logDir = STORAGE_PATH . '/logs';
$filePath = $logDir . '/' . basename($filename);

if (!file_exists($filePath)) {
    Response::error('Log dosyası bulunamadı', 404);
}

// Gather system context
$systemInfo = [];
if ($includeContext) {
    $systemInfo = [
        'server' => php_uname(),
        'php_version' => PHP_VERSION,
        'timestamp' => date('Y-m-d H:i:s'),
        'log_file' => $filename,
        'log_size' => filesize($filePath),
        'reporter' => $user['first_name'] . ' ' . $user['last_name'] . ' (' . $user['email'] . ')',
        'server_ip' => $_SERVER['SERVER_ADDR'] ?? 'N/A',
        'app_version' => defined('APP_VERSION') ? APP_VERSION : 'N/A'
    ];
}

// Read specific lines or last 50 lines for the report
$logContent = '';
if (!empty($lineNumbers)) {
    $fp = fopen($filePath, 'r');
    if ($fp) {
        $currentLine = 0;
        while (!feof($fp)) {
            $line = fgets($fp);
            $currentLine++;
            if (in_array($currentLine, $lineNumbers)) {
                $logContent .= "[Satır $currentLine] " . rtrim($line) . "\n";
            }
        }
        fclose($fp);
    }
} else {
    // Last 50 lines
    $allLines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($allLines) {
        $lastLines = array_slice($allLines, -50);
        $logContent = implode("\n", $lastLines);
    }
}

// =============================================
// Build email HTML content
// =============================================
$reporterName = htmlspecialchars($user['first_name'] . ' ' . $user['last_name']);
$emailTitle = "Sistem Log Raporu: $filename";

$emailBodyHtml = "<h2>Log Raporu</h2>";
$emailBodyHtml .= "<table class='detail-table'>";
$emailBodyHtml .= "<tr><td>Dosya</td><td>" . htmlspecialchars($filename) . "</td></tr>";
$emailBodyHtml .= "<tr><td>Gönderen</td><td>$reporterName</td></tr>";
$emailBodyHtml .= "<tr><td>Tarih</td><td>" . date('d.m.Y H:i:s') . "</td></tr>";

if ($note) {
    $emailBodyHtml .= "<tr><td>Not</td><td>" . htmlspecialchars($note) . "</td></tr>";
}
$emailBodyHtml .= "</table>";

if ($includeContext && !empty($systemInfo)) {
    $emailBodyHtml .= "<h3>Sistem Bilgileri</h3>";
    $emailBodyHtml .= "<div class='info-box'>";
    foreach ($systemInfo as $key => $val) {
        $labels = [
            'server' => 'Sunucu',
            'php_version' => 'PHP Sürümü',
            'timestamp' => 'Zaman',
            'log_file' => 'Log Dosyası',
            'log_size' => 'Dosya Boyutu',
            'reporter' => 'Raporlayan',
            'server_ip' => 'Sunucu IP',
            'app_version' => 'Uygulama Sürümü'
        ];
        $label = $labels[$key] ?? $key;
        $displayVal = $key === 'log_size' ? number_format($val / 1024, 1) . ' KB' : $val;
        $emailBodyHtml .= "<p><strong>" . htmlspecialchars($label) . ":</strong> " . htmlspecialchars($displayVal) . "</p>";
    }
    $emailBodyHtml .= "</div>";
}

$emailBodyHtml .= "<h3>Log İçeriği (Son 50 Satır)</h3>";
$emailBodyHtml .= "<div class='code-block'>" . htmlspecialchars(mb_substr($logContent, 0, 5000)) . "</div>";

$fullEmailHtml = SmtpMailer::buildHtmlEmail($emailTitle, $emailBodyHtml);

// =============================================
// Get recipient details
// =============================================
$recipients = [];
foreach ($recipientIds as $rid) {
    $r = $db->fetch("SELECT id, email, first_name, last_name, company_id FROM users WHERE id = ?", [$rid]);
    if ($r) {
        $recipients[] = $r;
    }
}

if (empty($recipients)) {
    Response::error('Geçerli alıcı bulunamadı', 400);
}

// =============================================
// NotificationService & SmtpMailer instances
// =============================================
$notifService = NotificationService::getInstance();
$mailer = SmtpMailer::getInstance();
$smtpAvailable = $mailer && $mailer->isConfigured();

$emailSentCount = 0;
$emailSkippedCount = 0;
$notifSentCount = 0;
$errors = [];
$warnings = [];

$notifMessage = "Log dosyası ($filename) hakkında detaylı rapor gönderildi. Not: " . ($note ?: 'Yok');

foreach ($recipients as $recipient) {
    $recipientId = $recipient['id'];
    $recipientEmail = $recipient['email'];

    // -----------------------------------------
    // 1. Check user notification preferences
    // -----------------------------------------
    $userPrefs = $notifService->getUserSettings($recipientId);
    $userEnabled = true;
    $emailChannelEnabled = true;
    $webChannelEnabled = true;

    if ($userPrefs) {
        // Master switch
        $userEnabled = !empty($userPrefs['web_enabled']);

        // Type-based channel preferences (log reports sent as 'warning' type)
        $typePrefs = $userPrefs['type_preferences'] ?? [];
        if (is_string($typePrefs)) {
            $typePrefs = json_decode($typePrefs, true) ?: [];
        }

        if (isset($typePrefs['warning'])) {
            $warningPrefs = $typePrefs['warning'];
            $emailChannelEnabled = !empty($warningPrefs['email']);
            $webChannelEnabled = !empty($warningPrefs['web']);
        }
    }

    // -----------------------------------------
    // 2. Send SMTP email (if user allows email for warning type)
    // -----------------------------------------
    if ($smtpAvailable && $emailChannelEnabled) {
        try {
            $sent = $mailer->send($recipientEmail, $emailTitle, $fullEmailHtml);
            if ($sent) {
                $emailSentCount++;
            } else {
                $errors[] = "E-posta gönderilemedi: $recipientEmail";
            }
        } catch (Exception $e) {
            $errors[] = "E-posta hatası ($recipientEmail): " . $e->getMessage();
        }
    } elseif (!$smtpAvailable) {
        // SMTP warning added once after loop
    } elseif (!$emailChannelEnabled) {
        $emailSkippedCount++;
    }

    // -----------------------------------------
    // 3. Send in-app notification via NotificationService
    //    (handles quiet hours, company_id fallback internally)
    // -----------------------------------------
    if (!$userEnabled || !$webChannelEnabled) {
        $warnings[] = "$recipientEmail: Bildirimler kullanıcı tarafından kapatılmış";
        continue;
    }

    try {
        $notifId = $notifService->sendToUser($recipientId, $emailTitle, $notifMessage, [
            'type' => NotificationService::TYPE_WARNING,
            'icon' => 'ti-file-alert',
            'link' => '#/admin/logs',
            'channels' => ['web', 'email'],
            'priority' => NotificationService::PRIORITY_HIGH,
            'created_by' => $user['id']
        ]);

        if ($notifId) {
            $notifSentCount++;
        } else {
            $errors[] = "Bildirim oluşturulamadı: $recipientEmail";
        }
    } catch (Exception $e) {
        $errors[] = "Bildirim hatası ($recipientEmail): " . $e->getMessage();
    }
}

// Add SMTP warning once if not available
if (!$smtpAvailable && count($recipients) > 0) {
    $warnings[] = "SMTP ayarları bulunamadı. E-posta gönderilemedi. Ayarlar > E-posta sekmesinden SMTP bilgilerini kaydedin.";
}

// Add email skipped info
if ($emailSkippedCount > 0) {
    $warnings[] = "$emailSkippedCount kullanıcı e-posta bildirimini kapatmış, e-posta gönderilmedi";
}

$totalSent = max($emailSentCount, $notifSentCount);

Logger::audit('send_report', 'system_logs', [
    'filename' => $filename,
    'recipients' => $recipientIds,
    'email_sent' => $emailSentCount,
    'email_skipped' => $emailSkippedCount,
    'notif_sent' => $notifSentCount,
    'note' => $note
]);

$message = [];
if ($emailSentCount > 0) {
    $message[] = "$emailSentCount kişiye e-posta gönderildi";
}
if ($notifSentCount > 0) {
    $message[] = "$notifSentCount kişiye bildirim oluşturuldu";
}
if (empty($message)) {
    $message[] = "Rapor gönderilemedi";
}

$responseData = [
    'message' => implode(', ', $message),
    'sent_count' => $totalSent,
    'email_sent' => $emailSentCount,
    'email_skipped' => $emailSkippedCount,
    'notif_sent' => $notifSentCount,
    'total_recipients' => count($recipients)
];

if (!empty($errors)) {
    $responseData['errors'] = $errors;
}
if (!empty($warnings)) {
    $responseData['warnings'] = $warnings;
}

Response::success($responseData);
