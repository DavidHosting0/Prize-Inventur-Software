"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import clsx from "clsx";

const TABS: {
  href: string;
  key:
    | "overview"
    | "articles"
    | "categories"
    | "recipes"
    | "prices"
    | "layout"
    | "preview"
    | "settings";
  exact?: boolean;
}[] = [
  { href: "/pos-config", key: "overview", exact: true },
  { href: "/pos-config/articles", key: "articles" },
  { href: "/pos-config/categories", key: "categories" },
  { href: "/pos-config/recipes", key: "recipes" },
  { href: "/pos-config/prices", key: "prices" },
  { href: "/pos-config/layout", key: "layout" },
  { href: "/pos-config/preview", key: "preview" },
  { href: "/pos-config/settings", key: "settings" },
];

export function PosConfigNav() {
  const t = useTranslations("posConfig");
  const pathname = usePathname();

  return (
    <nav className="mb-4 flex flex-wrap gap-1.5 border-b border-[var(--border)] pb-3">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--text)]"
            )}
          >
            {t(`tabs.${tab.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
