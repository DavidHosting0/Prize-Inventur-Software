"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
  Select,
} from "@prize/ui";
import { formatMoney, toNumber } from "@/lib/money";
import { FormSplitLayout } from "@/components/form-split-layout";
import { InlineAlert } from "@/components/inline-alert";
import { HardwareBarcodeInput, UnknownBarcodeActions } from "@/components/barcode";
import { resolveBarcode } from "@/lib/barcode-client";

const REASONS = [
  "EXPIRED",
  "OVERPRODUCTION",
  "DAMAGED",
  "INCORRECTLY_PREPARED",
  "BUFFET_LEFTOVERS",
  "OTHER",
] as const;

export default function FoodWastePage() {
  const t = useTranslations("foodWaste");
  const tb = useTranslations("barcode");
  const tn = useTranslations("nav");
  const { data: session } = useSession();
  const canCreate =
    session?.user?.roleCode === "ADMIN" ||
    (session?.user?.permissions ?? []).includes("products.create");
  const qc = useQueryClient();
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";

  const [product, setProduct] = useState<{
    id: string;
    name: string;
    purchasePrice: number;
  } | null>(null);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("EXPIRED");
  const [error, setError] = useState<string | null>(null);
  const [unknownCode, setUnknownCode] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["waste"],
    queryFn: async () => (await fetch("/api/v1/waste")).json(),
  });

  async function resolveProduct(code: string) {
    setError(null);
    const result = await resolveBarcode(code);
    if (result.status === "found") {
      setProduct({
        id: result.product.id,
        name: result.product.name,
        purchasePrice: toNumber(result.product.purchasePrice),
      });
      setUnknownCode(null);
      return;
    }
    if (result.status === "unknown") {
      setUnknownCode(result.code);
      setProduct(null);
      return;
    }
    if (result.status === "inactive") {
      setError(tb("productInactive"));
      setProduct(null);
      return;
    }
    setError(result.message);
    setProduct(null);
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("Missing fields");
      const res = await fetch("/api/v1/waste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity: qty,
          reason,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setProduct(null);
      setQty(1);
      qc.invalidateQueries({ queryKey: ["waste"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.foodWaste") }]}
    >
      <FormSplitLayout
        form={
          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">{t("record")}</div>
            </CardHeader>
            <CardBody className="space-y-3">
              <HardwareBarcodeInput
                onScan={resolveProduct}
                placeholder={t("scanBarcode")}
              />
              {unknownCode ? (
                <UnknownBarcodeActions
                  code={unknownCode}
                  canCreate={canCreate}
                  returnTo="/food-waste"
                  onCancel={() => setUnknownCode(null)}
                />
              ) : null}
              {product ? (
                <div className="rounded-md border border-[var(--border)] p-3 text-sm">
                  <div className="font-medium">{product.name}</div>
                  <div className="text-xs text-[var(--text-dim)]">
                    {formatMoney(product.purchasePrice, currency, locale)} / unit
                  </div>
                </div>
              ) : null}
              <div>
                <Label>{t("quantity")}</Label>
                <Input
                  type="number"
                  min={0.001}
                  step="any"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>{t("reason")}</Label>
                <Select
                  value={reason}
                  onChange={(e) =>
                    setReason(e.target.value as (typeof REASONS)[number])
                  }
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {t(`reasons.${r}`)}
                    </option>
                  ))}
                </Select>
              </div>
              {product ? (
                <div className="text-sm">
                  {t("loss")}:{" "}
                  <strong>
                    {formatMoney(product.purchasePrice * qty, currency, locale)}
                  </strong>
                </div>
              ) : null}
              {error ? <InlineAlert>{error}</InlineAlert> : null}
              <Button
                variant="success"
                disabled={!product || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                <Plus className="h-4 w-4" />
                {t("save")}
              </Button>
            </CardBody>
          </Card>
        }
        list={
          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">{t("history")}</div>
            </CardHeader>
            <CardBody className="space-y-2">
              {(list.data?.items ?? []).map(
                (w: {
                  id: string;
                  quantity: string;
                  reason: string;
                  costValue: string;
                  createdAt: string;
                  product: { name: string };
                }) => (
                  <div
                    key={w.id}
                    className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">{w.product.name}</div>
                      <div className="text-xs text-[var(--text-dim)]">
                        {w.reason} · {new Date(w.createdAt).toLocaleString(locale)}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge tone="danger">{toNumber(w.quantity)}</Badge>
                      <div className="mt-1 text-xs text-[var(--danger)]">
                        {formatMoney(w.costValue, currency, locale)}
                      </div>
                    </div>
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
