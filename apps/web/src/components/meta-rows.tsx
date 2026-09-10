"use client";

import type { ReactNode } from "react";
import { cn } from "@prize/ui";

export function MetaRows({
  rows,
  className,
}: {
  rows: { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            {row.label}
          </dt>
          <dd className="mt-0.5 truncate text-sm text-[var(--text)]">
            {row.value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
