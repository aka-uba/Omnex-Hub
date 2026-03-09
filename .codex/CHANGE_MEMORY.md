# Change Memory

Format:

## YYYY-MM-DD - short title
- Request: ...
- Changes: ...
- Files: ...
- Checks: ...
- Risk/Follow-up: ...

---

## 2026-03-08 - codex memory scaffold
- Request: Create a persistent Codex structure like `.claude` so future tasks start quickly.
- Changes: Added Codex-specific project memory and operating docs.
- Files: `AGENTS.md`, `.codex/README.md`, `.codex/PROJECT_SNAPSHOT.md`, `.codex/WORKFLOW.md`, `.codex/QUICK_CHECKS.md`, `.codex/CHANGE_MEMORY.md`, `C:\Users\test\.codex\memories\market-etiket-sistemi.md`
- Checks: Not applicable (documentation-only change).
- Risk/Follow-up: Keep memory entries short and update after each implementation task.

## 2026-03-08 - claude workflow alignment
- Request: Add a reusable explanation block to CLAUDE so Claude follows the same memory workflow.
- Changes: Added 'Codex-Style Workflow (Kalici Calisma Hafizasi)' section and updated last update date/version in .claude/CLAUDE.md.
- Files: .claude/CLAUDE.md
- Checks: Not applicable (documentation-only change).
- Risk/Follow-up: Keep this section synced if .codex workflow files evolve.

## 2026-03-08 - encoding and backup safety rule
- Request: Add a strict rule to preserve file encodings and reduce corruption/data loss risk with temp backups when needed.
- Changes: Added encoding-preservation and temp-backup guardrails to AGENTS and workflow docs.
- Files: AGENTS.md, .codex/WORKFLOW.md
- Checks: Not applicable (documentation-only change).
- Risk/Follow-up: Apply temp backup workflow proactively on risky edits (legacy/non-UTF files).

## 2026-03-08 - i18n and hardcoded text rule
- Request: Add strict rule for no hardcoded text, mandatory 8-language updates, and preserving localized characters.
- Changes: Updated AGENTS, Codex workflow, and Claude workflow sections with i18n and character-preservation guardrails.
- Files: AGENTS.md, .codex/WORKFLOW.md, .claude/CLAUDE.md
- Checks: Not applicable (documentation-only change).
- Risk/Follow-up: Enforce key parity checks when locale files are touched.

## 2026-03-08 - frame inspector fixes (default stroke, masked opacity, hover popup)
- Request: In frame object inspector, set default frame border width to 1, fix opacity visibility issue (especially masked frames), and fix non-working mini hover preview popup.
- Changes: Synced frame overlay opacity with target object (apply/update/reconnect + inspector opacity change), made frame-shape default stroke width 1, and added fallback hover binding for frame preview even if async metadata load fails.
- Files: public/assets/js/editor/services/FrameService.js, public/assets/js/editor/panels/PropertyPanel.js, public/assets/js/editor/components/ShapePicker.js, public/assets/js/editor/factory/ObjectFactory.js
- Checks: node --check public/assets/js/editor/panels/PropertyPanel.js; node --check public/assets/js/editor/services/FrameService.js; node --check public/assets/js/editor/components/ShapePicker.js; node --check public/assets/js/editor/factory/ObjectFactory.js
- Risk/Follow-up: Hover preview remains mouse-hover based; touch devices may need tap-to-preview behavior later.
- Backup/restore safety: Not needed (targeted JS edits, no encoding migration).

## 2026-03-08 - inspector border width display fix for frame shapes
- Request: Border section still showed stroke width as 0 in inspector for frame shapes.
- Changes: Border section now reads style snapshot for library shapes and enforces display default strokeWidth=1 for frame-category shape library items when underlying value is 0.
- Files: public/assets/js/editor/panels/PropertyPanel.js
- Checks: node --check public/assets/js/editor/panels/PropertyPanel.js
- Risk/Follow-up: Existing saved objects with true 0 stroke on frame-category items will display as 1 in inspector baseline.

