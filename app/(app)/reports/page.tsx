import { EmptyState, Panel } from "@/components/ui";

export default function ReportsPage() {
  return (
    <div className="screen-stack screen-stack--single">
      <Panel>
        <EmptyState title="Coming soon" copy="Reports will be available here soon." />
      </Panel>
    </div>
  );
}
