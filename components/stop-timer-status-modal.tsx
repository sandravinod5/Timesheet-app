"use client";

import type { SelectOption } from "@/lib/types";
import { Modal } from "@/components/ui";

export function StopTimerStatusModal({
  open,
  taskSubject,
  projectName,
  currentStatus,
  statusValue,
  statusOptions,
  onStatusChange,
  onClose,
  onSkipAndStop,
  onUpdateAndStop,
  submitting
}: {
  open: boolean;
  taskSubject: string;
  projectName?: string | null;
  currentStatus?: string | null;
  statusValue: string;
  statusOptions: SelectOption[];
  onStatusChange: (value: string) => void;
  onClose: () => void;
  onSkipAndStop: () => void;
  onUpdateAndStop: () => void;
  submitting: boolean;
}) {
  if (!open) {
    return null;
  }

  return (
    <Modal
      title="Stop Timer"
      subtitle="Review task details before stopping the timer."
      onClose={submitting ? () => undefined : onClose}
    >
      <div className="draft-edit-form">
        <div className="draft-edit-row draft-edit-row--full">
          <label className="report-date-label">Task</label>
          <p className="panel-title">{taskSubject || "No task"}</p>
        </div>
        <div className="draft-edit-row draft-edit-row--full">
          <label className="report-date-label">Project</label>
          <p className="panel-subtitle">{projectName || "No project"}</p>
        </div>
        <div className="draft-edit-row draft-edit-row--full">
          <label className="report-date-label">Current Status</label>
          <p className="panel-subtitle">{currentStatus || "No current status"}</p>
        </div>
        <div className="draft-edit-row draft-edit-row--full">
          <label className="report-date-label">Update Status</label>
          <label className="input-shell">
            <select
              value={statusValue}
              onChange={(event) => onStatusChange(event.target.value)}
              aria-label="Update task status"
            >
              <option value="">Select status</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="button-row button-row-end">
          <button
            type="button"
            className="timer-action-button"
            onClick={onSkipAndStop}
            disabled={submitting}
          >
            {submitting ? "Stopping..." : "Skip and Stop"}
          </button>
          <button
            type="button"
            className="timer-action-button timer-action-button-start"
            onClick={onUpdateAndStop}
            disabled={submitting || !statusValue}
          >
            {submitting ? "Updating..." : "Update Status and Stop"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
