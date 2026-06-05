"use client";

import { Briefcase, Building2, CheckCircle2, ClipboardCheck, FileText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, Modal } from "@/components/ui";
import type { ActivityTypeOption, Task } from "@/lib/types";
import { statusBadgeClass } from "@/lib/utils";

export function TimerModal({
  open,
  tasks,
  activityTypes,
  onClose,
  onStart
}: {
  open: boolean;
  tasks: Task[];
  activityTypes: ActivityTypeOption[];
  onClose: () => void;
  onStart: (task: Task, activityType: string, notes: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedParentGroup, setSelectedParentGroup] = useState<string | null>(null);
  const [selectedActivityType, setSelectedActivityType] = useState<string | null>(null);
  const [activitySearch, setActivitySearch] = useState("");
  const [notes, setNotes] = useState("");
  const [starting, setStarting] = useState(false);

  const filteredTasks = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (["Completed", "Closed"].includes(task.status)) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [task.subject, task.taskId, task.customerName, task.projectName, task.project]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [search, tasks]);

  const handleClose = () => {
    if (starting) {
      return;
    }
    setSelectedTask(null);
    setSelectedParentGroup(null);
    setSelectedActivityType(null);
    setSearch("");
    setActivitySearch("");
    setNotes("");
    onClose();
  };

  const availableActivityTypes =
    activityTypes.length > 0 ? activityTypes : [{ name: "Working", customParentGroup: "Internal (Others)" }];

  const parentConfig = [
    { name: "Visit", icon: Building2 },
    { name: "Internal (Others)", icon: Briefcase },
    { name: "Review", icon: ClipboardCheck },
    { name: "Finalisation", icon: CheckCircle2 },
    { name: "Drafting", icon: FileText }
  ] as const;

  const parentGroups = useMemo(() => {
    const defined = new Set(
      availableActivityTypes
        .map((item) => (item.customParentGroup || "").trim())
        .filter(Boolean)
    );

    const ordered = parentConfig.filter((item) => defined.has(item.name));
    const extras = [...defined]
      .filter((value) => !parentConfig.some((item) => item.name === value))
      .map((name) => ({ name, icon: Briefcase }));

    return [...ordered, ...extras];
  }, [availableActivityTypes]);

  const selectedParentLabel = selectedParentGroup || parentGroups[0]?.name || "Internal (Others)";

  const filteredActivityTypes = useMemo(() => {
    const normalized = activitySearch.trim().toLowerCase();
    const parentValue = (selectedParentGroup || "").trim().toLowerCase();

    const typesForParent = availableActivityTypes
      .filter((item) => (item.customParentGroup || "").trim().toLowerCase() === parentValue)
      .map((item) => item.name);

    if (!normalized) {
      return typesForParent;
    }

    return typesForParent.filter((type) => type.toLowerCase().includes(normalized));
  }, [activitySearch, availableActivityTypes, selectedParentGroup]);

  if (!open) {
    return null;
  }

  // Step 4 - description + start
  if (selectedTask && selectedActivityType) {
    return (
      <Modal
        title="Add Description"
        subtitle={`${selectedTask.subject} | ${selectedParentLabel} | ${selectedActivityType}`}
        onClose={handleClose}
        onBack={() => {
          setSelectedActivityType(null);
          setNotes("");
        }}
      >
        <div className="draft-edit-row draft-edit-row--full" style={{ marginBottom: "1.25rem" }}>
          <label className="report-date-label">Description (optional)</label>
          <textarea
            className="draft-edit-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What are you working on?"
            rows={4}
            autoFocus
          />
        </div>
        <button
          type="button"
          className="timer-action-button timer-action-button-start"
          style={{ width: "100%" }}
          disabled={starting}
          onClick={() => {
            setStarting(true);
            void onStart(selectedTask, selectedActivityType, notes).finally(() => {
              setStarting(false);
            });
          }}
        >
          {starting ? "Starting..." : "Start Timer"}
        </button>
      </Modal>
    );
  }

  // Step 3 - activity type
  if (selectedTask && selectedParentGroup) {
    return (
      <Modal
        title="Select Activity Type"
        subtitle={`${selectedTask.subject} | ${selectedParentLabel}`}
        onClose={handleClose}
        onBack={() => {
          setSelectedParentGroup(null);
          setActivitySearch("");
        }}
      >
        <label className="input-shell modal-search">
          <Search size={18} color="var(--muted)" />
          <input
            placeholder="Search activity type"
            value={activitySearch}
            onChange={(event) => setActivitySearch(event.target.value)}
          />
        </label>

        {filteredActivityTypes.length === 0 ? (
          <EmptyState title="No activity found" copy="Try a different activity name or clear the search." />
        ) : (
          <div className="list-stack modal-list-stack">
            {filteredActivityTypes.map((type) => (
              <button
                key={type}
                className="list-card"
                style={{ textAlign: "left" }}
                type="button"
                onClick={() => setSelectedActivityType(type)}
              >
                <div className="list-head">
                  <h4 className="list-title">{type}</h4>
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>
    );
  }

  // Step 2 - parent group selection
  if (selectedTask) {
    return (
      <Modal title="Select Parent Group" subtitle={selectedTask.subject} onClose={handleClose} onBack={() => setSelectedTask(null)}>
        {parentGroups.length === 0 ? (
          <EmptyState title="No parent groups found" copy="Please map activity types with custom_parent_group in Activity Type." />
        ) : (
          <div className="timer-parent-grid">
            {parentGroups.map((parent) => {
              const Icon = parent.icon;
              return (
                <button
                  key={parent.name}
                  className="list-card timer-parent-card"
                  type="button"
                  onClick={() => {
                    setSelectedParentGroup(parent.name);
                    setActivitySearch("");
                  }}
                >
                  <div className="timer-parent-card-icon">
                    <Icon size={20} />
                  </div>
                  <h4 className="list-title">{parent.name}</h4>
                </button>
              );
            })}
          </div>
        )}
      </Modal>
    );
  }

  // Step 1 - task selection
  return (
    <Modal title="Start Timer" subtitle="Pick one of your active tasks" onClose={handleClose}>
      <label className="input-shell modal-search">
        <Search size={18} color="var(--muted)" />
        <input
          placeholder="Search by task, customer, or project"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      {filteredTasks.length === 0 ? (
        <EmptyState title="No tasks found" copy="Try task name, customer name, or project name." />
      ) : (
        <div className="list-stack modal-list-stack">
          {filteredTasks.map((task) => (
            <button
              key={task.taskId}
              className="list-card timer-task-card"
              style={{ textAlign: "left" }}
              type="button"
              onClick={() => setSelectedTask(task)}
            >
              <div className="list-head">
                <div className="list-head-copy">
                  <h4 className="list-title timer-task-title">{task.subject}</h4>
                  <p className="panel-subtitle timer-task-subtitle">{task.customerName || "No customer"}</p>
                </div>
                <span className={`badge timer-task-badge ${statusBadgeClass(task.status, task.isOverdue)}`}>
                  {task.status}
                </span>
              </div>
              <div className="muted-row task-supporting-copy timer-task-meta" style={{ marginTop: "0.8rem" }}>
                {task.projectName || "No project"}
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
