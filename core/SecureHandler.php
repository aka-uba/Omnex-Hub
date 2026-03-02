<?php
/**
 * Secure Handler - API endpoint wrapper with built-in security
 *
 * Provides a clean, secure way to handle API requests with:
 * - Automatic authentication
 * - Input validation
 * - Rate limiting
 * - Error handling
 * - Audit logging
 *
 * @package OmnexDisplayHub
 */

class SecureHandler
{
    private static ?array $currentUser = null;
    private static ?string $companyId = null;

    /**
     * Execute a secure handler
     *
     * @param callable $handler The handler function
     * @param array $options Configuration options
     * @return void
     */
    public static function handle(callable $handler, array $options = []): void
    {
        $defaults = [
            'auth' => true,              // Require authentication
            'admin' => false,            // Require admin role
            'superadmin' => false,       // Require superadmin role
            'roles' => [],               // Allowed roles (empty = all)
            'validate' => null,          // Validation rules array
            'sanitize' => true,          // Apply input sanitization
            'log' => false,              // Log to audit_logs
            'log_action' => null,        // Audit log action name
            'rateLimit' => null,         // Custom rate limit [limit, window]
        ];

        $options = array_merge($defaults, $options);

        try {
            // Get request body
            $input = Request::getInstance()->getBody();

            // Apply sanitization if enabled
            if ($options['sanitize'] && !empty($input)) {
                $input = self::sanitizeInput($input);
            }

            // Authentication check
            if ($options['auth']) {
                $user = Auth::user();
                if (!$user) {
                    Response::unauthorized('Authentication required');
                    return;
                }
                self::$currentUser = $user;
                self::$companyId = Auth::getActiveCompanyId();

                // Role checks
                if ($options['superadmin'] && $user['role'] !== 'superadmin') {
                    Response::forbidden('SuperAdmin access required');
                    return;
                }

                if ($options['admin'] && !in_array($user['role'], ['superadmin', 'admin'])) {
                    Response::forbidden('Admin access required');
                    return;
                }

                if (!empty($options['roles']) && !in_array($user['role'], $options['roles'])) {
                    Response::forbidden('Insufficient permissions');
                    return;
                }
            }

            // Validation
            if ($options['validate'] && !empty($input)) {
                $errors = Validator::validate($input, $options['validate']);
                if (!empty($errors)) {
                    Response::validationError($errors);
                    return;
                }
            }

            // Custom rate limit
            if ($options['rateLimit']) {
                $key = $_SERVER['REMOTE_ADDR'] . ':' . $_SERVER['REQUEST_URI'];
                if (!Security::checkRateLimit($key, $options['rateLimit'][0], $options['rateLimit'][1])) {
                    Response::json([
                        'success' => false,
                        'message' => 'Rate limit exceeded',
                        'error_code' => 'RATE_LIMIT'
                    ], 429);
                    return;
                }
            }

            // Execute handler
            $result = $handler($input, self::$currentUser, self::$companyId);

            // Audit logging
            if ($options['log'] && self::$currentUser) {
                self::logAction(
                    $options['log_action'] ?? 'api_action',
                    $input,
                    $result
                );
            }

        } catch (ValidationException $e) {
            Response::validationError($e->getErrors());
        } catch (AuthException $e) {
            Response::unauthorized($e->getMessage());
        } catch (ForbiddenException $e) {
            Response::forbidden($e->getMessage());
        } catch (NotFoundException $e) {
            Response::notFound($e->getMessage());
        } catch (Exception $e) {
            Logger::error('SecureHandler error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            if (defined('PRODUCTION_MODE') && PRODUCTION_MODE) {
                Response::serverError('An error occurred');
            } else {
                Response::serverError($e->getMessage());
            }
        }
    }

    /**
     * Get current authenticated user
     */
    public static function user(): ?array
    {
        if (self::$currentUser === null) {
            self::$currentUser = Auth::user();
        }
        return self::$currentUser;
    }

    /**
     * Get active company ID
     */
    public static function companyId(): ?string
    {
        if (self::$companyId === null) {
            self::$companyId = Auth::getActiveCompanyId();
        }
        return self::$companyId;
    }

    /**
     * Require specific fields in input
     */
    public static function requireFields(array $input, array $fields): void
    {
        $missing = [];
        foreach ($fields as $field) {
            if (!isset($input[$field]) || $input[$field] === '') {
                $missing[] = $field;
            }
        }

        if (!empty($missing)) {
            throw new ValidationException([
                'missing_fields' => 'Required fields missing: ' . implode(', ', $missing)
            ]);
        }
    }

    /**
     * Sanitize input array
     */
    private static function sanitizeInput(array $data): array
    {
        $result = [];
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $result[$key] = self::sanitizeInput($value);
            } elseif (is_string($value)) {
                $result[$key] = Security::sanitize($value);
            } else {
                $result[$key] = $value;
            }
        }
        return $result;
    }

    /**
     * Log action to audit_logs
     */
    private static function logAction(string $action, ?array $input, $result): void
    {
        if (!self::$currentUser) return;

        try {
            $db = Database::getInstance();

            // Mask sensitive fields
            $logInput = $input ? self::maskSensitiveData($input) : null;

            $db->insert('audit_logs', [
                'id' => $db->generateUuid(),
                'company_id' => self::$companyId,
                'user_id' => self::$currentUser['id'],
                'action' => $action,
                'entity_type' => 'api',
                'entity_id' => null,
                'old_values' => null,
                'new_values' => $logInput ? json_encode($logInput) : null,
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
                'created_at' => date('Y-m-d H:i:s')
            ]);
        } catch (Exception $e) {
            Logger::error('Audit log failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Mask sensitive data for logging
     */
    private static function maskSensitiveData(array $data): array
    {
        $sensitiveFields = [
            'password', 'password_confirmation', 'current_password', 'new_password',
            'token', 'api_key', 'secret', 'credit_card', 'cvv', 'ssn'
        ];

        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $data[$key] = self::maskSensitiveData($value);
            } elseif (in_array(strtolower($key), $sensitiveFields)) {
                $data[$key] = '***MASKED***';
            }
        }

        return $data;
    }
}

/**
 * Custom Exceptions
 */
class ValidationException extends Exception
{
    private array $errors;

    public function __construct(array $errors)
    {
        $this->errors = $errors;
        parent::__construct('Validation failed');
    }

    public function getErrors(): array
    {
        return $this->errors;
    }
}

class AuthException extends Exception {}
class ForbiddenException extends Exception {}
class NotFoundException extends Exception {}
