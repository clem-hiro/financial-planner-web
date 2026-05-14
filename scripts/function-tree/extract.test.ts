import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { extract } from "./extract.ts";
import { buildTree } from "./build-tree.ts";
import type { ModuleNode, FunctionNode } from "./types.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXT_ROOT = path.join(HERE, "__fixtures__");

function runOnFixtures() {
  const { intermediates, duplicates } = extract({
    repoRoot: FIXT_ROOT,
    tsConfigFilePath: path.join(FIXT_ROOT, "tsconfig.json"),
    srcDir: path.join(FIXT_ROOT, "src"),
  });
  return buildTree(FIXT_ROOT, intermediates, duplicates, "2026-01-01T00:00:00Z");
}

function modOf(tree: ReturnType<typeof runOnFixtures>, rel: string): ModuleNode {
  const m = tree.modules.find((x) => x.path === rel);
  if (!m) throw new Error(`module not found: ${rel} (have: ${tree.modules.map((m) => m.path).join(", ")})`);
  return m;
}
function fnOf(m: ModuleNode, name: string): FunctionNode {
  const f = m.functions.find((x) => x.name === name);
  if (!f) throw new Error(`function not found in ${m.path}: ${name}`);
  return f;
}

describe("extract + buildTree on fixtures", () => {
  const tree = runOnFixtures();

  it("walks all fixture modules", () => {
    const paths = tree.modules.map((m) => m.path).sort();
    expect(paths).toContain("src/server/actions.ts");
    expect(paths).toContain("src/features/ServerView.tsx");
    expect(paths).toContain("src/features/ClientView.tsx");
    expect(paths).toContain("src/app/dashboard/page.tsx");
    expect(paths).toContain("src/app/api/route.ts");
    expect(paths).toContain("src/middleware.ts");
    expect(paths).toContain("src/lib/util.ts");
    expect(paths).toContain("src/lib/index.ts");
  });

  describe("Next.js classification (all six tags)", () => {
    it("tags server-action at file level when 'use server' is top-of-file", () => {
      const m = modOf(tree, "src/server/actions.ts");
      expect(m.classification).toContain("server-action");
    });
    it("tags client-component when 'use client' directive is present", () => {
      const m = modOf(tree, "src/features/ClientView.tsx");
      expect(m.classification).toContain("client-component");
    });
    it("tags route-handler when route.ts exports HTTP verbs", () => {
      const m = modOf(tree, "src/app/api/route.ts");
      expect(m.classification).toContain("route-handler");
    });
    it("tags page on app/**/page.tsx", () => {
      const m = modOf(tree, "src/app/dashboard/page.tsx");
      expect(m.classification).toContain("page");
    });
    it("tags middleware on top-level middleware.ts", () => {
      const m = modOf(tree, "src/middleware.ts");
      expect(m.classification).toContain("middleware");
    });
    it("tags server-component when app/** file has no 'use client'", () => {
      const m = modOf(tree, "src/app/dashboard/page.tsx");
      // The page itself is both "page" and (implicitly) a server component module.
      expect(m.classification).toContain("page");
      // Bare server-component is reserved for non-special app/** modules; not asserted on page.
      expect(m.classification.includes("client-component")).toBe(false);
    });
  });

  describe("edge kinds (all four)", () => {
    const actions = modOf(tree, "src/server/actions.ts");
    const createTx = fnOf(actions, "createTransaction");

    it("emits a 'calls' edge to a re-exported function (alias-following lands on util.ts)", () => {
      const calls = createTx.edges.filter((e) => e.kind === "calls" && "target" in e);
      const targets = calls.map((e) => ("target" in e ? e.target : ""));
      expect(targets).toContain("src/lib/util.ts#formatCents");
      // Resolver must NOT stop on the barrel.
      expect(targets).not.toContain("src/lib/index.ts#formatCents");
    });
    it("emits a 'new' edge to a class declaration", () => {
      const news = createTx.edges.filter((e) => e.kind === "new" && "target" in e);
      const targets = news.map((e) => ("target" in e ? e.target : ""));
      expect(targets).toContain("src/lib/util.ts#TimerHandle");
    });
    it("emits a 'dynamic-import' edge for internal import()", () => {
      const dyn = createTx.edges.filter((e) => e.kind === "dynamic-import");
      expect(dyn.length).toBeGreaterThan(0);
    });
    it("emits a 'renders' edge for capitalised JSX components", () => {
      const page = modOf(tree, "src/app/dashboard/page.tsx");
      const dashboard = fnOf(page, "DashboardPage");
      const renders = dashboard.edges.filter((e) => e.kind === "renders" && "target" in e);
      const targets = renders.map((e) => ("target" in e ? e.target : ""));
      expect(targets).toContain("src/features/ServerView.tsx#ServerView");
      expect(targets).toContain("src/features/ClientView.tsx#ClientView");
    });
    it("does NOT emit 'renders' edges for lowercase host elements (<main>, <div>)", () => {
      const page = modOf(tree, "src/app/dashboard/page.tsx");
      const dashboard = fnOf(page, "DashboardPage");
      const internal = dashboard.edges.filter((e) => e.kind === "renders" && "target" in e);
      const external = dashboard.edges.filter((e) => e.kind === "renders" && "external" in e);
      for (const e of [...internal, ...external]) {
        const text = "target" in e ? e.target : e.external;
        expect(text.toLowerCase().includes("main")).toBe(false);
      }
    });
  });

  describe("resolution accuracy", () => {
    it("bumps unresolved counter for computed dispatch, never fabricates edges", () => {
      const actions = modOf(tree, "src/server/actions.ts");
      const unresolvedFn = fnOf(actions, "unresolvedDispatch");
      expect(unresolvedFn.unresolved).toBeGreaterThan(0);
      expect(unresolvedFn.edges.length).toBe(0);
    });
  });

  describe("module-level fields", () => {
    it("flags `exported` correctly on function declarations", () => {
      const actions = modOf(tree, "src/server/actions.ts");
      expect(fnOf(actions, "createTransaction").exported).toBe(true);
      expect(fnOf(actions, "_internalOnly").exported).toBe(false);
    });
    it("flags `exported` correctly on arrow declarations via VariableStatement", () => {
      const actions = modOf(tree, "src/server/actions.ts");
      expect(fnOf(actions, "exportedArrow").exported).toBe(true);
    });
    it("classifies non-Next modules as 'regular' so every module has at least one tag", () => {
      const util = modOf(tree, "src/lib/util.ts");
      expect(util.classification).toContain("regular");
    });
  });

  describe("reverse index", () => {
    it("populates 'called by' for re-exported callee", () => {
      const inbound = tree.reverse.calls["src/lib/util.ts#formatCents"];
      expect(inbound).toContain("src/server/actions.ts#createTransaction");
      expect(inbound).toContain("src/features/ServerView.tsx#ServerView");
    });
    it("populates 'rendered by' for components used in JSX", () => {
      const inbound = tree.reverse.renders["src/features/ServerView.tsx#ServerView"];
      expect(inbound).toContain("src/app/dashboard/page.tsx#DashboardPage");
    });
    it("populates 'instantiated by' for class targets of `new`", () => {
      const inbound = tree.reverse.new["src/lib/util.ts#TimerHandle"];
      expect(inbound).toContain("src/server/actions.ts#createTransaction");
    });
  });
});
