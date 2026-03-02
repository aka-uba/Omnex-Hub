-- VERİTABANI ŞEMA FARK ANALİZİ RAPORU
-- Oluşturulma Tarihi: 2026-01-24 22:58:28

========================================
1. TABLO KARŞILAŞTIRMASI
========================================

Toplam Tablo Sayısı: 58
- Mevcut Veritabanında: 55
- Migration'larda: 56
- API'de Kullanılan: 46

⚠️  Migration'da tanımlı ama mevcut veritabanında OLMAYAN tablolar:
   - import_logs
   - render_cache
   - render_jobs

⚠️  Mevcut veritabanında var ama migration'da OLMAYAN tablolar:
   - migrations
   - settings_backup

ℹ️  Mevcut veritabanında var ama API'de KULLANILMAYAN tablolar:
   - hanshow_aps
   - hanshow_queue
   - import_mappings
   - integrations
   - migrations
   - notification_settings
   - payment_settings
   - settings_backup
   - user_notification_preferences

========================================
2. KOLON KARŞILAŞTIRMASI
========================================

--- Tablo: audit_logs ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - resource
   - resource_id
   - old_data
   - new_data
   - status
⚠️  Mevcut DB'de var ama migration'da yok:
   - entity_type
   - entity_id
   - old_values
   - new_values
   - created_at
ℹ️  Mevcut DB'de var ama API'de kullanılmıyor:
   - id
   - company_id
   - entity_id
   - old_values
   - new_values
   - ip_address
   - user_agent
   - created_at
   - archived_at
   - archived_by

--- Tablo: categories ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - color
   - icon
   - image_url
   - product_count
   - status
⚠️  Mevcut DB'de var ama migration'da yok:
   - created_at
   - updated_at

--- Tablo: companies ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
⚠️  Mevcut DB'de var ama migration'da yok:
   - settings
   - created_at
   - updated_at

--- Tablo: device_alerts ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
ℹ️  Mevcut DB'de var ama API'de kullanılmıyor:
   - device_id
   - alert_type
   - severity
   - title
   - message
   - created_at

--- Tablo: device_commands ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - payload
   - DEFAULT
ℹ️  Mevcut DB'de var ama API'de kullanılmıyor:
   - device_id
   - created_by
   - executed_at
   - result
   - created_at

--- Tablo: device_content_assignments ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT

--- Tablo: device_group_members ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - DEFAULT
ℹ️  Mevcut DB'de var ama API'de kullanılmıyor:
   - id
   - group_id
   - created_at

--- Tablo: device_groups ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - color
   - device_type
   - created_by
   - DEFAULT

--- Tablo: device_heartbeats ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
ℹ️  Mevcut DB'de var ama API'de kullanılmıyor:
   - id
   - device_id
   - status
   - current_item
   - battery_level
   - signal_strength
   - ip_address
   - created_at
   - memory_usage
   - cpu_usage
   ... ve 5 kolon daha

--- Tablo: device_logs ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
⚠️  Mevcut DB'de var ama migration'da yok:
   - content_type
   - content_id
   - status
   - request_data
   - response_data
   - error_message
   - duration_ms
   - created_at

--- Tablo: device_sync_requests ---
⚠️  Mevcut DB'de var ama migration'da yok:
   - updated_at
   - expires_at
   - approved_by
   - approved_at
   - rejection_reason
   - device_id

--- Tablo: device_tokens ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
⚠️  Mevcut DB'de var ama migration'da yok:
   - expires_at
   - last_used_at
   - is_revoked
   - revoked_at
   - revoked_reason
   - ip_address
   - user_agent
ℹ️  Mevcut DB'de var ama API'de kullanılmıyor:
   - id
   - device_id
   - token_type
   - created_at
   - expires_at
   - last_used_at
   - is_revoked
   - revoked_at
   - revoked_reason
   - ip_address
   ... ve 2 kolon daha

--- Tablo: devices ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
⚠️  Mevcut DB'de var ama migration'da yok:
   - mac_address
   - ip_address
   - device_id
   - model
   - manufacturer
   - firmware_version
   - orientation
   - current_template_id
   - current_content
   - last_sync
   - last_online
   - last_seen
   - status
   - battery_level
   - signal_strength
   - error_message
   - metadata
   - created_at
   - updated_at

--- Tablo: firmware_updates ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - web_display
   - TEXT
   - Download
   - for
   - file
   - Release
   - Minimum
   - upgrade
   - Maximum
   - this
   - applies
   - File
   - in
   - MD5
   - SHA256
   - Force
   - disable
   - DEFAULT
⚠️  Mevcut DB'de var ama migration'da yok:
   - notes
