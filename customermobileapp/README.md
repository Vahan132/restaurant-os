# Consumer App (CX-APP-0 scaffold)

Consumer discovery + reservation app — **Expo (React Native), iOS + Android**. This is
the **CX-APP-0 scaffold only**: toolchain, generated API client, theming, i18n, and a
four-tab shell with a single end-to-end smoke test. The discovery list, filters, and
detail screens are **CX-APP-1**; consumer auth is **CX-2**.

> RezX is the UX/layout reference only — **not** a brand to copy.

---

## Placeholders (replace before shipping)

These are intentionally generic and marked in-code:

- **App name / slug / scheme** and **bundle identifiers** (`ios.bundleIdentifier`,
  `android.package`) in `app.config.ts` — currently `com.example.consumerapp`.
- **Accent color** — a single coral/salmon token (`accent`) defined in
  `tailwind.config.js` **and** `src/theme/theme.ts` (keep the two in sync). Swapping the
  brand color is a one-token change in those two files.

---

## Stack

| Concern   | Choice |
|-----------|--------|
| Framework | Expo (SDK 54) + **expo-router** (file-based), TypeScript strict |
| Data      | `@tanstack/react-query` (orval-generated hooks) + `axios` (custom mutator) |
| Codegen   | **orval** → `src/api/generated/` (tags-split) |
| State     | `zustand` (auth skeleton only) |
| Styling   | **NativeWind v4** (Tailwind vocabulary), tokenized dark theme |
| i18n      | `i18next` + `react-i18next` + `expo-localization` — **hy / ru / en**, fallback `hy` |
| Secure storage | `expo-secure-store` util wired but unused until CX-2 |

---

## Environment variables

Copy `.env.example` → `.env` and set:

| Var | Used by | Purpose |
|-----|---------|---------|
| `EXPO_PUBLIC_API_BASE_URL` | **app runtime** | Backend base URL (no trailing slash). Point at your local backend via Tailscale/Nginx during dev. **No host is hardcoded.** |
| `OPENAPI_SPEC_URL` | `sync:spec` only | Fetch the spec from a running backend, e.g. `https://api.dev.example.ts.net/openapi.json`. Takes precedence over `OPENAPI_SPEC_PATH`. |
| `OPENAPI_SPEC_PATH` | `sync:spec` only | Copy the spec from a local backend checkout, e.g. `../restaurant-os-backend/openapi.json`. |

`EXPO_PUBLIC_API_BASE_URL` is read in `app.config.ts`, exposed via `expo-constants`, and
surfaced through one typed accessor in `src/config.ts`.

---

## Spec sync (separate repo)

This app is a **separate repo** from the backend, so it can't read the backend's spec
folder directly. `npm run sync:spec` copies the backend's generated `openapi.json` into
`./openapi.json` here. Two modes (URL wins if both set):

```bash
# A) from a running backend
OPENAPI_SPEC_URL=https://api.dev.example.ts.net/openapi.json npm run sync:spec

# B) from a local backend checkout
OPENAPI_SPEC_PATH=../restaurant-os-backend/openapi.json npm run sync:spec
```

If neither is set, it falls back to a sibling-checkout path (see `scripts/sync-spec.mjs`,
`DEFAULT_SPEC_PATH` — adjust to your layout).

`openapi.json` and `src/api/generated/` are git-ignored; regenerate them after install.

---

## Run steps

```bash
npm install

# 1. Configure env
cp .env.example .env            # set EXPO_PUBLIC_API_BASE_URL + a spec source

# 2. Sync spec + generate the typed client
npm run codegen                 # = sync:spec && generate:api

# 3. Start (Expo Go is fine for CX-APP-0)
npm start                       # then press i (iOS) / a (Android)
```

Confirm the **Home** tab fetches the attribute taxonomy and renders the categories — that
proves the full client path: env base URL → axios mutator → envelope unwrap → orval hook →
React Query → render. Loading and error+retry states are included.

### Other scripts

```bash
npm run sync:spec      # copy/fetch openapi.json
npm run generate:api   # orval codegen → src/api/generated/
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm test               # unit tests (hours + i18n pickers)
```

