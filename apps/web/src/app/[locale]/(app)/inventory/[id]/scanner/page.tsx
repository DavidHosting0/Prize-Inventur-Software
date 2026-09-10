"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CameraBarcodeScanner,
  BarcodeResolvePanel,
  UnknownBarcodeActions,
} from "@/components/barcode";
import { InventoryQtyControls } from "@/components/inventory-qty-controls";
import { resolveBarcode, type ResolvedBarcodeProduct } from "@/lib/barcode-client";
import { toNumber } from "@/lib/money";
import { mlToBottleInput } from "@/lib/liquid-stock-format";
import {
  DEFAULT_INVENTORY_SETTINGS,
  type InventorySettingsJson,
} from "@prize/types";

type CurrentProduct = {
  productId: string;
  name: string;
  barcode: string | null;
  systemQty: number;
  trackLiquid: boolean;
  bottleContentMl: number | null;
};

export default function InventoryScannerPage() {
  const t = useTranslations("inventory");
  const tb = useTranslations("barcode");
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const canCreate =
    session?.user?.roleCode === "ADMIN" ||
    (session?.user?.permissions ?? []).includes("products.create");

  const [qty, setQty] = useState(0);
  const [current, setCurrent] = useState<CurrentProduct | null>(null);
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const handledCreatedRef = useRef<string | null>(null);

  const { data: count, refetch } = useQuery({
    queryKey: ["inventory-count", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/inventory-counts/${params.id}`);
      return res.json();
    },
  });

  const settings: InventorySettingsJson =
    count?.inventorySettings ?? DEFAULT_INVENTORY_SETTINGS;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!current) return;
      const res = await fetch(`/api/v1/inventory-counts/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "count",
          productId: current.productId,
          countedQty: qty,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      setCurrent(null);
      setQty(0);
      setError(null);
      setUnknownCode(null);
      setFlash(true);
      setTimeout(() => setFlash(false), 200);
      refetch();
    },
  });

  const applyProduct = useCallback(
    (product: ResolvedBarcodeProduct) => {
      const item = (count?.items ?? []).find(
        (i: { productId: string }) => i.productId === product.id
      );
      const trackLiquid = Boolean(
        product.trackLiquid ?? item?.product?.trackLiquid
      );
      const bottleContentMl =
        toNumber(
          product.bottleContentMl ?? item?.product?.bottleContentMl ?? 0
        ) || null;
      const systemMl = item
        ? toNumber(item.systemQty)
        : toNumber(product.stockLevels?.[0]?.quantity ?? 0);
      const countedMl =
        item?.countedQty != null ? toNumber(item.countedQty) : systemMl;
      const systemQty = trackLiquid
        ? mlToBottleInput(systemMl, bottleContentMl)
        : systemMl;
      const counted = trackLiquid
        ? mlToBottleInput(countedMl, bottleContentMl)
        : countedMl;
      setCurrent({
        productId: product.id,
        name: product.name,
        barcode: product.barcode ?? product.ean ?? null,
        systemQty,
        trackLiquid,
        bottleContentMl,
      });
      setQty(counted);
      setUnknownCode(null);
      setError(null);
      setFlash(true);
      setTimeout(() => setFlash(false), 200);
    },
    [count]
  );

  const resolveCode = useCallback(
    async (code: string) => {
      setError(null);
      setUnknownCode(null);
      const result = await resolveBarcode(code);
      if (result.status === "found") {
        applyProduct(result.product);
        return;
      }
      if (result.status === "inactive") {
        setError(tb("productInactive"));
        setCurrent(null);
        return;
      }
      if (result.status === "unknown") {
        setUnknownCode(result.code);
        setCurrent(null);
        return;
      }
      setError(result.message);
      setCurrent(null);
    },
    [applyProduct, tb]
  );

  useEffect(() => {
    const createdId = searchParams.get("createdProductId");
    if (!createdId || !count?.id) return;
    if (handledCreatedRef.current === createdId) return;
    handledCreatedRef.current = createdId;

    (async () => {
      const res = await fetch(`/api/v1/products/${createdId}`);
      if (!res.ok) return;
      const product = await res.json();
      applyProduct(product);
    })();
  }, [searchParams, count?.id, applyProduct]);

  const difference = current ? qty - current.systemQty : null;
  const returnTo = `/inventory/${params.id}/scanner`;

  return (
    <CameraBarcodeScanner
      title={t("scannerMode")}
      backHref={`/inventory/${params.id}`}
      onScan={resolveCode}
      pauseCapture={!!current}
      successFlash={flash}
      statusMessage={
        current || unknownCode || error ? null : tb("ready")
      }
    >
      {error ? (
        <div className="rounded-md bg-[var(--danger-muted)] px-3 py-3 text-center text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {unknownCode ? (
        <UnknownBarcodeActions
          code={unknownCode}
          canCreate={canCreate}
          returnTo={returnTo}
          onCancel={() => setUnknownCode(null)}
        />
      ) : null}

      {current ? (
        <BarcodeResolvePanel
          productName={current.name}
          barcode={current.barcode}
          locationLabel={count?.warehouse?.name}
          systemQty={current.systemQty}
          countedQty={qty}
          difference={difference}
        >
          <InventoryQtyControls
            qty={qty}
            onChange={setQty}
            onConfirm={() => saveMutation.mutate()}
            confirmLabel={t("saveNext")}
            confirming={saveMutation.isPending}
            trackLiquid={current.trackLiquid}
            presets={settings.liquidPresets}
            step={settings.liquidStep}
            unitLabel={t("bottlesUnit")}
            bottleContentMl={current.bottleContentMl}
            showMl={settings.showMlAlongsideBottles}
            fullBottlesLabel={t("fullBottles")}
            openBottleLabel={t("openBottle")}
          />
        </BarcodeResolvePanel>
      ) : null}
    </CameraBarcodeScanner>
  );
}
