Queue Send Troubleshooting and Fixes
====================================

Summary
-------
This document records the changes and findings that fixed "bulk send completes but devices do not update"
and slow/timeout behavior in `market-etiket-sistemi`.

Root Causes Found
----------------
1) Render cache invalidation was failing due to invalid JSON in `devices.current_content`.
   - SQLite `json_extract` calls fail when the JSON is malformed.
2) Bulk queue path was skipping real device communication.
   - `processDeviceRender()` used `model` even if it was an empty string, so device type fell through to
     "simulation" and finished instantly.
3) Frontend RenderWorker was not rendering template design_data correctly after refactor.
4) Browser render warnings and `file://` image URLs caused render worker failures and missing images.
5) Upload timeouts (10s) were too low for binary file uploads.

Changes Applied (Code)
----------------------
1) RenderWorker now uses TemplateRenderer to render templates (design_data).
   - File: `public/assets/js/components/RenderWorker.js`
   - Notes: Uses `getTemplateRenderer().render(template, product)` instead of manual canvas handling.

2) Normalize file paths and URLs for image/video sources and Fabric render.
   - File: `public/assets/js/utils/MediaUtils.js`
   - File: `public/assets/js/services/TemplateRenderer.js`
   - Notes:
     - Converts `file:///C:/...` and absolute Windows paths into `.../api/media/serve.php?path=...`.
     - Normalizes `textBaseline: "alphabetical"` to `"alphabetic"` to avoid CanvasTextBaseline errors.
     - Normalizes backgroundImage.src and nested object URLs.

3) Render cache lookup fallback for product assignments.
   - File: `services/RenderCacheService.php`
   - Notes:
     - If `devices.current_content` is missing, falls back to
       `products.assigned_device_id/assigned_template_id`.
     - De-duplicates assignments and filters empty template ids.

4) Render-cache check fallback to product template.
   - File: `api/render-cache/check.php`
   - Notes:
     - For `product_ids` checks, uses `products.assigned_template_id` if no device template found.

5) Queue device type resolution fixed (prevents "simulation" path).
   - File: `api/render-queue/process.php`
   - Notes:
     - `deviceType` now uses `model` only if non-empty, otherwise falls back to `type`.

6) Upload timeout increased for binary files (images/videos).
   - File: `services/PavoDisplayGateway.php`
   - Notes:
     - Added optional timeout override to `httpRequest`.
     - Binary uploads use at least 120s.

7) Gateway ping behavior clarified for direct send (no change needed beyond existing code).
   - File: `api/render-queue/process.php`
   - Notes:
     - Direct send path keeps ping; gateway mode skips ping.

Database Fixes
--------------
Malformed JSON in `devices.current_content` was cleared to restore render cache invalidation.

Cleared entries:
- `b60dc832-d213-44e5-8d4f-33b84b1c6dc0` (Grundig Google TV)
- `639bface-2f8a-46a9-b1c0-f79451f337c4` (Chrome / Desktop)

Result:
- `json_valid(current_content)=0` count went to 0.

How to Verify
-------------
1) Render cache status:
   - Check `render_cache` for `ready` rows (expected > 0).
2) Bulk send path:
   - `storage/logs/pavo_process.log` should update on new bulk sends.
   - Look for "processForPavoDisplay" and "Pre-rendered image kullaniliyor" lines.
3) Device logs:
   - `device_logs` should move from `pending` to `completed` or include errors.
4) Browser console:
   - `CanvasTextBaseline` warnings should be gone after hard refresh.
   - `file://` resource errors should be gone.

Notes
-----
- If bulk send still finishes "too fast", check device `model`/`type` values in `devices`.
- Ensure frontend assets are reloaded (hard refresh) after JS changes.
