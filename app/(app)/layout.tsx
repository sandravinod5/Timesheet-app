import { AppShell } from "@/components/app-shell";
import { getResolvedSessionUser } from "@/lib/server/erpnext";
import { readSessionUser } from "@/lib/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const hasAuth = cookieStore.get("task_mobile_authenticated");
  const hasUser = cookieStore.get("task_mobile_user");
  const hasEncodedUser = cookieStore.get("task_mobile_user_encoded");
  const hasSid = cookieStore.get("erpnext_sid");

  if (!hasAuth && !hasUser && !hasEncodedUser && !hasSid) {
    redirect("/login");
  }

  const user = await getResolvedSessionUser(readSessionUser(cookieStore), hasSid?.value);

  return <AppShell user={user}>{children}</AppShell>;
}
