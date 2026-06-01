"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPinned,
  Sparkles
} from "lucide-react";
import { fetchAction } from "@/lib/client";
import { formatLocalDate, formatLocalTime, getDateKeyFromDateTime, parseApiDateTime } from "@/lib/datetime";
import type { Task, TimesheetsData } from "@/lib/types";
import { formatWorkedTime, statusBadgeClass } from "@/lib/utils";
import { EmptyState, LoadingState, Modal, Panel } from "@/components/ui";

type VisitItem = {
  key: string;
  kind: "scheduled" | "completed" | "running";
  date: string;
  taskId: string;
  subject: string;
  customerName: string;
  projectName: string;
  rawStatus?: string | null;
  displayStatus: string;
  activityType?: string | null;
  fromTime?: string | null;
  fromTimeUtc?: string | null;
  toTime?: string | null;
  toTimeUtc?: string | null;
  hours?: number;
};

const VISIT_PROJECT_TYPES = ["client visit strategy", "partners client visit strategy"];
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function firstOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function extractDate(value?: string | null) {
  return getDateKeyFromDateTime(value);
}

function getTaskCalendarDate(task: Task) {
  const candidate = extractDate((task as Task & { expStartDate?: string | null; expectedStartDate?: string | null }).expStartDate) ||
    extractDate((task as Task & { expStartDate?: string | null; expectedStartDate?: string | null }).expectedStartDate) ||
    extractDate(task.expEndDate) ||
    extractDate(task.createdOn);
  return candidate;
}

function compactVisitLabel(item: VisitItem) {
  const source = item.customerName || item.subject || "Visit";
  const normalized = source.replace(/\s+/g, " ").trim();
  if (normalized.length <= 14) {
    return normalized;
  }

  return `${normalized.slice(0, 12).trim()}..`;
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
}

function formatDayLabel(value: string) {
  const parsed = parseApiDateTime(`${value}T00:00:00`);
  if (!parsed) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

function formatTimeLabel(value?: string | null, utcValue?: string | null) {
  return formatLocalTime(value, utcValue);
}

function formatDateShortLabel(value: string) {
  return formatLocalDate(value) || value;
}

function isVisitProjectType(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return VISIT_PROJECT_TYPES.some((item) => normalized.includes(item));
}

function isVisitText(value?: string | null) {
  return String(value || "").toLowerCase().includes("visit");
}

function isVisitTask(task: Task) {
  return isVisitProjectType(task.customProjectType);
}

function buildCalendarDays(monthCursor: Date) {
  const first = firstOfMonth(monthCursor);
  const last = endOfMonth(monthCursor);
  const days: Array<{ key: string; dayNumber: number; inMonth: boolean }> = [];

  for (let i = 0; i < first.getDay(); i += 1) {
    days.push({ key: `empty-start-${i}`, dayNumber: 0, inMonth: false });
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const current = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day);
    days.push({ key: dateKey(current), dayNumber: day, inMonth: true });
  }

  while (days.length % 7 !== 0) {
    days.push({ key: `empty-end-${days.length}`, dayNumber: 0, inMonth: false });
  }

  return days;
}

function addVisit(map: Record<string, VisitItem[]>, item: VisitItem) {
  if (!map[item.date]) {
    map[item.date] = [];
  }

  map[item.date].push(item);
}

