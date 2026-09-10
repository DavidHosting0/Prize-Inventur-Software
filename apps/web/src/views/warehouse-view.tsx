"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  PackageSearch,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Input } from "@prize/ui";
import { formatMoney, toNumber } from "@/lib/money";
import { KeyboardTable } from "@/components/keyboard-table";
import { DataTablePanel } from "@/components/data-table-panel";
import { StockDetailPanel } from "@/components/stock-detail-panel";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type StockStatus = "all" | "critical" | "low" | "ok";

type StockRow = {
  id: string;
  productId: string;
  quantity: string;
  reservedQty: string;
  lastMovementAt: string | null;
  product: {
    name: string;
    sku: string;
    barcode: string | null;
    unit: string;
    minStock: string;
    optimalStock: string;
    maxStock: string;
    purchasePrice: string;
    isActive: boolean;
    category: { name: string } | null;
    supplier: { name: string } | null;
  };
};

function stockTone(qty: number, min: number): "danger" | "warning" | "success" {
  if (min > 0 && qty < min * 0.5) return "danger";
  if (min > 0 && qty < min) return "warning";
  return "success";
}

function StockMeter({
  qty,
  min,
  optimal,
  max,
}: {
  qty: number;
  min: number;
  optimal: number;
  max: number;
}) {
  const ceiling = Math.max(max, optimal, min, qty, 1);
  const pct = Math.min(100, (qty / ceiling) * 100);
  const tone = stockTone(qty, min);
  const color =
    tone === "danger"
      ? "var(--danger)"
      : tone === "warning"
        ? "var(--warning)"
        : "var(--success)";

  return (
    <div className="flex min-w-[88px] items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-sm bg-[var(--border-subtle)]">
        <div
          className="h-full rounded-sm"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="tabular-nums text-xs font-semibold">{qty}</span>
    </div>
  );
}

