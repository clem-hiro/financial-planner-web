#!/usr/bin/env node
// Validates that every code reference in docs/engineering-handbook.md still resolves:
//   - `src/...` or `supabase/...` paths exist on disk
//   - `path:symbol` references find `symbol` declared in the file
// Warns when a section's <!-- last-verified: YYYY-MM-DD --> watermark is older than 90 days.
// Exits non-zero on any broken reference. Watermark age is warning-only.

import { readFile, access } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HANDBOOK = join(ROOT, "docs", "engineering-handbook.md");
const STALE_DAYS = 90;

const PATH_RE = /(?<![\w/.-])((?:src|supabase|scripts|public|docs)\/[\w./@()[\]-]+\.[a-zA-Z]+)(?![\w.])(?::([A-Za-z_$][\w$]*))?/g;
const WATERMARK_RE = /^##\s+(.+)$\s+<!--\s*last-verified:\s*(\d{4}-\d{2}-\d{2})\s*-->/gm;
const SECTION_RE = /^##\s+(.+)$/gm;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function symbolFoundIn(filePath, symbol) {
  const src = await readFile(filePath, "utf8");
  const patterns = [
    new RegExp(`\\b(?:function|class|const|let|var|type|interface|enum)\\s+${symbol}\\b`),
    new RegExp(`\\bexport\\s+(?:async\\s+)?(?:function|class|const|let|var|type|interface|enum|default)\\s+${symbol}\\b`),
    new RegExp(`\\bexport\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}`),
    new RegExp(`^${symbol}\\s*[:=]`, "m"),
  ];
  return patterns.some((re) => re.test(src));
}

function daysSince(iso) {
  const then = new Date(`${iso}T00:00:00Z`).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

async function main() {
  if (!(await exists(HANDBOOK))) {
    console.error(`ERROR: handbook not found at ${HANDBOOK}`);
    process.exit(2);
  }
  const text = await readFile(HANDBOOK, "utf8");

  const broken = [];
  const seen = new Set();
  for (const match of text.matchAll(PATH_RE)) {
    const [, pathRef, symbol] = match;
    const key = `${pathRef}::${symbol ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const abs = join(ROOT, pathRef);
    if (!(await exists(abs))) {
      broken.push({ ref: pathRef, reason: "file not found" });
      continue;
    }
    if (symbol) {
      if (!(await symbolFoundIn(abs, symbol))) {
        broken.push({ ref: `${pathRef}:${symbol}`, reason: "symbol not found in file" });
      }
    }
  }

  // Watermark coverage + freshness
  const sectionsSeen = [];
  for (const m of text.matchAll(SECTION_RE)) sectionsSeen.push(m[1].trim());
  const watermarks = new Map();
  for (const m of text.matchAll(WATERMARK_RE)) {
    watermarks.set(m[1].trim(), m[2]);
  }
  const missingWatermarks = sectionsSeen.filter((s) => !watermarks.has(s));
  const staleWatermarks = [];
  for (const [section, iso] of watermarks) {
    const age = daysSince(iso);
    if (age > STALE_DAYS) staleWatermarks.push({ section, iso, age });
  }

  if (broken.length > 0) {
    console.error(`\n${broken.length} broken reference(s):`);
    for (const b of broken) console.error(`  - ${b.ref}  (${b.reason})`);
  } else {
    console.log(`OK: all ${seen.size} code references resolve.`);
  }

  if (missingWatermarks.length > 0) {
    console.warn(`\nWARNING: ${missingWatermarks.length} section(s) missing <!-- last-verified: ... --> watermark:`);
    for (const s of missingWatermarks) console.warn(`  - ${s}`);
  }
  if (staleWatermarks.length > 0) {
    console.warn(`\nWARNING: ${staleWatermarks.length} watermark(s) older than ${STALE_DAYS} days:`);
    for (const s of staleWatermarks) console.warn(`  - ${s.section} (${s.iso}, ${s.age} days)`);
  }

  process.exit(broken.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
