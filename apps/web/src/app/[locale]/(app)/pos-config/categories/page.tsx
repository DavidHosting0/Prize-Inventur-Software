"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PosConfigNav } from "@/components/pos-config-nav";
import { Badge, Button, Card, CardBody, Input } from "@prize/ui";

export default function PosConfigCategoriesPage() {
  const t = useTranslations("posConfig");
  const tn = useTranslations("nav");
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const cats = useQuery({
    queryKey: ["pos-config-categories"],
    queryFn: async () => (await fetch("/api/v1/pos-config/categories")).json(),
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/pos-config/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["pos-config-categories"] });
    },
  });

  const toggle = useMutation({
    mutationFn: async (row: { id: string; name: string; isActive: boolean }) => {
      const res = await fetch(`/api/v1/pos-config/categories/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: row.name, isActive: !row.isActive }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-config-categories"] }),
  });

  const move = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await fetch("/api/v1/pos-config/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", orderedIds }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-config-categories"] }),
  });

  const items: { id: string; name: string; isActive: boolean; _count: { articles: number } }[] =
    cats.data?.items ?? [];

  return (
    <AppShell
      title={t("title")}
      subtitle={t("tabs.categories")}
      breadcrumbs={[
        { label: tn("items.posConfig"), href: "/pos-config" },
        { label: t("tabs.categories") },
      ]}
    >
      <PosConfigNav />
      <div className="mb-3 flex gap-2">
        <Input
          className="max-w-xs"
          placeholder={t("newCategory")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
          {t("createCategory")}
        </Button>
      </div>
      <Card>
        <CardBody className="space-y-2">
          {items.map((c, idx) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-[var(--text-dim)]">
                  {c._count.articles} {t("articlesCount")}
                </div>
              </div>
              <Badge tone={c.isActive ? "success" : "default"}>
                {c.isActive ? t("active") : t("inactive")}
              </Badge>
              <Button
                size="sm"
                variant="secondary"
                disabled={idx === 0}
                onClick={() => {
                  const ids = items.map((x) => x.id);
                  const tmp = ids[idx - 1]!;
                  ids[idx - 1] = ids[idx]!;
                  ids[idx] = tmp;
                  move.mutate(ids);
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
                  move.mutate(ids);
                }}
              >
                {t("moveDown")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => toggle.mutate(c)}>
                {c.isActive ? t("deactivate") : t("activate")}
              </Button>
            </div>
          ))}
        </CardBody>
      </Card>
    </AppShell>
  );
}