export default function WarehousePage() {
  const t = useTranslations("stock");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const { data: session } = useSession();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 250);
  const [statusFilter, setStatusFilter] = useState<StockStatus>("all");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";
  const canAdjust =
    session?.user?.roleCode === "ADMIN" ||
    (session?.user?.permissions ?? []).includes("stock.adjust");

  const stock = useQuery({
    queryKey: ["stock", debouncedQ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      const res = await fetch(`/api/v1/stock?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const items = (stock.data?.items ?? []) as StockRow[];
  const lagerName = stock.data?.warehouse?.name ?? "Lager";
  const apiSummary = stock.data?.summary;

  const filtered = useMemo(() => {
    return items.filter((s) => {
      const qty = toNumber(s.quantity);
      const min = toNumber(s.product.minStock);
      const tone = stockTone(qty, min);
      if (statusFilter === "critical") return tone === "danger";
      if (statusFilter === "low") return tone === "warning";
      if (statusFilter === "ok") return tone === "success";
      return true;
    });
  }, [items, statusFilter]);

  const summary = useMemo(() => {
    if (apiSummary && !debouncedQ && statusFilter === "all") {
      return apiSummary as {
        stockValue: number;
        critical: number;
        belowMin: number;
        ok: number;
        rowCount: number;
      };
    }
    let critical = 0;
    let belowMin = 0;
    let stockValue = 0;
    for (const s of items) {
      const qty = toNumber(s.quantity);
      const min = toNumber(s.product.minStock);
      stockValue += qty * toNumber(s.product.purchasePrice);
      const tone = stockTone(qty, min);
      if (tone === "danger") critical += 1;
      else if (tone === "warning") belowMin += 1;
    }
    return {
      stockValue,
      critical,
      belowMin,
      ok: Math.max(0, items.length - critical - belowMin),
      rowCount: items.length,
    };
  }, [apiSummary, items, debouncedQ, statusFilter]);

  const filters: { id: StockStatus; label: string; count: number }[] = [
    { id: "all", label: tc("all"), count: summary.rowCount },
    { id: "critical", label: t("statusCritical"), count: summary.critical },
    { id: "low", label: t("statusLow"), count: summary.belowMin },
    { id: "ok", label: t("statusOk"), count: summary.ok },
  ];

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.warehouse") }]}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3.5 py-3 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
              {t("stockValue")}
            </div>
            <PackageSearch className="h-3.5 w-3.5 text-[var(--text-dim)]" />
          </div>
          <div className="mt-1 text-lg font-bold tabular-nums tracking-tight">
            {formatMoney(summary.stockValue, currency, locale)}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            {lagerName} · {summary.rowCount} {t("articles")}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setStatusFilter("critical")}
          className={`rounded-[var(--radius)] border px-3.5 py-3 text-left shadow-[var(--shadow-sm)] transition-colors ${
            statusFilter === "critical"
              ? "border-[var(--danger)]/40 bg-[var(--danger-muted)]"
              : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-hover)]"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
              {t("statusCritical")}
            </div>
            <AlertTriangle className="h-3.5 w-3.5 text-[var(--danger)]" />
          </div>
          <div className="mt-1 text-lg font-bold tabular-nums text-[var(--danger)]">
            {summary.critical}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            {t("criticalHint")}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("low")}
          className={`rounded-[var(--radius)] border px-3.5 py-3 text-left shadow-[var(--shadow-sm)] transition-colors ${
            statusFilter === "low"
              ? "border-[var(--warning)]/40 bg-[var(--warning-muted)]"
              : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-hover)]"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
              {t("statusLow")}
            </div>
            <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--warning)]" />
          </div>
          <div className="mt-1 text-lg font-bold tabular-nums text-[var(--warning)]">
            {summary.belowMin}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            {t("lowHint")}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("ok")}
          className={`rounded-[var(--radius)] border px-3.5 py-3 text-left shadow-[var(--shadow-sm)] transition-colors ${
            statusFilter === "ok"
              ? "border-[var(--success)]/40 bg-[var(--success-muted)]"
              : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-hover)]"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
              {t("statusOk")}
            </div>
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" />
          </div>
          <div className="mt-1 text-lg font-bold tabular-nums text-[var(--success)]">
            {summary.ok}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            {t("okHint")}
          </div>
        </button>
      </div>

      <DataTablePanel
        title={`${t("title")} — ${lagerName}`}
        toolbar={
          <>
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-dim)]" />
              <Input
                className="pl-8"
                placeholder={`${tc("search")}…`}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                    statusFilter === f.id
                      ? "border-[var(--primary)] bg-[var(--primary-muted)] text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--text)]"
                  }`}
                >
                  {f.label}
                  <span className="tabular-nums opacity-70">{f.count}</span>
                </button>
              ))}
            </div>
            <span className="hidden text-[11px] text-[var(--text-dim)] desktop:inline">
              <kbd className="kbd">↑↓</kbd> <kbd className="kbd">Enter</kbd>
            </span>
          </>
        }
        toolbarRight={
          <span className="text-xs text-[var(--text-dim)]">
            {stock.isFetching && !stock.isLoading ? "…" : null}{" "}
            {tc("showingRows", {
              from: filtered.length ? 1 : 0,
              to: filtered.length,
              total: filtered.length,
            })}
          </span>
        }
        empty={
          !stock.isLoading && filtered.length === 0 ? tc("noRows") : undefined
        }
      >
        {stock.isLoading ? (
          <div className="p-4 text-sm text-[var(--text-muted)]">
            {tc("loading")}
          </div>
        ) : filtered.length > 0 ? (
          <table className="app-table">
            <thead>
              <tr>
                <th className="w-0 p-0" aria-hidden />
                <th>{tc("product")}</th>
                <th>{t("sku")}</th>
                <th>{t("category")}</th>
                <th>{t("quantity")}</th>
                <th>{t("reserved")}</th>
                <th>{t("minStock")}</th>
                <th>{t("value")}</th>
                <th>{t("lastMovement")}</th>
                <th>{tc("status")}</th>
              </tr>
            </thead>
            <KeyboardTable
              onActivate={(index) => {
                const s = filtered[index];
                if (!s) return;
                setSelectedProductId(s.productId);
              }}
            >
              {filtered.map((s, idx) => {
                const qty = toNumber(s.quantity);
                const min = toNumber(s.product.minStock);
                const optimal = toNumber(s.product.optimalStock);
                const max = toNumber(s.product.maxStock);
                const value = qty * toNumber(s.product.purchasePrice);
                const tone = stockTone(qty, min);
                const selected = selectedProductId === s.productId;
                const statusLabel =
                  tone === "danger"
                    ? t("statusCritical")
                    : tone === "warning"
                      ? t("statusLow")
                      : t("statusOk");

                return (
                  <tr
                    key={s.id}
                    data-kbd-row
                    data-kbd-index={idx}
                    className="cursor-pointer"
                    style={
                      selected
                        ? { boxShadow: "inset 3px 0 0 var(--primary)" }
                        : tone !== "success"
                          ? {
                              boxShadow: `inset 3px 0 0 ${
                                tone === "danger"
                                  ? "var(--danger)"
                                  : "var(--warning)"
                              }`,
                            }
                          : undefined
                    }
                    onClick={() => setSelectedProductId(s.productId)}
                  >
                    <td className="w-0 !p-0" aria-hidden />
                    <td>
                      <div className="font-medium leading-tight">
                        {s.product.name}
                      </div>
                      {s.product.supplier?.name ? (
                        <div className="mt-0.5 text-[10px] text-[var(--text-dim)]">
                          {s.product.supplier.name}
                        </div>
                      ) : null}
                    </td>
                    <td className="font-mono text-xs text-[var(--text-muted)]">
                      {s.product.sku}
                    </td>
                    <td className="text-[var(--text-muted)]">
                      {s.product.category?.name ?? "—"}
                    </td>
                    <td>
                      <StockMeter
                        qty={qty}
                        min={min}
                        optimal={optimal}
                        max={max}
                      />
                    </td>
                    <td className="tabular-nums text-[var(--text-muted)]">
                      {toNumber(s.reservedQty)}
                    </td>
                    <td className="tabular-nums text-[var(--text-muted)]">
                      {min}
                    </td>
                    <td className="tabular-nums">
                      {formatMoney(value, currency, locale)}
                    </td>
                    <td className="whitespace-nowrap text-xs text-[var(--text-dim)]">
                      {s.lastMovementAt
                        ? new Date(s.lastMovementAt).toLocaleDateString(locale)
                        : "—"}
                    </td>
                    <td>
                      <Badge tone={tone}>{statusLabel}</Badge>
                    </td>
                  </tr>
                );
              })}
            </KeyboardTable>
          </table>
        ) : null}
      </DataTablePanel>

      <StockDetailPanel
        productId={selectedProductId}
        onClose={() => setSelectedProductId(null)}
        currency={currency}
        locale={locale}
        canAdjust={canAdjust}
      />
    </AppShell>
  );
}
