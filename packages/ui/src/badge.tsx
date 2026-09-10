import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type Tone = "default" | "success" | "warning" | "danger" | "primary";

const tones: Record<Tone, string> = {
  default: "bg-[var(--border-subtle)] text-[var(--text-muted)]",
  success: "bg-[var(--success-muted)] text-[var(--success)]",
  warning: "bg-[var(--warning-muted)] text-[var(--warning)]",
  danger: "bg-[var(--danger-muted)] text-[var(--danger)]",
  primary: "bg-[var(--primary-muted)] text-[var(--primary)]",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
