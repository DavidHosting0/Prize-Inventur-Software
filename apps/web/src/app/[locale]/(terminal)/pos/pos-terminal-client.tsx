"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { PosTerminalShell } from "@/components/pos-terminal-shell";
import { Button, Input } from "@prize/ui";
import { formatMoney, toNumber } from "@/lib/money";
import type { PosBootstrap } from "@/lib/pos-bootstrap";
import { useRouter } from "@/i18n/navigation";
import type { PaymentMethod, VoucherCode } from "@prize/types";
import { Search, Trash2, X, Gift, ShoppingBag, CreditCard, Banknote, ClipboardList, Star } from "lucide-react";
import { HardwareBarcodeInput } from "@/components/barcode";
import { Link } from "@/i18n/navigation";
import { productCreateUrl } from "@/lib/barcode-client";
import { normalizeBarcode } from "@/lib/barcode-normalize";
import type { PosProduct } from "@/lib/pos-bootstrap";

type CartItem = {
  posArticleId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  isComplimentary: boolean;
};

type DiscountMode =
  | { kind: "none" }
  | { kind: "voucher"; code: VoucherCode; percent: number }
  | { kind: "manual_percent"; percent: number }
  | { kind: "manual_amount"; amount: number };

type PayPanel =
  | null
  | { step: "choose" }
  | { step: "terminal"; method: "CARD" | "TWINT" }
  | { step: "offline"; method: "CASH" | "OFFLINE" };

type PosTerminalClientProps = {
  bootstrap: PosBootstrap;
  currency: string;
  hotelLocale: string;
};

