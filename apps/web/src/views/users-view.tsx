"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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
import { FormSplitLayout } from "@/components/form-split-layout";
import { DataTablePanel } from "@/components/data-table-panel";
import { InlineAlert } from "@/components/inline-alert";

export default function UsersPage() {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    roleId: "",
    locale: "de",
  });

  const data = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await fetch("/api/v1/users")).json(),
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setForm({
        name: "",
        username: "",
        email: "",
        password: "",
        roleId: "",
        locale: "de",
      });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const items = data.data?.items ?? [];

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.users") }]}
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
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("username")}</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("email")}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("password")}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("role")}</Label>
                <Select
                  value={form.roleId}
                  onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                >
                  <option value="">—</option>
                  {(data.data?.roles ?? []).map(
                    (r: { id: string; name: string; code: string }) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    )
                  )}
                </Select>
              </div>
              {error ? <InlineAlert>{error}</InlineAlert> : null}
              <Button
                variant="success"
                disabled={
                  !form.name ||
                  !form.email ||
                  !form.password ||
                  !form.roleId ||
                  create.isPending
                }
                onClick={() => create.mutate()}
              >
                <Plus className="h-4 w-4" />
                {tc("create")}
              </Button>
            </CardBody>
          </Card>
        }
        list={
          <DataTablePanel
            title={t("list")}
            empty={items.length === 0 ? tc("noRows") : undefined}
          >
            {items.length > 0 ? (
              <table className="app-table">
                <thead>
                  <tr>
                    <th>{t("name")}</th>
                    <th>{t("email")}</th>
                    <th>{t("role")}</th>
                    <th>{tc("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(
                    (u: {
                      id: string;
                      name: string;
                      email: string;
                      isActive: boolean;
                      role: { name: string; code: string };
                    }) => (
                      <tr key={u.id}>
                        <td className="font-medium">{u.name}</td>
                        <td>{u.email}</td>
                        <td>
                          <Badge tone="primary">{u.role.code}</Badge>
                        </td>
                        <td>
                          <Badge tone={u.isActive ? "success" : "danger"}>
                            {u.isActive ? "active" : "inactive"}
                          </Badge>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            ) : null}
          </DataTablePanel>
        }
      />
    </AppShell>
  );
}
