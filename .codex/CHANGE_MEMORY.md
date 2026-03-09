# Change Memory

Format:

## YYYY-MM-DD - short title
- Request: ...
- Changes: ...
- Files: ...
- Checks: ...
- Risk/Follow-up: ...

---

## 2026-03-09 - Complete 8-language demo seed data
- Request: Generate demo seed data for all 8 languages (tr, en, ru, az, de, nl, fr, ar)
- Changes:
  - Created products.json for 7 locales (en, ru, az, de, nl, fr, ar) with 1064 translated products each
  - Created categories.json for 7 locales with 108 categories each (EN rebuilt to match TR structure)
  - Created production_types.json for 6 locales (ru, az, de, nl, fr, ar)
  - Created settings.json for 6 locales with locale-specific currencies, timezones, date formats
  - Created templates.json for 7 locales (EN rebuilt + 6 new) with translated template names/descriptions
  - Created AR label_sizes.json (71 sizes) and license_plans.json (4 plans)
  - Added AR option to SetupWizard.js dropdown
- Files: database/seeders/data/{en,ru,az,de,nl,fr,ar}/*.json, public/assets/js/pages/admin/SetupWizard.js
- Checks: PHP JSON parse verification on all 56 files (8 locales x 7 file types) - ALL PASSED
- Risk/Follow-up: Word-level product name translation may have some untranslated Turkish words for less common products. Descriptions use template-based generation.

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
## 2026-03-09 - setup wizard product category hierarchy audit + seeder normalization
- Request: Inspect whether subcategory is correct by category, verify demo seed structure (group/category/subcategory), and check setup-wizard category-product matching.
- Findings: Seed/data mismatch was real. Audits showed high inconsistency between products and category hierarchy (TR seed: total 1064, category-not-parent 569, subcategory-not-child 742; live company dataset showed same pattern). Setup wizard had no category-product hierarchy validation.
- Changes: Updated `database/seeders/ProductSeeder.php` to load category hierarchy from DB and normalize incoming product fields during seed: (1) promote child-level category to parent category, (2) align subcategory to child-level when possible, (3) fallback to group as parent category when category is unknown but group maps to parent. This hardens setup-wizard seeded data consistency going forward.
- Files: database/seeders/ProductSeeder.php
- Checks: php -l database/seeders/ProductSeeder.php; php database/seeders/seed.php --products --dry-run --locale=tr --verbose
- Risk/Follow-up: Existing already-seeded product rows are unchanged until products are seeded again (or a one-time normalization migration is run). When category is promoted from child to parent, deeper third-level source detail may be compressed into available 2-level model.
## 2026-03-09 - one-time live product category/subcategory normalization for existing data
- Request: Apply solution for existing subcategory preferences on live data.
- Changes: Added `scripts/normalize_product_category_hierarchy.php` (dry-run/apply modes) to normalize existing product rows to parent-category + child-subcategory model and optionally auto-create missing child categories to preserve current user preferences. Ran apply for active company `Omnex Default` (`d1c946f3-4058-4b72-8e24-6c4b3cb9e9cb`) in two passes. Added group->parent alias mapping for non-1:1 labels (`F�r�n`->`F�r�n �r�nleri`, `�erez`->`Kuruyemi�`, etc.). Also updated `database/seeders/ProductSeeder.php` with same alias logic to prevent reoccurrence in setup wizard seed.
- Files: scripts/normalize_product_category_hierarchy.php, database/seeders/ProductSeeder.php
- Checks: php -l scripts/normalize_product_category_hierarchy.php; php -l database/seeders/ProductSeeder.php; php scripts/normalize_product_category_hierarchy.php --apply; php scripts/normalize_product_category_hierarchy.php --company=d1c946f3-4058-4b72-8e24-6c4b3cb9e9cb --apply; post-apply DB audit query (cat_not_parent=0, sub_not_child=0).
- Risk/Follow-up: Normalization intentionally remapped some rows based on group/category aliases; if a specific SKU needs custom exception, add a small SKU-level override map in the script before future runs.
## 2026-03-09 - products table sorting/filter interaction hardening
- Request: Products table headers (group/category) seemed to show only limited variants on clicks; investigate possible cross-effect between column sorting and filters.
- Changes: (1) DataTable now resets to page 1 when sort column/direction changes. (2) ProductList filter-change handlers now force page reset before refresh to avoid stale pagination state. (3) Group filter source switched from `/products?per_page=1000` (incorrect/limited) to dedicated `/products/groups` endpoint so all distinct groups load reliably.
- Files: public/assets/js/components/DataTable.js, public/assets/js/pages/products/ProductList.js
- Checks: node --check public/assets/js/components/DataTable.js; node --check public/assets/js/pages/products/ProductList.js; php -l api/products/groups.php
- Risk/Follow-up: Even with correct sorting, first page may still show one dominant group/category when distribution is skewed (expected behavior with paginated sorting). If desired, add a distinct-value summary strip above table.
## 2026-03-09 - products API interleaved sorting for group/category headers only
- Request: Header sorting seemed to show only Baharat/�ark�teri on first page; user expected other values to appear across clicks for group/category.
- Changes: Updated products API ORDER BY logic: only when `sort_by` is `group` or `category`, apply interleaved ordering via `ROW_NUMBER() OVER (PARTITION BY ...)` so first page does not collapse into a single dominant value block. All other headers keep standard ASC/DESC ordering.
- Files: api/products/index.php
- Checks: php -l api/products/index.php; direct SQL spot check confirmed first page includes 15 distinct groups in group-sort mode.
- Risk/Follow-up: Interleaved mode is intentionally different from strict block ordering for these two columns; if needed, can be toggled by query flag later.
## 2026-03-09 - revert interleaved group/category sorting to strict block order
- Request: User wants same values to appear consecutively (e.g., all �ark�teri rows together), not interleaved every few rows.
- Changes: Removed temporary interleaved ORDER BY logic for `group/category` in products API. Restored strict sort order for all headers: `sortExpr sortDir NULLS LAST, LOWER(name), id`.
- Files: api/products/index.php
- Checks: php -l api/products/index.php
- Risk/Follow-up: With strict block order + pagination, first page may naturally show only one/few dominant values depending on sort direction and distribution.
## 2026-03-09 - hybrid block+cycle sorting for product group/category headers
- Request: Need both behaviors together: keep same values in contiguous blocks, but each header click should bring a different value block to top.
- Changes: Added DataTable `onSortChange` hook. In ProductList, implemented click-cycle anchors for `group` and `category` (rotating selected value per click). API `/products` now accepts optional `sort_anchor`; for `group/category` sorts it prioritizes the anchored value block first via `CASE WHEN ... THEN 0`. Remaining rows stay in normal block sorting (`sortExpr`, then name, id).
- Files: public/assets/js/components/DataTable.js, public/assets/js/pages/products/ProductList.js, api/products/index.php
- Checks: node --check public/assets/js/components/DataTable.js; node --check public/assets/js/pages/products/ProductList.js; php -l api/products/index.php; SQL spot-check for anchor-first block ordering.
- Risk/Follow-up: Category cycle source currently derives from category filter options; if you want cycle strictly from product-used categories only, we can add a dedicated `/products/categories` endpoint.
## 2026-03-09 - fix sort-cycle anchor stuck on same value
- Request: After hybrid block+cycle sort change, table still showed single value repeatedly.
- Root cause: In ProductList sort-cycle logic, index was reset on every direction change (ASC/DESC), and DataTable toggles direction each click on same header, so anchor remained first value.
- Changes: Updated `handleSortCycle()` to reset cycle index only when sort column changes, not when direction changes.
- Files: public/assets/js/pages/products/ProductList.js
- Checks: node --check public/assets/js/pages/products/ProductList.js
- Risk/Follow-up: Cycle now progresses every click on same header; if desired, we can later separate sort direction toggle from cycle action with modifier key.
## 2026-03-09 - category header cycle made group-aware
- Request: Group header behavior is OK; category should cycle similarly but according to selected group.
- Changes: In ProductList, added `loadCategoryCycleMap()` to build category sets per group from products API. Updated category sort-cycle logic to use selected group's category list when `filter-group` is set; fallback to global categories otherwise.
- Files: public/assets/js/pages/products/ProductList.js
- Checks: node --check public/assets/js/pages/products/ProductList.js
- Risk/Follow-up: Category cycle map is loaded once on page init (from up to 5000 products); if product/category data changes live during session, page refresh updates the map.
## 2026-03-09 - detailed reference doc for hybrid products table sorting model
- Request: Document current table sorting configuration in detail so it can be used as reference on other pages.
- Changes: Added `docs/PRODUCTS_TABLE_SORTING_REFERENCE.md` with architecture, file responsibilities, sort modes, state model, API contract (`sort_anchor`), group-aware category cycle, pagination/filter interactions, reuse template, constraints, and validation checklist.
- Files: docs/PRODUCTS_TABLE_SORTING_REFERENCE.md
- Checks: No code checks required (documentation-only change).
- Risk/Follow-up: If sort behavior evolves, this reference should be updated in same PR to keep it authoritative.
## 2026-03-09 - ubuntu server version recommendation for customer VM
- Request: Customer will create a VM for this project; asked whether Ubuntu 22 is enough or Ubuntu 24.04 LTS x64 should be preferred.
- Changes: No runtime code changes. Reviewed deployment stack/docs and recommended OS choice based on repository deployment scripts and containerized architecture.
- Files: .codex/CHANGE_MEMORY.md
- Checks: No applicable code syntax check (documentation/memory-only update).
- Risk/Follow-up: If deployment will be non-Docker/native package install, pin exact package versions (PHP, extensions, PostgreSQL client tools) before go-live.
## 2026-03-09 - memory lookup: media listener leak fix note retrieval
- Request: Find the note about the repeated operation/listener leak fixed in media after midnight.
- Changes: Searched CHANGE_MEMORY and identified the matching entry (global cursor freeze root-cause fix via hover-listener cleanup) with media/template listener cleanup details.
- Files: .codex/CHANGE_MEMORY.md
- Checks: No code checks required (memory lookup/documentation-only).
- Risk/Follow-up: None.
## 2026-03-09 - leak audit for similar repeated-listener issues
- Request: Inspect project for leaks similar to previously fixed media/template repeated hover listener issue.
- Changes: Performed targeted static audit across frontend for global listeners/timers/cleanup matching. Identified high-confidence leak risks in LayoutManager selector binding and ProductForm submodule cleanup chain; confirmed previously fixed media/template hover listeners are currently cleaned up.
- Files: .codex/CHANGE_MEMORY.md
- Checks: No code checks required (inspection-only, memory update).
- Risk/Follow-up: Findings are not patched yet; recommended next step is implementing idempotent bind/unbind with stored handler refs in LayoutManager + selector components and explicit ProductForm submodule destroy calls.
## 2026-03-09 - leak hardening: layout/selectors + product form submodule cleanup
- Request: Implement the 3 critical leak fixes (LayoutManager global listener accumulation, selector outside-click rebinding leaks, ProductForm/PriceHistorySection cleanup chain), using temp backups and verify correctness.
- Changes: Created temp backups at .codex/tmp_backups/20260309_231055. Added idempotent outside-click binding + destroy() cleanup to CompanySelector/BranchSelector/LanguageSelector. Hardened LayoutManager with stored global handler refs and remove-before-add in setup/bind flows; added comprehensive listener cleanup + selector destroy calls in LayoutManager.destroy(). Added managed document-click handler cleanup to PriceHistorySection. Updated ProductForm.destroy() to explicitly destroy submodules (mediaPicker, barcodeSection, halKunyeSection, priceHistorySection).
- Files: public/assets/js/layouts/LayoutManager.js, public/assets/js/components/CompanySelector.js, public/assets/js/components/BranchSelector.js, public/assets/js/components/LanguageSelector.js, public/assets/js/pages/products/form/PriceHistorySection.js, public/assets/js/pages/products/ProductForm.js, .codex/CHANGE_MEMORY.md
- Checks: node --check public/assets/js/layouts/LayoutManager.js; node --check public/assets/js/components/CompanySelector.js; node --check public/assets/js/components/BranchSelector.js; node --check public/assets/js/components/LanguageSelector.js; node --check public/assets/js/pages/products/form/PriceHistorySection.js; node --check public/assets/js/pages/products/ProductForm.js
- Risk/Follow-up: Runtime behavior is preserved, but listeners are now lifecycle-managed. If any selector is re-instantiated outside LayoutManager flow, existing destroy() should be called before replacing instance.
- Backup/Restore Safety: Backup created before edits; restore not needed.
## 2026-03-09 - post-fix bug check for leak hardening changes
- Request: Run bug control after applying 3 critical leak fixes.
- Changes: Reviewed git diff for all patched files and re-checked syntax. Verified listener add/remove pairing and lifecycle cleanup wiring in selectors, LayoutManager, ProductForm, and PriceHistorySection.
- Files: .codex/CHANGE_MEMORY.md
- Checks: node --check public/assets/js/layouts/LayoutManager.js; node --check public/assets/js/components/CompanySelector.js; node --check public/assets/js/components/BranchSelector.js; node --check public/assets/js/components/LanguageSelector.js; node --check public/assets/js/pages/products/form/PriceHistorySection.js; node --check public/assets/js/pages/products/ProductForm.js; static pairing checks via rg.
- Risk/Follow-up: No blocking bug found in static review; runtime validation on layout switch + selector open/close + product form open/close flow is still recommended.
## 2026-03-09 - full project bug check (global)
- Request: Run bug control for the whole project (not only recent patches).
- Changes: Performed global syntax and static risk audit across active PHP/JS code, plus listener/timer cleanup heuristics.
- Files: .codex/CHANGE_MEMORY.md
- Checks: Active PHP lint scan (excluding backup/vendor/web-build/html-editor): PHP_TOTAL_ACTIVE=569, PHP_FAIL_ACTIVE=0; JS syntax scan: JS_TOTAL=141, JS_FAIL_COUNT=0; static scans for listener/timer mismatch and global click listener accumulation hotspots.
- Risk/Follow-up: High-risk global listener accumulation detected in DataTable and several page-level export/modal bindings; recommend converting anonymous document listeners to stored handler refs with cleanup in destroy.
## 2026-03-09 - global listener leak hardening across project pages/components
- Request: Patch global project leak hotspots (not patch-only scope) with temp backup, preserve encoding, and run checks.
- Changes: Created temp backup at .codex/tmp_backups/20260309_232728. Added stored-handler + remove-before-add + destroy cleanup patterns to DataTable global listeners (document/window/scroll targets), BundleForm delegated document listeners, ProductList export dropdown outside-click listener, BundleList export dropdown outside-click listener, NotificationList modal outside-click listener, and ExportManager static dropdown helper (idempotent outside-click + cleanup return).
- Files: public/assets/js/components/DataTable.js, public/assets/js/pages/bundles/BundleForm.js, public/assets/js/pages/products/ProductList.js, public/assets/js/pages/bundles/BundleList.js, public/assets/js/pages/notifications/NotificationList.js, public/assets/js/utils/ExportManager.js, .codex/CHANGE_MEMORY.md
- Checks: node --check public/assets/js/components/DataTable.js; node --check public/assets/js/pages/bundles/BundleForm.js; node --check public/assets/js/pages/products/ProductList.js; node --check public/assets/js/pages/bundles/BundleList.js; node --check public/assets/js/pages/notifications/NotificationList.js; node --check public/assets/js/utils/ExportManager.js; static listener cleanup verification via rg removeEventListener scan.
- Risk/Follow-up: Runtime behavior preserved; if another page reimplements custom dropdown outside-click logic with anonymous listeners, same pattern should be migrated to stored handlers.
- Backup/Restore Safety: Backup created; restore not required.
## 2026-03-09 - disable per-request DB migration in API bootstrap
- Request: Remove unnecessary $db->migrate() execution from pi/index.php on every API request.
- Changes: Removed runtime migration call from API bootstrap database init block; added note that migrations must be executed via deployment/maintenance workflow.
- Files: api/index.php, .codex/CHANGE_MEMORY.md
- Checks: php -l api/index.php
- Risk/Follow-up: New schema files will no longer auto-apply during normal traffic; ensure deployment pipeline runs migration explicitly before release.
## 2026-03-09 - API latency optimization pass (bootstrap + products + devices + media)
- Request: Improve API response speed globally; keep temp backup, preserve encoding, and run checks.
- Changes: Created temp backup at .codex/tmp_backups/20260309_233701. (1) pi/index.php: removed per-request migration earlier and added shutdown-based API duration logging so successful responses that exit via Response::json are still logged. (2) pi/products/index.php: replaced broad device/template fetches with page-scoped assigned ID lookups (IN (...)), removed duplicate template lookup query. (3) pi/devices/index.php: added short TTL cache (storage/cache/api/hanshow_esl_status_<company>.json) for Hanshow battery enrichment and reduced remote call timeout to 1s/1s with stale-cache fallback. (4) pi/media/index.php: made skip_validation default 1 to avoid per-item is_file() disk I/O on normal list requests.
- Files: api/index.php, api/products/index.php, api/devices/index.php, api/media/index.php, .codex/CHANGE_MEMORY.md
- Checks: php -l api/index.php; php -l api/products/index.php; php -l api/devices/index.php; php -l api/media/index.php; static verification via rg for optimization hooks.
- Risk/Follow-up: Media list now trusts DB paths by default (faster); missing files may appear until scan/cleanup runs. Hanshow cache TTL is 30s; adjust if fresher status is required.
- Backup/Restore Safety: Backup created; restore not needed.
## 2026-03-09 - system-status live metric correctness + external API monitor + deploy checklist
- Request: Verify #/admin/system-status live API measurement correctness, fix any wrong live data flow, add long-running monitor script outside project, and prepare deploy precheck checklist.
- Changes: (1) pi/system/status.php live metrics now come from real storage/logs/api.log parsing via new collectApiLogMetrics() helper; removed simulated/random response-time behavior and API_START_TIME dependency. (2) Added external monitor page at C:/Users/test/.codex/memories/API_LIVE_MONITOR.html with long-running polling, per-endpoint stats (avg/p50/p95/p99, error rate), localStorage log retention, JSON/CSV export, and sanity check for /system/status?live_only=1. (3) Added deploy checklist at C:/Users/test/.codex/memories/DEPLOY_PRECHECK_CHECKLIST.md.
- Files: api/system/status.php, C:/Users/test/.codex/memories/API_LIVE_MONITOR.html, C:/Users/test/.codex/memories/DEPLOY_PRECHECK_CHECKLIST.md, .codex/CHANGE_MEMORY.md
- Checks: php -l api/system/status.php; static verification via rg for live-metric source update (collectApiLogMetrics usage, no random response-time logic).
- Risk/Follow-up: pi.log based metrics depend on log write health and timestamp consistency; if log path permissions fail, live metrics degrade to zeros.
- Backup/Restore Safety: Temp backup created at .codex/tmp_backups/20260309_234456; restore not needed.
## 2026-03-09 - live monitor stabilization + live stat cards + api log cleanup + DB API index migration pack
- Request: Share exact live monitor file/link, make system-status top cards update live, investigate high live error percentage (~45%) and clean old API logs if needed, produce DB index migration plan/script (products/devices/media), and provide deploy checklist/control results.
- Changes: (1) `api/system/status.php` live payload extended with `quick_stats` (uptime/cpu/memory) for 3s card updates and `client_error_rate`; `error_rate` now tracks server-side 5xx only to avoid 4xx auth noise inflation. (2) `public/assets/js/pages/admin/SystemStatus.js` now updates top quick stat cards during live polling via `renderQuickStatsFromLive(...)`. (3) External monitor `C:/Users/test/.codex/memories/API_LIVE_MONITOR.html` enhanced with separate `4xx%` and `5xx%` columns to explain high error ratios. (4) Added PostgreSQL API performance migration file `database/postgresql/v2/43_api_perf_indexes.sql` (products/devices/media list/search/sort indexes) and registered it in `core/Database.php` schema file order. (5) API log cleanup with safety: archived `storage/logs/archive/api_20260309_235835.log` then truncated active `storage/logs/api.log` (lock-safe stream truncate).
- Files: api/system/status.php, public/assets/js/pages/admin/SystemStatus.js, C:/Users/test/.codex/memories/API_LIVE_MONITOR.html, database/postgresql/v2/43_api_perf_indexes.sql, core/Database.php, .codex/CHANGE_MEMORY.md
- Checks: php -l api/system/status.php; node --check public/assets/js/pages/admin/SystemStatus.js; php -l core/Database.php; static verification via rg (`quick_stats`, `client_error_rate`, `collectQuickStatsForLiveCards`, `43_api_perf_indexes.sql` registration); api.log size/timestamp verification after truncate.
- Risk/Follow-up: New indexes are additive and safe (`IF NOT EXISTS`) but should still be validated with EXPLAIN ANALYZE on production-like data before/after migration. 5xx-based `error_rate` is operationally cleaner; if business wants total non-2xx visibility in UI, surface `client_error_rate` separately in frontend.
- Backup/Restore Safety: Temp backup created at `.codex/tmp_backups/20260309_235621`; api.log archived before cleanup at `storage/logs/archive/api_20260309_235835.log`; restore not needed.
- Follow-up artifact: Added run report C:/Users/test/.codex/memories/DEPLOY_PRECHECK_RUN_2026-03-09.md with completed controls and remaining manual validations.
- Deployment-step check: Ran php database/migrate.php successfully after adding v2 index script (43_api_perf_indexes.sql).
## 2026-03-10 - DB explain-analyze validation for products/devices/media API paths
- Request: Proceed with next step to run EXPLAIN ANALYZE and validate index impact for API list/search/sort hot paths.
- Changes: Executed targeted EXPLAIN (ANALYZE, BUFFERS) queries against real local PostgreSQL data for products/devices/media patterns; produced report artifact at `C:/Users/test/.codex/memories/DB_EXPLAIN_ANALYZE_REPORT_2026-03-10.md`.
- Files: .codex/CHANGE_MEMORY.md, C:/Users/test/.codex/memories/DB_EXPLAIN_ANALYZE_REPORT_2026-03-10.md
- Checks: Runtime DB plan checks via `php .codex/tmp_explain.php` and `php .codex/tmp_explain_devices.php` (temporary scripts removed after run).
- Risk/Follow-up: Local tenant data is small (especially devices), so some plans correctly favor Seq Scan; repeat same EXPLAIN set on production-like dataset for final index efficacy confirmation.
- Backup/Restore Safety: No production code files modified; no backup required.
## 2026-03-10 - before/after DB plan-cost comparison table (simulated no-index baseline)
- Request: Continue and provide direct before/after plan + cost comparison for products/devices/media query paths.
- Changes: Ran safe comparative benchmark with indexes ON vs simulated OFF (`enable_indexscan=off`, `enable_bitmapscan=off`) and generated (1) machine-readable output `.codex/plan_compare_results.json`, (2) human report `C:/Users/test/.codex/memories/DB_PLAN_BEFORE_AFTER_2026-03-10.md`.
- Files: .codex/CHANGE_MEMORY.md, .codex/plan_compare_results.json, C:/Users/test/.codex/memories/DB_PLAN_BEFORE_AFTER_2026-03-10.md
- Checks: Runtime DB benchmark execution via `php .codex/tmp_plan_compare.php` (temporary script removed after run).
- Risk/Follow-up: �Before� side is simulated planner behavior without index scans, not physical index drop; for final production sign-off, repeat on production-like dataset during low-traffic window.
- Backup/Restore Safety: No application code modified; no backup required.
## 2026-03-10 - local vs prod-like DB plan comparison completed
- Request: Continue with production-like comparison and provide local vs prod-like difference table.
- Changes: Built prod-like benchmark using TEMP scaled tables, generated `.codex/plan_compare_prodlike_results.json`, and created consolidated comparison report `C:/Users/test/.codex/memories/DB_PLAN_LOCAL_VS_PRODLIKE_2026-03-10.md` against prior local benchmark outputs.
- Files: .codex/CHANGE_MEMORY.md, .codex/plan_compare_prodlike_results.json, C:/Users/test/.codex/memories/DB_PLAN_LOCAL_VS_PRODLIKE_2026-03-10.md
- Checks: Runtime DB benchmark run via `php .codex/tmp_plan_compare_prodlike.php` (temporary script removed after execution).
- Risk/Follow-up: Prod-like dataset is simulated via duplication in TEMP tables; real production skew/cardinality may differ slightly. For final release, re-run same scripts against staging snapshot if available.
- Backup/Restore Safety: No application code or persistent DB tables modified.
## 2026-03-10 - deploy checklist verification pass and readiness decision
- Request: Verify deploy checklist items and report whether system is ready for release.
- Changes: Executed automated checklist checks (migration execution, log writability, DB health, lock wait count, endpoint reachability without auth, disk free space) and produced readiness report `C:/Users/test/.codex/memories/DEPLOY_READINESS_STATUS_2026-03-10.md` with PASS/PARTIAL/PENDING matrix and release decision.
- Files: .codex/CHANGE_MEMORY.md, C:/Users/test/.codex/memories/DEPLOY_READINESS_STATUS_2026-03-10.md
- Checks: `php database/migrate.php`; log writable append test on `storage/logs/api.log`; DB connectivity + `SELECT now()` + waiting lock count (`pg_locks` not granted = 0); unauthenticated endpoint reachability probe on `/system/status?live_only=1`, `/products`, `/devices`, `/media`, `/templates`, `/bundles`, `/notifications` (HTTP 401 expected); disk free check via `System.IO.DriveInfo`.
- Risk/Follow-up: Go-live is still blocked by manual authenticated smoke tests and 30+ minute live monitor baseline/sign-off items.
- Backup/Restore Safety: No production code changed; no restore required.
## 2026-03-10 - authenticated smoke + operational sign-off checks executed
- Request: While user runs live monitor, verify authenticated UI/API functional smoke and operational sign-off items (backup/rollback drill, alarm routing).
- Changes: Executed non-destructive auth/API smoke with temporary SuperAdmin users (created+cleaned): login/session/refresh/logout and protected list endpoints (`/products`, `/devices`, `/media`, `/templates`) all 200. Executed backup/rollback pipeline drill: `tenant-backup export -> download -> peek-manifest -> delete` all 200. Verified alert routing path: `/api/logs/notify-settings` GET/PUT 200 and `/api/logs/send-report` 200 with in-app notification delivery; SMTP warning observed (email channel not configured).
- Files: C:/Users/test/.codex/memories/DEPLOY_READINESS_STATUS_2026-03-10.md, .codex/CHANGE_MEMORY.md
- Checks: `php scripts/test_endpoints_smoke.php --base-url=http://127.0.0.1/market-etiket-sistemi --email=admin@omnexcore.com --password=...` (failed due invalid default creds, script health-path mismatch); custom temporary smoke runs via `php .codex/tmp_auth_ops_smoke.php`, `php .codex/tmp_backup_drill.php`, `php .codex/tmp_alarm_routing_check.php` (all pass, temp scripts removed).
- Risk/Follow-up: SMTP not configured, so email alert leg is pending; in-app alert path is working. Final go-live gate remains 30+ min monitor baseline with P95/error targets.
- Backup/Restore Safety: Temporary test users/sessions were cleaned up; backup artifact created during drill was deleted via API.
## 2026-03-10 - SMTP alarm channel hardening + signoff rerun
- Request: Complete remaining deploy gaps before live monitor result: finish SMTP-based alarm channel and run final manual UI smoke/operational sign-off checks.
- Changes: Patched `services/SmtpMailer.php` for robust SMTP failure handling and integration compatibility. Added warning-safe socket open (no global warning-to-500 leak), guarded all SMTP response reads against non-string values, tightened EHLO/AUTH/TLS error branches, and widened catch to `Throwable` to prevent uncaught runtime fatals. Re-ran authenticated operational smoke via temporary scripts and saved report artifacts.
- Files: services/SmtpMailer.php, C:/Users/test/.codex/memories/SIGNOFF_API_SMOKE_2026-03-10.json, C:/Users/test/.codex/memories/DEPLOY_SIGNOFF_UPDATE_2026-03-10.md, C:/Users/test/.codex/memories/MANUAL_UI_OPS_SIGNOFF_TEMPLATE_2026-03-10.md, .codex/CHANGE_MEMORY.md
- Checks: php -l services/SmtpMailer.php; SMTP wiring smoke (`php .codex/tmp_smtp_wiring_check.php`, temporary, removed) -> `/api/logs/send-report` now 200 under SMTP connection failure path; final signoff smoke (`php .codex/tmp_final_signoff_check.php`, temporary, removed) -> pass=18 fail=1 with only `tenant-backup/peek-manifest` archive-format mismatch.
- Risk/Follow-up: Real SMTP delivery still depends on valid SMTP credentials/network reachability in environment. `tenant-backup/peek-manifest` should be revalidated using a known-valid restore archive format before final go-live sign-off.
- Backup/Restore Safety: Temp backup created before SMTP edit at `.codex/tmp_backups/20260310_003804/SmtpMailer.php.bak`; restore not required.
## 2026-03-10 - monitor log analysis (api-monitor-log-1773092771761)
- Request: Analyze monitor output file and report current live status before proceeding.
- Changes: No source code changes. Reviewed monitor dataset at `kutuphane/api-monitor-log-1773092771761.json` and extracted error/latency distribution and anomaly root cause signals.
- Files: .codex/CHANGE_MEMORY.md
- Checks: Data analysis via PowerShell JSON parsing (status distribution, endpoint-level p95/p99, single 500 extraction, timespan extraction).
- Risk/Follow-up: Dataset is not valid for true API functional/perf sign-off because 99.97% requests are unauthorized (401). One 500 came from rate-limit cache read in middleware (`ApiGuardMiddleware.php:288`) due permission denied on cache file read.
- Backup/Restore Safety: No code edit; backup not required.
## 2026-03-10 - API live monitor auth flow hardening + request-count clarity
- Request: Make monitor run with auth token and explain whether 2888 requests in ~43 minutes indicates extra/unexpected API traffic.
- Changes: Updated external monitor page `C:/Users/test/.codex/memories/API_LIVE_MONITOR.html` with (1) Login email/password + `Login & Use Token` button (calls `/api/auth/login` and fills bearer token), (2) `Load omnex_token` helper from localStorage, (3) stop-on-401 safety switch (default on), (4) summary counters for total requests / endpoint count / poll-cycle estimate / 4xx-5xx totals. Kept password out of persisted localStorage monitor config.
- Files: C:/Users/test/.codex/memories/API_LIVE_MONITOR.html, .codex/CHANGE_MEMORY.md
- Checks: Runtime data validation against user-provided monitor log (`api-monitor-log-1773092771761.json`) with PowerShell JSON analysis (status distribution, per-endpoint counts, cycle math, effective cycle interval).
- Risk/Follow-up: Monitor file is outside app build and depends on browser context/localStorage token availability. For production-like measurement, run monitor in authenticated session with stable foreground tab to reduce browser timer throttling effects.
- Backup/Restore Safety: Backup created before edit at `.codex/tmp_backups/20260310_005409/API_LIVE_MONITOR.html.bak`; restore not required.
## 2026-03-10 - pending items review + SMTP source verification
- Request: While authenticated monitor run continues, review pending items and verify saved mail settings.
- Changes: No persistent application code changes. Performed runtime verification for SMTP wiring state and pending deploy gates.
- Files: .codex/CHANGE_MEMORY.md
- Checks: Temporary authenticated smoke (`/api/smtp/settings?scope=system`, `/api/logs/send-report`) and DB inspection of SMTP config sources (`settings` legacy JSON vs `integration_settings` smtp rows).
- Risk/Follow-up: SMTP currently works via legacy `settings` source (`smtp.yandex.com`), while `integration_settings` system smtp row is disabled/empty. This dual-source mismatch can confuse UI/status; align by saving active SMTP into integration settings model or migrate legacy row.
- Backup/Restore Safety: No code edit; no backup needed.
## 2026-03-10 - SMTP new-model migration + settings UI wiring
- Request: Move mail settings to new integration model and bind frontend settings design to new structure, keep legacy for now, and audit old/new references before removal.
- Changes: (1) `api/smtp/settings.php` now hydrates missing new-model SMTP config from legacy `settings.data` (`smtp_*`) on read, persisting into `integration_settings` (system/company scope aware). (2) `public/assets/js/pages/settings/GeneralSettings.js` SMTP tab decoupled from `/settings`; it now loads/saves SMTP via `/smtp/settings` (`?scope=system` for SuperAdmin), while `/settings` remains for non-SMTP general/barcode fields. (3) Save flow updated to persist SMTP + general settings in one submit without leaking empty password overwrite.
- Files: api/smtp/settings.php, public/assets/js/pages/settings/GeneralSettings.js, .codex/CHANGE_MEMORY.md
- Checks: php -l api/smtp/settings.php; node --check public/assets/js/pages/settings/GeneralSettings.js; runtime migration verification via temporary script (`GET /api/smtp/settings?scope=system` -> configured=true and integration_settings row populated/active).
- Risk/Follow-up: Legacy fallback paths still exist intentionally (`SmtpMailer` + hydrate helper) until post-validation cleanup decision. After user confirmation, legacy SMTP reads in `SmtpMailer` and legacy hydrate branch in `api/smtp/settings.php` can be removed in a dedicated cleanup pass.
- Backup/Restore Safety: Backups created at `.codex/tmp_backups/20260310_011801` before edits; restore not required.
## 2026-03-10 - Docker tenant-backup migration repair and full missing-step completion
- Request: Investigate Docker tenant-backup 500 error (`relation tenant_backups does not exist`) and safely run all missing migrations without data loss.
- Changes: No repository code change in this step; applied non-destructive DB repair/migration operations in running Docker stack (`omnex-test-app` / `omnex-test-postgres`).
- Actions run:
  1) Verified Docker stack and DB migration markers (`core.migrations`) in `omnex_hub`.
  2) Found runtime mismatch: app image did not include `database/migrate.php` and did not include `43_api_perf_indexes.sql` in container migration list.
  3) Applied idempotent repair SQL to create `audit.tenant_backups` + FK constraints + indexes + RLS policy (all guarded with IF NOT EXISTS / DO checks).
  4) Applied missing migration file `43_api_perf_indexes.sql` directly to Docker PostgreSQL and inserted marker `pg:43_api_perf_indexes.sql` into `core.migrations`.
  5) Verified service-level query path with `TenantBackupService::getCompanyBackupSummary()` inside container (`SUMMARY_OK`).
- Files: .codex/CHANGE_MEMORY.md
- Checks: docker ps; docker exec psql table existence checks; docker exec app service-level smoke; migration marker list re-check includes `pg:43_api_perf_indexes.sql`.
- Risk/Follow-up: Container image code is older than workspace (missing some latest files/steps). For durable parity, rebuild/redeploy Docker app image from current repo state to keep future migrations consistent.
- Backup/Restore Safety: Operations were additive/idempotent (create-if-missing and index additions), no destructive DDL or data deletion performed.
## 2026-03-10 - Docker first-install auto bootstrap + health + tenant-backup valid-archive verification
- Request: Ensure Docker full rebuild state is correct, confirm first migrations/seeders (default user/company) behavior, and verify `tenant-backup/peek-manifest` with a valid restore archive.
- Changes:
  - Added early `/api/health` short-circuit in API entrypoint so Docker health check always resolves.
  - Added Docker app entrypoint script to run idempotent PostgreSQL `migrate_seed.php` automatically on container startup.
  - Hardened entrypoint permission flow: normalize `storage` ownership/permissions both before and after migrate+seed to prevent `storage/logs/app.log` permission-denied runtime failures.
- Files:
  - api/index.php
  - deploy/Dockerfile
  - deploy/scripts/docker-app-entrypoint.sh
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l api/index.php`
  - `docker compose -f deploy/docker-compose.local.yml build --no-cache`
  - `docker compose -f deploy/docker-compose.local.yml up -d`
  - `docker compose -f deploy/docker-compose.local.yml ps` -> app/postgres healthy
  - Startup log confirms `PostgreSQL migrate+seed OK` and `/api/health` returns 200
  - DB checks: `core.companies=1`, `core.users=2`, `core.migrations` contains `seed:php:all`, `audit.tenant_backups` exists
  - End-to-end tenant-backup validation: login -> export -> download -> `peek-manifest` -> delete; `peek-manifest` result `success=true`, message `Ar�iv bilgileri okundu`
- Risk/Follow-up:
  - Entrypoint currently runs migrate+seed at every container start (idempotent; seed runs once via marker). Startup time impact is acceptable for now; can be gated via dedicated env flag in production if needed.
- Backup/Restore Safety:
  - Temp backups created before edits:
    - `.codex/tmp_backups/20260310_014821-docker-bootstrap/`
    - `.codex/tmp_backups/20260310_015516-entrypoint-fix/`
  - No destructive data operation applied.
## 2026-03-10 - Seed/admin email domain alignment to omnexcore.com
- Request: Ensure SuperAdmin/initial user emails use `@omnexcore.com` domain.
- Changes:
  - Updated existing Docker DB SuperAdmin email from `admin@omnex.local` to `admin@omnexcore.com`.
  - Updated Docker local compose seed env: `OMNEX_ADMIN_EMAIL=admin@omnexcore.com`.
  - Updated base compose default fallback: `OMNEX_ADMIN_EMAIL` default from `admin@example.com` to `admin@omnexcore.com`.
- Files:
  - deploy/docker-compose.local.yml
  - deploy/docker-compose.yml
  - .codex/CHANGE_MEMORY.md
- Checks:
  - DB user verification query before/after update (`core.users`).
  - API login smoke with new email: `POST /api/auth/login` -> success=true, user.email=`admin@omnexcore.com`.
- Risk/Follow-up:
  - Existing environments with previously seeded different admin emails are not auto-migrated unless DB update is applied there too.
- Backup/Restore Safety:
  - Temp backups created: `.codex/tmp_backups/20260310_020823-omnexcore-mail-domain/`.
  - No destructive operation performed.
## 2026-03-10 - API live monitor freeze/unresponsive mitigation (file:// use)
- Request: Investigate why `API_LIVE_MONITOR.html` opened via `file:///...` appears unresponsive/frozen and ensure monitor behavior is clear.
- Changes:
  - Reduced in-browser log retention from 200000 to 10000 records.
  - Added `STATS_WINDOW` (3000) so heavy summary calculations run on recent window instead of full history.
  - Added in-flight poll guard to prevent overlapping polling loops.
  - Added startup hint for `file://` mode reminding correct Base URL (`http://127.0.0.1:3000/api`).
  - Added log trimming on load/persist to avoid localStorage growth freeze.
- Files:
  - C:/Users/test/.codex/memories/API_LIVE_MONITOR.html
  - .codex/CHANGE_MEMORY.md
- Checks:
  - Static verification via `rg` for updated constants/functions and callsites.
  - Manual behavior verification pending in browser (requires user-side open/reload).
- Risk/Follow-up:
  - Existing old localStorage payload can still affect currently open tab until hard refresh/reopen.
- Backup/Restore Safety:
  - Temp backup created: `C:/Users/test/.codex/memories/tmp_backups/20260310_022003-monitor-freeze-fix/API_LIVE_MONITOR.html.bak`.
## 2026-03-10 - API monitor CORS clarification + same-origin access enablement
- Request: Resolve `file://` monitor CORS failures (`origin null`) when calling `http://127.0.0.1:3000/api/...`.
- Changes:
  - Confirmed CORS block is expected for `file://` origin against API host.
  - Published monitor HTML into app-served static path and synced into running container for immediate use.
  - Verified reachable URL: `http://127.0.0.1:3000/assets/API_LIVE_MONITOR.html` (HTTP 200).
- Files:
  - public/API_LIVE_MONITOR.html
  - public/assets/API_LIVE_MONITOR.html
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `Invoke-WebRequest http://127.0.0.1:3000/assets/API_LIVE_MONITOR.html` -> 200.
- Risk/Follow-up:
  - `file://` opening will continue to fail by browser CORS policy; use same-origin URL above.
  - Since container is not bind-mounted for code, runtime `docker cp` was used for immediate availability; on next image rebuild files are already in workspace and should be included.
- Backup/Restore Safety:
  - Existing backup folder reused from this monitor fix pass; no destructive action.
## 2026-03-10 - pending items re-check (post monitor same-origin fix)
- Request: Re-evaluate remaining pending/go-live items after monitor + docker fixes.
- Changes: No source code change. Re-ran authenticated smoke checks and operational send-report check.
- Files: .codex/CHANGE_MEMORY.md
- Checks:
  - Auth API smoke (200): `/api/products`, `/api/devices`, `/api/media`, `/api/templates`, `/api/system/status?live_only=1`.
  - `/api/logs/send-report` re-tested with correct payload (`filename`, `recipient_ids`) -> success=true, in-app notification sent.
  - Observed warning: SMTP not configured in current Docker env, email leg skipped.
- Risk/Follow-up:
  - Remaining release gates are still human/manual: 30+ min authenticated monitor baseline report and QA/Ops/TechLead sign-off.
  - SMTP email delivery remains environment-config dependent; current Docker env still reports SMTP missing.
- Backup/Restore Safety: No edits made.
## 2026-03-10 - Docker SMTP channel verification (email leg active)
- Request: Re-test SMTP in Docker after user-side SMTP config update.
- Changes: No code changes. Performed runtime verification only.
- Files: .codex/CHANGE_MEMORY.md
- Checks:
  - `GET /api/smtp/settings?scope=system` -> `configured=true`, `enabled=true`, host `smtp.yandex.com`.
  - `POST /api/logs/send-report` with valid `filename` + `recipient_ids` -> success with `email_sent=1`, `notif_sent=1`.
- Risk/Follow-up:
  - SMTP leg now active in current Docker env. Remaining release gates are manual UI smoke and QA/Ops/Tech Lead operational sign-off.
- Backup/Restore Safety: No edits, no backup needed.
## 2026-03-10 - p95 spike analysis from monitor JSON + system/templates latency fixes
- Request: Analyze `kutuphane/api-monitor-log-1773099280017.json` in detail and fix high p95 endpoints.
- Findings:
  - Raw monitor dataset: 608 records, all HTTP 200, span ~486s.
  - Correct numeric parsing (comma/dot normalized) shows global p95 ~110.8ms; notable outlier was `system/status?live_only=1` max ~1957.5ms.
  - Server-side `api.log` showed `/api/templates` runtime ~50-60ms; high client-side durations were dominated by large response payload parsing.
  - `templates` list payload measured ~1.18MB for 9 rows due inline `data:` previews.
- Changes:
  1) `api/system/status.php`
     - `collectApiLogMetrics()` optimized to avoid full-file reads (`file()`): now tail-reads recent chunk only.
     - Added short TTL JSON cache for live metrics keyed by api.log mtime.
     - Added short TTL cache for `collectQuickStatsForLiveCards()`.
  2) `api/templates/index.php`
     - Added lean list mode defaults: heavy inline preview blobs disabled by default.
     - New query toggles:
       - `include_content=1` returns `design_data` payload.
       - `include_preview_data=1` returns inline `data:` preview blobs.
     - Default list now strips `data:` previews (`preview_image=null`) to reduce transfer/parse overhead.
- Files:
  - api/system/status.php
  - api/templates/index.php
  - .codex/CHANGE_MEMORY.md
- Checks:
  - `php -l api/system/status.php`
  - `php -l api/templates/index.php`
  - Runtime benchmark (auth, Docker app) after activating changes:
    - `/api/system/status?live_only=1` p95 ~50.63ms, p99 ~61.98ms
    - `/api/system/status` p95 ~109.45ms, p99 ~118.2ms
    - `/api/templates?page=1&per_page=20` p95 ~77.93ms, p99 ~84.74ms
    - `/api/templates?...&include_preview_data=1` p95 ~355.8ms (expected heavy mode)
  - Payload check:
    - templates default response size reduced from ~1,186,618 bytes to ~5,546 bytes (9 rows test).
- Risk/Follow-up:
  - Inline preview images are now disabled by default in list API; UI falls back to placeholder unless caller opts-in with `include_preview_data=1`.
  - For permanent Docker parity, rebuild/redeploy image from workspace state (runtime `docker cp + restart` used for immediate verification under OPcache constraints).
- Backup/Restore Safety:
  - Temp backups created:
    - `.codex/tmp_backups/20260310_023931-system-status-perf/`
    - `.codex/tmp_backups/20260310_024202-templates-list-perf/`
