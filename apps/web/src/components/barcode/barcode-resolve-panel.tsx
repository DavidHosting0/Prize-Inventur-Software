"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@prize/ui";

type BarcodeResolvePanelProps = {
  productName: string;
  barcode?: string | null;
  locationLabel?: string | null;
  systemQty?: number | null;
  countedQty?: number | null;
  difference?: number | null;
  children?: ReactNode;
  className?: string;
};

export function BarcodeResolvePanel({
  productName,
  barcode,
  locationLabel,
  systemQty,
  countedQty,
  difference,
  children,
  className,
}: BarcodeResolvePanelProps) {
  const t = useTranslations("barcode");

  const diffClass =
    difference == null
      ? ""
      : difference < 0
        ? "text-[var(--danger)]"
        : difference > 0
          ? "text-[var(--success)]"
          : "text-[var(--text-muted)]";

  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4",
        className
      )}
    >
      <div className="text-xl font-semibold">{productName}</div>
      {barcode ? (
        <div className="mt-1 font-mono text-xs text-[var(--text-muted)]">
          {t("barcode")}: {barcode}
        </div>
      ) : null}
      {locationLabel ? (
        <div className="mt-1 text-sm text-[var(--text-muted)]">
          {t("location")}: {locationLabel}
        </div>
      ) : null}

      {(systemQty != null || countedQty != null || difference != null) && (
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          {systemQty != null ? (
            <div>
              <div className="text-[10px] uppercase text-[var(--text-dim)]">
                {t("systemStock")}
              </div>
              <div className="text-2xl font-semibold">{systemQty}</div>
            </div>
          ) : null}
          {countedQty != null ? (
            <div>
              <div className="text-[10px] uppercase text-[var(--text-dim)]">
                {t("counted")}
              </div>
              <div className="text-2xl font-semibold text-[var(--primary)]">
                {countedQty}
              </div>
            </div>
          ) : null}
          {difference != null ? (
            <div>
              <div className="text-[10px] uppercase text-[var(--text-dim)]">
                {t("difference")}
              </div>
              <div className={cn("text-2xl font-semibold", diffClass)}>
                {difference > 0 ? `+${difference}` : difference}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
