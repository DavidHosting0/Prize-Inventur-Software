"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PosConfigNav } from "@/components/pos-config-nav";
import { Badge, Button, Card, CardBody, CardHeader, Input, Label } from "@prize/ui";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { useSession } from "next-auth/react";

type Article = {
  id: string;
  name: string;
  type: "PRODUCT" | "RECIPE";
  salePrice: string;
  vatRate: string;
  isActive: boolean;
  isFavorite: boolean;
  posCategory?: { id: string; name: string } | null;
  product?: { sku: string | null; barcode: string | null } | null;
};

export default function PosConfigArticlesPage() {
  const t = useTranslations("posConfig");
  const tn = useTranslations("nav");
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | "PRODUCT" | "RECIPE">("");
  const [active, setActive] = useState<"" | "1" | "0">("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lagerQ, setLagerQ] = useState("");

  const articles = useQuery({
    queryKey: ["pos-config-articles", q, type, active],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (type) params.set("type", type);
      if (active) params.set("active", active);
      return (await fetch(`/api/v1/pos-config/articles?${params}`)).json();
    },
  });

  const lager = useQuery({
    queryKey: ["pos-config-lager", lagerQ],
    enabled: pickerOpen,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (lagerQ) params.set("q", lagerQ);
      return (await fetch(`/api/v1/pos-config/lager-products?${params}`)).json();
    },
  });

  const addFromLager = useMutation({
    mutationFn: async (productId: string) => {
      const res = await fetch("/api/v1/pos-config/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-config-articles"] });
      qc.invalidateQueries({ queryKey: ["pos-config-lager"] });
      qc.invalidateQueries({ queryKey: ["pos-config-overview"] });
    },
  });

  const items: Article[] = useMemo(
    () => articles.data?.items ?? [],
    [articles.data]
  );

  return (
    <AppShell
      title={t("title")}
      subtitle={t("tabs.articles")}
      breadcrumbs={[
        { label: tn("items.posConfig"), href: "/pos-config" },
        { label: t("tabs.articles") },
      ]}
    >
      <PosConfigNav />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder={t("search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="h-10 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          <option value="">{t("all")}</option>
          <option value="PRODUCT">{t("typeProduct")}</option>
          <option value="RECIPE">{t("typeRecipe")}</option>
        </select>
        <select
          className="h-10 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-2 text-sm"
          value={active}
          onChange={(e) => setActive(e.target.value as typeof active)}
        >
          <option value="">{t("all")}</option>
          <option value="1">{t("filterActive")}</option>
          <option value="0">{t("filterInactive")}</option>
        </select>
        <Button onClick={() => setPickerOpen(true)}>{t("addFromLager")}</Button>
        <Link href="/pos-config/recipes">
          <Button variant="secondary">{t("addFromRecipe")}</Button>
        </Link>
      </div>

      <Card>
        <CardBody className="overflow-x-auto p-0">
          <table className="app-table">
            <thead>
              <tr>
                <th>{t("name")}</th>
                <th>{t("type")}</th>
                <th>{t("category")}</th>
                <th>{t("price")}</th>
                <th>{t("vat")}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-dim)]">
                    {t("noArticles")}
                  </td>
                </tr>
              ) : (
                items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link
                        href={`/pos-config/articles/${a.id}`}
                        className="font-medium text-[var(--primary)] hover:underline"
                      >
                        {a.name}
                      </Link>
                      {a.isFavorite ? (
                        <span className="ml-1 text-[var(--warning)]">★</span>
                      ) : null}
                      {a.product?.sku ? (
                        <div className="text-[10px] text-[var(--text-dim)]">
                          {a.product.sku}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <Badge tone={a.type === "RECIPE" ? "warning" : "primary"}>
                        {a.type === "RECIPE" ? t("typeRecipe") : t("typeProduct")}
                      </Badge>
                    </td>
                    <td>{a.posCategory?.name ?? "—"}</td>
                    <td>{formatMoney(a.salePrice, currency, locale)}</td>
                    <td>{a.vatRate}%</td>
                    <td>
                      <Badge tone={a.isActive ? "success" : "default"}>
                        {a.isActive ? t("active") : t("inactive")}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-h-[80vh] w-full max-w-lg overflow-hidden">
            <CardHeader>
              <div className="flex w-full items-center justify-between gap-2">
                <span>{t("addFromLager")}</span>
                <Button variant="secondary" size="sm" onClick={() => setPickerOpen(false)}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardBody className="space-y-3 overflow-y-auto">
              <div>
                <Label>{t("search")}</Label>
                <Input
                  value={lagerQ}
                  onChange={(e) => setLagerQ(e.target.value)}
                  placeholder={t("search")}
                />
              </div>
              <div className="space-y-2">
                {(lager.data?.items ?? []).map(
                  (p: {
                    id: string;
                    name: string;
                    sku: string;
                    salePrice: string;
                    alreadyOnPos: boolean;
                  }) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-[var(--text-dim)]">
                          {p.sku} · {formatMoney(p.salePrice, currency, locale)}
                        </div>
                      </div>
                      {p.alreadyOnPos ? (
                        <span className="text-xs text-[var(--text-dim)]">
                          {t("alreadyOnPos")}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          disabled={addFromLager.isPending}
                          onClick={() => addFromLager.mutate(p.id)}
                        >
                          {t("add")}
                        </Button>
                      )}
                    </div>
                  )
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}
