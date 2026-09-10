"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button, Input, Label, Select } from "@prize/ui";
import { UNITS } from "@prize/types";

export type ProductFormValues = {
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  unit: (typeof UNITS)[number];
  purchasePrice: number;
  salePrice: number;
  vatRate: number;
  minStock: number;
  optimalStock: number;
  maxStock: number;
  isActive: boolean;
  description: string;
  trackLiquid: boolean;
  bottleContentMl: number | null;
};

const BOTTLE_PRESETS = [50, 200, 330, 500, 700, 750, 1000];

const defaults: ProductFormValues = {
  name: "",
  sku: "",
  barcode: "",
  categoryId: "",
  unit: "PIECE",
  purchasePrice: 0,
  salePrice: 0,
  vatRate: 8.1,
  minStock: 0,
  optimalStock: 0,
  maxStock: 0,
  isActive: true,
  description: "",
  trackLiquid: false,
  bottleContentMl: null,
};

export function ProductForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Partial<ProductFormValues>;
  onSubmit: (values: ProductFormValues) => void;
  submitting?: boolean;
}) {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const [values, setValues] = useState<ProductFormValues>({
    ...defaults,
    ...initial,
  });
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (initial) setValues((v) => ({ ...v, ...defaults, ...initial }));
  }, [initial]);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/v1/categories");
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json();
    },
  });

  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/v1/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      return res.json() as Promise<{ id: string; name: string }>;
    },
    onSuccess: (cat) => {
      setCategoryError(null);
      setNewCategoryName("");
      qc.invalidateQueries({ queryKey: ["categories"] });
      set("categoryId", cat.id);
    },
    onError: (e: Error) => setCategoryError(e.message),
  });

  function set<K extends keyof ProductFormValues>(key: K, val: ProductFormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  const categoryItems = categories.data?.items ?? [];
  const canSave =
    Boolean(values.categoryId) &&
    (!values.trackLiquid ||
      (values.bottleContentMl != null && values.bottleContentMl > 0));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSave) return;
        onSubmit({
          ...values,
          unit: values.trackLiquid ? "ML" : values.unit,
          bottleContentMl: values.trackLiquid ? values.bottleContentMl : null,
          minStock:
            values.trackLiquid && values.bottleContentMl
              ? values.minStock * values.bottleContentMl
              : values.minStock,
          optimalStock:
            values.trackLiquid && values.bottleContentMl
              ? values.optimalStock * values.bottleContentMl
              : values.optimalStock,
          maxStock:
            values.trackLiquid && values.bottleContentMl
              ? values.maxStock * values.bottleContentMl
              : values.maxStock,
        });
      }}
    >
      <div className="grid gap-3 tablet:grid-cols-2">
        <div>
          <Label>{t("name")}</Label>
          <Input
            required
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div>
          <Label>{t("sku")}</Label>
          <Input
            required
            value={values.sku}
            onChange={(e) => set("sku", e.target.value)}
          />
        </div>
        <div>
          <Label>{t("barcode")}</Label>
          <Input
            value={values.barcode}
            onChange={(e) => set("barcode", e.target.value)}
          />
        </div>
        <div>
          <Label>{t("category")}</Label>
          <Select
            required
            value={values.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
          >
            <option value="">—</option>
            {categoryItems.map((c: { id: string; name: string }) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {categoryItems.length === 0 ? (
            <div className="mt-2 space-y-2 rounded-md border border-dashed border-[var(--border)] p-2">
              <p className="text-xs text-[var(--text-muted)]">
                {t("noCategoriesHint")}
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder={t("newCategoryName")}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!newCategoryName.trim() || createCategory.isPending}
                  onClick={() => createCategory.mutate(newCategoryName.trim())}
                >
                  {t("createCategory")}
                </Button>
              </div>
              {categoryError ? (
                <p className="text-xs text-[var(--danger)]">{categoryError}</p>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <Input
                placeholder={t("newCategoryName")}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!newCategoryName.trim() || createCategory.isPending}
                onClick={() => createCategory.mutate(newCategoryName.trim())}
              >
                {t("createCategory")}
              </Button>
            </div>
          )}
        </div>
        <div className="tablet:col-span-2 space-y-2 rounded-md border border-[var(--border-subtle)] p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={values.trackLiquid}
              onChange={(e) => {
                const on = e.target.checked;
                setValues((v) => ({
                  ...v,
                  trackLiquid: on,
                  unit: on ? "ML" : v.unit === "ML" ? "PIECE" : v.unit,
                  bottleContentMl: on ? v.bottleContentMl ?? 700 : null,
                }));
              }}
            />
            {t("trackLiquid")}
          </label>
          <p className="text-xs text-[var(--text-dim)]">{t("trackLiquidHint")}</p>
          {values.trackLiquid ? (
            <div className="space-y-2">
              <Label>{t("bottleContentMl")}</Label>
              <Input
                type="number"
                min={1}
                step="1"
                required
                value={values.bottleContentMl ?? ""}
                onChange={(e) =>
                  set(
                    "bottleContentMl",
                    e.target.value === "" ? null : Number(e.target.value) || null
                  )
                }
              />
              <div className="flex flex-wrap gap-1">
                {BOTTLE_PRESETS.map((ml) => (
                  <button
                    key={ml}
                    type="button"
                    className={
                      values.bottleContentMl === ml
                        ? "rounded-md bg-[var(--pos-accent,#0f766e)] px-2 py-1 text-xs font-semibold text-white"
                        : "rounded-md border border-[var(--border)] bg-white px-2 py-1 text-xs hover:bg-[var(--card-hover)]"
                    }
                    onClick={() => set("bottleContentMl", ml)}
                  >
                    {ml} ml
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <Label>{t("unit")}</Label>
              <Select
                value={values.unit}
                onChange={(e) =>
                  set("unit", e.target.value as ProductFormValues["unit"])
                }
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
        <div>
          <Label>{t("vat")}</Label>
          <Input
            type="number"
            step="0.1"
            value={values.vatRate}
            onChange={(e) => set("vatRate", Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <Label>
            {values.trackLiquid ? t("purchasePricePerBottle") : t("purchasePrice")}
          </Label>
          <Input
            type="number"
            step="0.01"
            value={values.purchasePrice}
            onChange={(e) => set("purchasePrice", Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <Label>{t("salePrice")}</Label>
          <Input
            type="number"
            step="0.01"
            value={values.salePrice}
            onChange={(e) => set("salePrice", Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <Label>
            {values.trackLiquid ? t("minStockBottles") : t("minStock")}
          </Label>
          <Input
            type="number"
            value={values.minStock}
            onChange={(e) => set("minStock", Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <Label>
            {values.trackLiquid ? t("optimalStockBottles") : t("optimalStock")}
          </Label>
          <Input
            type="number"
            value={values.optimalStock}
            onChange={(e) => set("optimalStock", Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <Label>
            {values.trackLiquid ? t("maxStockBottles") : t("maxStock")}
          </Label>
          <Input
            type="number"
            value={values.maxStock}
            onChange={(e) => set("maxStock", Number(e.target.value) || 0)}
          />
        </div>
        <div className="flex items-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            {t("active")}
          </label>
        </div>
      </div>
      <div>
        <Label>{t("description")}</Label>
        <Input
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
      <Button type="submit" disabled={submitting || !canSave}>
        {tc("save")}
      </Button>
    </form>
  );
}
