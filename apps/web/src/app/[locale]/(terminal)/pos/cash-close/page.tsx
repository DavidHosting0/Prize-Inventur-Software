"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { PosTerminalShell } from "@/components/pos-terminal-shell";
import { Button, Card, CardBody, CardHeader, Input, Label, KpiCard } from "@prize/ui";
import { formatMoney } from "@/lib/money";
import { Link } from "@/i18n/navigation";

export default function CashClosePage() {
  const t = useTranslations("cashClose");
  const tp = useTranslations("pos");
  const { data: session } = useSession();
  const qc = useQueryClient();
  const currency = session?.user?.currency ?? "CHF";
  const locale = session?.user?.hotelLocale ?? "de-CH";
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState<null | {
    expectedCash: number;
    countedCash: number;
    cashDifference: number;
  }>(null);

  const { data } = useQuery({
    queryKey: ["cash-session"],
    queryFn: async () => (await fetch("/api/v1/cash-sessions")).json(),
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/cash-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countedCash: Number(counted),
          notes: notes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (row) => {
      setDone({
        expectedCash: Number(row.expectedCash),
        countedCash: Number(row.countedCash),
        cashDifference: Number(row.cashDifference),
      });
      qc.invalidateQueries({ queryKey: ["cash-session"] });
    },
  });

  const totals = data?.totals;

  return (
    <PosTerminalShell>
      <div className="mx-auto max-w-xl space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">{t("title")}</h1>
          <Link href="/pos" className="text-sm text-[var(--prize-orange)] hover:underline">
            ← {tp("terminalTitle")}
          </Link>
        </div>

        {!data?.session ? (
          <Card>
            <CardBody className="text-sm text-[var(--text-muted)]">No open cash session.</CardBody>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Bar" value={formatMoney(totals?.CASH ?? 0, currency, locale)} />
              <KpiCard label="Karte" value={formatMoney(totals?.CARD ?? 0, currency, locale)} />
              <KpiCard label="TWINT" value={formatMoney(totals?.TWINT ?? 0, currency, locale)} />
              <KpiCard
                label={t("offline")}
                value={formatMoney(totals?.OFFLINE ?? 0, currency, locale)}
              />
              <KpiCard
                label="Total"
                value={formatMoney(totals?.TOTAL ?? 0, currency, locale)}
                tone="success"
              />
            </div>

            <Card>
              <CardHeader>
                <div className="text-sm font-semibold">{data.session.cashRegister.name}</div>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="text-sm">
                  {t("expected")}:{" "}
                  <strong>{formatMoney(data.expectedCash ?? 0, currency, locale)}</strong>
                </div>
                <div>
                  <Label>{t("counted")}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={counted}
                    onChange={(e) => setCounted(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                {counted !== "" ? (
                  <div className="text-sm">
                    {t("difference")}:{" "}
                    <strong
                      className={
                        Number(counted) - Number(data.expectedCash ?? 0) === 0
                          ? "text-[var(--success)]"
                          : "text-[var(--danger)]"
                      }
                    >
                      {formatMoney(
                        Number(counted) - Number(data.expectedCash ?? 0),
                        currency,
                        locale
                      )}
                    </strong>
                  </div>
                ) : null}
                <Button
                  disabled={counted === "" || closeMutation.isPending}
                  onClick={() => closeMutation.mutate()}
                >
                  {t("closeRegister")}
                </Button>
                {done ? (
                  <div className="rounded-md bg-[var(--success-muted)] px-3 py-2 text-sm text-[var(--success)]">
                    Closed · Diff {formatMoney(done.cashDifference, currency, locale)}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </PosTerminalShell>
  );
}
