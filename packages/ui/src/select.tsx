import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
