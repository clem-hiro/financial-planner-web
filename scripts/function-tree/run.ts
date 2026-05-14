import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extract } from "./extract.ts";
import { buildTree } from "./build-tree.ts";
import { renderMarkdown } from "./render-md.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");

async function main() {
  const tsConfigFilePath = path.join(REPO_ROOT, "tsconfig.json");
  const srcDir = path.join(REPO_ROOT, "src");

  console.log("function-tree: extract — walking src/ with ts-morph");
  const { intermediates, duplicates } = extract({
    repoRoot: REPO_ROOT,
    tsConfigFilePath,
    srcDir,
  });

  console.log("function-tree: build — inverting forward edges into reverse index");
  const tree = buildTree(REPO_ROOT, intermediates, duplicates, new Date().toISOString());

  console.log("function-tree: render — emitting markdown");
  const rendered = renderMarkdown(tree);

  console.log("function-tree: write — flushing artifact to disk");
  const outDir = path.join(REPO_ROOT, "docs", "function-tree");
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "function-tree.json"), JSON.stringify(tree, null, 2) + "\n");
  for (const [name, body] of Object.entries(rendered)) {
    await writeFile(path.join(outDir, name), body.endsWith("\n") ? body : body + "\n");
  }

  const totalFns = tree.modules.reduce((acc, m) => acc + m.functions.length, 0);
  const totalEdges = tree.modules.reduce(
    (acc, m) => acc + m.functions.reduce((a2, f) => a2 + f.edges.length, 0),
    0
  );
  console.log(
    `function-tree: done — ${tree.modules.length} modules, ${totalFns} functions, ${totalEdges} edges -> ${path.relative(REPO_ROOT, outDir)}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
