"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Building2, ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { hotelAppPath, localeAppPath } from "@/lib/hotel-url";

type HotelRow = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  city: string | null;
};

export function HotelSwitcher() {
  const { data: session, update } = useSession();
  const qc = useQueryClient();
  const locale = useLocale();
  const t = useTranslations("group");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const accountType = session?.user?.accountType;
  const hotelId = session?.user?.hotelId ?? null;
  const isGroup = accountType === "GROUP";
  const isHotelAccount = accountType === "HOTEL";

  const hotels = useQuery({
    queryKey: ["my-hotels"],
    queryFn: async () =>
      (await fetch("/api/v1/hotels")).json() as Promise<{
        hotels: HotelRow[];
        currentHotelId: string | null;
        canSwitch?: boolean;
      }>,
    enabled: open && isGroup,
    staleTime: 5 * 60_000,
  });

  const switchHotel = useMutation({
    mutationFn: async (nextHotelId: string | null) => {
      const res = await fetch("/api/v1/hotels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId: nextHotelId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const body = await res.json();
      await update({
        hotelId: body.hotelId,
        hotelSlug: body.slug,
        hotelName: body.hotelName,
        currency: body.currency,
        hotelLocale: body.hotelLocale,
      });
      return body as { slug?: string | null; hotelId: string | null };
    },
    onSuccess: (body, nextHotelId) => {
      setOpen(false);
      qc.clear();
      if (nextHotelId === null) {
        window.location.href = localeAppPath(locale, "/group/dashboard");
      } else {
        const slug =
          body.slug ||
          hotels.data?.hotels.find((h) => h.id === nextHotelId)?.slug;
        if (slug) {
          window.location.href = hotelAppPath(slug, locale, "/dashboard");
        } else {
          window.location.href = `/${locale}/dashboard`;
        }
      }
    },
  });

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // HOTEL accounts: name only, never a dropdown
  if (isHotelAccount) {
    return (
      <div className="chrome-btn hidden !min-h-[2.35rem] text-right tablet:inline-flex desktop:inline-flex">
        <Building2 className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span>
          <div className="font-semibold leading-tight text-[var(--text)]">
            {session?.user?.hotelName}
          </div>
          <div className="text-[10px] font-medium text-[var(--text-dim)]">
            {session?.user?.currency}
          </div>
        </span>
      </div>
    );
  }

  // GROUP with active hotel context: show hotel + back to group
  if (isGroup && hotelId) {
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="chrome-btn !min-h-[2.35rem] text-left"
        >
          <Building2 className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span>
            <div className="font-semibold leading-tight text-[var(--text)]">
              {session?.user?.hotelName}
            </div>
            <div className="text-[10px] font-medium text-[var(--text-dim)]">
              {session?.user?.currency}
            </div>
          </span>
        </button>
        {open ? (
          <ul className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-[var(--border)] bg-[var(--card)] py-1 shadow-xl">
            <li>
              <button
                type="button"
                disabled={switchHotel.isPending}
                onClick={() => switchHotel.mutate(null)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)] disabled:opacity-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="font-medium">{t("backToGroup")}</span>
              </button>
            </li>
            {(hotels.data?.hotels ?? []).map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  disabled={switchHotel.isPending || h.id === hotelId}
                  onClick={() => switchHotel.mutate(h.id)}
                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)] disabled:opacity-50"
                >
                  <span className="font-medium">{h.name}</span>
                  <span className="text-xs text-[var(--text-dim)]">
                    {h.city ?? ""} · {h.currency}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  // GROUP without hotel: optional switcher to enter context
  if (isGroup && !hotelId) {
    const list = hotels.data?.hotels ?? [];
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="chrome-btn !min-h-[2.35rem] text-left"
        >
          <Building2 className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span>
            <div className="font-semibold leading-tight text-[var(--text)]">
              {t("groupMode")}
            </div>
            <div className="text-[10px] font-medium text-[var(--text-dim)]">
              {t("selectHotel")}
            </div>
          </span>
        </button>
        {open ? (
          <ul className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-[var(--border)] bg-[var(--card)] py-1 shadow-xl">
            {list.length === 0 && !hotels.isLoading ? (
              <li className="px-3 py-2 text-xs text-[var(--text-dim)]">
                {t("noHotels")}
              </li>
            ) : null}
            {list.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  disabled={switchHotel.isPending}
                  onClick={() => switchHotel.mutate(h.id)}
                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)] disabled:opacity-50"
                >
                  <span className="font-medium">{h.name}</span>
                  <span className="text-xs text-[var(--text-dim)]">
                    {h.city ?? ""} · {h.currency}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className="hidden text-right text-xs tablet:block desktop:block">
      <div className="font-medium text-[var(--text)]">{session?.user?.hotelName}</div>
      <div className="text-[var(--text-dim)]">{session?.user?.currency}</div>
    </div>
  );
}
