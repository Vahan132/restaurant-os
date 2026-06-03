#!/usr/bin/env node
/**
 * i18n key-parity check. Loads every locale catalog under messages/ and
 * verifies they all expose the IDENTICAL set of leaf keys as the source
 * locale (en). Reports missing/extra keys per locale and exits non-zero on
 * any mismatch, so CI catches drift before it ships.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "messages");
const SOURCE = "en";
const LOCALES = ["en", "hy", "ru"];

/** Collect dot-paths of all leaves (strings) in a nested object. */
function leafKeys(obj, prefix = "", out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) leafKeys(v, key, out);
    else out.add(key);
  }
  return out;
}

function load(locale) {
  const file = path.join(dir, `${locale}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const sourceKeys = leafKeys(load(SOURCE));
let failed = false;

for (const locale of LOCALES) {
  if (locale === SOURCE) continue;
  const keys = leafKeys(load(locale));
  const missing = [...sourceKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !sourceKeys.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`\n✗ ${locale}.json differs from ${SOURCE}.json`);
    if (missing.length) console.error(`  Missing ${missing.length}:\n    ${missing.join("\n    ")}`);
    if (extra.length) console.error(`  Extra ${extra.length}:\n    ${extra.join("\n    ")}`);
  } else {
    console.log(`✓ ${locale}.json — ${keys.size} keys match ${SOURCE}.json`);
  }
}

if (failed) {
  console.error("\ni18n key parity check FAILED.");
  process.exit(1);
}
console.log("\ni18n key parity check passed.");
