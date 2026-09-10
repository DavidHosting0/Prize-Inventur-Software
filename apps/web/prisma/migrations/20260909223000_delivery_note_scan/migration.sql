-- AlterTable
ALTER TABLE "SupplierProduct" ADD COLUMN "supplierSku" TEXT;

-- CreateIndex
CREATE INDEX "SupplierProduct_supplierId_supplierSku_idx" ON "SupplierProduct"("supplierId", "supplierSku");

-- CreateIndex
CREATE INDEX "GoodsReceipt_hotelId_supplierId_deliveryNoteNo_idx" ON "GoodsReceipt"("hotelId", "supplierId", "deliveryNoteNo");

-- CreateEnum
CREATE TYPE "DeliveryNoteScanStatus" AS ENUM ('CAPTURING', 'PROCESSING', 'REVIEW', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DeliveryNoteScan" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "status" "DeliveryNoteScanStatus" NOT NULL DEFAULT 'CAPTURING',
    "supplierId" TEXT,
    "deliveryNoteNo" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "documentHash" TEXT,
    "ocrStatus" TEXT,
    "ocrError" TEXT,
    "ocrRawResult" JSONB,
    "extractedLines" JSONB,
    "goodsReceiptId" TEXT,
    "createdById" TEXT,
    "processedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryNoteScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryNotePage" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "pageIndex" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryNotePage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryNoteScan_goodsReceiptId_key" ON "DeliveryNoteScan"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "DeliveryNoteScan_hotelId_status_idx" ON "DeliveryNoteScan"("hotelId", "status");

-- CreateIndex
CREATE INDEX "DeliveryNoteScan_hotelId_documentHash_idx" ON "DeliveryNoteScan"("hotelId", "documentHash");

-- CreateIndex
CREATE INDEX "DeliveryNoteScan_hotelId_supplierId_deliveryNoteNo_idx" ON "DeliveryNoteScan"("hotelId", "supplierId", "deliveryNoteNo");

-- CreateIndex
CREATE INDEX "DeliveryNoteScan_createdById_idx" ON "DeliveryNoteScan"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryNotePage_scanId_pageIndex_key" ON "DeliveryNotePage"("scanId", "pageIndex");

-- CreateIndex
CREATE INDEX "DeliveryNotePage_scanId_idx" ON "DeliveryNotePage"("scanId");

-- AddForeignKey
ALTER TABLE "DeliveryNoteScan" ADD CONSTRAINT "DeliveryNoteScan_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNoteScan" ADD CONSTRAINT "DeliveryNoteScan_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNoteScan" ADD CONSTRAINT "DeliveryNoteScan_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryNotePage" ADD CONSTRAINT "DeliveryNotePage_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "DeliveryNoteScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