## 2026-03-08 - minimal border width patch per request
- Request: Revert broad inspector edits and apply only minimal fix where border width showed 0.
- Changes: Removed broad frame-category helper changes and updated only border-section strokeWidth assignment to use shape snapshot width for library shapes.
- Files: public/assets/js/editor/panels/PropertyPanel.js
- Checks: node --check public/assets/js/editor/panels/PropertyPanel.js
- Risk/Follow-up: If any specific shape still shows 0, inspect that shape object's child strokeWidth at runtime.

## 2026-03-08 - second strokeWidth field fix in border section
- Request: Two strokeWidth inputs showed different values; the one showing 0 should be corrected.
- Changes: Updated only _renderBorderSection strokeWidth calculation to fallback to shape snapshot (min 1) when object strokeWidth is 0 for shape objects.
- Files: public/assets/js/editor/panels/PropertyPanel.js
- Checks: node --check public/assets/js/editor/panels/PropertyPanel.js
- Risk/Follow-up: Non-shape objects keep original strokeWidth behavior.

## 2026-03-08 - frame shape initial border visibility fix
- Request: Newly added frame shape looked borderless until user manually changed stroke setting.
- Changes: In ObjectFactory.createShape, enforced initial visible stroke for frame-category shapes by setting missing/transparent stroke and strokeWidth<=0 to 1 on drawable leaf objects.
- Files: public/assets/js/editor/factory/ObjectFactory.js
- Checks: node --check public/assets/js/editor/factory/ObjectFactory.js
- Risk/Follow-up: This targets shape-library frame category only; photo frame overlays are unaffected.

## 2026-03-08 - addBorderFrame stroke fallback set to 1
- Request: Change addBorderFrame strokeWidth from 0 to 1 and update fallback.
- Changes: Updated addBorderFrame to resolve strokeWidth with fallback=1 when incoming option is missing/invalid/non-positive.
- Files: public/assets/js/editor/TemplateEditorV7.js
- Checks: node --check public/assets/js/editor/TemplateEditorV7.js
- Risk/Follow-up: If caller explicitly passes strokeWidth <= 0, fallback now normalizes to 1.

## 2026-03-08 - masked frame opacity sync restored
- Request: Restore masked-frame opacity behavior that was lost after rollbacks.
- Changes: Re-added minimal overlay opacity sync inside PropertyPanel opacity case; when selected object has FRAME_OVERLAY_ID, linked overlay opacity now updates with object opacity.
- Files: public/assets/js/editor/panels/PropertyPanel.js
- Checks: node --check public/assets/js/editor/panels/PropertyPanel.js
- Risk/Follow-up: This covers inspector-driven opacity changes; non-inspector opacity mutations still depend on existing editor flows.

## 2026-03-08 - multi-frame slot drag boundary normalization
- Request: Objects added into selected multi-product frame slots had inconsistent drag limits (especially left side).
- Changes: Updated slot boundary enforcement in EditorWrapper object:moving to use slot-based min/max independent of object dimensions.
- Files: public/assets/js/pages/templates/EditorWrapper.js
- Checks: node --check public/assets/js/pages/templates/EditorWrapper.js
- Risk/Follow-up: Objects can now be positioned uniformly by center within slot; large objects may visually overflow slot edges by design.

## 2026-03-09 - resume context after restart
- Request: Reconstruct where work stopped after PC restart.
- Changes: Reviewed project snapshot/workflow and recent memory; inspected current uncommitted workspace status.
- Files: .codex/PROJECT_SNAPSHOT.md, .codex/WORKFLOW.md, .codex/CHANGE_MEMORY.md
- Checks: Not applicable (no source code changes).
- Risk/Follow-up: Large uncommitted notification/render-queue batch is present; continue from that branch carefully without reverting unrelated edits.

