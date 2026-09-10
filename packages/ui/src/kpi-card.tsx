import type { ReactNode } from "react";
import { Card, CardBody } from "./card";
import { cn } from "./cn";

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
}) {
  const hintColor =
    tone === "success"
      ? "text-[var(--success)]"
      : tone === "warning"
        ? "text-[var(--warning)]"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : "text-[var(--text-muted)]";

  const accentBorder =
    tone === "success"
      ? "border-l-[3px] border-l-[var(--success)]"
      : tone === "warning"
        ? "border-l-[3px] border-l-[var(--warning)]"
        : tone === "danger"
          ? "border-l-[3px] border-l-[var(--danger)]"
          : "border-l-[3px] border-l-[var(--accent)]";

  return (
    <Card className={cn("min-w-0", accentBorder, className)}>
      <CardBody className="px-3.5 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]">
          {label}
        </div>
        <div className="mt-1.5 text-[22px] font-bold leading-none tracking-tight text-[var(--text)] tabular-nums">
          {value}
        </div>
        {hint ? (
          <div className={cn("mt-1.5 text-[11px] font-medium", hintColor)}>{hint}</div>
        ) : null}
      </CardBody>
    </Card>
  );
}
