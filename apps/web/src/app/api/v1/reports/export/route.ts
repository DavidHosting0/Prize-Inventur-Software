import { NextResponse } from "next/server";
import {
  assertPermission,
  getSessionUser,
  isNextResponse,
  jsonError,
} from "@/lib/api";
import { requireHotelContext } from "@/lib/tenant";
import { buildReportPdf, buildSalesWorkbook } from "@/lib/exports";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return jsonError("Unauthorized", 401);
    assertPermission(user, "reports.view");
    const { hotelId } = await requireHotelContext(user);

    const url = new URL(req.url);
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 30)));
    const format = (url.searchParams.get("format") ?? "xlsx").toLowerCase();

    if (format === "pdf") {
      const bytes = await buildReportPdf(hotelId, days);
      return new NextResponse(Buffer.from(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="prize-report-${days}d.pdf"`,
        },
      });
    }

    if (format === "xlsx" || format === "excel") {
      const buffer = await buildSalesWorkbook(hotelId, days);
      return new NextResponse(Buffer.from(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="prize-report-${days}d.xlsx"`,
        },
      });
    }

    return jsonError("Unsupported format (xlsx|pdf|csv via /reports/summary)", 400);
  } catch (e) {
    if (isNextResponse(e)) return e;
    console.error(e);
    return jsonError("Server error", 500);
  }
}
