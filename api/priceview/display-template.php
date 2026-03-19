<?php
/**
 * PriceView Product Display Template
 * GET /api/priceview/display-template
 *
 * Returns the product display HTML template for PriceView devices.
 * If a custom template is configured via priceview_product_display_template setting,
 * fetches that template and renders it with FabricToHtmlConverter.
 * Otherwise returns a default self-contained HTML template.
 *
 * The HTML uses {{placeholder}} variables that the APK replaces client-side:
 *   {{product_name}}, {{current_price}}, {{previous_price}}, {{barcode}},
 *   {{image_url}}, {{category}}, {{brand}}, {{unit}}, {{origin}},
 *   {{production_type}}, {{discount_percent}}, {{campaign_text}}, {{currency}}
 */

$db = Database::getInstance();
$device = DeviceAuthMiddleware::device();

if (!$device) {
    Response::unauthorized('Device authentication required');
}

$companyId = $device['company_id'];

// Read company settings
$settings = $db->fetch(
    "SELECT data FROM settings WHERE company_id = ? AND user_id IS NULL AND key = 'general'",
    [$companyId]
);
$settingsData = !empty($settings['data']) ? json_decode($settings['data'], true) ?: [] : [];

$customTemplateId = $settingsData['priceview_product_display_template'] ?? null;
$html = null;

// If a custom template is configured, try to render it via FabricToHtmlConverter
if ($customTemplateId) {
    $template = $db->fetch(
        "SELECT * FROM templates WHERE id = ? AND (company_id = ? OR scope = 'system') AND status = 'active'",
        [$customTemplateId, $companyId]
    );

    if ($template && !empty($template['content'])) {
        try {
            require_once __DIR__ . '/../../services/FabricToHtmlConverter.php';
            $converter = new FabricToHtmlConverter($companyId);
            $html = $converter->convert($template);
        } catch (\Exception $e) {
            // Fall through to default template
            $html = null;
        }
    }
}

// Default template if no custom one configured or conversion failed
if (!$html) {
    $html = getDefaultDisplayTemplate();
}

Response::success([
    'html' => $html,
    'mode' => $customTemplateId ? 'custom' : 'default',
    'template_id' => $customTemplateId,
    'server_time' => date('c')
]);

/**
 * Returns the default self-contained HTML template for PriceView product display.
 * Uses {{placeholder}} syntax for client-side variable replacement.
 */
