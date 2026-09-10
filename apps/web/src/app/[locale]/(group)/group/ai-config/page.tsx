"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { GroupShell } from "@/components/group-shell";
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
import { INTEGRATION_PROVIDERS } from "@prize/types";

type Integration = {
  id: string;
  provider: string;
  purpose: string;
  model: string | null;
  enabled: boolean;
  hasSecret: boolean;
  secretMasked: string | null;
};

const AI_PURPOSES = ["OCR_DELIVERY_NOTE", "GENERAL_AI"] as const;

export default function GroupAiConfigPage() {
  const t = useTranslations("group");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    provider: "OPENAI",
    purpose: "OCR_DELIVERY_NOTE",
    model: "",
    enabled: true,
    apiKey: "",
  });

  const data = useQuery({
    queryKey: ["group-integrations"],
    queryFn: async () => {
      const res = await fetch("/api/v1/group/integrations");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ integrations: Integration[] }>;
    },
  });

  const items = (data.data?.integrations ?? []).filter((i) =>
    AI_PURPOSES.includes(i.purpose as (typeof AI_PURPOSES)[number])
  );

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        provider: form.provider,
        purpose: form.purpose,
        model: form.model || null,
        enabled: form.enabled,
      };
      if (form.apiKey.trim()) body.apiKey = form.apiKey.trim();
      const res = await fetch("/api/v1/group/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      setSaved(true);
      setForm((f) => ({ ...f, apiKey: "" }));
      qc.invalidateQueries({ queryKey: ["group-integrations"] });
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e: Error) => setError(e.message),
  });

  function loadRow(row: Integration) {
    setForm({
      provider: row.provider,
      purpose: row.purpose,
      model: row.model ?? "",
      enabled: row.enabled,
      apiKey: "",
    });
  }

  return (
    <GroupShell
      title={t("aiConfigTitle")}
      subtitle={t("aiConfigSubtitle")}
      breadcrumbs={[{ label: tn("items.groupAiConfig") }]}
    >
      <div className="grid gap-4 desktop:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <div className="text-sm font-semibold">{t("editIntegration")}</div>
          </CardHeader>
          <CardBody className="space-y-3">
            {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
            {saved ? <InlineAlert tone="success">{tc("success")}</InlineAlert> : null}
            <div>
              <Label>{t("provider")}</Label>
              <Select
                value={form.provider}
                onChange={(e) =>
                  setForm((f) => ({ ...f, provider: e.target.value }))
                }
              >
                {INTEGRATION_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t("purpose")}</Label>
              <Select
                value={form.purpose}
                onChange={(e) =>
                  setForm((f) => ({ ...f, purpose: e.target.value }))
                }
              >
                {AI_PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t("model")}</Label>
              <Input
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                placeholder="gpt-4o-mini"
              />
            </div>
            <div>
              <Label>{t("apiKey")}</Label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, apiKey: e.target.value }))
                }
                placeholder={t("apiKeyHint")}
                autoComplete="off"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, enabled: e.target.checked }))
                }
              />
              {t("enabled")}
            </label>
            <Button
              type="button"
              className="w-full"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {tc("save")}
            </Button>
          </CardBody>
        </Card>

        <div className="space-y-3">
          {data.isLoading ? (
            <div className="text-sm text-[var(--text-muted)]">{tc("loading")}</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)]">{tc("noRows")}</div>
          ) : (
            items.map((row) => (
              <Card key={row.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">
                        {row.provider} · {row.purpose}
                      </div>
                      <div className="text-xs text-[var(--text-dim)]">
                        {row.model ?? "—"} ·{" "}
                        {row.hasSecret
                          ? row.secretMasked ?? "••••"
                          : t("noSecret")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={row.enabled ? "success" : "default"}>
                        {row.enabled ? t("enabled") : t("disabled")}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => loadRow(row)}
                      >
                        {tc("edit")}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>
    </GroupShell>
  );
}
