import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extract } from "./extract.ts";
import { buildTree } from "./build-tree.ts";
import { renderMarkdown } from "./render-md.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");

// generated_at / "Generated: <ts>" lines are the only intentional non-determinism. Strip before
// byte-comparing so a fresh-but-re-stamped artifact doesn't register as drift.
function stripJsonTimestamp(s: string): string {
  return s.replace(/"generated_at":\s*"[^"]+"/, '"generated_at": "<stripped>"');
}
function stripMdTimestamp(s: string): string {
  return s.replace(/Generated: `[^`]+`/, "Generated: `<stripped>`");
}
function normalize(name: string, body: string): string {
  return name.endsWith(".json") ? stripJsonTimestamp(body) : stripMdTimestamp(body);
}

async function main() {
  const tsConfigFilePath = path.join(REPO_ROOT, "tsconfig.json");
  const srcDir = path.join(REPO_ROOT, "src");
  const outDir = path.join(REPO_ROOT, "docs", "function-tree");

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), `function-tree-check-${process.pid}-`));
  try {
    const { intermediates, duplicates } = extract({
      repoRoot: REPO_ROOT,
      tsConfigFilePath,
      srcDir,
    });
    const tree = buildTree(REPO_ROOT, intermediates, duplicates, new Date().toISOString());
    const rendered = renderMarkdown(tree);

    await mkdir(tmpDir, { recursive: true });
    await writeFile(path.join(tmpDir, "function-tree.json"), JSON.stringify(tree, null, 2) + "\n");
    for (const [name, body] of Object.entries(rendered)) {
      await writeFile(path.join(tmpDir, name), body.endsWith("\n") ? body : body + "\n");
    }

    let existing: string[];
    try {
      existing = await readdir(outDir);
    } catch {
      console.error(
        `function-tree: ${path.relative(REPO_ROOT, outDir)}/ missing — run \`npm run map\`.`
      );
      process.exit(1);
    }
    const fresh = await readdir(tmpDir);

    const freshSet = new Set(fresh);
    const existingSet = new Set(existing);
    const added = fresh.filter((n) => !existingSet.has(n));
    const removed = existing.filter((n) => !freshSet.has(n));

    const changed: string[] = [];
    for (const name of fresh) {
      if (!existingSet.has(name)) continue;
      const [a, b] = await Promise.all([
        readFile(path.join(tmpDir, name), "utf8"),
        readFile(path.join(outDir, name), "utf8"),
      ]);
      if (normalize(name, a) !== normalize(name, b)) changed.push(name);
    }

    if (added.length || removed.length || changed.length) {
      console.error("function-tree: artifact is stale — re-run `npm run map`.");
      for (const n of added) console.error(`  + ${n} (regenerated but missing on disk)`);
      for (const n of removed) console.error(`  - ${n} (on disk but no longer regenerated)`);
      for (const n of changed) console.error(`  ~ ${n} (content differs from regenerated output)`);
      process.exit(1);
    }
    console.log("function-tree: up to date.");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
