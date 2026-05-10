import type { TaskSummary } from "@/lib/types";

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function formatHours(value: number) {
  if (!Number.isFinite(value)) {
    return "0h";
  }

  const absolute = Math.abs(value);

  if (absolute === 0) {
    return "0h";
  }

  if (absolute < 1) {
    return `${value.toFixed(2)}h`;
  }

  return `${value.toFixed(1)}h`;
}

export function formatWorkedTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0s";
  }

  const totalSeconds = Math.max(1, Math.round(value * 3600));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function statusBadgeClass(status: string, isOverdue?: number) {
  if (isOverdue) {
    return "badge-danger";
  }

  if (["Completed", "Closed"].includes(status)) {
    return "badge-complete";
  }

  if (
    [
      "Working",
      "In Progress",
      "Under Execution",
      "Under Review",
      "In Progress With BO",
      "Revising Report BO"
    ].includes(status)
  ) {
    return "badge-progress";
  }

  if (status === "Assigned") {
    return "badge-assigned";
  }

  return "badge-pending";
}

export function emptyTaskSummary(): TaskSummary {
  return {
    total: 0,
    assigned: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0
  };
}