ℹ️  Mevcut DB'de var ama API'de kullanılmıyor:
   - id
   - company_id
   - device_type
   - min_version
   - max_version
   - file_size
   - checksum
   - is_mandatory
   - is_active
   - released_at
   ... ve 3 kolon daha

--- Tablo: gateway_commands ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - NULL
   - in
   - Komut
   - JSON
   - Durum
   - TEXT
⚠️  Mevcut DB'de var ama migration'da yok:
   - result
   - error_message
   - created_at
   - sent_at
   - completed_at
   - expires_at

--- Tablo: gateway_devices ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - n
   - daki
   - Durum
   - TEXT
⚠️  Mevcut DB'de var ama migration'da yok:
   - last_seen
   - last_error
   - created_at
   - updated_at

--- Tablo: gateways ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - Kimlik
   - rulama
   - _key
   - Gateway
   - Durum
   - TEXT
⚠️  Mevcut DB'de var ama migration'da yok:
   - api_key
   - last_heartbeat
   - last_error
   - config
   - created_at
   - updated_at

--- Tablo: hanshow_esls ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - Hanshow
   - XX
⚠️  Mevcut DB'de var ama migration'da yok:
   - firmware_id
   - model_name
   - screen_width
   - screen_height
   - screen_color
   - screen_type
   - max_pages
   - has_led
   - has_magnet
   - current_template_id
   - current_product_id
   - last_sync_at
   - last_heartbeat_at
   - status
   - battery_level
   - ap_mac
   - sales_no
   - created_at
   - updated_at

--- Tablo: hanshow_firmwares ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - Hanshow
   - ID
   - TEXT
   - Model
   - page
   - SEGMENT_CODE
   - _type
   - LCD
   - _x
   - BWRY
   - _size
⚠️  Mevcut DB'de var ama migration'da yok:
   - name
   - screen_type
   - resolution_x
   - screen_size

--- Tablo: hanshow_settings ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - Hanshow
   - identifier
   - _url
   - Async
   - URL
   - _priority
   - Saniye
   - _retry
⚠️  Mevcut DB'de var ama migration'da yok:
   - callback_url
   - default_priority
   - auto_retry
   - updated_at

--- Tablo: label_sizes ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
⚠️  Mevcut DB'de var ama migration'da yok:
   - is_default
   - is_active
   - sort_order
   - created_at
   - updated_at

--- Tablo: layout_configs ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
⚠️  Mevcut DB'de var ama migration'da yok:
   - scope_id
   - config
   - created_at
   - updated_at

--- Tablo: license_plans ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - Plan
⚠️  Mevcut DB'de var ama migration'da yok:
   - slug
   - description
   - plan_type
   - duration_months
   - price
   - currency
   - max_users
   - max_devices
   - max_products
   - max_templates
   - features
   - is_popular
   - is_enterprise
   - sort_order
   - status
   - created_at
   - updated_at
   - is_active

--- Tablo: licenses ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
⚠️  Mevcut DB'de var ama migration'da yok:
   - max_devices
   - features
   - valid_from
   - valid_until
   - status
   - created_at

--- Tablo: media ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
⚠️  Mevcut DB'de var ama migration'da yok:
   - mime_type
   - file_size
   - width
   - height
   - duration
   - thumbnail
   - alt_text
   - description
   - tags
   - metadata
   - source
   - source_url
   - status
   - uploaded_by
   - created_at
   - updated_at

--- Tablo: media_folders ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
⚠️  Mevcut DB'de var ama migration'da yok:
   - updated_at

--- Tablo: menu_items ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
⚠️  Mevcut DB'de var ama migration'da yok:
   - label
   - href
   - icon
   - order_index
   - roles
   - visible
   - created_at

--- Tablo: notification_recipients ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - deleted
   - _at
   - created_at
   - DEFAULT
⚠️  Mevcut DB'de var ama migration'da yok:
   - read_at
ℹ️  Mevcut DB'de var ama API'de kullanılmıyor:
   - notification_id
   - user_id
   - read_at
   - archived_at
   - deleted_at

--- Tablo: notifications ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - user_id
   - NOT
   - error
   - Optional
   - to
   - all
   - _id
   - role
   - or
   - for
   - JSON
   - urgent
   - _at
   - DEFAULT
⚠️  Mevcut DB'de var ama migration'da yok:
   - target_id
   - action_url

--- Tablo: payment_transactions ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - Odemeyi
   - kullanici
   - _id
   - Iliskili
⚠️  Mevcut DB'de var ama migration'da yok:
   - license_id
   - transaction_type
   - amount
   - currency
   - status
   - provider
   - provider_transaction_id
   - provider_payment_id
   - basket_id
   - conversation_id
   - card_type
   - card_association
   - card_family
   - card_last_four
   - installment
   - paid_price
   - merchant_commission
   - iyzico_commission
   - buyer_email
   - buyer_name
   - buyer_phone
   - buyer_address
   - buyer_city
   - buyer_country
   - buyer_ip
   - billing_address
   - billing_city
   - billing_country
   - error_code
   - error_message
   - error_group
   - raw_request
   - raw_response
   - callback_data
   - metadata
   - paid_at
   - created_at
   - updated_at