## 2026-03-09 - device-send notification filter and retention policy
- Request: Add a dedicated notifications-page filter for device send notifications and add SuperAdmin setting for device notification retention days with automatic cleanup.
- Changes: Added `device_send` category filter path in notifications list API + UI tab; extended notification settings API/UI with SuperAdmin-only `device_notification_retention_days` (company settings scope); added NotificationService helpers for retention read + device-send cleanup; wired automatic cleanup into RenderQueueService notification flow before send/start-complete notifications.
- Files: api/notifications/index.php, api/notifications/settings.php, public/assets/js/pages/notifications/NotificationList.js, public/assets/js/pages/notifications/NotificationSettings.js, services/NotificationService.php, services/RenderQueueService.php, locales/tr/pages/notifications.json, locales/en/pages/notifications.json, locales/az/pages/notifications.json, locales/de/pages/notifications.json, locales/fr/pages/notifications.json, locales/ar/pages/notifications.json, locales/ru/pages/notifications.json, locales/nl/pages/notifications.json
- Checks: php -l api/notifications/index.php; php -l api/notifications/settings.php; php -l services/NotificationService.php; php -l services/RenderQueueService.php; node --check public/assets/js/pages/notifications/NotificationList.js; node --check public/assets/js/pages/notifications/NotificationSettings.js; node JSON parse check for all 8 notifications locale files; locale key parity check (8/8).
- Risk/Follow-up: Device-send classification currently relies on queue links (`#/admin/queue*` or `#/queue*`); if future queue notifications use different links, filter/cleanup condition should be updated accordingly.

## 2026-03-09 - Turkish diacritics fix for device notification labels
- Request: Correct Turkish wording with proper diacritics (`Cihaz Gönderim Bildirimleri`).
- Changes: Updated new Turkish notification keys to proper Turkish characters (`Gönderim`, `süresi`, `gün`, `oluşan`, `görebilir`).
- Files: locales/tr/pages/notifications.json
- Checks: node JSON parse check for locales/tr/pages/notifications.json
- Risk/Follow-up: Keep locale writes diacritic-safe on future automated edits.

## 2026-03-09 - device notification flow simulation check
- Request: Simulate whether new device-send filter and retention cleanup flow works.
- Changes: No source edits; executed code-path simulation checks over updated files and mock data.
- Files: (no code changes)
- Checks: Node simulation for UI/API wiring, retention setting hooks, and mock cleanup behavior; Turkish labels re-validated with Unicode-safe comparison.
- Risk/Follow-up: This is a logic simulation (not authenticated live API call); optional live endpoint spot-check can be run in active session.

## 2026-03-09 - add read filter and run real endpoint test
- Request: Add missing `Okundu` filter on notifications page and perform real endpoint verification.
- Changes: Added `read` filter tab and query mapping (`status=read`) in notifications list page; added `filters.read` i18n key in all 8 notification locale files using each locale's existing `status.read` value.
- Files: public/assets/js/pages/notifications/NotificationList.js, locales/tr/pages/notifications.json, locales/en/pages/notifications.json, locales/az/pages/notifications.json, locales/de/pages/notifications.json, locales/fr/pages/notifications.json, locales/ar/pages/notifications.json, locales/ru/pages/notifications.json, locales/nl/pages/notifications.json
- Checks: node --check public/assets/js/pages/notifications/NotificationList.js; locale JSON parse check (8/8); locale key parity check (8/8); live API test with authenticated bearer token:
  - GET `/api/notifications?status=read&limit=5` -> success=true
  - GET `/api/notifications?category=device_send&limit=5` -> success=true
- Risk/Follow-up: Live test dataset currently returns 0 records for both filters in tested account, but endpoint contracts and filtering paths respond successfully.

## 2026-03-09 - remove lingering SQLite traces from runtime
- Request: Remove remaining SQLite traces since project runs PostgreSQL only.
- Changes: Fixed DB driver to `pgsql` in config, removed unused `DB_PATH` legacy constant, removed unused `isSqlite()` method from Database wrapper, and cleaned SQLite references in runtime code comments; updated project snapshot DB statement to PostgreSQL-only.
- Files: config.php, core/Database.php, core/Security.php, api/devices/create.php, api/devices/update.php, api/products/index.php, .codex/PROJECT_SNAPSHOT.md
- Checks: php -l config.php; php -l core/Database.php; php -l core/Security.php; php -l api/devices/create.php; php -l api/devices/update.php; php -l api/products/index.php
- Risk/Follow-up: Historical SQLite references may still remain in long-form docs (`.claude/CLAUDE.md` etc.); runtime path is now PostgreSQL-only.

