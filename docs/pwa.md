● PWA Signage Player Implementasyonu Tamamlandı

  Oluşturulan Dosyalar

  1. PWA Player Frontend (public/player/)
  ┌───────────────┬───────────────────────────────────────────────────────────────────┐        
  │     Dosya     │                             Açıklama                              │        
  ├───────────────┼───────────────────────────────────────────────────────────────────┤        
  │ index.html    │ Player SPA shell - Loading, Registration, Player, Error ekranları │        
  ├───────────────┼───────────────────────────────────────────────────────────────────┤        
  │ manifest.json │ PWA manifest - fullscreen, tema renkleri, ikonlar                 │        
  ├───────────────┼───────────────────────────────────────────────────────────────────┤        
  │ sw.js         │ Service Worker - cache stratejileri, offline destek               │        
  ├───────────────┼───────────────────────────────────────────────────────────────────┤        
  │ .htaccess     │ Apache config - SPA routing, CORS, cache headers                  │        
  └───────────────┴───────────────────────────────────────────────────────────────────┘        
  2. Player JavaScript Modülleri (public/player/assets/js/)
  ┌────────────┬────────────────────────────────────────────────────────────┐
  │   Dosya    │                          Açıklama                          │
  ├────────────┼────────────────────────────────────────────────────────────┤
  │ player.js  │ Ana player logic - init, registration, playback, heartbeat │
  ├────────────┼────────────────────────────────────────────────────────────┤
  │ api.js     │ API client - register, verify, init, sync, heartbeat       │
  ├────────────┼────────────────────────────────────────────────────────────┤
  │ storage.js │ IndexedDB + localStorage - fingerprint, config, cache      │
  └────────────┴────────────────────────────────────────────────────────────┘
  3. Player CSS (public/player/assets/css/)
  ┌────────────┬─────────────────────────────────────────────────────┐
  │   Dosya    │                      Açıklama                       │
  ├────────────┼─────────────────────────────────────────────────────┤
  │ player.css │ Fullscreen player stilleri - dark theme, responsive │
  └────────────┴─────────────────────────────────────────────────────┘
  4. Database Migration
  Dosya: 030_extend_device_heartbeats.sql
  Açıklama: Eksik heartbeat kolonları (memory_usage, cpu_usage, vb.)
  5. Güncellenen Dosyalar
  ┌───────────────────────────────┬─────────────────────────────────────────────────────────┐  
  │             Dosya             │                       Değişiklik                        │  
  ├───────────────────────────────┼─────────────────────────────────────────────────────────┤  
  │ api/player/verify.php         │ Response format düzeltmesi (token, deviceId, companyId) │  
  ├───────────────────────────────┼─────────────────────────────────────────────────────────┤  
  │ DeviceList.js                 │ PWA Player linki eklendi                                │  
  ├───────────────────────────────┼─────────────────────────────────────────────────────────┤  
  │ locales/tr/pages/devices.json │ pwaPlayer çevirileri                                    │  
  ├───────────────────────────────┼─────────────────────────────────────────────────────────┤  
  │ locales/en/pages/devices.json │ pwaPlayer translations                                  │  
  └───────────────────────────────┴─────────────────────────────────────────────────────────┘  
  ---
  PWA Player Akışı

  1. TV/Ekranda http://domain.com/player/ açılır
  2. Player fingerprint üretir ve /api/player/register çağırır
  3. 6 haneli sync code ekranda gösterilir (15 dk geçerli)
  4. Admin panelde Cihazlar > sync code ile onay
  5. Player /api/player/verify poll eder, onaylanınca token alır
  6. /api/player/init ile playlist ve template çeker
  7. İçerik oynatılır (image, video, HLS)
  8. Her 30 sn heartbeat, her 5 dk sync kontrolü

  Panel Tarafı Kullanım

  1. Cihazlar sayfasında "PWA Player" butonu yeni pencerede player açar
  2. Bekleyen cihazlar ESL pending endpoint'ini kullanır (/api/esl/pending)
  3. Sync code ile onaylama /api/esl/approve endpoint'i
  4. Mevcut approval/reject akışı hem ESL hem PWA için çalışır

  Test Etmek İçin

  1. http://localhost/market-etiket-sistemi/player/ adresini açın
  2. Sync code ekranda görünecek
  3. Panel'den Cihazlar > cihaz ekleme modalında sync code girin
  4. Onaylandıktan sonra player içerik oynatmaya başlayacak