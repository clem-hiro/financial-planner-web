// Canonical types for the function-tree artifact (v1).
// `id` shape: `<repo-relative-path>#<symbol>` or `<path>#<symbol>:<line>` when a name repeats inside a file.

export type NextClassification =
  | "server-component"
  | "client-component"
  | "server-action"
  | "route-handler"
  | "page"
  | "layout"
  | "loading"
  | "error"
  | "not-found"
  | "template"
  | "middleware"
  | "regular";

export type FunctionKind = "function" | "method" | "arrow" | "component";

export type EdgeKind = "calls" | "renders" | "new" | "dynamic-import";

export type ForwardEdge =
  | { kind: EdgeKind; target: string }
  | { kind: EdgeKind; external: string };

export type FunctionNode = {
  id: string;
  name: string;
  kind: FunctionKind;
  line: number;
  exported: boolean;
  classification: NextClassification[];
  edges: ForwardEdge[];
  unresolved: number;
};

export type ModuleNode = {
  path: string;
  root: string;
  classification: NextClassification[];
  functions: FunctionNode[];
};

export type ReverseIndex = {
  // target id -> list of source ids per edge kind
  calls: Record<string, string[]>;
  renders: Record<string, string[]>;
  new: Record<string, string[]>;
  "dynamic-import": Record<string, string[]>;
};

export type FunctionTree = {
  $schema: "function-tree/v1";
  generated_at: string;
  roots: string[];
  modules: ModuleNode[];
  reverse: ReverseIndex;
};
