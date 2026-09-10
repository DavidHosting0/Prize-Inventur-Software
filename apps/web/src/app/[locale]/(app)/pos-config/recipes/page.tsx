"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PosConfigNav } from "@/components/pos-config-nav";
import { Button, Card, CardBody, CardHeader, Input, Label } from "@prize/ui";
import { formatMoney } from "@/lib/money";
import { useSession } from "next-auth/react";
import { Link } from "@/i18n/navigation";

type Ingredient = { productId: string; quantity: string; unit: string };

export default function PosConfigRecipesPage() {
  const t = useTranslations("posConfig");
  const tn = useTranslations("nav");
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [instructions, setInstructions] = useState("");
  const [items, setItems] = useState<Ingredient[]>([
    { productId: "", quantity: "1", unit: "PIECE" },
  ]);

  const recipes = useQuery({
    queryKey: ["pos-config-recipes"],
    queryFn: async () => (await fetch("/api/v1/pos-config/recipes")).json(),
  });

  const products = useQuery({
    queryKey: ["pos-config-lager", ""],
    queryFn: async () =>
      (await fetch("/api/v1/pos-config/lager-products")).json(),
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/pos-config/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          instructions: instructions || null,
          items: items
            .filter((i) => i.productId)
            .map((i) => ({
              productId: i.productId,
              quantity: Number(i.quantity),
              unit: i.unit,
            })),
          createPosArticle: Boolean(salePrice),
          salePrice: salePrice ? Number(salePrice) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setName("");
      setSalePrice("");
      setInstructions("");
      setItems([{ productId: "", quantity: "1", unit: "PIECE" }]);
      qc.invalidateQueries({ queryKey: ["pos-config-recipes"] });
      qc.invalidateQueries({ queryKey: ["pos-config-articles"] });
      qc.invalidateQueries({ queryKey: ["pos-config-overview"] });
    },
  });

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/pos-config/recipes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-config-recipes"] }),
  });

  return (
    <AppShell
      title={t("title")}
      subtitle={t("tabs.recipes")}
      breadcrumbs={[
        { label: tn("items.posConfig"), href: "/pos-config" },
        { label: t("tabs.recipes") },
      ]}
    >
      <PosConfigNav />
      <div className="grid gap-4 desktop:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>{t("createRecipe")}</CardHeader>
          <CardBody className="space-y-3">
            <div>
              <Label>{t("name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>
                {t("sellingPrice")} ({currency}) — {t("sellOnPos")}
              </Label>
              <Input
                type="number"
                step="0.05"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("instructions")}</Label>
              <textarea
                className="min-h-[120px] w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t("instructionsPlaceholder")}
              />
              <p className="mt-1 text-xs text-[var(--text-dim)]">
                {t("instructionsHint")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("ingredients")}</Label>
              <p className="text-xs text-[var(--text-dim)]">
                {t("liquidPourHint")}
              </p>
              {items.map((ing, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_100px] gap-2">
                  <select
                    className="h-10 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-2 text-sm"
                    value={ing.productId}
                    onChange={(e) => {
                      const productId = e.target.value;
                      const prod = (products.data?.items ?? []).find(
                        (p: {
                          id: string;
                          trackLiquid?: boolean;
                        }) => p.id === productId
                      );
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === idx
                            ? {
                                ...row,
                                productId,
                                unit: prod?.trackLiquid ? "ML" : row.unit,
                              }
                            : row
                        )
                      );
                    }}
                  >
                    <option value="">—</option>
                    {(products.data?.items ?? []).map(
                      (p: { id: string; name: string }) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      )
                    )}
                  </select>
                  <Input
                    type="number"
                    step="0.001"
                    value={ing.quantity}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, quantity: e.target.value } : row
                        )
                      )
                    }
                  />
                  <select
                    className="h-10 rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-2 text-sm"
                    value={ing.unit}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, unit: e.target.value } : row
                        )
                      )
                    }
                  >
                    {["PIECE", "G", "KG", "ML", "LITER", "BOTTLE", "PACK"].map(
                      (u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      )
                    )}
                  </select>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    { productId: "", quantity: "1", unit: "PIECE" },
                  ])
                }
              >
                {t("addIngredient")}
              </Button>
            </div>
            <Button
              disabled={!name || create.isPending}
              onClick={() => create.mutate()}
            >
              {t("createRecipe")}
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>{t("tabs.recipes")}</CardHeader>
          <CardBody className="space-y-2">
            {(recipes.data?.items ?? []).map(
              (r: {
                id: string;
                name: string;
                isActive: boolean;
                instructions: string | null;
                foodCost: number;
                salePrice: number | null;
                foodCostPct: number | null;
                margin: number | null;
                posArticleId: string | null;
              }) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-[var(--border)] px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {t("foodCost")}:{" "}
                        {formatMoney(r.foodCost, currency, locale)}
                        {r.salePrice != null ? (
                          <>
                            {" "}
                            · {t("price")}:{" "}
                            {formatMoney(r.salePrice, currency, locale)}
                            {r.foodCostPct != null
                              ? ` · ${t("foodCostPct")}: ${r.foodCostPct.toFixed(1)}%`
                              : ""}
                            {r.margin != null
                              ? ` · ${t("margin")}: ${formatMoney(r.margin, currency, locale)}`
                              : ""}
                          </>
                        ) : null}
                        {r.instructions?.trim() ? (
                          <> · {t("hasInstructions")}</>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {r.posArticleId ? (
                        <Link href={`/pos-config/articles/${r.posArticleId}`}>
                          <Button size="sm" variant="secondary">
                            POS
                          </Button>
                        </Link>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => duplicate.mutate(r.id)}
                      >
                        {t("duplicate")}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
