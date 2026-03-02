<?php
/*
Copyright 2017 Ziadin Givan

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

https://github.com/givanz/VvvebJs
*/

// Load Omnex core for database access
require_once __DIR__ . '/../../config.php';

define('MAX_FILE_LIMIT', 1024 * 1024 * 2);//2 Megabytes max html file size
define('ALLOW_PHP', false);//check if saved html contains php tag and don't save if not allowed
define('ALLOWED_OEMBED_DOMAINS', [
	'https://www.youtube.com/',
	'https://www.vimeo.com/',
	'https://www.x.com/',
	'https://x.com/',
	'https://publish.twitter.com/',
	'https://www.twitter.com/',
	'https://www.reddit.com/',
]);//load urls only from allowed websites for oembed

function sanitizeFileName($file, $allowedExtension = 'html') {
	$basename = basename($file);
	$disallow = ['.htaccess', 'passwd'];
	if (in_array($basename, $disallow)) {
		showError('Filename not allowed!');
		return '';
	}

	//sanitize, remove double dot .. and remove get parameters if any
	$file = preg_replace('@\?.*$@' , '', preg_replace('@\.{2,}@' , '', preg_replace('@[^\/\\a-zA-Z0-9\-\._]@', '', $file)));

	if ($file) {
		$file = __DIR__ . DIRECTORY_SEPARATOR . $file;
	} else {
		return '';
	}

	//allow only .html extension
	if ($allowedExtension) {
		$file = preg_replace('/\.[^.]+$/', '', $file) . ".$allowedExtension";
	}
	return $file;
}

function showError($error, int $status = 500) {
	$statusTextMap = [
		400 => 'Bad Request',
		401 => 'Unauthorized',
		403 => 'Forbidden',
		404 => 'Not Found',
		500 => 'Internal Server Error',
	];
	$statusText = $statusTextMap[$status] ?? 'Error';
	header(($_SERVER['SERVER_PROTOCOL'] ?? 'HTTP/1.1') . " {$status} {$statusText}", true, $status);
	die($error);
}

function showSuccess($message, $data = []) {
	header('Content-Type: application/json');
	echo json_encode([
		'success' => true,
		'message' => $message,
		'data' => $data
	]);
	exit;
}

function validOembedUrl($url) {
	foreach (ALLOWED_OEMBED_DOMAINS as $domain) {
		if (strpos($url, $domain) === 0) {
			return true;
		}
	}

	return false;
}

function getAuthorizationHeader(): string
{
	$headers = function_exists('getallheaders') ? getallheaders() : [];
	return $headers['Authorization']
		?? $headers['authorization']
		?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
}

function resolveActiveCompanyId(Database $db, array $user): ?string
{
	$role = strtolower((string)($user['role'] ?? ''));
	if ($role === 'superadmin') {
		$activeCompanyId = $_SERVER['HTTP_X_ACTIVE_COMPANY'] ?? null;
		if ($activeCompanyId) {
			$company = $db->fetch("SELECT id FROM companies WHERE id = ?", [$activeCompanyId]);
			if ($company) {
				return $activeCompanyId;
			}
		}

		$defaultCompany = $db->fetch("SELECT id FROM companies ORDER BY created_at ASC LIMIT 1");
		return $defaultCompany['id'] ?? null;
	}

	return $user['company_id'] ?? null;
}

function resolveEditorAuthContext(): array
{
	$db = Database::getInstance();
	$user = null;
	$usingBearer = false;

	$authHeader = getAuthorizationHeader();
	if ($authHeader && preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
		$usingBearer = true;
		$payload = Auth::validateToken(trim($matches[1]));
		$userId = $payload['user_id'] ?? $payload['sub'] ?? null;

		if ($userId) {
			$user = $db->fetch(
				"SELECT id, company_id, role, status FROM users WHERE id = ?",
				[$userId]
			);
		}
	}

	if (!$user) {
		if (session_status() === PHP_SESSION_NONE) {
			session_start();
		}

		if (!empty($_SESSION['user_id'])) {
			$user = $db->fetch(
				"SELECT id, company_id, role, status FROM users WHERE id = ?",
				[$_SESSION['user_id']]
			);
		}
	}

	if (!$user || (($user['status'] ?? '') !== 'active')) {
		showError('Oturum gerekli', 401);
	}

	$companyId = resolveActiveCompanyId($db, $user);
	if (!$companyId) {
		showError('Firma baglami gerekli', 403);
	}

	$role = strtolower((string)($user['role'] ?? ''));
	$allowedRoles = ['superadmin', 'admin', 'manager', 'editor'];
	if (!in_array($role, $allowedRoles, true)) {
		showError('Bu islem icin yetkiniz yok', 403);
	}

	// Require CSRF token when request relies on cookies/session.
	if (!$usingBearer) {
		$csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST[CSRF_TOKEN_NAME] ?? null);
		if (!CsrfMiddleware::validateToken($csrfToken)) {
			showError('CSRF token eksik veya gecersiz', 403);
		}
	}

	Auth::setUser($user);

	return [
		'user' => $user,
		'company_id' => $companyId,
		'using_bearer' => $usingBearer
	];
}

