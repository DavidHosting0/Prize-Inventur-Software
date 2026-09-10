"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, CardBody, CardHeader } from "@prize/ui";
import { formatMoney } from "@/lib/money";
import { FormSplitLayout } from "@/components/form-split-layout";
import { InlineAlert } from "@/components/inline-alert";

export default function OrdersPage() {
  const t = useTranslations("orders");
  const tn = useTranslations("nav");
  const { data: session } = useSession();
  const qc = useQueryClient();
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";
  const [error, setError] = useState<string | null>(null);

  const orders = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => (await fetch("/api/v1/purchase-orders")).json(),
  });
  const suggestions = useQuery({
    queryKey: ["po-suggestions"],
    queryFn: async () =>
      (await fetch("/api/v1/purchase-orders?suggestions=1")).json(),
  });
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await fetch("/api/v1/suppliers")).json(),
  });

  const createFromSuggestions = useMutation({
    mutationFn: async () => {
      const list = suggestions.data?.suggestions ?? [];
      if (!list.length) throw new Error("No suggestions");
      const supplierId =
        list.find((s: { supplierId: string | null }) => s.supplierId)?.supplierId ||
        suppliers.data?.items?.[0]?.id;
      if (!supplierId) throw new Error("No supplier");
      const res = await fetch("/api/v1/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          items: list.slice(0, 20).map(
            (s: {
              productId: string;
              suggestedQty: number;
              purchasePrice: number;
            }) => ({
              productId: s.productId,
              quantityOrdered: s.suggestedQty,
              unitPrice: s.purchasePrice,
            })
          ),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/v1/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", id }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.orders") }]}
    >
      {error ? <InlineAlert>{error}</InlineAlert> : null}

      <FormSplitLayout
        form={
          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">{t("suggestions")}</div>
              <Button
                size="sm"
                variant="success"
                disabled={createFromSuggestions.isPending}
                onClick={() => createFromSuggestions.mutate()}
              >
                <Plus className="h-4 w-4" />
                {t("createFromSuggestions")}
              </Button>
            </CardHeader>
            <CardBody className="space-y-2">
              {(suggestions.data?.suggestions ?? []).map(
                (s: {
                  productId: string;
                  name: string;
                  currentStock: number;
                  minStock: number;
                  suggestedQty: number;
                  purchasePrice: number;
                }) => (
                  <div
                    key={s.productId}
                    className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-[var(--text-dim)]">
                        {t("stock")}: {s.currentStock} / min {s.minStock}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge tone="warning">+{s.suggestedQty}</Badge>
                      <div className="text-xs text-[var(--text-muted)]">
                        {formatMoney(s.purchasePrice, currency, locale)}
                      </div>
                    </div>
                  </div>
                )
              )}
              {(suggestions.data?.suggestions ?? []).length === 0 ? (
                <div className="text-sm text-[var(--text-muted)]">{t("noSuggestions")}</div>
              ) : null}
            </CardBody>
          </Card>
        }
        list={
          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">{t("orders")}</div>
            </CardHeader>
            <CardBody className="space-y-2">
              {(orders.data?.items ?? []).map(
                (po: {
                  id: string;
                  status: string;
                  createdAt: string;
                  supplier: { name: string };
                  items: { quantityOrdered: string; product: { name: string } }[];
                }) => (
                  <div
                    key={po.id}
                    className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{po.supplier.name}</span>
                      <Badge
                        tone={
                          po.status === "ORDERED"
                            ? "primary"
                            : po.status === "RECEIVED"
                              ? "success"
                              : "warning"
                        }
                      >
                        {po.status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-dim)]">
                      {po.items
                        .slice(0, 3)
                        .map((i) => `${i.quantityOrdered} ${i.product.name}`)
                        .join(", ")}
                      {po.items.length > 3 ? "…" : ""}
                    </div>
                    {po.status === "DRAFT" ? (
                      <Button
                        size="sm"
                        className="mt-2"
                        onClick={() => submitMutation.mutate(po.id)}
                      >
                        {t("submit")}
                      </Button>
                    ) : null}
                  </div>
                )
              )}
            </CardBody>
          </Card>
        }
      />
    </AppShell>
  );
}
