import { AppShell } from "@/components/app-shell";
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

  let user:
    | {
        email?: string;
        displayName?: string;
      }
    | null = null;

  if (hasEncodedUser?.value) {
    try {
      user = JSON.parse(decodeURIComponent(hasEncodedUser.value)) as { email?: string; displayName?: string };
    } catch {
      user = null;
    }
  }

  if (!user && hasUser?.value) {
    try {
      user = JSON.parse(hasUser.value) as { email?: string; displayName?: string };
    } catch {
      user = null;
    }
  }

  return <AppShell user={user}>{children}</AppShell>;
}
