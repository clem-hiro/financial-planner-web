import { describe, expect, it } from "vitest";
import { renderQrSvg } from "@/lib/qr-svg";

describe("renderQrSvg", () => {
  it("produces an SVG with the pinned width and a viewBox", async () => {
    const svg = await renderQrSvg("https://example.com/login?qr_token=abc");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toMatch(/width="320"/);
    expect(svg).toMatch(/viewBox="/);
    expect(svg).toMatch(/#0c192f/);
  });
});
