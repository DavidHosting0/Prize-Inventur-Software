import { flattenNavItems } from "@/lib/nav";
import { SECTION_VIEW_HREFS } from "@/lib/section-view-hrefs";

const SECTION_VIEW_HREF_SET = new Set<string>(SECTION_VIEW_HREFS);

/**
 * Top-level sidebar routes switched client-side (no RSC).
 * Only nav items that actually have a registered section view.
 * Routes like /pos and /pos-config stay full Next.js navigations.
 */
export const CLIENT_SECTION_HREFS = new Set(
  flattenNavItems()
    .map((i) => i.href)
    .filter((href) => SECTION_VIEW_HREF_SET.has(href))
);

/** Nav items without a client section view → full page load. */
export function isFullPageNavHref(href: string): boolean {
  return (
    flattenNavItems().some((i) => i.href === href) &&
    !CLIENT_SECTION_HREFS.has(href)
  );
}

export function hasSectionView(href: string): boolean {
  return SECTION_VIEW_HREF_SET.has(href);
}

export function matchClientSection(pathname: string): string | null {
  if (!pathname) return null;
  return CLIENT_SECTION_HREFS.has(pathname) ? pathname : null;
}

/**
 * True when pathname is a nested app route (detail/scanner) under a section.
 * Uses longest nav prefix so /pos-config/… is not treated as nested under /pos.
 */
export function isNestedAppPath(pathname: string): boolean {
  if (CLIENT_SECTION_HREFS.has(pathname)) return false;
  if (isFullPageNavHref(pathname)) return false;

  let best: string | null = null;
  for (const item of flattenNavItems()) {
    const href = item.href;
    if (pathname === href) return false;
    if (pathname.startsWith(`${href}/`)) {
      if (!best || href.length > best.length) best = href;
    }
  }
  if (!best) return false;
  // Nested under a client section → show Next children; under full-page module too
  return true;
}

/**
 * Parse browser pathname like /bern/de/suppliers or /de/suppliers → /suppliers
 */
export function sectionFromBrowserPath(browserPathname: string): string | null {
  const parts = browserPathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  // /{hotel}/{locale}/...
  const maybeLocale = parts[1]?.toLowerCase();
  if (maybeLocale === "de" || maybeLocale === "en") {
    const rest = "/" + parts.slice(2).join("/");
    return matchClientSection(rest === "/" ? "/dashboard" : rest);
  }

  // /{locale}/...
  const localeFirst = parts[0]?.toLowerCase();
  if (localeFirst === "de" || localeFirst === "en") {
    const rest = "/" + parts.slice(1).join("/");
    return matchClientSection(rest === "/" ? "/dashboard" : rest);
  }

  return null;
}

/** Longest-prefix active match for sidebar highlighting. */
export function navItemMatchesPath(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  // Prefer longer nav hrefs: /pos must not win over /pos-config
  for (const item of flattenNavItems()) {
    if (item.href === href) continue;
    if (
      item.href.length > href.length &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`))
    ) {
      return false;
    }
  }
  return true;
}
