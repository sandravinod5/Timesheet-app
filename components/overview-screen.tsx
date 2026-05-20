"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  RefreshCw,
  Square,
  Target,
  TrendingUp
} from "lucide-react";
import { fetchAction } from "@/lib/client";
import { formatLocalTime, getElapsedSeconds, parseApiDateTime } from "@/lib/datetime";
import { showSystemNotification } from "@/lib/notifications";
import type { ActivityTypesData, OverviewData, Task, TimesheetsData } from "@/lib/types";
import { formatDuration, formatHours, formatWorkedTime, statusBadgeClass } from "@/lib/utils";
import { EmptyState, LoadingState, OverviewSkeleton, Panel } from "@/components/ui";
import { KpiModal } from "@/components/kpi-modal";
import { useToast } from "@/components/toast-provider";
import { TimerModal } from "@/components/timer-modal";

const STANDARD_HOURS_PER_DAY = 7;
const POLL_INTERVAL_MS = 15 * 1000;

function formatClockTime(value?: string | null, utcValue?: string | null) {
  return formatLocalTime(value, utcValue) || "-";
}

function formatPeriodLabel(fromDate?: string, toDate?: string) {
  if (!fromDate || !toDate) {
    return "Current period";
  }

  return `${fromDate} to ${toDate}`;
}

function getWorkingDays(fromDate?: string, toDate?: string) {
  if (!fromDate || !toDate) {
    return 0;
  }

  const current = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  let workingDays = 0;

  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      workingDays += 1;
    }
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}

