"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPinned,
  Plus,
  Sparkles
} from "lucide-react";
import { fetchAction } from "@/lib/client";
import { formatLocalDate, formatLocalTime, getDateKeyFromDateTime, parseApiDateTime } from "@/lib/datetime";
import type { SelectOption, Task, TaskFormOptionsData, TimesheetsData } from "@/lib/types";
import { formatWorkedTime, statusBadgeClass } from "@/lib/utils";
import { EmptyState, InputShell, LoadingState, Modal, Panel } from "@/components/ui";

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

const VISIT_PROJECT_TYPES = [
  "client visit strategy",
  "partners client visit strategy",
  "client visit stgy",
  "partners client visit stgy",
  "visit strategy",
  "visit stgy"
];
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMPTY_TASK_FORM_OPTIONS: TaskFormOptionsData = {
  projectTypes: [],
  statuses: [],
  statusesByProjectType: {},
  customers: [],
  projects: [],
  months: [],
  reports: []
};

function SearchableSelectField({
  className,
  label,
  ariaLabel,
  placeholder,
  value,
  options,
  onChange
}: {
  className?: string;
  label: string;
  ariaLabel: string;
  placeholder: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );
  const [inputValue, setInputValue] = useState(selectedOption?.label || value || "");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setInputValue(selectedOption?.label || value || "");
  }, [selectedOption, value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        commitValue(inputValue);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [inputValue, isOpen, options, selectedOption, value]);

  const normalize = (text: string) => text.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    const query = normalize(inputValue);
    if (!query) {
      return options;
    }

    return options.filter((option) =>
      normalize(option.label).includes(query) || normalize(option.value).includes(query)
    );
  }, [inputValue, options]);

  const commitValue = (rawValue: string) => {
    const next = options.find((option) => {
      const normalized = normalize(rawValue);
      return normalize(option.label) === normalized || normalize(option.value) === normalized;
    });

    if (next) {
      onChange(next.value);
      setInputValue(next.label);
      return;
    }

    if (!rawValue.trim()) {
      onChange("");
      setInputValue("");
      return;
    }

    setInputValue(selectedOption?.label || value || "");
  };

  const handleSelect = (option: SelectOption) => {
    onChange(option.value);
    setInputValue(option.label);
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className={["task-create-field", className].filter(Boolean).join(" ")}>
      <label className="report-date-label">{label}</label>
      <InputShell className="searchable-select-shell">
        <input
          className="searchable-select-input"
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          aria-label={ariaLabel}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="searchable-select-toggle"
          aria-label={`Open ${ariaLabel}`}
          onClick={() => setIsOpen((current) => !current)}
        >
          ▾
        </button>
      </InputShell>
      {isOpen ? (
        <div className="searchable-select-menu">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={option.value === value ? "searchable-select-option is-active" : "searchable-select-option"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(option)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="searchable-select-empty">No matches found</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

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

function buildGeneratedTaskSubject({
  project,
  customerShortName,
  report,
  month
}: {
  project: string;
  customerShortName: string;
  report: string;
  month: string;
}) {
  const trimmedCustomerShortName = customerShortName.trim();
  const parts = trimmedCustomerShortName
    ? [project, trimmedCustomerShortName, report, month]
    : [project, report, month];

  const subject = parts
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" - ")
    .replace(/STGY\s*-\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return subject || "Task";
}

function mapCustomStatusToTaskStatus(value?: string | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return "Open";
  }

  const normalized = raw.toLowerCase();
  if (normalized === "open") return "Open";
  if (normalized === "working") return "Working";
  if (normalized === "pending review") return "Pending Review";
  if (normalized === "overdue") return "Overdue";
  if (normalized === "template") return "Template";
  if (normalized === "completed") return "Completed";
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelled";
  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("complete") || normalized.includes("closed") || normalized.includes("done") || normalized.includes("shared")) return "Completed";
  if (normalized.includes("review")) return "Pending Review";
  if (normalized.includes("working") || normalized.includes("progress") || normalized.includes("execution") || normalized.includes("revising")) return "Working";
  if (normalized.includes("overdue")) return "Overdue";
  if (normalized.includes("template")) return "Template";
  return "Open";
}

function isVisitProjectType(value?: string | null) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!normalized) {
    return false;
  }

  if (VISIT_PROJECT_TYPES.some((item) => normalized.includes(item))) {
    return true;
  }

  return normalized.includes("visit") && (normalized.includes("strategy") || normalized.includes("stgy"));
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timesheetData, setTimesheetData] = useState<TimesheetsData | null>(null);
  const [taskFormOptions, setTaskFormOptions] = useState<TaskFormOptionsData>(EMPTY_TASK_FORM_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newTaskProjectType, setNewTaskProjectType] = useState("");
  const [newTaskProject, setNewTaskProject] = useState("");
  const [newTaskCustomer, setNewTaskCustomer] = useState("");
  const [newTaskMonth, setNewTaskMonth] = useState("");
  const [newTaskReport, setNewTaskReport] = useState("");
  const [newTaskCustomStatus, setNewTaskCustomStatus] = useState("");
  const [newTaskName, setNewTaskName] = useState("");
  const [hasEditedTaskName, setHasEditedTaskName] = useState(false);
  const [newTaskStartDate, setNewTaskStartDate] = useState(dateKey(new Date()));
  const [newTaskCompletionDate, setNewTaskCompletionDate] = useState(dateKey(new Date()));
  const [addingTask, setAddingTask] = useState(false);
  const [addTaskError, setAddTaskError] = useState<string | null>(null);

  const loadCalendarData = async () => {
    setLoading(true);
    setError(null);

    const fromDate = dateKey(firstOfMonth(monthCursor));
    const toDate = dateKey(endOfMonth(monthCursor));

    const [tasksResult, timesheetsResult, formOptionsResult] = await Promise.allSettled([
      fetchAction<{ tasks: Task[] }>("tasks"),
      fetchAction<TimesheetsData>("timesheets", {
        from_date: fromDate,
        to_date: toDate
      }),
      fetchAction<TaskFormOptionsData>("task_form_options")
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

    if (formOptionsResult.status === "fulfilled") {
      const options = formOptionsResult.value.data;
      setTaskFormOptions(options);
      setNewTaskCustomStatus((current) => current || "");
    } else {
      setTaskFormOptions(EMPTY_TASK_FORM_OPTIONS);
      setNewTaskCustomStatus((current) => current || "");
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadCalendarData();
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

  const flipToMode = (targetMode: "visit" | "task") => {
    if (targetMode === calendarMode) {
      return;
    }
    setCalendarMode(targetMode);
  };

  const availableStatusOptions = useMemo(() => {
    const byProjectType = taskFormOptions.statusesByProjectType[newTaskProjectType] || [];
    const source = byProjectType.length > 0 ? byProjectType : taskFormOptions.statuses;
    return [...source].sort((a, b) => a.label.localeCompare(b.label));
  }, [newTaskProjectType, taskFormOptions]);

  const selectedCustomerOption = useMemo(
    () => taskFormOptions.customers.find((option) => option.value === newTaskCustomer) ?? null,
    [newTaskCustomer, taskFormOptions.customers]
  );

  const generatedTaskName = useMemo(
    () =>
      buildGeneratedTaskSubject({
        project: newTaskProject,
        customerShortName: selectedCustomerOption?.shortName || "",
        report: newTaskReport,
        month: newTaskMonth
      }),
    [newTaskMonth, newTaskProject, newTaskReport, selectedCustomerOption]
  );

  useEffect(() => {
    setNewTaskCustomStatus((current) => {
      if (availableStatusOptions.some((option) => option.value === current)) {
        return current;
      }

      return "";
    });
  }, [availableStatusOptions]);

  useEffect(() => {
    if (!hasEditedTaskName) {
      setNewTaskName(generatedTaskName);
    }
  }, [generatedTaskName, hasEditedTaskName]);

  const handleCreateTaskForDate = async () => {
    if (addingTask || !newTaskStartDate || !newTaskCompletionDate) {
      return;
    }

    const subject = newTaskName.trim() || generatedTaskName;

    setAddingTask(true);
    setAddTaskError(null);
    try {
      await fetchAction("create_task", {
        subject,
        task_name: subject,
        custom_project_type: newTaskProjectType,
        project: newTaskProject,
        custom_customer: newTaskCustomer,
        custom_month: newTaskMonth,
        custom_reports: newTaskReport,
        custom_custom_status: newTaskCustomStatus,
        status: mapCustomStatusToTaskStatus(newTaskCustomStatus),
        exp_start_date: newTaskStartDate,
        completion_date: newTaskCompletionDate
      }, "POST");
      setNewTaskProjectType("");
      setNewTaskProject("");
      setNewTaskCustomer("");
      setNewTaskMonth("");
      setNewTaskReport("");
      setNewTaskCustomStatus("");
      setNewTaskName("");
      setHasEditedTaskName(false);
      setNewTaskStartDate(selectedDate);
      setNewTaskCompletionDate(selectedDate);
      setShowAddTaskForm(false);
      await loadCalendarData();
    } catch (createError) {
      setAddTaskError(createError instanceof Error ? createError.message : "Task could not be created.");
    } finally {
      setAddingTask(false);
    }
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
        className="visit-calendar-panel visits-calendar-main"
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

            const items = visitData[day.key] || [];
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
                  (calendarMode === "visit" ? items.length > 0 : dayTasks.length > 0) ? "has-visits" : ""
                ].filter(Boolean).join(" ")}
                style={{ animationDelay: `${index * 18}ms` }}
                onClick={() => {
                  setSelectedDate(day.key);
                  setShowAddTaskForm(false);
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
                      <span className={`badge ${statusBadgeClass(task.customCustomStatus || task.status, task.isOverdue)}`}>{task.customCustomStatus || task.status}</span>
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
          onClose={() => {
            setShowAddTaskForm(false);
            setIsDetailsOpen(false);
          }}
          size="wide"
        >
          <div className="task-modal-actions">
            <button
              type="button"
              className="ghost-button task-modal-add-btn"
              aria-label="Add task for this date"
              title="Add task for this date"
              onClick={() => {
                setAddTaskError(null);
                setNewTaskStartDate(selectedDate);
                setNewTaskCompletionDate(selectedDate);
                setShowAddTaskForm((current) => !current);
              }}
            >
              <Plus size={18} />
            </button>
          </div>
          {showAddTaskForm ? (
            <div className="task-create-form">
              <SearchableSelectField
                label="Project Type"
                ariaLabel="Project type"
                placeholder="Search project type"
                value={newTaskProjectType}
                options={taskFormOptions.projectTypes}
                onChange={setNewTaskProjectType}
              />
              <SearchableSelectField
                label="Project"
                ariaLabel="Project"
                placeholder="Search project"
                value={newTaskProject}
                options={taskFormOptions.projects}
                onChange={setNewTaskProject}
              />
              <SearchableSelectField
                className="task-create-field--full"
                label="Customer"
                ariaLabel="Customer"
                placeholder="Search customer"
                value={newTaskCustomer}
                options={taskFormOptions.customers}
                onChange={setNewTaskCustomer}
              />
              <SearchableSelectField
                label="Period"
                ariaLabel="Period"
                placeholder="Search period"
                value={newTaskMonth}
                options={taskFormOptions.months}
                onChange={setNewTaskMonth}
              />
              <SearchableSelectField
                label="Task Type"
                ariaLabel="Task type"
                placeholder="Search task type"
                value={newTaskReport}
                options={taskFormOptions.reports}
                onChange={setNewTaskReport}
              />
              <div className="task-create-field">
                <label className="report-date-label">Exp Start Date</label>
                <input
                  type="date"
                  className="report-date-input"
                  value={newTaskStartDate}
                  onChange={(event) => setNewTaskStartDate(event.target.value)}
                  aria-label="Expected start date"
                />
              </div>
              <div className="task-create-field">
                <label className="report-date-label">Completion Date</label>
                <input
                  type="date"
                  className="report-date-input"
                  value={newTaskCompletionDate}
                  min={newTaskStartDate || undefined}
                  onChange={(event) => setNewTaskCompletionDate(event.target.value)}
                  aria-label="Completion date"
                />
              </div>
              <SearchableSelectField
                className="task-create-field--full"
                label="Status"
                ariaLabel="Status"
                placeholder={newTaskProjectType ? "Search status" : "Select project type first"}
                value={newTaskCustomStatus}
                options={availableStatusOptions}
                onChange={setNewTaskCustomStatus}
              />
              <div className="task-create-field task-create-field--full">
                <label className="report-date-label">Task Name</label>
                <input
                  type="text"
                  className="report-date-input"
                  value={newTaskName}
                  onChange={(event) => {
                    setNewTaskName(event.target.value);
                    setHasEditedTaskName(true);
                  }}
                  aria-label="Task name"
                  placeholder="Task name"
                />
              </div>
              <div className="task-create-submit">
              <button
                type="button"
                className="button"
                disabled={addingTask || !newTaskStartDate || !newTaskCompletionDate}
                onClick={() => void handleCreateTaskForDate()}
              >
                {addingTask ? "Adding..." : `Add for ${formatDateShortLabel(selectedDate)}`}
              </button>
              </div>
              {addTaskError ? <p className="empty-copy">{addTaskError}</p> : null}
            </div>
          ) : null}
          {selectedTasks.length === 0 ? (
            <EmptyState title="No tasks on this date" copy="Choose another day to see tasks." />
          ) : (
            <div className="list-stack">
              {selectedTasks.map((task) => {
                const cardStatus = task.customCustomStatus || "-";
                const badgeStatusKey = task.customCustomStatus || task.status;

                return (
                  <article key={task.taskId} className="list-card">
                    <div className="list-head">
                      <div className="list-head-copy">
                        <h4 className="list-title">{task.subject}</h4>
                        <p className="panel-subtitle">{task.customerName || "No customer"}</p>
                      </div>
                      <span className={`badge ${statusBadgeClass(badgeStatusKey, task.isOverdue)}`}>{cardStatus}</span>
                    </div>
                    <div className="visit-meta-row">
                      <span>{task.projectName || "No project"}</span>
                      <span>{task.ownerName || "No owner"}</span>
                      <span>{cardStatus}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