## 2026-03-09 - frame picker colored designs regression fix
- Request: Frame modaldaki bazı özel tasarım frame'ler seçildiğinde kendi deseni yerine düz kenarlık görünmesi regresyonunu düzelt.
- Changes: FrameService.applyFrame içinde defaultColor olmayan frame'lere zorunlu `#000000` tint verilmesini kaldırdım; defaultColor yoksa tint uygulanmıyor ve frame'in özgün tasarımı korunuyor.
- Files: public/assets/js/editor/services/FrameService.js
- Checks: node --check public/assets/js/editor/services/FrameService.js
- Risk/Follow-up: Property panel frame color alanı defaultta siyah gösteriyor olabilir; yalnızca kullanıcı renk değiştirirse tint uygulanır.
## 2026-03-09 - frame tint capability-aware inspector behavior
- Request: Frame modaldan se�ilen baz� �zel tasar�mlarda desenin d�z kenarl��a d�nmesi regresyonunu koruyarak; denet�ide renklenebilen frame ile renklenmeyen frame davran���n� ay�rmak (renk deste�i olmayan frame i�in sahte siyah renk g�stermemek).
- Changes: Kept FrameService default tint fallback empty when frame has no `defaultColor`; updated PropertyPanel frame section to resolve frame definition via `getFrameById`, detect tint support (`defaultColor` / explicit support / stored frameColor), show frame color picker only when tint is supported, and keep opacity sync to frame overlay in opacity inspector path.
- Files: public/assets/js/editor/services/FrameService.js, public/assets/js/editor/panels/PropertyPanel.js
- Checks: node --check public/assets/js/editor/panels/PropertyPanel.js; node --check public/assets/js/editor/services/FrameService.js
- Risk/Follow-up: Existing frame data currently infers tint support mostly from `defaultColor`; if future non-default tintable frames are added, frame metadata should include explicit `supportsTint` for deterministic UI behavior.
## 2026-03-09 - rollback frame color conditional UI
- Request: Frame color alan� hi�bir frame'de g�r�nmedi�i i�in son ko�ullu g�sterim de�i�ikli�ini geri al; sahte alan kalsa da her frame'de manuel renk de�i�imi m�mk�n olsun.
- Changes: Restored PropertyPanel frame inspector to always render frame color input (removed tint-capability conditional UI/helpers/import logic).
- Files: public/assets/js/editor/panels/PropertyPanel.js
- Checks: node --check public/assets/js/editor/panels/PropertyPanel.js
- Risk/Follow-up: Non-tint frame'lerde color input g�r�necek; kullan�c� renk se�erse tint uygulanabilir (�nceki davran��a d�n��).
## 2026-03-09 - line picker presets dedupe and quality pass
- Request: �izgi ekleme modal�ndaki tekrar eden/anlams�z g�r�nen �izgi t�rlerini kald�r; her preset ger�ekten farkl� ve ��k g�r�ns�n.
- Changes: Replaced algorithmic 60-item generated line preset set with a curated 24-item preset library (`basic/dashed/dotted/decorative`) where each item has unique visual signature (renderType + dash/cap/width/color). This removes near-duplicate variants and keeps modal output cleaner and more intentional for tablet/signage/ESL/digital layouts.
- Files: public/assets/js/editor/data/LineStyleLibraryData.js
- Checks: node --check public/assets/js/editor/data/LineStyleLibraryData.js; module sanity check for preset uniqueness (24 total, duplicate names=0, duplicate visual signatures=0).
- Risk/Follow-up: Preset names remain static English labels (existing pattern in file); if multilingual naming is required in picker cards, next step should map preset ids to i18n keys.
## 2026-03-09 - line picker +26 preset expansion
- Request: Existing 24 line presets were acceptable; add 26 more distinct UI-compatible line variants.
- Changes: Expanded curated line preset catalog from 24 to 50 entries by adding `line_25`..`line_50` across `basic/dashed/dotted/decorative`, keeping supported render types (`simple/wave/zigzag/step/bracket`) and unique names/ids.
- Files: public/assets/js/editor/data/LineStyleLibraryData.js
- Checks: node --check public/assets/js/editor/data/LineStyleLibraryData.js; preset validation script (total=50, duplicate ids=0, duplicate names=0, category distribution verified).
- Risk/Follow-up: Large decorative sets can still feel dense in picker; if needed we can add quick-tag filters (e.g., "minimal", "promo", "tech") next.
## 2026-03-09 - line picker uniqueness + category counts
- Request: Line picker modal still showed same-type variants in different colors; require truly unique styles and show item counts on category tabs.
- Changes: Adjusted line preset definitions so no two presets share the same non-color visual signature (renderType + dash + cap/join + width). Updated LinePicker category tabs to display counts (`all/basic/dashed/dotted/decorative`) and refresh counts with search filtering.
- Files: public/assets/js/editor/data/LineStyleLibraryData.js, public/assets/js/editor/components/LinePicker.js
- Checks: node --check public/assets/js/editor/data/LineStyleLibraryData.js; node --check public/assets/js/editor/components/LinePicker.js; uniqueness validation script (total=50, duplicate non-color style signatures=0).
- Risk/Follow-up: Category counts currently update by search scope; if you prefer fixed global totals only, count refresh can be made static.
## 2026-03-09 - decorative line variety redesign
- Request: Decorative line presets still looked similar; make decorative options clearly distinct on inspection.
- Changes: Reworked decorative preset `renderType` assignments to unique silhouettes and added corresponding render implementations in both picker preview and editor insertion path. Added new decorative render types: `pulseWave, scallop, chevron, notch, arc, chain, ribbon, stitch, skyline, ticket, hook, twinline` (plus existing simple/wave/zigzag/step/bracket).
- Files: public/assets/js/editor/data/LineStyleLibraryData.js, public/assets/js/editor/components/LinePicker.js, public/assets/js/editor/TemplateEditorV7.js
- Checks: node --check public/assets/js/editor/data/LineStyleLibraryData.js; node --check public/assets/js/editor/components/LinePicker.js; node --check public/assets/js/editor/TemplateEditorV7.js; decorative uniqueness script (17 decorative presets, duplicate non-color style signatures=0).
- Risk/Follow-up: Some new decorative paths are visually expressive; if you want stricter corporate/minimal tone, we can trim to a �minimal decorative� subset toggle.
## 2026-03-09 - input icon hover cursor disappearance fix
- Request: Investigate project-wide cursor/caret disappearance around icon-enhanced input/value fields and fix the causing rule.
- Changes: Added a global safety rule so decorative icons inside `.input-icon-wrapper` never capture pointer events; patched template editor search/icon blocks (`product-search`, `field-search`, `shape-picker`, `frame-picker`) with `pointer-events: none` on icon overlays; added missing line-picker search icon layout styles with non-interactive icon overlay.
- Files: public/assets/css/components/forms.css, public/assets/css/pages/template-editor.css
- Checks: node --check public/assets/js/editor/components/FramePicker.js; node --check public/assets/js/editor/components/LinePicker.js
- Risk/Follow-up: If any future `input-icon-wrapper` usage introduces intentionally clickable `<i>` icons, that icon should use a button element or locally override `pointer-events`.
## 2026-03-09 - global cursor freeze root-cause fix via hover-listener cleanup
- Request: Cursor disappears on product edit brand input and returns after several seconds; investigate project-wide hover/cursor issue.
- Changes: Identified document-level hover preview listener leak in template/media pages. Added single-bind guards and stored handler refs; now remove `mouseover/mouseout/mousemove` listeners in `destroy()` for both pages. This prevents listener accumulation across route changes.
- Files: public/assets/js/pages/templates/TemplateList.js, public/assets/js/pages/media/MediaLibrary.js
- Checks: node --check public/assets/js/pages/templates/TemplateList.js; node --check public/assets/js/pages/media/MediaLibrary.js
- Risk/Follow-up: If another page adds document-level pointer listeners without cleanup, similar lag can reappear; recommended periodic scan for `document.addEventListener` + missing `removeEventListener`.
## 2026-03-09 - non-icon input caret visibility stabilization
- Request: Icon fields were fixed, but non-icon inputs still showed hover-time white cursor/caret behavior until click.
- Changes: Enforced consistent text-cursor and caret color on core form fields: `.form-control`, `.form-input`, `.form-textarea` including hover/focus states (`cursor: text`, `caret-color: var(--text-primary)`).
- Files: public/assets/css/components/forms.css
- Checks: node --check public/assets/js/app.js
- Risk/Follow-up: If OS/browser-level pointer theme causes apparent white mouse cursor, this CSS only controls text caret and input cursor semantics, not hardware pointer color.
## 2026-03-09 - product form cursor behavior debug instrumentation
- Request: Add debug logs to observe cursor/caret behavior on problematic inputs.
- Changes: Added optional ProductForm cursor debugger (toggle via `localStorage.omnex_debug_cursor=1` or `?cursorDebug=1`) that logs computed cursor/caret/pointer-events plus top element under pointer on `mouseenter/mousemove/focus/blur`; added cleanup of attached listeners in `destroy()`.
- Files: public/assets/js/pages/products/ProductForm.js
- Checks: node --check public/assets/js/pages/products/ProductForm.js
- Risk/Follow-up: Debug logs are verbose by design; disable after diagnosis (`localStorage.removeItem('omnex_debug_cursor')`).
## 2026-03-09 - cursor debug output expansion for overlay diagnosis
- Request: Existing cursor debug logs were too compact to confirm hover-style/overlay effects.
- Changes: Updated ProductForm cursor debugger to print full JSON snapshots, include html/body classes, flag `overlaySuspected` when top element differs from target, and emit warning logs for suspected overlay capture.
- Files: public/assets/js/pages/products/ProductForm.js
- Checks: node --check public/assets/js/pages/products/ProductForm.js
- Risk/Follow-up: `overlaySuspected` heuristic is conservative; final confirmation should inspect repeated warnings on same target area.
## 2026-03-09 - hover cursor mode adjustment for text fields
- Request: In this project, non-icon inputs still showed odd white cursor-like behavior on hover; likely hover text-cursor rendering issue.
- Changes: Adjusted form cursor behavior to reduce hover-time I-beam rendering artifacts: text fields now use default cursor on hover and switch to text cursor on focus; caret-color preservation remains.
- Files: public/assets/css/components/forms.css
- Checks: node --check public/assets/js/pages/products/ProductForm.js
- Risk/Follow-up: This changes UX from classic I-beam-on-hover to I-beam-on-focus for text fields; if not preferred globally, scope can be limited to products page only.
## 2026-03-09 - remove temporary cursor debug instrumentation
- Request: Cursor issue improved; remove ProductForm debug logs.
- Changes: Removed temporary cursor debug toggles, snapshot/logger methods, event bindings, and destroy-time cleanup related to debug instrumentation from ProductForm.
- Files: public/assets/js/pages/products/ProductForm.js
- Checks: node --check public/assets/js/pages/products/ProductForm.js
- Risk/Follow-up: If cursor issue reappears, we can reintroduce a smaller scoped debug helper quickly.
## 2026-03-09 - global form control font normalization
- Request: Product description textarea looked visually different from brand input; ask for project-wide bulk fix for similar inconsistencies.
- Changes: Normalized form typography by adding `font-family: inherit` to `.form-control`, `.form-input`, `.form-textarea`, and `.form-select` in shared forms stylesheet so inputs/textareas/selects use the same base UI font across pages.
- Files: public/assets/css/components/forms.css
- Checks: node --check public/assets/js/pages/products/ProductForm.js
- Risk/Follow-up: Any page intentionally using custom monospace in form fields should now define it explicitly at component/page scope.
## 2026-03-09 - license plan device category pricing headers added
- Request: On `#/admin/licenses` pricing mode > device categories table, quantity values were unclear; add headers for count, price, and currency.
- Changes: Added a header row above per-device-type category pricing inputs in LicensePlanForm (`deviceCount`, `unitPrice`, `currency` via i18n keys). Replaced hardcoded count placeholder with i18n `licenses.pricing.deviceCount`. Added matching styles in admin.css for header alignment (including dark mode and mobile hide).
- Files: public/assets/js/pages/admin/LicensePlanForm.js, public/assets/css/pages/admin.css
- Checks: node --check public/assets/js/pages/admin/LicensePlanForm.js
- Risk/Follow-up: Header row is hidden on very small screens (<640px) to preserve compact layout; values remain visible with placeholders.
## 2026-03-09 - per-device-type pricing multi-currency exchange model
- Request: In admin licenses pricing mode, support mixed per-category currencies with separate exchange rates and compute top plan price in selected plan currency.
- Changes: Replaced single exchange-rate/base-currency model in LicensePlanForm with 3-currency rate map (TRY/USD/EUR) relative to selected plan currency. Kept per-category currency independent (no forced override). Added dynamic rate inputs (`1 FROM -> TARGET`), dynamic monthly total label in selected currency, TRY equivalent calculation, and plan price auto-update from converted totals. Added backward-compatible save metadata: `_meta.exchange_rates` + legacy `_meta.exchange_rate`.
- Files: public/assets/js/pages/admin/LicensePlanForm.js
- Checks: node --check public/assets/js/pages/admin/LicensePlanForm.js
- Risk/Follow-up: Summary label uses existing `annualTotal` key for duration-based plan total text; if desired, add a dedicated i18n key for "plan total" in all 8 locales.
## 2026-03-09 - fix exchange direction confusion with canonical TRY-rate conversion
- Request: Currency switch caused inverse-looking exchange behavior; expected e.g. when target is TRY, USD/EUR fields should represent TL equivalents.
- Changes: Reworked currency-switch conversion to canonical TRY-based rates (`_toCanonicalTryRates` / `_fromCanonicalTryRates`) and rebuilt per-target inputs from canonical map to avoid inversion drift. Updated rate label to explicit form: `1 FROM = ? TARGET`.
- Files: public/assets/js/pages/admin/LicensePlanForm.js
- Checks: node --check public/assets/js/pages/admin/LicensePlanForm.js
- Risk/Follow-up: Existing saved plans with unusual legacy exchange inputs are normalized on next edit/save cycle.

