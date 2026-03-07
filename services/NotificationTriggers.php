<?php
/**
 * NotificationTriggers - Automatic notification triggers for system events
 *
 * This class contains static methods that can be called from various API endpoints
 * to trigger automatic notifications. All methods handle errors gracefully so that
 * notification failures do not break main operations.
 *
 * @package OmnexDisplayHub
 */

require_once __DIR__ . '/NotificationService.php';

class NotificationTriggers
{
    /**
     * Trigger when new user is registered
     * Sends notification to all admins
     *
     * @param array $user User data (first_name, last_name, email required)
     */
    public static function onUserRegistered(array $user): void
    {
        try {
            $service = NotificationService::getInstance();
            $fullName = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));
            $email = $user['email'] ?? 'Bilinmiyor';

            $service->notifyAdmins(
                'Yeni Kullanici Kaydi',
                "{$fullName} ({$email}) sisteme kaydoldu.",
                [
                    'type' => NotificationService::TYPE_INFO,
                    'icon' => 'ti-user-plus',
                    'link' => '#/admin/users',
                    'priority' => NotificationService::PRIORITY_NORMAL
                ]
            );

            Logger::info('NotificationTriggers: User registration notification sent', [
                'user_email' => $email
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send user registration notification', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when user is approved/activated
     * Sends notification to the user
     *
     * @param string $userId User ID
     */
    public static function onUserApproved(string $userId): void
    {
        try {
            $service = NotificationService::getInstance();

            $service->sendToUser(
                $userId,
                'Hesabiniz Onaylandi',
                'Hesabiniz yonetici tarafindan onaylandi. Artik sistemi kullanabilirsiniz.',
                [
                    'type' => NotificationService::TYPE_SUCCESS,
                    'icon' => 'ti-user-check',
                    'link' => '#/dashboard',
                    'priority' => NotificationService::PRIORITY_NORMAL
                ]
            );

            Logger::info('NotificationTriggers: User approval notification sent', [
                'user_id' => $userId
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send user approval notification', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when password is changed
     * Sends notification to the user
     *
     * @param string $userId User ID
     */
    public static function onPasswordChanged(string $userId): void
    {
        try {
            $service = NotificationService::getInstance();

            $service->sendToUser(
                $userId,
                'Sifreniz Degistirildi',
                'Hesap sifreniz basariyla degistirildi. Bu islemi siz yapmadiysa lutfen yoneticinize bildirin.',
                [
                    'type' => NotificationService::TYPE_WARNING,
                    'icon' => 'ti-lock',
                    'link' => '#/profile',
                    'priority' => NotificationService::PRIORITY_HIGH
                ]
            );

            Logger::info('NotificationTriggers: Password change notification sent', [
                'user_id' => $userId
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send password change notification', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when sync/import operation completes
     * Sends notification to user who initiated
     *
     * @param string $userId User ID who initiated the sync
     * @param array $result Sync result with 'success', 'imported', 'failed' keys
     */
    public static function onSyncComplete(string $userId, array $result): void
    {
        try {
            $service = NotificationService::getInstance();

            $success = $result['success'] ?? false;
            $imported = $result['imported'] ?? 0;
            $failed = $result['failed'] ?? 0;

            $type = $success ? NotificationService::TYPE_SUCCESS : NotificationService::TYPE_WARNING;
            $title = $success ? 'Senkronizasyon Tamamlandi' : 'Senkronizasyon Hatasi';
            $message = "Islem tamamlandi. Basarili: {$imported}, Hatali: {$failed}";
            $icon = $success ? 'ti-check' : 'ti-alert-triangle';

            $service->sendToUser(
                $userId,
                $title,
                $message,
                [
                    'type' => $type,
                    'icon' => $icon,
                    'link' => '#/products',
                    'priority' => $success ? NotificationService::PRIORITY_NORMAL : NotificationService::PRIORITY_HIGH
                ]
            );

            Logger::info('NotificationTriggers: Sync complete notification sent', [
                'user_id' => $userId,
                'success' => $success,
                'imported' => $imported,
                'failed' => $failed
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send sync complete notification', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when import completes
     * Sends notification to user who initiated the import
     *
     * @param string $userId User ID who initiated the import
     * @param array $result Import result with summary data
     */
    public static function onImportComplete(string $userId, array $result): void
    {
        try {
            $service = NotificationService::getInstance();

            $summary = $result['summary'] ?? $result;
            $total = $summary['total_rows'] ?? $summary['total'] ?? 0;
            $inserted = $summary['inserted'] ?? 0;
            $updated = $summary['updated'] ?? 0;
            $failed = $summary['failed'] ?? 0;

            $type = $failed > 0 ? NotificationService::TYPE_WARNING : NotificationService::TYPE_SUCCESS;
            $title = 'Ice Aktarma Tamamlandi';
            $message = "Toplam: {$total}, Eklenen: {$inserted}, Guncellenen: {$updated}, Hatali: {$failed}";
            $icon = $failed > 0 ? 'ti-alert-triangle' : 'ti-file-import';

            $service->sendToUser(
                $userId,
                $title,
                $message,
                [
                    'type' => $type,
                    'icon' => $icon,
                    'link' => '#/products',
                    'priority' => NotificationService::PRIORITY_NORMAL
                ]
            );

            Logger::info('NotificationTriggers: Import complete notification sent', [
                'user_id' => $userId,
                'total' => $total,
                'inserted' => $inserted,
                'updated' => $updated,
                'failed' => $failed
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send import complete notification', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when license is about to expire (can be called by cron)
     * Sends notification to all users in the company
     *
     * @param string $companyId Company ID
     * @param int $daysRemaining Days until license expires
     */
    public static function onLicenseExpiring(string $companyId, int $daysRemaining): void
    {
        try {
            $service = NotificationService::getInstance();

            if ($daysRemaining <= 0) {
                $title = 'Lisans Suresi Doldu';
                $message = 'Lisansinizin suresi doldu. Lutfen yenileme islemi yapin.';
                $type = NotificationService::TYPE_ERROR;
                $priority = NotificationService::PRIORITY_URGENT;
            } elseif ($daysRemaining <= 7) {
                $title = 'Lisans Suresi Dolmak Uzere';
                $message = "Lisansinizin suresinin dolmasina {$daysRemaining} gun kaldi. Lutfen yenileme islemi yapin.";
                $type = NotificationService::TYPE_WARNING;
                $priority = NotificationService::PRIORITY_HIGH;
            } else {
                $title = 'Lisans Hatirlatmasi';
                $message = "Lisansinizin suresinin dolmasina {$daysRemaining} gun kaldi.";
                $type = NotificationService::TYPE_INFO;
                $priority = NotificationService::PRIORITY_NORMAL;
            }

            $service->sendToCompany(
                $companyId,
                $title,
                $message,
                [
                    'type' => $type,
                    'icon' => 'ti-certificate',
                    'link' => '#/settings',
                    'priority' => $priority
                ]
            );

            Logger::info('NotificationTriggers: License expiring notification sent', [
                'company_id' => $companyId,
                'days_remaining' => $daysRemaining
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send license expiring notification', [
                'company_id' => $companyId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when device goes offline (can be called by monitoring)
     * Sends notification to company admins
     *
     * @param array $device Device data with 'id', 'name', 'device_id', 'company_id' keys
     */
    public static function onDeviceOffline(array $device): void
    {
        try {
            $service = NotificationService::getInstance();

            $deviceName = $device['name'] ?? 'Bilinmeyen Cihaz';
            $deviceId = $device['device_id'] ?? $device['id'] ?? '';
            $companyId = $device['company_id'] ?? null;

            if (!$companyId) {
                Logger::warning('NotificationTriggers: Device offline - no company_id', [
                    'device' => $device
                ]);
                return;
            }

            $service->sendToRole(
                'Admin',
                'Cihaz Cevrimdisi',
                "{$deviceName} ({$deviceId}) cihazi cevrimdisi oldu.",
                [
                    'company_id' => $companyId,
                    'type' => NotificationService::TYPE_ERROR,
                    'icon' => 'ti-wifi-off',
                    'link' => '#/devices/' . ($device['id'] ?? ''),
                    'priority' => NotificationService::PRIORITY_HIGH
                ]
            );

            Logger::info('NotificationTriggers: Device offline notification sent', [
                'device_id' => $deviceId,
                'company_id' => $companyId
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send device offline notification', [
                'device' => $device,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when device comes back online
     * Sends notification to company admins
     *
     * @param array $device Device data with 'id', 'name', 'device_id', 'company_id' keys
     */
    public static function onDeviceOnline(array $device): void
    {
        try {
            $service = NotificationService::getInstance();

            $deviceName = $device['name'] ?? 'Bilinmeyen Cihaz';
            $deviceId = $device['device_id'] ?? $device['id'] ?? '';
            $companyId = $device['company_id'] ?? null;

            if (!$companyId) {
                return;
            }

            $service->sendToRole(
                'Admin',
                'Cihaz Cevrimici',
                "{$deviceName} ({$deviceId}) cihazi tekrar cevrimici oldu.",
                [
                    'company_id' => $companyId,
                    'type' => NotificationService::TYPE_SUCCESS,
                    'icon' => 'ti-wifi',
                    'link' => '#/devices/' . ($device['id'] ?? ''),
                    'priority' => NotificationService::PRIORITY_LOW
                ]
            );

            Logger::info('NotificationTriggers: Device online notification sent', [
                'device_id' => $deviceId,
                'company_id' => $companyId
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send device online notification', [
                'device' => $device,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when scheduled content fails to play
     * Sends notification to company admins
     *
     * @param array $schedule Schedule data with 'id', 'name', 'company_id' keys
     * @param string $error Error message
     */
    public static function onScheduleError(array $schedule, string $error): void
    {
        try {
            $service = NotificationService::getInstance();

            $scheduleName = $schedule['name'] ?? 'Bilinmeyen Zamanlama';
            $companyId = $schedule['company_id'] ?? null;

            if (!$companyId) {
                Logger::warning('NotificationTriggers: Schedule error - no company_id', [
                    'schedule' => $schedule
                ]);
                return;
            }

            $service->sendToRole(
                'Admin',
                'Zamanlama Hatasi',
                "'{$scheduleName}' zamanlamasi calistirilamadi: {$error}",
                [
                    'company_id' => $companyId,
                    'type' => NotificationService::TYPE_ERROR,
                    'icon' => 'ti-calendar-x',
                    'link' => '#/signage/schedules/' . ($schedule['id'] ?? ''),
                    'priority' => NotificationService::PRIORITY_HIGH
                ]
            );

            Logger::info('NotificationTriggers: Schedule error notification sent', [
                'schedule_id' => $schedule['id'] ?? null,
                'error' => $error
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send schedule error notification', [
                'schedule' => $schedule,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger system announcement to all users
     * Useful for maintenance notices, updates, etc.
     *
     * @param string $title Announcement title
     * @param string $message Announcement message
     * @param string $type Notification type (info, success, warning, error)
     * @param string|null $link Optional link
     */
    public static function systemAnnouncement(string $title, string $message, string $type = 'info', ?string $link = null): void
    {
        try {
            $service = NotificationService::getInstance();
            $db = Database::getInstance();

            // Get all companies
            $companies = $db->fetchAll("SELECT id FROM companies WHERE status = 'active'");

            foreach ($companies as $company) {
                $service->sendToCompany(
                    $company['id'],
                    $title,
                    $message,
                    [
                        'type' => $type,
                        'icon' => 'ti-speakerphone',
                        'link' => $link,
                        'priority' => NotificationService::PRIORITY_NORMAL
                    ]
                );
            }

            Logger::info('NotificationTriggers: System announcement sent', [
                'title' => $title,
                'company_count' => count($companies)
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send system announcement', [
                'title' => $title,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when user role is changed
     * Sends notification to the user
     *
     * @param string $userId User ID
     * @param string $oldRole Previous role
     * @param string $newRole New role
     */
    public static function onRoleChanged(string $userId, string $oldRole, string $newRole): void
    {
        try {
            $service = NotificationService::getInstance();

            $service->sendToUser(
                $userId,
                'Rol Degisikligi',
                "Rolunuz {$oldRole} yetkisinden {$newRole} yetkisine degistirildi.",
                [
                    'type' => NotificationService::TYPE_INFO,
                    'icon' => 'ti-user-cog',
                    'link' => '#/profile',
                    'priority' => NotificationService::PRIORITY_NORMAL
                ]
            );

            Logger::info('NotificationTriggers: Role change notification sent', [
                'user_id' => $userId,
                'old_role' => $oldRole,
                'new_role' => $newRole
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send role change notification', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when user account is deactivated
     * Sends notification to the user (if they can still receive it)
     *
     * @param string $userId User ID
     * @param string|null $reason Optional reason for deactivation
     */
    public static function onUserDeactivated(string $userId, ?string $reason = null): void
    {
        try {
            $service = NotificationService::getInstance();

            $message = 'Hesabiniz deaktif edildi.';
            if ($reason) {
                $message .= " Sebep: {$reason}";
            }
            $message .= ' Detayli bilgi icin yoneticinize basvurun.';

            $service->sendToUser(
                $userId,
                'Hesap Deaktif Edildi',
                $message,
                [
                    'type' => NotificationService::TYPE_WARNING,
                    'icon' => 'ti-user-x',
                    'priority' => NotificationService::PRIORITY_HIGH
                ]
            );

            Logger::info('NotificationTriggers: User deactivation notification sent', [
                'user_id' => $userId
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send user deactivation notification', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when a new product is added
     * Sends notification to company admins
     *
     * @param array $product Product data
     * @param string $companyId Company ID
     */
    public static function onProductCreated(array $product, string $companyId): void
    {
        try {
            $service = NotificationService::getInstance();

            $productName = $product['name'] ?? 'Bilinmeyen Urun';
            $sku = $product['sku'] ?? '';

            $service->sendToRole(
                'Admin',
                'Yeni Urun Eklendi',
                "'{$productName}' (SKU: {$sku}) urunu sisteme eklendi.",
                [
                    'company_id' => $companyId,
                    'type' => NotificationService::TYPE_INFO,
                    'icon' => 'ti-package',
                    'link' => '#/products',
                    'priority' => NotificationService::PRIORITY_LOW
                ]
            );
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send product created notification', [
                'product' => $product,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when storage limit is approaching
     * Sends notification to company admins
     *
     * @param string $companyId Company ID
     * @param int $usedMB Used storage in MB
     * @param int $limitMB Storage limit in MB
     */
    public static function onStorageLimitWarning(string $companyId, int $usedMB, int $limitMB): void
    {
        try {
            $service = NotificationService::getInstance();

            $percentage = round(($usedMB / $limitMB) * 100);

            if ($percentage >= 90) {
                $title = 'Depolama Alani Kritik';
                $type = NotificationService::TYPE_ERROR;
                $priority = NotificationService::PRIORITY_URGENT;
            } elseif ($percentage >= 75) {
                $title = 'Depolama Alani Azaliyor';
                $type = NotificationService::TYPE_WARNING;
                $priority = NotificationService::PRIORITY_HIGH;
            } else {
                return; // No notification needed below 75%
            }

            $message = "Depolama alaninizin %{$percentage}'i kullanimda ({$usedMB}MB / {$limitMB}MB).";

            $service->sendToRole(
                'Admin',
                $title,
                $message,
                [
                    'company_id' => $companyId,
                    'type' => $type,
                    'icon' => 'ti-database',
                    'link' => '#/settings',
                    'priority' => $priority
                ]
            );

            Logger::info('NotificationTriggers: Storage limit warning sent', [
                'company_id' => $companyId,
                'percentage' => $percentage
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send storage limit warning', [
                'company_id' => $companyId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when bulk delete operation completes
     * Sends notification to user who initiated
     *
     * @param string $userId User ID
     * @param string $entityType Type of entity deleted (products, devices, etc.)
     * @param int $count Number of items deleted
     */
    public static function onBulkDeleteComplete(string $userId, string $entityType, int $count): void
    {
        try {
            $service = NotificationService::getInstance();

            $entityNames = [
                'products' => 'urun',
                'devices' => 'cihaz',
                'templates' => 'sablon',
                'media' => 'medya dosyasi',
                'users' => 'kullanici'
            ];

            $entityName = $entityNames[$entityType] ?? 'kayit';

            $service->sendToUser(
                $userId,
                'Toplu Silme Tamamlandi',
                "{$count} adet {$entityName} basariyla silindi.",
                [
                    'type' => NotificationService::TYPE_SUCCESS,
                    'icon' => 'ti-trash',
                    'link' => '#/' . $entityType,
                    'priority' => NotificationService::PRIORITY_NORMAL
                ]
            );

            Logger::info('NotificationTriggers: Bulk delete notification sent', [
                'user_id' => $userId,
                'entity_type' => $entityType,
                'count' => $count
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send bulk delete notification', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when render jobs complete (label designs refreshed)
     * Sends user-friendly notification about design refresh
     *
     * @param string $userId User ID who initiated the action
     * @param string $source Source of render trigger ('erp', 'import', 'api', 'manual', 'queue')
     * @param int $designCount Number of designs refreshed
     * @param int $productCount Number of products affected
     * @param array $extra Optional extra data (erp_name, template_name, etc.)
     */
    public static function onRenderJobsComplete(string $userId, string $source, int $designCount, int $productCount = 0, array $extra = []): void
    {
        try {
            $service = NotificationService::getInstance();

            // User-friendly source names in Turkish
            $sourceNames = [
                'erp' => 'ERP senkronizasyonu',
                'tamsoft' => 'TAMSOFT ERP',
                'import' => 'ürün içe aktarma',
                'api' => 'API güncelleme',
                'manual' => 'manuel işlem',
                'queue' => 'gönderim kuyruğu',
                'bulk_send' => 'toplu gönderim'
            ];

            $sourceName = $sourceNames[$source] ?? $source;

            // Build user-friendly message based on source
            if ($source === 'erp' || $source === 'tamsoft') {
                $erpName = $extra['erp_name'] ?? 'ERP';
                if ($productCount > 0) {
                    $message = "{$erpName} ile güncellenen {$productCount} ürünün dijital etiket tasarımları yenilendi.";
                } else {
                    $message = "{$erpName} senkronizasyonu sonrası {$designCount} etiket tasarımı yenilendi.";
                }
                $title = 'ERP Etiket Tasarımları Güncellendi';
                $icon = 'ti-refresh';
            } elseif ($source === 'import') {
                if ($productCount > 0) {
                    $message = "İçe aktarılan {$productCount} ürünün dijital etiket tasarımları oluşturuldu.";
                } else {
                    $message = "Ürün içe aktarma sonrası {$designCount} etiket tasarımı oluşturuldu.";
                }
                $title = 'İçe Aktarma Tasarımları Hazır';
                $icon = 'ti-file-import';
            } elseif ($source === 'queue' || $source === 'bulk_send') {
                $message = "Gönderim kuyruğundaki {$designCount} etiket tasarımı başarıyla işlendi.";
                $title = 'Etiket Gönderimi Tamamlandı';
                $icon = 'ti-send';
            } elseif ($source === 'api') {
                if ($productCount > 0) {
                    $message = "Güncellenen {$productCount} ürünün dijital etiket tasarımları yenilendi.";
                } else {
                    $message = "{$designCount} etiket tasarımı güncellendi.";
                }
                $title = 'Etiket Tasarımları Güncellendi';
                $icon = 'ti-refresh';
            } else {
                $message = "{$designCount} dijital etiket tasarımı başarıyla yenilendi.";
                $title = 'Tasarımlar Yenilendi';
                $icon = 'ti-photo';
            }

            // Add template info if available
            if (!empty($extra['template_name'])) {
                $message .= " (Şablon: {$extra['template_name']})";
            }

            $service->sendToUser(
                $userId,
                $title,
                $message,
                [
                    'type' => NotificationService::TYPE_SUCCESS,
                    'icon' => $icon,
                    'link' => '#/queue',
                    'priority' => NotificationService::PRIORITY_NORMAL
                ]
            );

            Logger::info('NotificationTriggers: Render jobs complete notification sent', [
                'user_id' => $userId,
                'source' => $source,
                'design_count' => $designCount,
                'product_count' => $productCount
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send render jobs complete notification', [
                'user_id' => $userId,
                'source' => $source,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when tenant backup is completed
     *
     * @param string $companyId Company ID
     * @param array $result Backup result
     */
    public static function onTenantBackupCompleted(string $companyId, array $result): void
    {
        try {
            $service = NotificationService::getInstance();

            $tables = $result['tables'] ?? [];
            $totalRows = array_sum($tables);
            $fileSize = $result['file_size'] ?? 0;
            $sizeMB = round($fileSize / 1048576, 1);

            $service->sendToRole(
                'Admin',
                'Firma Yedeği Tamamlandı',
                "Firma yedeği başarıyla oluşturuldu. {$totalRows} kayıt, {$sizeMB} MB.",
                [
                    'company_id' => $companyId,
                    'type' => NotificationService::TYPE_SUCCESS,
                    'icon' => 'ti-database-export',
                    'link' => '#/admin/backups',
                    'priority' => NotificationService::PRIORITY_NORMAL
                ]
            );
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send backup completed notification', [
                'company_id' => $companyId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when tenant backup fails
     *
     * @param string $companyId Company ID
     * @param string $errorMessage Error message
     */
    public static function onTenantBackupFailed(string $companyId, string $errorMessage): void
    {
        try {
            $service = NotificationService::getInstance();

            $service->sendToRole(
                'Admin',
                'Firma Yedeği Başarısız',
                'Firma yedeği oluşturulamadı: ' . substr($errorMessage, 0, 200),
                [
                    'company_id' => $companyId,
                    'type' => NotificationService::TYPE_ERROR,
                    'icon' => 'ti-database-off',
                    'link' => '#/admin/backups',
                    'priority' => NotificationService::PRIORITY_HIGH
                ]
            );
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send backup failed notification', [
                'company_id' => $companyId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when tenant backup is completed
     *
     * @param string $companyId Company ID
     * @param array $result Backup result
     */
    public static function onTenantBackupCompleted(string $companyId, array $result): void
    {
        try {
            $service = NotificationService::getInstance();

            $tables = $result['tables'] ?? [];
            $totalRows = array_sum($tables);
            $fileSize = $result['file_size'] ?? 0;
            $sizeMB = round($fileSize / 1048576, 1);

            $service->sendToRole(
                'Admin',
                'Firma Yedeği Tamamlandı',
                "Firma yedeği başarıyla oluşturuldu. {$totalRows} kayıt, {$sizeMB} MB.",
                [
                    'company_id' => $companyId,
                    'type' => NotificationService::TYPE_SUCCESS,
                    'icon' => 'ti-database-export',
                    'link' => '#/admin/backups',
                    'priority' => NotificationService::PRIORITY_NORMAL
                ]
            );
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send backup completed notification', [
                'company_id' => $companyId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when tenant backup fails
     *
     * @param string $companyId Company ID
     * @param string $errorMessage Error message
     */
    public static function onTenantBackupFailed(string $companyId, string $errorMessage): void
    {
        try {
            $service = NotificationService::getInstance();

            $service->sendToRole(
                'Admin',
                'Firma Yedeği Başarısız',
                'Firma yedeği oluşturulamadı: ' . substr($errorMessage, 0, 200),
                [
                    'company_id' => $companyId,
                    'type' => NotificationService::TYPE_ERROR,
                    'icon' => 'ti-database-off',
                    'link' => '#/admin/backups',
                    'priority' => NotificationService::PRIORITY_HIGH
                ]
            );
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send backup failed notification', [
                'company_id' => $companyId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Trigger when render jobs fail
     * Sends notification about failed design rendering
     *
     * @param string $userId User ID
     * @param string $source Source of render trigger
     * @param int $failedCount Number of failed renders
     * @param string|null $errorMessage Optional error message
     */
    public static function onRenderJobsFailed(string $userId, string $source, int $failedCount, ?string $errorMessage = null): void
    {
        try {
            $service = NotificationService::getInstance();

            $sourceNames = [
                'erp' => 'ERP senkronizasyonu',
                'tamsoft' => 'TAMSOFT ERP',
                'import' => 'içe aktarma',
                'api' => 'API güncelleme',
                'queue' => 'gönderim kuyruğu'
            ];

            $sourceName = $sourceNames[$source] ?? $source;

            $message = "{$sourceName} sırasında {$failedCount} etiket tasarımı oluşturulamadı.";
            if ($errorMessage) {
                $message .= " Hata: " . substr($errorMessage, 0, 100);
            }

            $service->sendToUser(
                $userId,
                'Tasarım Oluşturma Hatası',
                $message,
                [
                    'type' => NotificationService::TYPE_WARNING,
                    'icon' => 'ti-alert-triangle',
                    'link' => '#/queue',
                    'priority' => NotificationService::PRIORITY_HIGH
                ]
            );

            Logger::info('NotificationTriggers: Render jobs failed notification sent', [
                'user_id' => $userId,
                'source' => $source,
                'failed_count' => $failedCount
            ]);
        } catch (Exception $e) {
            Logger::error('NotificationTriggers: Failed to send render jobs failed notification', [
                'user_id' => $userId,
                'error' => $e->getMessage()
            ]);
        }
    }
}
