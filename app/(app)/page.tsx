import { OverviewScreen } from "@/components/overview-screen";
import { PartnerCalendarScreen } from "@/components/partner-calendar-screen";
import { getResolvedSessionUser } from "@/lib/server/erpnext";
import { isPartnerCalendarUser, readSessionUser } from "@/lib/session";
import { cookies } from "next/headers";

export default async function OverviewPage() {
  const cookieStore = await cookies();
  const user = await getResolvedSessionUser(readSessionUser(cookieStore), cookieStore.get("erpnext_sid")?.value);
  return isPartnerCalendarUser(user) ? <PartnerCalendarScreen /> : <OverviewScreen />;
}
