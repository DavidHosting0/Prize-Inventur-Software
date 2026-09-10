"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { GroupShell } from "@/components/group-shell";
import { EnterHotelButton } from "@/components/enter-hotel-button";
import { InlineAlert } from "@/components/inline-alert";
import { Button, Card, CardBody, CardHeader, Input, Label } from "@prize/ui";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Plus,
} from "lucide-react";
import { slugifyHotelName } from "@/lib/hotel-url";

type HotelRow = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  country: string | null;
  currency: string;
  locale: string;
  timezone: string;
  imageUrl: string | null;
  _count: {
    users: number;
    products: number;
    categories: number;
    registers: number;
  };
};

type FormState = {
  name: string;
  slug: string;
  address: string;
  city: string;
  country: string;
  currency: string;
  locale: string;
  timezone: string;
};

const STEPS = 4;

const emptyForm = (): FormState => ({
  name: "",
  slug: "",
  address: "",
  city: "",
  country: "CH",
  currency: "CHF",
  locale: "de-CH",
  timezone: "Europe/Zurich",
});

export default function GroupHotelsPage() {
  const t = useTranslations("group");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const data = useQuery({
    queryKey: ["group-hotels"],
    queryFn: async () => {
      const res = await fetch("/api/v1/group/hotels");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ hotels: HotelRow[] }>;
    },
  });

  const previewSlug = useMemo(() => {
    if (slugTouched && form.slug) return form.slug;
    return form.name ? slugifyHotelName(form.name) : "";
  }, [form.name, form.slug, slugTouched]);

  function resetWizard() {
    setStep(0);
    setForm(emptyForm());
    setSlugTouched(false);
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setError(null);
  }

  function onPickImage(file: File | null) {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!imageFile) throw new Error(t("imageRequired"));
      const body = new FormData();
      body.set("name", form.name.trim());
      body.set("slug", (slugTouched ? form.slug : previewSlug).trim());
      body.set("address", form.address.trim());
      body.set("city", form.city.trim());
      body.set("country", form.country.trim() || "CH");
      body.set("currency", form.currency.trim().toUpperCase() || "CHF");
      body.set("locale", form.locale.trim() || "de-CH");
      body.set("timezone", form.timezone.trim() || "Europe/Zurich");
      body.set("image", imageFile);
      const res = await fetch("/api/v1/group/hotels", {
        method: "POST",
        body,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      resetWizard();
      setWizardOpen(false);
      qc.invalidateQueries({ queryKey: ["group-hotels"] });
      qc.invalidateQueries({ queryKey: ["group-dashboard"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const canNext =
    step === 0
      ? form.name.trim().length >= 2 && form.city.trim().length >= 2
      : step === 1
        ? form.currency.length === 3 && form.locale.length >= 2 && form.timezone.length >= 2
        : step === 2
          ? !!imageFile
          : true;

  const hotels = data.data?.hotels ?? [];

  const provisionItems = [
    t("provisionLager"),
    t("provisionCategories"),
    t("provisionPos"),
    t("provisionRegister"),
    t("provisionCover"),
  ];

  return (
    <GroupShell
      title={t("hotelsTitle")}
      subtitle={t("hotelsSubtitle")}
      breadcrumbs={[{ label: tn("items.groupHotels") }]}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-sm)]">
          <div>
            <div className="text-sm font-bold text-[var(--text)]">{t("createHotel")}</div>
            <div className="text-xs text-[var(--text-muted)]">{t("createHotelHint")}</div>
          </div>
          <Button
            type="button"
            className="gap-2"
            onClick={() => {
              resetWizard();
              setWizardOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t("createHotel")}
          </Button>
        </div>

        {wizardOpen ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{t("createHotelWizard")}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {t("wizardStep", { current: step + 1, total: STEPS })}
                  </div>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: STEPS }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-8 rounded-full ${
                        i <= step ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

              {step === 0 ? (
                <div className="grid gap-3 desktop:grid-cols-2">
                  <div className="desktop:col-span-2">
                    <Label>{t("hotelName")}</Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="Prize Basel"
                    />
                  </div>
                  <div>
                    <Label>{t("slug")}</Label>
                    <Input
                      value={slugTouched ? form.slug : previewSlug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setForm((f) => ({
                          ...f,
                          slug: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, ""),
                        }));
                      }}
                      placeholder="basel"
                    />
                    <div className="mt-1 text-[11px] text-[var(--text-dim)]">
                      {t("slugHint", { slug: previewSlug || "…" })}
                    </div>
                  </div>
                  <div>
                    <Label>{t("city")}</Label>
                    <Input
                      value={form.city}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, city: e.target.value }))
                      }
                    />
                  </div>
                  <div className="desktop:col-span-2">
                    <Label>{t("address")}</Label>
                    <Input
                      value={form.address}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, address: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>{t("country")}</Label>
                    <Input
                      value={form.country}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, country: e.target.value }))
                      }
                    />
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="grid gap-3 desktop:grid-cols-3">
                  <div>
                    <Label>{t("currency")}</Label>
                    <Input
                      value={form.currency}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          currency: e.target.value.toUpperCase().slice(0, 3),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>{t("locale")}</Label>
                    <Input
                      value={form.locale}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, locale: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>{t("timezone")}</Label>
                    <Input
                      value={form.timezone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, timezone: e.target.value }))
                      }
                    />
                  </div>
                  <div className="desktop:col-span-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    {t("localeHint")}
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-3">
                  <div className="text-sm text-[var(--text-muted)]">
                    {t("imageStepHint")}
                  </div>
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-10 hover:bg-[var(--card-hover)]">
                    {imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imagePreview}
                        alt=""
                        className="max-h-48 w-full rounded-md object-cover"
                      />
                    ) : (
                      <>
                        <ImagePlus className="h-8 w-8 text-[var(--text-dim)]" />
                        <span className="text-sm font-medium">{t("pickImage")}</span>
                        <span className="text-xs text-[var(--text-dim)]">
                          JPEG / PNG / WebP · max. 5 MB
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) =>
                        onPickImage(e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                  {imageFile ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => onPickImage(null)}
                    >
                      {t("removeImage")}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="grid gap-4 desktop:grid-cols-[1.2fr_1fr]">
                  <div className="space-y-3 rounded-md border border-[var(--border)] p-4">
                    <div className="text-sm font-semibold">{t("reviewBasics")}</div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <dt className="text-[var(--text-dim)]">{t("hotelName")}</dt>
                      <dd>{form.name}</dd>
                      <dt className="text-[var(--text-dim)]">{t("slug")}</dt>
                      <dd>/{previewSlug}</dd>
                      <dt className="text-[var(--text-dim)]">{t("city")}</dt>
                      <dd>
                        {[form.city, form.country].filter(Boolean).join(", ")}
                      </dd>
                      <dt className="text-[var(--text-dim)]">{t("address")}</dt>
                      <dd>{form.address || "—"}</dd>
                      <dt className="text-[var(--text-dim)]">{t("currency")}</dt>
                      <dd>
                        {form.currency} · {form.locale}
                      </dd>
                      <dt className="text-[var(--text-dim)]">{t("timezone")}</dt>
                      <dd>{form.timezone}</dd>
                    </dl>
                    {imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imagePreview}
                        alt=""
                        className="mt-2 h-28 w-full rounded-md object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
                    <div className="text-sm font-semibold">{t("provisionTitle")}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {t("provisionHint")}
                    </div>
                    <ul className="mt-2 space-y-2">
                      {provisionItems.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (step === 0) {
                      resetWizard();
                      setWizardOpen(false);
                    } else {
                      setStep((s) => s - 1);
                    }
                  }}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {step === 0 ? tc("cancel") : tc("back")}
                </Button>
                {step < STEPS - 1 ? (
                  <Button
                    type="button"
                    disabled={!canNext}
                    onClick={() => setStep((s) => s + 1)}
                    className="gap-1"
                  >
                    {tc("next")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={create.isPending || !canNext}
                    onClick={() => create.mutate()}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {create.isPending ? tc("loading") : t("createAndProvision")}
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        ) : null}

        <div className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
          {data.isLoading ? (
            <div className="text-sm text-[var(--text-muted)]">{tc("loading")}</div>
          ) : hotels.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)]">{tc("noRows")}</div>
          ) : (
            hotels.map((h) => (
              <Card key={h.id} className="overflow-hidden">
                <div className="relative h-40 bg-[var(--bg-elevated)]">
                  {h.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={h.imageUrl}
                      alt={h.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--text-dim)]">
                      <Building2 className="h-10 w-10 opacity-40" />
                    </div>
                  )}
                </div>
                <CardBody className="space-y-3">
                  <div>
                    <div className="text-sm font-semibold">{h.name}</div>
                    <div className="text-xs text-[var(--text-dim)]">
                      {[h.city, h.country].filter(Boolean).join(", ") || "—"} · /
                      {h.slug}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md border border-[var(--border-subtle)] px-1 py-1.5">
                      <div className="font-semibold">{h._count.users}</div>
                      <div className="text-[var(--text-dim)]">{t("users")}</div>
                    </div>
                    <div className="rounded-md border border-[var(--border-subtle)] px-1 py-1.5">
                      <div className="font-semibold">{h._count.products}</div>
                      <div className="text-[var(--text-dim)]">{t("products")}</div>
                    </div>
                    <div className="rounded-md border border-[var(--border-subtle)] px-1 py-1.5">
                      <div className="font-semibold">{h._count.categories}</div>
                      <div className="text-[var(--text-dim)]">{t("categories")}</div>
                    </div>
                  </div>
                  <EnterHotelButton
                    hotelId={h.id}
                    hotelSlug={h.slug}
                    label={t("enterHotel")}
                  />
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </div>
    </GroupShell>
  );
}
