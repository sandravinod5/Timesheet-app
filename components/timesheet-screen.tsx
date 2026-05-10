"use client";

import { Check, Clock3, FileEdit, Search, Square, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAction } from "@/lib/client";
import { requestNotificationPermission, shouldSendNotification, showSystemNotification, getNotificationPermissionState } from "@/lib/notifications";
import type { ActivityTypesData, DraftEntry, DraftsData, Task, TimesheetsData } from "@/lib/types";
import { formatHours, formatWorkedTime } from "@/lib/utils";
import { Button, EmptyState, InputShell, LoadingState, Panel } from "@/components/ui";
import { useToast } from "@/components/toast-provider";
import { TimerModal } from "@/components/timer-modal";

function toDateTimeLocal(value: string) {
  const parsed = parseErpDateTime(value);
  if (!parsed) {
    return value.replace(" ", "T").slice(0, 16);
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function fromDateTimeLocal(value: string) {
  return value.replace("T", " ") + ":00";
}

function parseErpDateTime(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?$/
  );

  if (!match) {
    const fallback = new Date(value.includes("T") ? value : value.replace(" ", "T"));
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [, year, month, day, hour, minute, second = "0", fraction = "0"] = match;
  const milliseconds = Number(fraction.slice(0, 3).padEnd(3, "0"));
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    milliseconds
  );
}

function formatEntryTime(value: string) {
  const parsed = parseErpDateTime(value);
  if (!parsed) return value;
  return parsed.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DraftEntriesList({
  drafts,
  onEdit,
  onSubmit,
  editingId,
  editFrom,
  editTo,
  onEditFromChange,
  onEditToChange,
  onSaveEdit,
  onCancelEdit,
  saving
}: {
  drafts: DraftEntry[];
  onEdit: (entry: DraftEntry) => void;
  onSubmit: (entry: DraftEntry) => void;
  editingId: string | null;
  editFrom: string;
  editTo: string;
  onEditFromChange: (v: string) => void;
  onEditToChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  saving: boolean;
}) {
  if (drafts.length === 0) {
    return <EmptyState title="No draft entries" copy="Stopped timers will appear here for review before submission." />;
  }

  return (
    <div className="list-stack">
      {drafts.map((entry) => {
        const isEditing = editingId === entry.timesheetDetailId;
        return (
          <article key={entry.timesheetDetailId} className="list-card">
            <div className="list-head">
              <div className="list-head-copy">
                <h3 className="list-title">{entry.taskSubject || "No task"}</h3>
                <p className="panel-subtitle">{entry.customerName || "No customer"}</p>
              </div>
              <span className="badge badge-complete">{formatWorkedTime(entry.hours)}</span>
            </div>
            <p className="list-description task-supporting-copy">{entry.projectName || entry.activityType || "No project"}</p>

            {isEditing ? (
              <div className="draft-edit-form">
                <div className="draft-edit-row">
                  <label className="report-date-label">From</label>
                  <input
                    type="datetime-local"
                    className="report-date-input"
                    value={editFrom}
                    max={editTo || undefined}
                    onChange={(e) => onEditFromChange(e.target.value)}
                  />
                </div>
                <div className="draft-edit-row">
                  <label className="report-date-label">To</label>
                  <input
                    type="datetime-local"
                    className="report-date-input"
                    value={editTo}
                    min={editFrom || undefined}
                    onChange={(e) => onEditToChange(e.target.value)}
                  />
                </div>
                <div className="button-row" style={{ marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="timer-action-button timer-action-button-start"
                    onClick={onSaveEdit}
                    disabled={saving}
                  >
                    <Check size={15} />
                    Save
                  </button>
                  <button
                    type="button"
                    className="timer-action-button"
                    onClick={onCancelEdit}
                    disabled={saving}
                  >
                    <X size={15} />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="muted-row time-range-row" style={{ marginTop: "0.8rem" }}>
                {formatEntryTime(entry.fromTime)} to {formatEntryTime(entry.toTime)}
              </div>
            )}

            {!isEditing && (
              <div className="button-row" style={{ marginTop: "0.8rem" }}>
                <button type="button" className="timer-action-button" onClick={() => onEdit(entry)}>
                  <FileEdit size={15} />
                  Edit
                </button>
                <button
                  type="button"
                  className="timer-action-button timer-action-button-start"
                  onClick={() => onSubmit(entry)}
                  disabled={!entry.canSubmit}
                  title={entry.canSubmit ? undefined : "Stop the running timer first"}
                >
                  <Check size={15} />
                  Submit
                </button>
              </div>
            )}

            {!entry.canSubmit && !isEditing && (
              <p className="panel-subtitle" style={{ marginTop: "0.4rem", color: "var(--warning)" }}>
                Timer still running in this timesheet - stop it first to submit.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function TimesheetScreen() {
  const { showToast } = useToast();
  const [payload, setPayload] = useState<TimesheetsData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activityTypes, setActivityTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFrom, setEditFrom] = useState("");
  const [editTo, setEditTo] = useState("");
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [timesheetsOpen, setTimesheetsOpen] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  const loadDrafts = async () => {
    setDraftsLoading(true);
    try {
      const response = await fetchAction<DraftsData>("draft_entries");
      setDrafts(response.data?.drafts ?? []);
    } catch {
      setDrafts([]);
    } finally {
      setDraftsLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);

    const [timesheetsResult, tasksResult, activityTypesResult] = await Promise.allSettled([
      fetchAction<TimesheetsData>("timesheets"),
      fetchAction<{ tasks: Task[] }>("tasks"),
      fetchAction<ActivityTypesData>("activity_types")
    ]);

    if (timesheetsResult.status === "fulfilled") {
      setPayload(timesheetsResult.value.data);
    } else {
      setPayload(null);
      setError(
        timesheetsResult.reason instanceof Error
          ? timesheetsResult.reason.message
          : "Timesheet data could not be loaded."
      );
    }

    if (tasksResult.status === "fulfilled") {
      setTasks(tasksResult.value.data.tasks);
    } else {
      setTasks([]);
    }

    if (activityTypesResult.status === "fulfilled") {
      setActivityTypes(activityTypesResult.value.data.activityTypes);
    } else {
      setActivityTypes([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    setNotificationPermission(getNotificationPermissionState());
    void load();
    void loadDrafts();
  }, []);

  useEffect(() => {
    const maybeNotify = async () => {
      if (notificationPermission !== "granted" || document.visibilityState !== "hidden") {
        return;
      }

      const runningTimer = payload?.runningTimer;

      if (runningTimer?.timesheetDetailId) {
        const timerKey = `timer-running:${runningTimer.timesheetDetailId}`;
        if (shouldSendNotification(timerKey, 60 * 60 * 1000)) {
          await showSystemNotification({
            title: "Timer still running",
            body: `${runningTimer.taskSubject || "Your timer"} is still active.`,
            tag: "timer-running",
            url: "/timesheet"
          });
        }
      }

      if (drafts.length > 0 && shouldSendNotification("draft-entries", 2 * 60 * 60 * 1000)) {
        await showSystemNotification({
          title: "Draft entries pending",
          body: `You have ${drafts.length} draft ${drafts.length === 1 ? "entry" : "entries"} ready to review.`,
          tag: "draft-entries",
          url: "/timesheet"
        });
      }
    };

    const handleVisibilityChange = () => {
      void maybeNotify();
    };

    const intervalId = window.setInterval(() => {
      void maybeNotify();
    }, 60 * 1000);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void maybeNotify();

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [drafts.length, notificationPermission, payload?.runningTimer]);

  const lastWorkedId = useMemo(() => {
    const entry = payload?.timesheets?.find((e) => !e.isRunning);
    return entry?.timesheetDetailId ?? null;
  }, [payload?.timesheets]);

  const filteredTimesheets = useMemo(() => {
    if (!payload?.timesheets) {
      return [];
    }

    return payload.timesheets.filter((entry) =>
      [entry.taskSubject, entry.customerName, entry.projectName, entry.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [payload?.timesheets, search]);

  const startTimer = async (task: Task, activityType: string) => {
    const taskId = task?.taskId?.trim();

    if (!taskId) {
      showToast({
        title: "Unable to start timer",
        message: "No task was selected. Please choose a task and try again.",
        variant: "error"
      });
      return;
    }

    try {
      await fetchAction("start_timer", { task: taskId, activity_type: activityType }, "POST");
      setShowTimerModal(false);
      showToast({
        title: "Timer started",
        message: "Your timer is now running."
      });
      await Promise.all([load(), loadDrafts()]);
    } catch (err) {
      showToast({
        title: "Unable to start timer",
        message: err instanceof Error ? err.message : "Please try again.",
        variant: "error"
      });
    }
  };

  const stopTimer = async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await fetchAction("stop_timer", undefined, "POST");
      showToast({
        title: "Timer stopped",
        message: "Saved to draft entries."
      });
      if (document.visibilityState === "hidden") {
        await showSystemNotification({
          title: "Timer stopped",
          body: "The timer was saved to your draft entries.",
          tag: "timer-stopped",
          url: "/timesheet"
        });
      }
    } catch (err) {
      showToast({
        title: "Unable to stop timer",
        message: err instanceof Error ? err.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setStopping(false);
      await Promise.all([load(), loadDrafts()]);
    }
  };

  const handleEdit = (entry: DraftEntry) => {
    setEditingId(entry.timesheetDetailId);
    setEditFrom(toDateTimeLocal(entry.fromTime));
    setEditTo(toDateTimeLocal(entry.toTime));
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setDraftSaving(true);
    setDraftError(null);
    try {
      await fetchAction(
        "update_draft_entry",
        {
          timesheet_detail_id: editingId,
          from_time: fromDateTimeLocal(editFrom),
          to_time: fromDateTimeLocal(editTo)
        },
        "POST"
      );
      setEditingId(null);
      showToast({
        title: "Draft updated",
        message: "Your draft entry changes were saved."
      });
      await Promise.all([load(), loadDrafts()]);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Failed to save changes.");
      showToast({
        title: "Unable to update draft entry",
        message: err instanceof Error ? err.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setDraftSaving(false);
    }
  };

  const handleSubmitDraft = async (entry: DraftEntry) => {
    setDraftSaving(true);
    setDraftError(null);
    try {
      await fetchAction("submit_draft_timesheet", { timesheet_detail_id: entry.timesheetDetailId }, "POST");
      showToast({
        title: "Draft submitted",
        message: "The draft entry was submitted successfully."
      });
      if (document.visibilityState === "hidden") {
        await showSystemNotification({
          title: "Draft submitted",
          body: "Your draft entry was submitted successfully.",
          tag: "draft-submitted",
          url: "/timesheet"
        });
      }
      await Promise.all([load(), loadDrafts()]);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Failed to submit timesheet.");
      showToast({
        title: "Unable to submit draft entry",
        message: err instanceof Error ? err.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setDraftSaving(false);
    }
  };

  const enableNotifications = async () => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      showToast({
        title: "Notifications enabled",
        message: "You will receive timer and draft reminders when supported."
      });
      await showSystemNotification({
        title: "Notifications enabled",
        body: "Timer and draft reminders are now active.",
        tag: "notifications-enabled",
        url: "/timesheet"
      });
      return;
    }

    if (permission === "denied") {
      showToast({
        title: "Notifications blocked",
        message: "Enable browser notifications later if you want reminders.",
        variant: "info"
      });
      return;
    }

    showToast({
      title: "Notifications unavailable",
      message: "This browser does not support mobile notifications.",
      variant: "info"
    });
  };

  if (loading) {
    return <LoadingState label="Loading timesheets..." />;
  }

  if (!payload) {
    return <EmptyState title="Timesheets unavailable" copy={error || "No timesheet data was returned from the API."} />;
  }

  return (
    <>
      <div className="screen-stack screen-stack--single">
        <Panel>
          <div className="panel-title-row panel-title-row-stack">
            <button
              type="button"
              className="collapsible-header"
              onClick={() => setDraftsOpen((open) => !open)}
            >
              <div className="collapsible-header-copy">
                <h2 className="panel-title">Draft Entries</h2>
                <p className="panel-subtitle">Review stopped timers, edit times if needed, then submit them.</p>
              </div>
              <div className="collapsible-header-meta">
                <span className="collapsible-count">{drafts.length}</span>
                <span className={`collapsible-chevron ${draftsOpen ? "is-open" : ""}`}>▼</span>
              </div>
            </button>
          </div>

          {draftError ? (
            <p className="panel-subtitle" style={{ color: "var(--danger)", marginBottom: "0.75rem", wordBreak: "break-word" }}>
              {draftError}
            </p>
          ) : null}

          {draftsOpen ? (
            <div className="collapsible-body">
              {draftsLoading ? (
                <LoadingState label="Loading draft entries..." />
              ) : (
                <DraftEntriesList
                  drafts={drafts}
                  onEdit={handleEdit}
                  onSubmit={handleSubmitDraft}
                  editingId={editingId}
                  editFrom={editFrom}
                  editTo={editTo}
                  onEditFromChange={setEditFrom}
                  onEditToChange={setEditTo}
                  onSaveEdit={() => void handleSaveEdit()}
                  onCancelEdit={() => setEditingId(null)}
                  saving={draftSaving}
                />
              )}
            </div>
          ) : null}
        </Panel>

        <Panel>
          <div className="panel-title-row panel-title-row-stack">
            <button
              type="button"
              className="collapsible-header"
              onClick={() => setSummaryOpen((open) => !open)}
            >
              <div className="collapsible-header-copy">
                <h2 className="panel-title">Timesheets</h2>
                <p className="panel-subtitle">Manage your running timer and review time entries.</p>
              </div>
              <div className="collapsible-header-meta">
                <span className={`collapsible-chevron ${summaryOpen ? "is-open" : ""}`}>▼</span>
              </div>
            </button>
            <div className="button-row button-row-end">
              {payload.runningTimer ? (
                <button
                  className="timer-action-button timer-action-button-stop"
                  onClick={() => void stopTimer()}
                  disabled={stopping}
                >
                  <Square size={18} />
                  {stopping ? "Stopping..." : "Stop Timer"}
                </button>
              ) : (
                <button className="timer-action-button timer-action-button-start" onClick={() => setShowTimerModal(true)}>
                  <Clock3 size={18} />
                  Start Timer
                </button>
              )}
            </div>
          </div>

          {summaryOpen ? (
            <div className="collapsible-body">
              <div className="button-row" style={{ marginBottom: "1rem" }}>
                <Button
                  type="button"
                  variant={notificationPermission === "granted" ? "secondary" : "primary"}
                  onClick={() => void enableNotifications()}
                  disabled={notificationPermission === "granted"}
                >
                  {notificationPermission === "granted" ? "Notifications Enabled" : "Enable Mobile Notifications"}
                </Button>
              </div>
              <div className="metric-grid metric-grid--timesheet">
                <article className="metric-card">
                  <span className="metric-label">Entries</span>
                  <span className="metric-value">{payload.summary.entries}</span>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Completed</span>
                  <span className="metric-value">{payload.summary.completedEntries}</span>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Hours</span>
                  <span className="metric-value">{formatHours(payload.summary.totalHours)}</span>
                </article>
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel>
          <div className="panel-title-row panel-title-row-stack">
            <button
              type="button"
              className="collapsible-header"
              onClick={() => setTimesheetsOpen((open) => !open)}
            >
              <div className="collapsible-header-copy">
                <h2 className="panel-title">Timesheet Entries</h2>
                <p className="panel-subtitle">Search and review your recorded time entries.</p>
              </div>
              <div className="collapsible-header-meta">
                <span className="collapsible-count">{filteredTimesheets.length}</span>
                <span className={`collapsible-chevron ${timesheetsOpen ? "is-open" : ""}`}>▼</span>
              </div>
            </button>
          </div>

          {timesheetsOpen ? (
            <div className="collapsible-body">
              <div className="search-row" style={{ marginBottom: "1rem" }}>
                <InputShell className="search-field">
                  <Search size={18} color="var(--muted)" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search timesheets"
                  />
                </InputShell>
              </div>

              <div className="list-stack">
                {filteredTimesheets.length === 0 ? (
                  <EmptyState title="No timesheets found" copy="Start a timer or change the current filter." />
                ) : (
                  filteredTimesheets.map((entry) => {
                    const isLastWorked = entry.timesheetDetailId === lastWorkedId;
                    return (
                      <article key={entry.timesheetDetailId} className={`list-card ${isLastWorked ? "list-card--highlighted" : ""}`}>
                        {isLastWorked && (
                          <div className="last-worked-badge">
                            <Clock3 size={11} />
                            Last worked on
                          </div>
                        )}
                        <div className="list-head">
                          <div className="list-head-copy">
                            <h3 className="list-title">{entry.taskSubject}</h3>
                            <p className="panel-subtitle">{entry.customerName || "No customer"}</p>
                          </div>
                          <span className={`badge ${entry.isRunning ? "badge-progress" : "badge-complete"}`}>
                            {entry.isRunning ? "Running" : formatWorkedTime(entry.hours)}
                          </span>
                        </div>
                        <p className="list-description task-supporting-copy">{entry.projectName || "No project"}</p>
                        <div className="muted-row time-range-row" style={{ marginTop: "0.8rem" }}>
                          {entry.fromTime} {entry.toTime ? `to ${entry.toTime}` : "to now"}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </Panel>

      </div>

      <TimerModal
        open={showTimerModal}
        tasks={tasks}
        activityTypes={activityTypes}
        onClose={() => setShowTimerModal(false)}
        onStart={startTimer}
      />
    </>
  );
}
