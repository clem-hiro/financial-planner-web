import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CollapsiblePane, CollapsiblePaneRail } from "@/ui/CollapsiblePaneRail";

// Server-renderable composition smoke: these are pure (native <details>, no
// client hooks, no next/link), so react-dom/server in the node env is a
// faithful functional check of prop pass-through + state.
describe("CollapsiblePane composition", () => {
  it("passes title + eyebrow through and renders the body", () => {
    const html = renderToStaticMarkup(
      <CollapsiblePane title="Plans Consolidation" eyebrow="Proposal">
        <p>BODY_CONTENT</p>
      </CollapsiblePane>
    );
    expect(html).toContain("Plans Consolidation");
    expect(html).toContain("Proposal");
    expect(html).toContain("BODY_CONTENT");
    expect(html).toContain("<details");
  });

  it("defaultOpen renders <details open>", () => {
    const html = renderToStaticMarkup(
      <CollapsiblePane title="T" defaultOpen>
        x
      </CollapsiblePane>
    );
    expect(html).toMatch(/<details[^>]*\bopen\b/);
  });

  it("without defaultOpen the panel is collapsed (no open attr)", () => {
    const html = renderToStaticMarkup(
      <CollapsiblePane title="T">x</CollapsiblePane>
    );
    const openTag = html.slice(0, html.indexOf(">") + 1);
    expect(openTag).toMatch(/^<details/);
    expect(openTag).not.toMatch(/\bopen\b/);
  });

  it("omits the eyebrow node when not provided", () => {
    const html = renderToStaticMarkup(
      <CollapsiblePane title="OnlyTitle">x</CollapsiblePane>
    );
    expect(html).toContain("OnlyTitle");
  });
});

describe("CollapsiblePaneRail composition", () => {
  it("wraps children in <aside> with the JIT-safe inline max-height + sticky classes", () => {
    const html = renderToStaticMarkup(
      <CollapsiblePaneRail>
        <span>RAIL_CHILD</span>
      </CollapsiblePaneRail>
    );
    expect(html).toContain("<aside");
    expect(html).toContain("RAIL_CHILD");
    // Inline style (cannot be Turbopack-JIT-dropped), not a max-h-[...] class.
    expect(html).toContain("max-height:calc(100vh - 7rem)");
    expect(html).toContain("lg:sticky");
    expect(html).toContain("overflow-y-auto");
    expect(html).not.toMatch(/max-h-\[/);
  });
});
