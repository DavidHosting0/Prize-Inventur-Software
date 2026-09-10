import { PrismaClient } from "@prisma/client";
import { buildReportPdf, buildSalesWorkbook } from "../src/lib/exports";

const prisma = new PrismaClient();

async function main() {
  const hotel = await prisma.hotel.findFirstOrThrow();
  const xlsx = await buildSalesWorkbook(hotel.id, 14);
  const pdf = await buildReportPdf(hotel.id, 14);
  const xlen = Buffer.isBuffer(xlsx)
    ? xlsx.byteLength
    : (xlsx as ArrayBuffer).byteLength;
  console.log("VERIFY_EXPORTS_OK", { xlsx: xlen, pdf: pdf.byteLength });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
