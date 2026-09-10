import { normalizeBarcode } from "./barcode-normalize";

export type ResolvedBarcodeProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  ean: string | null;
  salePrice: string | number;
  purchasePrice: string | number;
  vatRate: string | number;
  unit: string;
  isActive: boolean;
  categoryId: string;
  supplierId?: string | null;
  trackLiquid?: boolean;
  bottleContentMl?: string | number | null;
  category?: { id: string; name: string } | null;
  stockLevels?: Array<{
    warehouseId: string;
    quantity: string | number;
  }>;
  supplier?: { id: string; name: string } | null;
  [key: string]: unknown;
};

export type ResolveBarcodeResult =
  | { status: "found"; product: ResolvedBarcodeProduct; code: string }
  | { status: "unknown"; code: string }
  | { status: "inactive"; code: string; productId?: string }
  | { status: "error"; code: string; message: string };

export { normalizeBarcode };

export async function resolveBarcode(
  rawCode: string
): Promise<ResolveBarcodeResult> {
  const code = normalizeBarcode(rawCode);
  if (!code) {
    return { status: "error", code: "", message: "Empty barcode" };
  }

  try {
    const res = await fetch(
      `/api/v1/products/barcode/${encodeURIComponent(code)}`
    );
    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      return { status: "found", product: body, code };
    }

    const errCode = body?.code as string | undefined;
    if (res.status === 404 || errCode === "BARCODE_UNKNOWN") {
      return { status: "unknown", code };
    }
    if (errCode === "PRODUCT_INACTIVE") {
      return { status: "inactive", code };
    }

    return {
      status: "error",
      code,
      message: body?.error ?? "Lookup failed",
    };
  } catch (e) {
    return {
      status: "error",
      code,
      message: e instanceof Error ? e.message : "Lookup failed",
    };
  }
}

/** Safe same-app return path for product create resume. */
export function safeReturnTo(path: string | null | undefined): string | null {
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("://")) return null;
  return path;
}

export function productCreateUrl(opts: {
  barcode?: string | null;
  returnTo?: string | null;
  name?: string | null;
  sku?: string | null;
  purchasePrice?: number | string | null;
  description?: string | null;
  unit?: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts.barcode) params.set("barcode", opts.barcode);
  if (opts.name) params.set("name", opts.name);
  if (opts.sku) params.set("sku", opts.sku);
  if (opts.purchasePrice != null && opts.purchasePrice !== "") {
    params.set("purchasePrice", String(opts.purchasePrice));
  }
  if (opts.description) params.set("description", opts.description);
  if (opts.unit) params.set("unit", opts.unit);
  const ret = safeReturnTo(opts.returnTo ?? null);
  if (ret) params.set("returnTo", ret);
  const q = params.toString();
  return q ? `/products/new?${q}` : "/products/new";
}