export function OverviewScreen() {
  const { showToast } = useToast();
  const [data, setData] = useState<OverviewData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recent, setRecent] = useState<TimesheetsData | null>(null);
  const [activityTypes, setActivityTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [kpiType, setKpiType] = useState<string | null>(null);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [recentTimesheetsOpen, setRecentTimesheetsOpen] = useState(false);
  const [recentVisitsOpen, setRecentVisitsOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const driftWarningRef = useRef<string | null>(null);

  const load = async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoading(true);
      setError(null);
      setRecentError(null);
    } else {
      setSyncing(true);
    }

    const [overviewResult, tasksResult, timesheetsResult, activityTypesResult] = await Promise.allSettled([
      fetchAction<OverviewData>("overview"),
      fetchAction<{ tasks: Task[] }>("tasks"),
      fetchAction<TimesheetsData>("timesheets"),
      fetchAction<ActivityTypesData>("activity_types")
    ]);

    if (overviewResult.status === "fulfilled") {
      setData(overviewResult.value.data);
      setLastSyncedAt(new Date());
    } else {
      setData(null);
      setError(overviewResult.reason instanceof Error ? overviewResult.reason.message : "Overview could not be loaded.");
    }

    if (tasksResult.status === "fulfilled") {
      setTasks(tasksResult.value.data.tasks);
    } else {
      setTasks([]);
    }

    if (timesheetsResult.status === "fulfilled") {
      setRecent(timesheetsResult.value.data);
    } else {
      setRecent(null);
      setRecentError(
        timesheetsResult.reason instanceof Error
          ? timesheetsResult.reason.message
          : "Recent timesheets could not be loaded."
      );
    }

    if (activityTypesResult.status === "fulfilled") {
      setActivityTypes(activityTypesResult.value.data.activityTypes);
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
    void load();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
      }
    }, POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
      }
    };

    window.addEventListener("focus", onVisibilityChange);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisibilityChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!data?.runningTimer?.fromTime) {
      setElapsed(0);
      return;
    }

    const run = () => {
      setElapsed(
        getElapsedSeconds(
          data.runningTimer?.fromTime,
          data.runningTimer?.fromTimeUtc,
          data.runningTimer?.liveHours,
          data.serverNowUtc
        )
      );
    };

    run();
    const timer = window.setInterval(run, 1000);
    return () => window.clearInterval(timer);
  }, [data?.runningTimer?.fromTime, data?.runningTimer?.fromTimeUtc, data?.runningTimer?.liveHours, data?.serverNowUtc]);

  useEffect(() => {
    const rt = data?.runningTimer;
    if (!rt || typeof rt.liveHours !== "number") {
      return;
    }

    const localStart = parseApiDateTime(rt.fromTime);
    const utcStart = parseApiDateTime(undefined, rt.fromTimeUtc);
    if (!localStart || !utcStart) {
      return;
    }

    const driftMinutes = Math.round(Math.abs(localStart.getTime() - utcStart.getTime()) / 60000);
    if (driftMinutes >= 20) {
      const key = `${rt.timesheetDetailId}:${driftMinutes}`;
      if (driftWarningRef.current !== key) {
        driftWarningRef.current = key;
        showToast({
          title: "Timer timezone mismatch detected",
          message: `Detected ${driftMinutes} minute drift between local and UTC timer fields. Using ERP live hours.`,
          variant: "error"
        });
      }
    }
  }, [data?.runningTimer, showToast]);

  const expectedHours = useMemo(() => {
    if (!data) {
      return 0;
    }

    const calculated = getWorkingDays(data.period.fromDate, data.period.toDate) * STANDARD_HOURS_PER_DAY;
    return calculated || data.monthSummary.expectedHours || 0;
  }, [data]);

  const shortHours = useMemo(() => {
    if (!data) {
      return 0;
    }

    return Math.max(0, Number((expectedHours - data.monthSummary.trackedHours).toFixed(2)));
  }, [data, expectedHours]);

  const trackedRatio = useMemo(() => {
    if (!data || !expectedHours) {
      return 0;
    }

    return Math.min(100, (data.monthSummary.trackedHours / expectedHours) * 100);
  }, [data, expectedHours]);

  const recentTimesheets = useMemo(() => {
    return recent?.timesheets?.filter((item) => !item.isRunning).slice(0, 5) ?? [];
  }, [recent]);

  const recentClientVisits = useMemo(() => {
    return data?.recentClientVisits ?? [];
  }, [data]);

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

      if (document.visibilityState === "hidden") {
        await showSystemNotification({
          title: "Timer started",
          body: "Your timesheet timer is now running.",
          tag: "timer-started",
          url: "/timesheet"
        });
      }

      await load();
    } catch (err) {
      showToast({
        title: "Unable to start timer",
        message: err instanceof Error ? err.message : "Please try again.",
        variant: "error"
      });
    }
  };

  const stopTimer = async () => {
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

      await load();
    } catch (err) {
      showToast({
        title: "Unable to stop timer",
        message: err instanceof Error ? err.message : "Please try again.",
        variant: "error"
      });
    }
  };

  if (loading) {
    return (
      <>
        <LoadingState label="Loading overview..." />
        <OverviewSkeleton />
      </>
    );
  }

  if (!data) {
    return <EmptyState title="Overview unavailable" copy={error || "The dashboard data could not be loaded."} />;
  }

  const timerRunning = Boolean(data.runningTimer);
  const kpis = [
    {
      key: "assigned",
      label: "Assigned",
      value: data.kpis.assigned,
      icon: Target,
      gradientClass: "primary-gradient"
    },
    {
      key: "pending",
      label: "Pending",
      value: data.kpis.pending,
      icon: AlertCircle,
      gradientClass: "warning-gradient"
    },
    {
      key: "completed",
      label: "Completed",
      value: data.kpis.completed,
      icon: CheckCircle2,
      gradientClass: "success-gradient"
    },
    {
      key: "overdue",
      label: "Overdue",
      value: data.kpis.overdue,
      icon: TrendingUp,
      gradientClass: "danger-gradient"
    }
  ];

  return (
    <>
      <div className="screen-stack overview-stack">
        <div className="overview-top-grid full-width">
        <Panel>
          <div className="panel-title-row">
            <div>
              <h2 className="panel-title">Overview</h2>
              <p className="panel-subtitle">Your live timer, monthly target, and task momentum.</p>
              <p className="panel-subtitle">
                {syncing
                  ? "Syncing..."
                  : lastSyncedAt
                    ? `Last synced ${lastSyncedAt.toLocaleTimeString()}`
                    : "Not synced yet"}
              </p>
            </div>
            <button
              className={`sync-icon-button ${syncing ? "is-syncing" : ""}`}
              onClick={() => void load({ silent: true })}
              title="Sync now"
              aria-label="Sync now"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="hero-timer">
            <div className={`timer-ring-wrap ${timerRunning ? "timer-ring-wrap--running" : ""}`}>
              <div className="timer-ring-outer">
                <div className="timer-ring-inner">
                  <div className="timer-copy">
                    <p className="eyebrow">{timerRunning ? "Live" : "Idle"}</p>
                    <p className="timer-value">
                      {timerRunning ? formatDuration(elapsed) : "00:00:00"}
                    </p>
                    {timerRunning ? (
                      <>
                        <p className="timer-meta">{data.runningTimer?.taskSubject}</p>
                        <p className="panel-subtitle timer-running-subtitle">
                          {data.runningTimer?.customerName || "No customer"}
                          {data.runningTimer?.activityType ? ` | ${data.runningTimer.activityType}` : ""}
                        </p>
                      </>
                    ) : (
                      <p className="timer-meta">Tap + to begin</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="timer-fab-row">
              {timerRunning ? (
                <button className="timer-action-button timer-action-button-stop" onClick={() => void stopTimer()}>
                  <Square size={18} />
                  Stop Timer
                </button>
              ) : (
                <button className="timer-action-button timer-action-button-start" onClick={() => setShowTimerModal(true)}>
                  <Clock3 size={18} />
                  Start Timer
                </button>
              )}
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="panel-title-row">
            <div>
              <h2 className="panel-title">This Month</h2>
              <p className="panel-subtitle">
                {formatPeriodLabel(data.period.fromDate, data.period.toDate)}
              </p>
            </div>
            <div className="metric-icon info-gradient">
              <Clock3 size={18} />
            </div>
          </div>

          <div className="metric-grid report-kpi-grid">
            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-label">Tracked</span>
                <span className="metric-icon primary-gradient">
                  <Clock3 size={14} />
                </span>
              </div>
              <span className="metric-value">{formatHours(data.monthSummary.trackedHours)}</span>
            </article>
            <article className="metric-card">
              <div className="metric-top">
                <span className="metric-label">Expected</span>
                <span className="metric-icon info-gradient">
                  <Target size={14} />
                </span>
              </div>
              <span className="metric-value">{formatHours(expectedHours)}</span>
            </article>
          </div>

          <div className="report-summary">
            <span className="metric-label">
              {shortHours > 0 ? (
                <span className="short-hours">{formatHours(shortHours)} short</span>
              ) : (
                <span className="on-track-hours">On track</span>
              )}
            </span>
            <span className="metric-label ratio-value">
              {Math.round(trackedRatio)}%
            </span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${trackedRatio}%`,
                background: shortHours > 0
                  ? "linear-gradient(90deg, var(--danger), #ff7a68)"
                  : "linear-gradient(90deg, var(--primary), var(--accent))"
              }}
            />
          </div>
        </Panel>

        </div>

        <Panel className="full-width">
          <div className="panel-title-row">
            <div>
              <h2 className="panel-title">Task KPIs</h2>
              <p className="panel-subtitle">Tap any card to open the matching task set.</p>
            </div>
          </div>
          <div className="kpi-grid">
            {kpis.map((item) => {
              const Icon = item.icon;

              return (
                <button key={item.key} className="kpi-card" onClick={() => setKpiType(item.key)}>
                  <div className="kpi-top">
                    <p className="kpi-label">{item.label}</p>
                    <span className={`kpi-icon ${item.gradientClass}`}>
                      <Icon size={18} />
                    </span>
                  </div>
                  <span className="kpi-value">{item.value}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel className="overview-recent-panel">
          <button
            type="button"
            className="collapsible-header"
            onClick={() => setRecentTimesheetsOpen((current) => !current)}
            aria-expanded={recentTimesheetsOpen}
          >
            <div className="collapsible-header-copy">
              <h2 className="panel-title">Recent Timesheets</h2>
              <p className="panel-subtitle">
                Latest completed time entries for {formatPeriodLabel(data.period.fromDate, data.period.toDate)}.
              </p>
            </div>
            <div className="collapsible-header-meta">
              <span className="collapsible-count">{recentTimesheets.length}</span>
              <ChevronDown size={18} className={`collapsible-chevron ${recentTimesheetsOpen ? "is-open" : ""}`} />
            </div>
          </button>

          {recentTimesheetsOpen ? (
            <div className="list-stack collapsible-body">
              {recentError ? (
                <EmptyState title="Recent timesheets unavailable" copy={recentError} />
              ) : recentTimesheets.length === 0 ? (
                <EmptyState title="No recent timesheets" copy="There are no completed entries in this period yet." />
              ) : (
                recentTimesheets.map((entry) => (
                  <article key={entry.timesheetDetailId} className="list-card">
                    <div className="list-head">
                      <div className="list-head-copy">
                        <h4 className="list-title">{entry.taskSubject}</h4>
                        <p className="panel-subtitle">{entry.customerName || "No customer"}</p>
                      </div>
                      <span className={`badge ${statusBadgeClass("Completed", 0)}`}>
                        {formatWorkedTime(entry.hours)}
                      </span>
                    </div>
                    <div className="muted-row time-range-row time-row-compact">
                      {formatClockTime(entry.fromTime, entry.fromTimeUtc)} to {formatClockTime(entry.toTime, entry.toTimeUtc)}
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}
        </Panel>

        <Panel className="overview-recent-panel">
          <button
            type="button"
            className="collapsible-header"
            onClick={() => setRecentVisitsOpen((current) => !current)}
            aria-expanded={recentVisitsOpen}
          >
            <div className="collapsible-header-copy">
              <h2 className="panel-title">Recent Client Visits</h2>
              <p className="panel-subtitle">
                Client visit time entries for {formatPeriodLabel(data.period.fromDate, data.period.toDate)}.
              </p>
            </div>
            <div className="collapsible-header-meta">
              <span className="collapsible-count">{recentClientVisits.length}</span>
              <ChevronDown size={18} className={`collapsible-chevron ${recentVisitsOpen ? "is-open" : ""}`} />
            </div>
          </button>

          {recentVisitsOpen ? (
            <div className="list-stack collapsible-body">
              {recentClientVisits.length === 0 ? (
                <EmptyState title="No client visits" copy="No visit-type time entries were found in this period." />
              ) : (
                recentClientVisits.map((entry) => (
                  <article key={entry.timesheetDetailId} className="list-card">
                    <div className="list-head">
                      <div className="list-head-copy">
                        <h4 className="list-title">{entry.customerName || entry.taskSubject || "Client Visit"}</h4>
                        <p className="panel-subtitle">{entry.taskSubject || "Visit activity"}</p>
                      </div>
                      <span className="badge badge-progress">{formatWorkedTime(entry.hours)}</span>
                    </div>
                    <div className="muted-row list-meta-wrap time-row-compact">
                      <span>{entry.projectName || "No project"}</span>
                      <span>{entry.activityType || "Visit"}</span>
                    </div>
                    <div className="muted-row time-range-row meta-row-compact">
                      {formatClockTime(entry.fromTime, entry.fromTimeUtc)} to {entry.toTime ? formatClockTime(entry.toTime, entry.toTimeUtc) : "Running"}
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}
        </Panel>
      </div>

      {kpiType ? <KpiModal type={kpiType} tasks={tasks} onClose={() => setKpiType(null)} /> : null}
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
