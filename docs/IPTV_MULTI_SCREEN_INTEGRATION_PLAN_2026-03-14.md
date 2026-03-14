# IPTV Multi Screen Integration Analysis and Plan (2026-03-14)

## 1) Amaç
Bu dokuman, telefonda incelenen IPTV uygulamasindaki coklu ekran (multi-screen) davranisini referans alarak Omnex Android APK icin yeni bir ekleme plani verir.

Ana hedef:
- Mevcut Omnex player ve stream akisina dokunmamak.
- Secilen ekran duzenine gore her slot icin kaynak atanabilmesi (link veya dosya).
- Ozelligi izole bir mod olarak eklemek (mevcut tek ekran playback bozulmadan).

## 2) Kapsam ve Sinirlar
In Scope:
- IPTV coklu ekran UX modelinin teknik analizi.
- Omnex APK icin izole coklu ekran mimarisi.
- Slot bazli kaynak turleri (URL, local file, Omnex stream URL).
- Performans, profil, test ve rollout plani.

Out of Scope:
- Mevcut `MainActivity` + `player.js` akisinda davranis degisikligi.
- Mevcut stream pipeline degisiklikleri.
- Bu dokuman kapsaminda kod implementasyonu.

## 3) Telefon Uzerindeki IPTV Inceleme Bulgulari
ADB ve UI dump incelemelerinde asagidaki net bulgular alindi:

### 3.1 Aktivite ve ekran akisi
- Paket: `com.nst.iptvsmarterstvbox`
- Multi-screen aktivite izi: `NSTIJKPlayerMultiActivity`
- Dashboard girisi: `id/multiscreen` (text: `COKLU EKRAN`)

### 3.2 Layout secimi davranisi
UI tarafinda layout secici popup/alaninda su secimler goruldu:
- `id/deafult`
- `id/screen1`
- `id/screen2`
- `id/screen3`
- `id/screen4`
- `id/screen5`

Yorum:
- Kullanicidan once bir ekran duzeni secmesi bekleniyor.
- Duzen secildikten sonra slot container yapisi aktif oluyor.

### 3.3 Slot container yapisi
UI dump'ta coklu slot container ID'leri goruldu:
- `id/rl_video_box_1`, `id/rl_video_box_2`, `id/rl_video_box_3`
- tiklanabilir slot alanlari: `id/app_video_box_1`, `id/app_video_box_2`, `id/app_video_box_3`
- slot ici ekleme overlay: `id/ll_add_channel`

Yorum:
- Her slot bagimsiz kaynak atanabilir tasarlanmis.
- Bos slotlarin ustunde "ekle" overlay'i bulunuyor.

### 3.4 Kaynak ekleme girisleri
"Playlist type" ekraninda su secenekler tespit edildi:
- `id/rl_login_with_m3u` (playlist/file/url yukleme)
- `id/rl_play_single_stream`
- `id/rl_play_from_device`

Yorum:
- Sistem tek tip kaynak zorlamiyor; URL veya lokal dosya kabul ediyor.

