"use client";

import { Link } from "@/i18n/navigation";

export type Crumb = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items.length) return null;
  return (
    <nav className="breadcrumb-bar" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 ? <span className="breadcrumb-sep">/</span> : null}
            {item.href && !last ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span className="breadcrumb-current">{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