## 2026-03-09 - bulk product descriptions (1064 SKU)
- Request: Generate unique Turkish SEO-like product descriptions for all 1064 products (Baharat, Bakliyat, Çerez, Deniz Ürünleri, Dondurulmuş, Donuk, Fırın, İçecek, Kahvaltılık, Kasap, Manav, Tatlı, Şarküteri).
- Changes: Created 5 PHP description files (desc_part1a, 1b, 2, 3, 4) with SKU-keyed arrays. Ran bulk updater script to write descriptions to all 2128 product rows (1064 unique SKUs × ~2 companies). Zero errors, zero not-found.
- Files: C:/xampp/tmp/desc_part1a.php, C:/xampp/tmp/desc_part1b.php, C:/xampp/tmp/desc_part2.php, C:/xampp/tmp/desc_part3.php, C:/xampp/tmp/desc_part4.php, C:/xampp/tmp/update_all_descriptions.php
- Checks: PHP syntax check on all 5 part files; verified 2128 updated rows, 0 errors, 0 not-found via verify script.
- Risk/Follow-up: Temp files in C:/xampp/tmp/ - can be deleted after confirming descriptions are correct in production.

## 2026-03-09 - product description textarea height fix
- Request: Increase product description textarea initial visible height to 6 lines.
- Changes: Changed textarea rows="3" to rows="6" in ProductForm.js. Added `textarea.form-input { height: auto; padding: 10px 12px; resize: vertical; }` in forms.css to override the fixed `height: 42px` from `.form-input` that was preventing rows attribute from working.
- Files: public/assets/js/pages/products/ProductForm.js (line 192), public/assets/css/components/forms.css (line 167-170)
- Checks: node --check ProductForm.js (passed), CSS visual inspection.
- Risk/Follow-up: All other textarea.form-input elements also get auto height now (desired behavior).