export function PosTerminalClient({
  bootstrap,
  currency,
  hotelLocale,
}: PosTerminalClientProps) {
  const t = useTranslations("pos");
  const router = useRouter();
  const qc = useQueryClient();
  const locale = hotelLocale;
  const canDiscount = bootstrap.permissions.canDiscount;
  const canCreateProduct = bootstrap.permissions.canCreateProduct;
  const tb = useTranslations("barcode");

  const [categoryId, setCategoryId] = useState("");
  const [q, setQ] = useState("");
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<DiscountMode>({ kind: "none" });
  const [manualPercentInput, setManualPercentInput] = useState("");
  const [manualAmountInput, setManualAmountInput] = useState("");
  const [freeReason, setFreeReason] = useState("");
  const [freeReasonCustom, setFreeReasonCustom] = useState(false);
  const [freeReasonMenuOpen, setFreeReasonMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [productFocus, setProductFocus] = useState(0);
  const [favoritesOnly, setFavoritesOnly] = useState(true);
  const [payPanel, setPayPanel] = useState<PayPanel>(null);
  const [payReference, setPayReference] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [recipeGuide, setRecipeGuide] = useState<{
    name: string;
    instructions: string;
  } | null>(null);
  const [products, setProducts] = useState<PosProduct[]>(bootstrap.products);
  const [tileMenu, setTileMenu] = useState<{
    productId: string;
    name: string;
    isFavorite: boolean;
    x: number;
    y: number;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const longPressRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    triggered: boolean;
    startX: number;
    startY: number;
  }>({ timer: null, triggered: false, startX: 0, startY: 0 });

  useEffect(() => {
    setProducts(bootstrap.products);
  }, [bootstrap.products]);

  useEffect(() => {
    if (!tileMenu) return;
    const close = () => setTileMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [tileMenu]);

  const sortedCategories = useMemo(
    () =>
      [...bootstrap.categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [bootstrap.categories]
  );

  const sellableProducts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = products;
    if (categoryId) {
      list = list.filter((p) => p.categoryId === categoryId);
    }
    if (favoritesOnly && !categoryId && !needle) {
      const favs = list.filter((p) => p.isFavorite);
      if (favs.length > 0) list = favs;
    }
    if (needle) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          (p.sku?.toLowerCase().includes(needle) ?? false) ||
          (p.barcode?.toLowerCase().includes(needle) ?? false)
      );
    }
    return list;
  }, [products, favoritesOnly, q, categoryId]);

  useEffect(() => {
    setProductFocus(0);
  }, [categoryId, q, favoritesOnly]);

  const lineSubtotal = useMemo(
    () =>
      cart.reduce((s, i) => {
        if (i.isComplimentary) return s;
        return s + i.unitPrice * i.quantity;
      }, 0),
    [cart]
  );

  const orderDiscountAmount = useMemo(() => {
    if (discount.kind === "voucher" || discount.kind === "manual_percent") {
      return lineSubtotal * (discount.percent / 100);
    }
    if (discount.kind === "manual_amount") {
      return Math.min(discount.amount, lineSubtotal);
    }
    return 0;
  }, [discount, lineSubtotal]);

  const total = Math.max(0, lineSubtotal - orderDiscountAmount);
  const hasComplimentary = cart.some((i) => i.isComplimentary);

  /** Effective multiplier for non-free lines (voucher / % / amount). */
  const discountFactor = useMemo(() => {
    if (discount.kind === "voucher" || discount.kind === "manual_percent") {
      return Math.max(0, 1 - discount.percent / 100);
    }
    if (discount.kind === "manual_amount" && lineSubtotal > 0) {
      return Math.max(
        0,
        1 - Math.min(discount.amount, lineSubtotal) / lineSubtotal
      );
    }
    return 1;
  }, [discount, lineSubtotal]);

  const showLineDiscount = discountFactor < 1 - 1e-9;

  useEffect(() => {
    const focusBarcode = () => {
      document.querySelector<HTMLInputElement>("[data-pos-barcode]")?.focus();
    };
    focusBarcode();
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "F2") {
        e.preventDefault();
        focusBarcode();
        document.querySelector<HTMLInputElement>("[data-pos-barcode]")?.select();
        return;
      }
      if (e.key === "F4" && !typing && cart.length) {
        e.preventDefault();
        setPayPanel({ step: "offline", method: "CASH" });
        return;
      }
      if (e.key === "F5" && !typing && cart.length) {
        e.preventDefault();
        setPayPanel({ step: "terminal", method: "CARD" });
        return;
      }
      if (e.key === "Escape" && !typing) {
        e.preventDefault();
        if (payPanel) {
          setPayPanel(null);
          return;
        }
        if (recipeGuide) {
          setRecipeGuide(null);
          return;
        }
        setCart([]);
        setDiscount({ kind: "none" });
        setError(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart.length, payPanel, recipeGuide]);

  function selectCategory(id: string, favorites: boolean) {
    setCategoryId(id);
    setFavoritesOnly(favorites);
    setProductFocus(0);
  }

  function addProduct(p: {
    id: string;
    posArticleId?: string;
    name: string;
    salePrice: string;
    isActive: boolean;
  }) {
    if (!p.isActive || toNumber(p.salePrice) <= 0) return;
    const posArticleId = p.posArticleId ?? p.id;
    setCart((prev) => {
      const existing = prev.find((i) => i.posArticleId === posArticleId);
      if (existing) {
        return prev.map((i) =>
          i.posArticleId === posArticleId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          posArticleId,
          name: p.name,
          unitPrice: toNumber(p.salePrice),
          quantity: 1,
          isComplimentary: false,
        },
      ];
    });
    setError(null);
  }

  function toggleComplimentary(posArticleId: string) {
    if (!canDiscount) {
      setError(t("discountForbidden"));
      return;
    }
    setCart((prev) => {
      const next = prev.map((i) =>
        i.posArticleId === posArticleId
          ? { ...i, isComplimentary: !i.isComplimentary }
          : i
      );
      const anyFree = next.some((i) => i.isComplimentary);
      if (anyFree) {
        setDiscount({ kind: "none" });
        setManualPercentInput("");
        setManualAmountInput("");
        // Open reason picker if none chosen yet
        if (!freeReason.trim()) {
          setFreeReasonMenuOpen(true);
        }
      }
      if (!anyFree) {
        setFreeReason("");
        setFreeReasonCustom(false);
        setFreeReasonMenuOpen(false);
      }
      return next;
    });
    setError(null);
  }

  function confirmFreeReason(reason: string) {
    const trimmed = reason.trim();
    if (!trimmed) return;
    setFreeReason(trimmed);
    setFreeReasonCustom(false);
    setFreeReasonMenuOpen(false);
    setError(null);
  }

  async function lookupBarcode(raw: string) {
    const code = normalizeBarcode(raw);
    if (!code) return;
    setUnknownBarcode(null);

    const local = bootstrap.products.find(
      (p) =>
        p.isActive &&
        (p.barcode?.toLowerCase() === code.toLowerCase() ||
          p.sku?.toLowerCase() === code.toLowerCase())
    );
    if (local) {
      addProduct(local);
      document.querySelector<HTMLInputElement>("[data-pos-barcode]")?.focus();
      return;
    }

    try {
      const res = await fetch(
        `/api/v1/pos/barcode/${encodeURIComponent(code)}`
      );
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        addProduct(body);
        document.querySelector<HTMLInputElement>("[data-pos-barcode]")?.focus();
        return;
      }
      if (body?.code === "PRODUCT_INACTIVE") {
        setError(tb("productInactive"));
        document.querySelector<HTMLInputElement>("[data-pos-barcode]")?.focus();
        return;
      }
      setUnknownBarcode(code);
      setError(tb("productNotFound"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
      document.querySelector<HTMLInputElement>("[data-pos-barcode]")?.focus();
    }
  }

  function applyVoucher(code: VoucherCode, percent: number) {
    if (!canDiscount) {
      setError(t("discountForbidden"));
      return;
    }
    if (discount.kind === "voucher" && discount.code === code) {
      setDiscount({ kind: "none" });
      setError(null);
      return;
    }
    setDiscount({ kind: "voucher", code, percent });
    setManualPercentInput("");
    setManualAmountInput("");
    setError(null);
  }

  function clearLongPressTimer() {
    if (longPressRef.current.timer != null) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current.timer = null;
    }
  }

  function openTileMenu(
    p: PosProduct,
    clientX: number,
    clientY: number
  ) {
    const pad = 8;
    const menuW = 220;
    const menuH = 56;
    const x = Math.min(
      Math.max(pad, clientX),
      (typeof window !== "undefined" ? window.innerWidth : 400) - menuW - pad
    );
    const y = Math.min(
      Math.max(pad, clientY),
      (typeof window !== "undefined" ? window.innerHeight : 400) - menuH - pad
    );
    setTileMenu({
      productId: p.id,
      name: p.name,
      isFavorite: p.isFavorite,
      x,
      y,
    });
  }

  async function toggleFavorite(productId: string, isFavorite: boolean) {
    setTileMenu(null);
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isFavorite } : p))
    );
    try {
      const res = await fetch(`/api/v1/pos/articles/${productId}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setError(null);
    } catch (e) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, isFavorite: !isFavorite } : p
        )
      );
      setError(e instanceof Error ? e.message : "Favorite failed");
    }
  }

  function applyManualPercent() {
    if (!canDiscount) {
      setError(t("discountForbidden"));
      return;
    }
    const pct = Math.min(100, Math.max(0, Number(manualPercentInput) || 0));
    setDiscount(pct > 0 ? { kind: "manual_percent", percent: pct } : { kind: "none" });
    setManualAmountInput("");
    setError(null);
  }

  function applyManualAmount() {
    if (!canDiscount) {
      setError(t("discountForbidden"));
      return;
    }
    const amt = Math.max(0, Number(manualAmountInput) || 0);
    setDiscount(amt > 0 ? { kind: "manual_amount", amount: amt } : { kind: "none" });
    setManualPercentInput("");
    setError(null);
  }

  const payMutation = useMutation({
    mutationFn: async (payload: {
      method: PaymentMethod;
      reference?: string | null;
      notes?: string | null;
    }) => {
      if (cart.length === 0) throw new Error("Empty cart");
      setPaying(true);
      setError(null);

      const body: Record<string, unknown> = {
        items: cart.map((i) => ({
          posArticleId: i.posArticleId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          isComplimentary: i.isComplimentary || undefined,
          discountPercent: i.isComplimentary ? 100 : undefined,
        })),
      };

      if (discount.kind === "voucher") {
        body.voucherCode = discount.code;
        body.discountPercent = discount.percent;
        body.discountType = `VOUCHER_${discount.code}`;
      } else if (discount.kind === "manual_percent") {
        body.discountPercent = discount.percent;
        body.discountType = "MANUAL";
      } else if (discount.kind === "manual_amount") {
        body.discountAmount = discount.amount;
        body.discountType = "MANUAL";
      }

      if (hasComplimentary) {
        body.discountType =
          discount.kind === "none" && total === 0 ? "FREE_ITEM" : body.discountType ?? "FREE_ITEM";
        const reason = freeReason.trim();
        if (!reason) {
          throw new Error(t("freeReasonRequired"));
        }
        body.discountReason = reason;
      }

      const createRes = await fetch("/api/v1/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!createRes.ok) {
        throw new Error((await createRes.json()).error ?? "Create failed");
      }
      const sale = await createRes.json();
      const payRes = await fetch(`/api/v1/sales/${sale.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pay",
          method: payload.method,
          reference: payload.reference ?? null,
          notes: payload.notes ?? null,
          amount: Number(sale.total) === 0 ? 0 : undefined,
        }),
      });
      if (!payRes.ok) {
        throw new Error((await payRes.json()).error ?? "Payment failed");
      }
      return payRes.json();
    },
    onSuccess: (sale) => {
      setCart([]);
      setDiscount({ kind: "none" });
      setManualPercentInput("");
      setManualAmountInput("");
      setFreeReason("");
      setFreeReasonCustom(false);
      setPayPanel(null);
      setPayReference("");
      setPayNotes("");
      setPaying(false);
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      router.push(`/pos/receipt/${sale.id}`);
    },
    onError: (e: Error) => {
      setPaying(false);
      setError(e.message);
    },
  });

  function confirmPay() {
    if (!payPanel || payPanel.step === "choose") return;
    if (payPanel.step === "terminal") {
      payMutation.mutate({
        method: payPanel.method,
        reference: payReference.trim() || null,
      });
      return;
    }
    payMutation.mutate({
      method: payPanel.method,
      notes:
        payPanel.method === "OFFLINE"
          ? payNotes.trim() || t("offlineDefaultNote")
          : payNotes.trim() || null,
      reference: payPanel.method === "OFFLINE" ? payNotes.trim() || t("offlineDefaultNote") : null,
    });
  }

  const activeVoucher =
    discount.kind === "voucher" ? discount.code : null;

  return (
    <PosTerminalShell title={t("terminalTitle")}>
      <div className="grid h-full grid-cols-1 desktop:grid-cols-[1fr_min(440px,40vw)]">
        <section className="pos-catalog flex min-h-0 flex-col border-r border-[var(--border)] p-3 desktop:p-5">
          <div className="pos-cat-row">
            <CatChip
              active={!categoryId && !favoritesOnly}
              onClick={() => selectCategory("", false)}
              label={t("all")}
            />
            <CatChip
              active={favoritesOnly && !categoryId}
              onClick={() => selectCategory("", true)}
              label={t("favorites")}
            />
            {sortedCategories.map((c) => (
              <CatChip
                key={c.id}
                active={categoryId === c.id}
                onClick={() => selectCategory(c.id, false)}
                label={c.name}
              />
            ))}
          </div>

          <div className="mb-4 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
              <Input
                className="h-12 rounded-xl border-[var(--border)] bg-white pl-11 text-base shadow-[var(--shadow-sm)] text-[var(--text)]"
                placeholder={t("searchProducts")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <HardwareBarcodeInput
              className="h-12 max-w-[220px] rounded-xl border-[var(--border)] bg-white font-mono text-base shadow-[var(--shadow-sm)] text-[var(--text)]"
              placeholder={t("scanBarcode")}
              dataName="pos-barcode"
              autoFocus
              onScan={lookupBarcode}
            />
          </div>
          {unknownBarcode ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--danger)]/35 bg-[var(--danger-muted)] px-3 py-2.5 text-sm text-[var(--danger)]">
              <span>
                {tb("productNotFound")}:{" "}
                <span className="font-mono font-semibold">{unknownBarcode}</span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setQ(unknownBarcode);
                  setUnknownBarcode(null);
                  setError(null);
                  document
                    .querySelector<HTMLInputElement>(
                      'input[placeholder="' + t("searchProducts") + '"]'
                    )
                    ?.focus();
                }}
              >
                {tb("searchManually")}
              </Button>
              {canCreateProduct ? (
                <Link
                  href={productCreateUrl({
                    barcode: unknownBarcode,
                    returnTo: "/pos",
                  })}
                >
                  <Button size="sm" variant="secondary">
                    {tb("createProduct")}
                  </Button>
                </Link>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setUnknownBarcode(null);
                  setError(null);
                  document
                    .querySelector<HTMLInputElement>("[data-pos-barcode]")
                    ?.focus();
                }}
              >
                {tb("cancel")}
              </Button>
            </div>
          ) : null}

          <div
            ref={gridRef}
            className="min-h-0 flex-1 overflow-y-auto pr-1"
            role="listbox"
            aria-label="Products"
            onKeyDown={(e) => {
              const cols =
                typeof window !== "undefined" && window.innerWidth >= 1280
                  ? 4
                  : window.innerWidth >= 1024
                    ? 3
                    : 2;
              const max = sellableProducts.length - 1;
              if (max < 0) return;
              let next = productFocus;
              if (e.key === "ArrowRight") next = Math.min(max, productFocus + 1);
              if (e.key === "ArrowLeft") next = Math.max(0, productFocus - 1);
              if (e.key === "ArrowDown")
                next = Math.min(max, productFocus + cols);
              if (e.key === "ArrowUp")
                next = Math.max(0, productFocus - cols);
              if (
                ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(
                  e.key
                )
              ) {
                e.preventDefault();
                setProductFocus(next);
                gridRef.current
                  ?.querySelector<HTMLElement>(`[data-kbd-index="${next}"]`)
                  ?.focus();
              }
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                const p = sellableProducts[productFocus];
                if (p) addProduct(p);
              }
            }}
          >
            {sellableProducts.length === 0 ? (
              <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-white/70 px-6 text-center text-sm text-[var(--text-muted)]">
                {t("cartEmpty")}
              </div>
            ) : (
              <div className="pos-tile-grid">
                {sellableProducts.map((p, idx) => (
                  <div key={p.id} className="relative">
                    <button
                      type="button"
                      role="option"
                      data-kbd-index={idx}
                      data-active={idx === productFocus ? "true" : "false"}
                      aria-selected={idx === productFocus}
                      tabIndex={idx === productFocus ? 0 : -1}
                      onFocus={() => setProductFocus(idx)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openTileMenu(p, e.clientX, e.clientY);
                      }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        longPressRef.current.triggered = false;
                        longPressRef.current.startX = e.clientX;
                        longPressRef.current.startY = e.clientY;
                        clearLongPressTimer();
                        longPressRef.current.timer = setTimeout(() => {
                          longPressRef.current.triggered = true;
                          openTileMenu(p, e.clientX, e.clientY);
                        }, 480);
                      }}
                      onPointerMove={(e) => {
                        if (longPressRef.current.timer == null) return;
                        const dx = e.clientX - longPressRef.current.startX;
                        const dy = e.clientY - longPressRef.current.startY;
                        if (dx * dx + dy * dy > 100) clearLongPressTimer();
                      }}
                      onPointerUp={() => clearLongPressTimer()}
                      onPointerCancel={() => clearLongPressTimer()}
                      onClick={() => {
                        if (longPressRef.current.triggered) {
                          longPressRef.current.triggered = false;
                          return;
                        }
                        addProduct(p);
                      }}
                      className="pos-tile"
                    >
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="pos-tile-image"
                        />
                      ) : null}
                      <div
                        className="pos-tile-body"
                        data-has-guide={
                          p.type === "RECIPE" && p.instructions
                            ? "true"
                            : undefined
                        }
                      >
                        <div>
                          <div className="pos-tile-meta">
                            <span>
                              {p.type === "RECIPE"
                                ? t("recipeItem")
                                : t("productItem")}
                            </span>
                            {p.isFavorite ? <span aria-hidden>· ★</span> : null}
                          </div>
                          <div className="pos-tile-name">{p.name}</div>
                        </div>
                        <div className="pos-tile-footer">
                          <div className="pos-tile-price">
                            {formatMoney(p.salePrice, currency, locale)}
                          </div>
                          {p.sku ? (
                            <div className="pos-tile-sku">{p.sku}</div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                    {p.type === "RECIPE" && p.instructions ? (
                      <button
                        type="button"
                        className="pos-tile-guide"
                        aria-label={t("viewRecipeGuide")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRecipeGuide({
                            name: p.name,
                            instructions: p.instructions!,
                          });
                        }}
                      >
                        <ClipboardList className="pos-tile-guide-icon" aria-hidden />
                        <span>{t("guideShort")}</span>
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--border-subtle)] bg-white/80 px-3 py-2 text-[11px] text-[var(--text-dim)]">
            <span>
              <kbd className="kbd">F2</kbd> Barcode
            </span>
            <span>
              <kbd className="kbd">F4</kbd> {t("cash")}
            </span>
            <span>
              <kbd className="kbd">F5</kbd> {t("card")}
            </span>
            <span>
              <kbd className="kbd">Esc</kbd> {t("clearCart")}
            </span>
            <span className="ml-auto font-medium text-[var(--text-muted)]">
              {sellableProducts.length} {t("articlesShown")}
            </span>
          </div>
        </section>

        <aside className="pos-cart flex min-h-0 flex-col border-l border-[var(--border)] p-3 desktop:p-4">
          <div className="pos-cart-header">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-[var(--text-muted)]" />
              <div>
                <div className="text-[15px] font-semibold tracking-tight text-[var(--text)]">
                  {t("cart")}
                </div>
                <div className="text-[11px] text-[var(--text-dim)]">
                  {cart.reduce((s, i) => s + i.quantity, 0)} {t("positions")}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => {
                setCart([]);
                setDiscount({ kind: "none" });
              }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-2.5 text-xs font-semibold text-[var(--text-muted)] hover:border-[var(--danger)] hover:bg-[var(--danger-muted)] hover:text-[var(--danger)] disabled:opacity-35"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("clearCart")}
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--pos-surface)] px-3 py-12 text-center text-sm text-[var(--text-dim)]">
                {t("cartEmpty")}
              </div>
            ) : (
              cart.map((item) => {
                const grossUnit = item.unitPrice;
                const grossLine = item.unitPrice * item.quantity;
                const netUnit = item.isComplimentary
                  ? 0
                  : grossUnit * discountFactor;
                const netLine = item.isComplimentary
                  ? 0
                  : grossLine * discountFactor;
                const lineHasDiscount =
                  !item.isComplimentary && showLineDiscount;

                return (
                <div
                  key={item.posArticleId}
                  data-free={item.isComplimentary ? "true" : "false"}
                  className="pos-line"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold text-[var(--text)]">
                        {item.name}
                        {item.isComplimentary ? (
                          <span className="ml-2 rounded bg-[var(--success-muted)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--success)]">
                            {t("free")}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs">
                        {lineHasDiscount ? (
                          <>
                            <span className="tabular-nums text-[var(--text-dim)] line-through">
                              {formatMoney(grossUnit, currency, locale)}
                            </span>
                            <span className="font-semibold tabular-nums text-[var(--pos-accent)]">
                              {formatMoney(netUnit, currency, locale)}
                            </span>
                          </>
                        ) : (
                          <span className="tabular-nums text-[var(--text-dim)]">
                            {formatMoney(grossUnit, currency, locale)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-28 text-right">
                      {lineHasDiscount ? (
                        <>
                          <div className="text-xs tabular-nums text-[var(--text-dim)] line-through">
                            {formatMoney(grossLine, currency, locale)}
                          </div>
                          <div className="text-[15px] font-bold tabular-nums text-[var(--pos-accent)]">
                            {formatMoney(netLine, currency, locale)}
                          </div>
                        </>
                      ) : (
                        <div className="text-[15px] font-bold tabular-nums text-[var(--text)]">
                          {formatMoney(netLine, currency, locale)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <QtyBtn
                      onClick={() =>
                        setCart((prev) =>
                          prev
                            .map((i) =>
                              i.posArticleId === item.posArticleId
                                ? { ...i, quantity: i.quantity - 1 }
                                : i
                            )
                            .filter((i) => i.quantity > 0)
                        )
                      }
                    >
                      −
                    </QtyBtn>
                    <span className="w-9 text-center text-base font-bold tabular-nums text-[var(--text)]">
                      {item.quantity}
                    </span>
                    <QtyBtn
                      onClick={() =>
                        setCart((prev) =>
                          prev.map((i) =>
                            i.posArticleId === item.posArticleId
                              ? { ...i, quantity: i.quantity + 1 }
                              : i
                          )
                        )
                      }
                    >
                      +
                    </QtyBtn>
                    {canDiscount ? (
                      <button
                        type="button"
                        onClick={() => toggleComplimentary(item.posArticleId)}
                        className={
                          item.isComplimentary
                            ? "ml-auto inline-flex h-10 items-center gap-1 rounded-lg bg-[var(--success-muted)] px-3 text-xs font-bold text-[var(--success)]"
                            : "ml-auto inline-flex h-10 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--card-hover)]"
                        }
                        title={t("freeArticle")}
                      >
                        <Gift className="h-3.5 w-3.5" />
                        {t("free")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setCart((prev) => {
                          const next = prev.filter(
                            (i) => i.posArticleId !== item.posArticleId
                          );
                          if (!next.some((i) => i.isComplimentary)) {
                            setFreeReason("");
                            setFreeReasonCustom(false);
                            setFreeReasonMenuOpen(false);
                          }
                          return next;
                        });
                      }}
                      className={
                        canDiscount
                          ? "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--danger,#b91c1c)] hover:bg-red-50"
                          : "ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--danger,#b91c1c)] hover:bg-red-50"
                      }
                      title={t("remove")}
                      aria-label={t("remove")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                );
              })
            )}
          </div>

          <div className="mt-3 shrink-0 space-y-3 border-t border-[var(--border-subtle)] pt-3">
            {canDiscount ? (
              <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--pos-surface)]/80 p-3">
                {hasComplimentary &&
                (freeReasonMenuOpen || !freeReason.trim()) ? (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                        {t("freeReason")}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(bootstrap.complimentaryReasons ?? []).map(
                          (reason) => (
                            <button
                              key={reason}
                              type="button"
                              onClick={() => confirmFreeReason(reason)}
                              className={
                                !freeReasonCustom && freeReason === reason
                                  ? "min-h-11 rounded-xl bg-[var(--pos-accent)] px-3 py-2 text-sm font-bold text-white"
                                  : "min-h-11 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--card-hover)]"
                              }
                            >
                              {reason}
                            </button>
                          )
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setFreeReasonCustom(true);
                            setFreeReason("");
                            setFreeReasonMenuOpen(true);
                          }}
                          className={
                            freeReasonCustom
                              ? "min-h-11 rounded-xl bg-[var(--pos-accent)] px-3 py-2 text-sm font-bold text-white"
                              : "min-h-11 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--card-hover)]"
                          }
                        >
                          {t("freeReasonOther")}
                        </button>
                      </div>
                      {freeReasonCustom ? (
                        <Input
                          className="h-11 rounded-lg border-[var(--border)] bg-white text-[var(--text)]"
                          placeholder={t("freeReasonCustom")}
                          value={freeReason}
                          autoFocus
                          onChange={(e) => setFreeReason(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              confirmFreeReason(freeReason);
                            }
                          }}
                        />
                      ) : null}
                    </div>
                ) : (
                  <>
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                      {t("vouchers")}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {bootstrap.vouchers.map((v) => (
                        <button
                          key={v.code}
                          type="button"
                          disabled={cart.length === 0}
                          onClick={() =>
                            applyVoucher(v.code, v.discountPercent)
                          }
                          className={
                            activeVoucher === v.code
                              ? "min-h-12 rounded-xl bg-[var(--pos-accent)] px-2 text-sm font-bold text-white shadow-md"
                              : "min-h-12 rounded-xl border border-[var(--border)] bg-white px-2 text-sm font-semibold text-[var(--text)] shadow-sm hover:bg-[var(--card-hover)] disabled:opacity-40"
                          }
                        >
                          {v.name}
                          <span className="mt-0.5 block text-[10px] font-medium opacity-80">
                            −{v.discountPercent}%
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="h-11 rounded-lg border-[var(--border)] bg-white text-[var(--text)]"
                          placeholder={t("manualPercent")}
                          value={manualPercentInput}
                          onChange={(e) =>
                            setManualPercentInput(e.target.value)
                          }
                          onBlur={applyManualPercent}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") applyManualPercent();
                          }}
                        />
                        <button
                          type="button"
                          onClick={applyManualPercent}
                          className="h-11 shrink-0 rounded-lg border border-[var(--border)] bg-white px-2.5 text-xs font-bold text-[var(--text)] hover:bg-[var(--card-hover)]"
                        >
                          %
                        </button>
                      </div>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          min={0}
                          step="0.05"
                          className="h-11 rounded-lg border-[var(--border)] bg-white text-[var(--text)]"
                          placeholder={t("manualAmount")}
                          value={manualAmountInput}
                          onChange={(e) => setManualAmountInput(e.target.value)}
                          onBlur={applyManualAmount}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") applyManualAmount();
                          }}
                        />
                        <button
                          type="button"
                          onClick={applyManualAmount}
                          className="h-11 shrink-0 rounded-lg border border-[var(--border)] bg-white px-2.5 text-xs font-bold text-[var(--text)] hover:bg-[var(--card-hover)]"
                        >
                          {currency}
                        </button>
                      </div>
                    </div>
                    {discount.kind !== "none" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setDiscount({ kind: "none" });
                          setManualPercentInput("");
                          setManualAmountInput("");
                        }}
                        className="text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--danger)]"
                      >
                        {t("clearDiscount")}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            <div className="pos-total-panel">
              {orderDiscountAmount > 0 ? (
                <div className="mb-2 flex justify-between text-sm text-white/65">
                  <span>{t("discount")}</span>
                  <span>
                    −{formatMoney(orderDiscountAmount, currency, locale)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-end justify-between gap-3">
                <span className="text-[12px] font-medium text-white/65">
                  {t("totalDue")}
                </span>
                <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                  {formatMoney(total, currency, locale)}
                </span>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl bg-[var(--danger-muted)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5">
              <Button
                disabled={paying || cart.length === 0}
                className="pos-pay-primary h-[4.25rem] gap-2 text-base font-bold"
                onClick={() => setPayPanel({ step: "choose" })}
              >
                <CreditCard className="h-5 w-5" />
                {t("payTerminal")}
              </Button>
              <Button
                disabled={paying || cart.length === 0}
                variant="secondary"
                className="pos-pay-secondary h-[4.25rem] gap-2 text-base font-bold"
                onClick={() => setPayPanel({ step: "offline", method: "CASH" })}
              >
                <Banknote className="h-5 w-5" />
                {t("payOffline")}
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {payPanel ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-[2px] desktop:items-center">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-white text-[var(--text)] shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
            <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3.5 text-white">
              <h3 className="text-lg font-semibold">
                {payPanel.step === "choose"
                  ? t("choosePayment")
                  : payPanel.step === "terminal"
                    ? t("terminalPayment")
                    : t("offlinePayment")}
              </h3>
              <button
                type="button"
                onClick={() => setPayPanel(null)}
                className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              {payPanel.step === "choose" ? (
                <div className="grid gap-2.5">
                  <BigChoice
                    label={t("card")}
                    onClick={() =>
                      setPayPanel({ step: "terminal", method: "CARD" })
                    }
                  />
                  <BigChoice
                    label={t("twint")}
                    onClick={() =>
                      setPayPanel({ step: "terminal", method: "TWINT" })
                    }
                  />
                  <BigChoice
                    label={t("payOffline")}
                    onClick={() =>
                      setPayPanel({ step: "offline", method: "CASH" })
                    }
                  />
                </div>
              ) : null}

              {payPanel.step === "terminal" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPayPanel({ step: "terminal", method: "CARD" })
                      }
                      className={
                        payPanel.method === "CARD"
                          ? "min-h-14 rounded-xl bg-[var(--pos-pay)] font-bold text-white shadow-md"
                          : "min-h-14 rounded-xl border border-[var(--border)] bg-white font-semibold text-[var(--text)] hover:bg-[var(--card-hover)]"
                      }
                    >
                      {t("card")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPayPanel({ step: "terminal", method: "TWINT" })
                      }
                      className={
                        payPanel.method === "TWINT"
                          ? "min-h-14 rounded-xl bg-[var(--pos-pay)] font-bold text-white shadow-md"
                          : "min-h-14 rounded-xl border border-[var(--border)] bg-white font-semibold text-[var(--text)] hover:bg-[var(--card-hover)]"
                      }
                    >
                      {t("twint")}
                    </button>
                  </div>
                  <Input
                    className="h-12 rounded-xl border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)]"
                    placeholder={t("terminalReference")}
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                  />
                  <div className="rounded-xl bg-[var(--pos-surface)] px-3 py-2.5 text-sm text-[var(--text-muted)]">
                    {t("totalDue")}:{" "}
                    <strong className="text-base text-[var(--text)]">
                      {formatMoney(total, currency, locale)}
                    </strong>
                  </div>
                  <Button
                    className="pos-pay-primary h-14 w-full text-base font-bold"
                    disabled={paying}
                    onClick={confirmPay}
                  >
                    {paying ? "…" : t("completePayment")}
                  </Button>
                </div>
              ) : null}

              {payPanel.step === "offline" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPayPanel({ step: "offline", method: "CASH" })
                      }
                      className={
                        payPanel.method === "CASH"
                          ? "min-h-14 rounded-xl bg-[var(--pos-accent)] font-bold text-white shadow-md"
                          : "min-h-14 rounded-xl border border-[var(--border)] bg-white font-semibold text-[var(--text)] hover:bg-[var(--card-hover)]"
                      }
                    >
                      {t("cash")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPayPanel({ step: "offline", method: "OFFLINE" })
                      }
                      className={
                        payPanel.method === "OFFLINE"
                          ? "min-h-14 rounded-xl bg-[var(--pos-accent)] font-bold text-white shadow-md"
                          : "min-h-14 rounded-xl border border-[var(--border)] bg-white font-semibold text-[var(--text)] hover:bg-[var(--card-hover)]"
                      }
                    >
                      {t("offlineSettle")}
                    </button>
                  </div>
                  {payPanel.method === "OFFLINE" ? (
                    <Input
                      className="h-12 rounded-xl border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)]"
                      placeholder={t("offlineNote")}
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                    />
                  ) : null}
                  <div className="rounded-xl bg-[var(--pos-surface)] px-3 py-2.5 text-sm text-[var(--text-muted)]">
                    {t("totalDue")}:{" "}
                    <strong className="text-base text-[var(--text)]">
                      {formatMoney(total, currency, locale)}
                    </strong>
                  </div>
                  <Button
                    className="h-14 w-full bg-[var(--pos-accent)] text-base font-bold hover:bg-[var(--pos-accent-hover)]"
                    disabled={paying}
                    onClick={confirmPay}
                  >
                    {paying ? "…" : t("completePayment")}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {recipeGuide ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 desktop:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pos-recipe-guide-title"
          onClick={() => setRecipeGuide(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                  {t("recipeGuide")}
                </div>
                <h2
                  id="pos-recipe-guide-title"
                  className="text-lg font-semibold text-[var(--text)]"
                >
                  {recipeGuide.name}
                </h2>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--card-hover)]"
                aria-label={t("close")}
                onClick={() => setRecipeGuide(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--text)]">
                {recipeGuide.instructions}
              </pre>
            </div>
            <div className="border-t border-[var(--border)] px-4 py-3">
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => setRecipeGuide(null)}
              >
                {t("close")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {tileMenu ? (
        <div
          className="pos-tile-context-menu"
          style={{ left: tileMenu.x, top: tileMenu.y }}
          role="menu"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="pos-tile-context-item"
            onClick={() =>
              toggleFavorite(tileMenu.productId, !tileMenu.isFavorite)
            }
          >
            <Star
              className="h-4 w-4"
              fill={tileMenu.isFavorite ? "currentColor" : "none"}
            />
            {tileMenu.isFavorite ? t("removeFavorite") : t("addFavorite")}
          </button>
        </div>
      ) : null}
    </PosTerminalShell>
  );
}

function CatChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active ? "true" : "false"}
      className="pos-cat-chip"
    >
      {label}
    </button>
  );
}

function QtyBtn({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-lg font-semibold text-[var(--text)] shadow-sm hover:bg-[var(--card-hover)] active:scale-95"
    >
      {children}
    </button>
  );
}

function BigChoice({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[4.25rem] rounded-xl border border-[var(--border)] bg-[var(--pos-surface)] text-base font-bold text-[var(--text)] shadow-sm transition hover:border-[var(--pos-accent)]/40 hover:bg-white"
    >
      {label}
    </button>
  );
}
