"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@prize/ui";
import { Building2 } from "lucide-react";
import { hotelAppPath } from "@/lib/hotel-url";

export function EnterHotelButton({
  hotelId,
  hotelSlug,
  label,
  className,
}: {
  hotelId: string;
  hotelSlug?: string;
  label?: string;
  className?: string;
}) {
  const t = useTranslations("group");
  const locale = useLocale();
  const { update } = useSession();
  const qc = useQueryClient();

  const enter = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/hotels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const body = await res.json();
      await update({
        hotelId: body.hotelId,
        hotelSlug: body.slug,
        hotelName: body.hotelName,
        currency: body.currency,
        hotelLocale: body.hotelLocale,
      });
      return body as { slug?: string; hotelId: string };
    },
    onSuccess: (body) => {
      qc.clear();
      const slug = body.slug || hotelSlug;
      if (!slug) {
        window.location.href = `/${locale}/dashboard`;
        return;
      }
      window.location.href = hotelAppPath(slug, locale, "/dashboard");
    },
  });

  return (
    <Button
      type="button"
      size="sm"
      className={className}
      disabled={enter.isPending}
      onClick={() => enter.mutate()}
    >
      <Building2 className="mr-1.5 h-3.5 w-3.5" />
      {enter.isPending ? "…" : (label ?? t("openHotel"))}
    </Button>
  );
}
