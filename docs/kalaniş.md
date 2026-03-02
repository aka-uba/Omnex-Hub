• Aradığın 10px girinti ayarı burada:
                                                                                  
  - Render tarafı (çoklu ürün, cihazda soldan kırpma için): public/assets/js/     
    services/TemplateRenderer.js:950                                              
    const slotSafeLeftPad = 10;                                                   
  - Bu değerin uygulandığı yer: public/assets/js/services/TemplateRenderer.js:1102    obj.left = Number(obj.left ?? 0) + slotSafeLeftPad;                           

  - public/assets/js/pages/templates/EditorWrapper.js:1023 (const padding = 10;)  
  - public/assets/js/pages/templates/EditorWrapper.js:3986
    (_fitObjectIntoSlot(..., padding = 10))

› bu ayara gateway üzeniden gelen tasarımlarda da ihtiyacım var


• Gateway akışında da aynı soldan güvenlik payını devreye alacak şekilde kodu     
  kontrol edip doğrudan uygulayacağım; önce bu repoda gateway render noktasını    
  netleştiriyorum.
• Ran rg -n "slotSafeLeftPad|__slotSafePadApplied|__is_multi_product_frame|       
  │ sendLabel\(|applySafeInset|safeInset|multi_[0-9]+|gateway" services api       
  │ public -g "*.php" -g "*.js"
  └ services\CompanySeeder.php:175:                    'gateway_enabled' => true, 
    services\RenderQueueService.php:243:                    gd.gateway_id,        
    … +955 lines
    += '<h4 style="margin:0 0 8px 0;color:var(--color-success);"><i class="ti     
    ti-gateway"></i> Gateway getStokListesi() Sonucu</h4>';
                                                                                  
• Running rg -n "slotSafeLeftPad|safeInset|__is_multi_product_frame|              
  │ multi-product-frame|sendLabel|render|clipPath|slot"                           
  │ local-gateway-manager -g "*.php" -g "*.js" -g "*.ts"                          

• Ran Get-ChildItem -Path local-gateway-manager -Recurse -File | Select-Object    
  │ -First 20 FullName
  └                                                                               
    FullName                                                                      
    … +26 lines                                                                   
                                                                                  
                                                                                  
                                                                                  
• Ran rg -n "slotSafeLeftPad|safeInset|__is_multi_product_frame|                  
  │ multi-product-frame|sendLabel|render|clipPath|slot" local-gateway-manager -g  
  │ "*.php" -g "*.js" -g "*.ts"                                                   
    local-gateway-manager\yedek-local-gateway-mana

──────────────────────────────────────────────────────────────────────────────────

• Şimdi doğrudan local-gateway-manager/resources/gateway/gateway.php içinde       
  etiketin cihaza gönderilmeden önce işlendiği bölüme bakıp aynı 10px güvenli     
  kaydırmayı ekleyeceğim.
                                                                                  
• Running $path='local-gateway-manager/resources/gateway/gateway.php';$start=1860;
  │ Multi-Product Composite|renderDynamicFields|send_label"
  │ local-gateway-manager/resources/gateway/gateway.php
  └ 1220:                'send_label' => $this->handleSendLabel($parameters),     
    1931:                    imagecopyresampled($dstImage, $img, 0, 0, 0, 0,      
    … +4 lines
    $product, int $srcWidth, int $srcHeight, int $dstWidth, int $dstHeight): void 
    3327:        $this->log('info', "=== renderDynamicFields BAÅLADI ===");       
                                                                                  
• Running $path='local-gateway-manager/resources/gateway/gateway.php';$start=3320;
  │ $end=3495;$i=0;Get-Content $path | ForEach-Object { $i++; if($i -ge           
  │ $start -and $i -le $end){"$i`t$_"}}                                           

• Ran rg -n "slot|frame|multi-product|customType|clipPath|left\s*=|originX|       
  │ textAlign|fieldMap|dynamic" local-gateway-manager/resources/gateway/
  │ gateway.php
    bulundu, {$renderedCount} tanesi render edildi ===");

──────────────────────────────────────────────────────────────────────────────────

• Gateway tarafında aynı etkisi için iki nokta var: görselin komple sağa güvenli  
  kaydırılması ve slot içi dinamik metinlerin +10px kaydırılması. Hangisinin aktif
  olduğunu görmek için handleSendLabel parametrelerini açıyorum.
                                                                                  
• Running $path='local-gateway-manager/resources/gateway/gateway.php';$start=1648;
• Ran rg -n "__is_multi_product_frame|multi_product|design_data|designData|slotId|
  │ inMultiFrame|customType|layout|template" local-gateway-manager/resources/     
  │ gateway/gateway.php
  └ 1696:        $designData = $params['design_data'] ?? []; // Dinamik alanlar   
    için şablon verisi
    … +22 lines
    3366:            $bg = $designData['background'];
    3379:        foreach ($designData['objects'] as $index => $obj) {
                                                                                  
• Ran rg -n "gateway_commands|send_label|design_data|image_region|video_region"   
  │ api -g "*.php"
  └ api\devices\control.php:325:    // Create command in gateway_commands table   
    api\devices\control.php:327:    $db->insert('gateway_commands', [
    … +107 lines
    WHERE id = ?",
    api\templates\render.php:1712:    $db->update('gateway_commands', [
                                                                                  
• Ran $path='api/render-queue/process.php';$start=1290;$end=1415;$i=0;Get-Content 
  │ $path | ForEach-Object { $i++; if($i -ge $start -and $i -le $end){"$i`t$_"}}  
  └ 1290                }
    1291

• Ran $path='api/render-queue/process.php';$start=1048;$end=1110;$i=0;Get-Content 
  │ $path | ForEach-Object { $i++; if($i -ge $start -and $i -le $end){"$i`t$_"}}  
  └ 1048
    1049                $log("HATA: Görsel kaynağı bulunamadı - " .
• Ran rg -n "__is_multi_product_frame|multi-product-frame|productInfo|product =|  
  │ designData\['_templateWidth'\]" api/templates/render.php
  └ 44:    $product = $db->fetch(
    68:    $product = $productData;
    1353:                    $productInfo,

• Ran $path='api/templates/render.php';$start=340;$end=430;$i=0;Get-Content $path 
  │ | ForEach-Object { $i++; if($i -ge $start -and $i -le $end){"$i`t$_"}}        
  └ 340                    }
    341                }
    … +88 lines
    $matches)) {
    430                    $mediaPath = $matches[1];
                                                                                  
• Running if (Test-Path gateway/gateway.php) { rg -n "handleSendLabel|            
  │ renderDynamicFields|imagecopyresampled|__is_multi_product_frame|              
  │ safeInset" gateway/gateway.php; $path='gateway/gateway.php';$start=1800;      
  │ … +3 lines                                                                    

• Ran Get-ChildItem gateway -File | Select-Object Name,Length,LastWriteTime       



──────────────────────────────────────────────────────────────────────────────────

• Aynı gateway kodunun iki kopyası var (gateway/gateway.php ve local-gateway-     
  manager/resources/gateway/gateway.php). Tutarlılık için ikisine de aynı
  düzeltmeyi uygulayacağım.
                                                                                  
• Running $path='gateway/gateway.php';$start=1258;$end=1368;$i=0;Get-Content $path
  │ | ForEach-Object { $i++; if($i -ge $start -and $i -le $end){"$i`t$_"}}        

• Ran $path='gateway/gateway.php';$start=2520;$end=2645;$i=0;Get-Content $path |  
  │ ForEach-Object { $i++; if($i -ge $start -and $i -le $end){"$i`t$_"}}
  └ 2520            echo "Sayfa: $page, Gösterilen: " . count($eslList) . "      
    ESL\n\n";                                                                     
    … +125 lines                                                                  
    2644                                                                          
    2645                // Yeni metni yaz                                         
                                                                                  
──────────────────────────────────────────────────────────────────────────────────                                                                                  
• Şimdi iki gateway dosyasında da (dev ve root) multi-product geldiğinde +10px    
  güvenli kaydırmayı aktif edecek şekilde kodu düzenliyorum.                      
                                                                                  
                                                                                  
› c:\xampp\htdocs\market-etiket-sistemi\local-gateway-manager bunu kullan         
                                                                                  
                                                                                  
• Edited local-gateway-manager/resources/gateway/gateway.php (+49 -1)             
    1696          $designData = $params['design_data'] ?? []; // Dinamik alanlar i
          çin şablon verisi                                                     
    1697 +        $isMultiFrameTemplate = !empty($product['__is_multi_product_fram
          e']) || $this->hasMultiProductFrameInDesign($designData);               
    1698 +        $slotSafeLeftPad = 10;                                          
    1699                                                                          
         ⋮                                                                        
    1932                      imagefill($dstImage, 0, 0, $white);                 
    1931 -                    imagecopyresampled($dstImage, $img, 0, 0, 0, 0, $tar
          getWidth, $targetHeight, $srcWidth, $srcHeight);                        
    1933 +                    if ($isMultiFrameTemplate) {                        
    1934 +                        imagecopyresampled($dstImage, $img, $slotSafeLef
          tPad, 0, 0, 0, $targetWidth, $targetHeight, $srcWidth, $srcHeight);     
    1935 +                        $this->log('info', 'Safe left inset uygulandi (g
          ateway)', [                                                             
    1936 +                            'safe_left_pad' => $slotSafeLeftPad,        
    1937 +                            'template' => 'multi-product'               
    1938 +                        ]);                                             
    1939 +                    } else {                                            
    1940 +                        imagecopyresampled($dstImage, $img, 0, 0, 0, 0, 
          $targetWidth, $targetHeight, $srcWidth, $srcHeight);                    
    1941 +                    }                                                   
    1942                                                                          
         ⋮                                                                        
    3358          $this->log('info', "Scale: X={$scaleX}, Y={$scaleY}");          
    3359 +        $isMultiFrameTemplate = !empty($product['__is_multi_product_fram
          e']) || $this->hasMultiProductFrameInDesign($designData);               
    3360 +        $slotSafeLeftPad = 10;                                          
    3361 +        if ($isMultiFrameTemplate) {                                    
    3362 +            $this->log('info', "Multi-product render algılandı, dinami
          k alanlar için +{$slotSafeLeftPad}px soldan güvenli pad aktif");      
    3363 +        }                                                               
    3364                                                                          
         ⋮                                                                        
    3427              $fontSize = (float)($obj['fontSize'] ?? 20);                
    3428 +            if ($isMultiFrameTemplate) {                                
    3429 +                $left += $slotSafeLeftPad;                              
    3430 +            }                                                           
    3431                                                                          
         ⋮                                                                        
    3468      /**                                                                 
    3469 +     * Tasarım içinde multi-product-frame olup olmadığını (recursi
          ve) kontrol et.                                                         
    3470 +     */                                                                 
    3471 +    private function hasMultiProductFrameInDesign(array $designData): bo
          ol                                                                      
    3472 +    {                                                                   
    3473 +        if (empty($designData['objects']) || !is_array($designData['obje
          cts'])) {                                                               
    3474 +            return false;                                               
    3475 +        }                                                               
    3476 +                                                                        
    3477 +        $containsMultiProductFrame = function(array $items) use (&$conta
          insMultiProductFrame): bool {                                           
    3478 +            foreach ($items as $item) {                                 
    3479 +                if (!is_array($item)) {                                 
    3480 +                    continue;
    3481 +                }                                                       
    3482 +                                                                        
    3483 +                if (($item['customType'] ?? '') === 'multi-product-frame
          ') {                                                                    
    3484 +                    return true;                                        
    3485 +                }                                                       
    3486 +                                                                        
    3487 +                if (!empty($item['objects']) && is_array($item['objects'
          ]) && $containsMultiProductFrame($item['objects'])) {                   
    3488 +                    return true;                                        
    3489 +                }                                                       
    3490 +            }                                                           
    3491 +                                                                        
    3492 +            return false;                                               
    3493 +        };                                                              
    3494 +                                                                        
    3495 +        return $containsMultiProductFrame($designData['objects']);      
    3496 +    }                                                                   
    3499       * Sistem fontu bul (render için)