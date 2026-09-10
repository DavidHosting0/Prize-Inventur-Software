import { prisma } from "./db";
import { normalizeBarcode } from "./barcode-normalize";

export { normalizeBarcode };

/** Candidate codes to try when matching (normalized + common variants). */
export function barcodeLookupVariants(normalized: string): string[] {
  const variants = new Set<string>();
  if (!normalized) return [];

  variants.add(normalized);

  if (/^\d{12}$/.test(normalized)) {
    variants.add(`0${normalized}`);
  }
  if (/^\d{13}$/.test(normalized) && normalized.startsWith("0")) {
    variants.add(normalized.slice(1));
  }

  // UPC-E (8 digits starting with 0) → expand to UPC-A when possible
  if (/^0\d{7}$/.test(normalized)) {
    const upcA = expandUpcE(normalized);
    if (upcA) {
      variants.add(upcA);
      variants.add(`0${upcA}`);
    }
  }

  return [...variants];
}

function expandUpcE(upcE: string): string | null {
  // upcE: 0ABCDEFG (8 chars) where G is check digit; digits 1-6 are A-F, digit 7 is number system already in [0]
  if (!/^0\d{7}$/.test(upcE)) return null;
  const d = upcE.slice(1, 7); // 6 data digits
  const last = d[5];
  let upcABody: string;
  switch (last) {
    case "0":
    case "1":
    case "2":
      upcABody = `${d.slice(0, 2)}${last}0000${d.slice(2, 5)}`;
      break;
    case "3":
      upcABody = `${d.slice(0, 3)}00000${d.slice(3, 5)}`;
      break;
    case "4":
      upcABody = `${d.slice(0, 4)}00000${d[4]}`;
      break;
    default:
      upcABody = `${d.slice(0, 5)}0000${last}`;
      break;
  }
  const check = upcE[7];
  return `0${upcABody}${check}`.slice(1); // 12-digit UPC-A
}

export type BarcodeProduct = NonNullable<
  Awaited<ReturnType<typeof findProductByBarcode>>
>;

export async function findProductByBarcode(hotelId: string, rawCode: string) {
  const normalized = normalizeBarcode(rawCode);
  if (!normalized) return null;

  const codes = barcodeLookupVariants(normalized);

  return prisma.product.findFirst({
    where: {
      hotelId,
      OR: [
        { barcode: { in: codes } },
        { ean: { in: codes } },
        { sku: { in: codes } },
      ],
    },
    include: { category: true, stockLevels: true, supplier: true },
  });
}
