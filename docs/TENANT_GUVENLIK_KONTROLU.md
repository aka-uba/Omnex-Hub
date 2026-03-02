# TENANT GÜVENLİK KONTROL RAPORU

**Oluşturulma Tarihi:** 2026-01-24 21:59:06

## 📊 ÖZET

- **Taranan Endpoint:** 165
- **İzolasyon Kontrolü Olan:** 106
- **Potansiyel Sorun:** 17

## ⚠️ TESPİT EDİLEN SORUNLAR

### `api/audit-logs/archive.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `audit_logs`

### `api/audit-logs/delete.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `audit_logs`

### `api/audit-logs/show.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `audit_logs`

### `api/esl/content.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `IS`
- `device_content_assignments`
- `media`
- `playlists`
- `playlist_items`

### `api/esl/register.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `devices`
- `device_sync_requests`

### `api/gateway/devices-register.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `devices`
- `gateway_devices`

### `api/gateway/register.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `gateways`
- `users`

### `api/licenses/create.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `licenses`

### `api/licenses/revoke.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `licenses`

### `api/licenses/update.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `licenses`

### `api/payments/callback.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `payment_transactions`

### `api/payments/license-plans.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `license_plans`
- `licenses`

### `api/payments/status.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `payment_transactions`
- `licenses`

### `api/player/init.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `devices`
- `templates`
- `device_content_assignments`
- `schedules`
- `playlists`
- `playlist_items`
- `media`

### `api/player/sync.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `devices`
- `schedules`
- `playlists`
- `playlist_items`
- `templates`
- `device_commands`

### `api/player/verify.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `device_sync_requests`
- `device_tokens`
- `devices`

### `api/system/status.php`

**Sorun:** company_id kontrolü eksik

**Kullanılan Tablolar:**
- `audit_logs`
- `sessions`

## 📋 TÜM ENDPOINT'LER

