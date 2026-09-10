"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PosConfigNav } from "@/components/pos-config-nav";
import { Button, Card, CardBody, Input } from "@prize/ui";
import { Link } from "@/i18n/navigation";
import { useSession } from "next-auth/react";

export default function PosConfigPricesPage() {
  const t = useTranslations("posConfig");
  const tn = useTranslations("nav");
  const { data: session } = useSession();
  const currency = session?.user?.currency ?? "CHF";
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const articles = useQuery({
    queryKey: ["pos-config-articles", "prices"],
    queryFn: async () =>
      (await fetch("/api/v1/pos-config/articles?active=1")).json(),
  });

  const save = useMutation({
    mutationFn: async (payload: { id: string; salePrice: number }) => {
      const res = await fetch(`/api/v1/pos-config/articles/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salePrice: payload.salePrice }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (_d, vars) => {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["pos-config-articles"] });
    },
  });

  return (
    <AppShell
      title={t("title")}
      subtitle={t("tabs.prices")}
      breadcrumbs={[
        { label: tn("items.posConfig"), href: "/pos-config" },
        { label: t("tabs.prices") },
      ]}
    >
      <PosConfigNav />
      <Card>
        <CardBody className="space-y-2">
          {(articles.data?.items ?? []).map(
            (a: { id: string; name: string; salePrice: string; vatRate: string }) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <Link
                  href={`/pos-config/articles/${a.id}`}
                  className="min-w-[160px] flex-1 font-medium text-[var(--primary)] hover:underline"
                >
                  {a.name}
                </Link>
                <Input
                  className="w-28"
                  type="number"
                  step="0.05"
                  value={drafts[a.id] ?? a.salePrice}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))
                  }
                />
                <span className="text-xs text-[var(--text-dim)]">{currency}</span>
                <span className="text-xs text-[var(--text-dim)]">
                  {t("vat")} {a.vatRate}%
                </span>
                <Button
                  size="sm"
                  disabled={
                    save.isPending ||
                    drafts[a.id] === undefined ||
                    drafts[a.id] === a.salePrice
                  }
                  onClick={() =>
                    save.mutate({
                      id: a.id,
                      salePrice: Number(drafts[a.id]),
                    })
                  }
                >
                  {t("save")}
                </Button>
              </div>
            )
          )}
        </CardBody>
      </Card>
    </AppShell>
  );
}
