# Missed Call Sync (Android companion) — R-AND-1

A small, standalone **React Native (Expo)** Android app that reads the phone's
call log, detects **missed** calls, and reports them to the restaurant‑os
backend. This feeds the admin **missed‑call inbox** (R‑API‑1 / A5.1).

> **Android only.** It relies on the Android `CallLog` provider and a foreground
> service. It does not run on iOS or in **Expo Go** (native modules are required).

---

## What it does

- Runs a **foreground service** with a persistent "Syncing missed calls"
  notification so it keeps working in the background.
- Every poll interval (default **45s**) and on app launch/foreground, it queries
  the call log for `MISSED` calls newer than a stored cursor.
- Posts each new call to `POST {baseUrl}/reservations/missed-calls/ingest` with a
  **Bearer device token**.
- Advances the cursor **only** after a confirmed `200`. The backend dedupes on
  `(deviceId + phone + time)`, so retries are safe and never create duplicates.

### API contract

```
POST {baseUrl}/reservations/missed-calls/ingest
Authorization: Bearer <deviceToken>
Content-Type: application/json

{ "calls": [
    { "phoneNumber": "+15551234567",
      "occurredAt": "2026-06-26T18:21:09.000Z",
      "callerName": "Jane Doe" }      // callerName optional
] }
```

- `200` → accepted (body may be empty or `{ "accepted": <n> }`).
- `401` → token revoked / wrong → app stops the service and shows a **re‑pair** state.
- **Test connection** sends the same request with an **empty** `calls` array.

---

## Project layout

```
android-missed-call-sync/
├─ app.json                     Expo config + android.permissions
├─ eas.json                     EAS Build profiles (internal APK)
├─ plugins/withMissedCallService.js   Config plugin: FG service type + permissions
├─ index.ts                     Entry; registers the FG service before UI mounts
├─ App.tsx                      Routes between Setup and Home
└─ src/
   ├─ api/client.ts             ingest + testConnection (timeouts, 401 handling)
   ├─ calllog/callLog.ts        call-log read + MISSED mapping (pure + testable)
   ├─ permissions/permissions.ts READ_CALL_LOG / POST_NOTIFICATIONS / battery opt
   ├─ storage/storage.ts        SecureStore (config, cursor, stats)
   ├─ storage/statsLogic.ts     pure cursor/stat logic (unit-tested)
   ├─ sync/syncEngine.ts        one sync round; cursor advances only on 200
   ├─ sync/syncManager.ts       singleton: loop, FG service, state, listeners
   ├─ sync/foregroundService.ts notifee foreground-service registration
   ├─ ui/                       SetupScreen, HomeScreen, theme, hook
   └─ __tests__/                jest unit tests
```

---

## Prerequisites

- Node 18+ and npm.
- A **physical Android device** (call log is empty on most emulators).
- For cloud builds: an Expo account + `npm i -g eas-cli` (`eas login`).
- For local builds: Android SDK + JDK 17 (Android Studio).

Install dependencies:

```bash
cd android-missed-call-sync
npm install
```

---

## Build & install (NOT Expo Go)

`READ_CALL_LOG` is a restricted permission and is **not Play‑Store‑friendly**.
That's fine here — distribution is a **direct/internal APK** installed on the
restaurant's own phone.

### Option A — EAS Build (recommended)

```bash
eas login
eas build:configure          # writes the EAS project id into app.json
eas build --profile development --platform android
```

EAS returns an installable **APK** (the `development`/`preview`/`production`
profiles all use `buildType: apk`, `distribution: internal`). Download it on the
phone and install it (enable "Install unknown apps" for your browser/file
manager). The `development` profile includes the dev client for live reload;
`preview`/`production` produce a standalone APK.

### Option B — Local prebuild + Gradle

```bash
npx expo prebuild --platform android --clean      # generates native android/ project
cd android
./gradlew assembleDebug          # APK at app/build/outputs/apk/debug/app-debug.apk
# or ./gradlew assembleRelease for a release APK (configure signing first)
```

Install the APK:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