## 4) Omnex Icin Cikarilan Gereksinimler
1. Coklu ekran ozelligi mevcut oynaticidan tamamen izole olmalidir.
2. Kullanici once layout secmeli, sonra slot bazli kaynak atayabilmelidir.
3. Her slot bagimsiz bir "source" tasimalidir.
4. Source turleri en az su uc tipi kapsamalidir:
   - `omnex_stream` (bizim stream URL veya token tabanli URL)
   - `external_url` (m3u8/mp4 vb)
   - `local_file` (content:// veya file://)
5. Mevcut tek ekran modu varsayilan kalmali; coklu ekran opsiyonel olmali.

## 5) Onerilen Mimari (Mevcut Akisa Dokunmadan)

### 5.1 Yapi
Yeni bir mod eklenir, mevcut mod degistirilmez:
- `MainActivity` (tek ekran, mevcut) -> oldugu gibi kalir
- `MultiScreenActivity` (yeni) -> sadece yeni ozellik

Yeni paket onerisi:
- `com.omnex.player.multiscreen.*`

Onerilen siniflar:
- `MultiScreenActivity`
- `MultiScreenLayoutEngine`
- `MultiScreenSessionStore`
- `SlotPlayerController`
- `SlotSourceResolver`

### 5.2 Neden bu yapi
- Mevcut player/bridge/sync davranisini riske atmaz.
- Sorun olursa feature flag ile kapatilabilir.
- Test ve rollback kolay olur.

## 6) Veri Modeli (Lokal)
`SharedPreferences` veya Room uzerinden tek bir oturum modeli:

```json
{
  "layoutType": "screen3",
  "slots": [
    {
      "slotId": 1,
      "sourceType": "omnex_stream",
      "sourceValue": "https://hub.omnexcore.com/api/stream/<token>/variant/720p/playlist.m3u8",
      "muted": true
    },
    {
      "slotId": 2,
      "sourceType": "external_url",
      "sourceValue": "https://example.com/live.m3u8",
      "muted": true
    },
    {
      "slotId": 3,
      "sourceType": "local_file",
      "sourceValue": "content://...",
      "muted": true
    }
  ]
}
```

Not:
- `muted` varsayilan `true` olmali (multi playback'te echo/karma riskini azaltir).

## 7) Oynatma Katmani Stratejisi
Oneri:
- Her slot icin ExoPlayer tabanli native playback.
- Her slot kendi lifecycle yonetimini yapar.
- Hata alan slot diger slotlari etkilemez (fail-isolated).

Kaynak formati:
- HLS (`.m3u8`) -> `HlsMediaSource`
- Dosya/MP4 -> `MediaItem`

Not:
- Bu mod, mevcut `player.js` transition efektlerini aynen tasimaz.
- Hedef, stabil ve bagimsiz coklu slot playback'tir.

## 8) UI/UX Akisi (Oneri)
1. Dashboard -> "Multi Screen" girisi
2. Layout secim dialogu (`default`, `screen1..screen5`)
3. Bos slotlarda `+ Kaynak Ekle`
4. Kaynak turu secimi:
   - Omnex Stream Link
   - Harici URL
   - Cihazdan Dosya
5. Slot oynatma baslat
6. Uzun basma / ayar ile slotu degistir veya sil

## 9) Performans ve Cihaz Profilleri
Mevcut performans profil mantigi korunmali:
- `legacy`
- `balanced`
- `default`

Coklu ekran icin ek limitler:
- legacy: max 2 slot
- balanced: max 3 slot
- default: max 4 slot (cihaz decode kapasitesine gore)

Bu limitler runtime codec kontrolu ile dogrulanmali (soft cap + fallback).

## 10) Guvenlik ve Dogrulama
- Girilen URL icin whitelist/format dogrulamasi.
- `content://` izinlerinin kaliciligi (persistable URI permission).
- Hata halinde slot bazli kullaniciya net mesaj.
- Token veya hassas URL log'a acik yazilmamali.

## 11) Asamali Uygulama Plani
Phase 1 (MVP):
- `MultiScreenActivity`
- Layout secimi (`default`, `screen1..screen3`)
- URL + local file atama
- Slot basina ExoPlayer playback

Phase 2:
- `screen4/screen5`
- Slot kopyalama, hizli degistirme
- Session import/export

Phase 3:
- Uzaktan yonetim (server tarafindan slot config push)
- Device panelde multi-screen durum izleme

## 12) Test Matrisi
Fonksiyonel test:
- Layout degisince slot map dogru mu?
- URL kaynagi ve local file kaynagi calisiyor mu?
- Bir slot hata alinca digerleri devam ediyor mu?

Uyumluluk test:
- Android 9 (legacy)
- Android 11
- Android 12
- Android 13+

Uzun sure test:
- 8+ saat surekli playback
- Ag kesinti/geri gelme
- Activity background/foreground gecisleri

## 13) Riskler ve Onlemler
Risk: Coklu slot decode ile cihaz isinmasi veya drop-frame.
Onlem: Profil bazli slot limiti + bitrate siniri + otomatik fallback.

Risk: Local dosya URI izin kaybi.
Onlem: URI persist permission + acilista dogrulama + yeniden secim akisi.

Risk: Mevcut tek ekran mode etkilenmesi.
Onlem: Ayri Activity + feature flag + ayrik paket/sinif.

## 14) Kabul Kriterleri
- Mevcut tek ekran player ve stream akisinda regresyon yok.
- Secilen layout'ta slotlara URL veya dosya atanabiliyor.
- Cihaz profiline gore slot limiti otomatik uygulanabiliyor.
- En az bir legacy ve bir modern cihazda stabil playback dogrulaniyor.

## 15) Sonuc
Incelenen IPTV uygulamasi, coklu ekrani "layout secimi + slot bazli kaynak atama" modeliyle yurutuyor.
Omnex icin en dusuk riskli ve profesyonel yaklasim, bu modeli mevcut player akisini degistirmeden yeni bir `MultiScreenActivity` katmani olarak eklemektir.

Bu planla:
- mevcut sistem korunur,
- multi-screen yetenek kazanilir,
- rollout kontrollu ve geri alinabilir sekilde ilerler.
