# Omnex Player - Legacy Device Profile

## Purpose

This document describes the low-end / legacy Android device profile added for field stability.
It covers:

- how the profile is detected
- what changes are enabled in APK and web player layers
- what was validated on the test device
- which optimizations can also be reused on higher-end devices

This profile is intended for devices that must run continuously in the field with minimal operator intervention.

## Target Device Class

The current legacy profile is aimed at devices similar to the tested unit:

- Android 11
- Rockchip G66 class SoC
- 2 GB RAM
- WebView 83
- low RAM flag enabled
- 1366x768 display

It is also relevant for older Android TV / Android box devices with:

- old Chromium WebView builds
- weak GPU composition
- unstable HTML5 video rendering inside WebView

## Detection Rules

The automatic profile selection is implemented in [PerformanceProfile.kt](/C:/xampp/htdocs/market-etiket-sistemi/android-player/omnex-player-app/app/src/main/java/com/omnex/player/PerformanceProfile.kt).

The `legacy` profile is selected when one or more of these are true:

- `ActivityManager.isLowRamDevice()` is `true`
- total system RAM is about `<= 2300 MB`
- current WebView major version is `<= 83`

Manual override is also supported through the Android bridge:

- `auto`
- `default`
- `legacy`

## What The Legacy Profile Changes

### APK Layer

Implemented mainly in:

- [PerformanceProfile.kt](/C:/xampp/htdocs/market-etiket-sistemi/android-player/omnex-player-app/app/src/main/java/com/omnex/player/PerformanceProfile.kt)
- [MainActivity.kt](/C:/xampp/htdocs/market-etiket-sistemi/android-player/omnex-player-app/app/src/main/java/com/omnex/player/MainActivity.kt)
- [ExoPlayerManager.kt](/C:/xampp/htdocs/market-etiket-sistemi/android-player/omnex-player-app/app/src/main/java/com/omnex/player/ExoPlayerManager.kt)
- [activity_main.xml](/C:/xampp/htdocs/market-etiket-sistemi/android-player/omnex-player-app/app/src/main/res/layout/activity_main.xml)

Key runtime behavior:

- WebView hardware layer is disabled for legacy mode.
- ExoPlayer is not eagerly initialized at startup.
- ExoPlayer is initialized safely on the UI thread when first needed.
- Direct playlist videos are allowed to use native ExoPlayer again.
- Native video uses `TextureView` composition so WebView UI overlays can remain visible.
- WebView is opaque by default and becomes transparent only during native video playback.
- Player update checks are delayed more aggressively to reduce startup contention.

### Web Player Layer

Implemented mainly in:

- [player.js](/C:/xampp/htdocs/market-etiket-sistemi/public/player/assets/js/player.js)

Key runtime behavior:

- Media precache is disabled.
- Heartbeat interval is reduced in frequency.
- Sync interval is reduced in frequency.
- Verify polling is slower.
- Heavy playlist transition animations are disabled.
- Video warmup is not used for direct video items.
- Native video state is tracked so WebView background handling is correct.
- Orientation toggle logic is kept deterministic and does not force stale state on relaunch.

## Why This Profile Works Better

The main bottlenecks on this class of hardware are:

- old WebView JavaScript parser
- weak GPU / surface composition
- unstable HTML5 video rendering in embedded WebView
- low RAM pressure during cache and preload work

The biggest stability gain came from moving direct playlist videos away from WebView HTML5 video and back to native ExoPlayer, while keeping the WebView UI on top.

This removes the most failure-prone path:

- WebView decode starts
- codec allocates
- frame timing advances
- but no visible frame is composited

## Validated Field Results On The Test Device

Observed after the current fixes:

- direct playlist video is visible again
- bottom status bar remains visible
- orientation toggle remains usable
- no obvious RAM growth during long playback

Measured results on the 10-minute soak test:

- `Janky frames: 1.01%`
- `p50: 5 ms`
- `p90: 7 ms`
- `p95: 9 ms`
- `p99: 17 ms`
- CPU samples stayed around `61% - 62%` for `com.omnex.player`
- WebView helper process stayed near `0.8%`
- Total PSS stayed roughly in the `146 MB - 155 MB` range

This is a good field result for a 2 GB legacy class device.

## Which Optimizations Should Stay Legacy-Only

These should remain enabled only for constrained devices unless a specific rollout test proves otherwise:

- disabling media precache
- disabling playlist transition animations
- delaying update checks more aggressively
- slower heartbeat and sync intervals
- disabling eager ExoPlayer init
- special low-risk fallbacks for old WebView parsing / module loading

Reason:

- higher-end devices can usually benefit from smoother transitions and more responsive sync behavior
- removing these globally would reduce UX quality without a clear performance gain

## Which Optimizations Can Also Be Reused On Higher-End Devices

These can be considered for `default` or future `balanced` profiles:

- UI-thread-safe lazy ExoPlayer initialization
- native playback for direct playlist videos on devices with known WebView video issues
- `TextureView` composition when WebView overlay controls must remain visible
- WebView transparency only while native video is active
- deterministic orientation state handling
- avoiding unnecessary video warmup / hidden decoder duplication

These are not only legacy fixes; they are generally safer architecture choices.

## Suggested Next Step For Higher-End Devices

Instead of copying `legacy` settings directly to all devices, use profile tiers:

- `legacy`: maximum stability, minimum overhead
- `balanced`: reduced background work for TV-class hardware without fully stripping UX features
- `default`: current normal behavior
- `performance`: faster sync and richer transitions for strong hardware

Recommended candidates for a future `balanced` profile:

- keep native direct video path
- keep normal transitions, but cap duration
- keep service worker
- allow limited precache (current + next only)
- keep default heartbeat, but reduce unnecessary polling bursts

## Operational Rollout Guidance

For large field deployment:

1. Treat `legacy` as the safe baseline for weak and old devices.
2. Keep per-device profile override available for support teams.
3. Track CPU, RAM, jank, and content visibility separately.
4. Do not assume "same CPU, more RAM" means "same best profile".
5. Validate WebView version as a first-class compatibility signal.

## Files To Review Before Further Tuning

- [PerformanceProfile.kt](/C:/xampp/htdocs/market-etiket-sistemi/android-player/omnex-player-app/app/src/main/java/com/omnex/player/PerformanceProfile.kt)
- [MainActivity.kt](/C:/xampp/htdocs/market-etiket-sistemi/android-player/omnex-player-app/app/src/main/java/com/omnex/player/MainActivity.kt)
- [ExoPlayerManager.kt](/C:/xampp/htdocs/market-etiket-sistemi/android-player/omnex-player-app/app/src/main/java/com/omnex/player/ExoPlayerManager.kt)
- [activity_main.xml](/C:/xampp/htdocs/market-etiket-sistemi/android-player/omnex-player-app/app/src/main/res/layout/activity_main.xml)
- [player.js](/C:/xampp/htdocs/market-etiket-sistemi/public/player/assets/js/player.js)
