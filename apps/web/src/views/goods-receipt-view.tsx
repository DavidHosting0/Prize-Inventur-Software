"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Camera, ScanLine } from "lucide-react";
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
import { toNumber } from "@/lib/money";
import { FormSplitLayout } from "@/components/form-split-layout";
import { DataTablePanel } from "@/components/data-table-panel";
import { InlineAlert } from "@/components/inline-alert";
import { Link } from "@/i18n/navigation";
import {
  HardwareBarcodeInput,
  CameraBarcodeScanner,
  ScanQtyControls,
  BarcodeResolvePanel,
  UnknownBarcodeActions,
} from "@/components/barcode";
import {
  resolveBarcode,
  type ResolvedBarcodeProduct,
} from "@/lib/barcode-client";

const GR_DRAFT_KEY = "prize-gr-draft";

type Line = {
  productId: string;
  name: string;
  barcode?: string | null;
  qtyOrdered: number;
  qtyDelivered: number;
  qtyDamaged: number;
  purchasePrice: number;
  trackLiquid?: boolean;
  bottleContentMl?: number | null;
};

type GrDraft = {
  supplierId: string;
  deliveryNoteNo: string;
  lines: Line[];
};

function loadDraft(): GrDraft | null {
  try {
    const raw = sessionStorage.getItem(GR_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GrDraft;
  } catch {
    return null;
  }
}

function saveDraft(draft: GrDraft) {
  try {
    sessionStorage.setItem(GR_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export default function GoodsReceiptPage() {
  const t = useTranslations("goodsReceipt");
  const tb = useTranslations("barcode");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const qc = useQueryClient();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const canCreate =
    session?.user?.roleCode === "ADMIN" ||
    (session?.user?.permissions ?? []).includes("products.create");

  const [supplierId, setSupplierId] = useState("");
  const [deliveryNoteNo, setDeliveryNoteNo] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pending, setPending] = useState<{
    product: ResolvedBarcodeProduct;
    qty: number;
  } | null>(null);
  const restoredRef = useRef(false);
  const createdHandledRef = useRef<string | null>(null);

  const list = useQuery({
    queryKey: ["goods-receipts"],
    queryFn: async () => (await fetch("/api/v1/goods-receipts")).json(),
  });
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await fetch("/api/v1/suppliers")).json(),
  });

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const draft = loadDraft();
    if (!draft) return;
    setSupplierId(draft.supplierId);
    setDeliveryNoteNo(draft.deliveryNoteNo);
    setLines(draft.lines);
  }, []);

  useEffect(() => {
    saveDraft({
      supplierId,
      deliveryNoteNo,
      lines,
    });
  }, [supplierId, deliveryNoteNo, lines]);

  const addProductLine = useCallback(
    (p: ResolvedBarcodeProduct, qtyDelivered = 1) => {
      setLines((prev) => {
        const existing = prev.find((l) => l.productId === p.id);
        if (existing) {
          return prev.map((l) =>
            l.productId === p.id
              ? {
                  ...l,
                  qtyDelivered: l.qtyDelivered + qtyDelivered,
                  qtyOrdered: Math.max(
                    l.qtyOrdered,
                    l.qtyDelivered + qtyDelivered
                  ),
                }
              : l
          );
        }
        return [
          ...prev,
          {
            productId: p.id,
            name: p.name,
            barcode: p.barcode ?? p.ean ?? null,
            qtyOrdered: qtyDelivered,
            qtyDelivered,
            qtyDamaged: 0,
            purchasePrice: toNumber(p.purchasePrice),
            trackLiquid: Boolean(p.trackLiquid),
            bottleContentMl: p.bottleContentMl != null ? toNumber(p.bottleContentMl) : null,
          },
        ];
      });
      setUnknownCode(null);
      setError(null);
      setPending(null);
    },
    []
  );

  // Resume after product create
  useEffect(() => {
    const createdIdParam = searchParams.get("createdProductId");
    if (!createdIdParam) return;
    if (createdHandledRef.current === createdIdParam) return;
    createdHandledRef.current = createdIdParam;
    (async () => {
      const res = await fetch(`/api/v1/products/${createdIdParam}`);
      if (!res.ok) return;
      const p = await res.json();
      addProductLine(p, 1);
    })();
  }, [searchParams, addProductLine]);

  async function onScan(code: string) {
    setError(null);
    setUnknownCode(null);
    const result = await resolveBarcode(code);
    if (result.status === "unknown") {
      setUnknownCode(result.code);
      setPending(null);
      return;
    }
    if (result.status === "inactive") {
      setError(tb("productInactive"));
      return;
    }
    if (result.status !== "found") {
      setError(result.message);
      return;
    }
    if (cameraOpen) {
      setPending({ product: result.product, qty: 1 });
      return;
    }
    addProductLine(result.product, 1);
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const sup = supplierId || suppliers.data?.items?.[0]?.id;
      if (!sup) throw new Error("Supplier required");
      const res = await fetch("/api/v1/goods-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: sup,
          deliveryNoteNo: deliveryNoteNo || null,
          items: lines.map((l) => ({
            productId: l.productId,
            qtyOrdered: l.qtyOrdered,
            qtyDelivered: l.qtyDelivered,
            qtyDamaged: l.qtyDamaged,
            qtyMissing: Math.max(0, l.qtyOrdered - l.qtyDelivered),
            purchasePrice: l.purchasePrice,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (receipt) => {
      setCreatedId(receipt.id);
      setLines([]);
      setDeliveryNoteNo("");
      sessionStorage.removeItem(GR_DRAFT_KEY);
      qc.invalidateQueries({ queryKey: ["goods-receipts"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/goods-receipts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goods-receipts"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setCreatedId(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const historyItems = list.data?.items ?? [];
  const returnTo = "/goods-receipt";
  const bookedId = searchParams.get("booked");

  if (cameraOpen) {
    const discrepancy =
      pending != null
        ? pending.qty -
          (lines.find((l) => l.productId === pending.product.id)?.qtyOrdered ??
            pending.qty)
        : null;

    return (
      <CameraBarcodeScanner
        title={t("title")}
        onBack={() => {
          setCameraOpen(false);
          setPending(null);
        }}
        onScan={onScan}
        pauseCapture={!!pending}
        statusMessage={pending || unknownCode ? null : tb("ready")}
      >
        {unknownCode ? (
          <UnknownBarcodeActions
            code={unknownCode}
            canCreate={canCreate}
            returnTo={returnTo}
            onCancel={() => setUnknownCode(null)}
          />
        ) : null}
        {pending ? (
          <BarcodeResolvePanel
            productName={pending.product.name}
            barcode={pending.product.barcode ?? pending.product.ean}
            systemQty={toNumber(
              (pending.product.stockLevels ?? []).reduce(
                (sum, s) => sum + toNumber(s.quantity),
                0
              )
            )}
          >
            <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[10px] uppercase text-[var(--text-dim)]">
                  {tb("expected")}
                </div>
                <div className="text-xl font-semibold">
                  {lines.find((l) => l.productId === pending.product.id)
                    ?.qtyOrdered ?? pending.qty}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-[var(--text-dim)]">
                  {tb("received")}
                </div>
                <div className="text-xl font-semibold text-[var(--primary)]">
                  {pending.qty}
                </div>
              </div>
            </div>
            {discrepancy != null && discrepancy !== 0 ? (
              <div className="mb-3 text-sm text-[var(--danger)]">
                {tb("difference")}: {discrepancy > 0 ? `+${discrepancy}` : discrepancy}
              </div>
            ) : null}
            <ScanQtyControls
              qty={pending.qty}
              onChange={(n) => setPending((p) => (p ? { ...p, qty: n } : p))}
              confirmLabel={tb("saveNext")}
              onConfirm={() => addProductLine(pending.product, pending.qty)}
            />
          </BarcodeResolvePanel>
        ) : null}
      </CameraBarcodeScanner>
    );
  }

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[{ label: tn("items.goodsReceipt") }]}
    >
      <FormSplitLayout
        form={
          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">{t("newReceipt")}</div>
            </CardHeader>
            <CardBody className="space-y-3">
              {bookedId ? (
                <InlineAlert>{t("bookedSuccess")}</InlineAlert>
              ) : null}
              <div>
                <Label>{t("supplier")}</Label>
                <Select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">{tc("all")}</option>
                  {(suppliers.data?.items ?? []).map(
                    (s: { id: string; name: string }) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    )
                  )}
                </Select>
              </div>
              <div>
                <Label>{t("deliveryNote")}</Label>
                <Input
                  value={deliveryNoteNo}
                  onChange={(e) => setDeliveryNoteNo(e.target.value)}
                />
              </div>
              <Link href="/goods-receipt/scan" className="block">
                <Button type="button" variant="secondary" className="w-full">
                  <ScanLine className="mr-2 h-4 w-4" />
                  {t("scanDeliveryNote")}
                </Button>
              </Link>
              <div className="flex gap-2">
                <HardwareBarcodeInput
                  className="flex-1"
                  onScan={onScan}
                  placeholder={t("scanBarcode")}
                />
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  title={tb("openCamera")}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>

              {unknownCode ? (
                <UnknownBarcodeActions
                  code={unknownCode}
                  canCreate={canCreate}
                  returnTo={returnTo}
                  onCancel={() => setUnknownCode(null)}
                />
              ) : null}

              <div className="space-y-2">
                {lines.map((l) => (
                  <div
                    key={l.productId}
                    className="rounded-md border border-[var(--border-subtle)] p-2 text-sm"
                  >
                    <div className="mb-2 font-medium">{l.name}</div>
                    {l.barcode ? (
                      <div className="mb-2 font-mono text-xs text-[var(--text-muted)]">
                        {l.barcode}
                      </div>
                    ) : null}
                    {l.trackLiquid && l.bottleContentMl ? (
                      <div className="mb-2 text-xs text-[var(--text-dim)]">
                        {t("liquidBottleHint", {
                          content: l.bottleContentMl,
                          ml: Math.round(
                            (l.qtyDelivered - l.qtyDamaged) * l.bottleContentMl
                          ),
                        })}
                      </div>
                    ) : null}
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <div className="text-[10px] uppercase text-[var(--text-dim)]">
                          {l.trackLiquid ? t("orderedBottles") : t("ordered")}
                        </div>
                        <Input
                          type="number"
                          value={l.qtyOrdered}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.productId === l.productId
                                  ? {
                                      ...x,
                                      qtyOrdered: Number(e.target.value) || 0,
                                    }
                                  : x
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-[var(--text-dim)]">
                          {l.trackLiquid ? t("deliveredBottles") : t("delivered")}
                        </div>
                        <Input
                          type="number"
                          value={l.qtyDelivered}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.productId === l.productId
                                  ? {
                                      ...x,
                                      qtyDelivered: Number(e.target.value) || 0,
                                    }
                                  : x
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-[var(--text-dim)]">
                          {l.trackLiquid ? t("damagedBottles") : t("damaged")}
                        </div>
                        <Input
                          type="number"
                          value={l.qtyDamaged}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.productId === l.productId
                                  ? {
                                      ...x,
                                      qtyDamaged: Number(e.target.value) || 0,
                                    }
                                  : x
                              )
                            )
                          }
                        />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-[var(--text-dim)]">
                          {t("price")}
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          value={l.purchasePrice}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.productId === l.productId
                                  ? {
                                      ...x,
                                      purchasePrice:
                                        Number(e.target.value) || 0,
                                    }
                                  : x
                              )
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {t("missing")}:{" "}
                      {Math.max(0, l.qtyOrdered - l.qtyDelivered)}
                    </div>
                  </div>
                ))}
              </div>

              {error ? <InlineAlert>{error}</InlineAlert> : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="success"
                  disabled={lines.length === 0 || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  <Plus className="h-4 w-4" />
                  {t("saveDraft")}
                </Button>
                {createdId ? (
                  <Button
                    variant="success"
                    disabled={confirmMutation.isPending}
                    onClick={() => confirmMutation.mutate(createdId)}
                  >
                    {t("confirmStock")}
                  </Button>
                ) : null}
              </div>
            </CardBody>
          </Card>
        }
        list={
          <DataTablePanel
            title={t("history")}
            empty={historyItems.length === 0 ? tc("noRows") : undefined}
          >
            {historyItems.length > 0 ? (
              <table className="app-table">
                <thead>
                  <tr>
                    <th>{t("deliveryNote")}</th>
                    <th>{t("supplier")}</th>
                    <th>{tc("status")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map(
                    (r: {
                      id: string;
                      deliveryNoteNo: string | null;
                      status: string;
                      supplier: { name: string };
                      _count: { items: number };
                      deliveryNoteScan?: {
                        id: string;
                        pages: Array<{ imageUrl: string }>;
                      } | null;
                    }) => (
                      <tr key={r.id}>
                        <td>
                          <div>{r.deliveryNoteNo ?? "—"}</div>
                          {r.deliveryNoteScan?.pages?.[0]?.imageUrl ? (
                            <a
                              href={r.deliveryNoteScan.pages[0]!.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-[var(--primary)]"
                            >
                              {t("viewDocument")}
                            </a>
                          ) : null}
                        </td>
                        <td>{r.supplier.name}</td>
                        <td>
                          <Badge
                            tone={
                              r.status === "CONFIRMED"
                                ? "success"
                                : r.status === "DRAFT"
                                  ? "warning"
                                  : "default"
                            }
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td>
                          {r.status === "DRAFT" ? (
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => confirmMutation.mutate(r.id)}
                            >
                              {t("confirmStock")}
                            </Button>
                          ) : (
                            <span className="text-xs text-[var(--text-dim)]">
                              {r._count.items} items
                            </span>
                          )}
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