/**
 * Save template to database (web_templates table)
 */
function saveToDatabase($file, $html, $name = null, $templateId = null, array $user = [], ?string $companyId = null) {
	try {
		if (!$companyId) {
			return ['success' => false, 'error' => 'No company context'];
		}

		$db = Database::getInstance();

		// Extract template name from filename or use provided name
		$basename = basename($file, '.html');
		$templateName = $name ?? ucwords(str_replace(['-', '_'], ' ', $basename));

		// Create slug
		$slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $templateName));
		$slug = trim($slug, '-');

		// Check if template exists (by slug or id)
		$existingTemplate = null;
		if ($templateId) {
			$existingTemplate = $db->fetch(
				"SELECT * FROM web_templates WHERE id = ? AND company_id = ? AND deleted_at IS NULL",
				[$templateId, $companyId]
			);
		}

		if (!$existingTemplate) {
			$existingTemplate = $db->fetch(
				"SELECT * FROM web_templates WHERE slug = ? AND company_id = ? AND deleted_at IS NULL",
				[$slug, $companyId]
			);
		}

		if ($existingTemplate) {
			// Update existing template
			$newVersion = ($existingTemplate['version'] ?? 1) + 1;

			$db->update('web_templates', [
				'html_content' => $html,
				'version' => $newVersion,
				'updated_by' => $user['id'] ?? null,
				'updated_at' => date('Y-m-d H:i:s')
			], 'id = ?', [$existingTemplate['id']]);

			// Save version history
			$db->insert('web_template_versions', [
				'id' => $db->generateUuid(),
				'template_id' => $existingTemplate['id'],
				'version_number' => $newVersion,
				'version_name' => "v{$newVersion}",
				'change_notes' => 'Editörden güncellendi',
				'html_content' => $html,
				'created_by' => $user['id'] ?? null
			]);

			return [
				'success' => true,
				'template_id' => $existingTemplate['id'],
				'action' => 'updated',
				'version' => $newVersion
			];
		} else {
			// Create new template
			$templateId = $db->generateUuid();

			// Ensure unique slug
			$checkSlug = $db->fetch(
				"SELECT id FROM web_templates WHERE slug = ? AND company_id = ?",
				[$slug, $companyId]
			);
			if ($checkSlug) {
				$slug .= '-' . substr(uniqid(), -6);
			}

			$db->insert('web_templates', [
				'id' => $templateId,
				'company_id' => $companyId,
				'name' => $templateName,
				'slug' => $slug,
				'html_content' => $html,
				'template_type' => 'signage',
				'status' => 'draft',
				'version' => 1,
				'scope' => 'company',
				'created_by' => $user['id'] ?? null,
				'updated_by' => $user['id'] ?? null
			]);

			// Save first version
			$db->insert('web_template_versions', [
				'id' => $db->generateUuid(),
				'template_id' => $templateId,
				'version_number' => 1,
				'version_name' => 'v1',
				'change_notes' => 'İlk versiyon - editörden oluşturuldu',
				'html_content' => $html,
				'created_by' => $user['id'] ?? null
			]);

			return [
				'success' => true,
				'template_id' => $templateId,
				'action' => 'created',
				'version' => 1
			];
		}
	} catch (Exception $e) {
		return ['success' => false, 'error' => $e->getMessage()];
	}
}

$html   = '';
$file   = '';
$action = '';
$templateId = null;
$templateName = null;
$authContext = null;
$authUser = null;
$authCompanyId = null;

// Get template ID and name from POST if provided
if (isset($_POST['template_id'])) {
	$templateId = $_POST['template_id'];
}
if (isset($_POST['template_name'])) {
	$templateName = $_POST['template_name'];
}

