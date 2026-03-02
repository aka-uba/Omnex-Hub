-- Suggested RLS policies for company-bound UUID tables
-- Apply after application sets app.company_id and app.role session vars.

ALTER TABLE "branch"."branch_import_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_branch_import_logs_company_isolation" ON "branch"."branch_import_logs";
CREATE POLICY "p_branch_import_logs_company_isolation" ON "branch"."branch_import_logs"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "branch"."branches" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_branches_company_isolation" ON "branch"."branches";
CREATE POLICY "p_branches_company_isolation" ON "branch"."branches"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "catalog"."bundles" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_bundles_company_isolation" ON "catalog"."bundles";
CREATE POLICY "p_bundles_company_isolation" ON "catalog"."bundles"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "catalog"."categories" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_categories_company_isolation" ON "catalog"."categories";
CREATE POLICY "p_categories_company_isolation" ON "catalog"."categories"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "media"."company_storage_usage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_company_storage_usage_company_isolation" ON "media"."company_storage_usage";
CREATE POLICY "p_company_storage_usage_company_isolation" ON "media"."company_storage_usage"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "devices"."device_groups" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_device_groups_company_isolation" ON "devices"."device_groups";
CREATE POLICY "p_device_groups_company_isolation" ON "devices"."device_groups"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "devices"."device_sync_requests" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_device_sync_requests_company_isolation" ON "devices"."device_sync_requests";
CREATE POLICY "p_device_sync_requests_company_isolation" ON "devices"."device_sync_requests"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "devices"."devices" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_devices_company_isolation" ON "devices"."devices";
CREATE POLICY "p_devices_company_isolation" ON "devices"."devices"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "devices"."firmware_updates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_firmware_updates_company_isolation" ON "devices"."firmware_updates";
CREATE POLICY "p_firmware_updates_company_isolation" ON "devices"."firmware_updates"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "devices"."gateways" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_gateways_company_isolation" ON "devices"."gateways";
CREATE POLICY "p_gateways_company_isolation" ON "devices"."gateways"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "integration"."hal_distribution_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_hal_distribution_logs_company_isolation" ON "integration"."hal_distribution_logs";
CREATE POLICY "p_hal_distribution_logs_company_isolation" ON "integration"."hal_distribution_logs"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "devices"."hanshow_aps" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_hanshow_aps_company_isolation" ON "devices"."hanshow_aps";
CREATE POLICY "p_hanshow_aps_company_isolation" ON "devices"."hanshow_aps"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "devices"."hanshow_esls" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_hanshow_esls_company_isolation" ON "devices"."hanshow_esls";
CREATE POLICY "p_hanshow_esls_company_isolation" ON "devices"."hanshow_esls"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "devices"."hanshow_queue" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_hanshow_queue_company_isolation" ON "devices"."hanshow_queue";
CREATE POLICY "p_hanshow_queue_company_isolation" ON "devices"."hanshow_queue"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "devices"."hanshow_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_hanshow_settings_company_isolation" ON "devices"."hanshow_settings";
CREATE POLICY "p_hanshow_settings_company_isolation" ON "devices"."hanshow_settings"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "integration"."integrations" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_integrations_company_isolation" ON "integration"."integrations";
CREATE POLICY "p_integrations_company_isolation" ON "integration"."integrations"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "labels"."label_sizes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_label_sizes_company_isolation" ON "labels"."label_sizes";
CREATE POLICY "p_label_sizes_company_isolation" ON "labels"."label_sizes"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "license"."licenses" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_licenses_company_isolation" ON "license"."licenses";
CREATE POLICY "p_licenses_company_isolation" ON "license"."licenses"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "media"."media" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_media_company_isolation" ON "media"."media";
CREATE POLICY "p_media_company_isolation" ON "media"."media"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "media"."media_folders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_media_folders_company_isolation" ON "media"."media_folders";
CREATE POLICY "p_media_folders_company_isolation" ON "media"."media_folders"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "devices"."mqtt_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_mqtt_settings_company_isolation" ON "devices"."mqtt_settings";
CREATE POLICY "p_mqtt_settings_company_isolation" ON "devices"."mqtt_settings"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "license"."payment_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_payment_settings_company_isolation" ON "license"."payment_settings";
CREATE POLICY "p_payment_settings_company_isolation" ON "license"."payment_settings"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "license"."payment_transactions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_payment_transactions_company_isolation" ON "license"."payment_transactions";
CREATE POLICY "p_payment_transactions_company_isolation" ON "license"."payment_transactions"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "signage"."playlists" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_playlists_company_isolation" ON "signage"."playlists";
CREATE POLICY "p_playlists_company_isolation" ON "signage"."playlists"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "integration"."product_hal_data" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_product_hal_data_company_isolation" ON "integration"."product_hal_data";
CREATE POLICY "p_product_hal_data_company_isolation" ON "integration"."product_hal_data"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "labels"."product_renders" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_product_renders_company_isolation" ON "labels"."product_renders";
CREATE POLICY "p_product_renders_company_isolation" ON "labels"."product_renders"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "catalog"."production_types" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_production_types_company_isolation" ON "catalog"."production_types";
CREATE POLICY "p_production_types_company_isolation" ON "catalog"."production_types"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "catalog"."products" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_products_company_isolation" ON "catalog"."products";
CREATE POLICY "p_products_company_isolation" ON "catalog"."products"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "labels"."render_queue" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_render_queue_company_isolation" ON "labels"."render_queue";
CREATE POLICY "p_render_queue_company_isolation" ON "labels"."render_queue"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "signage"."schedules" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_schedules_company_isolation" ON "signage"."schedules";
CREATE POLICY "p_schedules_company_isolation" ON "signage"."schedules"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "integration"."tamsoft_depo_mapping" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_tamsoft_depo_mapping_company_isolation" ON "integration"."tamsoft_depo_mapping";
CREATE POLICY "p_tamsoft_depo_mapping_company_isolation" ON "integration"."tamsoft_depo_mapping"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "integration"."tamsoft_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_tamsoft_settings_company_isolation" ON "integration"."tamsoft_settings";
CREATE POLICY "p_tamsoft_settings_company_isolation" ON "integration"."tamsoft_settings"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "integration"."tamsoft_sync_logs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_tamsoft_sync_logs_company_isolation" ON "integration"."tamsoft_sync_logs";
CREATE POLICY "p_tamsoft_sync_logs_company_isolation" ON "integration"."tamsoft_sync_logs"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "integration"."tamsoft_tokens" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_tamsoft_tokens_company_isolation" ON "integration"."tamsoft_tokens";
CREATE POLICY "p_tamsoft_tokens_company_isolation" ON "integration"."tamsoft_tokens"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "labels"."templates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_templates_company_isolation" ON "labels"."templates";
CREATE POLICY "p_templates_company_isolation" ON "labels"."templates"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "core"."users" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_users_company_isolation" ON "core"."users";
CREATE POLICY "p_users_company_isolation" ON "core"."users"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "signage"."web_template_assignments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_web_template_assignments_company_isolation" ON "signage"."web_template_assignments";
CREATE POLICY "p_web_template_assignments_company_isolation" ON "signage"."web_template_assignments"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "signage"."web_template_widgets" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_web_template_widgets_company_isolation" ON "signage"."web_template_widgets";
CREATE POLICY "p_web_template_widgets_company_isolation" ON "signage"."web_template_widgets"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

ALTER TABLE "signage"."web_templates" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "p_web_templates_company_isolation" ON "signage"."web_templates";
CREATE POLICY "p_web_templates_company_isolation" ON "signage"."web_templates"
  USING (
    current_setting('app.role', true) = 'SuperAdmin'
    OR company_id = nullif(current_setting('app.company_id', true), '')::uuid
  );

