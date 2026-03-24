import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildAttachmentContentDisposition } from "@/lib/content-disposition";
import { exportMonth, exportMonthCsv } from "@/lib/timesheet";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const formatParam = searchParams.get("format");
  const format = (formatParam?.toLowerCase().trim() || "xlsx");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { message: "Invalid month format. Use YYYY-MM" },
      { status: 400 }
    );
  }

  if (format !== "xlsx" && format !== "csv") {
    return NextResponse.json(
      { message: "Invalid format. Use xlsx or csv" },
      { status: 400 }
    );
  }

  try {
    if (format === "csv") {
      const buffer = await exportMonthCsv(session.user.id, month);
      const filename = `OmniDesk_Timesheet_${month}.csv`;
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": buildAttachmentContentDisposition(filename),
          "Cache-Control": "no-store",
        },
      });
    }

    const buffer = await exportMonth(session.user.id, month);
    const filename = `OmniDesk_Timesheet_${month}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": buildAttachmentContentDisposition(filename),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    if (message === "User not found") {
      return NextResponse.json({ message }, { status: 404 });
    }
    console.error("[timesheet/export]", err);
    return NextResponse.json({ message: "Export failed" }, { status: 500 });
  }
}
