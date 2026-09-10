"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ScanBarcode, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Input } from "@prize/ui";
import { formatMoney, toNumber } from "@/lib/money";
import { HotelLink } from "@/components/hotel-link";
import { DataTablePanel } from "@/components/data-table-panel";
import { InlineAlert } from "@/components/inline-alert";
import {
  HardwareBarcodeInput,
  BarcodeResolvePanel,
  UnknownBarcodeActions,
  ScanQtyControls,
} from "@/components/barcode";
import { resolveBarcode } from "@/lib/barcode-client";
import {
  formatStockQty,
  mlToBottleInput,
} from "@/lib/liquid-stock-format";

type CountProduct = {
  name: string;
  trackLiquid?: boolean;
  bottleContentMl?: string | number | null;
};

function displayQty(
  ml: number,
  product: CountProduct,
  asInput = false
): number | string {
  if (product.trackLiquid && product.bottleContentMl != null) {
    const bottles = mlToBottleInput(ml, product.bottleContentMl);
    return asInput ? bottles : bottles;
  }
  return asInput ? ml : ml;
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
  const [q, setQ] = useState("");
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
      refetch();
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/inventory-counts/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      refetch();
    },
  });

  const diffs = useMemo(() => {
    return (count?.items ?? []).filter(
      (i: { difference: string | null }) =>
        i.difference != null && Number(i.difference) !== 0
    );
  }, [count]);

  const items = useMemo(() => {
    const rows = count?.items ?? [];
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((i: { product: { name: string } }) =>
      i.product.name.toLowerCase().includes(needle)
    );
  }, [count, q]);

  async function onScan(code: string) {
    setMessage(null);
    setUnknownCode(null);
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
    const item = (count?.items ?? []).find(
      (i: { productId: string }) => i.productId === product.id
    );
    const trackLiquid = Boolean(
      product.trackLiquid ?? item?.product?.trackLiquid
    );
    const bottleContentMl = toNumber(
      product.bottleContentMl ?? item?.product?.bottleContentMl ?? 0
    ) || null;
    const systemMl = item
      ? toNumber(item.systemQty)
      : toNumber(product.stockLevels?.[0]?.quantity ?? 0);
    const countedMl =
      item?.countedQty != null ? toNumber(item.countedQty) : systemMl;
    const systemQty = trackLiquid
      ? mlToBottleInput(systemMl, bottleContentMl)
      : systemMl;
    const counted = trackLiquid
      ? mlToBottleInput(countedMl, bottleContentMl)
      : countedMl;
    setCurrent({
      productId: product.id,
      name: product.name,
      barcode: product.barcode ?? product.ean ?? null,
      systemQty,
      trackLiquid,
      bottleContentMl,
    });
    setQty(counted);
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

  const headerActions = (
    <>
      <HotelLink href={`/inventory/${params.id}/scanner`}>
        <Button size="sm" variant="primary">
          <ScanBarcode className="h-4 w-4" />
          {t("scannerMode")}
        </Button>
      </HotelLink>
      {count.status !== "CLOSED" ? (
        <Button
          size="sm"
          variant="success"
          onClick={() => {
            if (confirm(t("closeCount") + "?")) closeMutation.mutate();
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
          {t("closeCount")}
        </Button>
      ) : (
        <Badge tone="success">{t("status.CLOSED")}</Badge>
      )}
    </>
  );

  const difference = current ? qty - current.systemQty : null;

  return (
    <AppShell
      title={count.name}
      subtitle={count.warehouse?.name}
      breadcrumbs={[
        { label: tn("items.inventory"), href: "/inventory" },
        { label: count.name },
      ]}
      actions={headerActions}
    >
      <div className="mb-3 flex max-w-sm flex-col gap-2">
        <HardwareBarcodeInput
          onScan={onScan}
          placeholder={tb("scanOrType")}
          disabled={count.status === "CLOSED"}
        />
      </div>
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
      {current && count.status !== "CLOSED" ? (
        <div className="mb-4 max-w-md">
          <BarcodeResolvePanel
            productName={current.name}
            barcode={current.barcode}
            locationLabel={count.warehouse?.name}
            systemQty={current.systemQty}
            countedQty={qty}
            difference={difference}
          >
            <ScanQtyControls
              qty={qty}
              onChange={setQty}
              confirming={countMutation.isPending}
              confirmLabel={t("saveNext")}
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
          <span className="text-xs text-[var(--text-dim)]">
            {tc("showingRows", {
              from: items.length ? 1 : 0,
              to: items.length,
              total: items.length,
            })}
            {diffs.length > 0 ? ` · ${t("review")}: ${diffs.length}` : null}
          </span>
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
              {items.map(
                (item: {
                  id: string;
                  productId: string;
                  systemQty: string;
                  countedQty: string | null;
                  difference: string | null;
                  valueDiff: string | null;
                  product: CountProduct;
                }) => {
                  const systemDisplay = Number(
                    displayQty(toNumber(item.systemQty), item.product, true)
                  );
                  const countedDisplay =
                    item.countedQty != null
                      ? Number(
                          displayQty(
                            toNumber(item.countedQty),
                            item.product,
                            true
                          )
                        )
                      : null;
                  return (
                  <tr key={item.id}>
                    <td className="font-medium">
                      {item.product.name}
                      {item.product.trackLiquid ? (
                        <span className="ml-1 text-xs text-[var(--text-dim)]">
                          ({t("countInBottles")})
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {formatStockQty({
                        quantity: toNumber(item.systemQty),
                        trackLiquid: item.product.trackLiquid,
                        bottleContentMl: item.product.bottleContentMl,
                      })}
                    </td>
                    <td>
                      <Input
                        type="number"
                        step="0.001"
                        className="w-24"
                        disabled={count.status === "CLOSED"}
                        key={`${item.id}-${countedDisplay}`}
                        defaultValue={
                          countedDisplay != null
                            ? countedDisplay
                            : systemDisplay
                        }
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (Number.isFinite(val)) {
                            countMutation.mutate({
                              productId: item.productId,
                              countedQty: val,
                            });
                          }
                        }}
                      />
                    </td>
                    <td
                      className={
                        item.difference != null && Number(item.difference) < 0
                          ? "text-[var(--danger)]"
                          : item.difference != null &&
                              Number(item.difference) > 0
                            ? "text-[var(--success)]"
                            : ""
                      }
                    >
                      {item.difference != null
                        ? formatStockQty({
                            quantity: toNumber(item.difference),
                            trackLiquid: item.product.trackLiquid,
                            bottleContentMl: item.product.bottleContentMl,
                          })
                        : "—"}
                    </td>
                    <td>
                      {item.valueDiff != null
                        ? formatMoney(item.valueDiff, currency, locale)
                        : "—"}
                    </td>
                  </tr>
                  );
                }
              )}
            </tbody>
          </table>
        ) : null}
      </DataTablePanel>
    </AppShell>
  );
}
