"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAction } from "@/lib/client";
import type { Task, TasksData } from "@/lib/types";
import { statusBadgeClass } from "@/lib/utils";
import { EmptyState, InputShell, LoadingState, Panel } from "@/components/ui";

export function TasksScreen() {
  const [payload, setPayload] = useState<TasksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const response = await fetchAction<TasksData>("tasks");
      setPayload(response.data);
      setLoading(false);
    })();
  }, []);

  const filteredTasks = useMemo(() => {
    if (!payload?.tasks) {
      return [];
    }

    return payload.tasks.filter((task) => {
      if (status !== "all" && task.status !== status) {
        return false;
      }

      if (!search.trim()) {
        return true;
      }

      return [task.subject, task.customerName, task.projectName, task.taskId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());
    });
  }, [payload?.tasks, search, status]);

  if (loading) {
    return <LoadingState label="Loading tasks..." />;
  }

  if (!payload) {
    return <EmptyState title="Tasks unavailable" copy="No task data was returned from the API." />;
  }

  const kpis = [
    { label: "Assigned", value: payload.summary.assigned, gradientClass: "primary-gradient" },
    { label: "Pending", value: payload.summary.pending, gradientClass: "warning-gradient" },
    { label: "Completed", value: payload.summary.completed, gradientClass: "success-gradient" },
    { label: "Overdue", value: payload.summary.overdue, gradientClass: "danger-gradient" }
  ];

  return (
    <div className="screen-stack screen-stack--single">
      <Panel>
        <div className="panel-title-row">
          <div>
            <h2 className="panel-title">Assigned Tasks</h2>
            <p className="panel-subtitle">Search, filter, and review the work assigned to you.</p>
          </div>
        </div>

        <div className="kpi-grid">
          {kpis.map((item) => (
            <article key={item.label} className="kpi-card tasks-kpi-card">
              <div className="kpi-top">
                <p className="kpi-label">{item.label}</p>
                <span className={`kpi-dot ${item.gradientClass}`} aria-hidden="true" />
              </div>
              <span className="kpi-value">{item.value}</span>
            </article>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="search-row filter-toolbar toolbar-row desktop-sticky-toolbar">
          <InputShell className="search-field">
            <Search size={18} color="var(--muted)" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by task, customer, or project"
            />
          </InputShell>

          <InputShell className="filter-select-shell">
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              {[...new Set(payload.tasks.map((task) => task.status))].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </InputShell>
        </div>

        {filteredTasks.length === 0 ? (
          <EmptyState title="No tasks found" copy="Try changing the status filter or search text." />
        ) : (
          <div className="list-stack">
            {filteredTasks.map((task: Task) => (
              <article key={task.taskId} className="list-card">
                <div className="list-head">
                  <div className="list-head-copy">
                    <h3 className="list-title">{task.subject}</h3>
                    <p className="panel-subtitle">{task.customerName || "No customer"}</p>
                  </div>
                  <span className={`badge ${statusBadgeClass(task.status, task.isOverdue)}`}>{task.status}</span>
                </div>

                <p className="list-description task-supporting-copy">
                  Project: {task.projectName || "No project"} | Owner: {task.ownerName || "Not set"}
                </p>

                <div className="list-meta muted-row list-meta-wrap meta-row-spaced">
                  <span>ID {task.taskId}</span>
                  <span>Due {task.expEndDate || "-"}</span>
                  <span>{task.customProjectType || "General"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
