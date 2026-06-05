"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAction } from "@/lib/client";
import { useToast } from "@/components/toast-provider";
import type { Task, TaskFormOptionsData, TasksData } from "@/lib/types";
import { statusBadgeClass } from "@/lib/utils";
import { Button, EmptyState, InputShell, LoadingState, Modal, Panel } from "@/components/ui";

const EMPTY_TASK_FORM_OPTIONS: TaskFormOptionsData = {
  projectTypes: [],
  statuses: [],
  statusesByProjectType: {},
  customers: [],
  projects: [],
  months: [],
  reports: []
};

export function TasksScreen() {
  const { showToast } = useToast();
  const [payload, setPayload] = useState<TasksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [customer, setCustomer] = useState("all");
  const [project, setProject] = useState("all");
  const [taskFormOptions, setTaskFormOptions] = useState<TaskFormOptionsData>(EMPTY_TASK_FORM_OPTIONS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedStatusValue, setSelectedStatusValue] = useState("");
  const [statusModalLoading, setStatusModalLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
      const cardStatus = task.customCustomStatus || task.status;

      if (status !== "all" && cardStatus !== status) {
        return false;
      }

      if (customer !== "all" && (task.customerId || "no-customer") !== customer) {
        return false;
      }

      if (project !== "all" && (task.project || "no-project") !== project) {
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
  }, [payload?.tasks, search, status, customer, project]);

  const selectedTask = useMemo(
    () => payload?.tasks.find((task) => task.taskId === selectedTaskId) ?? null,
    [payload?.tasks, selectedTaskId]
  );

  const selectedTaskStatus = selectedTask?.customCustomStatus || selectedTask?.status || "";
  const selectedTaskStatusOptions = useMemo(() => {
    if (!selectedTask) {
      return [];
    }

    const mapped = taskFormOptions.statusesByProjectType[selectedTask.customProjectType || ""] || [];
    const source = mapped.length > 0 ? mapped : taskFormOptions.statuses;

    return [...source].sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedTask, taskFormOptions]);

  const openStatusModal = async (task: Task) => {
    setSelectedTaskId(task.taskId);
    setSelectedStatusValue(task.customCustomStatus || task.status || "");
    setStatusModalLoading(true);

    try {
      const response = await fetchAction<TaskFormOptionsData>("task_form_options");
      setTaskFormOptions(response.data);
    } catch (err) {
      setTaskFormOptions(EMPTY_TASK_FORM_OPTIONS);
      showToast({
        title: "Status options unavailable",
        message: err instanceof Error ? err.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setStatusModalLoading(false);
    }
  };

  const closeStatusModal = () => {
    if (updatingStatus) {
      return;
    }

    setSelectedTaskId(null);
    setSelectedStatusValue("");
  };

  const updateTaskStatus = async () => {
    if (!selectedTask || !selectedStatusValue) {
      return;
    }

    setUpdatingStatus(true);

    try {
      await fetchAction(
        "update_task_status",
        {
          task_id: selectedTask.taskId,
          status: selectedStatusValue
        },
        "POST"
      );

      setPayload((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          tasks: current.tasks.map((task) =>
            task.taskId === selectedTask.taskId
              ? {
                  ...task,
                  status: selectedStatusValue,
                  customCustomStatus: selectedStatusValue
                }
              : task
          )
        };
      });

      showToast({
        title: "Task status updated",
        message: `${selectedTask.subject} is now ${selectedStatusValue}.`,
        variant: "success"
      });
      closeStatusModal();
    } catch (err) {
      showToast({
        title: "Unable to update task status",
        message: err instanceof Error ? err.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

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
              {[...new Set(payload.tasks.map((task) => task.customCustomStatus || task.status).filter(Boolean))].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </InputShell>

          <InputShell className="filter-select-shell">
            <select value={customer} onChange={(event) => setCustomer(event.target.value)}>
              <option value="all">All customers</option>
              {[...new Map(
                payload.tasks
                  .map((task) => [task.customerId || "no-customer", task.customerName || "No customer"] as const)
              ).entries()].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </InputShell>

          <InputShell className="filter-select-shell">
            <select value={project} onChange={(event) => setProject(event.target.value)}>
              <option value="all">All projects</option>
              {[...new Map(
                payload.tasks
                  .map((task) => [task.project || "no-project", task.projectName || "No project"] as const)
              ).entries()].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </InputShell>

        </div>

        {filteredTasks.length === 0 ? (
          <EmptyState title="No tasks found" copy="Try changing the status filter or search text." />
        ) : (
          <div className="list-stack">
            {filteredTasks.map((task: Task) => {
              const cardStatus = task.customCustomStatus || task.status;

              return (
                <article
                  key={task.taskId}
                  className="list-card"
                  onClick={() => void openStatusModal(task)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openStatusModal(task);
                    }
                  }}
                >
                  <div className="list-head">
                    <div className="list-head-copy">
                      <h3 className="list-title">{task.subject}</h3>
                      <p className="panel-subtitle">{task.customerName || "No customer"}</p>
                    </div>
                    <span className={`badge ${statusBadgeClass(cardStatus, task.isOverdue)}`}>{cardStatus}</span>
                  </div>

                  <p className="list-description task-supporting-copy">
                    Project: {task.projectName || "No project"} | Owner: {task.ownerName || "Not set"}
                  </p>

                  <div className="list-meta muted-row list-meta-wrap meta-row-spaced">
                    <span>ID {task.taskId}</span>
                    <span>Due {task.expEndDate || "-"}</span>
                    <span>{cardStatus || "-"}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      {selectedTask ? (
        <Modal
          title="Update Task Status"
          subtitle="Change the current custom status for this task."
          onClose={closeStatusModal}
        >
          <div className="draft-edit-form">
            <div className="draft-edit-row draft-edit-row--full">
              <label className="report-date-label">Task</label>
              <p className="panel-title">{selectedTask.subject}</p>
            </div>
            <div className="draft-edit-row draft-edit-row--full">
              <label className="report-date-label">Current Status</label>
              <p className="panel-subtitle">{selectedTaskStatus || "No current status"}</p>
            </div>
            <div className="draft-edit-row draft-edit-row--full">
              <label className="report-date-label">Update Status</label>
              {statusModalLoading ? (
                <p className="panel-subtitle">Loading status options...</p>
              ) : (
                <label className="input-shell">
                  <select
                    value={selectedStatusValue}
                    onChange={(event) => setSelectedStatusValue(event.target.value)}
                    aria-label="Update task custom status"
                    disabled={updatingStatus}
                  >
                    <option value="">Select status</option>
                    {selectedTaskStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="button-row button-row-end">
              <Button type="button" variant="secondary" onClick={closeStatusModal} disabled={updatingStatus}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void updateTaskStatus()}
                disabled={statusModalLoading || updatingStatus || !selectedStatusValue}
              >
                {updatingStatus ? "Updating..." : "Update Status"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
