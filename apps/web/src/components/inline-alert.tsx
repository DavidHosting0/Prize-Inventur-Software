"use client";

import type { ReactNode } from "react";
import { cn } from "@prize/ui";

export function InlineAlert({
  tone = "danger",
  children,
  className,
}: {
  tone?: "danger" | "success" | "warning" | "info";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    danger:
      "border-[var(--danger)]/30 bg-[var(--danger-muted)] text-[var(--danger)]",
    success:
      "border-[var(--success)]/30 bg-[var(--success-muted)] text-[var(--success)]",
    warning:
      "border-[var(--warning)]/30 bg-[var(--warning-muted)] text-[var(--warning)]",
    info: "border-[var(--primary)]/30 bg-[var(--primary-muted)] text-[var(--primary)]",
  };
  return (
    <div
      role="alert"
      className={cn(
        "mb-3 rounded-[var(--radius-sm)] border px-3 py-2 text-sm",
        tones[tone],
        className
      )}
    >
      {children}
    </div>
  );
}
