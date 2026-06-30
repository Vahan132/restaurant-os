# Phase 0 — Inspection findings

The brief asks to inspect an existing frontend (admin / POS / KDS / QR) in the backend
repo and mirror its orval + axios-mutator setup. **Only `openapi.json` was provided in
this environment — the backend repo and its frontends were not available.** Findings below
are therefore derived from the spec + the brief, with assumptions flagged. Each assumption
has a single, clearly-marked fix point so reconciling with the real frontends is cheap.

## 1. orval config (mirrored shape)
- `client: 'react-query'`, custom `mutator` → `src/api/axios-instance.ts` (`customInstance`).
- `input: ./openapi.json` (locally synced — see §4), `output: src/api/generated/`,
  `mode: 'tags-split'`, schemas under `generated/model/`.
- See `orval.config.ts`. **Assumption:** naming/casing match orval defaults; reconcile if
  the real frontends override them.

## 2. axios mutator (ported shape)
Implemented in `src/api/axios-instance.ts`:
- (a) **Unwraps the success envelope** so hooks return the inner payload — `unwrapData`.
- (b) **Normalizes errors** to `UPPER_SNAKE` codes — `normalizeError` / `statusToCode`.
- (c) **Attaches the auth token** from `useAuthStore` via a request interceptor — token is
  always empty in CX-APP-0 (anonymous Discovery).
- (d) **401 refresh: STUBBED** with a `// CX-2:` seam; currently rejects with the
  normalized error.

## 3. Envelope shape (ASSUMED — single fix point)
The spec documents inner payloads (e.g. `/public/discovery/attributes` →
`AttributeCategoryResponse[]`), with no envelope schema. The brief says responses are
enveloped and the web mutator unwraps them. Assumed conventional NestJS shape:

```
success: { data: <inner payload> }
error:   { error: { code: "UPPER_SNAKE", message } }
```

`unwrapData` is defensive: returns the body unchanged if it isn't enveloped — safe because
**no response schema in the spec has a top-level `data` property** (verified), so there's
no ambiguity. If the real envelope differs, fix `unwrapData` / `normalizeError` only.

## 4. Spec source
The spec lives at the backend's generated `openapi.json`. Since this is a separate repo, a
`sync:spec` step (`scripts/sync-spec.mjs`) copies it in via either `OPENAPI_SPEC_PATH`
(local checkout) or `OPENAPI_SPEC_URL` (running backend). See README → "Spec sync".

## Spec facts used by the scaffold
- Discovery endpoints (all anonymous): `attributes`, `restaurants`, `restaurants/{branchId}`,
  `.../availability` → 4 generated hooks.
- `I18nTextResponse { hy, ru, en }` (members nullable) → `pickI18n`.
- Taxonomy label columns `labelHy/labelRu/labelEn` → `pickLabel`.
- `PublicHoursResponse.dayOfWeek` is **0=Mon … 6=Sun** (≠ JS `getDay()`) and carries
  `crossesMidnight` → handled in `todayHours`.
