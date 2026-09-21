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

  return (
    <Card className={cn("min-w-0", className)}>
      <CardBody className="px-3.5 py-3">
        <div className="text-[12px] font-medium text-[var(--text-muted)]">
          {label}
        </div>
        <div className="mt-1.5 font-mono text-[22px] font-semibold leading-none tracking-tight text-[var(--text)] tabular-nums">
          {value}
        </div>
        {hint ? (
          <div className={cn("mt-1.5 text-[11px] font-medium", hintColor)}>{hint}</div>
        ) : null}
      </CardBody>
    </Card>
  );
}
