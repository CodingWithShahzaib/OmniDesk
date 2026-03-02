import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportMonth } from "@/lib/timesheet";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { message: "Invalid month format. Use YYYY-MM" },
      { status: 400 }
    );
  }

  const buffer = await exportMonth(session.user.id, month);
  const filename = `OmniDesk_Timesheet_${month}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
