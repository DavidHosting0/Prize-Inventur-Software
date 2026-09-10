"use client";

import type { ReactNode } from "react";
import { cn } from "@prize/ui";

export function PageToolbar({
  children,
  className,
  right,
}: {
  children?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("page-toolbar", className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {children}
      </div>
      {right ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>
      ) : null}
    </div>
  );
}
