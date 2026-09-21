"use client";

import { lazy, type ComponentType } from "react";
import { SECTION_VIEW_HREFS } from "@/lib/section-view-hrefs";
import { CLIENT_SECTION_HREFS } from "@/lib/client-sections";

export type SectionLoader = () => Promise<{ default: ComponentType }>;

const LOADERS: Record<(typeof SECTION_VIEW_HREFS)[number], SectionLoader> = {
  "/dashboard": () => import("@/views/dashboard-view"),
  "/warehouse": () => import("@/views/warehouse-view"),
  "/inventory": () => import("@/views/inventory-view"),
  "/goods-receipt": () => import("@/views/goods-receipt-view"),
  "/orders": () => import("@/views/orders-view"),
  "/suppliers": () => import("@/views/suppliers-view"),
  "/products": () => import("@/views/products-view"),
  "/recipes": () => import("@/views/recipes-view"),
  "/food-waste": () => import("@/views/food-waste-view"),
  "/breakfast": () => import("@/views/breakfast-view"),
  "/minibar": () => import("@/views/minibar-view"),
  "/lots": () => import("@/views/lots-view"),
  "/reorder": () => import("@/views/reorder-view"),
  "/outlets": () => import("@/views/outlets-view"),
  "/banquet": () => import("@/views/banquet-view"),
  "/haccp": () => import("@/views/haccp-view"),
  "/food-cost": () => import("@/views/food-cost-view"),
  "/variances": () => import("@/views/variances-view"),
  "/valuation": () => import("@/views/valuation-view"),
  "/reports": () => import("@/views/reports-view"),
  "/users": () => import("@/views/users-view"),
  "/settings": () => import("@/views/settings-view"),
  "/transfers": () => import("@/views/transfers-view"),
};

const lazyCache = new Map<string, ComponentType>();

export function getSectionLazy(href: string): ComponentType | null {
  if (!CLIENT_SECTION_HREFS.has(href)) return null;
  const loader = LOADERS[href as keyof typeof LOADERS];
  if (!loader) return null;
  let Comp = lazyCache.get(href);
  if (!Comp) {
    Comp = lazy(loader);
    lazyCache.set(href, Comp);
  }
  return Comp;
}

/** Preload a section's JS chunk (hover / idle). */
export function preloadSection(href: string) {
  const loader = LOADERS[href as keyof typeof LOADERS];
  if (!loader) return;
  void loader();
}

export function listSectionHrefs() {
  return [...SECTION_VIEW_HREFS];
}

export function hasSectionLoader(href: string): boolean {
  return Boolean(LOADERS[href as keyof typeof LOADERS]);
}
