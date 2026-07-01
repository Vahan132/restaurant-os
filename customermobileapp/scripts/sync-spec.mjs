#!/usr/bin/env node
/**
 * sync:spec — copy the backend's generated OpenAPI spec into ./openapi.json.
 *
 * This Expo app is a SEPARATE repo from the backend, so it cannot reach into the
 * backend's folder at build time. This script keeps a local ./openapi.json in sync.
 * orval (generate:api) reads that local file.
 *
 * Two modes (URL takes precedence over PATH if both are set):
 *
 *   1. URL  — fetch from a running backend:
 *        OPENAPI_SPEC_URL=https://api.dev.example.ts.net/openapi.json npm run sync:spec
 *
 *   2. PATH — copy from a local checkout of the backend:
 *        OPENAPI_SPEC_PATH=../restaurant-os-backend/openapi.json npm run sync:spec
 *
 * If neither is set, falls back to DEFAULT_SPEC_PATH below — the backend's spec
 * location relative to a typical sibling checkout. Adjust to your layout.
 */
import { writeFile, readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'openapi.json');

// PLACEHOLDER default: the backend (NestJS) writes its generated spec here. The
// existing frontends point orval at the backend's local spec file; mirror that path
// for a sibling checkout, or override with OPENAPI_SPEC_PATH / OPENAPI_SPEC_URL.
// Backend lives at the monorepo sibling `../api` (NestJS). Its generated spec is
// `api/openapi.json` (run `pnpm generate:openapi` in api/). Override with
// OPENAPI_SPEC_PATH or OPENAPI_SPEC_URL.
const DEFAULT_SPEC_PATH = path.resolve(__dirname, '..', '..', 'api', 'openapi.json');

// Convenience default for the URL mode (this deployment's Swagger JSON). Used only
// when OPENAPI_SPEC_URL is not set AND the local file above is missing.
const FALLBACK_SPEC_URL = 'https://msi.tail8514ca.ts.net/res/api/docs-json';

async function fromUrl(url) {
  console.log(`[sync:spec] fetching spec from URL: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`);
  return await res.text();
}

async function fromPath(p) {
  console.log(`[sync:spec] copying spec from path: ${p}`);
  await access(p);
  return await readFile(p, 'utf8');
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const url = process.env.OPENAPI_SPEC_URL?.trim();
  const fsPath = process.env.OPENAPI_SPEC_PATH?.trim();

  let raw;
  if (url) {
    raw = await fromUrl(url);
  } else if (fsPath) {
    raw = await fromPath(path.resolve(process.cwd(), fsPath));
  } else if (await exists(DEFAULT_SPEC_PATH)) {
    raw = await fromPath(DEFAULT_SPEC_PATH);
  } else {
    // No local spec found → fall back to the deployment's Swagger JSON.
    raw = await fromUrl(FALLBACK_SPEC_URL);
  }

  // Validate it parses and looks like an OpenAPI doc before overwriting.
  const json = JSON.parse(raw);
  if (!json.openapi || !json.paths) {
    throw new Error('Fetched content is not a valid OpenAPI document (missing openapi/paths).');
  }

  await writeFile(OUT, JSON.stringify(json, null, 2) + '\n', 'utf8');
  const pathCount = Object.keys(json.paths).length;
  console.log(`[sync:spec] wrote ${OUT} (${pathCount} paths, version ${json.info?.version ?? '?'})`);
}

main().catch((err) => {
  console.error(`[sync:spec] FAILED: ${err.message}`);
  console.error(
    '[sync:spec] Set OPENAPI_SPEC_URL (running backend) or OPENAPI_SPEC_PATH ' +
      '(local backend checkout). See .env.example.',
  );
  process.exit(1);
});
