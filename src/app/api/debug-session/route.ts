import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function GET() {
  const h = await headers();
  const cookieHeader = h.get("cookie") ?? "(no cookie header)";
  const hasSessionCookie = cookieHeader.includes("better-auth") || cookieHeader.includes("session");
  const session = await auth.api.getSession({ headers: h });
  return Response.json({
    hasCookieHeader: !!h.get("cookie"),
    cookiePreview: cookieHeader.slice(0, 100) + (cookieHeader.length > 100 ? "..." : ""),
    hasSessionCookie,
    session: session ? { user: session.user?.email } : null,
  });
}
