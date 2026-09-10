"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Input } from "@prize/ui";
import { formatMoney, toNumber } from "@/lib/money";
import { Link, useRouter } from "@/i18n/navigation";
import { KeyboardTable } from "@/components/keyboard-table";
import { DataTablePanel } from "@/components/data-table-panel";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatStockQty } from "@/lib/liquid-stock-format";

export default function ProductsPage() {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const { data: session } = useSession();
  const router = useRouter();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 250);
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["products", debouncedQ],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/products?q=${encodeURIComponent(debouncedQ)}`
      );
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? items.length;

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.products") }]}
      actions={
        <Link href="/products/new">
          <Button size="sm" variant="success">
            <Plus className="h-4 w-4" />
            {t("addProduct")}
          </Button>
        </Link>
      }
    >
      <DataTablePanel
        title={t("title")}
        toolbar={
          <>
            <Input
              className="max-w-sm"
              placeholder={`${t("name")} / ${t("sku")} / ${t("barcode")}`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Badge tone="primary">{total}</Badge>
            <span className="text-[11px] text-[var(--text-dim)]">
              <kbd className="kbd">↑↓</kbd> <kbd className="kbd">Enter</kbd>
            </span>
          </>
        }
        toolbarRight={
          <span className="text-xs text-[var(--text-dim)]">
            {isFetching && !isLoading ? "…" : null}{" "}
            {tc("showingRows", {
              from: items.length ? 1 : 0,
              to: items.length,
              total,
            })}
          </span>
        }
        empty={
          !isLoading && items.length === 0 ? tc("noRows") : undefined
        }
      >
        {isLoading ? (
          <div className="p-4 text-sm text-[var(--text-muted)]">
            {tc("loading")}
          </div>
        ) : items.length > 0 ? (
          <table className="app-table">
            <thead>
              <tr>
                <th>{t("name")}</th>
                <th>{t("sku")}</th>
                <th>{t("barcode")}</th>
                <th>{t("category")}</th>
                <th>{t("salePrice")}</th>
                <th>{t("purchasePrice")}</th>
                <th>{t("stock")}</th>
                <th>{t("active")}</th>
              </tr>
            </thead>
            <KeyboardTable
              onActivate={(index) => {
                const p = items[index];
                if (p) router.push(`/products/${p.id}`);
              }}
            >
              {items.map(
                (
                  p: {
                    id: string;
                    name: string;
                    sku: string;
                    barcode: string | null;
                    salePrice: string;
                    purchasePrice: string;
                    isActive: boolean;
                    trackLiquid?: boolean;
                    bottleContentMl?: string | null;
                    category: { name: string };
                    stockLevels: { quantity: string }[];
                  },
                  idx: number
                ) => {
                  const stock = p.stockLevels.reduce(
                    (sum, s) => sum + toNumber(s.quantity),
                    0
                  );
                  return (
                    <tr key={p.id} data-kbd-row data-kbd-index={idx}>
                      <td>
                        <Link
                          href={`/products/${p.id}`}
                          className="font-medium text-[var(--primary)] hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="text-[var(--text-muted)]">{p.sku}</td>
                      <td className="font-mono text-xs">{p.barcode}</td>
                      <td>{p.category.name}</td>
                      <td>{formatMoney(p.salePrice, currency, locale)}</td>
                      <td>
                        {formatMoney(p.purchasePrice, currency, locale)}
                      </td>
                      <td>
                        {formatStockQty({
                          quantity: stock,
                          trackLiquid: p.trackLiquid,
                          bottleContentMl: p.bottleContentMl,
                        })}
                      </td>
                      <td>
                        <Badge tone={p.isActive ? "success" : "danger"}>
                          {p.isActive ? t("active") : t("inactive")}
                        </Badge>
                      </td>
                    </tr>
                  );
                }
              )}
            </KeyboardTable>
          </table>
        ) : null}
      </DataTablePanel>
    </AppShell>
  );
}
