/**
 * Top-level routes that have a lazy client view in `section-registry`.
 * Keep in sync with LOADERS there — tests enforce this.
 */
export const SECTION_VIEW_HREFS = [
  "/dashboard",
  "/warehouse",
  "/inventory",
  "/goods-receipt",
  "/orders",
  "/suppliers",
  "/products",
  "/recipes",
  "/food-waste",
  "/breakfast",
  "/minibar",
  "/reports",
  "/users",
  "/settings",
  "/transfers",
] as const;

export type SectionViewHref = (typeof SECTION_VIEW_HREFS)[number];
