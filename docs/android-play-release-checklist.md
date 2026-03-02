# Android Play Release Checklist (Omnex Player)

## 1. Network Security

1. `debug` build: HTTP (cleartext) allowed for local/on-prem test.
2. `release` build: cleartext disabled (`usesCleartextTraffic=false`).
3. Production player URL should be `https://` only.

## 2. Signing and Distribution

1. `android-player/omnex-player-app/keystore.properties` file create from `keystore.properties.example`.
2. Fill real values:
   - `storeFile`
   - `storePassword`
   - `keyAlias`
   - `keyPassword`
3. Build release artifacts:
   - `./gradlew.bat bundleRelease`
   - `./gradlew.bat publishReleaseArtifacts`
4. Upload `.aab` to Play Console:
   - `public/downloads/omnex-player-release.aab`
5. Enable **Play App Signing** in Play Console (recommended).

## 3. Play Console Metadata

1. App name, short/full description.
2. Screenshots:
   - Phone
   - TV (if you publish TV support)
3. Feature graphic + app icon.
4. Category, contact email, website.

## 4. Privacy / Data Safety

1. Publish Privacy Policy URL.
2. Fill Data Safety form based on real app behavior:
   - Network/device identifiers
   - Crash/log telemetry (if any)
   - Data encryption in transit
3. If no ads/analytics/sdk collection, mark accordingly (must match actual behavior).

## 5. Policy and Technical Validation

1. Target API current Play requirement (currently SDK 34 is OK).
2. Test on:
   - Clean install
   - Update install
   - Offline/online transitions
3. Confirm no debug endpoints in release.
4. Confirm SSL errors are blocked in release (already implemented).
