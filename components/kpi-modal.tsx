"use client";

import { Modal } from "@/components/ui";
import type { Task } from "@/lib/types";
import { statusBadgeClass } from "@/lib/utils";
import { EmptyState } from "@/components/ui";

const titleMap: Record<string, string> = {
  assigned: "Assigned Tasks",
  pending: "Pending Tasks",
  in_progress: "In Progress Tasks",
  completed: "Completed Tasks",
  overdue: "Overdue Tasks",
  total: "All Tasks"
};

function filterTasks(tasks: Task[], type: string) {
  if (type === "completed") {
    return tasks.filter((task) => ["Completed", "Closed"].includes(task.status));
  }

  if (type === "overdue") {
    return tasks.filter((task) => Boolean(task.isOverdue));
  }

  if (type === "in_progress") {
    return tasks.filter((task) =>
      [
        "Working",
        "In Progress",
        "Under Execution",
        "Under Review",
        "In Progress With BO",
        "Revising Report BO"
      ].includes(task.status)
    );
  }

  if (type === "pending") {
    return tasks.filter(
      (task) =>
        !["Completed", "Closed"].includes(task.status) &&
        ![
          "Working",
          "In Progress",
          "Under Execution",
          "Under Review",
          "In Progress With BO",
          "Revising Report BO"
        ].includes(task.status)
    );
  }

  return tasks;
}

export function KpiModal({
  type,
  tasks,
  onClose
}: {
  type: string;
  tasks: Task[];
  onClose: () => void;
}) {
  const filteredTasks = filterTasks(tasks, type);

  return (
    <Modal
      title={titleMap[type] || "Tasks"}
      subtitle={`${filteredTasks.length} matching records`}
      onClose={onClose}
    >
      {filteredTasks.length === 0 ? (
        <EmptyState title="No matching tasks" copy="This KPI does not currently have any task records." />
      ) : (
        <div className="list-stack modal-list-stack kpi-modal-stack">
          {filteredTasks.map((task) => (
            <article key={task.taskId} className="list-card kpi-task-card">
              <div className="list-head kpi-task-head">
                <div className="list-head-copy">
                  <h4 className="list-title kpi-task-title">{task.subject}</h4>
                  <p className="panel-subtitle kpi-task-subtitle">{task.customerName || "No customer"}</p>
                </div>
                <span className={`badge kpi-task-badge ${statusBadgeClass(task.status, task.isOverdue)}`}>
                  {task.status}
                </span>
              </div>
              <div className="list-meta muted-row list-meta-wrap kpi-task-meta">
                <span>{task.projectName || "No project"}</span>
                <span>Due {task.expEndDate || "-"}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </Modal>
  );
}
