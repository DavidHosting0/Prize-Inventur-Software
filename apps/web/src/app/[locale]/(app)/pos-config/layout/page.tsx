"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/app-shell";
import { PosConfigNav } from "@/components/pos-config-nav";
import { Button, Card, CardBody, CardHeader } from "@prize/ui";

export default function PosConfigLayoutPage() {
  const t = useTranslations("posConfig");
  const tn = useTranslations("nav");
  const qc = useQueryClient();

  const articles = useQuery({
    queryKey: ["pos-config-articles", "layout"],
    queryFn: async () =>
      (await fetch("/api/v1/pos-config/articles?active=1")).json(),
  });

  const cats = useQuery({
    queryKey: ["pos-config-categories"],
    queryFn: async () => (await fetch("/api/v1/pos-config/categories")).json(),
  });

  const reorderArticles = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await fetch("/api/v1/pos-config/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", orderedIds }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["pos-config-articles"] }),
  });

  const toggleFav = useMutation({
    mutationFn: async (row: { id: string; isFavorite: boolean }) => {
      const res = await fetch(`/api/v1/pos-config/articles/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !row.isFavorite }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["pos-config-articles"] }),
  });

  const items: { id: string; name: string; isFavorite: boolean }[] =
    articles.data?.items ?? [];

  return (
    <AppShell
      title={t("title")}
      subtitle={t("tabs.layout")}
      breadcrumbs={[
        { label: tn("items.posConfig"), href: "/pos-config" },
        { label: t("tabs.layout") },
      ]}
    >
      <PosConfigNav />
      <p className="mb-3 text-sm text-[var(--text-muted)]">{t("layoutHint")}</p>
      <div className="grid gap-4 desktop:grid-cols-2">
        <Card>
          <CardHeader>{t("tabs.categories")}</CardHeader>
          <CardBody className="space-y-1 text-sm">
            {(cats.data?.items ?? [])
              .filter((c: { isActive: boolean }) => c.isActive)
              .map((c: { id: string; name: string; sortOrder: number }) => (
                <div key={c.id} className="rounded border border-[var(--border)] px-3 py-2">
                  {c.sortOrder + 1}. {c.name}
                </div>
              ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>{t("tabs.articles")}</CardHeader>
          <CardBody className="space-y-2">
            {items.map((a, idx) => (
              <div
                key={a.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <div className="min-w-0 flex-1 truncate text-sm font-medium">
                  {a.isFavorite ? "★ " : ""}
                  {a.name}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => toggleFav.mutate(a)}
                >
                  {t("favorite")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={idx === 0}
                  onClick={() => {
                    const ids = items.map((x) => x.id);
                    const tmp = ids[idx - 1]!;
                    ids[idx - 1] = ids[idx]!;
                    ids[idx] = tmp;
                    reorderArticles.mutate(ids);
                  }}
                >
                  {t("moveUp")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={idx === items.length - 1}
                  onClick={() => {
                    const ids = items.map((x) => x.id);
                    const tmp = ids[idx + 1]!;
                    ids[idx + 1] = ids[idx]!;
                    ids[idx] = tmp;
                    reorderArticles.mutate(ids);
                  }}
                >
                  {t("moveDown")}
                </Button>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
