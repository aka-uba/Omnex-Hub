<?php
/**
 * NotificationService - Central notification engine
 *
 * Handles notification creation, delivery, and management for the Omnex Display Hub platform.
 *
 * @package OmnexDisplayHub
 */

class NotificationService
{
    private static ?NotificationService $instance = null;
    private Database $db;

    /**
     * Notification types
     */
    public const TYPE_INFO = 'info';
    public const TYPE_SUCCESS = 'success';
    public const TYPE_WARNING = 'warning';
    public const TYPE_ERROR = 'error';

    /**
     * Priority levels
     */
    public const PRIORITY_LOW = 'low';
    public const PRIORITY_NORMAL = 'normal';
    public const PRIORITY_HIGH = 'high';
    public const PRIORITY_URGENT = 'urgent';

    /**
     * Target types
     */
    public const TARGET_USER = 'user';
    public const TARGET_ROLE = 'role';
    public const TARGET_COMPANY = 'company';
    public const TARGET_ALL = 'all';

    /**
     * Recipient statuses
     */
    public const STATUS_UNREAD = 'unread';
    public const STATUS_READ = 'read';
    public const STATUS_ARCHIVED = 'archived';
    public const STATUS_DELETED = 'deleted';

    /**
     * Default channels
     */
    public const DEFAULT_CHANNELS = ['web'];

    /**
     * Private constructor for singleton pattern
     */
    private function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * Get singleton instance
     */
    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Send notification to specific user
     *
     * @param string $userId Target user ID
     * @param string $title Notification title
     * @param string $message Notification message
     * @param array $options Optional settings (type, icon, link, channels, priority, expires_at, created_by)
     * @return string|null Notification ID or null on failure
     */
    public function sendToUser(string $userId, string $title, string $message, array $options = []): ?string
    {
        try {
            // Get user's company ID
            $user = $this->db->fetch("SELECT company_id FROM users WHERE id = ?", [$userId]);
            if (!$user) {
                Logger::warning("NotificationService: User not found", ['user_id' => $userId]);
                return null;
            }

            // Fallback company_id for users with NULL (e.g. SuperAdmin)
            $companyId = $user['company_id'];
            if (!$companyId) {
                $fallback = $this->db->fetch("SELECT id FROM companies WHERE status = 'active' ORDER BY created_at ASC LIMIT 1");
                $companyId = $fallback['id'] ?? null;
                if (!$companyId) {
                    Logger::warning("NotificationService: No company found for fallback", ['user_id' => $userId]);
                    return null;
                }
            }

            // Check if user is within quiet hours
            if ($this->isInQuietHours($userId)) {
                Logger::debug("NotificationService: User in quiet hours, skipping", ['user_id' => $userId]);
                // Still create notification but skip push/toast channels
                $options['channels'] = array_values(array_diff($options['channels'] ?? self::DEFAULT_CHANNELS, ['push', 'toast']));
            }

            // Create notification
            $notificationId = $this->createNotification([
                'company_id' => $companyId,
                'title' => $title,
                'message' => $message,
                'target_type' => self::TARGET_USER,
                'target_id' => $userId,
                'type' => $options['type'] ?? self::TYPE_INFO,
                'icon' => $options['icon'] ?? null,
                'link' => $options['link'] ?? null,
                'channels' => $options['channels'] ?? self::DEFAULT_CHANNELS,
                'priority' => $options['priority'] ?? self::PRIORITY_NORMAL,
                'expires_at' => $options['expires_at'] ?? null,
                'created_by' => $options['created_by'] ?? null
            ]);

            // Create recipient record
            $this->createRecipient($notificationId, $userId);

            Logger::info("Notification sent to user", [
                'notification_id' => $notificationId,
                'user_id' => $userId,
                'title' => $title
            ]);

            return $notificationId;
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to send to user", [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Send notification to all users with specific role
     *
     * @param string $role Role name (SuperAdmin, Admin, Manager, User)
     * @param string $title Notification title
     * @param string $message Notification message
     * @param array $options Optional settings
     * @return array Array of notification IDs created for each user
     */
    public function sendToRole(string $role, string $title, string $message, array $options = []): array
    {
        $notificationIds = [];

        try {
            // Get company ID for filtering
            $companyId = $options['company_id'] ?? Auth::getActiveCompanyId() ?? null;

            // Get users with the specified role
            $users = $this->getTargetUsers(self::TARGET_ROLE, $role, $companyId);

            if (empty($users)) {
                Logger::warning("NotificationService: No users found with role", ['role' => $role]);
                return $notificationIds;
            }

            // A notification row is company-scoped. If no explicit scope exists,
            // lock to the first user's company and keep recipients in that scope.
            if (!$companyId) {
                $companyId = $users[0]['company_id'] ?? null;
                if (!$companyId) {
                    Logger::warning("NotificationService: Role notification skipped - missing company scope", ['role' => $role]);
                    return $notificationIds;
                }
                $users = array_values(array_filter($users, fn($u) => ($u['company_id'] ?? null) === $companyId));
            }

            // Create base notification
            $notificationId = $this->createNotification([
                'company_id' => $companyId,
                'title' => $title,
                'message' => $message,
                'target_type' => self::TARGET_ROLE,
                'target_id' => $role,
                'type' => $options['type'] ?? self::TYPE_INFO,
                'icon' => $options['icon'] ?? null,
                'link' => $options['link'] ?? null,
                'channels' => $options['channels'] ?? self::DEFAULT_CHANNELS,
                'priority' => $options['priority'] ?? self::PRIORITY_NORMAL,
                'expires_at' => $options['expires_at'] ?? null,
                'created_by' => $options['created_by'] ?? null
            ]);

            // Create recipient records for each user
            foreach ($users as $user) {
                $this->createRecipient($notificationId, $user['id']);
                $notificationIds[$user['id']] = $notificationId;
            }

            Logger::info("Notification sent to role", [
                'notification_id' => $notificationId,
                'role' => $role,
                'recipient_count' => count($notificationIds)
            ]);

            return $notificationIds;
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to send to role", [
                'role' => $role,
                'error' => $e->getMessage()
            ]);
            return $notificationIds;
        }
    }

