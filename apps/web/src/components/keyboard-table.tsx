"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@prize/ui";

/**
 * Table body with ↑↓ + Enter navigation for professional keyboard workflows.
 */
export function KeyboardTable({
  children,
  className,
  onActivate,
}: {
  children: ReactNode;
  className?: string;
  onActivate?: (index: number) => void;
}) {
  const ref = useRef<HTMLTableSectionElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const rows = ref.current?.querySelectorAll<HTMLElement>("tr[data-kbd-row]");
    rows?.forEach((row, i) => {
      row.dataset.kbdActive = i === active ? "true" : "false";
      row.tabIndex = i === active ? 0 : -1;
    });
  }, [active, children]);

  return (
    <tbody
      ref={ref}
      className={cn(className)}
      onKeyDown={(e) => {
        const rows = Array.from(
          ref.current?.querySelectorAll<HTMLElement>("tr[data-kbd-row]") ?? []
        );
        if (!rows.length) return;
        let next = active;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          next = Math.min(rows.length - 1, active + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          next = Math.max(0, active - 1);
        } else if (e.key === "Home") {
          e.preventDefault();
          next = 0;
        } else if (e.key === "End") {
          e.preventDefault();
          next = rows.length - 1;
        } else if (e.key === "Enter") {
          e.preventDefault();
          onActivate?.(active);
          rows[active]?.querySelector<HTMLElement>("a,button")?.click();
          return;
        }
        if (next !== active) {
          setActive(next);
          rows[next]?.focus();
        }
      }}
    >
      {children}
    </tbody>
  );
}