> After changing `app.json` or `plugins/withMissedCallService.js`, re‑run
> `expo prebuild --clean` (or a fresh EAS build) so the manifest is regenerated.

---

## Permissions

Declared in `app.json` and enforced by the config plugin:

| Permission | Why |
|---|---|
| `READ_CALL_LOG` | Read missed calls. **Sync is blocked until granted.** |
| `POST_NOTIFICATIONS` | Android 13+ — the persistent FG notification. |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_DATA_SYNC` | Android 14+ requires a typed FG service; the plugin stamps `android:foregroundServiceType="dataSync"` on the notifee service. |
| `RECEIVE_BOOT_COMPLETED` | Optional — allows auto‑start on boot. |

Runtime permissions (`READ_CALL_LOG`, notifications) are requested from the Home
screen. If permanently denied, the app routes you to system settings.

---

## First run / pairing

1. Open the app → **Pair device**.
2. Enter the **API base URL** (e.g. `https://api.your-restaurant.com`) and paste
   the **device token** from the admin **Devices** screen.
3. Tap **Test connection** — a `200` confirms the token; a `401` means the token
   is wrong or revoked.
4. Tap **Pair this device**, grant **call‑log** + **notification** access, then
   tap **Start**.

The home screen shows: service running indicator + Start/Stop, last sync time,
calls reported today / total, **Sync now**, a list of recently reported calls,
and the paired status (base URL + masked token) with **Re‑pair** / **Unpair**.

---

## ⚠️ OEM battery / auto‑start caveats

Aggressive battery managers will kill the foreground service. For reliability:

- In‑app, tap **Battery optimization settings** and set this app to
  **Not optimized / Unrestricted**.
- Some manufacturers also require **manual allow‑listing**:
  - **Xiaomi/MIUI** — Security → Permissions → **Autostart** (enable); set
    battery saver to **No restrictions**; lock the app in Recents.
  - **Huawei** — Battery → App launch → set to **Manage manually** (allow
    auto‑launch, secondary launch, run in background).
  - **Oppo / Vivo / Realme (ColorOS/FuntouchOS)** — enable **Auto‑startup** and
    allow **background running**.
  - **Samsung** — Battery → Background usage limits → remove from **Sleeping
    apps**; allow **Unrestricted**.
  - **OnePlus** — Battery optimization → **Don't optimize**; lock in Recents.

Keep the phone plugged in / on Wi‑Fi where possible for best results.

---

## Verifying acceptance (R‑AND‑1 §6)

- Dev build installs on a physical device and requests `READ_CALL_LOG` +
  notifications.
- Pairing + **Test connection** validate the token; a revoked token reports `401`.
- A real missed call is detected within the poll interval, posted, and appears in
  the admin missed‑call inbox live (`missedcall.new`); the device's `lastSeenAt`
  updates in the admin Devices list.
- Re‑syncing creates no duplicates (backend dedupe + local cursor).
- The service keeps reporting after backgrounding; **Sync now** works on demand;
  revoking the device in admin flips the app to the **re‑pair** state.

---

## Development

```bash
npm run typecheck     # tsc --noEmit
npm test              # jest unit tests (cursor/mapping/sync logic)
npm run prebuild      # expo prebuild --platform android --clean
npm run android       # build & run on a connected device (dev client)
```

The sync **cursor logic** (`src/storage/statsLogic.ts`) and **sync round**
(`src/sync/syncEngine.ts`) are deliberately free of native imports so they are
fully unit‑tested:

- cursor advances **only** on a confirmed `200`;
- cursor is **left untouched** on network or server errors (safe retry);
- `401` surfaces as `unauthorized` (stop + re‑pair);
- `MISSED` filtering, epoch→ISO mapping, and "strictly newer than cursor"
  selection.

### Notes / assumptions

- `app.json` has placeholder `extra.eas.projectId` and the Android package
  `com.restaurantos.missedcallsync` — adjust to your org before building.
- The backend missed‑call endpoint was not present in the bundled `openapi.json`
  snapshot; the client is built to the R‑API‑1 contract above. If the response
  shape differs, only `src/api/client.ts` needs adjustment.
- Localisation is intentionally omitted (internal utility; English only).
