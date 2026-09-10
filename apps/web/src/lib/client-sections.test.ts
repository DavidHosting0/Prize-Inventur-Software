import { describe, it, expect } from "vitest";
import { flattenNavItems, findNavIndex } from "./nav";
import {
  CLIENT_SECTION_HREFS,
  isFullPageNavHref,
  navItemMatchesPath,
  hasSectionView,
} from "./client-sections";
import { SECTION_VIEW_HREFS } from "./section-view-hrefs";

describe("client section navigation invariants", () => {
  it("every client section href has a section view", () => {
    for (const href of CLIENT_SECTION_HREFS) {
      expect(hasSectionView(href), `${href} missing section view`).toBe(true);
    }
  });

  it("every SECTION_VIEW_HREF used by nav is a client section", () => {
    const navHrefs = new Set(flattenNavItems().map((i) => i.href));
    for (const href of SECTION_VIEW_HREFS) {
      if (!navHrefs.has(href)) continue;
      expect(CLIENT_SECTION_HREFS.has(href)).toBe(true);
      expect(isFullPageNavHref(href)).toBe(false);
    }
  });

  it("nav items without a section view are full-page", () => {
    for (const item of flattenNavItems()) {
      if (hasSectionView(item.href)) {
        expect(isFullPageNavHref(item.href)).toBe(false);
        expect(CLIENT_SECTION_HREFS.has(item.href)).toBe(true);
      } else {
        expect(isFullPageNavHref(item.href)).toBe(true);
        expect(CLIENT_SECTION_HREFS.has(item.href)).toBe(false);
      }
    }
  });

  it("pos and pos-config never use client section swap", () => {
    expect(CLIENT_SECTION_HREFS.has("/pos")).toBe(false);
    expect(CLIENT_SECTION_HREFS.has("/pos-config")).toBe(false);
    expect(isFullPageNavHref("/pos")).toBe(true);
    expect(isFullPageNavHref("/pos-config")).toBe(true);
  });

  it("pos-config is not matched as nested under /pos", () => {
    expect(navItemMatchesPath("/pos-config", "/pos")).toBe(false);
    expect(navItemMatchesPath("/pos-config", "/pos-config")).toBe(true);
    expect(navItemMatchesPath("/pos-config/articles", "/pos")).toBe(false);
    expect(navItemMatchesPath("/pos-config/articles", "/pos-config")).toBe(
      true
    );
    expect(findNavIndex("/pos-config")).toBe(
      flattenNavItems().findIndex((i) => i.href === "/pos-config")
    );
  });
});
