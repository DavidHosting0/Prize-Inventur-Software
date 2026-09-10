"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, CardBody, CardHeader, Input, Label } from "@prize/ui";
import { FormSplitLayout } from "@/components/form-split-layout";
import { DataTablePanel } from "@/components/data-table-panel";
import { InlineAlert } from "@/components/inline-alert";

type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  leadTimeDays: number;
  isActive: boolean;
};

const empty = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  leadTimeDays: 2,
};

export default function SuppliersPage() {
  const t = useTranslations("suppliers");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await fetch("/api/v1/suppliers")).json(),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        contactName: form.contactName || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        leadTimeDays: form.leadTimeDays,
        isActive: true,
      };
      const res = await fetch(
        editId ? `/api/v1/suppliers/${editId}` : "/api/v1/suppliers",
        {
          method: editId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setForm(empty);
      setEditId(null);
      setError(null);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  function startEdit(s: Supplier) {
    setEditId(s.id);
    setForm({
      name: s.name,
      contactName: s.contactName ?? "",
      email: s.email ?? "",
      phone: s.phone ?? "",
      address: s.address ?? "",
      leadTimeDays: s.leadTimeDays,
    });
  }

  const items = data?.items ?? [];

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.suppliers") }]}
    >
      <FormSplitLayout
        form={
          <Card>
            <CardHeader>{editId ? t("edit") : t("create")}</CardHeader>
            <CardBody className="space-y-3">
              <div>
                <Label>{t("name")}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("contact")}</Label>
                <Input
                  value={form.contactName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactName: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("email")}</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t("phone")}</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>{t("address")}</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t("leadTime")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.leadTimeDays}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, leadTimeDays: Number(e.target.value) }))
                  }
                />
              </div>
              {error ? <InlineAlert>{error}</InlineAlert> : null}
              <div className="flex gap-2">
                <Button
                  variant={editId ? "primary" : "success"}
                  onClick={() => save.mutate()}
                  disabled={!form.name || save.isPending}
                >
                  {!editId ? <Plus className="h-4 w-4" /> : null}
                  {tc("save")}
                </Button>
                {editId ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditId(null);
                      setForm(empty);
                    }}
                  >
                    {tc("cancel")}
                  </Button>
                ) : null}
              </div>
            </CardBody>
          </Card>
        }
        list={
          <DataTablePanel title={t("list")} empty={items.length === 0 ? tc("noRows") : undefined}>
            {items.length > 0 ? (
              <table className="app-table">
                <thead>
                  <tr>
                    <th>{t("name")}</th>
                    <th>{t("contact")}</th>
                    <th>{t("email")}</th>
                    <th>{t("phone")}</th>
                    <th>{t("leadTime")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((s: Supplier) => (
                    <tr key={s.id}>
                      <td className="font-medium">
                        {s.name}{" "}
                        {!s.isActive ? <Badge tone="warning">off</Badge> : null}
                      </td>
                      <td>{s.contactName ?? "—"}</td>
                      <td>{s.email ?? "—"}</td>
                      <td>{s.phone ?? "—"}</td>
                      <td>{s.leadTimeDays}d</td>
                      <td>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(s)}>
                          {tc("edit")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </DataTablePanel>
        }
      />
    </AppShell>
  );
}