## 2026-03-09 - HAL card visibility: company-based instead of language-based
- Request: HAL Kunye card in product form should show/hide based on company HAL integration settings (enabled + configured) instead of language check. Multi-tenant isolation approach.
- Changes: Added `id="hal-card"` with `style="display: none"` to HAL card div (default hidden). Created `_checkHalIntegration()` method that calls `/api/hal/settings` API and shows card only when `meta.is_active && configured`. Moved `_initHalKunyeSection()` and `loadProductionTypeFromHalData()` inside the integration check. Removed old unconditional HAL init from `init()`.
- Files: public/assets/js/pages/products/ProductForm.js
- Checks: node --check ProductForm.js (passed), JS syntax valid.
- Risk/Follow-up: Companies without HAL integration configured will not see HAL card at all. Production type select remains visible (it's outside HAL card). Existing HAL data for products is preserved in DB.
## 2026-03-09 - multi-currency pricing summary breakdown in plan form
- Request: When multiple row currencies are used in device-type pricing, monthly/yearly summary should also show cross-currency calculation details.
- Changes: Extended per-device-type summary block to include per-currency subtotals and conversion info (`subtotal`, `exchangeRate`, converted subtotal in selected plan currency) in addition to overall monthly/annual totals.
- Files: public/assets/js/pages/admin/LicensePlanForm.js
- Checks: node --check public/assets/js/pages/admin/LicensePlanForm.js
- Risk/Follow-up: Summary block is now more verbose; if needed we can collapse per-currency detail behind a toggle.
## 2026-03-09 - products table header sorting fix (server-side)
- Request: `#/products` header sorting was inconsistent (e.g., group column seemed random each click); fix this page first.
- Changes: Updated products list API sort handling to use a safe sort-key map with all visible sortable columns (`sku`, `name`, `barcode`, `group`, `category`, `current_price`, `stock`, `status`, `created_at`, `updated_at`). Added SQL expression mapping including quoted `"group"` and case-insensitive text sorting via `LOWER(...)`. Added deterministic tiebreaker `id ASC`.
- Files: api/products/index.php
- Checks: php -l api/products/index.php
- Risk/Follow-up: If you want locale-aware Turkish sorting (`?/?`) beyond ASCII-lower behavior, DB collation/ICU-based sort can be added later.
## 2026-03-09 - products sorting refinement (null handling + stable ordering)
- Request: On products table, group sorting still looked wrong (same categories appearing on top).
- Changes: Refined ORDER BY in products API to `NULLS LAST` and added secondary stable sort by `LOWER(name), id` to avoid misleading top rows when many records share same group or null values.
- Files: api/products/index.php
- Checks: php -l api/products/index.php
- Risk/Follow-up: If active branch dataset truly contains only few group values, top rows can still repeat by design; then issue is data scope, not sort logic.
## 2026-03-09 - product group assignment audit + edit-form group selector compatibility fix
- Request: Verify whether all products have group assigned and why group selector appears unselected in product edit.
- Changes: Audited live product groups for active company via DB query; all products have non-empty group values. Found many tenant-specific/localized group values not present in static edit-form options. Updated ProductForm `populateForm()` to set group with case-insensitive option match and append dynamic option when no static match exists, then select it.
- Files: public/assets/js/pages/products/ProductForm.js
- Checks: node --check public/assets/js/pages/products/ProductForm.js; runtime DB audit script (group distribution).
- Risk/Follow-up: Static default group option list is narrow; if strict canonical groups are desired, add dedicated mapping/migration rules before normalization.
## 2026-03-09 - product form category/group separation hardening
- Request: Investigate category field behavior where group-level values appear in category context; category should represent subgroup hierarchy.
- Changes: In ProductForm, added `/products/groups` preload and normalized group-name set; filtered category dropdown root options that collide with product group names; preserved backward compatibility by dynamically appending product's existing category when it is not present in filtered dropdown.
- Files: public/assets/js/pages/products/ProductForm.js
- Checks: node --check public/assets/js/pages/products/ProductForm.js
- Risk/Follow-up: If a tenant intentionally uses the same label for both group and category in new product creation, that category is now hidden from default dropdown; existing records still load via dynamic option.

## 2026-03-09 - add product descriptions to demo seed data (products.json)
- Request: Merge the 1064 product descriptions generated earlier into the TR products.json seed file so the setup wizard seeds products with descriptions.
- Changes: Added `description` field to all 1064 product entries in `database/seeders/data/tr/products.json`. ProductSeeder.php already handled `$product['description'] ?? null` (line 93), so no backend code change was needed. Verified all 1064 SKUs matched, 0 unmatched.
- Files: database/seeders/data/tr/products.json
- Checks: JSON parse validation, field count verification (18 fields per product), 1064/1064 description coverage confirmed.
- Risk/Follow-up: EN products.json (20 items) does not have descriptions yet; can be added if needed. Backup at products.json.bak.