---

## Generated Discovery hooks

After `npm run codegen`, `src/api/generated/discovery/discovery.ts` exports:

- `usePublicDiscoveryControllerAttributes` — taxonomy (used by the Home smoke test)
- `usePublicDiscoveryControllerRestaurants` — discovery list (CX-APP-1)
- `usePublicDiscoveryControllerDetail` — branch detail (CX-APP-1)
- `usePublicDiscoveryControllerAvailability` — availability (CX-APP-1)

Hooks return the **inner payload** (the mutator unwraps the envelope) and reject with a
normalized `ApiError { code, message, status }`.

---

## Helpers (built now, used later)

- `pickI18n(field, locale)` — resolve `I18nTextResponse {hy,ru,en}` with fallback
  `active → hy → ru → en → ''`.
- `pickLabel(obj, locale)` — same fallback for `labelHy/labelRu/labelEn` taxonomy fields.
- `todayHours(weeklyHours, date)` — derive today's row from `weeklyHours[]` using the
  device weekday (spec uses `0=Mon..6=Sun`; carries `crossesMidnight`).

---

## Auth & the dev build (CX-APP-2)

Real consumer sign-in (Google / Apple / phone-OTP) uses native modules
(`expo-auth-session`, `expo-apple-authentication`, `expo-secure-store`) that **do not run
in Expo Go** — CX-APP-2 requires a **custom dev build**:

```bash
npm install
npm run codegen                 # regenerate the client (now incl. Consumer Auth/Profile)
npx expo prebuild               # generates native projects
npx expo run:ios                # or: run:android  (or an EAS dev build)
```

Set `EXPO_PUBLIC_API_BASE_URL` to your running CX-2 backend. Provider sign-in needs real
IDs (`EXPO_PUBLIC_GOOGLE_*` here, `GOOGLE_CLIENT_IDS` / `APPLE_CLIENT_IDS` on the backend);
**without them, OTP and Apple-on-device still work and the Google button errors
gracefully**.

**Testing phone-OTP with the console-stub backend:** request a code in the login sheet,
then read the 6-digit code from the **backend server log** (the dev SMS stub prints it),
enter it to complete sign-in.

How it fits together:

- `useAuthStore` (`src/store/auth.ts`) is the single source of auth truth: `accessToken`
  in memory, `status` (`loading`/`authed`/`anon`); the rotating refresh token is persisted
  in `expo-secure-store`.
- The mutator (`src/api/axios-instance.ts`) attaches `Bearer` and, on a 401, does a
  **single-flight** refresh + one retry; a reused/expired refresh clears the session → anon.
- Launch hydration (`src/auth/session.ts`) silently restores a stored session or falls to
  anon behind a brief splash.
- `requireAuth(intent)` (`src/lib/auth-gate.ts`) is a **return-to-intent** gate: tapping
  Book/Save while anon captures the intent, opens the login sheet, and resumes it after
  sign-in. Book/Save still dispatch **stub handlers** (`src/lib/intents.ts`) until CX-3.
- Profile (`app/(tabs)/profile.tsx`) reads `/consumer/me`; Save sends only
  `name`/`gender`/`birthday` (**never email**); phone change is OTP-verified; delete
  confirms then `DELETE /consumer/me`.

> Note: birthday uses a plain `YYYY-MM-DD` text field in v1; swap in
> `@react-native-community/datetimepicker` if you want a native picker.

---

## Envelope assumption (read before CX-APP-1)

The existing web frontends' axios mutator was **not available to inspect** in this
environment. The OpenAPI spec documents the **inner** payloads, while the brief states
responses are wrapped in a success/error envelope the web mutator unwraps. The RN mutator
(`src/api/axios-instance.ts`) therefore assumes the conventional NestJS envelope:

```
success: { data: <inner payload> }
error:   { error: { code: "UPPER_SNAKE", message } }
```

`unwrapData` is defensive (returns the body unchanged if not enveloped — safe because no
response schema has a top-level `data` field). **If the real envelope differs, fix
`unwrapData` / `normalizeError` in that one file — the generated client is unaffected.**
