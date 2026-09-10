import { Prisma } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ConfirmDeliveryNoteScanInput,
  DeliveryNoteReviewLine,
  UpdateDeliveryNoteScanInput,
} from "@prize/validators";
import { prisma } from "./db";
import { applyStockChange } from "./stock";
import { getCentralWarehouse } from "./warehouse";
import type { SessionUser } from "./rbac";
import { assertSessionHotelId } from "./tenant";
import { extractDeliveryNoteFromImages } from "./delivery-note-ocr";
import { buildReviewLines } from "./delivery-note-match";
import {
  combinePageHashes,
  saveDeliveryNoteImage,
} from "./delivery-note-storage";

function d(n: number | string | Prisma.Decimal) {
  return new Prisma.Decimal(n);
}

const scanInclude = {
  pages: { orderBy: { pageIndex: "asc" as const } },
  supplier: true,
  goodsReceipt: {
    include: {
      items: { include: { product: true } },
      warehouse: true,
    },
  },
} as const;

export async function createDeliveryNoteScan(user: SessionUser) {
  assertSessionHotelId(user);
  const scan = await prisma.deliveryNoteScan.create({
    data: {
      hotelId: user.hotelId,
      status: "CAPTURING",
      createdById: user.id,
    },
    include: scanInclude,
  });

  await prisma.auditLog.create({
    data: {
      hotelId: user.hotelId,
      userId: user.id,
      action: "deliveryNoteScan.create",
      entity: "DeliveryNoteScan",
      entityId: scan.id,
      newValue: { status: "CAPTURING" },
    },
  });

  return scan;
}

export async function getDeliveryNoteScan(user: SessionUser, id: string) {
  assertSessionHotelId(user);
  return prisma.deliveryNoteScan.findFirst({
    where: { id, hotelId: user.hotelId },
    include: scanInclude,
  });
}

export async function addDeliveryNotePage(
  user: SessionUser,
  scanId: string,
  file: File
) {
  assertSessionHotelId(user);
  const scan = await prisma.deliveryNoteScan.findFirst({
    where: { id: scanId, hotelId: user.hotelId },
    include: { pages: true },
  });
  if (!scan) throw new Error("SCAN_NOT_FOUND");
  if (scan.status !== "CAPTURING" && scan.status !== "FAILED") {
    throw new Error("SCAN_NOT_EDITABLE");
  }

  const pageIndex =
    scan.pages.reduce((max, p) => Math.max(max, p.pageIndex), -1) + 1;
  const saved = await saveDeliveryNoteImage({
    hotelId: user.hotelId,
    scanId,
    pageIndex,
    file,
  });

  const page = await prisma.deliveryNotePage.create({
    data: {
      scanId,
      pageIndex,
      imageUrl: saved.imageUrl,
      mimeType: saved.mimeType,
      fileSize: saved.fileSize,
      fileHash: saved.fileHash,
    },
  });

  if (scan.status === "FAILED") {
    await prisma.deliveryNoteScan.update({
      where: { id: scanId },
      data: { status: "CAPTURING", ocrError: null, ocrStatus: null },
    });
  }

  await prisma.auditLog.create({
    data: {
      hotelId: user.hotelId,
      userId: user.id,
      action: "deliveryNoteScan.page",
      entity: "DeliveryNoteScan",
      entityId: scanId,
      newValue: { pageIndex, imageUrl: saved.imageUrl, fileHash: saved.fileHash },
    },
  });

  return page;
}

