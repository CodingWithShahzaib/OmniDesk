import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (session?.user) {
    redirect("/timesheet");
  }
  redirect("/sign-in");
}
