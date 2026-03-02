<?php
require_once dirname(dirname(dirname(__DIR__))) . '/config.php';
header('Content-Type: application/json');
echo json_encode([
    'APP_URL' => APP_URL,
    'parse_url_path' => parse_url(APP_URL, PHP_URL_PATH),
    'HTTP_HOST' => $_SERVER['HTTP_HOST'] ?? 'NOT SET',
    'SERVER_ADDR' => $_SERVER['SERVER_ADDR'] ?? 'NOT SET',
    'SCRIPT_NAME' => $_SERVER['SCRIPT_NAME'] ?? 'NOT SET',
    'REQUEST_URI' => $_SERVER['REQUEST_URI'] ?? 'NOT SET',
    'DOCUMENT_ROOT' => $_SERVER['DOCUMENT_ROOT'] ?? 'NOT SET',
    'BASE_PATH' => BASE_PATH,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
