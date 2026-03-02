<?php
/**
 * Test SMTP Connection API - Sends actual test email
 * POST /api/settings/test-smtp
 */

$user = Auth::user();

$host = $request->input('host');
$port = (int) $request->input('port', 587);
$username = $request->input('username');
$password = $request->input('password');
$encryption = $request->input('encryption', 'tls');
$fromEmail = $request->input('from_email');
$fromName = $request->input('from_name', 'Omnex Display Hub');
$testEmail = $request->input('test_email', $user['email']); // Send to user's email by default

if (!$host || !$port) {
    Response::badRequest('SMTP host ve port gerekli');
}

if (!$fromEmail) {
    Response::badRequest('Gönderici e-posta adresi gerekli');
}

if (!$testEmail) {
    Response::badRequest('Test e-posta adresi gerekli');
}

$timeout = 15;

try {
    // Determine connection type
    $prefix = '';
    if ($encryption === 'ssl') {
        $prefix = 'ssl://';
    }

    // Try to connect
    $socket = @fsockopen($prefix . $host, $port, $errno, $errstr, $timeout);

    if (!$socket) {
        Response::error("SMTP sunucusuna bağlanılamadı: $errstr ($errno)", 400);
    }

    // Set socket timeout
    stream_set_timeout($socket, $timeout);

    // Read greeting
    $greeting = fgets($socket, 515);
    if (substr($greeting, 0, 3) !== '220') {
        fclose($socket);
        Response::error("SMTP sunucusu yanıt vermedi: $greeting", 400);
    }

    // Send EHLO
    fwrite($socket, "EHLO localhost\r\n");
    $response = '';
    while ($line = fgets($socket, 515)) {
        $response .= $line;
        if (substr($line, 3, 1) === ' ') break;
    }

    // For TLS, upgrade connection
    if ($encryption === 'tls') {
        fwrite($socket, "STARTTLS\r\n");
        $tlsResponse = fgets($socket, 515);
        if (substr($tlsResponse, 0, 3) !== '220') {
            fclose($socket);
            Response::error("TLS başlatma başarısız: $tlsResponse", 400);
        }

        // Enable crypto
        $cryptoResult = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        if (!$cryptoResult) {
            fclose($socket);
            Response::error("TLS şifreleme etkinleştirilemedi", 400);
        }

        // Send EHLO again after TLS
        fwrite($socket, "EHLO localhost\r\n");
        while ($line = fgets($socket, 515)) {
            if (substr($line, 3, 1) === ' ') break;
        }
    }

    // Authenticate if credentials provided
    if ($username && $password) {
        fwrite($socket, "AUTH LOGIN\r\n");
        $authResponse = fgets($socket, 515);

        if (substr($authResponse, 0, 3) === '334') {
            // Send username
            fwrite($socket, base64_encode($username) . "\r\n");
            $userResponse = fgets($socket, 515);

            if (substr($userResponse, 0, 3) === '334') {
                // Send password
                fwrite($socket, base64_encode($password) . "\r\n");
                $passResponse = fgets($socket, 515);

                if (substr($passResponse, 0, 3) !== '235') {
                    fclose($socket);
                    Response::error("Kimlik doğrulama başarısız: " . trim($passResponse), 400);
                }
            }
        }
    }

    // === SEND TEST EMAIL ===

    // MAIL FROM
    fwrite($socket, "MAIL FROM:<$fromEmail>\r\n");
    $mailFromResponse = fgets($socket, 515);
    if (substr($mailFromResponse, 0, 3) !== '250') {
        fclose($socket);
        Response::error("MAIL FROM hatası: " . trim($mailFromResponse), 400);
    }

    // RCPT TO
    fwrite($socket, "RCPT TO:<$testEmail>\r\n");
    $rcptToResponse = fgets($socket, 515);
    if (substr($rcptToResponse, 0, 3) !== '250' && substr($rcptToResponse, 0, 3) !== '251') {
        fclose($socket);
        Response::error("RCPT TO hatası: " . trim($rcptToResponse), 400);
    }

    // DATA
    fwrite($socket, "DATA\r\n");
    $dataResponse = fgets($socket, 515);
    if (substr($dataResponse, 0, 3) !== '354') {
        fclose($socket);
        Response::error("DATA hatası: " . trim($dataResponse), 400);
    }

    // Build email content
    $date = date('r');
    $messageId = '<' . uniqid() . '@' . gethostname() . '>';
    $boundary = '----=_Part_' . uniqid();

    $subject = "=?UTF-8?B?" . base64_encode("Omnex Display Hub - SMTP Test Maili") . "?=";
    $encodedFromName = "=?UTF-8?B?" . base64_encode($fromName) . "?=";

    $htmlBody = '
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #228be6, #1971c2); color: #fff; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .success-icon { font-size: 48px; color: #40c057; text-align: center; margin-bottom: 20px; }
        .info-box { background: #e7f5ff; border-left: 4px solid #228be6; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .info-box h3 { margin: 0 0 10px 0; color: #1971c2; }
        .info-box p { margin: 5px 0; color: #495057; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #868e96; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✉️ Omnex Display Hub</h1>
        </div>
        <div class="content">
            <div class="success-icon">✅</div>
            <h2 style="text-align: center; color: #212529;">SMTP Yapılandırması Başarılı!</h2>
            <p style="text-align: center; color: #495057;">E-posta gönderim ayarlarınız doğru çalışıyor.</p>

            <div class="info-box">
                <h3>📧 Test Detayları</h3>
                <p><strong>SMTP Sunucusu:</strong> ' . htmlspecialchars($host) . '</p>
                <p><strong>Port:</strong> ' . $port . '</p>
                <p><strong>Şifreleme:</strong> ' . strtoupper($encryption) . '</p>
                <p><strong>Gönderici:</strong> ' . htmlspecialchars($fromEmail) . '</p>
                <p><strong>Test Zamanı:</strong> ' . date('d.m.Y H:i:s') . '</p>
            </div>

            <p style="color: #495057;">Bu e-posta, SMTP ayarlarınızın doğru yapılandırıldığını onaylamak için gönderilmiştir. Artık sistem bildirimleri bu ayarlarla gönderilecektir.</p>
        </div>
        <div class="footer">
            <p>Bu otomatik bir test e-postasıdır.</p>
            <p>© ' . date('Y') . ' Omnex Display Hub</p>
        </div>
    </div>
</body>
</html>';

    $textBody = "SMTP Test Başarılı!\n\n";
    $textBody .= "E-posta gönderim ayarlarınız doğru çalışıyor.\n\n";
    $textBody .= "Test Detayları:\n";
    $textBody .= "- SMTP Sunucusu: $host\n";
    $textBody .= "- Port: $port\n";
    $textBody .= "- Şifreleme: " . strtoupper($encryption) . "\n";
    $textBody .= "- Gönderici: $fromEmail\n";
    $textBody .= "- Test Zamanı: " . date('d.m.Y H:i:s') . "\n\n";
    $textBody .= "© " . date('Y') . " Omnex Display Hub\n";

    // Email headers and body
    $emailContent = "Date: $date\r\n";
    $emailContent .= "From: $encodedFromName <$fromEmail>\r\n";
    $emailContent .= "To: <$testEmail>\r\n";
    $emailContent .= "Subject: $subject\r\n";
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

    // Send email content
    fwrite($socket, $emailContent);
    $sendResponse = fgets($socket, 515);

    if (substr($sendResponse, 0, 3) !== '250') {
        fclose($socket);
        Response::error("E-posta gönderimi başarısız: " . trim($sendResponse), 400);
    }

    // Send QUIT
    fwrite($socket, "QUIT\r\n");
    fclose($socket);

    Logger::info('SMTP test email sent successfully', [
        'host' => $host,
        'port' => $port,
        'encryption' => $encryption,
        'from' => $fromEmail,
        'to' => $testEmail,
        'user_id' => $user['id']
    ]);

    Response::success([
        'host' => $host,
        'port' => $port,
        'encryption' => $encryption,
        'from_email' => $fromEmail,
        'test_email' => $testEmail,
        'authenticated' => !empty($username)
    ], "Test e-postası başarıyla gönderildi: $testEmail");

} catch (Exception $e) {
    Logger::error('SMTP test failed', [
        'error' => $e->getMessage(),
        'host' => $host,
        'port' => $port
    ]);
    Response::error('SMTP testi başarısız: ' . $e->getMessage(), 500);
}
