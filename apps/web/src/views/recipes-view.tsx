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

type Line = {
  productId: string;
  name: string;
  quantity: number;
  unit: string;
};

export default function RecipesPage() {
  const t = useTranslations("recipes");
  const tb = useTranslations("barcode");
  const tn = useTranslations("nav");
  const { data: session } = useSession();
  const canCreate =
    session?.user?.roleCode === "ADMIN" ||
    (session?.user?.permissions ?? []).includes("products.create");
  const qc = useQueryClient();
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";

  const [name, setName] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState("PIECE");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [servings, setServings] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [unknownCode, setUnknownCode] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["recipes"],
    queryFn: async () => (await fetch("/api/v1/recipes")).json(),
  });

  const theory = useQuery({
    queryKey: ["recipe-theory", selectedId, servings],
    enabled: !!selectedId && servings > 0,
    queryFn: async () =>
      (
        await fetch(
          `/api/v1/recipes?id=${selectedId}&servings=${servings}`
        )
      ).json(),
  });

  async function addIngredient(code: string) {
    setError(null);
    setUnknownCode(null);
    const result = await resolveBarcode(code);
    if (result.status === "found") {
      pushLine({
        id: result.product.id,
        name: result.product.name,
        unit: result.product.unit,
      });
      return;
    }
    if (result.status === "unknown") {
      // fallback: search by name via products q
      const search = await fetch(
        `/api/v1/products?q=${encodeURIComponent(code)}`
      );
      const data = await search.json();
      const p = data.items?.[0];
      if (!p) {
        setUnknownCode(code);
        setError(t("productNotFound"));
        return;
      }
      pushLine(p);
      return;
    }
    if (result.status === "inactive") {
      setError(tb("productInactive"));
      return;
    }
    setError(result.message);
  }

  function pushLine(p: { id: string; name: string; unit: string }) {
    setLines((prev) => [
      ...prev,
      {
        productId: p.id,
        name: p.name,
        quantity: qty,
        unit: unit || p.unit,
      },
    ]);
    setManualCode("");
    setQty(1);
  }

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unit: l.unit,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setName("");
      setLines([]);
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.recipes") }]}
    >
      <FormSplitLayout
        form={
          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">{t("create")}</div>
            </CardHeader>
            <CardBody className="space-y-3">
              <div>
                <Label>{t("name")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <HardwareBarcodeInput
                  className="min-w-[140px] flex-1"
                  placeholder={t("addIngredient")}
                  value={manualCode}
                  onValueChange={setManualCode}
                  onScan={addIngredient}
                  submitOnIdle={false}
                />
                <Input
                  type="number"
                  className="w-20"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value) || 1)}
                />
                <Select
                  className="w-auto"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  {["PIECE", "G", "KG", "ML", "LITER"].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  onClick={() => addIngredient(manualCode)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {unknownCode ? (
                <UnknownBarcodeActions
                  code={unknownCode}
                  canCreate={canCreate}
                  returnTo="/recipes"
                  onCancel={() => setUnknownCode(null)}
                />
              ) : null}
              <div className="space-y-1">
                {lines.map((l, i) => (
                  <div
                    key={`${l.productId}-${i}`}
                    className="flex justify-between text-sm"
                  >
                    <span>
                      {l.quantity} {l.unit} {l.name}
                    </span>
                    <button
                      type="button"
                      className="text-[var(--danger)]"
                      onClick={() =>
                        setLines((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {error ? <InlineAlert>{error}</InlineAlert> : null}
              <Button
                variant="success"
                disabled={!name || lines.length === 0 || create.isPending}
                onClick={() => create.mutate()}
              >
                <Plus className="h-4 w-4" />
                {t("save")}
              </Button>
            </CardBody>
          </Card>
        }
        list={
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="text-sm font-semibold">{t("list")}</div>
              </CardHeader>
              <CardBody className="space-y-2">
                {(list.data?.items ?? []).map(
                  (r: {
                    id: string;
                    name: string;
                    version: number;
                    isActive: boolean;
                    items: {
                      quantity: string;
                      unit: string;
                      product: { name: string };
                    }[];
                  }) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                        selectedId === r.id
                          ? "border-[var(--primary)] bg-[var(--primary-muted)]"
                          : "border-[var(--border-subtle)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.name}</span>
                        <div className="flex gap-1">
                          <Badge tone="primary">v{r.version}</Badge>
                          <Badge tone={r.isActive ? "success" : "default"}>
                            {r.isActive ? "active" : "old"}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-dim)]">
                        {r.items
                          .map(
                            (i) =>
                              `${toNumber(i.quantity)} ${i.unit} ${i.product.name}`
                          )
                          .join(", ")}
                      </div>
                    </button>
                  )
                )}
              </CardBody>
            </Card>

            {selectedId ? (
              <Card>
                <CardHeader>
                  <div className="text-sm font-semibold">{t("theory")}</div>
                  <Input
                    type="number"
                    className="w-20"
                    min={1}
                    value={servings}
                    onChange={(e) => setServings(Number(e.target.value) || 1)}
                  />
                </CardHeader>
                <CardBody className="space-y-1 text-sm">
                  {(theory.data?.lines ?? []).map(
                    (l: {
                      productId: string;
                      name: string;
                      quantity: number;
                      unit: string;
                      cost: number;
                    }) => (
                      <div
                        key={l.productId}
                        className="flex justify-between border-b border-[var(--border-subtle)] py-1"
                      >
                        <span>
                          {l.quantity} {l.unit} {l.name}
                        </span>
                        <span className="text-[var(--text-muted)]">
                          {formatMoney(l.cost, currency, locale)}
                        </span>
                      </div>
                    )
                  )}
                </CardBody>
              </Card>
            ) : null}
          </div>
        }
      />
    </AppShell>
  );
}
