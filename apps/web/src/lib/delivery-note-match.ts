import { prisma } from "./db";
import { barcodeLookupVariants, normalizeBarcode } from "./barcode";
import { mapUnit, type OcrExtractedProductLine } from "./delivery-note-ocr";
import type { DeliveryNoteReviewLine } from "@prize/validators";
import { randomBytes } from "node:crypto";

export type ProductMatchResult = {
  productId: string | null;
  productName: string | null;
  matchStatus: DeliveryNoteReviewLine["matchStatus"];
  matchMethod: string | null;
  matchConfidence: number | null;
};

type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  ean: string | null;
  barcode: string | null;
  purchasePrice: { toString(): string };
  unit: string;
  supplierId: string | null;
  supplierSkus: string[];
};

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) {
    const ratio =
      Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return Math.round(88 + ratio * 10);
  }
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return Math.round(Math.max(0, (1 - dist / maxLen) * 100));
}

async function loadCatalog(
  hotelId: string,
  supplierId?: string | null
): Promise<CatalogProduct[]> {
  const products = await prisma.product.findMany({
    where: { hotelId, isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      ean: true,
      barcode: true,
      purchasePrice: true,
      unit: true,
      supplierId: true,
      supplierProducts: {
        where: supplierId ? { supplierId } : undefined,
        select: { supplierSku: true, supplierId: true },
        orderBy: { effectiveFrom: "desc" },
        take: 20,
      },
    },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    ean: p.ean,
    barcode: p.barcode,
    purchasePrice: p.purchasePrice,
    unit: p.unit,
    supplierId: p.supplierId,
    supplierSkus: p.supplierProducts
      .map((sp) => sp.supplierSku)
      .filter((s): s is string => !!s),
  }));
}

function findByCodes(
  catalog: CatalogProduct[],
  code: string | null | undefined
): CatalogProduct | null {
  if (!code) return null;
  const normalized = normalizeBarcode(code);
  if (!normalized) return null;
  const variants = new Set(barcodeLookupVariants(normalized));
  variants.add(normalized.toUpperCase());
  variants.add(code.trim());
  return (
    catalog.find(
      (p) =>
        (p.ean && variants.has(normalizeBarcode(p.ean))) ||
        (p.barcode && variants.has(normalizeBarcode(p.barcode))) ||
        variants.has(p.sku) ||
        variants.has(p.sku.toUpperCase())
    ) ?? null
  );
}

/**
 * Match OCR line against product DB using priority:
 * 1 EAN/barcode → 2 supplier SKU → 3 internal SKU → 4 supplier+SKU → 5/6 name fuzzy
 */
export function matchProductLine(
  line: OcrExtractedProductLine,
  catalog: CatalogProduct[],
  supplierId?: string | null
): ProductMatchResult {
  const eanHit = findByCodes(catalog, line.ean ?? undefined);
  if (eanHit) {
    return {
      productId: eanHit.id,
      productName: eanHit.name,
      matchStatus: "matched",
      matchMethod: "ean",
      matchConfidence: 99,
    };
  }

  const supplierNo = line.productNumber?.trim();
  if (supplierNo && supplierId) {
    const bySupplierSku = catalog.find((p) =>
      p.supplierSkus.some(
        (s) => s.toLowerCase() === supplierNo.toLowerCase()
      )
    );
    if (bySupplierSku) {
      return {
        productId: bySupplierSku.id,
        productName: bySupplierSku.name,
        matchStatus: "matched",
        matchMethod: "supplier_sku",
        matchConfidence: 97,
      };
    }
  }

  if (supplierNo) {
    const bySku = catalog.find(
      (p) => p.sku.toLowerCase() === supplierNo.toLowerCase()
    );
    if (bySku) {
      return {
        productId: bySku.id,
        productName: bySku.name,
        matchStatus: "matched",
        matchMethod: "sku",
        matchConfidence: 95,
      };
    }
  }

  if (supplierNo && supplierId) {
    const bySupplierAndSku = catalog.find(
      (p) =>
        p.supplierId === supplierId &&
        (p.sku.toLowerCase() === supplierNo.toLowerCase() ||
          p.supplierSkus.some(
            (s) => s.toLowerCase() === supplierNo.toLowerCase()
          ))
    );
    if (bySupplierAndSku) {
      return {
        productId: bySupplierAndSku.id,
        productName: bySupplierAndSku.name,
        matchStatus: "matched",
        matchMethod: "supplier_and_sku",
        matchConfidence: 94,
      };
    }
  }

  let best: { product: CatalogProduct; score: number } | null = null;
  for (const p of catalog) {
    const score = nameSimilarity(line.productName, p.name);
    if (!best || score > best.score) best = { product: p, score };
  }

  if (best && best.score >= 90) {
    return {
      productId: best.product.id,
      productName: best.product.name,
      matchStatus: "matched",
      matchMethod: "name_high",
      matchConfidence: best.score,
    };
  }

  if (best && best.score >= 72) {
    return {
      productId: best.product.id,
      productName: best.product.name,
      matchStatus: "uncertain",
      matchMethod: "name_fuzzy",
      matchConfidence: best.score,
    };
  }

  return {
    productId: null,
    productName: null,
    matchStatus: "unmatched",
    matchMethod: null,
    matchConfidence: best?.score ?? 0,
  };
}

