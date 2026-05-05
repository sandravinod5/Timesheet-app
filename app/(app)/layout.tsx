import { AppShell } from "@/components/app-shell";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const hasUser = cookieStore.get("task_mobile_user");
  const hasSid = cookieStore.get("erpnext_sid");

  if (!hasUser && !hasSid) {
    redirect("/login");
  }

  let user:
    | {
        email?: string;
        displayName?: string;
      }
    | null = null;

  if (hasUser?.value) {
    try {
      user = JSON.parse(hasUser.value) as { email?: string; displayName?: string };
    } catch {
      user = null;
    }
  }

  return <AppShell user={user}>{children}</AppShell>;
}