function getDefaultDisplayTemplate(): string
{
    return <<<'HTML'
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>{{product_name}}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{
  width:100%;height:100%;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  background:#1a1a2e;color:#e0e0e0;
  overflow:hidden;
}
.pv-container{
  display:flex;flex-direction:column;
  width:100%;height:100%;
  padding:clamp(12px,2vw,24px);
  gap:clamp(8px,1.5vw,16px);
}
/* Top row: image + price block */
.pv-top{
  display:flex;
  gap:clamp(10px,2vw,20px);
  flex:1;min-height:0;
}
.pv-image-wrap{
  flex:0 0 auto;
  width:clamp(80px,25vw,220px);
  display:flex;align-items:center;justify-content:center;
  background:#16213e;border-radius:12px;
  overflow:hidden;padding:8px;
}
.pv-image-wrap img{
  max-width:100%;max-height:100%;
  object-fit:contain;border-radius:8px;
}
.pv-image-wrap.pv-hidden{display:none}
.pv-price-block{
  flex:1;display:flex;flex-direction:column;
  justify-content:center;gap:clamp(4px,0.8vw,10px);
}
.pv-product-name{
  font-size:clamp(16px,3.5vw,36px);
  font-weight:700;color:#ffffff;
  line-height:1.2;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
}
.pv-price-row{
  display:flex;align-items:baseline;
  gap:clamp(6px,1.2vw,16px);
  flex-wrap:wrap;
}
.pv-current-price{
  font-size:clamp(28px,7vw,72px);
  font-weight:800;color:#4ade80;
  line-height:1;
}
.pv-currency{
  font-size:clamp(14px,2.5vw,28px);
  font-weight:600;color:#4ade80;
  margin-left:4px;
}
.pv-previous-price{
  font-size:clamp(14px,2.8vw,28px);
  font-weight:500;color:#9ca3af;
  text-decoration:line-through;
}
.pv-previous-price.pv-hidden{display:none}
.pv-discount-badge{
  display:inline-flex;align-items:center;justify-content:center;
  background:#ef4444;color:#fff;
  font-size:clamp(11px,2vw,20px);
  font-weight:700;
  padding:clamp(2px,0.4vw,6px) clamp(6px,1vw,14px);
  border-radius:20px;
  white-space:nowrap;
}
.pv-discount-badge.pv-hidden{display:none}
.pv-campaign{
  font-size:clamp(12px,2vw,20px);
  color:#fbbf24;font-weight:600;
  margin-top:2px;
}
.pv-campaign.pv-hidden{display:none}
/* Bottom info strip */
.pv-info-strip{
  display:flex;flex-wrap:wrap;
  gap:clamp(6px,1vw,12px);
  padding:clamp(6px,1vw,12px) 0;
  border-top:1px solid #2d2d4e;
}
.pv-info-tag{
  display:inline-flex;align-items:center;
  gap:4px;
  background:#16213e;
  padding:clamp(3px,0.5vw,6px) clamp(8px,1.2vw,14px);
  border-radius:8px;
  font-size:clamp(10px,1.8vw,16px);
  color:#a5b4fc;
  white-space:nowrap;
}
.pv-info-tag.pv-hidden{display:none}
.pv-info-tag .pv-label{color:#6b7280;margin-right:2px}
/* Barcode bar */
.pv-barcode{
  text-align:center;
  font-size:clamp(11px,1.8vw,18px);
  color:#6b7280;
  font-family:"Courier New",monospace;
  letter-spacing:1px;
  padding-top:clamp(4px,0.6vw,8px);
  border-top:1px solid #2d2d4e;
}
.pv-barcode.pv-hidden{display:none}
</style>
</head>
<body>
<div class="pv-container">

  <div class="pv-top">
    <div class="pv-image-wrap" id="pvImage">
      <img src="{{image_url}}" alt="" onerror="this.parentElement.classList.add('pv-hidden')">
    </div>
    <div class="pv-price-block">
      <div class="pv-product-name">{{product_name}}</div>
      <div class="pv-price-row">
        <span class="pv-current-price">{{current_price}}<span class="pv-currency">{{currency}}</span></span>
        <span class="pv-previous-price" id="pvPrev">{{previous_price}}</span>
        <span class="pv-discount-badge" id="pvDiscount">%{{discount_percent}}</span>
      </div>
      <div class="pv-campaign" id="pvCampaign">{{campaign_text}}</div>
    </div>
  </div>

  <div class="pv-info-strip">
    <span class="pv-info-tag" id="pvCategory"><span class="pv-label">Kategori:</span> {{category}}</span>
    <span class="pv-info-tag" id="pvBrand"><span class="pv-label">Marka:</span> {{brand}}</span>
    <span class="pv-info-tag" id="pvUnit"><span class="pv-label">Birim:</span> {{unit}}</span>
    <span class="pv-info-tag" id="pvOrigin"><span class="pv-label">Mensei:</span> {{origin}}</span>
    <span class="pv-info-tag" id="pvProdType"><span class="pv-label">Uretim:</span> {{production_type}}</span>
  </div>

  <div class="pv-barcode" id="pvBarcode">{{barcode}}</div>

</div>
<script>
(function(){
  // Hide elements whose placeholders were not replaced (still contain {{ }})
  var ids=['pvPrev','pvDiscount','pvCampaign','pvCategory','pvBrand','pvUnit','pvOrigin','pvProdType','pvBarcode','pvImage'];
  ids.forEach(function(id){
    var el=document.getElementById(id);
    if(!el) return;
    var txt=el.textContent||el.innerText||'';
    if(/\{\{.*?\}\}/.test(txt)){
      el.classList.add('pv-hidden');
    }
  });
  // Hide image if src is empty or still placeholder
  var img=document.querySelector('.pv-image-wrap img');
  if(img){
    var src=img.getAttribute('src')||'';
    if(!src||src.indexOf('{{')!==-1){
      img.parentElement.classList.add('pv-hidden');
    }
  }
})();
</script>
</body>
</html>
HTML;
}
