import type { Unit } from "@prisma/client";
import { getOcrConfig } from "./integrations";

export type OcrExtractedProductLine = {
  productName: string;
  description?: string | null;
  productNumber?: string | null;
  ean?: string | null;
  quantity: number;
  unit?: string | null;
  purchasePrice?: number | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  confidence?: number | null;
};

export type OcrExtractionResult = {
  supplierName?: string | null;
  deliveryNoteNo?: string | null;
  deliveryDate?: string | null;
  lines: OcrExtractedProductLine[];
  rawText?: string | null;
  model?: string | null;
  pageCount: number;
};

const EXTRACTION_PROMPT = `You are extracting structured data from a delivery note (Lieferschein / Warenlieferung).
Return ONLY valid JSON with this shape:
{
  "supplierName": string|null,
  "deliveryNoteNo": string|null,
  "deliveryDate": string|null,
  "lines": [
    {
      "productName": string,
      "description": string|null,
      "productNumber": string|null,
      "ean": string|null,
      "quantity": number,
      "unit": string|null,
      "purchasePrice": number|null,
      "batchNo": string|null,
      "expiryDate": string|null,
      "confidence": number
    }
  ],
  "rawText": string|null
}

Rules:
- Extract every product line with its quantity. Quantity is critical.
- Prefer Arabic numerals for quantity (e.g. 24 not "twenty-four").
- deliveryDate as ISO date YYYY-MM-DD when possible.
- confidence is 0-100 for that line.
- Ignore totals, VAT, addresses, signatures, and headers that are not products.
- Do not invent products that are not on the document.
- If a field is not visible, use null.
- Unit may be Stk, Stück, kg, l, Flasche, Karton, Pack, etc.`;

function mapUnit(raw?: string | null): Unit | null {
  if (!raw) return null;
  const u = raw.trim().toLowerCase();
  if (["stk", "stück", "stueck", "st", "pcs", "pc", "piece", "ea"].includes(u))
    return "PIECE";
  if (["kg", "kilo", "kilogram"].includes(u)) return "KG";
  if (["g", "gram", "gramm"].includes(u)) return "G";
  if (["l", "lt", "liter", "litre"].includes(u)) return "LITER";
  if (["ml", "milliliter"].includes(u)) return "ML";
  if (["flasche", "bottle", "fl"].includes(u)) return "BOTTLE";
  if (["karton", "carton", "krt", "case"].includes(u)) return "CARTON";
  if (["pack", "pck", "packung"].includes(u)) return "PACK";
  return null;
}

function parseJsonPayload(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(raw);
}

/**
 * Analyze delivery-note page images with Vision OCR.
 * Uses org SystemIntegration (OCR_DELIVERY_NOTE) when available, else OPENAI_API_KEY.
 * Throws OCR_NOT_CONFIGURED or OCR_FAILED — never invents inventory data.
 */
export async function extractDeliveryNoteFromImages(
  imageUrlsOrDataUrls: string[],
  organizationId?: string | null
): Promise<OcrExtractionResult> {
  const config = organizationId
    ? await getOcrConfig(organizationId)
    : (() => {
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        if (!apiKey) return null;
        return {
          apiKey,
          model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o",
          provider: "openai",
        };
      })();

  if (!config?.apiKey) {
    throw new Error("OCR_NOT_CONFIGURED");
  }
  if (imageUrlsOrDataUrls.length === 0) {
    throw new Error("OCR_NO_PAGES");
  }

  const { apiKey, model } = config;
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: EXTRACTION_PROMPT,
    },
    ...imageUrlsOrDataUrls.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    })),
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract structured delivery-note line items for hotel inventory receiving. Reply with JSON only.",
        },
        { role: "user", content },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("OCR provider error", res.status, errText.slice(0, 500));
    throw new Error("OCR_FAILED");
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const contentText = payload.choices?.[0]?.message?.content;
  if (!contentText) throw new Error("OCR_FAILED");

  let parsed: {
    supplierName?: string | null;
    deliveryNoteNo?: string | null;
    deliveryDate?: string | null;
    lines?: OcrExtractedProductLine[];
    rawText?: string | null;
  };
  try {
    parsed = parseJsonPayload(contentText) as typeof parsed;
  } catch {
    throw new Error("OCR_FAILED");
  }

  const lines = (parsed.lines ?? [])
    .map((line) => ({
      productName: String(line.productName ?? "").trim(),
      description: line.description ?? null,
      productNumber: line.productNumber ?? null,
      ean: line.ean ?? null,
      quantity: Number(line.quantity),
      unit: line.unit ?? null,
      purchasePrice:
        line.purchasePrice != null && !Number.isNaN(Number(line.purchasePrice))
          ? Number(line.purchasePrice)
          : null,
      batchNo: line.batchNo ?? null,
      expiryDate: line.expiryDate ?? null,
      confidence:
        line.confidence != null && !Number.isNaN(Number(line.confidence))
          ? Math.max(0, Math.min(100, Number(line.confidence)))
          : null,
    }))
    .filter(
      (l) =>
        l.productName.length > 0 &&
        Number.isFinite(l.quantity) &&
        l.quantity >= 0
    );

  if (lines.length === 0) {
    throw new Error("OCR_NO_PRODUCTS");
  }

  return {
    supplierName: parsed.supplierName ?? null,
    deliveryNoteNo: parsed.deliveryNoteNo ?? null,
    deliveryDate: parsed.deliveryDate ?? null,
    lines,
    rawText: parsed.rawText ?? null,
    model,
    pageCount: imageUrlsOrDataUrls.length,
  };
}

export { mapUnit };