| Dosya | Company ID Kontrolü | getActiveCompanyId | İzolasyon Gerekli | Durum |
|-------|---------------------|-------------------|-------------------|-------|
| `archive.php` | ❌ | ❌ | ✅ | ⚠️ |
| `delete.php` | ❌ | ❌ | ✅ | ⚠️ |
| `index.php` | ✅ | ❌ | ✅ | ✅ |
| `show.php` | ❌ | ❌ | ✅ | ⚠️ |
| `change-password.php` | ❌ | ❌ | ❌ | ✅ |
| `forgot-password.php` | ❌ | ❌ | ❌ | ✅ |
| `login.php` | ❌ | ❌ | ❌ | ✅ |
| `logout.php` | ❌ | ❌ | ❌ | ✅ |
| `register.php` | ❌ | ❌ | ❌ | ✅ |
| `reset-password.php` | ❌ | ❌ | ❌ | ✅ |
| `session.php` | ❌ | ❌ | ❌ | ✅ |
| `create.php` | ✅ | ✅ | ✅ | ✅ |
| `delete.php` | ✅ | ✅ | ✅ | ✅ |
| `index.php` | ✅ | ✅ | ❌ | ✅ |
| `update.php` | ✅ | ✅ | ✅ | ✅ |
| `create.php` | ❌ | ❌ | ❌ | ✅ |
| `delete.php` | ✅ | ❌ | ❌ | ✅ |
| `index.php` | ❌ | ❌ | ❌ | ✅ |
| `show.php` | ✅ | ❌ | ✅ | ✅ |
| `update.php` | ❌ | ❌ | ❌ | ✅ |
| `upload-branding.php` | ❌ | ❌ | ❌ | ✅ |
| `bulk-action.php` | ✅ | ✅ | ✅ | ✅ |
| `create.php` | ✅ | ✅ | ❌ | ✅ |
| `delete.php` | ✅ | ✅ | ✅ | ✅ |
| `index.php` | ✅ | ✅ | ❌ | ✅ |
| `show.php` | ✅ | ✅ | ❌ | ✅ |
| `update.php` | ✅ | ✅ | ✅ | ✅ |
| `assign-playlist.php` | ✅ | ✅ | ✅ | ✅ |
| `control.php` | ✅ | ✅ | ✅ | ✅ |
| `create.php` | ✅ | ✅ | ✅ | ✅ |
| `delete.php` | ✅ | ✅ | ✅ | ✅ |
| `index.php` | ✅ | ✅ | ❌ | ✅ |
| `scan.php` | ✅ | ✅ | ✅ | ✅ |
| `send-command.php` | ✅ | ✅ | ✅ | ✅ |
| `show.php` | ✅ | ✅ | ✅ | ✅ |
| `update.php` | ✅ | ✅ | ✅ | ✅ |
| `sync.php` | ✅ | ❌ | ✅ | ✅ |
| `alert.php` | ❌ | ❌ | ❌ | ✅ |
| `approve.php` | ✅ | ✅ | ✅ | ✅ |
| `config.php` | ✅ | ❌ | ✅ | ✅ |
| `content.php` | ❌ | ❌ | ✅ | ⚠️ |
| `delete-pending.php` | ❌ | ❌ | ❌ | ✅ |
| `log.php` | ❌ | ❌ | ❌ | ✅ |
| `pending.php` | ❌ | ❌ | ❌ | ✅ |
| `ping.php` | ❌ | ❌ | ❌ | ✅ |
| `register.php` | ❌ | ❌ | ✅ | ⚠️ |
| `reject.php` | ❌ | ❌ | ❌ | ✅ |
| `command-result.php` | ❌ | ❌ | ❌ | ✅ |
| `devices-register.php` | ❌ | ❌ | ✅ | ⚠️ |
| `devices.php` | ✅ | ❌ | ✅ | ✅ |
| `heartbeat.php` | ❌ | ❌ | ❌ | ✅ |
| `register.php` | ❌ | ❌ | ✅ | ⚠️ |
| `create.php` | ✅ | ✅ | ❌ | ✅ |
| `delete.php` | ✅ | ✅ | ✅ | ✅ |
| `devices.php` | ✅ | ✅ | ✅ | ✅ |
| `index.php` | ✅ | ✅ | ❌ | ✅ |
| `send-command.php` | ✅ | ✅ | ✅ | ✅ |
| `show.php` | ✅ | ✅ | ❌ | ✅ |
| `update.php` | ✅ | ✅ | ✅ | ✅ |
| `query.php` | ✅ | ✅ | ✅ | ✅ |
| `settings.php` | ✅ | ✅ | ✅ | ✅ |
| `esls.php` | ✅ | ❌ | ✅ | ✅ |
| `firmwares.php` | ❌ | ❌ | ❌ | ✅ |
| `lookup.php` | ✅ | ❌ | ✅ | ✅ |
| `register.php` | ❌ | ❌ | ❌ | ✅ |
| `scan.php` | ✅ | ❌ | ✅ | ✅ |
| `send.php` | ✅ | ❌ | ✅ | ✅ |
| `settings.php` | ✅ | ❌ | ❌ | ✅ |
| `create.php` | ✅ | ✅ | ❌ | ✅ |
| `delete.php` | ✅ | ✅ | ❌ | ✅ |
| `index.php` | ✅ | ✅ | ❌ | ✅ |
| `update.php` | ✅ | ✅ | ❌ | ✅ |
| `config.php` | ✅ | ✅ | ❌ | ✅ |
| `menu.php` | ✅ | ✅ | ❌ | ✅ |
| `create.php` | ❌ | ❌ | ✅ | ⚠️ |
| `index.php` | ❌ | ❌ | ❌ | ✅ |
| `revoke.php` | ❌ | ❌ | ✅ | ⚠️ |
| `update.php` | ❌ | ❌ | ✅ | ⚠️ |
| `browse.php` | ❌ | ❌ | ❌ | ✅ |
| `delete.php` | ✅ | ✅ | ✅ | ✅ |
| `folders.php` | ✅ | ✅ | ❌ | ✅ |
| `index.php` | ✅ | ✅ | ✅ | ✅ |
| `scan.php` | ✅ | ❌ | ✅ | ✅ |
| `upload.php` | ✅ | ✅ | ✅ | ✅ |
| `archive.php` | ❌ | ❌ | ❌ | ✅ |
| `create.php` | ✅ | ✅ | ✅ | ✅ |
| `delete.php` | ❌ | ❌ | ❌ | ✅ |
| `index.php` | ✅ | ✅ | ❌ | ✅ |
| `mark-read.php` | ✅ | ✅ | ✅ | ✅ |
| `read.php` | ❌ | ❌ | ❌ | ✅ |
| `settings.php` | ❌ | ❌ | ❌ | ✅ |
| `unread-count.php` | ✅ | ✅ | ❌ | ✅ |
| `callback-3d.php` | ✅ | ❌ | ✅ | ✅ |
| `callback.php` | ❌ | ❌ | ✅ | ⚠️ |
| `history.php` | ❌ | ❌ | ❌ | ✅ |
| `init.php` | ✅ | ✅ | ❌ | ✅ |
| `installments.php` | ❌ | ❌ | ❌ | ✅ |
| `license-plans.php` | ❌ | ❌ | ✅ | ⚠️ |
| `ping.php` | ❌ | ❌ | ❌ | ✅ |
| `plans.php` | ❌ | ❌ | ❌ | ✅ |
| `settings.php` | ❌ | ❌ | ❌ | ✅ |
| `status.php` | ❌ | ❌ | ✅ | ⚠️ |
| `command-ack.php` | ❌ | ❌ | ❌ | ✅ |
| `content.php` | ✅ | ❌ | ✅ | ✅ |
| `heartbeat.php` | ❌ | ❌ | ❌ | ✅ |
| `init.php` | ❌ | ❌ | ✅ | ⚠️ |
| `register.php` | ❌ | ❌ | ❌ | ✅ |
| `sync.php` | ❌ | ❌ | ✅ | ⚠️ |
| `verify.php` | ❌ | ❌ | ✅ | ⚠️ |
| `create.php` | ✅ | ✅ | ✅ | ✅ |
| `delete.php` | ✅ | ✅ | ✅ | ✅ |
| `index.php` | ✅ | ✅ | ❌ | ✅ |
| `show.php` | ✅ | ✅ | ✅ | ✅ |
| `update.php` | ✅ | ✅ | ✅ | ✅ |
| `index.php` | ✅ | ✅ | ✅ | ✅ |
| `assign-label.php` | ✅ | ✅ | ✅ | ✅ |
| `delete.php` | ✅ | ✅ | ✅ | ✅ |
| `export.php` | ✅ | ✅ | ✅ | ✅ |
| `import.php` | ✅ | ✅ | ❌ | ✅ |
| `index.php` | ✅ | ✅ | ✅ | ✅ |
| `remove-label.php` | ✅ | ✅ | ✅ | ✅ |
| `show.php` | ✅ | ✅ | ✅ | ✅ |
| `store.php` | ✅ | ✅ | ✅ | ✅ |
| `update-label.php` | ✅ | ✅ | ✅ | ✅ |
| `update.php` | ✅ | ✅ | ✅ | ✅ |
| `check.php` | ✅ | ✅ | ✅ | ✅ |
| `index.php` | ✅ | ✅ | ❌ | ✅ |
| `process.php` | ✅ | ✅ | ✅ | ✅ |
| `analytics.php` | ✅ | ✅ | ✅ | ✅ |
| `auto.php` | ✅ | ✅ | ✅ | ✅ |
| `cancel.php` | ✅ | ✅ | ✅ | ✅ |
| `cleanup.php` | ✅ | ✅ | ❌ | ✅ |
| `create.php` | ✅ | ✅ | ✅ | ✅ |
| `delete.php` | ✅ | ✅ | ✅ | ✅ |
| `index.php` | ✅ | ✅ | ✅ | ✅ |
| `process.php` | ✅ | ✅ | ✅ | ✅ |
| `reschedule.php` | ✅ | ✅ | ✅ | ✅ |
| `retry.php` | ✅ | ✅ | ✅ | ✅ |
| `status.php` | ✅ | ✅ | ❌ | ✅ |
| `dashboard-stats.php` | ✅ | ✅ | ✅ | ✅ |
| `export.php` | ✅ | ✅ | ✅ | ✅ |
| `recent-activities.php` | ✅ | ✅ | ✅ | ✅ |
| `create.php` | ✅ | ✅ | ✅ | ✅ |
| `delete.php` | ✅ | ✅ | ✅ | ✅ |
| `index.php` | ✅ | ✅ | ❌ | ✅ |
| `show.php` | ✅ | ✅ | ✅ | ✅ |
| `update.php` | ✅ | ✅ | ✅ | ✅ |
| `index.php` | ✅ | ✅ | ✅ | ✅ |
| `about.php` | ❌ | ❌ | ❌ | ✅ |
| `status.php` | ❌ | ❌ | ✅ | ⚠️ |
| `create.php` | ✅ | ✅ | ❌ | ✅ |
| `delete.php` | ✅ | ✅ | ✅ | ✅ |
| `export.php` | ✅ | ✅ | ✅ | ✅ |
| `import.php` | ✅ | ✅ | ✅ | ✅ |
| `index.php` | ✅ | ✅ | ❌ | ✅ |
| `render.php` | ✅ | ✅ | ✅ | ✅ |
| `show.php` | ✅ | ✅ | ✅ | ✅ |
| `update.php` | ✅ | ✅ | ✅ | ✅ |
| `create.php` | ❌ | ❌ | ❌ | ✅ |
| `delete.php` | ❌ | ❌ | ❌ | ✅ |
| `index.php` | ✅ | ✅ | ❌ | ✅ |
| `profile.php` | ❌ | ❌ | ❌ | ✅ |
| `show.php` | ❌ | ❌ | ❌ | ✅ |
| `update.php` | ❌ | ❌ | ❌ | ✅ |
| `upload-avatar.php` | ❌ | ❌ | ❌ | ✅ |
