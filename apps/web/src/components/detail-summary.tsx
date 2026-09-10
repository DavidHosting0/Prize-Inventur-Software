"use client";

import type { ReactNode } from "react";
import { Card, CardBody, cn } from "@prize/ui";

export function DetailSummary({
  media,
  children,
  metric,
  className,
}: {
  media?: ReactNode;
  children?: ReactNode;
  metric?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardBody className="p-0">
        <div className="grid gap-0 desktop:grid-cols-[140px_1fr_200px]">
          <div className="flex items-center justify-center border-b border-[var(--border-subtle)] bg-[var(--card-hover)] p-4 desktop:border-b-0 desktop:border-r">
            {media}
          </div>
          <div className="border-b border-[var(--border-subtle)] p-4 desktop:border-b-0 desktop:border-r">
            {children}
          </div>
          <div className="p-4">{metric}</div>
        </div>
      </CardBody>
    </Card>
  );
}

export function DetailMetric({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {icon}
        {label}
      </div>
      <div className="text-3xl font-bold tracking-tight text-[var(--text)]">
        {value}
      </div>
      {hint ? (
        <div className="mt-2 text-sm text-[var(--text-muted)]">{hint}</div>
      ) : null}
    </div>
  );
}