function dedupeLines(
  lines: OcrExtractedProductLine[]
): OcrExtractedProductLine[] {
  const out: OcrExtractedProductLine[] = [];
  for (const line of lines) {
    const key = [
      normalizeText(line.productName),
      (line.ean ?? "").trim(),
      (line.productNumber ?? "").trim(),
    ].join("|");
    const existing = out.find((o) => {
      const ok = [
        normalizeText(o.productName),
        (o.ean ?? "").trim(),
        (o.productNumber ?? "").trim(),
      ].join("|");
      return ok === key;
    });
    if (existing) {
      existing.quantity = Number(existing.quantity) + Number(line.quantity);
      continue;
    }
    out.push({ ...line });
  }
  return out;
}

export async function buildReviewLines(opts: {
  hotelId: string;
  supplierId?: string | null;
  lines: OcrExtractedProductLine[];
}): Promise<DeliveryNoteReviewLine[]> {
  const catalog = await loadCatalog(opts.hotelId, opts.supplierId);
  const deduped = dedupeLines(opts.lines);

  return deduped.map((line, index) => {
    const match = matchProductLine(line, catalog, opts.supplierId);
    const unit = mapUnit(line.unit);
    const catalogProduct = match.productId
      ? catalog.find((p) => p.id === match.productId)
      : null;

    return {
      id: `line_${index}_${randomBytes(3).toString("hex")}`,
      lineIndex: index,
      recognizedName: line.productName,
      recognizedDescription: line.description ?? null,
      recognizedSku: line.productNumber ?? null,
      recognizedEan: line.ean ?? null,
      recognizedSupplierSku: line.productNumber ?? null,
      quantity: Number(line.quantity),
      unit: unit,
      purchasePrice:
        line.purchasePrice ??
        (catalogProduct
          ? Number(catalogProduct.purchasePrice.toString())
          : null),
      batchNo: line.batchNo ?? null,
      expiryDate: line.expiryDate ?? null,
      matchStatus: match.matchStatus,
      matchMethod: match.matchMethod,
      matchConfidence: match.matchConfidence,
      productId: match.productId,
      productName: match.productName,
      excluded: false,
    };
  });
}

export async function rematchLine(
  hotelId: string,
  line: DeliveryNoteReviewLine,
  supplierId?: string | null
): Promise<DeliveryNoteReviewLine> {
  const catalog = await loadCatalog(hotelId, supplierId);
  const match = matchProductLine(
    {
      productName: line.recognizedName,
      description: line.recognizedDescription,
      productNumber: line.recognizedSupplierSku ?? line.recognizedSku,
      ean: line.recognizedEan,
      quantity: line.quantity,
      unit: line.unit,
      purchasePrice: line.purchasePrice,
      batchNo: line.batchNo,
      expiryDate: line.expiryDate,
    },
    catalog,
    supplierId
  );
  return {
    ...line,
    ...match,
    excluded: line.excluded,
  };
}
