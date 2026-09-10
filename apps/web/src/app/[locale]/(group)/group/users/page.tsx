"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Plus } from "lucide-react";
import { GroupShell } from "@/components/group-shell";
import { DataTablePanel } from "@/components/data-table-panel";
import { FormSplitLayout } from "@/components/form-split-layout";
import { InlineAlert } from "@/components/inline-alert";
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

type GroupUser = {
  id: string;
  email: string;
  username: string;
  name: string;
  accountType: string;
  isActive: boolean;
  role: { code: string; name: string; scope: string } | null;
  hotels: { isDefault: boolean; hotel: { id: string; name: string } }[];
};

type RoleRow = { id: string; code: string; name: string };
type HotelRow = { id: string; name: string; slug: string };

export default function GroupUsersPage() {
  const t = useTranslations("group");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const tu = useTranslations("users");
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    roleId: "",
    locale: "de",
    hotelIds: [] as string[],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["group-users"],
    queryFn: async () => {
      const res = await fetch("/api/v1/group/users");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        users: GroupUser[];
        roles: RoleRow[];
        hotels: HotelRow[];
      }>;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/group/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          hotelIds: form.hotelIds.length ? form.hotelIds : undefined,
        }),
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
        hotelIds: [],
      });
      setError(null);
      qc.invalidateQueries({ queryKey: ["group-users"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const users = data?.users ?? [];
  const roles = data?.roles ?? [];
  const hotels = data?.hotels ?? [];

  function toggleHotel(id: string) {
    setForm((prev) => ({
      ...prev,
      hotelIds: prev.hotelIds.includes(id)
        ? prev.hotelIds.filter((h) => h !== id)
        : [...prev.hotelIds, id],
    }));
  }

  return (
    <GroupShell
      title={t("usersTitle")}
      subtitle={t("usersSubtitleCorp")}
      breadcrumbs={[{ label: tn("items.groupUsers") }]}
    >
      <FormSplitLayout
        form={
          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">{t("createGroupUser")}</div>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-xs text-[var(--text-muted)]">
                {t("usersHotelHint")}
              </p>
              <div>
                <Label>{tu("name")}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>{tu("username")}</Label>
                <Input
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{tu("email")}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label>{tu("password")}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{tu("role")}</Label>
                <Select
                  value={form.roleId}
                  onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                >
                  <option value="">—</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </Select>
              </div>
              {hotels.length > 0 ? (
                <div>
                  <Label>{t("hotelAllowList")}</Label>
                  <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-md border border-[var(--border)] p-2 text-sm">
                    {hotels.map((h) => (
                      <label
                        key={h.id}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={form.hotelIds.includes(h.id)}
                          onChange={() => toggleHotel(h.id)}
                        />
                        <span>
                          {h.name}{" "}
                          <span className="text-[var(--text-dim)]">
                            /{h.slug}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-dim)]">
                    {t("hotelAllowListHint")}
                  </p>
                </div>
              ) : null}
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
            title={t("usersTitle")}
            empty={
              isLoading
                ? tc("loading")
                : users.length === 0
                  ? tc("noRows")
                  : undefined
            }
          >
            {users.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--border)] text-xs text-[var(--text-dim)]">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("name")}</th>
                    <th className="px-4 py-2 font-medium">{t("email")}</th>
                    <th className="px-4 py-2 font-medium">{t("role")}</th>
                    <th className="px-4 py-2 font-medium">{t("hotels")}</th>
                    <th className="px-4 py-2 font-medium">{tc("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-[var(--border-subtle)] last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-[var(--text-dim)]">
                          @{u.username}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">{u.email}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone="primary">
                          {u.role?.code ?? "—"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--text-muted)]">
                        {u.hotels.length
                          ? u.hotels.map((h) => h.hotel.name).join(", ")
                          : t("allHotelsViaRole")}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={u.isActive ? "success" : "danger"}>
                          {u.isActive ? t("active") : t("inactive")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </DataTablePanel>
        }
      />
    </GroupShell>
  );
}