    /**
     * Send notification to all users in company
     *
     * @param string $companyId Company ID
     * @param string $title Notification title
     * @param string $message Notification message
     * @param array $options Optional settings
     * @return array Array of notification IDs per user
     */
    public function sendToCompany(string $companyId, string $title, string $message, array $options = []): array
    {
        $notificationIds = [];

        try {
            // Get all users in the company
            $users = $this->getTargetUsers(self::TARGET_COMPANY, $companyId, $companyId);

            if (empty($users)) {
                Logger::warning("NotificationService: No users found in company", ['company_id' => $companyId]);
                return $notificationIds;
            }

            // Create base notification
            $notificationId = $this->createNotification([
                'company_id' => $companyId,
                'title' => $title,
                'message' => $message,
                'target_type' => self::TARGET_COMPANY,
                'target_id' => $companyId,
                'type' => $options['type'] ?? self::TYPE_INFO,
                'icon' => $options['icon'] ?? null,
                'link' => $options['link'] ?? null,
                'channels' => $options['channels'] ?? self::DEFAULT_CHANNELS,
                'priority' => $options['priority'] ?? self::PRIORITY_NORMAL,
                'expires_at' => $options['expires_at'] ?? null,
                'created_by' => $options['created_by'] ?? null
            ]);

            // Create recipient records for each user
            foreach ($users as $user) {
                $this->createRecipient($notificationId, $user['id']);
                $notificationIds[$user['id']] = $notificationId;
            }

            Logger::info("Notification sent to company", [
                'notification_id' => $notificationId,
                'company_id' => $companyId,
                'recipient_count' => count($notificationIds)
            ]);

            return $notificationIds;
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to send to company", [
                'company_id' => $companyId,
                'error' => $e->getMessage()
            ]);
            return $notificationIds;
        }
    }

    /**
     * Send notification to all admins (SuperAdmin and Admin roles)
     *
     * @param string $title Notification title
     * @param string $message Notification message
     * @param array $options Optional settings
     * @return array Array of notification IDs
     */
    public function notifyAdmins(string $title, string $message, array $options = []): array
    {
        $notificationIds = [];

        try {
            // Get all admin users
            $admins = $this->db->fetchAll(
                "SELECT id, company_id FROM users WHERE role IN ('SuperAdmin', 'Admin') AND status = 'active'"
            );

            if (empty($admins)) {
                Logger::warning("NotificationService: No admin users found");
                return $notificationIds;
            }

            // Group admins by company
            $adminsByCompany = [];
            foreach ($admins as $admin) {
                $companyId = $admin['company_id'] ?? 'global';
                $adminsByCompany[$companyId][] = $admin;
            }

            // Create notifications for each company's admins
            foreach ($adminsByCompany as $companyId => $companyAdmins) {
                $actualCompanyId = $companyId === 'global' ? null : $companyId;

                // For global admins (SuperAdmin without company), get first company
                if (!$actualCompanyId) {
                    $firstCompany = $this->db->fetch("SELECT id FROM companies ORDER BY created_at ASC LIMIT 1");
                    $actualCompanyId = $firstCompany['id'] ?? null;
                }

                if (!$actualCompanyId) {
                    continue;
                }

                $notificationId = $this->createNotification([
                    'company_id' => $actualCompanyId,
                    'title' => $title,
                    'message' => $message,
                    'target_type' => self::TARGET_ROLE,
                    'target_id' => 'admin',
                    'type' => $options['type'] ?? self::TYPE_INFO,
                    'icon' => $options['icon'] ?? 'ti-shield',
                    'link' => $options['link'] ?? null,
                    'channels' => $options['channels'] ?? self::DEFAULT_CHANNELS,
                    'priority' => $options['priority'] ?? self::PRIORITY_HIGH,
                    'expires_at' => $options['expires_at'] ?? null,
                    'created_by' => $options['created_by'] ?? null
                ]);

                foreach ($companyAdmins as $admin) {
                    $this->createRecipient($notificationId, $admin['id']);
                    $notificationIds[$admin['id']] = $notificationId;
                }
            }

            Logger::info("Notification sent to admins", [
                'recipient_count' => count($notificationIds),
                'title' => $title
            ]);

            return $notificationIds;
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to notify admins", [
                'error' => $e->getMessage()
            ]);
            return $notificationIds;
        }
    }

    /**
     * Notify when a new user is created
     *
     * @param array $user New user data
     */
    public function notifyNewUser(array $user): void
    {
        try {
            $fullName = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
            $title = 'Yeni Kullanici Kaydi';
            $message = sprintf(
                '%s (%s) sisteme yeni kullanici olarak eklendi.',
                $fullName ?: 'Yeni Kullanici',
                $user['email'] ?? 'Bilinmiyor'
            );

            $this->notifyAdmins($title, $message, [
                'type' => self::TYPE_INFO,
                'icon' => 'ti-user-plus',
                'link' => '#/admin/users',
                'priority' => self::PRIORITY_NORMAL
            ]);

            Logger::info("New user notification sent", ['user_email' => $user['email'] ?? 'unknown']);
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to notify new user", [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Notify when product sync completes
     *
     * @param string $companyId Company ID
     * @param int $count Number of products synced
     * @param bool $success Whether sync was successful
     */
    public function notifyProductSync(string $companyId, int $count, bool $success): void
    {
        try {
            if ($success) {
                $title = 'Urun Senkronizasyonu Tamamlandi';
                $message = sprintf('%d urun basariyla senkronize edildi.', $count);
                $type = self::TYPE_SUCCESS;
                $icon = 'ti-check';
            } else {
                $title = 'Urun Senkronizasyonu Basarisiz';
                $message = 'Urun senkronizasyonu sirasinda hata olustu. Lutfen tekrar deneyin.';
                $type = self::TYPE_ERROR;
                $icon = 'ti-alert-triangle';
            }

            $this->sendToCompany($companyId, $title, $message, [
                'type' => $type,
                'icon' => $icon,
                'link' => '#/products',
                'priority' => $success ? self::PRIORITY_NORMAL : self::PRIORITY_HIGH
            ]);

            Logger::info("Product sync notification sent", [
                'company_id' => $companyId,
                'count' => $count,
                'success' => $success
            ]);
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to notify product sync", [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Notify when device status changes
     *
     * @param string $deviceId Device ID
     * @param string $status New status (online, offline, error, etc.)
     */
    public function notifyDeviceStatus(string $deviceId, string $status): void
    {
        try {
            // Get device details
            $device = $this->db->fetch(
                "SELECT d.*, c.name as company_name FROM devices d
                 LEFT JOIN companies c ON d.company_id = c.id
                 WHERE d.id = ?",
                [$deviceId]
            );

            if (!$device) {
                Logger::warning("NotificationService: Device not found", ['device_id' => $deviceId]);
                return;
            }

            $deviceName = $device['name'] ?? $device['mac_address'] ?? 'Bilinmeyen Cihaz';

            switch ($status) {
                case 'offline':
                    $title = 'Cihaz Baglantisi Kesildi';
                    $message = sprintf('%s cihazi cevrimdisi oldu.', $deviceName);
                    $type = self::TYPE_WARNING;
                    $icon = 'ti-wifi-off';
                    $priority = self::PRIORITY_HIGH;
                    break;

                case 'online':
                    $title = 'Cihaz Baglandi';
                    $message = sprintf('%s cihazi cevrimici oldu.', $deviceName);
                    $type = self::TYPE_SUCCESS;
                    $icon = 'ti-wifi';
                    $priority = self::PRIORITY_LOW;
                    break;

                case 'error':
                    $title = 'Cihaz Hatasi';
                    $message = sprintf('%s cihazinda hata olustu.', $deviceName);
                    $type = self::TYPE_ERROR;
                    $icon = 'ti-alert-circle';
                    $priority = self::PRIORITY_URGENT;
                    break;

                case 'low_battery':
                    $title = 'Dusuk Pil Uyarisi';
                    $message = sprintf('%s cihazinin pili azaliyor.', $deviceName);
                    $type = self::TYPE_WARNING;
                    $icon = 'ti-battery-1';
                    $priority = self::PRIORITY_HIGH;
                    break;

                default:
                    $title = 'Cihaz Durumu Degisti';
                    $message = sprintf('%s cihazinin durumu: %s', $deviceName, $status);
                    $type = self::TYPE_INFO;
                    $icon = 'ti-device-desktop';
                    $priority = self::PRIORITY_NORMAL;
            }

            // Notify company admins
            $this->sendToRole('Admin', $title, $message, [
                'company_id' => $device['company_id'],
                'type' => $type,
                'icon' => $icon,
                'link' => '#/devices/' . $deviceId,
                'priority' => $priority
            ]);

            Logger::info("Device status notification sent", [
                'device_id' => $deviceId,
                'status' => $status
            ]);
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to notify device status", [
                'device_id' => $deviceId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Notify when license is expiring
     *
     * @param string $companyId Company ID
     * @param int $daysLeft Days until expiration
     */
    public function notifyLicenseExpiring(string $companyId, int $daysLeft): void
    {
        try {
            // Get company details
            $company = $this->db->fetch("SELECT name FROM companies WHERE id = ?", [$companyId]);
            $companyName = $company['name'] ?? 'Sirket';

            if ($daysLeft <= 0) {
                $title = 'Lisans Suresi Doldu';
                $message = sprintf('%s lisansi suresi doldu. Lutfen yenileyin.', $companyName);
                $type = self::TYPE_ERROR;
                $priority = self::PRIORITY_URGENT;
            } elseif ($daysLeft <= 7) {
                $title = 'Lisans Acil Uyari';
                $message = sprintf('%s lisansi %d gun icinde sona erecek!', $companyName, $daysLeft);
                $type = self::TYPE_WARNING;
                $priority = self::PRIORITY_URGENT;
            } elseif ($daysLeft <= 30) {
                $title = 'Lisans Suresi Azaliyor';
                $message = sprintf('%s lisansi %d gun icinde sona erecek.', $companyName, $daysLeft);
                $type = self::TYPE_WARNING;
                $priority = self::PRIORITY_HIGH;
            } else {
                $title = 'Lisans Hatirlatmasi';
                $message = sprintf('%s lisansi %d gun sonra sona erecek.', $companyName, $daysLeft);
                $type = self::TYPE_INFO;
                $priority = self::PRIORITY_NORMAL;
            }

            // Notify company admins
            $this->sendToRole('Admin', $title, $message, [
                'company_id' => $companyId,
                'type' => $type,
                'icon' => 'ti-certificate',
                'link' => '#/admin/licenses',
                'priority' => $priority
            ]);

            // Also notify SuperAdmins
            $this->notifyAdmins($title, $message, [
                'type' => $type,
                'icon' => 'ti-certificate',
                'link' => '#/admin/licenses',
                'priority' => $priority
            ]);

            Logger::info("License expiring notification sent", [
                'company_id' => $companyId,
                'days_left' => $daysLeft
            ]);
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to notify license expiring", [
                'company_id' => $companyId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Get unread notification count for user
     *
     * @param string $userId User ID
     * @return int Unread count
     */
    public function getUnreadCount(string $userId): int
    {
        try {
            $count = $this->db->fetchColumn(
                "SELECT COUNT(*) FROM notification_recipients
                 WHERE user_id = ? AND status IN ('unread', 'sent')",
                [$userId]
            );

            return (int) $count;
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to get unread count", [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return 0;
        }
    }

    /**
     * Mark notification as read
     *
     * @param string $notificationId Notification ID
     * @param string $userId User ID
     * @return bool Success
     */
    public function markAsRead(string $notificationId, string $userId): bool
    {
        try {
            $updated = $this->db->update(
                'notification_recipients',
                [
                    'status' => self::STATUS_READ,
                    'read_at' => date('Y-m-d H:i:s')
                ],
                'notification_id = ? AND user_id = ?',
                [$notificationId, $userId]
            );

            if ($updated > 0) {
                Logger::debug("Notification marked as read", [
                    'notification_id' => $notificationId,
                    'user_id' => $userId
                ]);
                return true;
            }

            return false;
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to mark as read", [
                'notification_id' => $notificationId,
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Mark all notifications as read for user
     *
     * @param string $userId User ID
     * @return int Number of notifications marked
     */
    public function markAllAsRead(string $userId): int
    {
        try {
            $updated = $this->db->update(
                'notification_recipients',
                [
                    'status' => self::STATUS_READ,
                    'read_at' => date('Y-m-d H:i:s')
                ],
                "user_id = ? AND status IN ('unread', 'sent')",
                [$userId]
            );

            Logger::info("All notifications marked as read", [
                'user_id' => $userId,
                'count' => $updated
            ]);

            return $updated;
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to mark all as read", [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return 0;
        }
    }

    /**
     * Archive notification
     *
     * @param string $notificationId Notification ID
     * @param string $userId User ID
     * @return bool Success
     */
    public function archive(string $notificationId, string $userId): bool
    {
        try {
            $updated = $this->db->update(
                'notification_recipients',
                [
                    'status' => self::STATUS_ARCHIVED,
                    'archived_at' => date('Y-m-d H:i:s')
                ],
                'notification_id = ? AND user_id = ?',
                [$notificationId, $userId]
            );

            if ($updated > 0) {
                Logger::debug("Notification archived", [
                    'notification_id' => $notificationId,
                    'user_id' => $userId
                ]);
                return true;
            }

            return false;
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to archive", [
                'notification_id' => $notificationId,
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Delete notification (soft delete)
     *
     * @param string $notificationId Notification ID
     * @param string $userId User ID
     * @return bool Success
     */
    public function delete(string $notificationId, string $userId): bool
    {
        try {
            $updated = $this->db->update(
                'notification_recipients',
                [
                    'status' => self::STATUS_DELETED,
                    'deleted_at' => date('Y-m-d H:i:s')
                ],
                'notification_id = ? AND user_id = ?',
                [$notificationId, $userId]
            );

            if ($updated > 0) {
                Logger::debug("Notification deleted", [
                    'notification_id' => $notificationId,
                    'user_id' => $userId
                ]);
                return true;
            }

            return false;
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to delete", [
                'notification_id' => $notificationId,
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Get user notifications with pagination and filtering
     *
     * @param string $userId User ID
     * @param array $filters Optional filters (status, type, priority, page, per_page, include_archived)
     * @return array Paginated notifications with metadata
     */
    public function getUserNotifications(string $userId, array $filters = []): array
    {
        try {
            $page = max(1, (int) ($filters['page'] ?? 1));
            $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 20)));
            $offset = ($page - 1) * $perPage;

            $where = ['nr.user_id = ?'];
            $params = [$userId];

            // Filter by status
            if (isset($filters['status'])) {
                $where[] = 'nr.status = ?';
                $params[] = $filters['status'];
            } else {
                // By default, exclude deleted
                $where[] = "nr.status != 'deleted'";

                // Optionally include archived
                if (empty($filters['include_archived'])) {
                    $where[] = "nr.status != 'archived'";
                }
            }

            // Filter by type
            if (!empty($filters['type'])) {
                $where[] = 'n.type = ?';
                $params[] = $filters['type'];
            }

            // Filter by priority
            if (!empty($filters['priority'])) {
                $where[] = 'n.priority = ?';
                $params[] = $filters['priority'];
            }

            // Exclude expired notifications
            $where[] = "(n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)";

            $whereClause = implode(' AND ', $where);
            $creatorJoin = $this->db->isPostgres()
                ? 'LEFT JOIN users u ON CAST(n.created_by AS TEXT) = CAST(u.id AS TEXT)'
                : 'LEFT JOIN users u ON n.created_by = u.id';

            // Get total count
            $total = $this->db->fetchColumn(
                "SELECT COUNT(*) FROM notification_recipients nr
                 JOIN notifications n ON nr.notification_id = n.id
                 WHERE $whereClause",
                $params
            );

            // Get notifications
            $notifications = $this->db->fetchAll(
                "SELECT n.*, nr.status as recipient_status, nr.read_at, nr.archived_at,
                        u.first_name as creator_first_name, u.last_name as creator_last_name
                 FROM notification_recipients nr
                 JOIN notifications n ON nr.notification_id = n.id
                 $creatorJoin
                 WHERE $whereClause
                 ORDER BY
                    CASE n.priority
                        WHEN 'urgent' THEN 0
                        WHEN 'high' THEN 1
                        WHEN 'normal' THEN 2
                        WHEN 'low' THEN 3
                    END,
                    n.created_at DESC
                 LIMIT ? OFFSET ?",
                array_merge($params, [$perPage, $offset])
            );

            // Parse channels JSON
            foreach ($notifications as &$notification) {
                $notification['channels'] = json_decode($notification['channels'] ?? '["web"]', true);
            }

            return [
                'data' => $notifications,
                'pagination' => [
                    'total' => (int) $total,
                    'page' => $page,
                    'per_page' => $perPage,
                    'total_pages' => ceil($total / $perPage)
                ],
                'unread_count' => $this->getUnreadCount($userId)
            ];
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to get user notifications", [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return [
                'data' => [],
                'pagination' => [
                    'total' => 0,
                    'page' => 1,
                    'per_page' => 20,
                    'total_pages' => 0
                ],
                'unread_count' => 0
            ];
        }
    }

    /**
     * Create notification record
     *
     * @param array $data Notification data
     * @return string Notification ID
     */
    private function createNotification(array $data): string
    {
        $notificationId = $this->db->generateUuid();

        $this->db->insert('notifications', [
            'id' => $notificationId,
            'company_id' => $data['company_id'],
            'title' => $data['title'],
            'message' => $data['message'] ?? null,
            'type' => $data['type'] ?? self::TYPE_INFO,
            'icon' => $data['icon'] ?? null,
            'link' => $data['link'] ?? null,
            'target_type' => $data['target_type'] ?? self::TARGET_USER,
            'target_id' => $data['target_id'] ?? null,
            'channels' => json_encode($data['channels'] ?? self::DEFAULT_CHANNELS),
            'priority' => $data['priority'] ?? self::PRIORITY_NORMAL,
            'expires_at' => $data['expires_at'] ?? null,
            'created_by' => $data['created_by'] ?? Auth::id(),
            'created_at' => date('Y-m-d H:i:s')
        ]);

        return $notificationId;
    }

    /**
     * Create recipient record
     *
     * @param string $notificationId Notification ID
     * @param string $userId User ID
     */
    private function createRecipient(string $notificationId, string $userId): void
    {
        // Check if recipient already exists
        $existing = $this->db->fetch(
            "SELECT id FROM notification_recipients WHERE notification_id = ? AND user_id = ?",
            [$notificationId, $userId]
        );

        if ($existing) {
            return;
        }

        $this->db->insert('notification_recipients', [
            'id' => $this->db->generateUuid(),
            'notification_id' => $notificationId,
            'user_id' => $userId,
            'status' => 'unread',
        ]);
    }

    /**
     * Get users by target type
     *
     * @param string $targetType Target type (user, role, company, all)
     * @param string|null $targetId Target ID (user ID, role name, company ID)
     * @param string $companyId Company ID for filtering
     * @return array Array of users
     */
    private function getTargetUsers(string $targetType, ?string $targetId, ?string $companyId): array
    {
        switch ($targetType) {
            case self::TARGET_USER:
                return $this->db->fetchAll(
                    "SELECT id, company_id FROM users WHERE id = ? AND status = 'active'",
                    [$targetId]
                );

            case self::TARGET_ROLE:
                if ($companyId) {
                    return $this->db->fetchAll(
                        "SELECT id, company_id FROM users WHERE LOWER(role) = LOWER(?) AND company_id = ? AND status = 'active'",
                        [$targetId, $companyId]
                    );
                }
                return $this->db->fetchAll(
                    "SELECT id, company_id FROM users WHERE LOWER(role) = LOWER(?) AND status = 'active'",
                    [$targetId]
                );

            case self::TARGET_COMPANY:
                return $this->db->fetchAll(
                    "SELECT id, company_id FROM users WHERE company_id = ? AND status = 'active'",
                    [$targetId]
                );

            case self::TARGET_ALL:
                if ($companyId) {
                    return $this->db->fetchAll(
                        "SELECT id, company_id FROM users WHERE company_id = ? AND status = 'active'",
                        [$companyId]
                    );
                }
                return $this->db->fetchAll(
                    "SELECT id, company_id FROM users WHERE status = 'active'"
                );

            default:
                return [];
        }
    }

    /**
     * Check if user is in quiet hours
     *
     * @param string $userId User ID
     * @return bool True if in quiet hours
     */
    private function isInQuietHours(string $userId): bool
    {
        try {
            $settings = $this->db->fetch(
                "SELECT quiet_start, quiet_end, type_preferences
                 FROM user_notification_preferences
                 WHERE user_id = ?",
                [$userId]
            );

            if (!$settings) {
                return false;
            }

            $typePrefs = json_decode($settings['type_preferences'] ?? '{}', true);
            if (is_array($typePrefs) && array_key_exists('_dnd_enabled', $typePrefs) && !$typePrefs['_dnd_enabled']) {
                return false;
            }

            if (!$settings['quiet_start'] || !$settings['quiet_end']) {
                return false;
            }

            $now = new DateTime();
            $currentTime = $now->format('H:i');

            $quietStart = $settings['quiet_start'];
            $quietEnd = $settings['quiet_end'];

            // Handle overnight quiet hours (e.g., 22:00 - 08:00)
            if ($quietStart > $quietEnd) {
                return $currentTime >= $quietStart || $currentTime < $quietEnd;
            }

            // Normal hours (e.g., 14:00 - 16:00)
            return $currentTime >= $quietStart && $currentTime < $quietEnd;
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to check quiet hours", [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Get user notification settings
     *
     * @param string $userId User ID
     * @return array|null Settings or null if not found
     */
    public function getUserSettings(string $userId): ?array
    {
        try {
            $settings = $this->db->fetch(
                "SELECT * FROM user_notification_preferences WHERE user_id = ?",
                [$userId]
            );

            if ($settings) {
                $settings['type_preferences'] = json_decode($settings['type_preferences'] ?? '{}', true);
            }

            return $settings;
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to get user settings", [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Update user notification settings
     *
     * @param string $userId User ID
     * @param array $settings Settings to update
     * @return bool Success
     */
    public function updateUserSettings(string $userId, array $settings): bool
    {
        try {
            $existing = $this->db->fetch(
                "SELECT id FROM user_notification_preferences WHERE user_id = ?",
                [$userId]
            );

            // Backward-compatible field mapping
            if (array_key_exists('enabled', $settings)) {
                $settings['web_enabled'] = $settings['enabled'] ? 1 : 0;
                $settings['toast_enabled'] = $settings['enabled'] ? 1 : 0;
                unset($settings['enabled']);
            }
            if (array_key_exists('sound', $settings)) {
                $settings['sound_enabled'] = $settings['sound'] ? 1 : 0;
                unset($settings['sound']);
            }
            if (array_key_exists('desktop', $settings)) {
                $settings['push_enabled'] = $settings['desktop'] ? 1 : 0;
                unset($settings['desktop']);
            }
            if (array_key_exists('types', $settings) && is_array($settings['types'])) {
                $settings['type_preferences'] = $settings['types'];
                unset($settings['types']);
            }
            if (array_key_exists('dnd_start', $settings)) {
                $settings['quiet_start'] = $settings['dnd_start'];
                unset($settings['dnd_start']);
            }
            if (array_key_exists('dnd_end', $settings)) {
                $settings['quiet_end'] = $settings['dnd_end'];
                unset($settings['dnd_end']);
            }

            // Support metadata stored inside type_preferences
            if (array_key_exists('email_digest', $settings) || array_key_exists('dnd_enabled', $settings)) {
                $typePrefs = [];
                if (isset($settings['type_preferences'])) {
                    if (is_string($settings['type_preferences'])) {
                        $decoded = json_decode($settings['type_preferences'], true);
                        if (is_array($decoded)) {
                            $typePrefs = $decoded;
                        }
                    } elseif (is_array($settings['type_preferences'])) {
                        $typePrefs = $settings['type_preferences'];
                    }
                }

                if (array_key_exists('email_digest', $settings)) {
                    $typePrefs['_email_digest'] = $settings['email_digest'];
                    unset($settings['email_digest']);
                }
                if (array_key_exists('dnd_enabled', $settings)) {
                    $typePrefs['_dnd_enabled'] = (bool)$settings['dnd_enabled'];
                    if (!$typePrefs['_dnd_enabled']) {
                        $settings['quiet_start'] = null;
                        $settings['quiet_end'] = null;
                    }
                    unset($settings['dnd_enabled']);
                }
                $settings['type_preferences'] = $typePrefs;
            }

            // Prepare type preferences as JSON
            if (isset($settings['type_preferences']) && is_array($settings['type_preferences'])) {
                $settings['type_preferences'] = json_encode($settings['type_preferences']);
            }

            // Keep only actual columns from user_notification_preferences
            $allowedKeys = [
                'email_enabled', 'push_enabled', 'toast_enabled', 'web_enabled',
                'sound_enabled', 'type_preferences', 'quiet_start', 'quiet_end',
                'updated_at', 'created_at', 'id', 'user_id'
            ];
            $settings = array_intersect_key($settings, array_flip($allowedKeys));

            $settings['updated_at'] = date('Y-m-d H:i:s');

            if ($existing) {
                $this->db->update(
                    'user_notification_preferences',
                    $settings,
                    'user_id = ?',
                    [$userId]
                );
            } else {
                $settings['id'] = $this->db->generateUuid();
                $settings['user_id'] = $userId;
                $settings['created_at'] = date('Y-m-d H:i:s');
                $this->db->insert('user_notification_preferences', $settings);
            }

            Logger::info("User notification settings updated", ['user_id' => $userId]);
            return true;
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to update user settings", [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Cleanup expired notifications
     *
     * @param int $daysOld Delete notifications older than this many days (default: 90)
     * @return int Number of deleted records
     */
    public function cleanupExpired(int $daysOld = 90): int
    {
        try {
            $cutoffDate = date('Y-m-d H:i:s', strtotime("-{$daysOld} days"));

            // Delete old recipient records first (due to foreign key)
            $deletedRecipients = $this->db->query(
                "DELETE FROM notification_recipients
                 WHERE notification_id IN (
                     SELECT id FROM notifications
                     WHERE created_at < ? OR (expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP)
                 )",
                [$cutoffDate]
            )->rowCount();

            // Delete old notifications
            $deletedNotifications = $this->db->query(
                "DELETE FROM notifications
                 WHERE created_at < ? OR (expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP)",
                [$cutoffDate]
            )->rowCount();

            Logger::info("Notification cleanup completed", [
                'deleted_recipients' => $deletedRecipients,
                'deleted_notifications' => $deletedNotifications
            ]);

            return $deletedNotifications;
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to cleanup expired", [
                'error' => $e->getMessage()
            ]);
            return 0;
        }
    }

    /**
     * Get company-level retention setting for device send notifications.
     */
    public function getDeviceNotificationRetentionDays(?string $companyId, int $default = 30): int
    {
        if (empty($companyId)) {
            return max(1, min(365, $default));
        }

        try {
            $row = $this->db->fetch(
                "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL",
                [$companyId]
            );

            if (!$row || empty($row['data'])) {
                return max(1, min(365, $default));
            }

            $settings = json_decode($row['data'], true) ?? [];
            $value = (int)($settings['device_notification_retention_days'] ?? $default);
            return max(1, min(365, $value));
        } catch (Exception $e) {
            Logger::warning("NotificationService: Failed to read device notification retention", [
                'company_id' => $companyId,
                'error' => $e->getMessage()
            ]);
            return max(1, min(365, $default));
        }
    }

    /**
     * Cleanup old device-send notifications by retention window.
     *
     * Device-send notifications are identified by queue links:
     * - #/admin/queue...
     * - #/queue...
     */
    public function cleanupDeviceSendNotifications(string $companyId, int $daysOld = 30): int
    {
        $daysOld = max(1, min(365, $daysOld));

        try {
            $cutoffDate = date('Y-m-d H:i:s', strtotime("-{$daysOld} days"));

            $this->db->query(
                "DELETE FROM notification_recipients
                 WHERE notification_id IN (
                     SELECT id FROM notifications
                     WHERE company_id = ?
                       AND created_at < ?
                       AND (link LIKE '#/admin/queue%' OR link LIKE '#/queue%')
                 )",
                [$companyId, $cutoffDate]
            );

            $deletedNotifications = $this->db->query(
                "DELETE FROM notifications
                 WHERE company_id = ?
                   AND created_at < ?
                   AND (link LIKE '#/admin/queue%' OR link LIKE '#/queue%')",
                [$companyId, $cutoffDate]
            )->rowCount();

            return $deletedNotifications;
        } catch (Exception $e) {
            Logger::error("NotificationService: Failed to cleanup device send notifications", [
                'company_id' => $companyId,
                'days_old' => $daysOld,
                'error' => $e->getMessage()
            ]);
            return 0;
        }
    }

    /**
     * Prevent cloning
     */
    private function __clone() {}

    /**
     * Prevent unserialization
     */
    public function __wakeup()
    {
        throw new Exception("Cannot unserialize singleton");
    }
}
