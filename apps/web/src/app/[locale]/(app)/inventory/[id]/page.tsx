"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ScanBarcode, CheckCircle2, ClipboardCheck, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Input, cn } from "@prize/ui";
import { formatMoney, toNumber } from "@/lib/money";
import { HotelLink } from "@/components/hotel-link";
import { DataTablePanel } from "@/components/data-table-panel";
import { InlineAlert } from "@/components/inline-alert";
import { InventoryQtyControls } from "@/components/inventory-qty-controls";
import {
  HardwareBarcodeInput,
  BarcodeResolvePanel,
  UnknownBarcodeActions,
} from "@/components/barcode";
import { resolveBarcode } from "@/lib/barcode-client";
import { mlToBottleInput } from "@/lib/liquid-stock-format";
import {
  DEFAULT_INVENTORY_SETTINGS,
  type InventorySettingsJson,
} from "@prize/types";

type CountProduct = {
  name: string;
  trackLiquid?: boolean;
  bottleContentMl?: string | number | null;
};

type CountItem = {
  id: string;
  productId: string;
  systemQty: string;
  countedQty: string | null;
  difference: string | null;
  valueDiff: string | null;
  product: CountProduct;
};

type TabKey = "uncounted" | "all" | "diffs";

function displayQty(ml: number, product: CountProduct): number {
  if (product.trackLiquid && product.bottleContentMl != null) {
    return mlToBottleInput(ml, product.bottleContentMl);
  }
  return ml;
}

function mapError(
  code: string,
  t: (key: "errors.UNCOUNTED_ITEMS_REMAIN" | "errors.REVIEW_REQUIRED" | "errors.COUNT_NOT_IN_PROGRESS" | "errors.COUNT_NOT_IN_REVIEW" | "errors.COUNT_ALREADY_CLOSED" | "errors.COUNT_NOT_FOUND" | "errors.COUNT_NOT_EDITABLE") => string
): string {
  const known = new Set([
    "UNCOUNTED_ITEMS_REMAIN",
    "REVIEW_REQUIRED",
    "COUNT_NOT_IN_PROGRESS",
    "COUNT_NOT_IN_REVIEW",
    "COUNT_ALREADY_CLOSED",
    "COUNT_NOT_FOUND",
    "COUNT_NOT_EDITABLE",
  ]);
  if (known.has(code)) {
    return t(`errors.${code}` as "errors.UNCOUNTED_ITEMS_REMAIN");
  }
  return code;
}

