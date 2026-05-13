"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, Modal } from "@/components/ui";
import type { Task } from "@/lib/types";
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
  activityTypes: string[];
  onClose: () => void;
  onStart: (task: Task, activityType: string, notes: string) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedActivityType, setSelectedActivityType] = useState<string | null>(null);
  const [activitySearch, setActivitySearch] = useState("");
  const [notes, setNotes] = useState("");

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
    setSelectedTask(null);
    setSelectedActivityType(null);
    setSearch("");
    setActivitySearch("");
    setNotes("");
    onClose();
  };

  const availableActivityTypes = activityTypes.length > 0 ? activityTypes : ["Working"];
  const filteredActivityTypes = useMemo(() => {
    const normalized = activitySearch.trim().toLowerCase();

    if (!normalized) {
      return availableActivityTypes;
    }

    return availableActivityTypes.filter((type) => type.toLowerCase().includes(normalized));
  }, [activitySearch, availableActivityTypes]);

  if (!open) {
    return null;
  }

  // Step 3 — description + start
  if (selectedTask && selectedActivityType) {
    return (
      <Modal
        title="Add Description"
        subtitle={`${selectedTask.subject} · ${selectedActivityType}`}
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
          onClick={() => void onStart(selectedTask, selectedActivityType, notes)}
        >
          Start Timer
        </button>
      </Modal>
    );
  }

  // Step 2 — activity type
  if (selectedTask) {
    return (
      <Modal
        title="Select Activity Type"
        subtitle={selectedTask.subject}
        onClose={handleClose}
        onBack={() => {
          setSelectedTask(null);
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

  // Step 1 — task selection
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
