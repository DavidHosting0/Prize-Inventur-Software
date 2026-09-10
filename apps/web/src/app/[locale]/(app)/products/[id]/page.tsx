"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  Warehouse,
  ShoppingCart,
  Package,
  Info,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, CardBody } from "@prize/ui";
import { formatMoney, toNumber } from "@/lib/money";
import { Link, useRouter } from "@/i18n/navigation";
import { ProductForm, type ProductFormValues } from "@/components/product-form";
import {
  DetailSummary,
  DetailMetric,
} from "@/components/detail-summary";
import { MetaRows } from "@/components/meta-rows";
import { DataTablePanel } from "@/components/data-table-panel";
import { InlineAlert } from "@/components/inline-alert";
import { formatStockQty } from "@/lib/liquid-stock-format";

export default function ProductDetailPage() {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(true);

  const { data: product, refetch, isFetching } = useQuery({
    queryKey: ["product", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/products/${params.id}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const initial = useMemo<Partial<ProductFormValues> | undefined>(() => {
    if (!product) return undefined;
    const trackLiquid = Boolean(product.trackLiquid);
    const content = product.bottleContentMl
      ? toNumber(product.bottleContentMl)
      : null;
    const toBottles = (ml: number) =>
      trackLiquid && content && content > 0 ? ml / content : ml;
    return {
      name: product.name,
      sku: product.sku,
      barcode: product.barcode ?? "",
      categoryId: product.categoryId,
      unit: product.unit,
      purchasePrice: toNumber(product.purchasePrice),
      salePrice: toNumber(product.salePrice),
      vatRate: toNumber(product.vatRate),
      minStock: toBottles(toNumber(product.minStock)),
      optimalStock: toBottles(toNumber(product.optimalStock)),
      maxStock: toBottles(toNumber(product.maxStock)),
      isActive: product.isActive,
      description: product.description ?? "",
      trackLiquid,
      bottleContentMl: content,
    };
  }, [product]);

  const totalStock = useMemo(() => {
    return (product?.stockLevels ?? []).reduce(
      (sum: number, s: { quantity: string }) => sum + toNumber(s.quantity),
      0
    );
  }, [product]);

  const update = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const res = await fetch(`/api/v1/products/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          barcode: values.barcode || null,
          description: values.description || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setEditing(false);
      refetch();
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const deactivate = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/products/${params.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      router.push("/products");
    },
    onError: (e: Error) => setError(e.message),
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/v1/products/${params.id}/image`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const crumbs = [
    { label: tn("items.products"), href: "/products" },
    ...(product
      ? [{ label: product.sku || product.name }]
      : [{ label: tc("loading") }]),
  ];

  if (!product) {
    return (
      <AppShell
        title={t("title")}
        breadcrumbs={[{ label: tn("items.products"), href: "/products" }]}
      >
        <div className="text-sm text-[var(--text-muted)]">{tc("loading")}</div>
      </AppShell>
    );
  }

  const headerActions = (
    <>
      <Button
        size="icon"
        variant={editing ? "secondary" : "primary"}
        title={editing ? tc("cancel") : t("editProduct")}
        onClick={() => setEditing((v) => !v)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Link href="/warehouse">
        <Button size="icon" variant="secondary" title={tn("items.warehouse")}>
          <Warehouse className="h-4 w-4" />
        </Button>
      </Link>
      <Link href="/orders">
        <Button size="icon" variant="secondary" title={tn("items.orders")}>
          <ShoppingCart className="h-4 w-4" />
        </Button>
      </Link>
      {product.isActive ? (
        <Button
          size="icon"
          variant="danger"
          title={tc("delete")}
          onClick={() => {
            if (confirm(tc("confirm") + "?")) deactivate.mutate();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </>
  );

  return (
    <AppShell
      title={product.name}
      subtitle={product.sku}
      breadcrumbs={crumbs}
      actions={headerActions}
    >
      {error ? <InlineAlert>{error}</InlineAlert> : null}

      {editing ? (
        <Card className="max-w-3xl">
          <CardBody>
            <ProductForm
              initial={initial}
              submitting={update.isPending}
              onSubmit={(v) => update.mutate(v)}
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          <DetailSummary
            media={
              <div className="w-full space-y-2 text-center">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="mx-auto h-28 w-28 rounded-md object-cover"
                  />
                ) : (
                  <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-[var(--bg)]">
                    <Package className="h-10 w-10 text-[var(--text-dim)]" />
                  </div>
                )}
                <label className="block cursor-pointer text-[11px] text-[var(--primary)] hover:underline">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage.mutate(f);
                    }}
                  />
                  {uploadImage.isPending ? "…" : t("uploadImage")}
                </label>
              </div>
            }
            metric={
              <DetailMetric
                label={tc("availableStock")}
                value={formatStockQty({
                  quantity: totalStock,
                  trackLiquid: product.trackLiquid,
                  bottleContentMl: product.bottleContentMl,
                })}
                icon={<Warehouse className="h-3.5 w-3.5" />}
                hint={
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                    {tc("inStock")}:{" "}
                    {formatStockQty({
                      quantity: totalStock,
                      trackLiquid: product.trackLiquid,
                      bottleContentMl: product.bottleContentMl,
                    })}
                  </span>
                }
              />
            }
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-[var(--text-dim)]" />
                <Badge tone={product.isActive ? "success" : "danger"}>
                  {product.isActive ? t("active") : t("inactive")}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowDetails((v) => !v)}
              >
                {showDetails ? tc("details") : tc("showDetails")}
              </Button>
            </div>
            <p className="mb-3 text-sm text-[var(--text-muted)]">
              {product.description || "—"}
            </p>
            {showDetails ? (
              <MetaRows
                rows={[
                  { label: t("sku"), value: product.sku },
                  { label: t("barcode"), value: product.barcode ?? "—" },
                  { label: t("category"), value: product.category?.name },
                  { label: t("unit"), value: product.trackLiquid ? "ML" : product.unit },
                  ...(product.trackLiquid
                    ? [
                        {
                          label: t("bottleContentMl"),
                          value: `${product.bottleContentMl} ml`,
                        },
                      ]
                    : []),
                  {
                    label: product.trackLiquid
                      ? t("purchasePricePerBottle")
                      : t("purchasePrice"),
                    value: formatMoney(product.purchasePrice, currency, locale),
                  },
                  {
                    label: t("salePrice"),
                    value: formatMoney(product.salePrice, currency, locale),
                  },
                  { label: t("vat"), value: `${product.vatRate}%` },
                  {
                    label: product.trackLiquid ? t("minStockBottles") : t("minStock"),
                    value: product.trackLiquid && product.bottleContentMl
                      ? String(
                          toNumber(product.minStock) /
                            toNumber(product.bottleContentMl)
                        )
                      : String(product.minStock),
                  },
                  {
                    label: product.trackLiquid
                      ? t("optimalStockBottles")
                      : t("optimalStock"),
                    value: product.trackLiquid && product.bottleContentMl
                      ? String(
                          toNumber(product.optimalStock) /
                            toNumber(product.bottleContentMl)
                        )
                      : String(product.optimalStock),
                  },
                ]}
              />
            ) : null}
          </DetailSummary>

          <DataTablePanel
            title={t("stock")}
            actions={
              <Button
                size="icon"
                variant="secondary"
                title={tc("refresh")}
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
                />
              </Button>
            }
          >
            <table className="app-table">
              <thead>
                <tr>
                  <th>{tc("warehouse")}</th>
                  <th>{t("stock")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Lager</td>
                  <td className="font-medium">
                    {formatStockQty({
                      quantity: totalStock,
                      trackLiquid: product.trackLiquid,
                      bottleContentMl: product.bottleContentMl,
                    })}
                  </td>
                </tr>
              </tbody>
            </table>
          </DataTablePanel>
        </div>
      )}
    </AppShell>
  );
}
