import { ReportsScreen } from "@/components/reports-screen";
import { EmptyState, Panel } from "@/components/ui";
import { getResolvedSessionUser } from "@/lib/server/erpnext";
import { isPartnerCalendarUser, readSessionUser } from "@/lib/session";
import { cookies } from "next/headers";

export default async function ReportsPage() {
  const cookieStore = await cookies();
  const user = await getResolvedSessionUser(readSessionUser(cookieStore), cookieStore.get("erpnext_sid")?.value);

  if (isPartnerCalendarUser(user)) {
    return (
      <div className="screen-stack screen-stack--single">
        <Panel>
          <EmptyState title="Coming soon" copy="Reports will be available here soon." />
        </Panel>
      </div>
    );
  }

  return <ReportsScreen />;
}