async function imageToDataUrl(imageUrl: string, mimeType: string) {
  const abs = path.join(process.cwd(), "public", imageUrl.replace(/^\//, ""));
  const buf = await readFile(abs);
  return `data:${mimeType};base64,${buf.toString("base64")}`;
}

async function resolveSupplierId(
  hotelId: string,
  supplierName?: string | null,
  preferredId?: string | null
) {
  if (preferredId) {
    const s = await prisma.supplier.findFirst({
      where: { id: preferredId, hotelId, isActive: true },
    });
    if (s) return s.id;
  }
  if (!supplierName?.trim()) return null;
  const name = supplierName.trim();
  const exact = await prisma.supplier.findFirst({
    where: { hotelId, isActive: true, name: { equals: name, mode: "insensitive" } },
  });
  if (exact) return exact.id;
  const contains = await prisma.supplier.findFirst({
    where: {
      hotelId,
      isActive: true,
      name: { contains: name.slice(0, 24), mode: "insensitive" },
    },
  });
  return contains?.id ?? null;
}

export async function findDuplicateDeliveryNotes(
  hotelId: string,
  opts: {
    documentHash?: string | null;
    supplierId?: string | null;
    deliveryNoteNo?: string | null;
    excludeScanId?: string;
  }
) {
  const duplicates: Array<{
    reason: "document_hash" | "delivery_note_no";
    scanId: string;
    goodsReceiptId: string | null;
    deliveryNoteNo: string | null;
    confirmedAt: Date | null;
  }> = [];

  if (opts.documentHash) {
    const byHash = await prisma.deliveryNoteScan.findMany({
      where: {
        hotelId,
        documentHash: opts.documentHash,
        status: "CONFIRMED",
        ...(opts.excludeScanId ? { id: { not: opts.excludeScanId } } : {}),
      },
      select: {
        id: true,
        goodsReceiptId: true,
        deliveryNoteNo: true,
        confirmedAt: true,
      },
      take: 5,
    });
    for (const s of byHash) {
      duplicates.push({
        reason: "document_hash",
        scanId: s.id,
        goodsReceiptId: s.goodsReceiptId,
        deliveryNoteNo: s.deliveryNoteNo,
        confirmedAt: s.confirmedAt,
      });
    }
  }

  if (opts.supplierId && opts.deliveryNoteNo?.trim()) {
    const note = opts.deliveryNoteNo.trim();
    const byNote = await prisma.deliveryNoteScan.findMany({
      where: {
        hotelId,
        supplierId: opts.supplierId,
        deliveryNoteNo: note,
        status: "CONFIRMED",
        ...(opts.excludeScanId ? { id: { not: opts.excludeScanId } } : {}),
      },
      select: {
        id: true,
        goodsReceiptId: true,
        deliveryNoteNo: true,
        confirmedAt: true,
      },
      take: 5,
    });
    for (const s of byNote) {
      if (duplicates.some((d) => d.scanId === s.id)) continue;
      duplicates.push({
        reason: "delivery_note_no",
        scanId: s.id,
        goodsReceiptId: s.goodsReceiptId,
        deliveryNoteNo: s.deliveryNoteNo,
        confirmedAt: s.confirmedAt,
      });
    }

    const gr = await prisma.goodsReceipt.findMany({
      where: {
        hotelId,
        supplierId: opts.supplierId,
        deliveryNoteNo: note,
        status: "CONFIRMED",
      },
      select: { id: true, deliveryNoteNo: true, confirmedAt: true },
      take: 5,
    });
    for (const r of gr) {
      if (duplicates.some((d) => d.goodsReceiptId === r.id)) continue;
      duplicates.push({
        reason: "delivery_note_no",
        scanId: "",
        goodsReceiptId: r.id,
        deliveryNoteNo: r.deliveryNoteNo,
        confirmedAt: r.confirmedAt,
      });
    }
  }

  return duplicates;
}

export async function processDeliveryNoteScan(
  user: SessionUser,
  scanId: string
) {
  assertSessionHotelId(user);
  const scan = await prisma.deliveryNoteScan.findFirst({
    where: { id: scanId, hotelId: user.hotelId },
    include: { pages: { orderBy: { pageIndex: "asc" } } },
  });
  if (!scan) throw new Error("SCAN_NOT_FOUND");
  if (scan.pages.length === 0) throw new Error("SCAN_NO_PAGES");
  if (scan.status === "CONFIRMED") throw new Error("SCAN_ALREADY_CONFIRMED");

  await prisma.deliveryNoteScan.update({
    where: { id: scanId },
    data: { status: "PROCESSING", ocrError: null },
  });

  try {
    const dataUrls = await Promise.all(
      scan.pages.map((p) => imageToDataUrl(p.imageUrl, p.mimeType))
    );
    const extraction = await extractDeliveryNoteFromImages(
      dataUrls,
      user.organizationId
    );
    const supplierId = await resolveSupplierId(
      user.hotelId,
      extraction.supplierName,
      scan.supplierId
    );
    const lines = await buildReviewLines({
      hotelId: user.hotelId,
      supplierId,
      lines: extraction.lines,
    });
    const documentHash = combinePageHashes(scan.pages.map((p) => p.fileHash));
    const duplicates = await findDuplicateDeliveryNotes(user.hotelId, {
      documentHash,
      supplierId,
      deliveryNoteNo: extraction.deliveryNoteNo,
      excludeScanId: scanId,
    });

    const updated = await prisma.deliveryNoteScan.update({
      where: { id: scanId },
      data: {
        status: "REVIEW",
        ocrStatus: "SUCCESS",
        ocrError: null,
        ocrRawResult: extraction as unknown as Prisma.InputJsonValue,
        extractedLines: lines as unknown as Prisma.InputJsonValue,
        supplierId,
        deliveryNoteNo: extraction.deliveryNoteNo,
        deliveryDate: extraction.deliveryDate
          ? new Date(extraction.deliveryDate)
          : null,
        documentHash,
        processedAt: new Date(),
      },
      include: scanInclude,
    });

    await prisma.auditLog.create({
      data: {
        hotelId: user.hotelId,
        userId: user.id,
        action: "deliveryNoteScan.ocr",
        entity: "DeliveryNoteScan",
        entityId: scanId,
        newValue: {
          source: "ai_ocr",
          supplierName: extraction.supplierName,
          deliveryNoteNo: extraction.deliveryNoteNo,
          lineCount: lines.length,
          recognized: lines.map((l) => ({
            name: l.recognizedName,
            qty: l.quantity,
            matchStatus: l.matchStatus,
            matchConfidence: l.matchConfidence,
            productId: l.productId,
          })),
          duplicates: duplicates.length,
        },
      },
    });

    return { scan: updated, duplicates };
  } catch (e) {
    const message = e instanceof Error ? e.message : "OCR_FAILED";
    await prisma.deliveryNoteScan.update({
      where: { id: scanId },
      data: {
        status: "FAILED",
        ocrStatus: "FAILED",
        ocrError: message,
      },
    });
    await prisma.auditLog.create({
      data: {
        hotelId: user.hotelId,
        userId: user.id,
        action: "deliveryNoteScan.ocrFailed",
        entity: "DeliveryNoteScan",
        entityId: scanId,
        newValue: { error: message },
      },
    });
    throw e instanceof Error ? e : new Error("OCR_FAILED");
  }
}

export async function updateDeliveryNoteScan(
  user: SessionUser,
  scanId: string,
  input: UpdateDeliveryNoteScanInput
) {
  assertSessionHotelId(user);
  const scan = await prisma.deliveryNoteScan.findFirst({
    where: { id: scanId, hotelId: user.hotelId },
  });
  if (!scan) throw new Error("SCAN_NOT_FOUND");
  if (scan.status !== "REVIEW" && scan.status !== "FAILED") {
    throw new Error("SCAN_NOT_EDITABLE");
  }

  const oldLines = (scan.extractedLines ?? []) as DeliveryNoteReviewLine[];
  const data: Prisma.DeliveryNoteScanUpdateInput = {};
  if (input.supplierId !== undefined) {
    if (input.supplierId) {
      const s = await prisma.supplier.findFirst({
        where: { id: input.supplierId, hotelId: user.hotelId },
      });
      if (!s) throw new Error("SUPPLIER_NOT_FOUND");
      data.supplier = { connect: { id: input.supplierId } };
    } else {
      data.supplier = { disconnect: true };
    }
  }
  if (input.deliveryNoteNo !== undefined) {
    data.deliveryNoteNo = input.deliveryNoteNo;
  }
  if (input.deliveryDate !== undefined) {
    data.deliveryDate = input.deliveryDate
      ? new Date(input.deliveryDate)
      : null;
  }
  if (input.extractedLines) {
    data.extractedLines = input.extractedLines as unknown as Prisma.InputJsonValue;
    if (scan.status === "FAILED") data.status = "REVIEW";
  }

  const updated = await prisma.deliveryNoteScan.update({
    where: { id: scanId },
    data,
    include: scanInclude,
  });

  await prisma.auditLog.create({
    data: {
      hotelId: user.hotelId,
      userId: user.id,
      action: "deliveryNoteScan.correct",
      entity: "DeliveryNoteScan",
      entityId: scanId,
      oldValue: {
        source: "ai_ocr",
        lines: oldLines.map((l) => ({
          id: l.id,
          productId: l.productId,
          quantity: l.quantity,
          matchStatus: l.matchStatus,
        })),
      },
      newValue: {
        source: "human_correction",
        supplierId: updated.supplierId,
        deliveryNoteNo: updated.deliveryNoteNo,
        lines: ((updated.extractedLines ?? []) as DeliveryNoteReviewLine[]).map(
          (l) => ({
            id: l.id,
            productId: l.productId,
            quantity: l.quantity,
            matchStatus: l.matchStatus,
            excluded: l.excluded,
          })
        ),
      },
    },
  });

  return updated;
}

function activeLines(lines: DeliveryNoteReviewLine[]) {
  return lines.filter((l) => !l.excluded);
}

function validateConfirmableLines(lines: DeliveryNoteReviewLine[]) {
  const active = activeLines(lines);
  if (active.length === 0) throw new Error("NO_LINES_TO_BOOK");
  for (const line of active) {
    if (!line.productId || line.matchStatus === "unmatched") {
      throw new Error("UNMATCHED_PRODUCT");
    }
    if (!(line.quantity > 0)) throw new Error("INVALID_QUANTITY");
  }
  return active;
}

/**
 * One-button booking: validate → create goods receipt → stock PURCHASE on Lager
 * → link document → audit. Fully transactional; no partial stock updates.
 */
export async function confirmDeliveryNoteScan(
  user: SessionUser,
  scanId: string,
  input: ConfirmDeliveryNoteScanInput
) {
  assertSessionHotelId(user);
  if (input.extractedLines || input.supplierId || input.deliveryNoteNo !== undefined) {
    await updateDeliveryNoteScan(user, scanId, {
      supplierId: input.supplierId,
      deliveryNoteNo: input.deliveryNoteNo,
      deliveryDate: input.deliveryDate,
      extractedLines: input.extractedLines,
    });
  }

  const scan = await prisma.deliveryNoteScan.findFirst({
    where: { id: scanId, hotelId: user.hotelId },
    include: { pages: true },
  });
  if (!scan) throw new Error("SCAN_NOT_FOUND");
  if (scan.status === "CONFIRMED") {
    return getDeliveryNoteScan(user, scanId);
  }
  if (scan.status !== "REVIEW") throw new Error("SCAN_NOT_READY");

  const supplierId = input.supplierId ?? scan.supplierId;
  if (!supplierId) throw new Error("SUPPLIER_REQUIRED");

  const lines = (input.extractedLines ??
    scan.extractedLines ??
    []) as DeliveryNoteReviewLine[];
  const toBook = validateConfirmableLines(lines);

  const deliveryNoteNo =
    input.deliveryNoteNo !== undefined
      ? input.deliveryNoteNo
      : scan.deliveryNoteNo;

  const duplicates = await findDuplicateDeliveryNotes(user.hotelId, {
    documentHash: scan.documentHash,
    supplierId,
    deliveryNoteNo,
    excludeScanId: scanId,
  });
  if (duplicates.length > 0 && !input.acknowledgeDuplicate) {
    const err = new Error("DUPLICATE_DELIVERY_NOTE");
    (err as Error & { duplicates: typeof duplicates }).duplicates = duplicates;
    throw err;
  }

  const warehouse = await getCentralWarehouse(user.hotelId);

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.deliveryNoteScan.updateMany({
      where: { id: scanId, hotelId: user.hotelId, status: "REVIEW" },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new Error("SCAN_NOT_CONFIRMABLE");
    }

    const receipt = await tx.goodsReceipt.create({
      data: {
        hotelId: user.hotelId,
        warehouseId: warehouse.id,
        supplierId,
        deliveryNoteNo: deliveryNoteNo ?? null,
        notes: `Lieferschein-Scan ${scanId}`,
        status: "CONFIRMED",
        confirmedAt: new Date(),
        createdById: user.id,
        receivedAt: scan.deliveryDate ?? new Date(),
        items: {
          create: toBook.map((line) => ({
            productId: line.productId!,
            qtyOrdered: d(line.quantity),
            qtyDelivered: d(line.quantity),
            qtyDamaged: d(0),
            qtyMissing: d(0),
            purchasePrice: d(line.purchasePrice ?? 0),
            expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
            batchNo: line.batchNo ?? null,
          })),
        },
      },
      include: { items: true },
    });

    for (const item of receipt.items) {
      const stockQty = item.qtyDelivered.sub(item.qtyDamaged);
      if (stockQty.lte(0)) continue;

      await applyStockChange(tx, {
        hotelId: user.hotelId,
        productId: item.productId,
        warehouseId: warehouse.id,
        userId: user.id,
        delta: stockQty,
        type: "PURCHASE",
        reason: `Wareneingang ${receipt.deliveryNoteNo ?? receipt.id}`,
        referenceType: "GoodsReceipt",
        referenceId: receipt.id,
      });

      await tx.product.update({
        where: { id: item.productId },
        data: { purchasePrice: item.purchasePrice },
      });

      await tx.supplierProduct.create({
        data: {
          supplierId,
          productId: item.productId,
          purchasePrice: item.purchasePrice,
          supplierSku:
            toBook.find((l) => l.productId === item.productId)
              ?.recognizedSupplierSku ?? null,
        },
      });
    }

    await tx.deliveryNoteScan.update({
      where: { id: scanId },
      data: {
        goodsReceiptId: receipt.id,
        supplierId,
        deliveryNoteNo: deliveryNoteNo ?? null,
        extractedLines: lines as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.auditLog.create({
      data: {
        hotelId: user.hotelId,
        userId: user.id,
        action: "deliveryNoteScan.confirm",
        entity: "DeliveryNoteScan",
        entityId: scanId,
        newValue: {
          source: "human_confirmed",
          goodsReceiptId: receipt.id,
          deliveryNoteNo,
          documentHash: scan.documentHash,
          pageCount: scan.pages.length,
          acknowledgedDuplicate: !!input.acknowledgeDuplicate,
          finalLines: toBook.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            quantity: l.quantity,
            unit: l.unit,
            purchasePrice: l.purchasePrice,
            matchMethod: l.matchMethod,
            matchConfidence: l.matchConfidence,
          })),
          inventoryMovements: {
            type: "PURCHASE",
            referenceType: "GoodsReceipt",
            referenceId: receipt.id,
          },
        },
      },
    });

    return tx.deliveryNoteScan.findFirstOrThrow({
      where: { id: scanId },
      include: scanInclude,
    });
  });
}
