"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardBody, CardHeader } from "@prize/ui";
import { ProductForm, type ProductFormValues } from "@/components/product-form";
import { useRouter } from "@/i18n/navigation";
import { InlineAlert } from "@/components/inline-alert";
import { safeReturnTo } from "@/lib/barcode-client";

export default function NewProductPage() {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const barcodePrefill = searchParams.get("barcode") ?? "";
  const namePrefill = searchParams.get("name") ?? "";
  const skuPrefill = searchParams.get("sku") ?? "";
  const pricePrefill = searchParams.get("purchasePrice");
  const descPrefill = searchParams.get("description") ?? "";
  const unitPrefill = searchParams.get("unit") ?? "";
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  const initial = useMemo(() => {
    const values: Partial<ProductFormValues> = {};
    if (barcodePrefill) {
      values.barcode = barcodePrefill;
      values.sku = barcodePrefill.slice(0, 32);
    }
    if (namePrefill) values.name = namePrefill;
    if (skuPrefill) values.sku = skuPrefill.slice(0, 64);
    if (pricePrefill != null && pricePrefill !== "") {
      values.purchasePrice = Number(pricePrefill) || 0;
    }
    if (descPrefill) values.description = descPrefill;
    if (unitPrefill) values.unit = unitPrefill as ProductFormValues["unit"];
    return Object.keys(values).length ? values : undefined;
  }, [
    barcodePrefill,
    namePrefill,
    skuPrefill,
    pricePrefill,
    descPrefill,
    unitPrefill,
  ]);

  const create = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const res = await fetch("/api/v1/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          barcode: values.barcode || null,
          ean: values.barcode || null,
          description: values.description || null,
          allergens: [],
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (p) => {
      if (returnTo) {
        const sep = returnTo.includes("?") ? "&" : "?";
        router.push(`${returnTo}${sep}createdProductId=${encodeURIComponent(p.id)}`);
        return;
      }
      router.push(`/products/${p.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <AppShell
      title={t("addProduct")}
      breadcrumbs={[
        { label: tn("items.products"), href: "/products" },
        { label: tc("new") },
      ]}
    >
      <Card className="max-w-3xl">
        <CardHeader>
          <div className="text-sm font-semibold">{t("addProduct")}</div>
        </CardHeader>
        <CardBody>
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          <ProductForm
            key={`${barcodePrefill}|${namePrefill}|${skuPrefill}`}
            initial={initial}
            submitting={create.isPending}
            onSubmit={(v) => create.mutate(v)}
          />
        </CardBody>
      </Card>
    </AppShell>
  );
}
