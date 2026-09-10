"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, CardBody, CardHeader, Input, Label } from "@prize/ui";
import { formatMoney, toNumber } from "@/lib/money";
import { localYmd } from "@/lib/breakfast";
import { FormSplitLayout } from "@/components/form-split-layout";
import { DataTablePanel } from "@/components/data-table-panel";
import { InlineAlert } from "@/components/inline-alert";

export default function BreakfastPage() {
  const t = useTranslations("breakfast");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const { data: session } = useSession();
  const qc = useQueryClient();
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";

  const today = localYmd();
  const [date, setDate] = useState(today);
  const [expected, setExpected] = useState(100);
  const [actual, setActual] = useState(95);
  const [costTotal, setCostTotal] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const data = useQuery({
    queryKey: ["breakfast"],
    queryFn: async () => (await fetch("/api/v1/breakfast")).json(),
  });

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/breakfast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          expectedGuests: expected,
          actualGuests: actual,
          costTotal,
          notes: notes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["breakfast"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const forecast = data.data?.forecast;
  const items = data.data?.items ?? [];

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.breakfast") }]}
    >
      <div className="mb-4 grid gap-3 tablet:grid-cols-3">
        <Card>
          <CardBody className="space-y-1">
            <div className="text-xs text-[var(--text-dim)]">{t("avgGuests")}</div>
            <div className="text-2xl font-semibold">{forecast?.avgGuests ?? "—"}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-1">
            <div className="text-xs text-[var(--text-dim)]">{t("expectedTomorrow")}</div>
            <div className="text-2xl font-semibold">
              {forecast?.expectedTomorrow ?? "—"}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-1">
            <div className="text-xs text-[var(--text-dim)]">{t("costPerGuest")}</div>
            <div className="text-2xl font-semibold">
              {forecast
                ? formatMoney(forecast.costPerBreakfast, currency, locale)
                : "—"}
            </div>
          </CardBody>
        </Card>
      </div>

      <FormSplitLayout
        form={
          <Card>
            <CardHeader>{t("record")}</CardHeader>
            <CardBody className="space-y-3">
              <div>
                <Label>{t("date")}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("expected")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={expected}
                    onChange={(e) => setExpected(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>{t("actual")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={actual}
                    onChange={(e) => setActual(Number(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <Label>{t("costTotal")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={costTotal}
                  onChange={(e) => setCostTotal(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>{t("notes")}</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              {error ? <InlineAlert>{error}</InlineAlert> : null}
              <Button
                variant="success"
                onClick={() => save.mutate()}
                disabled={save.isPending}
              >
                <Plus className="h-4 w-4" />
                {t("save")}
              </Button>
            </CardBody>
          </Card>
        }
        list={
          <DataTablePanel title={t("requirements")}>
            <div className="px-4 pt-3 text-xs text-[var(--text-muted)]">
              {t("requirementsHint")}
            </div>
            <table className="app-table">
              <thead>
                <tr>
                  <th>{t("product")}</th>
                  <th>{t("qty")}</th>
                  <th>{t("cost")}</th>
                </tr>
              </thead>
              <tbody>
                {(forecast?.requirements ?? []).map(
                  (r: {
                    key: string;
                    name: string;
                    quantity: number;
                    unit: string;
                    cost: number;
                  }) => (
                    <tr key={r.key}>
                      <td>{r.name}</td>
                      <td>
                        {r.quantity} {r.unit}
                      </td>
                      <td>{formatMoney(r.cost, currency, locale)}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </DataTablePanel>
        }
      />

      <div className="mt-4">
        <DataTablePanel
          title={t("history")}
          empty={items.length === 0 ? tc("noRows") : undefined}
        >
          {items.length > 0 ? (
            <table className="app-table">
              <thead>
                <tr>
                  <th>{t("date")}</th>
                  <th>{t("expected")}</th>
                  <th>{t("actual")}</th>
                  <th>{t("costTotal")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(
                  (row: {
                    id: string;
                    date: string;
                    expectedGuests: number;
                    actualGuests: number;
                    costTotal: string | number;
                  }) => (
                    <tr key={row.id}>
                      <td>{String(row.date).slice(0, 10)}</td>
                      <td>{row.expectedGuests}</td>
                      <td>
                        <Badge>{row.actualGuests}</Badge>
                      </td>
                      <td>
                        {formatMoney(toNumber(row.costTotal), currency, locale)}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          ) : null}
        </DataTablePanel>
      </div>
    </AppShell>
  );
}