function VisitDetailsModal({
  date,
  items,
  onClose
}: {
  date: string;
  items: VisitItem[];
  onClose: () => void;
}) {
  const runningItems = items.filter((item) => item.kind === "running");
  const scheduledItems = items.filter((item) => item.kind === "scheduled");
  const completedItems = items.filter((item) => item.kind === "completed");

  return (
    <Modal
      title={formatDayLabel(date)}
      subtitle="Scheduled, visited, and live visit activity for the selected date."
      onClose={onClose}
      size="wide"
    >
      <div className="visit-modal-overview">
        <article className="visit-modal-stat visit-modal-stat--scheduled">
          <span className="visit-modal-stat-label">Scheduled</span>
          <strong className="visit-modal-stat-value">{scheduledItems.length}</strong>
        </article>
        <article className="visit-modal-stat visit-modal-stat--completed">
          <span className="visit-modal-stat-label">Visited</span>
          <strong className="visit-modal-stat-value">{completedItems.length}</strong>
        </article>
        <article className="visit-modal-stat visit-modal-stat--running">
          <span className="visit-modal-stat-label">Running</span>
          <strong className="visit-modal-stat-value">{runningItems.length}</strong>
        </article>
      </div>

      {items.length === 0 ? (
        <div className="visit-modal-empty">
          <EmptyState title="No visits on this date" copy="Pick another day or schedule a visit task for this date." />
        </div>
      ) : (
        <div className="visit-detail-sections visit-detail-sections--modal">
          {runningItems.length > 0 ? (
            <div className="visit-section">
              <div className="visit-section-title">
                <Clock3 size={15} />
                <span>Live Visit Timer</span>
              </div>
              <div className="list-stack">
                {runningItems.map((item) => (
                  <article key={item.key} className="list-card visit-list-card visit-list-card--running">
                    <div className="list-head">
                      <div className="list-head-copy">
                        <h4 className="list-title">{item.subject}</h4>
                        <p className="panel-subtitle">{item.customerName}</p>
                      </div>
                      <span className="badge badge-progress">Running</span>
                    </div>
                    <div className="visit-meta-row">
                      <span>{item.projectName}</span>
                      <span>{item.activityType || "Visit activity"}</span>
                      <span>{formatTimeLabel(item.fromTime, item.fromTimeUtc) || "Now"}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {scheduledItems.length > 0 ? (
            <div className="visit-section">
              <div className="visit-section-title">
                <MapPinned size={15} />
                <span>Scheduled Visits</span>
              </div>
              <div className="list-stack">
                {scheduledItems.map((item) => (
                  <article key={item.key} className="list-card visit-list-card visit-list-card--scheduled">
                    <div className="list-head">
                      <div className="list-head-copy">
                        <h4 className="list-title">{item.subject}</h4>
                        <p className="panel-subtitle">{item.customerName}</p>
                      </div>
                      <span className={`badge ${statusBadgeClass(item.displayStatus)}`}>
                        {item.rawStatus || item.displayStatus}
                      </span>
                    </div>
                    <div className="visit-meta-row">
                      <span>{item.projectName}</span>
                      <span>{item.rawStatus || "Scheduled"}</span>
                      <span>{item.taskId}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {completedItems.length > 0 ? (
            <div className="visit-section">
              <div className="visit-section-title">
                <Sparkles size={15} />
                <span>Visits Done</span>
              </div>
              <div className="list-stack">
                {completedItems.map((item) => (
                  <article key={item.key} className="list-card visit-list-card visit-list-card--completed">
                    <div className="list-head">
                      <div className="list-head-copy">
                        <h4 className="list-title">{item.subject}</h4>
                        <p className="panel-subtitle">{item.customerName}</p>
                      </div>
                      <span className="badge badge-complete">Visited</span>
                    </div>
                    <div className="visit-meta-row">
                      <span>{item.projectName}</span>
                      <span>{item.activityType || "Visit activity"}</span>
                      <span>
                        {item.hours && item.hours > 0
                          ? formatWorkedTime(item.hours)
                          : `${formatTimeLabel(item.fromTime, item.fromTimeUtc) || "-"}${item.toTime ? ` - ${formatTimeLabel(item.toTime, item.toTimeUtc) || "-"}` : ""}`}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

export function VisitsScreen() {
  const [calendarMode, setCalendarMode] = useState<"visit" | "task">("task");
  const [monthCursor, setMonthCursor] = useState(firstOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [calendarFlipClass, setCalendarFlipClass] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timesheetData, setTimesheetData] = useState<TimesheetsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const fromDate = dateKey(firstOfMonth(monthCursor));
      const toDate = dateKey(endOfMonth(monthCursor));

      const [tasksResult, timesheetsResult] = await Promise.allSettled([
        fetchAction<{ tasks: Task[] }>("tasks"),
        fetchAction<TimesheetsData>("timesheets", {
          from_date: fromDate,
          to_date: toDate
        })
      ]);

      if (tasksResult.status === "fulfilled") {
        setTasks(tasksResult.value.data.tasks);
      } else {
        setTasks([]);
        setError(tasksResult.reason instanceof Error ? tasksResult.reason.message : "Tasks could not be loaded.");
      }

      if (timesheetsResult.status === "fulfilled") {
        setTimesheetData(timesheetsResult.value.data);
      } else {
        setTimesheetData(null);
        setError(
          timesheetsResult.reason instanceof Error
            ? timesheetsResult.reason.message
            : "Visit timesheets could not be loaded."
        );
      }

      setLoading(false);
    };

    void load();
  }, [monthCursor]);

  const visitTaskMap = useMemo(() => {
    const mapped = new Map<string, Task>();
    tasks.filter(isVisitTask).forEach((task) => {
      mapped.set(task.taskId, task);
    });
    return mapped;
  }, [tasks]);

  const visitData = useMemo(() => {
    const byDate: Record<string, VisitItem[]> = {};
    const completedTaskDates = new Set<string>();
    const runningTaskDates = new Set<string>();
    const aggregatedVisits = new Map<string, VisitItem>();
    const selectedMonthKey = `${monthCursor.getFullYear()}-${pad(monthCursor.getMonth() + 1)}`;

    const timesheets = timesheetData?.timesheets ?? [];
    for (const entry of timesheets) {
      const relatedTask = entry.task ? visitTaskMap.get(entry.task) : undefined;
      if (!relatedTask && !isVisitText(entry.activityType) && !isVisitText(entry.taskSubject)) {
        continue;
      }

      const visitDate = extractDate(entry.fromTimeUtc || entry.fromTime);
      if (!visitDate) {
        continue;
      }

      const taskId = entry.task || relatedTask?.taskId || entry.timesheetDetailId;
      const kind: VisitItem["kind"] = entry.isRunning ? "running" : "completed";
      const aggregateKey = `${kind}|${taskId}|${visitDate}`;
      const existing = aggregatedVisits.get(aggregateKey);

      if (existing) {
        existing.hours = Number(((existing.hours || 0) + (entry.hours || 0)).toFixed(2));

        const existingFrom = existing.fromTime
          ? (parseApiDateTime(existing.fromTime, existing.fromTimeUtc)?.getTime() ?? Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY;
        const nextFrom = entry.fromTime
          ? (parseApiDateTime(entry.fromTime, entry.fromTimeUtc)?.getTime() ?? Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY;
        if (nextFrom < existingFrom) {
          existing.fromTime = entry.fromTime;
          existing.fromTimeUtc = entry.fromTimeUtc;
        }

        const existingTo = existing.toTime
          ? (parseApiDateTime(existing.toTime, existing.toTimeUtc)?.getTime() ?? Number.NEGATIVE_INFINITY)
          : Number.NEGATIVE_INFINITY;
        const nextTo = entry.toTime
          ? (parseApiDateTime(entry.toTime, entry.toTimeUtc)?.getTime() ?? Number.NEGATIVE_INFINITY)
          : Number.NEGATIVE_INFINITY;
        if (nextTo > existingTo) {
          existing.toTime = entry.toTime;
          existing.toTimeUtc = entry.toTimeUtc;
        }

        if (!existing.activityType && entry.activityType) {
          existing.activityType = entry.activityType;
        }
      } else {
        aggregatedVisits.set(aggregateKey, {
          key: `${taskId}-${visitDate}-${kind}`,
          kind,
          date: visitDate,
          taskId,
          subject: entry.taskSubject || relatedTask?.subject || "Visit task",
          customerName: entry.customerName || relatedTask?.customerName || "No customer",
          projectName: entry.projectName || relatedTask?.projectName || "No project",
          rawStatus: relatedTask?.rawStatus,
          displayStatus: entry.isRunning ? "Running" : "Visited",
          activityType: entry.activityType,
          fromTime: entry.fromTime,
          fromTimeUtc: entry.fromTimeUtc,
          toTime: entry.toTime,
          toTimeUtc: entry.toTimeUtc,
          hours: entry.hours
        });
      }

      if (entry.isRunning) {
        runningTaskDates.add(`${taskId}|${visitDate}`);
      } else {
        completedTaskDates.add(`${taskId}|${visitDate}`);
      }
    }

    aggregatedVisits.forEach((item) => {
      addVisit(byDate, item);
    });

    for (const task of visitTaskMap.values()) {
      const scheduledDate = getTaskCalendarDate(task);
      if (!scheduledDate || !scheduledDate.startsWith(selectedMonthKey)) {
        continue;
      }

      if (["Completed", "Closed"].includes(task.status)) {
        continue;
      }

      const recordedKey = `${task.taskId}|${scheduledDate}`;
      if (completedTaskDates.has(recordedKey) || runningTaskDates.has(recordedKey)) {
        continue;
      }

      const isScheduledStatus = String(task.rawStatus || "").toLowerCase() === "scheduled";
      const item: VisitItem = {
        key: `scheduled-${task.taskId}-${scheduledDate}`,
        kind: "scheduled",
        date: scheduledDate,
        taskId: task.taskId,
        subject: task.subject,
        customerName: task.customerName || "No customer",
        projectName: task.projectName || "No project",
        rawStatus: task.rawStatus,
        displayStatus: isScheduledStatus ? "Scheduled" : task.status,
      };

      addVisit(byDate, item);
    }

    Object.values(byDate).forEach((items) => {
      items.sort((left, right) => {
        const order = { running: 0, scheduled: 1, completed: 2 };
        if (order[left.kind] !== order[right.kind]) {
          return order[left.kind] - order[right.kind];
        }

        return left.subject.localeCompare(right.subject);
      });
    });

    return byDate;
  }, [monthCursor, timesheetData, visitTaskMap]);

  const calendarDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);

  const monthStats = useMemo(() => {
    const stats = {
      scheduled: 0,
      completed: 0,
      running: 0
    };

    Object.values(visitData).forEach((items) => {
      items.forEach((item) => {
        stats[item.kind] += 1;
      });
    });

    return stats;
  }, [visitData]);

  useEffect(() => {
    const todayKey = dateKey(new Date());
    const monthPrefix = `${monthCursor.getFullYear()}-${pad(monthCursor.getMonth() + 1)}`;
    const datesWithVisits = Object.keys(visitData).filter((item) => item.startsWith(monthPrefix)).sort();

    if (selectedDate.startsWith(monthPrefix)) {
      return;
    }

    if (todayKey.startsWith(monthPrefix)) {
      setSelectedDate(todayKey);
      return;
    }

    setSelectedDate(datesWithVisits[0] || `${monthPrefix}-01`);
  }, [monthCursor, selectedDate, visitData]);

  const selectedItems = visitData[selectedDate] || [];
  const taskData = useMemo(() => {
    const byDate: Record<string, Task[]> = {};
    const monthPrefix = `${monthCursor.getFullYear()}-${pad(monthCursor.getMonth() + 1)}`;
    tasks.forEach((task) => {
      const key = getTaskCalendarDate(task);
      if (!key || !key.startsWith(monthPrefix)) {
        return;
      }
      if (!byDate[key]) {
        byDate[key] = [];
      }
      byDate[key].push(task);
    });

    Object.values(byDate).forEach((rows) => {
      rows.sort((a, b) => a.subject.localeCompare(b.subject));
    });

    return byDate;
  }, [monthCursor, tasks]);

  const selectedTasks = taskData[selectedDate] || [];
  const monthlyScheduledItems = useMemo(
    () =>
      Object.values(visitData)
        .flat()
        .filter((item) => item.kind === "scheduled")
        .sort((left, right) => {
          if (left.date !== right.date) {
            return left.date.localeCompare(right.date);
          }

          return left.subject.localeCompare(right.subject);
        }),
    [visitData]
  );

  const taskStats = useMemo(() => {
    const stats = {
      pending: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0
    };

    Object.values(taskData).forEach((rows) => {
      rows.forEach((task) => {
        if (["Completed", "Closed"].includes(task.status)) {
          stats.completed += 1;
        } else if (task.isOverdue) {
          stats.overdue += 1;
        } else if (["Working", "In Progress", "Under Execution", "Under Review", "In Progress With BO", "Revising Report BO"].includes(task.status)) {
          stats.inProgress += 1;
        } else {
          stats.pending += 1;
        }
      });
    });

    return stats;
  }, [taskData]);

  const currentCalendarData = calendarMode === "visit" ? visitData : taskData;

  const flipToMode = (targetMode: "visit" | "task") => {
    if (targetMode === calendarMode) {
      return;
    }
    setCalendarFlipClass(targetMode === "visit" ? "is-flip-to-visit" : "is-flip-to-task");
    window.setTimeout(() => {
      setCalendarMode(targetMode);
      window.setTimeout(() => setCalendarFlipClass(""), 260);
    }, 210);
  };

  if (loading && !timesheetData && tasks.length === 0) {
    return <LoadingState label="Loading visits..." />;
  }

  if (error && !timesheetData && tasks.length === 0) {
    return <EmptyState title="Visits unavailable" copy={error} />;
  }

  return (
    <div className="screen-stack screen-stack--single screen-stack-desktop-two visits-desktop-grid">
      <Panel className="visit-hero-panel">
        <div className="visit-hero">
          <div>
            <div className="visit-hero-kicker">
              <Sparkles size={14} />
              <span>{calendarMode === "visit" ? "Visit planner" : "Task planner"}</span>
            </div>
            <h2 className="panel-title visit-hero-title">{calendarMode === "visit" ? "Visit Calendar" : "Task Calendar"}</h2>
            <p className="panel-subtitle visit-hero-copy">
              {calendarMode === "visit"
                ? "Track scheduled visits, completed visits, and live visit timers by date."
                : "Track tasks by expected start date. Tap a day to view task status list."}
            </p>
          </div>
        </div>

        <div className="visit-hero-stats">
          {calendarMode === "visit" ? (
            <>
              <article className="visit-stat-card visit-stat-card--scheduled">
                <span className="visit-stat-label">Scheduled</span>
                <span className="visit-stat-value">{monthStats.scheduled}</span>
              </article>
              <article className="visit-stat-card visit-stat-card--completed">
                <span className="visit-stat-label">Visited</span>
                <span className="visit-stat-value">{monthStats.completed}</span>
              </article>
              <article className="visit-stat-card visit-stat-card--running">
                <span className="visit-stat-label">Running</span>
                <span className="visit-stat-value">{monthStats.running}</span>
              </article>
            </>
          ) : (
            <>
              <article className="visit-stat-card visit-stat-card--scheduled">
                <span className="visit-stat-label">Pending</span>
                <span className="visit-stat-value">{taskStats.pending}</span>
              </article>
              <article className="visit-stat-card visit-stat-card--completed">
                <span className="visit-stat-label">In Progress</span>
                <span className="visit-stat-value">{taskStats.inProgress}</span>
              </article>
              <article className="visit-stat-card visit-stat-card--running">
                <span className="visit-stat-label">Completed</span>
                <span className="visit-stat-value">{taskStats.completed}</span>
              </article>
            </>
          )}
        </div>
      </Panel>

      <Panel
        className={`visit-calendar-panel visits-calendar-main ${calendarFlipClass}`.trim()}
        onTouchStart={(event) => setTouchStartX(event.changedTouches[0]?.clientX ?? null)}
        onTouchEnd={(event) => {
          const endX = event.changedTouches[0]?.clientX;
          if (touchStartX == null || typeof endX !== "number") {
            setTouchStartX(null);
            return;
          }
          const delta = endX - touchStartX;
          if (Math.abs(delta) < 42) {
            setTouchStartX(null);
            return;
          }
          const targetMode: "visit" | "task" = delta < 0 ? "task" : "visit";
          flipToMode(targetMode);
          setTouchStartX(null);
        }}
      >
        <div className="calendar-mode-switch">
          <button
            type="button"
            className={calendarMode === "visit" ? "calendar-mode-btn is-active" : "calendar-mode-btn"}
            onClick={() => flipToMode("visit")}
          >
            Visit Calendar
          </button>
          <button
            type="button"
            className={calendarMode === "task" ? "calendar-mode-btn is-active" : "calendar-mode-btn"}
            onClick={() => flipToMode("task")}
          >
            Task Calendar
          </button>
        </div>
        <div className="visit-calendar-toolbar">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setMonthCursor((current) => shiftMonth(current, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="visit-calendar-month">
            <h3 className="visit-calendar-title">{formatMonthLabel(monthCursor)}</h3>
            <p className="panel-subtitle">
              {calendarMode === "visit"
                ? "Tap a day to see completed and scheduled visits."
                : "Tap a day to see tasks planned for that date and status."}
            </p>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setMonthCursor((current) => shiftMonth(current, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="visit-calendar-legend">
          {calendarMode === "visit" ? (
            <>
              <span><i className="visit-dot visit-dot--scheduled" /> Scheduled</span>
              <span><i className="visit-dot visit-dot--completed" /> Visited</span>
              <span><i className="visit-dot visit-dot--running" /> Running</span>
            </>
          ) : (
            <>
              <span><i className="visit-dot visit-dot--scheduled" /> Pending</span>
              <span><i className="visit-dot visit-dot--completed" /> In Progress</span>
              <span><i className="visit-dot visit-dot--running" /> Completed</span>
            </>
          )}
        </div>

        <div className="visit-calendar-grid">
          {WEEK_DAYS.map((day) => (
            <div key={day} className="visit-calendar-weekday">
              {day}
            </div>
          ))}

          {calendarDays.map((day, index) => {
            if (!day.inMonth) {
              return <div key={day.key} className="visit-day visit-day--empty" />;
            }

            const items = currentCalendarData[day.key] || [];
            const dayTasks = taskData[day.key] || [];
            const scheduledCount = items.filter((item) => item.kind === "scheduled").length;
            const completedCount = items.filter((item) => item.kind === "completed").length;
            const runningCount = items.filter((item) => item.kind === "running").length;
            const labels = calendarMode === "visit"
              ? Array.from(new Set(items.map((item) => compactVisitLabel(item)).filter(Boolean))).slice(0, 1)
              : Array.from(new Set(dayTasks.map((task) => (task.customerName || task.subject || "Task")))).slice(0, 1);
            const extraCount = Math.max(0, items.length - 1, dayTasks.length - 1);
            const isSelected = selectedDate === day.key;
            const isToday = day.key === dateKey(new Date());
            const dayPending = dayTasks.filter((task) => !["Completed", "Closed"].includes(task.status) && !task.isOverdue && !["Working", "In Progress", "Under Execution", "Under Review", "In Progress With BO", "Revising Report BO"].includes(task.status)).length;
            const dayInProgress = dayTasks.filter((task) => ["Working", "In Progress", "Under Execution", "Under Review", "In Progress With BO", "Revising Report BO"].includes(task.status)).length;
            const dayCompleted = dayTasks.filter((task) => ["Completed", "Closed"].includes(task.status)).length;

            return (
              <button
                key={day.key}
                type="button"
                className={[
                  "visit-day",
                  isSelected ? "is-selected" : "",
                  isToday ? "is-today" : "",
                  items.length > 0 ? "has-visits" : ""
                ].filter(Boolean).join(" ")}
                style={{ animationDelay: `${index * 18}ms` }}
                onClick={() => {
                  setSelectedDate(day.key);
                  setIsDetailsOpen(true);
                }}
              >
                <span className="visit-day-number">{day.dayNumber}</span>
                <div className="visit-day-labels">
                  {labels.map((label) => (
                    <span key={`${day.key}-${label}`} className="visit-day-label" title={label}>
                      {label}
                    </span>
                  ))}
                  {extraCount > 0 ? (
                    <span className="visit-day-label visit-day-label--more">+{extraCount}</span>
                  ) : null}
                </div>
                <div className="visit-day-indicators">
                  {calendarMode === "visit" ? (
                    <>
                      {scheduledCount > 0 ? <span className="visit-day-pill visit-day-pill--scheduled">{scheduledCount}</span> : null}
                      {completedCount > 0 ? <span className="visit-day-pill visit-day-pill--completed">{completedCount}</span> : null}
                      {runningCount > 0 ? <span className="visit-day-pill visit-day-pill--running">{runningCount}</span> : null}
                    </>
                  ) : (
                    <>
                      {dayPending > 0 ? <span className="visit-day-pill visit-day-pill--scheduled">{dayPending}</span> : null}
                      {dayInProgress > 0 ? <span className="visit-day-pill visit-day-pill--completed">{dayInProgress}</span> : null}
                      {dayCompleted > 0 ? <span className="visit-day-pill visit-day-pill--running">{dayCompleted}</span> : null}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel className="visit-month-schedule-panel visits-schedule-side">
        <div className="visit-month-schedule-head">
          <div>
            <h3 className="panel-title">{calendarMode === "visit" ? "Scheduled Visits This Month" : "Tasks This Month"}</h3>
          </div>
          <span className="visit-summary-chip visit-summary-chip--scheduled">
            {calendarMode === "visit" ? `${monthlyScheduledItems.length} scheduled` : `${Object.values(taskData).flat().length} tasks`}
          </span>
        </div>

        {calendarMode === "visit" && monthlyScheduledItems.length === 0 ? (
          <EmptyState title="No scheduled visits this month" copy="Any remaining scheduled visit tasks for this month will appear here." />
        ) : calendarMode === "task" && Object.values(taskData).flat().length === 0 ? (
          <EmptyState title="No tasks this month" copy="Tasks with expected start date in this month will appear here." />
        ) : (
          <div className="list-stack visit-month-schedule-list">
            {calendarMode === "visit"
              ? monthlyScheduledItems.map((item) => (
                <article key={item.key} className="list-card visit-list-card visit-list-card--scheduled">
                  <div className="list-head">
                    <div className="list-head-copy">
                      <h4 className="list-title">{item.customerName}</h4>
                      <p className="panel-subtitle">{item.subject || "Scheduled visit"}</p>
                    </div>
                    <span className={`badge ${statusBadgeClass(item.displayStatus)}`}>
                      {item.rawStatus || "Scheduled"}
                    </span>
                  </div>
                  <div className="visit-meta-row">
                    <span>{formatDateShortLabel(item.date)}</span>
                    <span>{formatTimeLabel(item.fromTime, item.fromTimeUtc) || "Time not set"}</span>
                    <span>{item.taskId}</span>
                  </div>
                </article>
              ))
              : Object.entries(taskData)
                .flatMap(([date, rows]) => rows.map((task) => ({ date, task })))
                .sort((a, b) => (a.date === b.date ? a.task.subject.localeCompare(b.task.subject) : a.date.localeCompare(b.date)))
                .map(({ date, task }) => (
                  <article key={`${task.taskId}-${date}`} className="list-card visit-list-card visit-list-card--scheduled">
                    <div className="list-head">
                      <div className="list-head-copy">
                        <h4 className="list-title">{task.customerName || "No customer"}</h4>
                        <p className="panel-subtitle">{task.subject}</p>
                      </div>
                      <span className={`badge ${statusBadgeClass(task.status, task.isOverdue)}`}>{task.status}</span>
                    </div>
                    <div className="visit-meta-row">
                      <span>{formatDateShortLabel(date)}</span>
                      <span>{task.projectName || "No project"}</span>
                      <span>{task.taskId}</span>
                    </div>
                  </article>
                ))}
          </div>
        )}
      </Panel>

      {isDetailsOpen && calendarMode === "visit" ? (
        <VisitDetailsModal
          date={selectedDate}
          items={selectedItems}
          onClose={() => setIsDetailsOpen(false)}
        />
      ) : null}
      {isDetailsOpen && calendarMode === "task" ? (
        <Modal
          title={formatDayLabel(selectedDate)}
          subtitle="Tasks planned for this date and current status."
          onClose={() => setIsDetailsOpen(false)}
          size="wide"
        >
          {selectedTasks.length === 0 ? (
            <EmptyState title="No tasks on this date" copy="Choose another day to see tasks." />
          ) : (
            <div className="list-stack">
              {selectedTasks.map((task) => (
                <article key={task.taskId} className="list-card">
                  <div className="list-head">
                    <div className="list-head-copy">
                      <h4 className="list-title">{task.subject}</h4>
                      <p className="panel-subtitle">{task.customerName || "No customer"}</p>
                    </div>
                    <span className={`badge ${statusBadgeClass(task.status, task.isOverdue)}`}>{task.status}</span>
                  </div>
                  <div className="visit-meta-row">
                    <span>{task.projectName || "No project"}</span>
                    <span>{task.ownerName || "No owner"}</span>
                    <span>{task.taskId}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