--- Tablo: permissions ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
ℹ️  Mevcut DB'de var ama API'de kullanılmıyor:
   - id
   - role
   - created_at

--- Tablo: playlist_items ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - content_type
⚠️  Mevcut DB'de var ama migration'da yok:
   - template_id
   - sort_order
   - duration
   - transition
   - created_at
ℹ️  Mevcut DB'de var ama API'de kullanılmıyor:
   - id
   - playlist_id
   - media_id
   - template_id
   - sort_order
   - duration
   - transition
   - created_at

--- Tablo: playlists ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - loop_count
   - transition
   - transition_duration
⚠️  Mevcut DB'de var ama migration'da yok:
   - item_count
   - created_at
   - updated_at

--- Tablo: price_history ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
⚠️  Mevcut DB'de var ama migration'da yok:
   - source
   - created_at
ℹ️  Mevcut DB'de var ama API'de kullanılmıyor:
   - id
   - product_id
   - created_at

--- Tablo: production_types ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
⚠️  Mevcut DB'de var ama migration'da yok:
   - created_at
   - updated_at

--- Tablo: products ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - production_type
   - price_updated_at
   - previous_price_updated_at
   - storage_info
   - version
   - last_rendered_at
   - render_status
⚠️  Mevcut DB'de var ama migration'da yok:
   - created_at
   - updated_at

--- Tablo: render_priority_weights ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT

--- Tablo: render_queue ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - Job
   - scheduled_send
   - TEXT
   - NULL
   - Hedef
   - JSON
   - of
   - IDs
   - _count
   - Render
   - Durum
   - cancelled
   - INTEGER
   - 100
   - lenen
   - Delta
   - ile
   - Retry
   - ve
   - reler
   - device
   - Zamanlama
   - _at
   - ilse
   - Meta
   - _by
⚠️  Mevcut DB'de var ama migration'da yok:
   - priority
   - device_count
   - progress
   - scheduled_at
   - created_by
   - updated_at

--- Tablo: render_queue_items ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - Durum
   - TEXT
   - NULL
   - Retry
   - _count
   - Sonraki
   - Delta
   - nderilen
   - n
   - Zamanlama
   - _at
   - lem
⚠️  Mevcut DB'de var ama migration'da yok:
   - status
   - retry_count
   - started_at
   - created_at

--- Tablo: render_retry_policies ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
ℹ️  Mevcut DB'de var ama API'de kullanılmıyor:
   - id
   - error_type
   - max_retries
   - base_delay_seconds
   - max_delay_seconds
   - backoff_multiplier
   - description

--- Tablo: schedule_devices ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - status
ℹ️  Mevcut DB'de var ama API'de kullanılmıyor:
   - id
   - schedule_id

--- Tablo: schedules ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - description
   - target_type
⚠️  Mevcut DB'de var ama migration'da yok:
   - playlist_id
   - start_date
   - end_date
   - start_time
   - end_time
   - days_of_week
   - status
   - priority
   - created_at
   - updated_at

--- Tablo: sessions ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
ℹ️  Mevcut DB'de var ama API'de kullanılmıyor:
   - id
   - user_id
   - token_hash
   - refresh_token_hash
   - ip_address
   - user_agent
   - last_activity
   - expires_at
   - created_at

--- Tablo: settings ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
⚠️  Mevcut DB'de var ama migration'da yok:
   - updated_at

--- Tablo: templates ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
   - last_modified_at
⚠️  Mevcut DB'de var ama migration'da yok:
   - category
   - width
   - height
   - orientation
   - design_data
   - preview_image
   - parent_id
   - is_default
   - is_public
   - status
   - created_by
   - created_at
   - updated_at

--- Tablo: users ---
⚠️  Migration'da var ama mevcut DB'de yok:
   - NOT
⚠️  Mevcut DB'de var ama migration'da yok:
   - status
   - activation_token
   - activation_expires
   - password_reset_token
   - password_reset_expires
   - last_login
   - last_ip
   - last_user_agent
   - preferences
   - created_at
   - updated_at
   - reset_token
   - reset_token_expires

========================================
3. ÖZET İSTATİSTİKLER
========================================

Tablolar:
  - Mevcut DB'de: 55
  - Migration'da: 56
  - API'de kullanılan: 46
  - Ortak tablolar: 46

Kolonlar:
  - Mevcut DB'de: 808
  - Migration'da: 764
  - API'de kullanılan: 599

