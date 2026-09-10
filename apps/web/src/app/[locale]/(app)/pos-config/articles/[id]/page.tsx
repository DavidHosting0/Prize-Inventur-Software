"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PosConfigNav } from "@/components/pos-config-nav";
import { Button, Card, CardBody, CardHeader, Input, Label } from "@prize/ui";
import { InlineAlert } from "@/components/inline-alert";
import { useSession } from "next-auth/react";

export default function PosArticleDetailPage() {
  const t = useTranslations("posConfig");
  const tn = useTranslations("nav");
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "CHF";
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [vatRate, setVatRate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [instructions, setInstructions] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const article = useQuery({
    queryKey: ["pos-config-article", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/pos-config/articles/${params.id}`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  const categories = useQuery({
    queryKey: ["pos-config-categories"],
    queryFn: async () => (await fetch("/api/v1/pos-config/categories")).json(),
  });

  useEffect(() => {
    const a = article.data;
    if (!a) return;
    setName(a.name ?? "");
    setDescription(a.description ?? "");
    setSalePrice(a.salePrice ?? "");
    setVatRate(a.vatRate ?? "");
    setCategoryId(a.posCategoryId ?? "");
    setIsFavorite(Boolean(a.isFavorite));
    setIsActive(Boolean(a.isActive));
    setInstructions(a.recipe?.instructions ?? "");
  }, [article.data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/pos-config/articles/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          salePrice: Number(salePrice),
          vatRate: Number(vatRate),
          posCategoryId: categoryId || null,
          isFavorite,
          isActive,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);

      const a = article.data;
      if (a?.type === "RECIPE" && a.recipeId) {
        const r = await fetch(`/api/v1/pos-config/recipes/${a.recipeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instructions: instructions || null }),
        });
        if (!r.ok) throw new Error((await r.json()).error);
      }
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["pos-config-article", params.id] });
      qc.invalidateQueries({ queryKey: ["pos-config-articles"] });
      qc.invalidateQueries({ queryKey: ["pos-config-recipes"] });
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e: Error) => setError(e.message),
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/v1/pos-config/articles/${params.id}/image`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["pos-config-article", params.id] });
      qc.invalidateQueries({ queryKey: ["pos-config-articles"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const a = article.data;

  return (
    <AppShell
      title={a?.name ?? t("tabs.articles")}
      subtitle={a?.type === "RECIPE" ? t("typeRecipe") : t("typeProduct")}
      breadcrumbs={[
        { label: tn("items.posConfig"), href: "/pos-config" },
        { label: t("tabs.articles"), href: "/pos-config/articles" },
        { label: a?.name ?? "…" },
      ]}
    >
      <PosConfigNav />
      <Card>
        <CardHeader>{t("tabs.articles")}</CardHeader>
        <CardBody className="max-w-xl space-y-3">
          <div>
            <Label>{t("photo")}</Label>
            <div className="mt-1 flex items-start gap-3">
              {a?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.imageUrl}
                  alt=""
                  className="h-20 w-20 rounded-md border border-[var(--border)] object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--text-dim)]">
                  —
                </div>
              )}
              <div className="space-y-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="block w-full text-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage.mutate(f);
                    e.target.value = "";
                  }}
                />
                <p className="text-xs text-[var(--text-dim)]">
                  {uploadImage.isPending ? "…" : t("uploadImage")}
                </p>
              </div>
            </div>
          </div>
          <div>
            <Label>{t("name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>{t("description")}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>
                {t("price")} ({currency})
              </Label>
              <Input
                type="number"
                step="0.05"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("vat")} %</Label>
              <Input
                type="number"
                step="0.1"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>{t("category")}</Label>
            <select
              className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-2 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">—</option>
              {(categories.data?.items ?? []).map(
                (c: { id: string; name: string }) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                )
              )}
            </select>
          </div>
          {a?.type === "RECIPE" ? (
            <div>
              <Label>{t("instructions")}</Label>
              <textarea
                className="min-h-[140px] w-full rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t("instructionsPlaceholder")}
              />
              <p className="mt-1 text-xs text-[var(--text-dim)]">
                {t("instructionsHint")}
              </p>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
            />
            {t("favorite")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            {t("active")}
          </label>
          {a?.product ? (
            <p className="text-xs text-[var(--text-dim)]">
              Lager: {a.product.name} · SKU {a.product.sku}
              {a.product.barcode ? ` · ${a.product.barcode}` : ""}
            </p>
          ) : null}
          {a?.recipe ? (
            <p className="text-xs text-[var(--text-dim)]">
              Rezept v{a.recipe.version} · {a.recipe.items?.length ?? 0} Zutaten
            </p>
          ) : null}
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          {saved ? <InlineAlert tone="success">{t("saved")}</InlineAlert> : null}
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name}>
            {t("save")}
          </Button>
        </CardBody>
      </Card>
    </AppShell>
  );
}
