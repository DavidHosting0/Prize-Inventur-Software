"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  X,
  Package,
  Truck,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from "lucide-react";
import { Badge, Button, Input, Label } from "@prize/ui";
import { formatMoney, toNumber } from "@/lib/money";
import { Link } from "@/i18n/navigation";
import { InlineAlert } from "@/components/inline-alert";

type StockDetailPanelProps = {
  productId: string | null;
  onClose: () => void;
  currency: string;
  locale: string;
  canAdjust: boolean;
};

type TabId = "overview" | "movements" | "deliveries";

const MOVEMENT_LABEL_KEYS: Record<string, string> = {
  SALE: "typeSale",
  PURCHASE: "typePurchase",
  INVENTORY_ADJUSTMENT: "typeInventory",
  TRANSFER: "typeTransfer",
  WASTE: "typeWaste",
  RETURN: "typeReturn",
  MANUAL_ADJUSTMENT: "typeManual",
};

function StockSparkline({
  points,
}: {
  points: { quantityAfter: string | number }[];
}) {
  const values = points.map((p) => Number(p.quantityAfter));
  if (values.length < 2) {
    return (
      <div className="flex h-16 items-center justify-center rounded border border-dashed border-[var(--border)] bg-[var(--input-bg)] text-xs text-[var(--text-dim)]">
        —
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 280;
  const h = 64;
  const pad = 4;
  const coords = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  const area = `M${pad},${h - pad} L${coords.join(" L")} L${w - pad},${h - pad} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-16 w-full rounded border border-[var(--border)] bg-[var(--input-bg)]"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={area} fill="var(--primary-muted)" />
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StockLevelBar({
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
  const minPct = Math.min(100, (min / ceiling) * 100);
  const optPct = Math.min(100, (optimal / ceiling) * 100);
  const tone =
    min > 0 && qty < min * 0.5
      ? "var(--danger)"
      : min > 0 && qty < min
        ? "var(--warning)"
        : "var(--success)";

  return (
    <div className="space-y-1.5">
      <div className="relative h-2.5 overflow-hidden rounded-sm bg-[var(--border-subtle)]">
        <div
          className="absolute inset-y-0 left-0 rounded-sm transition-[width]"
          style={{ width: `${pct}%`, background: tone }}
        />
        {min > 0 ? (
          <div
            className="absolute inset-y-0 w-px bg-[var(--text)]/50"
            style={{ left: `${minPct}%` }}
            title="Min"
          />
        ) : null}
        {optimal > 0 ? (
          <div
            className="absolute inset-y-0 w-px bg-[var(--primary)]/70"
            style={{ left: `${optPct}%` }}
            title="Opt"
          />
        ) : null}
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-[var(--text-dim)]">
        <span>0</span>
        <span>
          Min {min}
          {optimal > 0 ? ` · Opt ${optimal}` : ""}
          {max > 0 ? ` · Max ${max}` : ""}
        </span>
      </div>
    </div>
  );
}

export function StockDetailPanel({
  productId,
  onClose,
  currency,
  locale,
  canAdjust,
}: StockDetailPanelProps) {
  const t = useTranslations("stock");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>("overview");
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTab("overview");
    setAdjustQty(0);
    setAdjustReason("");
    setError(null);
  }, [productId]);

  useEffect(() => {
    if (!productId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [productId, onClose]);

  const detail = useQuery({
    queryKey: ["stock-detail", productId],
    enabled: Boolean(productId),
    queryFn: async () => {
      const res = await fetch(`/api/v1/stock/${productId}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      return res.json();
    },
  });

  const adjust = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("No product");
      const res = await fetch("/api/v1/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          quantity: adjustQty,
          reason: adjustReason || t("manualReason"),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setAdjustQty(0);
      setAdjustReason("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-detail", productId] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const product = detail.data?.product;
  const stockLevel = detail.data?.stockLevel;
  const qty = toNumber(stockLevel?.quantity ?? 0);
  const reserved = toNumber(stockLevel?.reservedQty ?? 0);
  const min = toNumber(product?.minStock ?? 0);
  const optimal = toNumber(product?.optimalStock ?? 0);
  const max = toNumber(product?.maxStock ?? 0);
  const value = qty * toNumber(product?.purchasePrice ?? 0);

  const statusTone = useMemo(() => {
    if (min > 0 && qty < min * 0.5) return "danger" as const;
    if (min > 0 && qty < min) return "warning" as const;
    return "success" as const;
  }, [qty, min]);

  const statusLabel =
    statusTone === "danger"
      ? t("statusCritical")
      : statusTone === "warning"
        ? t("statusLow")
        : t("statusOk");

  if (!productId) return null;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "overview", label: t("tabOverview") },
    {
      id: "movements",
      label: t("tabMovements"),
      count: detail.data?.movements?.length,
    },
    {
      id: "deliveries",
      label: t("tabDeliveries"),
      count: detail.data?.deliveries?.length,
    },
  ];

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/40 desktop:bg-black/25"
        aria-label={tc("close")}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("detailTitle")}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-md)]"
      >
        <header className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)]">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            {detail.isLoading || !product ? (
              <div className="text-sm text-[var(--text-muted)]">{tc("loading")}</div>
            ) : (
              <>
                <div className="truncate text-[15px] font-semibold text-[var(--text)]">
                  {product.name}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-dim)]">
                  <span className="font-mono">{product.sku}</span>
                  {product.category?.name ? (
                    <>
                      <span>·</span>
                      <span>{product.category.name}</span>
                    </>
                  ) : null}
                  {product.barcode ? (
                    <>
                      <span>·</span>
                      <span className="font-mono">{product.barcode}</span>
                    </>
                  ) : null}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--text)]"
            aria-label={tc("close")}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {product ? (
          <>
            <div className="border-b border-[var(--border)] bg-[var(--bg)] px-4 py-3">
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                    {t("quantity")}
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums tracking-tight text-[var(--text)]">
                      {qty}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {product.unit}
                    </span>
                    <Badge tone={statusTone}>{statusLabel}</Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                    {t("value")}
                  </div>
                  <div className="text-sm font-semibold tabular-nums">
                    {formatMoney(value, currency, locale)}
                  </div>
                </div>
              </div>
              <StockLevelBar qty={qty} min={min} optimal={optimal} max={max} />
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded border border-[var(--border-subtle)] bg-[var(--card)] px-2 py-1.5">
                  <div className="text-[var(--text-dim)]">{t("reserved")}</div>
                  <div className="font-semibold tabular-nums">{reserved}</div>
                </div>
                <div className="rounded border border-[var(--border-subtle)] bg-[var(--card)] px-2 py-1.5">
                  <div className="text-[var(--text-dim)]">{t("available")}</div>
                  <div className="font-semibold tabular-nums">
                    {Math.max(0, qty - reserved)}
                  </div>
                </div>
                <div className="rounded border border-[var(--border-subtle)] bg-[var(--card)] px-2 py-1.5">
                  <div className="text-[var(--text-dim)]">{t("lastMovement")}</div>
                  <div className="truncate font-medium tabular-nums">
                    {stockLevel?.lastMovementAt
                      ? new Date(stockLevel.lastMovementAt).toLocaleDateString(
                          locale
                        )
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            <nav className="flex border-b border-[var(--border)] px-2">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`relative px-3 py-2.5 text-xs font-semibold transition-colors ${
                    tab === item.id
                      ? "text-[var(--primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {item.label}
                  {typeof item.count === "number" ? (
                    <span className="ml-1.5 tabular-nums text-[var(--text-dim)]">
                      {item.count}
                    </span>
                  ) : null}
                  {tab === item.id ? (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--primary)]" />
                  ) : null}
                </button>
              ))}
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {detail.isError ? (
                <div className="p-4">
                  <InlineAlert>
                    {(detail.error as Error)?.message ?? tc("error")}
                  </InlineAlert>
                </div>
              ) : null}

              {tab === "overview" ? (
                <div className="space-y-4 p-4">
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                      {t("stockHistory")}
                    </div>
                    <StockSparkline points={detail.data?.history ?? []} />
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
                    <div>
                      <dt className="text-[var(--text-dim)]">{t("supplier")}</dt>
                      <dd className="font-medium">
                        {product.supplier?.name ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--text-dim)]">{t("purchasePrice")}</dt>
                      <dd className="font-medium tabular-nums">
                        {formatMoney(
                          toNumber(product.purchasePrice),
                          currency,
                          locale
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--text-dim)]">{t("minStock")}</dt>
                      <dd className="font-medium tabular-nums">{min}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--text-dim)]">{t("optimalStock")}</dt>
                      <dd className="font-medium tabular-nums">
                        {optimal || "—"}
                      </dd>
                    </div>
                  </dl>

                  {canAdjust ? (
                    <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
                      <div className="mb-2 text-xs font-semibold text-[var(--text)]">
                        {t("adjust")}
                      </div>
                      {error ? (
                        <InlineAlert className="!mb-2">{error}</InlineAlert>
                      ) : null}
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <Label>{t("quantity")} (+/−)</Label>
                          <Input
                            type="number"
                            className="w-24"
                            value={adjustQty}
                            onChange={(e) =>
                              setAdjustQty(Number(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="min-w-[140px] flex-1">
                          <Label>{tc("reason")}</Label>
                          <Input
                            value={adjustReason}
                            onChange={(e) => setAdjustReason(e.target.value)}
                            placeholder={t("manualReason")}
                          />
                        </div>
                        <Button
                          size="sm"
                          disabled={adjustQty === 0 || adjust.isPending}
                          onClick={() => adjust.mutate()}
                        >
                          {t("adjust")}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <Link
                    href={`/products/${product.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    {t("openProduct")}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ) : null}

              {tab === "movements" ? (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {(detail.data?.movements ?? []).length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                      {t("noMovements")}
                    </div>
                  ) : (
                    (detail.data.movements as Array<{
                      id: string;
                      type: string;
                      quantity: string;
                      quantityBefore: string;
                      quantityAfter: string;
                      reason: string | null;
                      createdAt: string;
                      user: { name: string } | null;
                    }>).map((m) => {
                      const delta = toNumber(m.quantity);
                      const positive = delta > 0;
                      const labelKey = MOVEMENT_LABEL_KEYS[m.type];
                      const typeLabel = labelKey ? t(labelKey as "typeSale") : m.type;
                      return (
                        <div key={m.id} className="flex gap-3 px-4 py-3">
                          <div
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                              positive
                                ? "bg-[var(--success-muted)] text-[var(--success)]"
                                : "bg-[var(--danger-muted)] text-[var(--danger)]"
                            }`}
                          >
                            {positive ? (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-medium">{typeLabel}</div>
                                <div className="truncate text-[11px] text-[var(--text-dim)]">
                                  {m.reason || m.user?.name || "—"}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div
                                  className={`text-sm font-semibold tabular-nums ${
                                    positive
                                      ? "text-[var(--success)]"
                                      : "text-[var(--danger)]"
                                  }`}
                                >
                                  {positive ? "+" : ""}
                                  {delta}
                                </div>
                                <div className="text-[10px] tabular-nums text-[var(--text-dim)]">
                                  → {toNumber(m.quantityAfter)}
                                </div>
                              </div>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--text-dim)]">
                              <Activity className="h-3 w-3" />
                              {new Date(m.createdAt).toLocaleString(locale)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : null}

              {tab === "deliveries" ? (
                <div className="divide-y divide-[var(--border-subtle)]">
                  {(detail.data?.deliveries ?? []).length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                      {t("noDeliveries")}
                    </div>
                  ) : (
                    (detail.data.deliveries as Array<{
                      id: string;
                      qtyOrdered: string;
                      qtyDelivered: string;
                      qtyDamaged: string;
                      qtyMissing: string;
                      purchasePrice: string;
                      expiryDate: string | null;
                      batchNo: string | null;
                      goodsReceipt: {
                        id: string;
                        deliveryNoteNo: string | null;
                        status: string;
                        receivedAt: string;
                        confirmedAt: string | null;
                        supplier: { name: string };
                      };
                    }>).map((d) => (
                      <div key={d.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--primary-muted)] text-[var(--primary)]">
                            <Truck className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-medium">
                                  {d.goodsReceipt.supplier.name}
                                </div>
                                <div className="text-[11px] text-[var(--text-dim)]">
                                  {d.goodsReceipt.deliveryNoteNo
                                    ? `${t("deliveryNote")} ${d.goodsReceipt.deliveryNoteNo}`
                                    : t("noDeliveryNote")}
                                </div>
                              </div>
                              <Badge
                                tone={
                                  d.goodsReceipt.status === "CONFIRMED"
                                    ? "success"
                                    : d.goodsReceipt.status === "CANCELLED"
                                      ? "danger"
                                      : "warning"
                                }
                              >
                                {d.goodsReceipt.status}
                              </Badge>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                              <div>
                                <div className="text-[var(--text-dim)]">
                                  {t("qtyDelivered")}
                                </div>
                                <div className="font-semibold tabular-nums">
                                  {toNumber(d.qtyDelivered)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[var(--text-dim)]">
                                  {t("qtyOrdered")}
                                </div>
                                <div className="font-semibold tabular-nums">
                                  {toNumber(d.qtyOrdered)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[var(--text-dim)]">
                                  {t("purchasePrice")}
                                </div>
                                <div className="font-semibold tabular-nums">
                                  {formatMoney(
                                    toNumber(d.purchasePrice),
                                    currency,
                                    locale
                                  )}
                                </div>
                              </div>
                            </div>
                            {(toNumber(d.qtyDamaged) > 0 ||
                              toNumber(d.qtyMissing) > 0 ||
                              d.batchNo ||
                              d.expiryDate) && (
                              <div className="mt-1.5 text-[10px] text-[var(--text-dim)]">
                                {toNumber(d.qtyDamaged) > 0
                                  ? `${t("qtyDamaged")}: ${toNumber(d.qtyDamaged)} · `
                                  : ""}
                                {toNumber(d.qtyMissing) > 0
                                  ? `${t("qtyMissing")}: ${toNumber(d.qtyMissing)} · `
                                  : ""}
                                {d.batchNo ? `${t("batchNo")}: ${d.batchNo} · ` : ""}
                                {d.expiryDate
                                  ? `${t("expiry")}: ${new Date(d.expiryDate).toLocaleDateString(locale)}`
                                  : ""}
                              </div>
                            )}
                            <div className="mt-1 text-[10px] text-[var(--text-dim)]">
                              {new Date(
                                d.goodsReceipt.confirmedAt ??
                                  d.goodsReceipt.receivedAt
                              ).toLocaleString(locale)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </aside>
    </>
  );
}
