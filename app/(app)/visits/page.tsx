import { isPartnerCalendarUser, readSessionUser } from "@/lib/session";
import { VisitsScreen } from "@/components/visits-screen";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function VisitsPage() {
  if (isPartnerCalendarUser(readSessionUser(await cookies()))) {
    redirect("/");
  }

  return <VisitsScreen />;
}
