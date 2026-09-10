"use client";

import { Suspense, useEffect } from "react";
import { useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import { hotelAppPath } from "@/lib/hotel-url";
import { useHotelSection } from "./hotel-section-provider";
import { getSectionLazy } from "./section-registry";

function SectionFallback() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-8 w-48 rounded-md bg-[var(--card)]" />
      <div className="h-40 rounded-[var(--radius-lg)] bg-[var(--card)]" />
    </div>
  );
}

/**
 * On full page load, render Next.js children (SSR / first paint).
 * After a sidebar client navigation, swap to the lazy section (no RSC).
 * If a client override has no loader, hard-navigate so the URL never lies.
 */
export function HotelSectionOutlet({ children }: { children: React.ReactNode }) {
  const { sectionHref, isClientOverride } = useHotelSection();
  const locale = useLocale();
  const { data: session } = useSession();

  const Comp =
    isClientOverride && sectionHref ? getSectionLazy(sectionHref) : null;

  useEffect(() => {
    if (!isClientOverride || !sectionHref || Comp) return;
    const slug = session?.user?.hotelSlug;
    const url = slug
      ? hotelAppPath(slug, locale, sectionHref)
      : `/${locale}${sectionHref}`;
    window.location.replace(url);
  }, [isClientOverride, sectionHref, Comp, locale, session?.user?.hotelSlug]);

  if (isClientOverride && sectionHref && Comp) {
    return (
      <Suspense fallback={<SectionFallback />}>
        <Comp />
      </Suspense>
    );
  }

  return <>{children}</>;
}
