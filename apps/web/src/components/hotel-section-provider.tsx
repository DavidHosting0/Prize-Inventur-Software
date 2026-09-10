"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { hotelAppPath } from "@/lib/hotel-url";
import {
  matchClientSection,
  isNestedAppPath,
  sectionFromBrowserPath,
  CLIENT_SECTION_HREFS,
  isFullPageNavHref,
} from "@/lib/client-sections";
import { prefetchNavRoute } from "@/lib/query-prefetch";
import { preloadSection, hasSectionLoader } from "./section-registry";

type HotelSectionContextValue = {
  /** Active top-level section href, or null when showing a nested Next page */
  sectionHref: string | null;
  /** True when the section was chosen via client nav (pushState), not the Next page */
  isClientOverride: boolean;
  /** Navigate to a client section without RSC (or hard-nav when no section view) */
  navigateSection: (href: string) => void;
  /**
   * Leave client-section mode and fully load an app path (detail pages, etc.).
   * Required when opening nested routes from a pushState section view.
   */
  navigateAppPath: (href: string) => void;
  /** Warm API + JS for a section */
  warmSection: (href: string) => void;
  isClientSection: (href: string) => boolean;
};

const HotelSectionContext = createContext<HotelSectionContextValue | null>(
  null
);

export function useHotelSection() {
  const ctx = useContext(HotelSectionContext);
  if (!ctx) {
    throw new Error("useHotelSection must be used within HotelSectionProvider");
  }
  return ctx;
}

function hardNavigate(href: string, locale: string, hotelSlug?: string | null) {
  if (hotelSlug) {
    window.location.href = hotelAppPath(hotelSlug, locale, href);
  } else {
    window.location.href = `/${locale}${href}`;
  }
}

export function HotelSectionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [overrideHref, setOverrideHref] = useState<string | null>(null);

  // Drop pushState override only once Next pathname has caught up to that section
  // (or a detail under it). Do not clear while pathname is still a stale other route.
  useEffect(() => {
    if (!overrideHref) return;
    if (
      pathname === overrideHref ||
      pathname.startsWith(`${overrideHref}/`)
    ) {
      setOverrideHref(null);
    }
  }, [pathname, overrideHref]);

  useEffect(() => {
    const onPopState = () => {
      const fromUrl = sectionFromBrowserPath(window.location.pathname);
      setOverrideHref(fromUrl);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Idle-warm primary section data + JS
  useEffect(() => {
    const run = () => {
      for (const href of CLIENT_SECTION_HREFS) {
        prefetchNavRoute(queryClient, href);
        preloadSection(href);
      }
    };
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      timeoutId = setTimeout(run, 400);
    }
    return () => {
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [queryClient]);

  const sectionHref = useMemo(() => {
    if (
      overrideHref &&
      CLIENT_SECTION_HREFS.has(overrideHref) &&
      hasSectionLoader(overrideHref)
    ) {
      // Soft-opened a detail under this section → show Next children immediately
      // (do not wait for useEffect to clear override; that left the list stuck)
      if (pathname.startsWith(`${overrideHref}/`)) {
        return null;
      }
      // Sidebar client nav wins while Next pathname is still another route
      return overrideHref;
    }
    if (isNestedAppPath(pathname) || isFullPageNavHref(pathname)) return null;
    return matchClientSection(pathname);
  }, [pathname, overrideHref]);

  const isClientOverride = Boolean(
    overrideHref &&
      CLIENT_SECTION_HREFS.has(overrideHref) &&
      hasSectionLoader(overrideHref) &&
      !pathname.startsWith(`${overrideHref}/`)
  );

  const warmSection = useCallback(
    (href: string) => {
      if (!CLIENT_SECTION_HREFS.has(href) || !hasSectionLoader(href)) return;
      prefetchNavRoute(queryClient, href);
      preloadSection(href);
    },
    [queryClient]
  );

  const navigateSection = useCallback(
    (href: string) => {
      const slug = session?.user?.hotelSlug;

      // No registered client view → always full navigation (never pushState-only)
      if (
        isFullPageNavHref(href) ||
        !CLIENT_SECTION_HREFS.has(href) ||
        !hasSectionLoader(href)
      ) {
        hardNavigate(href, locale, slug);
        return;
      }

      warmSection(href);
      setOverrideHref(href);

      const url = slug
        ? hotelAppPath(slug, locale, href)
        : `/${locale}${href}`;
      window.history.pushState({ hotelSection: href }, "", url);
    },
    [session?.user?.hotelSlug, locale, warmSection]
  );

  const navigateAppPath = useCallback(
    (href: string) => {
      setOverrideHref(null);
      hardNavigate(href, locale, session?.user?.hotelSlug);
    },
    [locale, session?.user?.hotelSlug]
  );

  const value = useMemo(
    () => ({
      sectionHref,
      isClientOverride,
      navigateSection,
      navigateAppPath,
      warmSection,
      isClientSection: (href: string) =>
        CLIENT_SECTION_HREFS.has(href) && hasSectionLoader(href),
    }),
    [
      sectionHref,
      isClientOverride,
      navigateSection,
      navigateAppPath,
      warmSection,
    ]
  );

  return (
    <HotelSectionContext.Provider value={value}>
      {children}
    </HotelSectionContext.Provider>
  );
}
