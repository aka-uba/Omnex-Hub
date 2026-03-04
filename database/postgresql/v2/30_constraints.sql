-- Foreign key constraints generated from SQLite metadata
-- Applied after all tables are created to avoid dependency ordering issues.

ALTER TABLE "branch"."branch_import_logs"
  ADD CONSTRAINT "fk_branch_import_logs_created_by_users" FOREIGN KEY ("created_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "branch"."branch_import_logs"
  ADD CONSTRAINT "fk_branch_import_logs_branch_id_branches" FOREIGN KEY ("branch_id") REFERENCES "branch"."branches" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "branch"."branch_import_logs"
  ADD CONSTRAINT "fk_branch_import_logs_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "branch"."branch_price_history"
  ADD CONSTRAINT "fk_branch_price_history_changed_by_users" FOREIGN KEY ("changed_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "branch"."branch_price_history"
  ADD CONSTRAINT "fk_branch_price_history_branch_id_branches" FOREIGN KEY ("branch_id") REFERENCES "branch"."branches" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "branch"."branch_price_history"
  ADD CONSTRAINT "fk_branch_price_history_product_id_products" FOREIGN KEY ("product_id") REFERENCES "catalog"."products" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "branch"."branches"
  ADD CONSTRAINT "fk_branches_manager_user_id_users" FOREIGN KEY ("manager_user_id") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "branch"."branches"
  ADD CONSTRAINT "fk_branches_parent_id_branches" FOREIGN KEY ("parent_id") REFERENCES "branch"."branches" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "branch"."branches"
  ADD CONSTRAINT "fk_branches_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "branch"."bundle_branch_overrides"
  ADD CONSTRAINT "fk_bundle_branch_overrides_deleted_by_users" FOREIGN KEY ("deleted_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "branch"."bundle_branch_overrides"
  ADD CONSTRAINT "fk_bundle_branch_overrides_updated_by_users" FOREIGN KEY ("updated_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "branch"."bundle_branch_overrides"
  ADD CONSTRAINT "fk_bundle_branch_overrides_created_by_users" FOREIGN KEY ("created_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "branch"."bundle_branch_overrides"
  ADD CONSTRAINT "fk_bundle_branch_overrides_branch_id_branches" FOREIGN KEY ("branch_id") REFERENCES "branch"."branches" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "branch"."bundle_branch_overrides"
  ADD CONSTRAINT "fk_bundle_branch_overrides_bundle_id_bundles" FOREIGN KEY ("bundle_id") REFERENCES "catalog"."bundles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "branch"."bundle_branch_price_history"
  ADD CONSTRAINT "fk_bundle_branch_price_history_changed_by_users" FOREIGN KEY ("changed_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "branch"."bundle_branch_price_history"
  ADD CONSTRAINT "fk_bundle_branch_price_history_branch_id_branches" FOREIGN KEY ("branch_id") REFERENCES "branch"."branches" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "branch"."bundle_branch_price_history"
  ADD CONSTRAINT "fk_bundle_branch_price_history_bundle_id_bundles" FOREIGN KEY ("bundle_id") REFERENCES "catalog"."bundles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "catalog"."bundle_items"
  ADD CONSTRAINT "fk_bundle_items_product_id_products" FOREIGN KEY ("product_id") REFERENCES "catalog"."products" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "catalog"."bundle_items"
  ADD CONSTRAINT "fk_bundle_items_bundle_id_bundles" FOREIGN KEY ("bundle_id") REFERENCES "catalog"."bundles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "catalog"."bundle_price_history"
  ADD CONSTRAINT "fk_bundle_price_history_bundle_id_bundles" FOREIGN KEY ("bundle_id") REFERENCES "catalog"."bundles" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "catalog"."bundles"
  ADD CONSTRAINT "fk_bundles_created_by_users" FOREIGN KEY ("created_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "catalog"."bundles"
  ADD CONSTRAINT "fk_bundles_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "catalog"."categories"
  ADD CONSTRAINT "fk_categories_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "media"."company_storage_usage"
  ADD CONSTRAINT "fk_company_storage_usage_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."device_alerts"
  ADD CONSTRAINT "fk_device_alerts_device_id_devices" FOREIGN KEY ("device_id") REFERENCES "devices"."devices" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."device_commands"
  ADD CONSTRAINT "fk_device_commands_device_id_devices" FOREIGN KEY ("device_id") REFERENCES "devices"."devices" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."device_content_assignments"
  ADD CONSTRAINT "fk_device_content_assignments_device_id_devices" FOREIGN KEY ("device_id") REFERENCES "devices"."devices" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."device_group_members"
  ADD CONSTRAINT "fk_device_group_members_device_id_devices" FOREIGN KEY ("device_id") REFERENCES "devices"."devices" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."device_group_members"
  ADD CONSTRAINT "fk_device_group_members_group_id_device_groups" FOREIGN KEY ("group_id") REFERENCES "devices"."device_groups" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."device_groups"
  ADD CONSTRAINT "fk_device_groups_parent_id_device_groups" FOREIGN KEY ("parent_id") REFERENCES "devices"."device_groups" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "devices"."device_groups"
  ADD CONSTRAINT "fk_device_groups_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."device_heartbeats"
  ADD CONSTRAINT "fk_device_heartbeats_device_id_devices" FOREIGN KEY ("device_id") REFERENCES "devices"."devices" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."device_logs"
  ADD CONSTRAINT "fk_device_logs_device_id_devices" FOREIGN KEY ("device_id") REFERENCES "devices"."devices" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."device_sync_requests"
  ADD CONSTRAINT "fk_device_sync_requests_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."device_tokens"
  ADD CONSTRAINT "fk_device_tokens_device_id_devices" FOREIGN KEY ("device_id") REFERENCES "devices"."devices" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."devices"
  ADD CONSTRAINT "fk_devices_current_template_id_templates" FOREIGN KEY ("current_template_id") REFERENCES "labels"."templates" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "devices"."devices"
  ADD CONSTRAINT "fk_devices_group_id_device_groups" FOREIGN KEY ("group_id") REFERENCES "devices"."device_groups" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "devices"."devices"
  ADD CONSTRAINT "fk_devices_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."devices"
  ADD CONSTRAINT "fk_devices_branch_id_branches" FOREIGN KEY ("branch_id") REFERENCES "branch"."branches" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "devices"."firmware_updates"
  ADD CONSTRAINT "fk_firmware_updates_created_by_users" FOREIGN KEY ("created_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "devices"."firmware_updates"
  ADD CONSTRAINT "fk_firmware_updates_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."gateway_commands"
  ADD CONSTRAINT "fk_gateway_commands_device_id_devices" FOREIGN KEY ("device_id") REFERENCES "devices"."devices" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "devices"."gateway_commands"
  ADD CONSTRAINT "fk_gateway_commands_gateway_id_gateways" FOREIGN KEY ("gateway_id") REFERENCES "devices"."gateways" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."gateway_devices"
  ADD CONSTRAINT "fk_gateway_devices_device_id_devices" FOREIGN KEY ("device_id") REFERENCES "devices"."devices" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."gateway_devices"
  ADD CONSTRAINT "fk_gateway_devices_gateway_id_gateways" FOREIGN KEY ("gateway_id") REFERENCES "devices"."gateways" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."gateways"
  ADD CONSTRAINT "fk_gateways_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "integration"."hal_distribution_logs"
  ADD CONSTRAINT "fk_hal_distribution_logs_product_id_products" FOREIGN KEY ("product_id") REFERENCES "catalog"."products" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "integration"."hal_distribution_logs"
  ADD CONSTRAINT "fk_hal_distribution_logs_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."hanshow_aps"
  ADD CONSTRAINT "fk_hanshow_aps_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."hanshow_esls"
  ADD CONSTRAINT "fk_hanshow_esls_current_product_id_products" FOREIGN KEY ("current_product_id") REFERENCES "catalog"."products" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "devices"."hanshow_esls"
  ADD CONSTRAINT "fk_hanshow_esls_current_template_id_templates" FOREIGN KEY ("current_template_id") REFERENCES "labels"."templates" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "devices"."hanshow_esls"
  ADD CONSTRAINT "fk_hanshow_esls_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."hanshow_queue"
  ADD CONSTRAINT "fk_hanshow_queue_template_id_templates" FOREIGN KEY ("template_id") REFERENCES "labels"."templates" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "devices"."hanshow_queue"
  ADD CONSTRAINT "fk_hanshow_queue_product_id_products" FOREIGN KEY ("product_id") REFERENCES "catalog"."products" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "devices"."hanshow_queue"
  ADD CONSTRAINT "fk_hanshow_queue_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."hanshow_settings"
  ADD CONSTRAINT "fk_hanshow_settings_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "integration"."integration_settings_audit"
  ADD CONSTRAINT "fk_integration_settings_audit_integration_settings_id__5fa21329" FOREIGN KEY ("integration_settings_id") REFERENCES "integration"."integration_settings" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "integration"."integrations"
  ADD CONSTRAINT "fk_integrations_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "labels"."label_sizes"
  ADD CONSTRAINT "fk_label_sizes_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "license"."license_device_pricing"
  ADD CONSTRAINT "fk_license_device_pricing_license_id_licenses" FOREIGN KEY ("license_id") REFERENCES "license"."licenses" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "license"."licenses"
  ADD CONSTRAINT "fk_licenses_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "license"."licenses"
  ADD CONSTRAINT "fk_licenses_plan_id_license_plans" FOREIGN KEY ("plan_id") REFERENCES "license"."license_plans" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "media"."media"
  ADD CONSTRAINT "fk_media_uploaded_by_users" FOREIGN KEY ("uploaded_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "media"."media"
  ADD CONSTRAINT "fk_media_folder_id_media_folders" FOREIGN KEY ("folder_id") REFERENCES "media"."media_folders" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "media"."media"
  ADD CONSTRAINT "fk_media_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "media"."media_folders"
  ADD CONSTRAINT "fk_media_folders_parent_id_media_folders" FOREIGN KEY ("parent_id") REFERENCES "media"."media_folders" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "media"."media_folders"
  ADD CONSTRAINT "fk_media_folders_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "devices"."mqtt_settings"
  ADD CONSTRAINT "fk_mqtt_settings_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "audit"."notification_recipients"
  ADD CONSTRAINT "fk_notification_recipients_notification_id_notifications" FOREIGN KEY ("notification_id") REFERENCES "audit"."notifications" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "audit"."tenant_backups"
  ADD CONSTRAINT "fk_tenant_backups_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "audit"."tenant_backups"
  ADD CONSTRAINT "fk_tenant_backups_created_by_users" FOREIGN KEY ("created_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "license"."payment_settings"
  ADD CONSTRAINT "fk_payment_settings_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "license"."payment_transactions"
  ADD CONSTRAINT "fk_payment_transactions_license_id_licenses" FOREIGN KEY ("license_id") REFERENCES "license"."licenses" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "license"."payment_transactions"
  ADD CONSTRAINT "fk_payment_transactions_user_id_users" FOREIGN KEY ("user_id") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "license"."payment_transactions"
  ADD CONSTRAINT "fk_payment_transactions_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "signage"."playlist_items"
  ADD CONSTRAINT "fk_playlist_items_playlist_id_playlists" FOREIGN KEY ("playlist_id") REFERENCES "signage"."playlists" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "signage"."playlists"
  ADD CONSTRAINT "fk_playlists_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "catalog"."price_history"
  ADD CONSTRAINT "fk_price_history_product_id_products" FOREIGN KEY ("product_id") REFERENCES "catalog"."products" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "integration"."product_branch_hal_overrides"
  ADD CONSTRAINT "fk_product_branch_hal_overrides_hal_data_id_product_hal_data" FOREIGN KEY ("hal_data_id") REFERENCES "integration"."product_hal_data" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "branch"."product_branch_overrides"
  ADD CONSTRAINT "fk_product_branch_overrides_deleted_by_users" FOREIGN KEY ("deleted_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "branch"."product_branch_overrides"
  ADD CONSTRAINT "fk_product_branch_overrides_updated_by_users" FOREIGN KEY ("updated_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "branch"."product_branch_overrides"
  ADD CONSTRAINT "fk_product_branch_overrides_created_by_users" FOREIGN KEY ("created_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "branch"."product_branch_overrides"
  ADD CONSTRAINT "fk_product_branch_overrides_branch_id_branches" FOREIGN KEY ("branch_id") REFERENCES "branch"."branches" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "branch"."product_branch_overrides"
  ADD CONSTRAINT "fk_product_branch_overrides_product_id_products" FOREIGN KEY ("product_id") REFERENCES "catalog"."products" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "integration"."product_hal_data"
  ADD CONSTRAINT "fk_product_hal_data_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "integration"."product_hal_data"
  ADD CONSTRAINT "fk_product_hal_data_product_id_products" FOREIGN KEY ("product_id") REFERENCES "catalog"."products" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "labels"."product_renders"
  ADD CONSTRAINT "fk_product_renders_template_id_templates" FOREIGN KEY ("template_id") REFERENCES "labels"."templates" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "labels"."product_renders"
  ADD CONSTRAINT "fk_product_renders_product_id_products" FOREIGN KEY ("product_id") REFERENCES "catalog"."products" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "labels"."product_renders"
  ADD CONSTRAINT "fk_product_renders_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "catalog"."production_types"
  ADD CONSTRAINT "fk_production_types_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "catalog"."products"
  ADD CONSTRAINT "fk_products_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "labels"."render_queue"
  ADD CONSTRAINT "fk_render_queue_created_by_users" FOREIGN KEY ("created_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "labels"."render_queue"
  ADD CONSTRAINT "fk_render_queue_product_id_products" FOREIGN KEY ("product_id") REFERENCES "catalog"."products" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "labels"."render_queue"
  ADD CONSTRAINT "fk_render_queue_template_id_templates" FOREIGN KEY ("template_id") REFERENCES "labels"."templates" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "labels"."render_queue"
  ADD CONSTRAINT "fk_render_queue_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "labels"."render_queue_items"
  ADD CONSTRAINT "fk_render_queue_items_device_id_devices" FOREIGN KEY ("device_id") REFERENCES "devices"."devices" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "labels"."render_queue_items"
  ADD CONSTRAINT "fk_render_queue_items_queue_id_render_queue" FOREIGN KEY ("queue_id") REFERENCES "labels"."render_queue" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "signage"."schedule_devices"
  ADD CONSTRAINT "fk_schedule_devices_schedule_id_schedules" FOREIGN KEY ("schedule_id") REFERENCES "signage"."schedules" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "signage"."schedules"
  ADD CONSTRAINT "fk_schedules_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "core"."sessions"
  ADD CONSTRAINT "fk_sessions_user_id_users" FOREIGN KEY ("user_id") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "integration"."tamsoft_depo_mapping"
  ADD CONSTRAINT "fk_tamsoft_depo_mapping_branch_id_branches" FOREIGN KEY ("branch_id") REFERENCES "branch"."branches" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "integration"."tamsoft_depo_mapping"
  ADD CONSTRAINT "fk_tamsoft_depo_mapping_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "integration"."tamsoft_settings"
  ADD CONSTRAINT "fk_tamsoft_settings_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "integration"."tamsoft_sync_logs"
  ADD CONSTRAINT "fk_tamsoft_sync_logs_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "integration"."tamsoft_tokens"
  ADD CONSTRAINT "fk_tamsoft_tokens_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "labels"."templates"
  ADD CONSTRAINT "fk_templates_created_by_users" FOREIGN KEY ("created_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "labels"."templates"
  ADD CONSTRAINT "fk_templates_parent_id_templates" FOREIGN KEY ("parent_id") REFERENCES "labels"."templates" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "labels"."templates"
  ADD CONSTRAINT "fk_templates_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "branch"."user_branch_access"
  ADD CONSTRAINT "fk_user_branch_access_granted_by_users" FOREIGN KEY ("granted_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "branch"."user_branch_access"
  ADD CONSTRAINT "fk_user_branch_access_branch_id_branches" FOREIGN KEY ("branch_id") REFERENCES "branch"."branches" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "branch"."user_branch_access"
  ADD CONSTRAINT "fk_user_branch_access_user_id_users" FOREIGN KEY ("user_id") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "audit"."user_notification_preferences"
  ADD CONSTRAINT "fk_user_notification_preferences_user_id_users" FOREIGN KEY ("user_id") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "core"."users"
  ADD CONSTRAINT "fk_users_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;

ALTER TABLE "signage"."web_template_assignments"
  ADD CONSTRAINT "fk_web_template_assignments_assigned_by_users" FOREIGN KEY ("assigned_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "signage"."web_template_assignments"
  ADD CONSTRAINT "fk_web_template_assignments_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "signage"."web_template_assignments"
  ADD CONSTRAINT "fk_web_template_assignments_device_id_devices" FOREIGN KEY ("device_id") REFERENCES "devices"."devices" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "signage"."web_template_assignments"
  ADD CONSTRAINT "fk_web_template_assignments_template_id_web_templates" FOREIGN KEY ("template_id") REFERENCES "signage"."web_templates" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "signage"."web_template_versions"
  ADD CONSTRAINT "fk_web_template_versions_created_by_users" FOREIGN KEY ("created_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "signage"."web_template_versions"
  ADD CONSTRAINT "fk_web_template_versions_template_id_web_templates" FOREIGN KEY ("template_id") REFERENCES "signage"."web_templates" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;

ALTER TABLE "signage"."web_template_widgets"
  ADD CONSTRAINT "fk_web_template_widgets_created_by_users" FOREIGN KEY ("created_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "signage"."web_template_widgets"
  ADD CONSTRAINT "fk_web_template_widgets_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "signage"."web_templates"
  ADD CONSTRAINT "fk_web_templates_parent_template_id_web_templates" FOREIGN KEY ("parent_template_id") REFERENCES "signage"."web_templates" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "signage"."web_templates"
  ADD CONSTRAINT "fk_web_templates_updated_by_users" FOREIGN KEY ("updated_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "signage"."web_templates"
  ADD CONSTRAINT "fk_web_templates_created_by_users" FOREIGN KEY ("created_by") REFERENCES "core"."users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE "signage"."web_templates"
  ADD CONSTRAINT "fk_web_templates_company_id_companies" FOREIGN KEY ("company_id") REFERENCES "core"."companies" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;