export default function InventoryDetailPage() {
  const t = useTranslations("inventory");
  const tb = useTranslations("barcode");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const qc = useQueryClient();
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";
  const canCreate =
    session?.user?.roleCode === "ADMIN" ||
    (session?.user?.permissions ?? []).includes("products.create");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<TabKey>("uncounted");
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  const [current, setCurrent] = useState<{
    productId: string;
    name: string;
    barcode: string | null;
    systemQty: number;
    trackLiquid: boolean;
    bottleContentMl: number | null;
  } | null>(null);
  const [qty, setQty] = useState(0);

  const { data: count, refetch } = useQuery({
    queryKey: ["inventory-count", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/inventory-counts/${params.id}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const settings: InventorySettingsJson =
    count?.inventorySettings ?? DEFAULT_INVENTORY_SETTINGS;

  const countMutation = useMutation({
    mutationFn: async (input: { productId: string; countedQty: number }) => {
      const res = await fetch(`/api/v1/inventory-counts/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "count", ...input }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      refetch();
    },
    onError: (e: Error) => setError(mapError(e.message, t)),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: "review" | "reopen" | "close") => {
      const res = await fetch(`/api/v1/inventory-counts/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["inventory-counts"] });
      refetch();
    },
    onError: (e: Error) => setError(mapError(e.message, t)),
  });

  const allItems: CountItem[] = count?.items ?? [];

  const stats = useMemo(() => {
    const total = allItems.length;
    const counted = allItems.filter((i) => i.countedQty != null).length;
    const diffs = allItems.filter(
      (i) => i.difference != null && Number(i.difference) !== 0
    );
    const valueDiffSum = diffs.reduce(
      (s, i) => s + Math.abs(toNumber(i.valueDiff ?? 0)),
      0
    );
    return {
      total,
      counted,
      uncounted: total - counted,
      diffs: diffs.length,
      valueDiffSum,
      pct: total > 0 ? Math.round((counted / total) * 100) : 0,
    };
  }, [allItems]);

  const items = useMemo(() => {
    let rows = allItems;
    if (tab === "uncounted") {
      rows = rows.filter((i) => i.countedQty == null);
    } else if (tab === "diffs") {
      rows = rows.filter(
        (i) => i.difference != null && Number(i.difference) !== 0
      );
    }
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((i) => i.product.name.toLowerCase().includes(needle));
  }, [allItems, tab, q]);

  function selectItem(item: CountItem) {
    const trackLiquid = Boolean(item.product.trackLiquid);
    const bottleContentMl =
      toNumber(item.product.bottleContentMl ?? 0) || null;
    const systemMl = toNumber(item.systemQty);
    const countedMl =
      item.countedQty != null ? toNumber(item.countedQty) : systemMl;
    setCurrent({
      productId: item.productId,
      name: item.product.name,
      barcode: null,
      systemQty: trackLiquid
        ? mlToBottleInput(systemMl, bottleContentMl)
        : systemMl,
      trackLiquid,
      bottleContentMl,
    });
    setQty(
      trackLiquid ? mlToBottleInput(countedMl, bottleContentMl) : countedMl
    );
    setUnknownCode(null);
    setMessage(null);
    setError(null);
  }

  async function onScan(code: string) {
    setMessage(null);
    setUnknownCode(null);
    setError(null);
    const result = await resolveBarcode(code);
    if (result.status === "unknown") {
      setUnknownCode(result.code);
      setCurrent(null);
      return;
    }
    if (result.status === "inactive") {
      setMessage(tb("productInactive"));
      setCurrent(null);
      return;
    }
    if (result.status !== "found") {
      setMessage(result.message);
      return;
    }
    const product = result.product;
    const item = allItems.find((i) => i.productId === product.id);
    const trackLiquid = Boolean(
      product.trackLiquid ?? item?.product?.trackLiquid
    );
    const bottleContentMl =
      toNumber(
        product.bottleContentMl ?? item?.product?.bottleContentMl ?? 0
      ) || null;
    const systemMl = item
      ? toNumber(item.systemQty)
      : toNumber(product.stockLevels?.[0]?.quantity ?? 0);
    const countedMl =
      item?.countedQty != null ? toNumber(item.countedQty) : systemMl;
    setCurrent({
      productId: product.id,
      name: product.name,
      barcode: product.barcode ?? product.ean ?? null,
      systemQty: trackLiquid
        ? mlToBottleInput(systemMl, bottleContentMl)
        : systemMl,
      trackLiquid,
      bottleContentMl,
    });
    setQty(
      trackLiquid ? mlToBottleInput(countedMl, bottleContentMl) : countedMl
    );
  }

  if (!count) {
    return (
      <AppShell
        title={t("title")}
        breadcrumbs={[{ label: tn("items.inventory"), href: "/inventory" }]}
      >
        <div className="text-sm text-[var(--text-muted)]">{tc("loading")}</div>
      </AppShell>
    );
  }

  const closed = count.status === "CLOSED";
  const inReview = count.status === "REVIEW";
  const canEdit = !closed;

  const headerActions = (
    <>
      <HotelLink href={`/inventory/${params.id}/scanner`}>
        <Button size="sm" variant="secondary" disabled={closed}>
          <ScanBarcode className="h-4 w-4" />
          {t("scannerMode")}
        </Button>
      </HotelLink>
      {count.status === "IN_PROGRESS" || count.status === "DRAFT" ? (
        <Button
          size="sm"
          variant="primary"
          disabled={actionMutation.isPending}
          onClick={() => actionMutation.mutate("review")}
        >
          <ClipboardCheck className="h-4 w-4" />
          {t("submitReview")}
        </Button>
      ) : null}
      {inReview ? (
        <>
          <Button
            size="sm"
            variant="secondary"
            disabled={actionMutation.isPending}
            onClick={() => actionMutation.mutate("reopen")}
          >
            <RotateCcw className="h-4 w-4" />
            {t("reopenCount")}
          </Button>
          <Button
            size="sm"
            variant="success"
            disabled={actionMutation.isPending}
            onClick={() => {
              if (confirm(t("closeCount") + "?")) {
                actionMutation.mutate("close");
              }
            }}
          >
            <CheckCircle2 className="h-4 w-4" />
            {t("closeCount")}
          </Button>
        </>
      ) : null}
      {!settings.requireReviewBeforeClose &&
      (count.status === "IN_PROGRESS" || count.status === "DRAFT") ? (
        <Button
          size="sm"
          variant="success"
          disabled={actionMutation.isPending}
          onClick={() => {
            if (confirm(t("closeCount") + "?")) {
              actionMutation.mutate("close");
            }
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
          {t("closeCount")}
        </Button>
      ) : null}
      {closed ? (
        <Badge tone="success">{t("status.CLOSED")}</Badge>
      ) : (
        <Badge tone={statusTone(count.status)}>
          {t(`status.${count.status}` as "status.IN_PROGRESS")}
        </Badge>
      )}
    </>
  );

  const difference = current ? qty - current.systemQty : null;

  return (
    <AppShell
      title={count.name}
      subtitle={`${t("centralWarehouse")}: ${count.warehouse?.name ?? "—"}`}
      breadcrumbs={[
        { label: tn("items.inventory"), href: "/inventory" },
        { label: count.name },
      ]}
      actions={headerActions}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Kpi
          label={t("kpiProgress")}
          value={`${stats.pct}%`}
          hint={t("progressLabel", {
            counted: stats.counted,
            total: stats.total,
          })}
        />
        <Kpi label={t("kpiUncounted")} value={String(stats.uncounted)} />
        <Kpi label={t("kpiDiffs")} value={String(stats.diffs)} />
        <Kpi
          label={t("kpiValueDiff")}
          value={formatMoney({
            amount: stats.valueDiffSum,
            currency,
            locale,
          })}
        />
      </div>

      {error ? <InlineAlert>{error}</InlineAlert> : null}

      {canEdit ? (
        <div className="mb-3 flex max-w-sm flex-col gap-2">
          <HardwareBarcodeInput
            onScan={onScan}
            placeholder={tb("scanOrType")}
            disabled={closed}
          />
        </div>
      ) : null}
      {message ? <InlineAlert>{message}</InlineAlert> : null}
      {unknownCode ? (
        <div className="mb-3 max-w-md">
          <UnknownBarcodeActions
            code={unknownCode}
            canCreate={canCreate}
            returnTo={`/inventory/${params.id}`}
            onCancel={() => setUnknownCode(null)}
          />
        </div>
      ) : null}
      {current && canEdit ? (
        <div className="mb-4 max-w-md">
          <BarcodeResolvePanel
            productName={current.name}
            barcode={current.barcode}
            locationLabel={count.warehouse?.name}
            systemQty={current.systemQty}
            countedQty={qty}
            difference={difference}
          >
            <InventoryQtyControls
              qty={qty}
              onChange={setQty}
              confirming={countMutation.isPending}
              confirmLabel={t("saveNext")}
              trackLiquid={current.trackLiquid}
              presets={settings.liquidPresets}
              step={settings.liquidStep}
              unitLabel={t("bottlesUnit")}
              bottleContentMl={current.bottleContentMl}
              showMl={settings.showMlAlongsideBottles}
              fullBottlesLabel={t("fullBottles")}
              openBottleLabel={t("openBottle")}
              onConfirm={async () => {
                await countMutation.mutateAsync({
                  productId: current.productId,
                  countedQty: qty,
                });
                setCurrent(null);
                setQty(0);
                setMessage(null);
              }}
            />
          </BarcodeResolvePanel>
        </div>
      ) : null}

      <DataTablePanel
        title={t("title")}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["uncounted", t("tabUncounted"), stats.uncounted],
                ["all", t("tabAll"), stats.total],
                ["diffs", t("tabDiffs"), stats.diffs],
              ] as const
            ).map(([key, label, n]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "rounded-[var(--radius-sm)] border px-2.5 py-1 text-xs font-semibold transition-colors",
                  tab === key
                    ? "border-[var(--primary)] bg-[var(--primary-muted)] text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                )}
              >
                {label} ({n})
              </button>
            ))}
          </div>
        }
        toolbarRight={
          <Input
            className="w-48"
            placeholder={tc("search")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
        empty={items.length === 0 ? tc("noRows") : undefined}
      >
        {items.length > 0 ? (
          <table className="app-table">
            <thead>
              <tr>
                <th>{tc("product")}</th>
                <th>{t("systemQty")}</th>
                <th>{t("counted")}</th>
                <th>{t("difference")}</th>
                <th>{t("valueDiff")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const systemDisplay = displayQty(
                  toNumber(item.systemQty),
                  item.product
                );
                const countedDisplay =
                  item.countedQty != null
                    ? displayQty(toNumber(item.countedQty), item.product)
                    : null;
                const active = current?.productId === item.productId;
                return (
                  <tr
                    key={item.id}
                    data-kbd-active={active ? "true" : undefined}
                    className={canEdit ? "cursor-pointer" : undefined}
                    onClick={() => {
                      if (canEdit) selectItem(item);
                    }}
                  >
                    <td className="font-medium">
                      {item.product.name}
                      {item.product.trackLiquid ? (
                        <span className="ml-1 text-xs text-[var(--text-dim)]">
                          ({t("countInBottles")})
                        </span>
                      ) : null}
                    </td>
                    <td className="tabular-nums">{systemDisplay}</td>
                    <td className="tabular-nums">
                      {countedDisplay != null ? countedDisplay : "—"}
                    </td>
                    <td
                      className={cn(
                        "tabular-nums",
                        item.difference != null &&
                          Number(item.difference) !== 0
                          ? "text-[var(--warning)]"
                          : undefined
                      )}
                    >
                      {item.difference != null
                        ? displayQty(toNumber(item.difference), item.product)
                        : "—"}
                    </td>
                    <td className="tabular-nums">
                      {item.valueDiff != null
                        ? formatMoney({
                            amount: toNumber(item.valueDiff),
                            currency,
                            locale,
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </DataTablePanel>
    </AppShell>
  );
}

function statusTone(status: string): "success" | "warning" | "danger" | "default" {
  if (status === "CLOSED") return "success";
  if (status === "REVIEW") return "warning";
  if (status === "IN_PROGRESS" || status === "DRAFT") return "warning";
  if (status === "CANCELLED") return "danger";
  return "default";
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 shadow-[var(--shadow-sm)]">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--text)]">
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{hint}</div>
      ) : null}
    </div>
  );
}
