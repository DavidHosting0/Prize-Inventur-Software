"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card, CardBody, CardHeader, Input, Label } from "@prize/ui";
import { FormSplitLayout } from "@/components/form-split-layout";
import { InlineAlert } from "@/components/inline-alert";
import { Plus, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tn = useTranslations("nav");
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [newReason, setNewReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reasonsSaved, setReasonsSaved] = useState(false);

  const data = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await fetch("/api/v1/settings")).json(),
  });

  useEffect(() => {
    const h = data.data?.hotel;
    if (!h) return;
    setName(h.name ?? "");
    setAddress(h.address ?? "");
    setCity(h.city ?? "");
    setCountry(h.country ?? "");
    setTimezone(h.timezone ?? "");
    if (Array.isArray(data.data?.complimentaryReasons)) {
      setReasons(data.data.complimentaryReasons);
    }
  }, [data.data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, city, country, timezone }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["settings"] });
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e: Error) => setError(e.message),
  });

  const saveReasons = useMutation({
    mutationFn: async (next: string[]) => {
      const cleaned = next.map((r) => r.trim()).filter(Boolean);
      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complimentaryReasons: cleaned }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setError(null);
      setReasonsSaved(true);
      qc.invalidateQueries({ queryKey: ["settings"] });
      setTimeout(() => setReasonsSaved(false), 2000);
    },
    onError: (e: Error) => setError(e.message),
  });

  function addReason() {
    const label = newReason.trim();
    if (!label) return;
    if (reasons.some((r) => r.toLowerCase() === label.toLowerCase())) {
      setNewReason("");
      return;
    }
    setReasons((prev) => [...prev, label]);
    setNewReason("");
  }

  function resetToDefaults() {
    const defaults = data.data?.defaultComplimentaryReasons;
    if (Array.isArray(defaults) && defaults.length > 0) {
      setReasons([...defaults]);
    }
  }

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.settings") }]}
    >
      <FormSplitLayout
        form={
          <div className="space-y-4">
            <Card>
              <CardHeader>{t("hotel")}</CardHeader>
              <CardBody className="space-y-3">
                <div>
                  <Label>{t("name")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>{t("address")}</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("city")}</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("country")}</Label>
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>{t("timezone")}</Label>
                  <Input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  />
                </div>
                {data.data?.hotel ? (
                  <p className="text-xs text-[var(--text-dim)]">
                    {t("currency")}: {data.data.hotel.currency} · {t("locale")}:{" "}
                    {data.data.hotel.locale}
                  </p>
                ) : null}
                {error ? <InlineAlert>{error}</InlineAlert> : null}
                {saved ? (
                  <InlineAlert tone="success">{t("saved")}</InlineAlert>
                ) : null}
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending || !name}
                >
                  {t("save")}
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <div>{t("freeReasons")}</div>
                  <p className="mt-1 text-xs font-normal text-[var(--text-muted)]">
                    {t("freeReasonsHint")}
                  </p>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="space-y-2">
                  {reasons.length === 0 ? (
                    <p className="text-sm text-[var(--text-dim)]">
                      {t("freeReasonsEmpty")}
                    </p>
                  ) : (
                    reasons.map((reason, idx) => (
                      <div key={`${reason}-${idx}`} className="flex gap-2">
                        <Input
                          className="flex-1"
                          value={reason}
                          onChange={(e) => {
                            const value = e.target.value;
                            setReasons((prev) =>
                              prev.map((r, i) => (i === idx ? value : r))
                            );
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setReasons((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-dim)] hover:bg-[var(--danger-muted)] hover:text-[var(--danger)]"
                          title={t("removeReason")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder={t("newReason")}
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addReason();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addReason}
                    disabled={!newReason.trim()}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {t("addReason")}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => saveReasons.mutate(reasons)}
                    disabled={saveReasons.isPending}
                  >
                    {t("saveReasons")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetToDefaults}
                  >
                    {t("resetReasons")}
                  </Button>
                </div>
                {reasonsSaved ? (
                  <InlineAlert tone="success">{t("saved")}</InlineAlert>
                ) : null}
              </CardBody>
            </Card>
          </div>
        }
        list={
          <Card>
            <CardHeader>{t("warehouses")}</CardHeader>
            <CardBody>
              <p className="text-sm text-[var(--text-muted)]">
                1 ×{" "}
                {(data.data?.warehouses ?? []).find(
                  (w: { code: string }) => w.code === "LAGER"
                )?.name ??
                  (data.data?.warehouses ?? [])[0]?.name ??
                  "Lager"}
              </p>
            </CardBody>
          </Card>
        }
      />
    </AppShell>
  );
}
