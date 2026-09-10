"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  FileImage,
  Plus,
  ScanBarcode,
  Trash2,
  AlertTriangle,
  Upload,
} from "lucide-react";
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
import { Link, useRouter } from "@/i18n/navigation";
import { InlineAlert } from "@/components/inline-alert";
import {
  CameraBarcodeScanner,
  HardwareBarcodeInput,
  UnknownBarcodeActions,
} from "@/components/barcode";
import {
  productCreateUrl,
  resolveBarcode,
} from "@/lib/barcode-client";
import type { DeliveryNoteReviewLine } from "@prize/validators";

type ScanPage = {
  id: string;
  pageIndex: number;
  imageUrl: string;
};

type ScanRecord = {
  id: string;
  status: string;
  supplierId: string | null;
  deliveryNoteNo: string | null;
  deliveryDate: string | null;
  processedAt?: string | null;
  ocrStatus: string | null;
  ocrError: string | null;
  extractedLines: DeliveryNoteReviewLine[] | null;
  pages: ScanPage[];
  supplier?: { id: string; name: string } | null;
  goodsReceipt?: { id: string; status: string; deliveryNoteNo: string | null } | null;
};

type DuplicateInfo = {
  reason: string;
  scanId: string;
  goodsReceiptId: string | null;
  deliveryNoteNo: string | null;
};

function confidenceTone(confidence?: number | null) {
  if (confidence == null) return "neutral" as const;
  if (confidence >= 90) return "success" as const;
  if (confidence >= 75) return "warning" as const;
  return "danger" as const;
}

function confidenceLabel(
  t: (key: string) => string,
  confidence?: number | null
) {
  if (confidence == null) return t("confidenceUnknown");
  if (confidence >= 90) return t("confidenceHigh");
  if (confidence >= 75) return t("confidenceMedium");
  return t("confidenceLow");
}

