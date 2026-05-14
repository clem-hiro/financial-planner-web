import { describe, it, expect } from "vitest";
import { packageFromNodeModulesPath } from "./resolve.ts";

describe("packageFromNodeModulesPath", () => {
  it("returns scoped package name", () => {
    expect(packageFromNodeModulesPath("/p/node_modules/@supabase/ssr/dist/index.js")).toBe(
      "@supabase/ssr"
    );
  });
  it("returns plain package name", () => {
    expect(packageFromNodeModulesPath("/p/node_modules/zod/lib/index.js")).toBe("zod");
  });
  it("maps @types/<x> to runtime package <x>", () => {
    expect(packageFromNodeModulesPath("/p/node_modules/@types/react/index.d.ts")).toBe("react");
  });
  it("returns undefined for paths outside node_modules", () => {
    expect(packageFromNodeModulesPath("/p/src/lib/foo.ts")).toBeUndefined();
  });
});