if (isset($_POST['startTemplateUrl']) && !empty($_POST['startTemplateUrl'])) {
	$startTemplateUrl = sanitizeFileName($_POST['startTemplateUrl']);
	$html = '';
	if ($startTemplateUrl) {
		$html = file_get_contents($startTemplateUrl);
	}
} else if (isset($_POST['html'])){
	$html = substr($_POST['html'], 0, MAX_FILE_LIMIT);
	if (!ALLOW_PHP) {
		//if (strpos($html, '<?php') !== false) {
		if (preg_match('@<\?php|<\? |<\?=|<\s*script\s*language\s*=\s*"\s*php\s*"\s*>@', $html)) {
			showError('PHP not allowed!');
		}
	}
}

if (isset($_POST['file'])) {
	$file = sanitizeFileName($_POST['file']);
}

if (isset($_GET['action'])) {
	$action = htmlspecialchars(strip_tags($_GET['action']));
}

// Require authenticated editor user for all state-changing actions.
// Keep oEmbed proxy public because it only allows strict domain whitelist.
if ($action !== 'oembedProxy') {
	$authContext = resolveEditorAuthContext();
	$authUser = $authContext['user'];
	$authCompanyId = $authContext['company_id'];
}

if ($action) {
	//file manager actions, delete and rename
	switch ($action) {
		case 'rename':
			$newfile = sanitizeFileName($_POST['newfile']);
			if ($file && $newfile) {
				if (rename($file, $newfile)) {
					echo "File '$file' renamed to '$newfile'";
				} else {
					showError("Error renaming file '$file' renamed to '$newfile'");
				}
			}
		break;
		case 'delete':
			if ($file) {
				if (unlink($file)) {
					echo "File '$file' deleted";
				} else {
					showError("Error deleting file '$file'");
				}
			}
		break;
		case 'saveReusable':
		    //block or section
			$type = $_POST['type'] ?? false;
			$name = $_POST['name'] ?? false;
			$html = $_POST['html'] ?? false;

			if ($type && $name && $html) {

				$file = sanitizeFileName("$type/$name");
				if ($file) {
					$dir = dirname($file);
					if (!is_dir($dir)) {
						echo "$dir folder does not exist\n";
						if (mkdir($dir, 0777, true)) {
							echo "$dir folder was created\n";
						} else {
							showError("Error creating folder '$dir'\n");
						}
					}

					if (file_put_contents($file, $html)) {
						echo "File saved '$file'";
					} else {
						showError("Error saving file '$file'\nPossible causes are missing write permission or incorrect file path!");
					}
				} else {
					showError('Invalid filename!');
				}
			} else {
				showError("Missing reusable element data!\n");
			}
		break;
		case 'oembedProxy':
			$url = $_GET['url'] ?? '';
			if (validOembedUrl($url)) {
				$options = array(
				  'http'=>array(
					'method'=>"GET",
					'header'=> 'User-Agent: ' . $_SERVER['HTTP_USER_AGENT'] . "\r\n"
				  )
				);
				$context = stream_context_create($options);
				header('Content-Type: application/json');
				echo file_get_contents($url, false, $context );
			} else {
				showError('Invalid url!');
			}
		break;
		default:
			showError("Invalid action '$action'!");
	}
} else {
	//save page
	if ($html) {
		if ($file) {
			$dir = dirname($file);
			if (!is_dir($dir)) {
				if (!mkdir($dir, 0777, true)) {
					showError("Error creating folder '$dir'\n");
				}
			}

			if (file_put_contents($file, $html)) {
				// Also save to database
				$dbResult = saveToDatabase($file, $html, $templateName, $templateId, $authUser ?? [], $authCompanyId);

				$message = "File saved '$file'";
				if ($dbResult['success']) {
					$actionText = $dbResult['action'] === 'created' ? 'oluşturuldu' : 'güncellendi';
					$message .= " | Şablon veritabanına {$actionText} (v{$dbResult['version']})";
				}

				showSuccess($message, [
					'file' => $file,
					'template_id' => $dbResult['template_id'] ?? null,
					'template_action' => $dbResult['action'] ?? null,
					'template_version' => $dbResult['version'] ?? null
				]);
			} else {
				showError("Error saving file '$file'\nPossible causes are missing write permission or incorrect file path!");
			}
		} else {
			showError('Filename is empty!');
		}
	} else {
		showError('Html content is empty!');
	}
}