export default function DeliveryNoteScanPage() {
  const t = useTranslations("deliveryNoteScan");
  const tg = useTranslations("goodsReceipt");
  const tb = useTranslations("barcode");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const canCreateProduct =
    session?.user?.roleCode === "ADMIN" ||
    (session?.user?.permissions ?? []).includes("products.create");

  const [scanId, setScanId] = useState<string | null>(
    searchParams.get("scanId")
  );
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<DeliveryNoteReviewLine[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [deliveryNoteNo, setDeliveryNoteNo] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [ackDuplicate, setAckDuplicate] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [barcodeLineId, setBarcodeLineId] = useState<string | null>(null);
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  const [cameraCapture, setCameraCapture] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createdHandledRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await fetch("/api/v1/suppliers")).json(),
  });

  const scanQuery = useQuery({
    queryKey: ["delivery-note-scan", scanId],
    enabled: !!scanId,
    queryFn: async () => {
      const res = await fetch(`/api/v1/delivery-note-scans/${scanId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      return (await res.json()) as ScanRecord;
    },
  });

  const productSearch = useQuery({
    queryKey: ["products-search", productQuery],
    enabled: !!editingLineId && productQuery.trim().length >= 2,
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/products?q=${encodeURIComponent(productQuery)}&pageSize=20`
      );
      return res.json();
    },
  });

  useEffect(() => {
    const scan = scanQuery.data;
    if (!scan) return;
    setSupplierId(scan.supplierId ?? "");
    setDeliveryNoteNo(scan.deliveryNoteNo ?? "");
    if (!Array.isArray(scan.extractedLines)) return;
    try {
      const raw = sessionStorage.getItem(`prize-dn-lines-${scan.id}`);
      if (raw) {
        setLines(JSON.parse(raw) as DeliveryNoteReviewLine[]);
        return;
      }
    } catch {
      /* ignore */
    }
    setLines(scan.extractedLines);
  }, [scanQuery.data?.id, scanQuery.data?.processedAt]);

  useEffect(() => {
    if (!scanId || lines.length === 0) return;
    try {
      sessionStorage.setItem(`prize-dn-lines-${scanId}`, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [scanId, lines]);

  const createScan = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/delivery-note-scans", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      return (await res.json()) as ScanRecord;
    },
    onSuccess: (scan) => {
      setScanId(scan.id);
      router.replace(`/goods-receipt/scan?scanId=${scan.id}`);
      qc.setQueryData(["delivery-note-scan", scan.id], scan);
    },
    onError: (e: Error) => setError(e.message),
  });

  useEffect(() => {
    if (!scanId && !createScan.isPending && !createScan.isSuccess) {
      createScan.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadPage = useMutation({
    mutationFn: async (file: File) => {
      if (!scanId) throw new Error("NO_SCAN");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/v1/delivery-note-scans/${scanId}/pages`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return (await res.json()) as ScanRecord;
    },
    onSuccess: (scan) => {
      qc.setQueryData(["delivery-note-scan", scan.id], scan);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const processScan = useMutation({
    mutationFn: async () => {
      if (!scanId) throw new Error("NO_SCAN");
      const res = await fetch(`/api/v1/delivery-note-scans/${scanId}/process`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || body.code || "OCR_FAILED");
      return body as { scan: ScanRecord; duplicates: DuplicateInfo[] };
    },
    onSuccess: ({ scan, duplicates: dups }) => {
      try {
        sessionStorage.removeItem(`prize-dn-lines-${scan.id}`);
      } catch {
        /* ignore */
      }
      qc.setQueryData(["delivery-note-scan", scan.id], scan);
      setLines(scan.extractedLines ?? []);
      setSupplierId(scan.supplierId ?? "");
      setDeliveryNoteNo(scan.deliveryNoteNo ?? "");
      setDuplicates(dups ?? []);
      setError(null);
    },
    onError: (e: Error) => {
      setError(e.message);
      if (scanId) {
        qc.invalidateQueries({ queryKey: ["delivery-note-scan", scanId] });
      }
    },
  });

  const confirmScan = useMutation({
    mutationFn: async () => {
      if (!scanId) throw new Error("NO_SCAN");
      const res = await fetch(`/api/v1/delivery-note-scans/${scanId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acknowledgeDuplicate: ackDuplicate,
          supplierId: supplierId || undefined,
          deliveryNoteNo: deliveryNoteNo || null,
          extractedLines: lines,
        }),
      });
      const body = await res.json();
      if (res.status === 409) {
        setDuplicates(body.duplicates ?? []);
        throw new Error("DUPLICATE_DELIVERY_NOTE");
      }
      if (!res.ok) throw new Error(body.error || body.code);
      return body as ScanRecord;
    },
    onSuccess: (scan) => {
      try {
        sessionStorage.removeItem(`prize-dn-lines-${scan.id}`);
      } catch {
        /* ignore */
      }
      qc.invalidateQueries({ queryKey: ["goods-receipts"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setError(null);
      router.push(
        `/goods-receipt?booked=${encodeURIComponent(scan.goodsReceipt?.id ?? "")}`
      );
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateLine = useCallback(
    (id: string, patch: Partial<DeliveryNoteReviewLine>) => {
      setLines((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
      );
    },
    []
  );

  const assignProduct = useCallback(
    (
      lineId: string,
      product: { id: string; name: string; purchasePrice?: number | string },
      method: string
    ) => {
      updateLine(lineId, {
        productId: product.id,
        productName: product.name,
        matchStatus: "manual",
        matchMethod: method,
        matchConfidence: 100,
        purchasePrice:
          product.purchasePrice != null
            ? Number(product.purchasePrice)
            : undefined,
      });
      setEditingLineId(null);
      setProductQuery("");
      setBarcodeLineId(null);
      setUnknownCode(null);
    },
    [updateLine]
  );

  // Resume after creating a product from unresolved line
  useEffect(() => {
    const createdId = searchParams.get("createdProductId");
    const lineId = searchParams.get("lineId");
    if (!createdId || !lineId) return;
    if (createdHandledRef.current === createdId) return;
    createdHandledRef.current = createdId;
    (async () => {
      const res = await fetch(`/api/v1/products/${createdId}`);
      if (!res.ok) return;
      const p = await res.json();
      assignProduct(lineId, p, "manual_create");
    })();
  }, [searchParams, assignProduct]);

  async function onBarcodeForLine(code: string) {
    if (!barcodeLineId) return;
    setError(null);
    const result = await resolveBarcode(code);
    if (result.status === "unknown") {
      setUnknownCode(result.code);
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
    assignProduct(barcodeLineId, result.product, "manual_barcode");
  }

  async function startCamera() {
    setCameraCapture(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraCapture(false);
      setError(t("cameraError"));
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setCameraCapture(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) return;
    const file = new File([blob], `page-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    await uploadPage.mutateAsync(file);
  }

  useEffect(() => () => stopCamera(), []);

  const status = scanQuery.data?.status ?? "CAPTURING";
  const pages = scanQuery.data?.pages ?? [];

  const unresolvedCount = lines.filter(
    (l) => !l.excluded && (!l.productId || l.matchStatus === "unmatched")
  ).length;

  const ocrErrorMessage = useMemo(() => {
    if (!error) return null;
    const map: Record<string, string> = {
      OCR_NOT_CONFIGURED: t("ocrNotConfigured"),
      OCR_FAILED: t("ocrFailed"),
      OCR_NO_PRODUCTS: t("ocrNoProducts"),
      OCR_NO_PAGES: t("ocrNoPages"),
      SCAN_NO_PAGES: t("ocrNoPages"),
      DUPLICATE_DELIVERY_NOTE: t("duplicateWarning"),
      UNMATCHED_PRODUCT: t("unmatchedBlock"),
      NO_LINES_TO_BOOK: t("noLines"),
      SUPPLIER_REQUIRED: t("supplierRequired"),
      INVALID_QUANTITY: t("invalidQty"),
    };
    return map[error] ?? error;
  }, [error, t]);

  if (barcodeLineId) {
    return (
      <CameraBarcodeScanner
        title={t("scanProductBarcode")}
        onBack={() => {
          setBarcodeLineId(null);
          setUnknownCode(null);
        }}
        onScan={onBarcodeForLine}
        pauseCapture={!!unknownCode}
        statusMessage={unknownCode ? null : tb("ready")}
      >
        {unknownCode ? (
          <UnknownBarcodeActions
            code={unknownCode}
            canCreate={canCreateProduct}
            returnTo={
              scanId
                ? `/goods-receipt/scan?scanId=${scanId}&lineId=${barcodeLineId}`
                : "/goods-receipt/scan"
            }
            onCancel={() => setUnknownCode(null)}
          />
        ) : null}
      </CameraBarcodeScanner>
    );
  }

  return (
    <AppShell
      title={t("title")}
      subtitle={t("subtitle")}
      breadcrumbs={[
        { label: tn("items.goodsReceipt"), href: "/goods-receipt" },
        { label: t("title") },
      ]}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {ocrErrorMessage ? <InlineAlert>{ocrErrorMessage}</InlineAlert> : null}

        {(status === "CAPTURING" || status === "FAILED" || status === "PROCESSING") && (
          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">{t("captureTitle")}</div>
              <div className="text-xs text-[var(--text-muted)]">
                {t("captureHint")}
              </div>
            </CardHeader>
            <CardBody className="space-y-3">
              {cameraCapture ? (
                <div className="space-y-3">
                  <video
                    ref={videoRef}
                    className="aspect-[3/4] w-full rounded-lg bg-black object-cover"
                    playsInline
                    muted
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => capturePhoto()}
                      disabled={uploadPage.isPending}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {t("takePhoto")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={stopCamera}
                    >
                      {tc("cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={startCamera}>
                    <Camera className="mr-2 h-4 w-4" />
                    {t("openCamera")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {t("uploadImage")}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadPage.mutate(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}

              {pages.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase text-[var(--text-dim)]">
                    {t("pages", { count: pages.length })}
                  </div>
                  <div className="grid grid-cols-3 gap-2 tablet:grid-cols-4">
                    {pages.map((p) => (
                      <a
                        key={p.id}
                        href={p.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="overflow-hidden rounded-md border border-[var(--border-subtle)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.imageUrl}
                          alt={`Page ${p.pageIndex + 1}`}
                          className="aspect-[3/4] w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--text-muted)]">
                  <FileImage className="h-5 w-5" />
                  {t("noPagesYet")}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!scanId || uploadPage.isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addPage")}
                </Button>
                <Button
                  type="button"
                  onClick={() => processScan.mutate()}
                  disabled={
                    !pages.length ||
                    processScan.isPending ||
                    status === "PROCESSING"
                  }
                >
                  {processScan.isPending || status === "PROCESSING"
                    ? t("processing")
                    : t("finishScanning")}
                </Button>
              </div>

              {status === "FAILED" ? (
                <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/5 p-3 text-sm">
                  <div className="mb-1 flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4 text-[var(--danger)]" />
                    {t("ocrFailedTitle")}
                  </div>
                  <p className="mb-3 text-[var(--text-muted)]">
                    {t("ocrFailedHint")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={startCamera}>
                      {t("retake")}
                    </Button>
                    <Link href="/goods-receipt">
                      <Button type="button" variant="secondary">
                        {t("manualReceiving")}
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>
        )}

        {(status === "REVIEW" || status === "CONFIRMED") && (
          <Card>
            <CardHeader>
              <div className="text-sm font-semibold">{t("reviewTitle")}</div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid gap-3 tablet:grid-cols-2">
                <div>
                  <Label>{tg("supplier")}</Label>
                  <Select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    disabled={status === "CONFIRMED"}
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
                  <Label>{tg("deliveryNote")}</Label>
                  <Input
                    value={deliveryNoteNo}
                    onChange={(e) => setDeliveryNoteNo(e.target.value)}
                    disabled={status === "CONFIRMED"}
                  />
                </div>
              </div>

              {duplicates.length > 0 ? (
                <div className="rounded-md border border-[var(--warning)]/50 bg-[var(--warning)]/10 p-3 text-sm">
                  <div className="mb-2 font-medium">{t("duplicateWarning")}</div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ackDuplicate}
                      onChange={(e) => setAckDuplicate(e.target.checked)}
                    />
                    {t("acknowledgeDuplicate")}
                  </label>
                </div>
              ) : null}

              <div className="space-y-2">
                {lines.map((line) => {
                  const tone = confidenceTone(line.matchConfidence);
                  const unmatched =
                    !line.excluded &&
                    (!line.productId || line.matchStatus === "unmatched");
                  return (
                    <div
                      key={line.id}
                      className={`rounded-lg border p-3 ${
                        line.excluded
                          ? "opacity-50 border-[var(--border-subtle)]"
                          : unmatched || line.matchStatus === "uncertain"
                            ? "border-[var(--warning)]/60"
                            : "border-[var(--border-subtle)]"
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            {line.excluded ? "– " : unmatched ? "⚠ " : "✓ "}
                            {line.productName || line.recognizedName}
                          </div>
                          {line.productName &&
                          line.productName !== line.recognizedName ? (
                            <div className="text-xs text-[var(--text-muted)]">
                              {t("recognized")}: {line.recognizedName}
                            </div>
                          ) : null}
                          {unmatched ? (
                            <div className="mt-1 text-sm text-[var(--danger)]">
                              {t("productNotFound")}
                            </div>
                          ) : null}
                        </div>
                        <Badge tone={tone === "neutral" ? "default" : tone}>
                          {confidenceLabel(t, line.matchConfidence)}
                          {line.matchConfidence != null
                            ? ` ${Math.round(line.matchConfidence)}%`
                            : ""}
                        </Badge>
                      </div>

                      <div className="mb-2 grid grid-cols-2 gap-2 tablet:grid-cols-4">
                        <div>
                          <div className="text-[10px] uppercase text-[var(--text-dim)]">
                            {t("quantity")}
                          </div>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={line.quantity}
                            disabled={status === "CONFIRMED" || line.excluded}
                            onChange={(e) =>
                              updateLine(line.id, {
                                quantity: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-[var(--text-dim)]">
                            {t("unit")}
                          </div>
                          <Select
                            value={line.unit ?? "PIECE"}
                            disabled={status === "CONFIRMED" || line.excluded}
                            onChange={(e) =>
                              updateLine(line.id, {
                                unit: e.target.value as DeliveryNoteReviewLine["unit"],
                              })
                            }
                          >
                            {[
                              "PIECE",
                              "KG",
                              "G",
                              "LITER",
                              "ML",
                              "BOTTLE",
                              "CARTON",
                              "PACK",
                            ].map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-[var(--text-dim)]">
                            {tg("price")}
                          </div>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.purchasePrice ?? 0}
                            disabled={status === "CONFIRMED" || line.excluded}
                            onChange={(e) =>
                              updateLine(line.id, {
                                purchasePrice: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-[var(--text-dim)]">
                            {t("batch")}
                          </div>
                          <Input
                            value={line.batchNo ?? ""}
                            disabled={status === "CONFIRMED" || line.excluded}
                            onChange={(e) =>
                              updateLine(line.id, {
                                batchNo: e.target.value || null,
                              })
                            }
                          />
                        </div>
                      </div>

                      {status !== "CONFIRMED" ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditingLineId(
                                editingLineId === line.id ? null : line.id
                              );
                              setProductQuery("");
                            }}
                          >
                            {t("searchProduct")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setBarcodeLineId(line.id)}
                          >
                            <ScanBarcode className="mr-1 h-3.5 w-3.5" />
                            {t("scanBarcode")}
                          </Button>
                          <Link
                            href={productCreateUrl({
                              barcode: line.recognizedEan,
                              name: line.recognizedName,
                              sku:
                                line.recognizedSku ||
                                line.recognizedEan ||
                                undefined,
                              purchasePrice: line.purchasePrice,
                              description: line.recognizedDescription,
                              unit: line.unit,
                              returnTo: `/goods-receipt/scan?scanId=${scanId}&lineId=${line.id}`,
                            })}
                          >
                            <Button type="button" size="sm" variant="secondary">
                              {t("createProduct")}
                            </Button>
                          </Link>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateLine(line.id, { excluded: !line.excluded })
                            }
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            {line.excluded ? t("includeLine") : t("skipLine")}
                          </Button>
                        </div>
                      ) : null}

                      {editingLineId === line.id ? (
                        <div className="mt-3 space-y-2 rounded-md border border-[var(--border-subtle)] p-2">
                          <Input
                            placeholder={t("searchPlaceholder")}
                            value={productQuery}
                            onChange={(e) => setProductQuery(e.target.value)}
                            autoFocus
                          />
                          <HardwareBarcodeInput
                            onScan={async (code) => {
                              setBarcodeLineId(line.id);
                              await onBarcodeForLine(code);
                            }}
                            placeholder={t("scanBarcode")}
                          />
                          <div className="max-h-48 space-y-1 overflow-auto">
                            {(productSearch.data?.items ?? []).map(
                              (p: {
                                id: string;
                                name: string;
                                purchasePrice: number | string;
                              }) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-[var(--surface-2)]"
                                  onClick={() =>
                                    assignProduct(line.id, p, "manual_search")
                                  }
                                >
                                  <span>{p.name}</span>
                                  <Check className="h-4 w-4 text-[var(--primary)]" />
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      ) : null}

                      {line.matchMethod ? (
                        <div className="mt-2 text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
                          {t("matchVia")}: {line.matchMethod}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {status === "REVIEW" ? (
                <div className="sticky bottom-3 z-10 space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-lg">
                  {unresolvedCount > 0 ? (
                    <div className="text-sm text-[var(--warning)]">
                      {t("resolveBeforeBook", { count: unresolvedCount })}
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    className="w-full"
                    size="lg"
                    disabled={
                      confirmScan.isPending ||
                      unresolvedCount > 0 ||
                      (duplicates.length > 0 && !ackDuplicate) ||
                      !supplierId
                    }
                    onClick={() => confirmScan.mutate()}
                  >
                    {confirmScan.isPending
                      ? t("booking")
                      : t("bookToLager")}
                  </Button>
                  <div className="text-center text-xs text-[var(--text-muted)]">
                    {t("bookHint")}
                  </div>
                </div>
              ) : null}

              {status === "CONFIRMED" && scanQuery.data?.goodsReceipt ? (
                <InlineAlert>
                  {t("bookedOk", {
                    id: scanQuery.data.goodsReceipt.id.slice(0, 8),
                  })}
                </InlineAlert>
              ) : null}

              {pages.length > 0 ? (
                <div>
                  <div className="mb-2 text-xs font-medium uppercase text-[var(--text-dim)]">
                    {t("originalDocument")}
                  </div>
                  <div className="flex gap-2 overflow-x-auto">
                    {pages.map((p) => (
                      <a
                        key={p.id}
                        href={p.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 overflow-hidden rounded-md border border-[var(--border-subtle)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-24 w-20 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
