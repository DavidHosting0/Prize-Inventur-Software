/**
 * Client-safe barcode normalization (no Prisma).
 * Keep in sync with server `normalizeBarcode` in barcode.ts for the trim/control logic.
 */
export function normalizeBarcode(raw: string): string {
  let code = raw.replace(/[\x00-\x1F\x7F]/g, "").trim();
  if (!code) return "";
  if (/^[\d\s]+$/.test(code)) {
    code = code.replace(/\s+/g, "");
  }
  return code;
}
