"use client";

import { Check, Clock3, FileEdit, Search, Square, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAction } from "@/lib/client";
import { formatDateTimeLocalInput, formatLocalDateTime } from "@/lib/datetime";
import { requestNotificationPermission, shouldSendNotification, showSystemNotification, getNotificationPermissionState } from "@/lib/notifications";
import type { ActivityTypeOption, ActivityTypesData, DraftEntry, DraftsData, Task, TimesheetsData } from "@/lib/types";
import { formatHours, formatWorkedTime } from "@/lib/utils";
import { Button, EmptyState, InputShell, LoadingState, Modal, Panel } from "@/components/ui";
import { useToast } from "@/components/toast-provider";
import { TimerModal } from "@/components/timer-modal";

const POLL_INTERVAL_MS = 15 * 1000;
const NOTIFICATIONS_MUTED_KEY = "timesheet_notifications_muted";

function toDateTimeLocal(value: string | null | undefined, utcValue?: string | null) {
  return formatDateTimeLocalInput(value, utcValue);
}

function fromDateTimeLocal(value: string) {
  return value.replace("T", " ") + ":00";
}

function formatEntryTime(value: string, utcValue?: string | null) {
  return formatLocalDateTime(value, utcValue, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function DraftEntriesList({
  drafts,
  onEdit,
  onSubmit,
  editingId,
  editFrom,
  editTo,
  editNotes,
  onEditFromChange,
  onEditToChange,
  onEditNotesChange,
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
  editNotes: string;
  onEditFromChange: (v: string) => void;
  onEditToChange: (v: string) => void;
  onEditNotesChange: (v: string) => void;
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
                <div className="draft-edit-row draft-edit-row--full">
                  <label className="report-date-label">Description</label>
                  <textarea
                    className="draft-edit-textarea"
                    value={editNotes}
                    onChange={(e) => onEditNotesChange(e.target.value)}
                    placeholder="Add description"
                    rows={3}
                  />
                </div>
                <div className="button-row button-row-compact">
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
              <>
                <div className="muted-row time-range-row time-row-spaced">
                  {formatEntryTime(entry.fromTime, entry.fromTimeUtc)} to {formatEntryTime(entry.toTime, entry.toTimeUtc)}
                </div>
                {entry.notes ? (
                  <p className="list-description task-supporting-copy description-note">
                    {entry.notes}
                  </p>
                ) : null}
              </>
            )}

            {!isEditing && (
              <div className="button-row button-row-top">
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
              <p className="panel-subtitle warning-copy">
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
  const [activityTypes, setActivityTypes] = useState<ActivityTypeOption[]>([]);
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
  const [editNotes, setEditNotes] = useState("");
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [timesheetsOpen, setTimesheetsOpen] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [notificationsMuted, setNotificationsMuted] = useState(false);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [manualTaskId, setManualTaskId] = useState("");
  const [manualTaskSearch, setManualTaskSearch] = useState("");
  const [manualParentGroup, setManualParentGroup] = useState("");
  const [manualActivityType, setManualActivityType] = useState("");
  const [manualFrom, setManualFrom] = useState("");
  const [manualTo, setManualTo] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const loadDrafts = async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setDraftsLoading(true);
    }
    try {
      const response = await fetchAction<DraftsData>("draft_entries");
      setDrafts(response.data?.drafts ?? []);
    } catch {
      setDrafts([]);
    } finally {
      if (!silent) {
        setDraftsLoading(false);
      }
    }
  };

  const load = async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoading(true);
      setError(null);
    } else {
      setSyncing(true);
    }

    const [timesheetsResult, tasksResult, activityTypesResult] = await Promise.allSettled([
      fetchAction<TimesheetsData>("timesheets"),
      fetchAction<{ tasks: Task[] }>("tasks"),
      fetchAction<ActivityTypesData>("activity_types")
    ]);

    if (timesheetsResult.status === "fulfilled") {
      setPayload(timesheetsResult.value.data);
      setLastSyncedAt(new Date());
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
      const mapped = (activityTypesResult.value.data.activityTypes || []).map((item) =>
        typeof item === "string"
          ? { name: item, customParentGroup: "Internal (Others)" }
          : item
      );
      setActivityTypes(mapped);
    } else {
      setActivityTypes([]);
    }

    if (!silent) {
      setLoading(false);
    } else {
      setSyncing(false);
    }
  };

  useEffect(() => {
    setNotificationPermission(getNotificationPermissionState());
    const storedMuted = localStorage.getItem(NOTIFICATIONS_MUTED_KEY);
    setNotificationsMuted(storedMuted === "true");
    void load();
    void loadDrafts();
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void Promise.all([load({ silent: true }), loadDrafts({ silent: true })]);
      }
    };

    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    const maybeNotify = async () => {
      if (notificationPermission !== "granted" || notificationsMuted || document.visibilityState !== "hidden") {
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
  }, [drafts.length, notificationPermission, notificationsMuted, payload?.runningTimer]);

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

  const openManualEntryModal = () => {
    if (tasks.length === 0) {
      showToast({
        title: "No tasks available",
        message: "Load tasks first, then add a manual entry.",
        variant: "error"
      });
      return;
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const availableActivityTypes =
      activityTypes.length > 0 ? activityTypes : [{ name: "Working", customParentGroup: "Internal (Others)" }];
    const parentConfig = ["Visit", "Internal (Others)", "Review", "Finalisation", "Drafting"];
    const definedParents = [...new Set(
      availableActivityTypes
        .map((item) => (item.customParentGroup || "").trim())
        .filter(Boolean)
    )];
    const orderedParents = [
      ...parentConfig.filter((name) => definedParents.includes(name)),
      ...definedParents.filter((name) => !parentConfig.includes(name))
    ];
    const firstParent = orderedParents[0] || "Internal (Others)";
    const firstActivity =
      availableActivityTypes.find(
        (item) => (item.customParentGroup || "Internal (Others)").trim().toLowerCase() === firstParent.toLowerCase()
      )?.name || availableActivityTypes[0]?.name || "Working";

    setManualTaskId(tasks[0]?.taskId || "");
    setManualTaskSearch("");
    setManualParentGroup(firstParent);
    setManualActivityType(firstActivity);
    setManualFrom(formatDateTimeLocalInput(oneHourAgo.toISOString()));
    setManualTo(formatDateTimeLocalInput(now.toISOString()));
    setManualNotes("");
    setShowManualEntryModal(true);
  };

  const closeManualEntryModal = () => {
    if (manualSaving) {
      return;
    }
    setShowManualEntryModal(false);
  };

  const manualParentGroups = useMemo(() => {
    const availableActivityTypes =
      activityTypes.length > 0 ? activityTypes : [{ name: "Working", customParentGroup: "Internal (Others)" }];
    const parentConfig = ["Visit", "Internal (Others)", "Review", "Finalisation", "Drafting"];
    const defined = [...new Set(
      availableActivityTypes
        .map((item) => (item.customParentGroup || "").trim())
        .filter(Boolean)
    )];
    return [
      ...parentConfig.filter((name) => defined.includes(name)),
      ...defined.filter((name) => !parentConfig.includes(name))
    ];
  }, [activityTypes]);

  const manualActivitiesForParent = useMemo(() => {
    const availableActivityTypes =
      activityTypes.length > 0 ? activityTypes : [{ name: "Working", customParentGroup: "Internal (Others)" }];
    const parent = (manualParentGroup || "").trim().toLowerCase();
    return availableActivityTypes
      .filter((item) => (item.customParentGroup || "Internal (Others)").trim().toLowerCase() === parent)
      .map((item) => item.name);
  }, [activityTypes, manualParentGroup]);

  const filteredManualTasks = useMemo(() => {
    const query = manualTaskSearch.trim().toLowerCase();
    if (!query) {
      return tasks;
    }

    return tasks.filter((task) =>
      [task.subject, task.taskId, task.customerName, task.projectName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [manualTaskSearch, tasks]);

  useEffect(() => {
    if (!showManualEntryModal) {
      return;
    }

    if (filteredManualTasks.length === 0) {
      setManualTaskId("");
      return;
    }

    const exists = filteredManualTasks.some((task) => task.taskId === manualTaskId);
    if (!exists) {
      setManualTaskId(filteredManualTasks[0].taskId);
    }
  }, [filteredManualTasks, manualTaskId, showManualEntryModal]);

  const startTimer = async (task: Task, activityType: string, notes: string) => {
    const taskId = task?.taskId?.trim();

    if (!taskId) {
      showToast({
        title: "Unable to start timer",
        message: "No task was selected. Please choose a task and try again.",
        variant: "error"
      });
      return;
    }

    const params: Record<string, string> = { task: taskId, activity_type: activityType };
    if (notes.trim()) {
      params.notes = notes.trim();
    }

    try {
      await fetchAction("start_timer", params, "POST");
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
      const response = await fetchAction<{
        message?: string;
        runningTimer?: { timesheetDetailId?: string } | null;
      }>("stop_timer");

      const stillRunning = Boolean(response.data?.runningTimer);
      showToast({
        title: stillRunning ? "Another timer is still active" : "Timer stopped",
        message: response.data?.message || "Saved to draft entries.",
        variant: stillRunning ? "error" : undefined
      });
      if (!stillRunning && document.visibilityState === "hidden") {
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

  const createManualEntry = async () => {
    if (!manualTaskId) {
      showToast({
        title: "Task required",
        message: "Please select a task for this manual entry.",
        variant: "error"
      });
      return;
    }

    if (!manualActivityType.trim()) {
      showToast({
        title: "Activity required",
        message: "Please select an activity type.",
        variant: "error"
      });
      return;
    }

    if (!manualFrom || !manualTo) {
      showToast({
        title: "Time range required",
        message: "Please provide both start and end time.",
        variant: "error"
      });
      return;
    }

    const fromValue = fromDateTimeLocal(manualFrom);
    const toValue = fromDateTimeLocal(manualTo);
    if (fromValue >= toValue) {
      showToast({
        title: "Invalid time range",
        message: "End time must be after start time.",
        variant: "error"
      });
      return;
    }

    setManualSaving(true);
    try {
      await fetchAction(
        "create_manual_timesheet",
        {
          task: manualTaskId,
          activity_type: manualActivityType.trim(),
          from_time: fromValue,
          to_time: toValue,
          notes: manualNotes.trim()
        },
        "POST"
      );
      setShowManualEntryModal(false);
      showToast({
        title: "Manual entry added",
        message: "The timesheet entry was saved to draft entries."
      });
      await Promise.all([load(), loadDrafts()]);
    } catch (err) {
      showToast({
        title: "Unable to add manual entry",
        message: err instanceof Error ? err.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setManualSaving(false);
    }
  };

  const handleEdit = (entry: DraftEntry) => {
    setEditingId(entry.timesheetDetailId);
    setEditFrom(toDateTimeLocal(entry.fromTime, entry.fromTimeUtc));
    setEditTo(toDateTimeLocal(entry.toTime, entry.toTimeUtc));
    setEditNotes(entry.notes || "");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!editFrom || !editTo) {
      setDraftError("Start and end times are required.");
      return;
    }
    const fromVal = fromDateTimeLocal(editFrom);
    const toVal = fromDateTimeLocal(editTo);
    if (fromVal >= toVal) {
      setDraftError("End time must be after start time.");
      return;
    }
    setDraftSaving(true);
    setDraftError(null);
    try {
      await fetchAction(
        "update_draft_entry",
        {
          timesheet_detail_id: editingId,
          from_time: fromVal,
          to_time: toVal,
          notes: editNotes
        },
        "POST"
      );
      setEditingId(null);
      setEditNotes("");
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

  const toggleNotifications = async () => {
    if (notificationPermission === "granted") {
      const nextMuted = !notificationsMuted;
      setNotificationsMuted(nextMuted);
      localStorage.setItem(NOTIFICATIONS_MUTED_KEY, nextMuted ? "true" : "false");
      showToast({
        title: nextMuted ? "Notifications disabled" : "Notifications enabled",
        message: nextMuted
          ? "Timesheet reminders are turned off for this browser."
          : "Timesheet reminders are now active again."
      });
      return;
    }

    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      setNotificationsMuted(false);
      localStorage.setItem(NOTIFICATIONS_MUTED_KEY, "false");
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
      <div className="screen-stack screen-stack--single screen-stack-desktop-two timesheet-desktop-grid">
        <Panel className="timesheet-panel-primary">
          <div className="panel-title-row panel-title-row-stack">
            <button
              type="button"
              className="collapsible-header"
              onClick={() => setSummaryOpen((open) => !open)}
            >
              <div className="collapsible-header-copy">
                <h2 className="panel-title">Timesheets</h2>
                <p className="panel-subtitle">Manage your running timer and review time entries.</p>
                <p className="panel-subtitle">
                  {syncing
                    ? "Syncing..."
                    : lastSyncedAt
                      ? `Last synced ${lastSyncedAt.toLocaleTimeString()}`
                      : "Not synced yet"}
                </p>
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
              <div className="button-row toolbar-row timesheet-toolbar-row">
                <Button
                  type="button"
                  variant={notificationPermission === "granted" && !notificationsMuted ? "secondary" : "primary"}
                  onClick={() => void toggleNotifications()}
                >
                  {notificationPermission === "granted"
                    ? notificationsMuted
                      ? "Enable Notifications"
                      : "Disable Notifications"
                    : "Enable Mobile Notifications"}
                </Button>
                <button type="button" className="timer-action-button timer-action-button-start" onClick={openManualEntryModal}>
                  <Clock3 size={16} />
                  Add Manual Entry
                </button>
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

        <Panel className="timesheet-panel-secondary">
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
            <p className="panel-subtitle alert-copy">
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
                  editNotes={editNotes}
                  onEditFromChange={setEditFrom}
                  onEditToChange={setEditTo}
                  onEditNotesChange={setEditNotes}
                  onSaveEdit={() => void handleSaveEdit()}
                  onCancelEdit={() => {
                    setEditingId(null);
                    setEditNotes("");
                  }}
                  saving={draftSaving}
                />
              )}
            </div>
          ) : null}
        </Panel>

        <Panel className="timesheet-panel-wide">
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
              <div className="search-row toolbar-row desktop-sticky-toolbar">
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
                        {entry.notes ? (
                          <p className="list-description task-supporting-copy description-note">
                            {entry.notes}
                          </p>
                        ) : null}
                        <div className="muted-row time-range-row time-row-spaced">
                          {formatEntryTime(entry.fromTime, entry.fromTimeUtc)} {entry.toTime ? `to ${formatEntryTime(entry.toTime, entry.toTimeUtc)}` : "to now"}
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
      {showManualEntryModal ? (
        <Modal title="Add Manual Timesheet Entry" subtitle="Log missed work without starting a timer" onClose={closeManualEntryModal}>
          <div className="draft-edit-form">
            <div className="draft-edit-row draft-edit-row--full">
              <label className="report-date-label">Task</label>
              <label className="input-shell modal-search" style={{ marginBottom: "0.55rem" }}>
                <Search size={18} color="var(--muted)" />
                <input
                  value={manualTaskSearch}
                  onChange={(e) => setManualTaskSearch(e.target.value)}
                  placeholder="Search task, customer, or project"
                />
              </label>
              <label className="input-shell">
                <select value={manualTaskId} onChange={(e) => setManualTaskId(e.target.value)}>
                  {filteredManualTasks.map((task) => (
                    <option key={task.taskId} value={task.taskId}>
                      {task.subject}
                    </option>
                  ))}
                </select>
              </label>
              {filteredManualTasks.length === 0 ? (
                <p className="panel-subtitle">No tasks match your search.</p>
              ) : null}
            </div>
            <div className="draft-edit-row draft-edit-row--full">
              <label className="report-date-label">Parent Group</label>
              <label className="input-shell">
                <select
                  value={manualParentGroup}
                  onChange={(e) => {
                    const nextParent = e.target.value;
                    setManualParentGroup(nextParent);
                    const availableActivityTypes =
                      activityTypes.length > 0 ? activityTypes : [{ name: "Working", customParentGroup: "Internal (Others)" }];
                    const nextActivity =
                      availableActivityTypes.find(
                        (item) => (item.customParentGroup || "Internal (Others)").trim().toLowerCase() === nextParent.toLowerCase()
                      )?.name || "";
                    setManualActivityType(nextActivity);
                  }}
                >
                  {manualParentGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="draft-edit-row draft-edit-row--full">
              <label className="report-date-label">Activity Type</label>
              <label className="input-shell">
                <select value={manualActivityType} onChange={(e) => setManualActivityType(e.target.value)}>
                  {manualActivitiesForParent.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  {manualActivitiesForParent.length === 0 ? <option value="Working">Working</option> : null}
                </select>
              </label>
            </div>
            <div className="draft-edit-row">
              <label className="report-date-label">From</label>
              <input type="datetime-local" className="report-date-input" value={manualFrom} onChange={(e) => setManualFrom(e.target.value)} />
            </div>
            <div className="draft-edit-row">
              <label className="report-date-label">To</label>
              <input type="datetime-local" className="report-date-input" value={manualTo} onChange={(e) => setManualTo(e.target.value)} />
            </div>
            <div className="draft-edit-row draft-edit-row--full">
              <label className="report-date-label">Description (optional)</label>
              <textarea
                className="draft-edit-textarea"
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="What work was done?"
                rows={3}
              />
            </div>
            <div className="button-row button-row-end">
              <button type="button" className="timer-action-button" onClick={closeManualEntryModal} disabled={manualSaving}>
                Cancel
              </button>
              <button
                type="button"
                className="timer-action-button timer-action-button-start"
                onClick={() => void createManualEntry()}
                disabled={manualSaving}
              >
                {manualSaving ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
